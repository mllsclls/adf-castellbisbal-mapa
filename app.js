var SB_URL = 'https://zoncbikfhlnigjgnjvjz.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbmNiaWtmaGxuaWdqZ25qdmp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjU3MTQsImV4cCI6MjA4OTIwMTcxNH0.V1yXTM6MZWdouvITGNj9ngS6YBgeio9pwHLXMogqR8E';
var ADMIN_PWD = 'adf2024';

var mapObj, basemaps, layers;
var userM = null, userC = null;
var isAdmin = false, pendingLoc = null;
var incList = [], detId = null;
var lvis = {hidrants:true, basses:true, cadenats:true, senyals:true, incidents:true};

var EC  = {operatiu:'#1E8449', avaria_menor:'#D68910', avaria_greu:'#C0392B'};
var TC  = {hidrant:'#C0392B', bassa:'#1A5276', cadenat:'#D68910', senyal:'#E65100', lloc_interes:'#8E44AD'};
var TL  = {hidrant:'Hidrant', bassa:'Bassa', cadenat:'Cadenat', senyal:'Senyal risc', lloc_interes:'Lloc'};
var EL  = {operatiu:'Operatiu', avaria_menor:'Avaria menor', avaria_greu:'Avaria greu'};
var EB  = {operatiu:'#D5F5E3', avaria_menor:'#FEF9E7', avaria_greu:'#FADBD8'};
var SBG = {oberta:'#F4ECF7', en_proces:'#FEF9E7', resolta:'#D5F5E3'};
var SCL = {oberta:'#8E44AD', en_proces:'#B7770D', resolta:'#1E8449'};

function sbH() {
  return {apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json'};
}

function mkIco(color, letter, sz) {
  sz = sz || 28;
  var html = '<div style="width:' + sz + 'px;height:' + sz + 'px;background:' + color +
    ';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;' +
    'box-shadow:0 2px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">' +
    '<span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;line-height:1">' +
    letter + '</span></div>';
  return L.divIcon({html: html, className: '', iconSize: [sz, sz], iconAnchor: [sz/2, sz], popupAnchor: [0, -(sz+4)]});
}

function icoFor(type, estat) {
  var color = (type === 'hidrant' || type === 'cadenat') ? (EC[estat] || EC.operatiu) : (TC[type] || '#888');
  var letters = {hidrant:'H', bassa:'B', cadenat:'C', senyal:'S', lloc_interes:'L'};
  return mkIco(color, letters[type] || '?');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mkImg(url, cls) {
  var img = document.createElement('img');
  img.src = url;
  img.className = cls;
  img.onerror = function() { this.style.display = 'none'; };
  return img;
}

function init() {
  layers = {
    hidrants:  L.layerGroup(),
    basses:    L.layerGroup(),
    cadenats:  L.layerGroup(),
    senyals:   L.layerGroup(),
    incidents: L.layerGroup()
  };
  mapObj = L.map('map').setView([41.473, 1.980], 13);
  basemaps = {
    osm:  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'OSM', maxZoom:19}),
    sat:  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution:'Esri', maxZoom:19}),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {attribution:'OTM', maxZoom:17})
  };
  basemaps.osm.addTo(mapObj);
  Object.keys(layers).forEach(function(k) { layers[k].addTo(mapObj); });
  mapObj.on('mousemove', function(e) { document.getElementById('coords').textContent = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5); });
  mapObj.on('zoomend', function() { document.getElementById('zm').textContent = 'Zoom: ' + mapObj.getZoom(); });

  Promise.all([
    fetch(SB_URL + '/rest/v1/map_elements?select=*', {headers: sbH()}).then(function(r) { return r.json(); }),
    fetch(SB_URL + '/rest/v1/incidents?select=*&order=created_at.desc', {headers: sbH()}).then(function(r) { return r.json(); })
  ]).then(function(res) {
    renderMapElements(res[0] || []);
    renderIncidents(res[1] || []);
    document.getElementById('load').style.display = 'none';
    document.getElementById('dbs').textContent = (res[0] || []).length + ' elements';
  }).catch(function(err) {
    console.error('Error carregant:', err);
    document.getElementById('load').style.display = 'none';
  });
}

function renderMapElements(data) {
  var cnt = {hidrant:0, bassa:0, cadenat:0, senyal:0};
  data.forEach(function(el) {
    var key = el.type==='hidrant'?'hidrants': el.type==='bassa'?'basses': el.type==='cadenat'?'cadenats': el.type==='senyal'?'senyals': null;
    if (!key) return;
    var m = L.marker([el.lat, el.lng], {icon: icoFor(el.type, el.estat)});
    (function(el) { m.bindPopup(function() { return elemPopDom(el); }, {maxWidth: 280}); })(el);
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
  var tc = EC[el.estat] || '#888';
  var tb = EB[el.estat] || '#EEE';
  var wrap = document.createElement('div');
  if (el.photo_url) { wrap.appendChild(mkImg(el.photo_url, 'pimg')); }
  var badgeDiv = document.createElement('div');
  badgeDiv.style.marginBottom = '6px';
  badgeDiv.innerHTML = '<span class="pbadge" style="background:#EEE;color:#555">' + esc(TL[el.type] || el.type) + '</span>' +
    '<span class="pbadge" style="background:' + tb + ';color:' + tc + '">' + esc(EL[el.estat] || el.estat) + '</span>';
  wrap.appendChild(badgeDiv);
  var titDiv = document.createElement('div');
  titDiv.className = 'ptit';
  titDiv.textContent = el.name;
  wrap.appendChild(titDiv);
  if (el.description) {
    var dDiv = document.createElement('div');
    dDiv.className = 'pdesc';
    dDiv.textContent = el.description;
    wrap.appendChild(dDiv);
  }
  if (el.ultima_revisio) {
    var rDiv = document.createElement('div');
    rDiv.className = 'prev';
    rDiv.textContent = 'Revisio: ' + el.ultima_revisio;
    wrap.appendChild(rDiv);
  }
  return wrap;
}

function loadIncidents() {
  fetch(SB_URL + '/rest/v1/incidents?select=*&order=created_at.desc', {headers: sbH()})
    .then(function(r) { return r.json(); })
    .then(function(data) { renderIncidents(data || []); })
    .catch(function(err) { console.warn('Incidents error:', err.message); });
}

function renderIncidents(data) {
  incList = data || [];
  var scroll = document.getElementById('iscroll');
  var noi = document.getElementById('noi');
  document.getElementById('ci').textContent = incList.length;
  document.getElementById('itn').textContent = incList.length > 0 ? '(' + incList.length + ')' : '';
  scroll.querySelectorAll('.ii').forEach(function(el) { el.remove(); });
  layers.incidents.clearLayers();
  if (incList.length === 0) { noi.style.display = 'block'; return; }
  noi.style.display = 'none';
  incList.forEach(function(inc) {
    var bg = SBG[inc.status] || '#EEE';
    var col = SCL[inc.status] || '#333';
    var div = document.createElement('div');
    div.className = 'ii';
    (function(inc) {
      div.onclick = function() { mapObj.setView([inc.lat, inc.lng], 16); openDet(inc.id); };
    })(inc);
    div.innerHTML = '<div class="itit">' + esc(inc.title) + '</div>' +
      '<div class="imet"><span class="badge" style="background:' + bg + ';color:' + col + '">' +
      inc.status.replace('_', ' ') + '</span>' +
      '<span>' + new Date(inc.created_at).toLocaleDateString('ca-ES') + '</span>' +
      '<span>' + esc(inc.reporter || 'Anonim') + '</span></div>';
    scroll.insertBefore(div, noi);
    var mk = L.marker([inc.lat, inc.lng], {icon: mkIco(col, '!', 26)});
    (function(inc) {
      mk.bindPopup(function() { return incPopDom(inc); }, {maxWidth: 270});
      mk.on('click', function() { openDet(inc.id); });
    })(inc);
    layers.incidents.addLayer(mk);
  });
}

function incPopDom(inc) {
  var bg = SBG[inc.status] || '#EEE';
  var col = SCL[inc.status] || '#333';
  var wrap = document.createElement('div');
  if (inc.photo_url) { wrap.appendChild(mkImg(inc.photo_url, 'pimg')); }
  var badge = document.createElement('span');
  badge.className = 'pbadge';
  badge.style.background = bg;
  badge.style.color = col;
  badge.textContent = inc.status.replace('_', ' ');
  wrap.appendChild(badge);
  var titDiv = document.createElement('div');
  titDiv.className = 'ptit';
  titDiv.textContent = inc.title;
  wrap.appendChild(titDiv);
  if (inc.description) {
    var dDiv = document.createElement('div');
    dDiv.className = 'pdesc';
    dDiv.textContent = inc.description;
    wrap.appendChild(dDiv);
  }
  var metaDiv = document.createElement('div');
  metaDiv.style.cssText = 'font-size:11px;color:#AAA;margin-top:5px';
  metaDiv.textContent = (inc.reporter || 'Anonim') + ' - ' + new Date(inc.created_at).toLocaleDateString('ca-ES');
  wrap.appendChild(metaDiv);
  var btn = document.createElement('button');
  btn.className = 'pbtn';
  btn.textContent = 'Veure detall';
  (function(id) { btn.onclick = function() { openDet(id); }; })(inc.id);
  wrap.appendChild(btn);
  return wrap;
}

window.openNewInc = function() {
  pendingLoc = null;
  document.getElementById('ftit').value = '';
  document.getElementById('fdesc').value = '';
  document.getElementById('frep').value = '';
  document.getElementById('locs').textContent = 'Obtenint GPS...';
  document.getElementById('locs').style.color = '#888';
  document.getElementById('ov-new').classList.add('open');
  if (!navigator.geolocation) {
    document.getElementById('locs').textContent = 'Aquest navegador no suporta GPS.';
    document.getElementById('locs').style.color = '#C0392B';
  } else {
    navigator.geolocation.getCurrentPosition(
      function(p) {
        pendingLoc = {lat: p.coords.latitude, lng: p.coords.longitude};
        document.getElementById('locs').textContent = 'Ubicacio obtinguda (+-' + Math.round(p.coords.accuracy) + 'm)';
        document.getElementById('locs').style.color = '#1E8449';
      },
      function(err) {
        var msg = 'No s ha pogut obtenir la ubicacio.';
        if (err.code === 1) msg = 'Permisos GPS denegats. Activa la ubicacio al navegador.';
        if (err.code === 2) msg = 'GPS no disponible ara.';
        if (err.code === 3) msg = 'Temps GPS superat. Torna a intentar-ho.';
        document.getElementById('locs').textContent = msg;
        document.getElementById('locs').style.color = '#C0392B';
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
    );
  }
};

window.submitInc = function() {
  var title = document.getElementById('ftit').value.trim();
  if (!title) { alert('Cal afegir un titol.'); return; }
  if (!pendingLoc) { alert('No s ha pogut obtenir la ubicacio GPS.'); return; }
  var btn = document.getElementById('sbtn');
  btn.textContent = 'Enviant...'; btn.disabled = true;
  fetch(SB_URL + '/rest/v1/incidents', {
    method: 'POST', headers: sbH(),
    body: JSON.stringify({
      title: title,
      description: document.getElementById('fdesc').value.trim(),
      reporter: document.getElementById('frep').value.trim() || 'Anonim',
      lat: pendingLoc.lat, lng: pendingLoc.lng, status: 'oberta'
    })
  }).then(function(r) {
    btn.textContent = 'Enviar'; btn.disabled = false;
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    closeOv('new'); loadIncidents(); switchTab(1);
    alert('Incidencia registrada!');
  }).catch(function(err) { btn.textContent = 'Enviar'; btn.disabled = false; alert('Error: ' + err.message); });
};

function openDet(id) {
  var inc = null;
  for (var i = 0; i < incList.length; i++) { if (incList[i].id === id) { inc = incList[i]; break; } }
  if (!inc) return;
  detId = id;
  document.getElementById('dettit').textContent = inc.title;
  var bg = SBG[inc.status] || '#EEE';
  var col = SCL[inc.status] || '#333';
  var body = document.getElementById('detbody');
  body.innerHTML = '';
  if (inc.photo_url) { body.appendChild(mkImg(inc.photo_url, 'dph')); }
  var meta = document.createElement('div');
  meta.className = 'dm';
  meta.innerHTML = '<span class="badge" style="background:' + bg + ';color:' + col + '">' + inc.status.replace('_', ' ') + '</span>' +
    '<span style="font-size:12px;color:#888">' + new Date(inc.created_at).toLocaleString('ca-ES') + '</span>';
  body.appendChild(meta);
  if (inc.description) {
    var dd = document.createElement('div'); dd.className = 'dd'; dd.textContent = inc.description; body.appendChild(dd);
  }
  var r1 = document.createElement('div'); r1.className = 'df';
  r1.innerHTML = 'Reporter: <strong>' + esc(inc.reporter || 'Anonim') + '</strong>';
  body.appendChild(r1);
  var r2 = document.createElement('div'); r2.className = 'df';
  r2.innerHTML = 'Coords: <span class="cc">' + inc.lat.toFixed(5) + ', ' + inc.lng.toFixed(5) + '</span>';
  body.appendChild(r2);
  if (inc.admin_notes) {
    var an = document.createElement('div');
    an.style.cssText = 'background:#FEF9E7;border:1px solid #F0C040;border-radius:5px;padding:8px;margin-top:8px;font-size:12px;color:#7D6608';
    an.textContent = inc.admin_notes;
    body.appendChild(an);
  }
  if (isAdmin) {
    var adm = document.createElement('div');
    adm.className = 'ab';
    adm.innerHTML = '<div class="at">Gestio admin</div>' +
      '<select class="as" id="adst">' +
      '<option value="oberta"' + (inc.status==='oberta'?' selected':'') + '>Oberta</option>' +
      '<option value="en_proces"' + (inc.status==='en_proces'?' selected':'') + '>En proces</option>' +
      '<option value="resolta"' + (inc.status==='resolta'?' selected':'') + '>Resolta</option>' +
      '</select>' +
      '<textarea class="ata" id="adnt" placeholder="Notes internes...">' + esc(inc.admin_notes || '') + '</textarea>' +
      '<button class="asv" onclick="saveAdmin()">Desar canvis</button>';
    body.appendChild(adm);
  }
  document.getElementById('ov-det').classList.add('open');
}

window.saveAdmin = function() {
  if (!detId) return;
  fetch(SB_URL + '/rest/v1/incidents?id=eq.' + detId, {
    method: 'PATCH', headers: sbH(),
    body: JSON.stringify({
      status: document.getElementById('adst').value,
      admin_notes: document.getElementById('adnt').value.trim()
    })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(t); });
    closeOv('det'); loadIncidents(); alert('Canvis desats.');
  }).catch(function(err) { alert('Error: ' + err.message); });
};

window.closeOv = function(w) { document.getElementById('ov-' + w).classList.remove('open'); if (w === 'det') detId = null; };
window.switchTab = function(n) {
  document.getElementById('tl').classList.toggle('act', n===0);
  document.getElementById('ti').classList.toggle('act', n===1);
  document.getElementById('pl').style.display = n===0 ? 'flex' : 'none';
  document.getElementById('pi').style.display = n===1 ? 'flex' : 'none';
};
window.togL = function(type) {
  lvis[type] = !lvis[type];
  var sw = document.getElementById('sw-' + type);
  if (lvis[type]) { sw.classList.add('on'); layers[type].addTo(mapObj); }
  else { sw.classList.remove('on'); mapObj.removeLayer(layers[type]); }
};
window.setBase = function(name) {
  ['osm','sat','topo'].forEach(function(b) {
    document.getElementById('sw-' + b).classList.remove('on');
    if (basemaps[b] && mapObj.hasLayer(basemaps[b])) mapObj.removeLayer(basemaps[b]);
  });
  basemaps[name].addTo(mapObj);
  document.getElementById('sw-' + name).classList.add('on');
};
window.locate = function() {
  if (!navigator.geolocation) { alert('No suportat.'); return; }
  navigator.geolocation.getCurrentPosition(
    function(p) {
      var lat = p.coords.latitude, lng = p.coords.longitude, acc = p.coords.accuracy;
      if (userM) { mapObj.removeLayer(userM); mapObj.removeLayer(userC); }
      userC = L.circle([lat, lng], {radius: acc, color:'#1A5276', fillColor:'#D6EAF8', fillOpacity:.25, weight:1.5}).addTo(mapObj);
      userM = L.marker([lat, lng], {icon: L.divIcon({html:'<div class="up"></div>', className:'', iconSize:[14,14], iconAnchor:[7,7]})}).addTo(mapObj);
      mapObj.setView([lat, lng], 16);
    },
    function() { alert('No s ha pogut obtenir la ubicacio.'); },
    {enableHighAccuracy: true, timeout: 12000}
  );
};
window.toggleAdmin = function() {
  if (isAdmin) {
    isAdmin = false;
    document.getElementById('abtn').textContent = 'Admin';
    document.getElementById('abtn').classList.remove('on');
  } else {
    var p = prompt('Contrasenya:');
    if (p === ADMIN_PWD) {
      isAdmin = true;
      document.getElementById('abtn').textContent = 'Admin ON';
      document.getElementById('abtn').classList.add('on');
    } else if (p !== null) { alert('Incorrecta.'); }
  }
};

(function wait() { if (typeof L !== 'undefined') { init(); } else { setTimeout(wait, 50); } })();
