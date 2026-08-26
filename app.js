/* ===== Parcelscope Application ===== */
(function () {
  'use strict';

  // ---------- State ----------
  const DEFAULT_SETTINGS = {
    basemap: 'satellite',
    units: 'acres',
    region: 'all',
    boundaries: true,
    counties: true,
    dark: true,
    limit: 10
  };

  let settings = loadSettings();
  let map, layers = {}, markersLayer, stateLayer, currentResults = [];
  let saved = loadSaved();

  // Simplified state boundaries (approximate polygons for ID, WA, OR)
  const STATE_GEOJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Idaho', abbr: 'ID' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-117.24, 49.00], [-116.05, 49.00], [-116.05, 48.00], [-116.92, 46.00],
            [-117.03, 44.35], [-117.03, 42.00], [-114.04, 42.00], [-111.05, 42.00],
            [-111.05, 44.35], [-111.05, 45.00], [-112.80, 45.00], [-114.50, 45.70],
            [-116.05, 47.50], [-116.92, 48.50], [-117.24, 49.00]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Washington', abbr: 'WA' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-124.85, 48.18], [-123.20, 48.50], [-122.75, 49.00], [-117.03, 49.00],
            [-117.03, 46.00], [-118.20, 46.00], [-119.00, 45.60], [-121.20, 45.60],
            [-122.00, 45.55], [-122.80, 46.00], [-123.50, 46.20], [-124.00, 46.60],
            [-124.40, 47.30], [-124.70, 48.00], [-124.85, 48.18]
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Oregon', abbr: 'OR' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-124.55, 46.25], [-123.50, 46.25], [-122.00, 45.55], [-121.20, 45.60],
            [-119.00, 45.60], [-117.03, 46.00], [-117.03, 42.00], [-120.50, 42.00],
            [-124.40, 42.00], [-124.55, 43.50], [-124.40, 45.00], [-124.55, 46.25]
          ]]
        }
      }
    ]
  };

  // ---------- Init ----------
  function init() {
    applyTheme();
    initMap();
    bindUI();
    renderSaved();
    showToast('Welcome to Parcelscope — search any address or name in ID, WA, OR');
  }

  function initMap() {
    map = L.map('map', {
      center: [45.5, -118.5],
      zoom: 6,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Basemaps
    layers.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19
      }
    );

    layers.hybrid = L.layerGroup([
      layers.satellite,
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.85 }
      )
    ]);

    layers.streets = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }
    );

    layers.topo = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri',
        maxZoom: 19
      }
    );

    setBasemap(settings.basemap);

    // State boundaries
    stateLayer = L.geoJSON(STATE_GEOJSON, {
      style: {
        color: '#2dd4bf',
        weight: 2,
        opacity: 0.85,
        fillColor: '#2dd4bf',
        fillOpacity: 0.06
      },
      onEachFeature: (feature, layer) => {
        if (settings.counties) {
          layer.bindTooltip(feature.properties.name, {
            permanent: true,
            direction: 'center',
            className: 'state-label'
          });
        }
      }
    });

    if (settings.boundaries) stateLayer.addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // Click map to reverse-geocode (demo)
    map.on('click', onMapClick);
  }

  // ---------- Settings persistence ----------
  function loadSettings() {
    try {
      const raw = localStorage.getItem('parcelscope_settings');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem('parcelscope_settings', JSON.stringify(settings));
  }

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem('parcelscope_saved') || '[]');
    } catch {
      return [];
    }
  }

  function persistSaved() {
    localStorage.setItem('parcelscope_saved', JSON.stringify(saved));
  }

  // ---------- UI Bindings ----------
  function bindUI() {
    document.getElementById('menu-btn').addEventListener('click', () => openPanel('side-menu'));
    document.querySelectorAll('.close-panel').forEach(btn => {
      btn.addEventListener('click', () => closePanel(btn.dataset.panel));
    });

    document.querySelectorAll('#side-menu [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closePanel('side-menu');
        if (action === 'saved') openPanel('saved-panel');
        else if (action === 'settings') openPanel('settings-panel');
        else if (action === 'about') openPanel('about-panel');
        else if (action === 'clear-map') clearMap();
      });
    });

    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });

    document.getElementById('locate-btn').addEventListener('click', locateMe);

    // Settings controls
    document.getElementById('setting-basemap').value = settings.basemap;
    document.getElementById('setting-units').value = settings.units;
    document.getElementById('setting-region').value = settings.region;
    document.getElementById('setting-boundaries').checked = settings.boundaries;
    document.getElementById('setting-counties').checked = settings.counties;
    document.getElementById('setting-dark').checked = settings.dark;
    document.getElementById('setting-limit').value = settings.limit;

    document.getElementById('setting-basemap').addEventListener('change', e => {
      settings.basemap = e.target.value;
      setBasemap(settings.basemap);
      saveSettings();
    });
    document.getElementById('setting-units').addEventListener('change', e => {
      settings.units = e.target.value;
      saveSettings();
      if (currentResults.length) renderResults(currentResults);
      renderSaved();
    });
    document.getElementById('setting-region').addEventListener('change', e => {
      settings.region = e.target.value;
      saveSettings();
      flyToRegion(settings.region);
    });
    document.getElementById('setting-boundaries').addEventListener('change', e => {
      settings.boundaries = e.target.checked;
      saveSettings();
      if (settings.boundaries) stateLayer.addTo(map);
      else map.removeLayer(stateLayer);
    });
    document.getElementById('setting-counties').addEventListener('change', e => {
      settings.counties = e.target.checked;
      saveSettings();
      // rebuild tooltips
      map.removeLayer(stateLayer);
      stateLayer = L.geoJSON(STATE_GEOJSON, {
        style: {
          color: '#2dd4bf',
          weight: 2,
          opacity: 0.85,
          fillColor: '#2dd4bf',
          fillOpacity: 0.06
        },
        onEachFeature: (feature, layer) => {
          if (settings.counties) {
            layer.bindTooltip(feature.properties.name, {
              permanent: true,
              direction: 'center',
              className: 'state-label'
            });
          }
        }
      });
      if (settings.boundaries) stateLayer.addTo(map);
    });
    document.getElementById('setting-dark').addEventListener('change', e => {
      settings.dark = e.target.checked;
      applyTheme();
      saveSettings();
    });
    document.getElementById('setting-limit').addEventListener('change', e => {
      settings.limit = parseInt(e.target.value, 10);
      saveSettings();
    });
    document.getElementById('reset-settings').addEventListener('click', () => {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings();
      location.reload();
    });
  }

  function openPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
    const panel = document.getElementById(id);
    if (panel) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
    }
  }

  function closePanel(id) {
    const panel = document.getElementById(id);
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  function applyTheme() {
    document.body.classList.toggle('light', !settings.dark);
  }

  function setBasemap(name) {
    Object.values(layers).forEach(l => {
      if (map.hasLayer(l)) map.removeLayer(l);
    });
    const layer = layers[name] || layers.satellite;
    layer.addTo(map);
  }

  function flyToRegion(region) {
    const views = {
      all: [[45.5, -118.5], 6],
      ID: [[44.0, -114.5], 7],
      WA: [[47.4, -120.8], 7],
      OR: [[44.0, -120.5], 7]
    };
    const [center, zoom] = views[region] || views.all;
    map.flyTo(center, zoom, { duration: 1.2 });
  }

  // ---------- Search ----------
  async function doSearch() {
    const q = document.getElementById('search-input').value.trim();
    if (!q) {
      showToast('Enter an address, owner name, or place');
      return;
    }

    showLoading(true);
    markersLayer.clearLayers();

    try {
      // Restrict to PNW when possible
      const countrycodes = 'us';
      let viewbox = '';
      if (settings.region === 'ID') viewbox = '-117.5,49.0,-111.0,42.0';
      else if (settings.region === 'WA') viewbox = '-124.9,49.0,-116.9,45.5';
      else if (settings.region === 'OR') viewbox = '-124.6,46.3,-116.5,42.0';
      else viewbox = '-125.0,49.1,-111.0,41.9';

      const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: 1,
        limit: settings.limit,
        countrycodes,
        viewbox,
        bounded: 1
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Parcelscope/1.0 (public property explorer for ID-WA-OR; educational demo)'
          }
        }
      );

      if (!res.ok) throw new Error('Geocoding service unavailable');

      const places = await res.json();

      if (!places.length) {
        currentResults = [];
        renderResults([]);
        openPanel('results-panel');
        showToast('No locations found. Try a more specific address.');
        showLoading(false);
        return;
      }

      // Generate realistic mock parcel records from each geocode hit
      currentResults = places.map((p, i) => createMockParcel(p, i, q));
      renderResults(currentResults);
      openPanel('results-panel');

      // Fit map to results
      const bounds = L.latLngBounds(currentResults.map(r => [r.lat, r.lon]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

      // Add markers
      currentResults.forEach((r, idx) => {
        const marker = L.marker([r.lat, r.lon], {
          icon: createIcon(idx + 1)
        }).addTo(markersLayer);

        marker.bindPopup(buildPopup(r));
        marker.on('click', () => highlightCard(r.id));
      });

      showToast(`Found ${currentResults.length} result${currentResults.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      showToast('Search failed. Please try again in a moment.');
    } finally {
      showLoading(false);
    }
  }

  function createMockParcel(place, index, originalQuery) {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    const addr = place.address || {};
    const state = (addr.state || '').toLowerCase();
    let stateAbbr = 'OR';
    if (state.includes('idaho') || state === 'id') stateAbbr = 'ID';
    else if (state.includes('washington') || state === 'wa') stateAbbr = 'WA';
    else if (state.includes('oregon') || state === 'or') stateAbbr = 'OR';

    // Deterministic-ish values from coordinates so same place looks consistent
    const seed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453);
    const frac = seed - Math.floor(seed);

    const acres = +(0.15 + frac * 45).toFixed(2);
    const landValue = Math.round(25000 + frac * 420000);
    const improveValue = Math.round(frac * 0.6 * landValue);
    const totalValue = landValue + improveValue;

    const owners = [
      'Smith Family Trust', 'Johnson, Robert & Mary', 'Pacific Northwest Holdings LLC',
      'Chen, Wei', 'Anderson Ranch Properties', 'Miller, Sarah J.', 'Columbia River Estates',
      'Garcia, Miguel', 'Thompson, David & Lisa', 'Northwest Timber Co.',
      'Patel, Anika', 'Williams Living Trust', 'Baker, James R.', 'Cascade View LLC'
    ];
    const owner = owners[Math.floor(frac * owners.length)];

    const landUses = ['Residential', 'Agricultural', 'Vacant Land', 'Commercial', 'Timberland', 'Mixed Use'];
    const landUse = landUses[Math.floor(frac * landUses.length)];

    const county = addr.county || addr.city || 'Unknown County';
    const apn = `${stateAbbr}-${String(Math.floor(frac * 90000 + 10000))}-${String(Math.floor((1 - frac) * 900 + 100))}`;

    return {
      id: `p-${Date.now()}-${index}`,
      lat,
      lon,
      displayName: place.display_name,
      address: formatAddress(addr, place.display_name),
      owner,
      apn,
      acres,
      landValue,
      improveValue,
      totalValue,
      landUse,
      county,
      state: stateAbbr,
      yearBuilt: landUse === 'Residential' ? 1950 + Math.floor(frac * 70) : null,
      sourceQuery: originalQuery
    };
  }

  function formatAddress(addr, fallback) {
    const parts = [
      addr.house_number,
      addr.road,
      addr.city || addr.town || addr.village,
      addr.state,
      addr.postcode
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : fallback.split(',').slice(0, 3).join(',');
  }

  function createIcon(num) {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background:#2dd4bf;color:#0f1419;width:28px;height:28px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #fff;
      ">${num}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function buildPopup(r) {
    return `
      <strong>${r.owner}</strong><br>
      ${r.address}<br>
      <span style="color:var(--text-muted)">${r.county}, ${r.state}</span><br>
      Acreage: <b>${formatArea(r.acres)}</b><br>
      APN: ${r.apn}<br>
      <button class="btn primary" style="margin-top:8px;padding:4px 10px;font-size:0.8rem"
        onclick="window.__saveFromPopup('${r.id}')">Save</button>
    `;
  }

  // ---------- Results rendering ----------
  function renderResults(list) {
    const container = document.getElementById('results-content');
    if (!list.length) {
      container.innerHTML = '<p class="empty-state">No matching public records found for this query in the selected region.</p>';
      return;
    }

    container.innerHTML = list.map(r => `
      <article class="result-card" data-id="${r.id}" id="card-${r.id}">
        <div class="card-title">${escapeHtml(r.owner)}</div>
        <div class="card-meta">
          <span>${escapeHtml(r.address)}</span>
          <span>${escapeHtml(r.county)}, ${r.state} · ${r.landUse}</span>
          <span>APN: ${r.apn}</span>
          <span>Area: <strong>${formatArea(r.acres)}</strong></span>
          <span>Assessed: $${r.totalValue.toLocaleString()}</span>
          ${r.yearBuilt ? `<span>Year built: ${r.yearBuilt}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn primary" data-fly="${r.id}">View on Map</button>
          <button class="btn secondary" data-save="${r.id}">
            ${isSaved(r.id) ? '★ Saved' : '☆ Save'}
          </button>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-fly]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = list.find(x => x.id === btn.dataset.fly);
        if (item) {
          map.flyTo([item.lat, item.lon], 16, { duration: 1 });
          markersLayer.eachLayer(m => {
            if (m.getLatLng().lat === item.lat && m.getLatLng().lng === item.lon) {
              m.openPopup();
            }
          });
        }
      });
    });

    container.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = list.find(x => x.id === btn.dataset.save);
        if (item) toggleSave(item);
      });
    });
  }

  function highlightCard(id) {
    document.querySelectorAll('.result-card').forEach(c => c.style.borderColor = '');
    const card = document.getElementById(`card-${id}`);
    if (card) {
      card.style.borderColor = 'var(--accent)';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ---------- Saved ----------
  function isSaved(id) {
    return saved.some(s => s.id === id || (s.apn && s.apn === id));
  }

  function toggleSave(item) {
    const idx = saved.findIndex(s => s.id === item.id || s.apn === item.apn);
    if (idx >= 0) {
      saved.splice(idx, 1);
      showToast('Removed from saved');
    } else {
      saved.unshift({ ...item, savedAt: Date.now() });
      showToast('Property saved');
    }
    persistSaved();
    renderSaved();
    if (currentResults.length) renderResults(currentResults);
  }

  // Expose for popup button
  window.__saveFromPopup = function (id) {
    const item = currentResults.find(r => r.id === id) || saved.find(r => r.id === id);
    if (item) toggleSave(item);
  };

  function renderSaved() {
    const container = document.getElementById('saved-content');
    if (!saved.length) {
      container.innerHTML = '<p class="empty-state">No saved properties yet. Save one from search results.</p>';
      return;
    }

    container.innerHTML = saved.map(r => `
      <article class="saved-card">
        <div class="card-title">${escapeHtml(r.owner)}</div>
        <div class="card-meta">
          <span>${escapeHtml(r.address)}</span>
          <span>${escapeHtml(r.county)}, ${r.state}</span>
          <span>Area: <strong>${formatArea(r.acres)}</strong> · ${r.landUse}</span>
          <span>APN: ${r.apn}</span>
        </div>
        <div class="card-actions">
          <button class="btn primary" data-fly-saved="${r.id}">View on Map</button>
          <button class="btn danger" data-remove="${r.id}">Remove</button>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-fly-saved]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = saved.find(x => x.id === btn.dataset.flySaved);
        if (item) {
          closePanel('saved-panel');
          map.flyTo([item.lat, item.lon], 16, { duration: 1.2 });
          markersLayer.clearLayers();
          L.marker([item.lat, item.lon], { icon: createIcon('★') })
            .addTo(markersLayer)
            .bindPopup(buildPopup(item))
            .openPopup();
        }
      });
    });

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = saved.findIndex(x => x.id === btn.dataset.remove);
        if (idx >= 0) {
          saved.splice(idx, 1);
          persistSaved();
          renderSaved();
          showToast('Removed');
        }
      });
    });
  }

  // ---------- Utilities ----------
  function formatArea(acres) {
    if (settings.units === 'hectares') return (acres * 0.404686).toFixed(2) + ' ha';
    if (settings.units === 'sqft') return Math.round(acres * 43560).toLocaleString() + ' sq ft';
    return acres.toFixed(2) + ' acres';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function showLoading(on) {
    document.getElementById('loading').classList.toggle('hidden', !on);
  }

  function clearMap() {
    markersLayer.clearLayers();
    currentResults = [];
    renderResults([]);
    closePanel('results-panel');
    showToast('Map cleared');
  }

  function locateMe() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported');
      return;
    }
    showLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 14, { duration: 1.2 });
        L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#2dd4bf',
          fillColor: '#2dd4bf',
          fillOpacity: 0.6
        }).addTo(markersLayer);
        showLoading(false);
        showToast('Location found');
      },
      () => {
        showLoading(false);
        showToast('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function onMapClick(e) {
    // Optional: reverse geocode on click for discovery
    // Kept lightweight – only if user wants
  }

  // ---------- Start ----------
  document.addEventListener('DOMContentLoaded', init);
})();
