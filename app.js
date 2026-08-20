let savedProperties = [];

// Map Tile Style Definitions
const tileStyles = {
  street: {
    version: 8,
    sources: {
      'openfreemap-dark': {
        type: 'raster',
        tiles: ['https://tiles.openfreemap.org/styles/dark/{z}/{x}/{y}.png'],
        tileSize: 256
      }
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'openfreemap-dark' }]
  },
  esri: {
    version: 8,
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      }
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'esri-satellite' }]
  },
  naip: {
    version: 8,
    sources: {
      'usda-naip': {
        type: 'raster',
        tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      }
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'usda-naip' }]
  }
};

// Initialize MapLibre with Globe Projection and Full Rotation/Zoom Out
const map = new maplibregl.Map({
  container: 'map',
  style: tileStyles.esri,
  center: [-114.742, 44.0682],
  zoom: 3,
  minZoom: 0,
  maxZoom: 22,
  dragRotate: true,
  pitchWithRotate: true,
  touchPitch: true
});

// Setup 3D Globe Projection & Load Parcel Outlines
function loadParcelLayers() {
  map.setProjection({ type: 'globe' });

  // Add Idaho Parcel Source if not added
  if (!map.getSource('idaho-parcels')) {
    map.addSource('idaho-parcels', {
      type: 'geojson',
      data: 'https://gis.idwr.idaho.gov/arcgis/rest/services/Reference/Parcels/MapServer/0/query?where=1%3D1&outFields=*&f=geojson',
      generateId: true
    });

    // White Parcel Outlines
    map.addLayer({
      id: 'parcel-lines',
      type: 'line',
      source: 'idaho-parcels',
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 2],
        'line-opacity': 0.8
      }
    });

    // Neon Light-Blue Click Highlight
    map.addLayer({
      id: 'parcel-fill-highlight',
      type: 'fill',
      source: 'idaho-parcels',
      paint: {
        'fill-color': 'rgba(0, 240, 255, 0.35)',
        'fill-outline-color': '#00F0FF'
      },
      filter: ['==', '$id', '']
    });
  }
}

map.on('style.load', () => {
  loadParcelLayers();
});

function switchMapStyle(styleKey) {
  map.setStyle(tileStyles[styleKey]);
}

function closeAllPanels() {
  document.getElementById('sideMenu').classList.remove('open');
  document.getElementById('backdrop').classList.remove('active');
  document.querySelectorAll('.full-screen-modal').forEach(m => m.classList.remove('active'));
  document.getElementById('parcelCard').classList.remove('active');
}

// Map Click Interactions
map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['parcel-lines'] });

  if (features.length > 0) {
    const feature = features[0];
    map.setFilter('parcel-fill-highlight', ['==', '$id', feature.id]);

    const props = feature.properties;
    const parcelId = props.PARCELID || props.PIN || 'ID-' + Math.floor(100000 + Math.random() * 900000);
    const ownerName = props.OWNER || props.OWNER_NAME || null;
    const address = props.ADDRESS || props.SITUS_ADDR || 'Address Unavailable';

    const displayName = (ownerName && ownerName.trim() !== '') ? ownerName : address;

    document.getElementById('cardParcelId').textContent = parcelId;
    document.getElementById('cardOwnerName').textContent = displayName;
    document.getElementById('cardAddress').textContent = address;
    document.getElementById('cardTaxes').textContent = 'Valuation available in County Portal';

    document.getElementById('parcelCard').classList.add('active');
  } else {
    closeAllPanels();
  }
});

// Menu Drawer Logic
const sideMenu = document.getElementById('sideMenu');
const backdrop = document.getElementById('backdrop');

document.getElementById('openMenu').addEventListener('click', (e) => {
  e.stopPropagation();
  sideMenu.classList.add('open');
  backdrop.classList.add('active');
});

document.getElementById('closeMenu').addEventListener('click', () => closeAllPanels());
backdrop.addEventListener('click', () => closeAllPanels());
document.getElementById('closeParcelCard').addEventListener('click', () => {
  document.getElementById('parcelCard').classList.remove('active');
});

// Counties List
const idahoCounties = [
  "Ada", "Adams", "Bannock", "Bear Lake", "Benewah", "Bingham", "Blaine", "Boise", 
  "Bonner", "Bonneville", "Boundary", "Butte", "Camas", "Canyon", "Caribou", "Cassia", 
  "Clark", "Clearwater", "Custer", "Elmore", "Franklin", "Fremont", "Gem", "Gooding", 
  "Idaho", "Jefferson", "Jerome", "Kootenai", "Latah", "Lemhi", "Lewis", "Lincoln", 
  "Madison", "Minidoka", "Nez Perce", "Oneida", "Owyhee", "Payette", "Power", "Shoshone", 
  "Teton", "Twin Falls", "Valley", "Washington"
];

const countyListEl = document.getElementById('countyList');
function renderCounties(filter = '') {
  countyListEl.innerHTML = '';
  idahoCounties
    .filter(c => c.toLowerCase().includes(filter.toLowerCase()))
    .forEach(county => {
      const li = document.createElement('li');
      li.className = 'county-item';
      li.textContent = county + " County";
      countyListEl.appendChild(li);
    });
}
renderCounties();

document.getElementById('countySearchInput').addEventListener('input', (e) => {
  renderCounties(e.target.value);
});

// Modal Navigation
const modals = {
  btnCounties: document.getElementById('modalCounties'),
  btnSaved: document.getElementById('modalSaved'),
  btnSources: document.getElementById('modalSources'),
  btnRefresh: document.getElementById('modalRefresh'),
  btnSettings: document.getElementById('modalSettings'),
  btnAbout: document.getElementById('modalAbout')
};

Object.keys(modals).forEach(btnId => {
  document.getElementById(btnId).addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPanels();
    modals[btnId].classList.add('active');
  });
});

document.querySelectorAll('.modal-close-btn').forEach(btn => {
  btn.addEventListener('click', () => closeAllPanels());
});

// Saved Properties
document.getElementById('savePropertyBtn').addEventListener('click', () => {
  const currentParcelId = document.getElementById('cardParcelId').textContent;
  const currentAddress = document.getElementById('cardAddress').textContent;
  const currentOwner = document.getElementById('cardOwnerName').textContent;

  const isDuplicate = savedProperties.some(item => item.id === currentParcelId);

  if (!isDuplicate && currentParcelId !== 'Select a parcel') {
    savedProperties.push({
      id: currentParcelId,
      address: currentAddress,
      owner: currentOwner
    });
    renderSavedProperties();
    alert('Property saved successfully.');
  } else if (isDuplicate) {
    alert('This property is already saved in your list.');
  }
});

function renderSavedProperties() {
  const savedListContainer = document.getElementById('savedList');
  const emptyMsg = document.getElementById('emptySavedMsg');
  savedListContainer.innerHTML = '';

  if (savedProperties.length === 0) {
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    savedProperties.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'saved-card';
      card.innerHTML = `
        <button class="saved-card-remove" onclick="removeSavedProperty(${index})">&times;</button>
        <div style="font-weight: 600; font-size: 14px;">${item.id}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${item.owner}</div>
        <div style="font-size: 12px;">${item.address}</div>
      `;
      savedListContainer.appendChild(card);
    });
  }
}

window.removeSavedProperty = function(index) {
  savedProperties.splice(index, 1);
  renderSavedProperties();
};

// Basemap Switcher Radio Listeners (Corrected Mapping)
document.getElementById('radioStreet').addEventListener('change', () => switchMapStyle('street'));
document.getElementById('radioEsri').addEventListener('change', () => switchMapStyle('esri'));
document.getElementById('radioNaip').addEventListener('change', () => switchMapStyle('naip'));

// Toggle Parcel Visibility
document.getElementById('toggleParcels').addEventListener('change', (e) => {
  const visibility = e.target.checked ? 'visible' : 'none';
  if (map.getLayer('parcel-lines')) {
    map.setLayoutProperty('parcel-lines', 'visibility', visibility);
  }
});

document.getElementById('executeRefreshBtn').addEventListener('click', () => {
  window.location.reload();
});
