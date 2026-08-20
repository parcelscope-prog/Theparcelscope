// Saved Properties Array (State Management with Duplicate Filter)
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

// Initialize MapLibre
const map = new maplibregl.Map({
  container: 'map',
  style: tileStyles.esri,
  center: [-114.742, 44.0682],
  zoom: 6
});

// Helper: Close all menus, modals, and detail panels
function closeAllPanels() {
  document.getElementById('sideMenu').classList.remove('open');
  document.getElementById('backdrop').classList.remove('active');
  document.querySelectorAll('.full-screen-modal').forEach(m => m.classList.remove('active'));
  document.getElementById('parcelCard').classList.remove('active');
}

// MAP CLICK BEHAVIOR: Close everything when map is clicked
map.on('click', (e) => {
  closeAllPanels();

  // Example Parcel Pick Demonstration
  const mockParcel = {
    id: 'PARCEL-' + Math.floor(100000 + Math.random() * 900000),
    name: null, // Test Name-preference logic: fallback to address if name unavailable
    address: '802 W Bannock St, Boise, ID 83702',
    taxes: 'Assessed: $410,000 | Taxes: $3,210'
  };

  // Owner Name Preference Logic: Name first, address only as fallback
  const displayName = (mockParcel.name && mockParcel.name.trim() !== '') 
    ? mockParcel.name 
    : mockParcel.address;

  document.getElementById('cardParcelId').textContent = mockParcel.id;
  document.getElementById('cardOwnerName').textContent = displayName;
  document.getElementById('cardAddress').textContent = mockParcel.address;
  document.getElementById('cardTaxes').textContent = mockParcel.taxes;

  // Display floating parcel info card
  document.getElementById('parcelCard').classList.add('active');
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

// Idaho 44 Counties List Array
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

// Handle View / Modal Switching
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

// Save Property Action with Duplicate Filter Logic
document.getElementById('savePropertyBtn').addEventListener('click', () => {
  const currentParcelId = document.getElementById('cardParcelId').textContent;
  const currentAddress = document.getElementById('cardAddress').textContent;
  const currentOwner = document.getElementById('cardOwnerName').textContent;

  // Duplicate filter checking by parcelId
  const isDuplicate = savedProperties.some(item => item.id === currentParcelId);

  if (!isDuplicate) {
    savedProperties.push({
      id: currentParcelId,
      address: currentAddress,
      owner: currentOwner
    });
    renderSavedProperties();
    alert('Property saved successfully.');
  } else {
    alert('This property is already saved in your list.');
  }
});

// Render Saved Properties
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

// Settings Imagery Selection Switches
document.getElementById('radioStreet').addEventListener('change', () => map.setStyle(tileStyles.street));
document.getElementById('radioEsri').addEventListener('change', () => map.setStyle(tileStyles.esri));
document.getElementById('radioNaip').addEventListener('change', () => map.setStyle(tileStyles.naip));

// Reload Action for Refresh History Panel
document.getElementById('executeRefreshBtn').addEventListener('click', () => {
  window.location.reload();
});
