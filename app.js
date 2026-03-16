var SB_URL  = 'https://zoncbikfhlnigjgnjvjz.supabase.co';
var SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmNiaWtmaGxuaWdqZ25qdmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjU3MTQsImV4cCI6MjA4OTIwMTcxNH0.V1yXTM6MZWdouvITGNj9ngS6YBgeio9pwHLXMogqR8E';
var ADMIN_PWD = 'adf2024';

var mapObj, basemaps, layers;
var userMarker = null, userCircle = null, userWatchId = null;
var isAdmin = false, pendingLoc = null, pendingElemType = null;
var incList = [], detId = null;
var sbVisible = true;
var lvis = {hidrants:true, basses:true, cadenats:true, senyals:true, incidents:true};

var EC  = {operatiu:'#1E8449', avaria_menor:'#D68910', avaria_greu:'#C0392B'};
var TC  = {hidrant:'#C0392B', bassa:'#1A5276', cadenat:'#D68910', senyal:'#E65100', lloc_interes:'#8E44AD'};
var TL  = {hidrant:'Hidrant', bassa:'Bassa', cadenat:'Cadenat', senyal:'Senyal risc', lloc_interes:'Lloc'};
var EL  = {operatiu:'Operatiu', avaria_menor:'Avaria menor', avaria_greu:'Avaria greu'};
var EB  = {operatiu:'#D5F5E3', avaria_menor:'#FEF9E7', avaria_greu:'#FADBD8'};
var SBG = {oberta:'#F4ECF7', en_proces:'#FEF9E7', resolta:'#D5F5E3'};
var SCL = {oberta:'#8E44AD', en_proces:'#B7770D', resolta:'#1E8449'};

function sbH() {
  return {apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, 'Content-Type':'application/json'};
}
function mkIco(color, letter, sz) {
  sz = sz || 28;
  return L.divIcon({
    html: '<div style="width:'+sz+'px;height:'+sz+'px;background:'+color+';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;line-height:1">'+letter+'</span></div>',
    className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz], popupAnchor:[0,-(sz+4)]
  });
}
function icoFor(type, estat) {
  var color = (type==='hidrant'||type==='cadenat') ? (EC[estat]||EC.operatiu) : (TC[type]||'#888');
  var letters = {hidrant:'H', bassa:'B', cadenat:'C', senyal:'S', lloc_interes:'L'};
  return mkIco(color, letters[type]||'?');
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function mkImg(url, cls) {
  var img = document.createElement('img');
  img.src = url; img.className = cls;
  img.onerror = function(){ this.style.display='none'; };
  return img;
}

// ── INIT ────────────────────────────────────────────────
function init() {
  layers = {hidrants:L.layerGroup(), basses:L.layerGroup(), cadenats:L.layerGroup(), senyals:L.layerGroup(), incidents:L.layerGroup()};
  mapObj = L.map('map').setView([41.473, 1.980], 13);
  basemaps = {
    osm:  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM',maxZoom:19}),
    sat:  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri',maxZoom:19}),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'OTM',maxZoom:17})
  };
  basemaps.osm.addTo(mapObj);
  Object.keys(layers).forEach(function(k){ layers[k].addTo(mapObj); });
  mapObj.on('mousemove', function(e){ document.getElementById('coords').textContent = e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5); });
  mapObj.on('zoomend', function(){ document.getElementById('zm').textContent = 'Zoom: '+mapObj.getZoom(); });

  // Geolocalitzacio continua
  startLocationWatch();

  // Carrega dades
  Promise.all([
    fetch(SB_URL+'/rest/v1/map_elements?select=*', {headers:sbH()}).then(function(r){return r.json();}),
    fetch(SB_URL+'/rest/v1/incidents?select=*&order=created_at.desc', {headers:sbH()}).then(function(r){return r.json();})
  ]).then(function(res){
    renderMapElements(res[0]||[]);
    renderIncidents(res[1]||[]);
    document.getElementById('load').style.display = 'none';
    document.getElementById('dbs').textContent = (res[0]||[]).length+' elements';
  }).catch(function(err){
    console.error('Error:', err);
    document.getElementById('load').style.display = 'none';
  });
}

// ── GEOLOCALITZACIO CONTINUA ─────────────────────────────
function startLocationWatch() {
  if (!navigator.geolocation) return;
  userWatchId = navigator.geolocation.watchPosition(
    function(p) {
      var lat = p.coords.latitude, lng = p.coords.longitude, acc = p.coords.accuracy;
      if (!userMarker) {
        // Primera vegada: centra el mapa
        mapObj.setView([lat, lng], 14);
      }
      if (userMarker) { mapObj.removeLayer(userMarker); }
      if (userCircle) { mapObj.removeLayer(userCircle); }
      userCircle = L.circle([lat,lng], {radius:acc, color:'#1A5276', fillColor:'#D6EAF8', fillOpacity:.2, weight:1}).addTo(mapObj);
      userMarker = L.marker([lat,lng], {
        icon: L.divIcon({html:'<div class="up"></div>', className:'', iconSize:[14,14], iconAnchor:[7,7]}),
        zIndexOffset: 1000
      }).addTo(mapObj);
      userMarker.bindPopup('La teva ubicacio (+-'+Math.round(acc)+'m)');
      // Actualitza pendingLoc sempre
      pendingLoc = {lat: lat, lng: lng, acc: acc};
    },
    function(err){ console.warn('GPS watch:', err.message); },
    {enableHighAccuracy: true, maximumAge: 10000, timeout: 30000}
  );
}

window.locate = function() {
  if (userMarker) {
    var pos = userMarker.getLatLng();
    mapObj.setView([pos.lat, pos.lng], 16);
    userMarker.openPopup();
  } else {
    navigator.geolocation && navigator.geolocation.getCurrentPosition(
      function(p){ mapObj.setView([p.coords.latitude, p.coords.longitude], 16); },
      function(){ alert('No s ha pogut obtenir la ubicacio.'); },
      {enableHighAccuracy:true, timeout:10000}
    );
  }
};

// ── SIDEBAR TOGGLE ────────────────────────────────────────
window.toggleSidebar = function() {
  sbVisible = !sbVisible;
  document.getElementById('sb').classList.toggle('collapsed', !sbVisible);
  setTimeout(function(){ mapObj.invalidateSize(); }, 280);
};

// ── TABS ─────────────────────────────────────────────────
window.switchTab = function(n) {
  var tabs = ['pl','pi','pp'];
  var btns = ['tl','ti','tp'];
  tabs.forEach(function(id, i) {
    document.getElementById(id).style.display = (i===n) ? 'flex' : 'none';
  });
  btns.forEach(function(id, i) {
    document.getElementById(id).classList.toggle('act', i===n);
  });
};

// ── MAP ELEMENTS ─────────────────────────────────────────
function renderMapElements(data) {
  var cnt = {hidrant:0, bassa:0, cadenat:0, senyal:0};
  data.forEach(function(el) {
    var key = el.type==='hidrant'?'hidrants': el.type==='bassa'?'basses': el.type==='cadenat'?'cadenats': el.type==='senyal'?'senyals': null;
    if (!key) return;
    var m = L.marker([el.lat, el.lng], {icon: icoFor(el.type, el.estat)});
    (function(el){ m.bindPopup(function(){ return elemPopDom(el); }, {maxWidth:280}); })(el);
    layers[key].addLayer(m);
    if (cnt[el.type] !== undefined) cnt[el.type]++;
  });
  document.getElementById('nh').textContent = cnt.hidrant;
  document.getElementById('nb').textContent = cnt.bassa;
  document.getElementById('nc').textContent = cnt.cadenat;
  document.getElementById('ch').textContent = cnt.hidrant;
  document.getElementById('cb').textContent = cnt.bassa;
  document.getElementById('cc').textContent = cnt.cadenat;
  document.getElementById('cs').textContent = cnt.senyal;
}

function elemPopDom(el) {
  var tc = EC[el.estat]||'#888', tb = EB[el.estat]||'#EEE';
  var wrap = document.createElement('div');
  if (el.photo_url) { wrap.appendChild(mkImg(el.photo_url, 'pimg')); }
  var bd = document.createElement('div'); bd.style.marginBottom = '6px';
  bd.innerHTML = '<span class="pbadge" style="background:#EEE;color:#555">'+esc(TL[el.type]||el.type)+'</span>' +
    '<span class="pbadge" style="background:'+tb+';color:'+tc+'">'+esc(EL[el.estat]||el.estat)+'</span>';
  wrap.appendChild(bd);
  var t = document.createElement('div'); t.className='ptit'; t.textContent=el.name; wrap.appendChild(t);
  if (el.description) { var d=document.createElement('div'); d.className='pdesc'; d.textContent=el.description; wrap.appendChild(d); }
  if (el.ultima_revisio) { var r=document.createElement('div'); r.className='prev'; r.textContent='Revisio: '+el.ultima_revisio; wrap.appendChild(r); }
  return wrap;
}

// ── INCIDENCIES ──────────────────────────────────────────
function loadIncidents() {
  fetch(SB_URL+'/rest/v1/incidents?select=*&order=created_at.desc', {headers:sbH()})
    .then(function(r){ return r.json(); })
    .then(function(data){ renderIncidents(data||[]); })
    .catch(function(err){ console.warn('Inc:', err.message); });
}

function renderIncidents(data) {
  incList = data||[];
  var scroll = document.getElementById('iscroll');
  var noi = document.getElementById('noi');
  document.getElementById('ci').textContent = incList.length;
  document.getElementById('itn').textContent = incList.length > 0 ? '('+incList.length+')' : '';
  scroll.querySelectorAll('.ii').forEach(function(el){ el.remove(); });
  layers.incidents.clearLayers();
  if (incList.length===0) { noi.style.display='block'; return; }
  noi.style.display = 'none';
  incList.forEach(function(inc) {
    var bg=SBG[inc.status]||'#EEE', col=SCL[inc.status]||'#333';
    var div=document.createElement('div'); div.className='ii';
    (function(inc){ div.onclick=function(){ mapObj.setView([inc.lat,inc.lng],16); openDet(inc.id); }; })(inc);
    div.innerHTML='<div class="itit">'+esc(inc.title)+'</div><div class="imet"><span class="badge" style="background:'+bg+';color:'+col+'">'+inc.status.replace('_',' ')+'</span><span>'+new Date(inc.created_at).toLocaleDateString('ca-ES')+'</span><span>'+esc(inc.reporter||'Anonim')+'</span></div>';
    scroll.insertBefore(div, noi);
    var mk=L.marker([inc.lat,inc.lng],{icon:mkIco(col,'!',26)});
    (function(inc){ mk.bindPopup(function(){ return incPopDom(inc); },{maxWidth:270}); mk.on('click',function(){ openDet(inc.id); }); })(inc);
    layers.incidents.addLayer(mk);
  });
}

function incPopDom(inc) {
  var bg=SBG[inc.status]||'#EEE', col=SCL[inc.status]||'#333';
  var wrap=document.createElement('div');
  if (inc.photo_url) { wrap.appendChild(mkImg(inc.photo_url,'pimg')); }
  var badge=document.createElement('span'); badge.className='pbadge'; badge.style.background=bg; badge.style.color=col; badge.textContent=inc.status.replace('_',' '); wrap.appendChild(badge);
  var t=document.createElement('div'); t.className='ptit'; t.textContent=inc.title; wrap.appendChild(t);
  if (inc.description) { var d=document.createElement('div'); d.className='pdesc'; d.textContent=inc.description; wrap.appendChild(d); }
  var m=document.createElement('div'); m.style.cssText='font-size:11px;color:#AAA;margin-top:5px'; m.textContent=(inc.reporter||'Anonim')+' - '+new Date(inc.created_at).toLocaleDateString('ca-ES'); wrap.appendChild(m);
  var btn=document.createElement('button'); btn.className='pbtn'; btn.textContent='Veure detall';
  (function(id){ btn.onclick=function(){ openDet(id); }; })(inc.id);
  wrap.appendChild(btn);
  return wrap;
}

// ── BOTÓ AFEGIR ──────────────────────────────────────────
window.openAddMenu = function() {
  document.getElementById('ov-add').classList.add('open');
};

window.selectType = function(type) {
  closeOv('add');
  if (type === 'incident') {
    openNewInc();
  } else {
    openAddElem(type);
  }
};

// ── NOVA INCIDENCIA ──────────────────────────────────────
window.openNewInc = function() {
  document.getElementById('ftit').value = '';
  document.getElementById('fdesc').value = '';
  document.getElementById('frep').value = '';
  updateLocStatus('locs');
  document.getElementById('ov-new').classList.add('open');
};

function updateLocStatus(elId) {
  var el = document.getElementById(elId);
  if (pendingLoc) {
    el.textContent = 'Ubicacio obtinguda (+-'+Math.round(pendingLoc.acc||0)+'m)';
    el.style.color = '#1E8449';
  } else {
    el.textContent = 'Obtenint GPS... (accepta els permisos si el navegador els demana)';
    el.style.color = '#888';
  }
}

window.submitInc = function() {
  var title = document.getElementById('ftit').value.trim();
  if (!title) { alert('Cal afegir un titol.'); return; }
  if (!pendingLoc) { alert('Esperant GPS. Comprova els permisos d\'ubicacio al navegador.'); return; }
  var btn = document.getElementById('sbtn'); btn.textContent='Enviant...'; btn.disabled=true;
  fetch(SB_URL+'/rest/v1/incidents', {
    method:'POST', headers:sbH(),
    body:JSON.stringify({title:title, description:document.getElementById('fdesc').value.trim(), reporter:document.getElementById('frep').value.trim()||'Anonim', lat:pendingLoc.lat, lng:pendingLoc.lng, status:'oberta'})
  }).then(function(r){
    btn.textContent='Enviar'; btn.disabled=false;
    if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
    closeOv('new'); loadIncidents(); switchTab(1);
    alert('Incidencia registrada!');
  }).catch(function(err){ btn.textContent='Enviar'; btn.disabled=false; alert('Error: '+err.message); });
};

// ── AFEGIR ELEMENT (proposta) ────────────────────────────
var typeEmojis = {hidrant:'💧', bassa:'🏞', cadenat:'🔒', senyal:'📷'};
var typeTitles = {hidrant:'Proposar hidrant', bassa:'Proposar bassa', cadenat:'Proposar cadenat', senyal:'Proposar senyal de risc'};

function openAddElem(type) {
  pendingElemType = type;
  document.getElementById('en-name').value = '';
  document.getElementById('en-desc').value = '';
  document.getElementById('en-rep').value = '';
  document.getElementById('elem-title').textContent = typeTitles[type] || 'Proposar element';
  updateLocStatus('en-locs');
  document.getElementById('ov-elem').classList.add('open');
}

window.submitElem = function() {
  var name = document.getElementById('en-name').value.trim();
  if (!name) { alert('Cal afegir un nom o referencia.'); return; }
  if (!pendingLoc) { alert('Esperant GPS. Comprova els permisos d\'ubicacio al navegador.'); return; }
  var btn = document.getElementById('en-btn'); btn.textContent='Enviant...'; btn.disabled=true;
  fetch(SB_URL+'/rest/v1/pending_elements', {
    method:'POST', headers:sbH(),
    body:JSON.stringify({
      name: name,
      type: pendingElemType,
      lat: pendingLoc.lat,
      lng: pendingLoc.lng,
      description: document.getElementById('en-desc').value.trim(),
      reporter: document.getElementById('en-rep').value.trim()||'Anonim',
      status: 'pendent'
    })
  }).then(function(r){
    btn.textContent='Enviar proposta'; btn.disabled=false;
    if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
    closeOv('elem');
    alert('Proposta enviada! L\'administrador la revisara aviat.');
  }).catch(function(err){ btn.textContent='Enviar proposta'; btn.disabled=false; alert('Error: '+err.message); });
};

// ── DETALL INCIDENCIA ────────────────────────────────────
function openDet(id) {
  var inc = null;
  for (var i=0; i<incList.length; i++) { if(incList[i].id===id){ inc=incList[i]; break; } }
  if (!inc) return;
  detId = id;
  document.getElementById('dettit').textContent = inc.title;
  var bg=SBG[inc.status]||'#EEE', col=SCL[inc.status]||'#333';
  var body = document.getElementById('detbody'); body.innerHTML='';
  if (inc.photo_url) { body.appendChild(mkImg(inc.photo_url,'dph')); }
  var meta=document.createElement('div'); meta.className='dm';
  meta.innerHTML='<span class="badge" style="background:'+bg+';color:'+col+'">'+inc.status.replace('_',' ')+'</span><span style="font-size:12px;color:#888">'+new Date(inc.created_at).toLocaleString('ca-ES')+'</span>';
  body.appendChild(meta);
  if (inc.description) { var dd=document.createElement('div'); dd.className='dd'; dd.textContent=inc.description; body.appendChild(dd); }
  var r1=document.createElement('div'); r1.className='df'; r1.innerHTML='Reporter: <strong>'+esc(inc.reporter||'Anonim')+'</strong>'; body.appendChild(r1);
  var r2=document.createElement('div'); r2.className='df'; r2.innerHTML='Coords: <span class="cc">'+inc.lat.toFixed(5)+', '+inc.lng.toFixed(5)+'</span>'; body.appendChild(r2);
  if (inc.admin_notes) { var an=document.createElement('div'); an.style.cssText='background:#FEF9E7;border:1px solid #F0C040;border-radius:5px;padding:8px;margin-top:8px;font-size:12px;color:#7D6608'; an.textContent=inc.admin_notes; body.appendChild(an); }
  if (isAdmin) {
    var adm=document.createElement('div'); adm.className='ab';
    adm.innerHTML='<div class="at">Gestio admin</div>'+
      '<select class="as" id="adst"><option value="oberta"'+(inc.status==='oberta'?' selected':'')+'>Oberta</option><option value="en_proces"'+(inc.status==='en_proces'?' selected':'')+'>En proces</option><option value="resolta"'+(inc.status==='resolta'?' selected':'')+'>Resolta</option></select>'+
      '<textarea class="ata" id="adnt" placeholder="Notes internes...">'+esc(inc.admin_notes||'')+'</textarea>'+
      '<button class="asv" onclick="saveAdmin()">Desar canvis</button>';
    body.appendChild(adm);
  }
  document.getElementById('ov-det').classList.add('open');
}

window.saveAdmin = function() {
  if (!detId) return;
  fetch(SB_URL+'/rest/v1/incidents?id=eq.'+detId, {
    method:'PATCH', headers:sbH(),
    body:JSON.stringify({status:document.getElementById('adst').value, admin_notes:document.getElementById('adnt').value.trim()})
  }).then(function(r){
    if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
    closeOv('det'); loadIncidents(); alert('Canvis desats.');
  }).catch(function(err){ alert('Error: '+err.message); });
};

// ── PENDENTS (admin) ─────────────────────────────────────
function loadPending() {
  fetch(SB_URL+'/rest/v1/pending_elements?select=*&status=eq.pendent&order=created_at.desc', {headers:sbH()})
    .then(function(r){ return r.json(); })
    .then(function(data){
      renderPending(data||[]);
    }).catch(function(err){ console.warn('Pending:', err.message); });
}

function renderPending(data) {
  var scroll = document.getElementById('pscroll');
  var nopend = document.getElementById('nopend');
  document.getElementById('ptn').textContent = data.length > 0 ? '('+data.length+')' : '';
  scroll.querySelectorAll('.pend-item').forEach(function(el){ el.remove(); });
  if (data.length===0) { nopend.style.display='block'; return; }
  nopend.style.display = 'none';
  data.forEach(function(p) {
    var div = document.createElement('div'); div.className='pend-item';
    div.innerHTML='<div class="pend-tit">'+esc(TL[p.type]||p.type)+': '+esc(p.name)+'</div>'+
      '<div class="pend-meta">'+esc(p.reporter||'Anonim')+' - '+new Date(p.created_at).toLocaleDateString('ca-ES')+'<br>'+
      (p.description?esc(p.description)+'<br>':'')+
      'Coords: '+p.lat.toFixed(4)+', '+p.lng.toFixed(4)+'</div>'+
      '<div class="pend-btns">'+
      '<button class="btn-val" onclick="validatePending(\''+p.id+'\',true)">✓ Validar</button>'+
      '<button class="btn-rej" onclick="validatePending(\''+p.id+'\',false)">✗ Rebutjar</button>'+
      '</div>';
    scroll.insertBefore(div, nopend);
  });
}

window.validatePending = function(id, approve) {
  if (approve) {
    // Busca l'element pendent
    fetch(SB_URL+'/rest/v1/pending_elements?id=eq.'+id+'&select=*', {headers:sbH()})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data || !data[0]) return;
        var p = data[0];
        // Insereix a map_elements
        return fetch(SB_URL+'/rest/v1/map_elements', {
          method:'POST', headers:sbH(),
          body:JSON.stringify({name:p.name, type:p.type, lat:p.lat, lng:p.lng, description:p.description, estat:'operatiu'})
        });
      })
      .then(function(r){
        if (r && !r.ok) return r.text().then(function(t){ throw new Error(t); });
        // Marca com a validat
        return fetch(SB_URL+'/rest/v1/pending_elements?id=eq.'+id, {
          method:'PATCH', headers:sbH(),
          body:JSON.stringify({status:'validat'})
        });
      })
      .then(function(){
        alert('Element validat i afegit al mapa!');
        loadPending();
        // Recarrega els elements del mapa
        layers.hidrants.clearLayers(); layers.basses.clearLayers(); layers.cadenats.clearLayers(); layers.senyals.clearLayers();
        fetch(SB_URL+'/rest/v1/map_elements?select=*', {headers:sbH()}).then(function(r){return r.json();}).then(renderMapElements);
      })
      .catch(function(err){ alert('Error: '+err.message); });
  } else {
    fetch(SB_URL+'/rest/v1/pending_elements?id=eq.'+id, {
      method:'PATCH', headers:sbH(),
      body:JSON.stringify({status:'rebutjat'})
    }).then(function(){
      loadPending();
    }).catch(function(err){ alert('Error: '+err.message); });
  }
};

// ── UI ────────────────────────────────────────────────────
window.closeOv = function(w) {
  document.getElementById('ov-'+w).classList.remove('open');
  if (w==='det') detId=null;
};
window.togL = function(type) {
  lvis[type] = !lvis[type];
  var sw = document.getElementById('sw-'+type);
  if (lvis[type]) { sw.classList.add('on'); layers[type].addTo(mapObj); }
  else { sw.classList.remove('on'); mapObj.removeLayer(layers[type]); }
};
window.setBase = function(name) {
  ['osm','sat','topo'].forEach(function(b){
    document.getElementById('sw-'+b).classList.remove('on');
    if (basemaps[b]&&mapObj.hasLayer(basemaps[b])) mapObj.removeLayer(basemaps[b]);
  });
  basemaps[name].addTo(mapObj);
  document.getElementById('sw-'+name).classList.add('on');
};
window.toggleAdmin = function() {
  if (isAdmin) {
    isAdmin = false;
    document.getElementById('abtn').textContent = 'Admin';
    document.getElementById('abtn').classList.remove('on');
    document.getElementById('tp').style.display = 'none';
    switchTab(0);
  } else {
    var p = prompt('Contrasenya:');
    if (p === ADMIN_PWD) {
      isAdmin = true;
      document.getElementById('abtn').textContent = 'Admin ON';
      document.getElementById('abtn').classList.add('on');
      document.getElementById('tp').style.display = 'block';
      loadPending();
    } else if (p !== null) { alert('Incorrecta.'); }
  }
};

// ── ARRENCA ───────────────────────────────────────────────
(function wait(){ if(typeof L!=='undefined'){ init(); } else { setTimeout(wait,50); } })();
