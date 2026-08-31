const map=L.map('map',{preferCanvas:true,zoomControl:true}).setView([-22.45,-48.4],7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);

const DATA_FILES=['data/backbone-1.geojson','data/backbone-2.geojson','data/backbone-3.geojson','data/backbone-4.geojson'];
const FIRE_DATA='data/fire-core.json';
const ENERGY_DATA='data/energy-core.json';
const FIRE_REFRESH_MS=120000;
const ENERGY_REFRESH_MS=300000;
const WEATHER_DATA='data/weather-risk.json';
const WEATHER_REFRESH_MS=300000;
const DEFESA_DATA='data/defesa-civil.json';
const DEFESA_REFRESH_MS=300000;
const SITES_DATA='data/sites.json';
const SITES_REFRESH_MS=1800000;
let allFeatures=[],layer=null,fireEvents=[],weatherEvents=[],energyEvents=[],defesaEvents=[],siteEvents=[];
const fireLayer=L.layerGroup().addTo(map);
const weatherLayer=L.layerGroup().addTo(map);
const relatedBackboneLayer=L.layerGroup().addTo(map);
const energyLayer=L.layerGroup().addTo(map);
const defesaLayer=L.layerGroup().addTo(map);
const sitesLayer=L.layerGroup().addTo(map);

const colorFor=c=>({ALTA:'#7c3aed',MEDIA:'#f59e0b',BAIXA:'#ef4444',SEM_REFERENCIA:'#64748b'})[c]||'#38bdf8';
const fireColor=c=>({URGENTE:'#dc2626',ATENCAO:'#f59e0b',MONITORAMENTO:'#16a34a'})[(c||'').toUpperCase()]||'#64748b';
const energyColor=n=>({CRITICO:'#dc2626',ALTO:'#ea580c',ATENCAO:'#f59e0b',BAIXO:'#0ea5e9',MONITORAMENTO:'#64748b'})[(n||'').toUpperCase()]||'#64748b';
const weatherColor=c=>({CRITICO:'#dc2626',ALTO:'#ea580c',ATENCAO:'#f59e0b',MONITORAMENTO:'#0ea5e9'})[(c||'').toUpperCase()]||'#64748b';
const norm=v=>(v??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const esc=v=>(v??'—').toString().replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtKm=v=>Number.isFinite(Number(v))?`${Number(v).toFixed(3)} km`:'—';

function popupHtml(p){return `<b>${esc(p.trecho||'Backbone')}</b><br>${esc(p.ponta_a)} — ${esc(p.municipio_a)}<br>${esc(p.ponta_b)} — ${esc(p.municipio_b)}<br>Cabo: <b>${esc(p.cabo)}</b><br>Confiança: ${esc(p.confianca)}`;}
function detailsHtml(p){const rows=[['Trecho',p.trecho],['Cabo',p.cabo],['Capacidade',p.capacidade],['Cluster',p.cluster],['Ponta A',`${p.ponta_a||'—'} — ${p.municipio_a||'—'}`],['Ponta B',`${p.ponta_b||'—'} — ${p.municipio_b||'—'}`],['Extensão',p.extensao_km?`${Number(p.extensao_km).toFixed(2)} km`:'—'],['Confiança',p.confianca],['Fonte',p.fonte]];return `<div class="panel-title">Trecho selecionado</div><h3>${esc(p.trecho||'Backbone')}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}`;}

function render(){const cl=document.getElementById('clusterFilter').value,cf=document.getElementById('confidenceFilter').value,q=norm(document.getElementById('searchBox').value);const feats=allFeatures.filter(f=>{const p=f.properties||{};if(cl&&p.cluster!==cl)return false;if(cf&&p.confianca!==cf)return false;if(q&&!norm([p.trecho,p.cabo,p.cluster,p.ponta_a,p.ponta_b,p.municipio_a,p.municipio_b].join(' ')).includes(q))return false;return true;});if(layer)layer.remove();layer=L.geoJSON({type:'FeatureCollection',features:feats},{style:f=>({color:colorFor(f.properties.confianca),weight:3,opacity:.78}),onEachFeature:(f,l)=>{l.bindPopup(popupHtml(f.properties));l.on('click',()=>document.getElementById('details').innerHTML=detailsHtml(f.properties));l.on('mouseover',()=>l.setStyle({weight:6,opacity:1}));l.on('mouseout',()=>layer.resetStyle(l));}}).addTo(map);document.getElementById('rotas').textContent=feats.length.toLocaleString('pt-BR');if(feats.length&&q)try{map.fitBounds(layer.getBounds(),{padding:[20,20],maxZoom:12})}catch(e){}}
function populate(){const ps=allFeatures.map(f=>f.properties||{});const uniq=k=>[...new Set(ps.map(p=>p[k]).filter(Boolean))];document.getElementById('clusters').textContent=uniq('cluster').length;document.getElementById('cabos').textContent=uniq('cabo').length;document.getElementById('municipios').textContent=new Set(ps.flatMap(p=>[p.municipio_a,p.municipio_b]).filter(Boolean)).size;const s=document.getElementById('clusterFilter');uniq('cluster').sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o)});render();}

function firePopupHtml(e){return `<div class="fire-popup"><b style="color:${fireColor(e.classificacao)}">🔥 ${esc(e.classificacao)}</b><br><b>${esc(e.id_evento)}</b><br>Município: ${esc(e.municipio)}<br>Última detecção: ${esc(e.ultima_deteccao)}<br>Backbone: <b>${esc(e.backbone)}</b><br>Cabo: ${esc(e.cabo)}<br>Distância: <b>${fmtKm(e.distancia_backbone_km)}</b><br>Confiança: ${esc(e.confianca_rota)}<br>Satélite: ${esc(e.satelite)}<br>Detecções: ${esc(e.deteccoes)}</div>`;}
function fireDetailsHtml(e){const rows=[['Classificação',e.classificacao],['Evento',e.id_evento],['Município',e.municipio],['Última detecção',e.ultima_deteccao],['Backbone',e.backbone],['Cabo',e.cabo],['Distância',fmtKm(e.distancia_backbone_km)],['Confiança',e.confianca_rota],['Satélite',e.satelite],['Detecções',e.deteccoes]];return `<div class="panel-title">🔥 Fire Core</div><h3 class="fire-title" style="color:${fireColor(e.classificacao)}">${esc(e.classificacao)}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}`;}
function highlightBackbone(e){relatedBackboneLayer.clearLayers();const f=allFeatures.find(x=>{const p=x.properties||{};return (e.id_backbone&&p.id_backbone===e.id_backbone)||(e.backbone&&p.trecho===e.backbone);});if(!f)return;L.geoJSON(f,{style:{color:fireColor(e.classificacao),weight:8,opacity:1}}).addTo(relatedBackboneLayer).bringToFront();}
function renderFire(){fireLayer.clearLayers();relatedBackboneLayer.clearLayers();const enabled=document.getElementById('fireToggle')?.checked!==false;document.getElementById('fireCount').textContent=`${fireEvents.length} ativo${fireEvents.length===1?'':'s'}`;if(!enabled)return;fireEvents.forEach(e=>{const lat=Number(e.latitude),lon=Number(e.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;const color=fireColor(e.classificacao);const marker=L.circleMarker([lat,lon],{radius:10,color:'#fff',weight:2,fillColor:color,fillOpacity:.95});marker.bindPopup(firePopupHtml(e));marker.bindTooltip(`🔥 ${e.classificacao||'FIRE'} • ${e.id_evento||''}`);marker.on('click',()=>{document.getElementById('details').innerHTML=fireDetailsHtml(e);highlightBackbone(e);});marker.addTo(fireLayer);const p=e.ponto_mais_proximo||{};const plat=Number(p.latitude),plon=Number(p.longitude);if(Number.isFinite(plat)&&Number.isFinite(plon)){L.polyline([[lat,lon],[plat,plon]],{color,weight:3,opacity:.85,dashArray:'8 8'}).addTo(fireLayer);L.circleMarker([plat,plon],{radius:5,color,weight:2,fillColor:'#fff',fillOpacity:1}).addTo(fireLayer);}});}


function energyPopupHtml(e){const ds=(e.distribuidoras||[]).join(', ')||'—';const st=(e.status||[]).join(', ')||'—';return `<div class="energy-popup"><b style="color:${energyColor(e.nivel)}">⚡⧸ SEM ENERGIA</b><br><b>${esc(e.regiao)}</b><br>${esc(e.municipio)}<br>Distribuidora: ${esc(ds)}<br>Status: ${esc(st)}<br>Ocorrências: ${(e.ocorrencias||[]).length}</div>`;}
function energyDetailsHtml(e){const rows=[['Condição','SEM ENERGIA'],['Região',e.regiao],['Município',e.municipio],['Distribuidora(s)',(e.distribuidoras||[]).join(', ')||'—'],['Status',(e.status||[]).join(', ')||'—'],['Ocorrência(s)',(e.ocorrencias||[]).join(', ')||'—'],['Referência geográfica',e.origem_coordenada],['Confiança',e.confianca_geografica]];return `<div class="panel-title">⚡ Energia</div><h3 class="energy-title" style="color:${energyColor(e.nivel)}">⚡⧸ ${esc(e.regiao)}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}`;}
function energyIcon(e){const z=map.getZoom();const compact=z<=7;const size=compact?8:11;return L.divIcon({className:'energy-outage-wrapper',html:`<div class="energy-outage-icon ${compact?'energy-compact':''}"><span class="energy-bolt"></span><span class="energy-slash"></span></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2],popupAnchor:[0,-8]});}
function renderEnergy(){energyLayer.clearLayers();const enabled=document.getElementById('energyToggle')?.checked!==false;const count=document.getElementById('energyCount');if(count)count.textContent=`${energyEvents.length} região${energyEvents.length===1?'':'ões'}`;if(!enabled)return;energyEvents.forEach(e=>{const lat=Number(e.latitude),lon=Number(e.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;const marker=L.marker([lat,lon],{icon:energyIcon(e),zIndexOffset:700});marker.bindPopup(energyPopupHtml(e));marker.bindTooltip(`⚡⧸ ${e.regiao||''} • ${e.municipio||''}`);marker.on('click',()=>{document.getElementById('details').innerHTML=energyDetailsHtml(e);});marker.addTo(energyLayer);});}
async function loadEnergy(){try{const r=await fetch(`${ENERGY_DATA}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Energy HTTP ${r.status}`);const obj=await r.json();energyEvents=Array.isArray(obj.regioes)?obj.regioes:[];renderEnergy();const c=document.getElementById('energyCount');if(c)c.title=obj.gerado_em?`Atualizado: ${obj.gerado_em}`:'Energy Core';}catch(err){console.error('Falha Energy Core',err);const c=document.getElementById('energyCount');if(c)c.textContent='erro';}}
async function loadFire(){try{const r=await fetch(`${FIRE_DATA}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Fire HTTP ${r.status}`);const obj=await r.json();fireEvents=Array.isArray(obj.eventos_ativos)?obj.eventos_ativos:[];renderFire();document.getElementById('fireCount').title=obj.gerado_em?`Atualizado: ${obj.gerado_em}`:'Fire Core';}catch(err){console.error('Falha Fire Core',err);document.getElementById('fireCount').textContent='erro';}}

function weatherPopupHtml(e){const ativo=e.ameaca_ativa?'SIM':'NÃO';return `<div class="weather-popup"><b style="color:${weatherColor(e.nivel_risco)}">🌩️ ${esc(e.nivel_risco)}</b><br><b>${esc(e.municipio)}</b><br>Ameaça ativa: <b>${ativo}</b><br>Temperatura: ${esc(e.temperatura_c)} °C<br>Vento atual: ${esc(e.vento_atual_kmh)} km/h<br>Rajada: <b>${esc(e.rajada_kmh)} km/h</b><br>Chuva total: ${esc(e.chuva_total_mm)} mm<br>Prob. chuva: ${esc(e.probabilidade_chuva_pico)}%<br>Tempestade: ${e.tempestade?'SIM':'NÃO'}<br>Sites expostos: ${esc(e.sites_total)}<br>Sites ≤4h: ${esc(e.sites_ate_4h)}</div>`;}
function weatherDetailsHtml(e){const rows=[['Nível',e.nivel_risco],['Município',e.municipio],['Ameaça ativa',e.ameaca_ativa?'SIM':'NÃO'],['Condição',e.descricao],['Temperatura',e.temperatura_c!=null?`${e.temperatura_c} °C`:'—'],['Vento atual',e.vento_atual_kmh!=null?`${e.vento_atual_kmh} km/h`:'—'],['Rajada',e.rajada_kmh!=null?`${e.rajada_kmh} km/h`:'—'],['Fonte rajada',e.fonte_rajada],['Chuva atual',e.chuva_atual_mm!=null?`${e.chuva_atual_mm} mm`:'—'],['Chuva total',e.chuva_total_mm!=null?`${e.chuva_total_mm} mm`:'—'],['Prob. chuva',e.probabilidade_chuva_pico!=null?`${e.probabilidade_chuva_pico}%`:'—'],['Tempestade',e.tempestade?'SIM':'NÃO'],['Sites expostos',e.sites_total],['Sites ≤4h',e.sites_ate_4h]];return `<div class="panel-title">🌩️ Clima / tempestade</div><h3 class="weather-title" style="color:${weatherColor(e.nivel_risco)}">${esc(e.municipio)} • ${esc(e.nivel_risco)}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}`;}
function renderWeather(){weatherLayer.clearLayers();const enabled=document.getElementById('weatherToggle')?.checked!==false;const ativos=weatherEvents.filter(e=>e.ameaca_ativa).length;const count=document.getElementById('weatherCount');if(count){count.textContent=`${ativos} ameaça${ativos===1?'':'s'}`;count.title=`${weatherEvents.length} municípios monitorados`;}if(!enabled)return;weatherEvents.forEach(e=>{const lat=Number(e.latitude),lon=Number(e.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;const color=weatherColor(e.nivel_risco);const active=Boolean(e.ameaca_ativa)||Boolean(e.tempestade);const marker=L.circleMarker([lat,lon],{radius:active?9:6,color:active?'#fff':color,weight:active?2:1,fillColor:color,fillOpacity:active?.9:.42,opacity:active?1:.72});marker.bindPopup(weatherPopupHtml(e));marker.bindTooltip(`🌩️ ${e.municipio||''} • ${e.nivel_risco||''} • rajada ${e.rajada_kmh??'—'} km/h`);marker.on('click',()=>{document.getElementById('details').innerHTML=weatherDetailsHtml(e);});marker.addTo(weatherLayer);});}
async function loadWeather(){try{const r=await fetch(`${WEATHER_DATA}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Weather HTTP ${r.status}`);const obj=await r.json();weatherEvents=Array.isArray(obj.eventos)?obj.eventos:[];renderWeather();const c=document.getElementById('weatherCount');if(c&&obj.gerado_em)c.dataset.updated=obj.gerado_em;}catch(err){console.error('Falha Weather Risk',err);const c=document.getElementById('weatherCount');if(c)c.textContent='erro';}}


function defesaPopupHtml(e){return `<div class="defesa-popup"><b style="color:#ef4444">🚨 DEFESA CIVIL</b><br><b>${esc(e.tipo||e.titulo)}</b><br>Município: <b>${esc(e.municipio)}</b><br>Gravidade: ${esc(e.gravidade)}<br>Urgência: ${esc(e.urgencia)}<br>Certeza: ${esc(e.certeza)}<br>Vigência: ${esc(e.vigencia)}<br><br>${esc(e.resumo)}</div>`;}
function defesaDetailsHtml(e){const rows=[['Tipo',e.tipo||e.titulo],['Município',e.municipio],['Gravidade',e.gravidade],['Urgência',e.urgencia],['Certeza',e.certeza],['Vigência',e.vigencia],['Status',e.status],['Fonte',e.fonte]];return `<div class="panel-title">🚨 Defesa Civil</div><h3 style="color:#ef4444">${esc(e.tipo||e.titulo)}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}<p>${esc(e.resumo)}</p>`;}
function renderDefesa(){defesaLayer.clearLayers();const enabled=document.getElementById('defesaToggle')?.checked!==false;const count=document.getElementById('defesaCount');if(count)count.textContent=`${defesaEvents.length} município${defesaEvents.length===1?'':'s'}`;if(!enabled)return;defesaEvents.forEach(e=>{const lat=Number(e.latitude),lon=Number(e.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;const marker=L.circleMarker([lat,lon],{radius:8,color:'#ffffff',weight:2,fillColor:'#ef4444',fillOpacity:.95});marker.bindPopup(defesaPopupHtml(e));marker.bindTooltip(`🚨 ${e.tipo||e.titulo||'Defesa Civil'} • ${e.municipio||''}`);marker.on('click',()=>{document.getElementById('details').innerHTML=defesaDetailsHtml(e);});marker.addTo(defesaLayer);});}

function siteIsCritical(e){return Boolean(e.ate_4h)||norm(e.autonomia).includes('ATE 4H');}
function sitePopupHtml(e){return `<div class="site-popup"><b style="color:${siteIsCritical(e)?'#fb7185':'#7dd3fc'}">📡 ${esc(e.ufsite||e.site)}</b><br><b>${esc(e.municipio)}</b><br>Autonomia: <b>${esc(e.autonomia)}</b><br>Distribuidora: ${esc(e.distribuidora)}<br>DDD: ${esc(e.ddd)}</div>`;}
function siteDetailsHtml(e){const rows=[['Site',e.ufsite||e.site],['Município',e.municipio],['Autonomia',e.autonomia],['Faixa crítica',siteIsCritical(e)?'≤ 4h':'Acima de 4h'],['Distribuidora',e.distribuidora],['DDD',e.ddd],['IBGE',e.ibge]];return `<div class="panel-title">📡 Site</div><h3 style="color:${siteIsCritical(e)?'#fb7185':'#7dd3fc'}">${esc(e.ufsite||e.site)}</h3>${rows.map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1]??'—')}</span></div>`).join('')}`;}
function renderSites(){sitesLayer.clearLayers();const enabled=document.getElementById('sitesToggle')?.checked===true;const count=document.getElementById('sitesCount');const crit=siteEvents.filter(siteIsCritical).length;if(count){count.textContent=`${siteEvents.length.toLocaleString('pt-BR')} • ${crit} ≤4h`;count.title='Sites totais • sites com autonomia até 4h';}if(!enabled)return;const z=map.getZoom();siteEvents.forEach(e=>{const lat=Number(e.latitude),lon=Number(e.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;const c=siteIsCritical(e),radius=z<=7?(c?3.0:2.0):z<=9?(c?4.2:2.8):(c?5.5:3.8);const marker=L.circleMarker([lat,lon],{radius,color:c?'#fecdd3':'#dbeafe',weight:c?1.0:.6,fillColor:c?'#fb7185':'#38bdf8',fillOpacity:c?.92:.58,opacity:.92});marker.bindPopup(sitePopupHtml(e));marker.bindTooltip(`📡 ${e.ufsite||e.site||''} • ${e.municipio||''} • ${e.autonomia||''}`);marker.on('click',()=>{document.getElementById('details').innerHTML=siteDetailsHtml(e);});marker.addTo(sitesLayer);});}
async function loadSites(){try{const r=await fetch(`${SITES_DATA}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Sites HTTP ${r.status}`);const obj=await r.json();siteEvents=Array.isArray(obj.sites)?obj.sites:[];renderSites();}catch(err){console.error('Falha Sites GEO',err);const c=document.getElementById('sitesCount');if(c)c.textContent='erro';}}

async function loadDefesa(){try{const r=await fetch(`${DEFESA_DATA}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Defesa Civil HTTP ${r.status}`);const obj=await r.json();defesaEvents=Array.isArray(obj.eventos_geo)?obj.eventos_geo:[];renderDefesa();const c=document.getElementById('defesaCount');if(c)c.title=obj.gerado_em?`Atualizado: ${obj.gerado_em}`:'Defesa Civil';}catch(err){console.error('Falha Defesa Civil',err);const c=document.getElementById('defesaCount');if(c)c.textContent='erro';}}

Promise.all(DATA_FILES.map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u);return r.json()}))).then(parts=>{allFeatures=parts.flatMap(p=>p.features||[]);populate();document.getElementById('statusText').textContent=`Backbone DEV carregado • ${allFeatures.length.toLocaleString('pt-BR')} rotas`;if(layer&&allFeatures.length)map.fitBounds(layer.getBounds(),{padding:[20,20]});renderFire();renderWeather();}).catch(err=>{document.getElementById('statusText').textContent='Falha ao carregar Backbone';console.error(err)});
['clusterFilter','confidenceFilter'].forEach(id=>document.getElementById(id).addEventListener('change',render));
document.getElementById('searchBox').addEventListener('input',()=>{clearTimeout(window._t);window._t=setTimeout(render,180)});
document.getElementById('resetBtn').addEventListener('click',()=>{document.getElementById('clusterFilter').value='';document.getElementById('confidenceFilter').value='';document.getElementById('searchBox').value='';render()});
document.getElementById('fireToggle').addEventListener('change',renderFire);
document.getElementById('energyToggle').addEventListener('change',renderEnergy);
map.on('zoomend',renderEnergy);
document.getElementById('weatherToggle').addEventListener('change',renderWeather);
document.getElementById('defesaToggle').addEventListener('change',renderDefesa);
document.getElementById('sitesToggle').addEventListener('change',renderSites);
map.on('zoomend',renderSites);
loadFire();
loadWeather();
loadEnergy();
loadDefesa();
loadSites();
setInterval(loadFire,FIRE_REFRESH_MS);
setInterval(loadWeather,WEATHER_REFRESH_MS);
setInterval(loadEnergy,ENERGY_REFRESH_MS);
setInterval(loadDefesa,DEFESA_REFRESH_MS);
setInterval(loadSites,SITES_REFRESH_MS);


// Analista Operacional SPI DEV — consolida resultados calculados pelos Cores.
function analystSnapshot(){
 const threats=weatherEvents.filter(e=>e.ameaca_ativa||e.tempestade);
 const critical=weatherEvents.filter(e=>['CRITICO','ALTO'].includes(norm(e.nivel_risco)));
 const vulnerable=weatherEvents.filter(e=>Number(e.sites_ate_4h||0)>0);
 const maxGust=[...weatherEvents].sort((a,b)=>Number(b.rajada_kmh||0)-Number(a.rajada_kmh||0))[0];
 const maxRain=[...weatherEvents].sort((a,b)=>Number(b.chuva_total_mm||0)-Number(a.chuva_total_mm||0))[0];
 const fireUrg=fireEvents.filter(e=>norm(e.classificacao)==='URGENTE');
 const dc=new Set(defesaEvents.map(e=>norm(e.municipio)).filter(Boolean));
 const convergence=weatherEvents.filter(w=>dc.has(norm(w.municipio))&&(w.ameaca_ativa||w.tempestade));
 let readiness='PREPARADA';
 if(critical.length||fireUrg.length||threats.length>=5) readiness='CRÍTICA';
 else if(threats.length||fireEvents.length||defesaEvents.length||energyEvents.length) readiness='ATENÇÃO';
 return {threats,critical,vulnerable,maxGust,maxRain,fireUrg,convergence,readiness};
}
function analystText(mode='situacao',question=''){
 const s=analystSnapshot();
 const gust=s.maxGust?`${s.maxGust.municipio}: ${s.maxGust.rajada_kmh} km/h`:'sem dado';
 const rain=s.maxRain?`${s.maxRain.municipio}: ${s.maxRain.chuva_total_mm} mm`:'sem dado';
 const lines=[];
 if(mode==='preparacao'){
  lines.push(`<b>Preparação da Regional — ${s.readiness}</b>`);
  lines.push(`Energia: ${energyEvents.length} região(ões) representada(s) sem energia. Vulnerabilidade: ${s.vulnerable.length} município(s) com sites ≤4h. Defesa Civil: ${defesaEvents.length} município(s). Fire Core: ${fireEvents.length} evento(s) ativo(s).`);
  if(s.threats.length) lines.push(`Existem ${s.threats.length} ameaça(s) meteorológica(s) ativa(s). Recomenda-se priorizar conferência de autonomia, GMGs, equipes e acessos nos municípios expostos antes do agravamento.`); else lines.push('Não há ameaça meteorológica ativa classificada pelo Weather Risk neste ciclo. Manter prontidão nos locais já afetados pelas demais camadas.');
  if(s.convergence.length) lines.push(`Há convergência entre ameaça climática e Defesa Civil em ${s.convergence.length} município(s), elevando a prioridade de acompanhamento.`);
 } else if(mode==='projecao'){
  lines.push('<b>Projeção operacional</b>');
  lines.push(`Maior rajada disponível: ${esc(gust)}. Maior chuva total disponível: ${esc(rain)}.`);
  lines.push('Trajetória, chegada, pico e saída só serão afirmados quando esses campos estiverem calculados e publicados pelos Cores. O analista não inventa horários ou deslocamentos.');
 } else {
  lines.push(`<b>Situação agora — ${s.readiness}</b>`);
  lines.push(`Clima: ${s.threats.length} ameaça(s) ativa(s). Energia: ${energyEvents.length} região(ões). Fire: ${fireEvents.length} ativo(s). Defesa Civil: ${defesaEvents.length} município(s).`);
  lines.push(`Maior rajada: ${esc(gust)}. Maior chuva: ${esc(rain)}.`);
  if(s.critical.length) lines.push(`${s.critical.length} município(s) estão em nível ALTO/CRÍTICO no Weather Risk.`);
 }
 if(question){const q=norm(question); if(q.includes('QUEIM')||q.includes('FOGO'))lines.push(`<b>Resposta:</b> ${fireEvents.length} evento(s) Fire ativo(s).`);else if(q.includes('ENERG'))lines.push(`<b>Resposta:</b> ${energyEvents.length} região(ões) representada(s) na camada Energia.`);else if(q.includes('DEFESA'))lines.push(`<b>Resposta:</b> ${defesaEvents.length} município(s) na camada Defesa Civil.`);else if(q.includes('CHUVA'))lines.push(`<b>Resposta:</b> maior chuva disponível: ${esc(rain)}.`);else if(q.includes('VENTO')||q.includes('RAJADA'))lines.push(`<b>Resposta:</b> maior rajada disponível: ${esc(gust)}.`);else lines.push(`<b>Resposta operacional:</b> quadro consolidado ${s.readiness}. A leitura preventiva completa está em “Preparação da Regional”.`);}
 return lines.join('<br><br>');
}
let analystMode='situacao';
function setAnalystActive(mode){document.querySelectorAll('[data-analysis]').forEach(b=>{const active=b.dataset.analysis===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false');});}
function refreshAnalyst(){const p=document.getElementById('analystPanel');if(!p)return;const s=analystSnapshot(),badge=document.getElementById('readinessBadge');badge.textContent=s.readiness;badge.dataset.level=norm(s.readiness);document.getElementById('analystSummary').innerHTML=analystText(analystMode);document.getElementById('analystUpdated').textContent=`Fire ${fireEvents.length} • Clima ${weatherEvents.length} • Energia ${energyEvents.length} • Defesa ${defesaEvents.length} • Sites ${siteEvents.length}`;setAnalystActive(analystMode);}
function analystRun(mode){analystMode=mode||'situacao';const summary=document.getElementById('analystSummary');summary.innerHTML=analystText(analystMode);setAnalystActive(analystMode);summary.classList.remove('analyst-flash');void summary.offsetWidth;summary.classList.add('analyst-flash');}
function analystAsk(){const q=document.getElementById('analystQuestion').value.trim();const answer=document.getElementById('analystAnswer');answer.innerHTML=q?analystText('situacao',q):'<b>Digite uma pergunta para o Analista SPI.</b>';answer.classList.remove('analyst-flash');void answer.offsetWidth;answer.classList.add('analyst-flash');}
document.querySelectorAll('[data-analysis]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();analystRun(b.dataset.analysis);}));
document.getElementById('analystAsk')?.addEventListener('click',e=>{e.preventDefault();analystAsk();});
document.getElementById('analystQuestion')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();analystAsk();}});
setAnalystActive(analystMode);setInterval(refreshAnalyst,15000);setTimeout(refreshAnalyst,1800);
