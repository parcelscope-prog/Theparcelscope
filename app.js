/* =========================================================
   PARCELSCOPE IDAHO
   Version: 5781683
   ========================================================= */

const VERSION = "5781683";

/*
    STATEWIDE IDAHO PARCEL SOURCE

    Idaho Department of Lands
    WhiteStar Parcels

    The service exposes parcel polygons plus fields including:
    - APN
    - property address
    - city
    - state
    - ZIP
    - county

    Source:
    https://gis1.idl.idaho.gov/arcgis/rest/services/Portal/WhiteStar_Parcels/FeatureServer
*/

const PARCEL_SERVICE =
    "https://gis1.idl.idaho.gov/arcgis/rest/services/Portal/WhiteStar_Parcels/FeatureServer/0";

const GEOCODER_URL =
    "https://nominatim.openstreetmap.org/search";


// =========================================================
// MAP
// =========================================================

const map = L.map("map", {
    center: [44.0682, -114.7420],
    zoom: 6,
    zoomControl: false,
    preferCanvas: true
});


// Normal street map
const streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
);


// Satellite
const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
    }
);


// Satellite labels / roads
const satelliteLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        opacity: 0.8,
        attribution: ""
    }
);


// Start with satellite
satelliteLayer.addTo(map);
satelliteLabels.addTo(map);


// Zoom controls
L.control.zoom({
    position: "bottomright"
}).addTo(map);


// =========================================================
// PARCEL DISPLAY
// =========================================================

let parcelLayer = null;
let selectedParcelLayer = null;
let parcelRequestController = null;

const PARCEL_STYLE = {
    color: "#72a9d2",
    weight: 1,
    opacity: 0.8,
    fillColor: "#3f7aa8",
    fillOpacity: 0.035
};

const SELECTED_PARCEL_STYLE = {
    color: "#8fc5ee",
    weight: 3,
    opacity: 1,
    fillColor: "#3f7aa8",
    fillOpacity: 0.16
};


// =========================================================
// APP STATE
// =========================================================

const state = {
    satellite: true,
    showParcels: true,
    parcelOpacity: 0.035,
    autoParcelLoading: true,
    saved: loadSaved(),
    lastSearch: "",
    lastRefresh: null
};


// =========================================================
// DOM
// =========================================================

const menuButton = document.getElementById("menuButton");
const closeMenu = document.getElementById("closeMenu");
const sideMenu = document.getElementById("sideMenu");

const propertyPanel = document.getElementById("propertyPanel");
const propertyContent = document.getElementById("propertyContent");
const propertyTitle = document.getElementById("propertyTitle");
const closeProperty = document.getElementById("closeProperty");

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

const searchResults = document.getElementById("searchResults");
const resultsContent = document.getElementById("resultsContent");
const closeResults = document.getElementById("closeResults");

const appPage = document.getElementById("appPage");
const appPageTitle = document.getElementById("appPageTitle");
const appPageKicker = document.getElementById("appPageKicker");
const appPageContent = document.getElementById("appPageContent");
const closeAppPage = document.getElementById("closeAppPage");

const mapStatusText = document.getElementById("mapStatusText");


// =========================================================
// STATUS
// =========================================================

function setStatus(text) {
    if (mapStatusText) {
        mapStatusText.textContent = text;
    }
}


// =========================================================
// MENU
// =========================================================

menuButton?.addEventListener("click", () => {
    sideMenu.classList.add("open");
});

closeMenu?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
});


// =========================================================
// SEARCH
// =========================================================

searchButton?.addEventListener("click", performSearch);

searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        performSearch();
    }
});


// Replace the old placeholder with a useful one
if (searchInput) {
    searchInput.placeholder =
        "Search address, owner/name, parcel ID or APN...";
}


async function performSearch() {

    const query = searchInput.value.trim();

    if (!query) {
        setStatus("Enter an address, name, or parcel ID");
        return;
    }

    state.lastSearch = query;

    closePropertyPanel();
    openResults();

    resultsContent.innerHTML = `
        <div class="page-card">
            <strong>Searching Idaho parcels...</strong>
            <div style="margin-top:5px;color:#aaa">
                Looking for "${escapeHtml(query)}"
            </div>
        </div>
    `;

    setStatus("Searching parcel data...");

    try {

        // First: parcel database search
        const parcelResults = await searchParcelDatabase(query);

        // Second: address geocoder if needed
        let geocoderResults = [];

        if (parcelResults.length === 0) {
            geocoderResults = await geocodeAddress(query);
        }

        const combined = [
            ...parcelResults.map(item => ({
                type: "parcel",
                data: item
            })),
            ...geocoderResults.map(item => ({
                type: "geocoder",
                data: item
            }))
        ];

        renderSearchResults(combined);

        if (combined.length) {
            setStatus(`${combined.length} result${combined.length === 1 ? "" : "s"} found`);
        } else {
            setStatus("No matching parcels found");
        }

    } catch (error) {

        console.error(error);

        resultsContent.innerHTML = `
            <div class="page-card">
                <strong>Search failed</strong>
                <div style="margin-top:6px;color:#aaa">
                    The parcel service did not respond. Try a full address,
                    parcel ID, APN, or a simpler search.
                </div>
            </div>
        `;

        setStatus("Search service unavailable");
    }
}


// =========================================================
// PARCEL DATABASE SEARCH
// =========================================================

async function searchParcelDatabase(query) {

    const clean = query
        .replace(/'/g, "''")
        .trim();

    const upper = clean.toUpperCase();

    const clauses = [];

    // APN / parcel ID
    clauses.push(
        `UPPER(apn) LIKE '%${upper}%'`
    );

    // Full property address
    clauses.push(
        `UPPER(propfuladd) LIKE '%${upper}%'`
    );

    // Street name
    clauses.push(
        `UPPER(propstname) LIKE '%${upper}%'`
    );

    // City
    clauses.push(
        `UPPER(propcity) LIKE '%${upper}%'`
    );

    // County
    clauses.push(
        `UPPER(county) LIKE '%${upper}%'`
    );

    // Try owner fields if available
    clauses.push(
        `UPPER(propowner) LIKE '%${upper}%'`
    );

    const where = clauses.join(" OR ");

    const params = new URLSearchParams({
        where,
        outFields: "*",
        returnGeometry: "true",
        outSR: "4326",
        resultRecordCount: "50",
        f: "geojson"
    });

    const response = await fetch(
        `${PARCEL_SERVICE}/query?${params.toString()}`
    );

    if (!response.ok) {
        throw new Error("Parcel service error");
    }

    const data = await response.json();

    if (!data.features) {
        return [];
    }

    return data.features;
}


// =========================================================
// ADDRESS GEOCODER
// =========================================================

async function geocodeAddress(query) {

    const params = new URLSearchParams({
        q: `${query}, Idaho`,
        format: "jsonv2",
        limit: "10",
        countrycodes: "us"
    });

    const response = await fetch(
        `${GEOCODER_URL}?${params.toString()}`,
        {
            headers: {
                "Accept": "application/json"
            }
        }
    );

    if (!response.ok) {
        return [];
    }

    return await response.json();
}


// =========================================================
// SEARCH RESULTS
// =========================================================

function renderSearchResults(results) {

    if (!results.length) {

        resultsContent.innerHTML = `
            <div class="page-card">
                <strong>No results</strong>
                <p style="margin-top:7px">
                    Try an address, street name, parcel ID, APN,
                    city, county, or owner/name.
                </p>
            </div>
        `;

        return;
    }

    resultsContent.innerHTML = "";

    results.forEach((result, index) => {

        const div = document.createElement("div");

        div.className = "search-result";

        if (result.type === "parcel") {

            const feature = result.data;
            const p = feature.properties || {};

            const title =
                p.propfuladd ||
                p.apn ||
                p.propstname ||
                "Idaho Parcel";

            const details = [
                p.propcity,
                p.propstate,
                p.propzip
            ].filter(Boolean).join(", ");

            const county =
                p.county ?
                `County: ${p.county}` :
                "";

            div.innerHTML = `
                <div class="search-result-title">
                    ${escapeHtml(title)}
                </div>

                <div class="search-result-details">
                    ${escapeHtml(details)}
                    ${county ? `<br>${escapeHtml(county)}` : ""}
                    ${p.apn ? `<br>Parcel ID: ${escapeHtml(p.apn)}` : ""}
                </div>
            `;

            div.addEventListener("click", () => {
                showParcel(feature);
            });

        } else {

            const item = result.data;

            div.innerHTML = `
                <div class="search-result-title">
                    ${escapeHtml(item.display_name || "Address")}
                </div>

                <div class="search-result-details">
                    Address location found.
                </div>
            `;

            div.addEventListener("click", () => {

                const lat = Number(item.lat);
                const lon = Number(item.lon);

                map.setView([lat, lon], 17);

                // Search for parcels around the location
                loadParcelsAround(lat, lon, 0.002);

                closeResults();
            });
        }

        resultsContent.appendChild(div);
    });
}


// =========================================================
// PARCEL CLICK
// =========================================================

async function showParcel(feature) {

    if (!feature) return;

    const p = feature.properties || {};

    const coords = getFeatureCenter(feature);

    if (coords) {
        map.setView(coords, Math.max(map.getZoom(), 17));
    }

    highlightParcel(feature);

    openPropertyPanel();

    propertyTitle.textContent =
        p.propfuladd ||
        p.apn ||
        "Property Information";

    propertyContent.innerHTML =
        buildPropertyHTML(p, feature);

    setStatus("Parcel selected");
}


// =========================================================
// PROPERTY HTML
// =========================================================

function buildPropertyHTML(p, feature) {

    const address =
        p.propfuladd ||
        [
            p.prophsnum,
            p.propstname,
            p.propstsuff
        ].filter(Boolean).join(" ");

    const cityStateZip =
        [
            p.propcity,
            p.propstate,
            p.propzip
        ].filter(Boolean).join(", ");

    const county = p.county || "Not provided";

    const apn =
        p.apn ||
        p.parcelid ||
        p.PARCEL_ID ||
        "Not provided";

    const owner =
        p.propowner ||
        p.owner ||
        p.ownername ||
        "Not provided";

    const acreage =
        p.acres ||
        p.acreage ||
        p.ACRES ||
        "Not provided";

    const source =
        p.propsrcflg ||
        "Idaho parcel data";

    const savedKey = makePropertyKey(p);

    const saved = state.saved.some(
        x => x.key === savedKey
    );

    return `

        <div class="property-field">
            <div class="property-label">Address</div>
            <div class="property-value">
                ${escapeHtml(address || "Not provided")}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">City / State / ZIP</div>
            <div class="property-value">
                ${escapeHtml(cityStateZip || "Not provided")}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">County</div>
            <div class="property-value">
                ${escapeHtml(county)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">Parcel ID / APN</div>
            <div class="property-value">
                ${escapeHtml(apn)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">Owner</div>
            <div class="property-value">
                ${escapeHtml(owner)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">Acreage</div>
            <div class="property-value">
                ${escapeHtml(acreage)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">Data Source</div>
            <div class="property-value">
                ${escapeHtml(source)}
            </div>
        </div>

        <button
            class="save-property"
            id="saveCurrentProperty"
        >
            ${saved ? "★ Saved Property" : "☆ Save Property"}
        </button>
    `;

    setTimeout(() => {

        document
            .getElementById("saveCurrentProperty")
            ?.addEventListener("click", () => {

                toggleSavedProperty(p);

                const button =
                    document.getElementById("saveCurrentProperty");

                if (button) {
                    const nowSaved =
                        state.saved.some(
                            x => x.key === savedKey
                        );

                    button.textContent =
                        nowSaved ?
                        "★ Saved Property" :
                        "☆ Save Property";
                }
            });

    }, 0);
}


// =========================================================
// PARCEL LAYERS
// =========================================================

function loadParcelsForCurrentMap() {

    if (!state.showParcels) return;

    const bounds = map.getBounds();

    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();

    // Don't request an enormous statewide geometry dump.
    if (map.getZoom() < 12) {

        clearParcelLayer();

        setStatus(
            "Zoom in to view parcel boundaries"
        );

        return;
    }

    loadParcelsByBounds(
        west,
        south,
        east,
        north
    );
}


async function loadParcelsByBounds(
    west,
    south,
    east,
    north
) {

    if (parcelRequestController) {
        parcelRequestController.abort();
    }

    parcelRequestController =
        new AbortController();

    const params = new URLSearchParams({
        where: "1=1",
        geometry:
            `${west},${south},${east},${north}`,
        geometryType: "esriGeometryEnvelope",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "*",
        returnGeometry: "true",
        outSR: "4326",
        resultRecordCount: "2000",
        f: "geojson"
    });

    try {

        setStatus("Loading parcel boundaries...");

        const response = await fetch(
            `${PARCEL_SERVICE}/query?${params.toString()}`,
            {
                signal:
                    parcelRequestController.signal
            }
        );

        if (!response.ok) {
            throw new Error("Parcel request failed");
        }

        const data = await response.json();

        if (!data.features) {
            throw new Error("No parcel geometry returned");
        }

        drawParcelFeatures(data.features);

        setStatus(
            `${data.features.length.toLocaleString()} parcel boundaries`
        );

    } catch (error) {

        if (error.name === "AbortError") {
            return;
        }

        console.error(error);

        setStatus(
            "Parcel boundaries unavailable at this zoom"
        );
    }
}


function loadParcelsAround(
    lat,
    lon,
    distance
) {

    const west = lon - distance;
    const east = lon + distance;
    const south = lat - distance;
    const north = lat + distance;

    loadParcelsByBounds(
        west,
        south,
        east,
        north
    );
}


function drawParcelFeatures(features) {

    clearParcelLayer();

    parcelLayer = L.geoJSON(
        {
            type: "FeatureCollection",
            features
        },
        {
            style: PARCEL_STYLE,

            onEachFeature: (
                feature,
                layer
            ) => {

                layer.on({
                    mouseover: () => {

                        layer.setStyle({
                            weight: 2,
                            color: "#9bc9ec",
                            fillOpacity:
                                state.parcelOpacity + 0.035
                        });

                        layer.bringToFront();
                    },

                    mouseout: () => {

                        if (
                            selectedParcelLayer !== layer
                        ) {
                            layer.setStyle(
                                PARCEL_STYLE
                            );
                        }
                    },

                    click: () => {
                        showParcel(feature);
                    }
                });
            }
        }
    ).addTo(map);
}


function clearParcelLayer() {

    if (parcelLayer) {

        map.removeLayer(parcelLayer);

        parcelLayer = null;
    }

    selectedParcelLayer = null;
}


function highlightParcel(feature) {

    if (!parcelLayer) return;

    if (selectedParcelLayer) {
        selectedParcelLayer.setStyle(
            PARCEL_STYLE
        );
    }

    parcelLayer.eachLayer(layer => {

        if (
            layer.feature &&
            layer.feature === feature
        ) {

            selectedParcelLayer = layer;

            layer.setStyle(
                SELECTED_PARCEL_STYLE
            );

            layer.bringToFront();
        }
    });
}


// =========================================================
// MAP EVENTS
// =========================================================

let mapMoveTimer = null;

map.on("moveend", () => {

    clearTimeout(mapMoveTimer);

    mapMoveTimer = setTimeout(() => {

        if (state.autoParcelLoading) {
            loadParcelsForCurrentMap();
        }

    }, 300);
});


// Initial load
setTimeout(() => {
    loadParcelsForCurrentMap();
}, 500);


// =========================================================
// PROPERTY PANEL
// =========================================================

function openPropertyPanel() {
    propertyPanel.classList.add("open");
}

function closePropertyPanel() {
    propertyPanel.classList.remove("open");
}

closeProperty?.addEventListener(
    "click",
    closePropertyPanel
);


// =========================================================
// RESULTS
// =========================================================

function openResults() {
    searchResults.classList.add("open");
}

function closeResultsPanel() {
    searchResults.classList.remove("open");
}

closeResults?.addEventListener(
    "click",
    closeResultsPanel
);


// =========================================================
// FULL APP PAGES
// =========================================================

function openPage(title, kicker, html) {

    appPageTitle.textContent = title;
    appPageKicker.textContent = kicker;

    appPageContent.innerHTML = html;

    appPage.classList.add("open");

    sideMenu.classList.remove("open");

    attachPageHandlers();
}


function closePage() {
    appPage.classList.remove("open");
}

closeAppPage?.addEventListener(
    "click",
    closePage
);


// =========================================================
// MENU ITEMS
// =========================================================

document.querySelectorAll(".menu-item")
    .forEach(button => {

        button.addEventListener("click", () => {

            const section =
                button.dataset.section;

            switch (section) {

                case "counties":
                    showCountiesPage();
                    break;

                case "saved":
                    showSavedPage();
                    break;

                case "sources":
                    showSourcesPage();
                    break;

                case "history":
                    showHistoryPage();
                    break;

                case "settings":
                    showSettingsPage();
                    break;

                case "about":
                    showAboutPage();
                    break;
            }
        });
    });


// =========================================================
// COUNTIES
// =========================================================

const IDAHO_COUNTIES = [
    "Ada",
    "Adams",
    "Bannock",
    "Bear Lake",
    "Benewah",
    "Bingham",
    "Blaine",
    "Boise",
    "Bonner",
    "Bonneville",
    "Boundary",
    "Butte",
    "Camas",
    "Canyon",
    "Caribou",
    "Cassia",
    "Clark",
    "Clearwater",
    "Custer",
    "Elmore",
    "Franklin",
    "Fremont",
    "Gem",
    "Gooding",
    "Idaho",
    "Jefferson",
    "Jerome",
    "Kootenai",
    "Latah",
    "Lemhi",
    "Lewis",
    "Lincoln",
    "Madison",
    "Minidoka",
    "Nez Perce",
    "Oneida",
    "Owyhee",
    "Payette",
    "Power",
    "Shoshone",
    "Teton",
    "Twin Falls",
    "Valley",
    "Washington"
];


function showCountiesPage() {

    const buttons =
        IDAHO_COUNTIES.map(county => `
            <button
                class="county-button"
                data-county="${escapeHtml(county)}"
            >
                ${escapeHtml(county)} County
            </button>
        `).join("");

    openPage(
        "Counties",
        "PROPERTY",
        `
            <div class="page-section">

                <h2>Idaho Counties</h2>

                <p>
                    Select a county to center the map
                    and begin parcel research.
                </p>

                <div class="county-search">
                    <input
                        id="countyFilter"
                        type="search"
                        placeholder="Search counties..."
                    >
                </div>

                <div
                    id="countyGrid"
                    class="county-grid"
                >
                    ${buttons}
                </div>

            </div>
        `
    );
}


function attachCountyHandlers() {

    const filter =
        document.getElementById(
            "countyFilter"
        );

    const buttons =
        document.querySelectorAll(
            ".county-button"
        );

    filter?.addEventListener(
        "input",
        () => {

            const q =
                filter.value
                    .trim()
                    .toLowerCase();

            buttons.forEach(button => {

                const name =
                    button.dataset.county
                        .toLowerCase();

                button.classList.toggle(
                    "hidden",
                    !name.includes(q)
                );
            });
        }
    );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const county =
                    button.dataset.county;

                searchInput.value =
                    `${county} County`;

                closePage();

                performSearch();
            }
        );
    });
}


// =========================================================
// SAVED PROPERTIES
// =========================================================

function showSavedPage() {

    if (!state.saved.length) {

        openPage(
            "Saved Properties",
            "PROPERTY",
            `
                <div class="page-section">
                    <h2>No saved properties</h2>

                    <p>
                        Open a parcel and use
                        "Save Property" to keep it here.
                    </p>
                </div>
            `
        );

        return;
    }

    const html =
        state.saved.map(item => `
            <div
                class="saved-property"
                data-key="${escapeHtml(item.key)}"
            >

                <div>
                    <div class="saved-name">
                        ${escapeHtml(
                            item.address ||
                            item.apn ||
                            "Saved Property"
                        )}
                    </div>

                    <div class="saved-address">
                        ${escapeHtml(
                            item.cityStateZip ||
                            item.county ||
                            item.apn ||
                            ""
                        )}
                    </div>
                </div>

                <button
                    class="remove-saved"
                    data-remove="${escapeHtml(item.key)}"
                    aria-label="Remove saved property"
                >
                    ×
                </button>

            </div>
        `).join("");

    openPage(
        "Saved Properties",
        "PROPERTY",
        `
            <div class="page-section">
                ${html}
            </div>
        `
    );
}


function attachSavedHandlers() {

    document.querySelectorAll(
        ".remove-saved"
    ).forEach(button => {

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const key =
                    button.dataset.remove;

                state.saved =
                    state.saved.filter(
                        item =>
                            item.key !== key
                    );

                saveSaved();

                showSavedPage();
            }
        );
    });

    document.querySelectorAll(
        ".saved-property"
    ).forEach(row => {

        row.addEventListener(
            "click",
            () => {

                const key =
                    row.dataset.key;

                const item =
                    state.saved.find(
                        x => x.key === key
                    );

                if (!item) return;

                closePage();

                if (item.lat && item.lon) {

                    map.setView(
                        [
                            item.lat,
                            item.lon
                        ],
                        17
                    );
                }
            }
        );
    });
}


function toggleSavedProperty(p) {

    const key =
        makePropertyKey(p);

    const existing =
        state.saved.find(
            item => item.key === key
        );

    if (existing) {

        state.saved =
            state.saved.filter(
                item => item.key !== key
            );

        setStatus("Property removed from saved");

    } else {

        const address =
            p.propfuladd ||
            p.apn ||
            "Saved Property";

        const cityStateZip =
            [
                p.propcity,
                p.propstate,
                p.propzip
            ].filter(Boolean).join(", ");

        state.saved.push({
            key,
            address,
            cityStateZip,
            county: p.county || "",
            apn: p.apn || "",
            lat: p.proplat || null,
            lon: p.proplon || null
        });

        setStatus("Property saved");
    }

    saveSaved();
}


// =========================================================
// SOURCES
// =========================================================

function showSourcesPage() {

    openPage(
        "Data Sources",
        "DATA",
        `
            <div class="page-section">

                <h2>Parcel Data</h2>

                <div class="page-card">
                    <strong>Idaho Department of Lands</strong>
                    <p>
                        Statewide WhiteStar parcel service.
                        Parcel polygons and standardized
                        property fields are supplied through
                        the Idaho GIS system.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Map Imagery</strong>
                    <p>
                        Esri World Imagery is used for
                        satellite imagery.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Street Map</strong>
                    <p>
                        OpenStreetMap is available as the
                        alternate street-map layer.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Address Search</strong>
                    <p>
                        Address fallback uses OpenStreetMap
                        Nominatim when a direct parcel search
                        doesn't return a match.
                    </p>
                </div>

            </div>
        `
    );
}


// =========================================================
// HISTORY
// =========================================================

function showHistoryPage() {

    openPage(
        "Update History",
        "DATA",
        `
            <div class="page-section">

                <div class="page-card">
                    <strong>Version ${VERSION}</strong>
                    <p>
                        Current ParcelScope build.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Parcel Search</strong>
                    <p>
                        Search supports addresses,
                        parcel IDs / APNs, street names,
                        cities, counties, and available
                        owner fields.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Parcel Map</strong>
                    <p>
                        Statewide parcel geometry is loaded
                        dynamically as you zoom into an area.
                    </p>
                </div>

                <div class="page-card">
                    <strong>Map Layers</strong>
                    <p>
                        Satellite and street-map layers
                        are available.
                    </p>
                </div>

            </div>
        `
    );
}


// =========================================================
// SETTINGS
// =========================================================

function showSettingsPage() {

    openPage(
        "Settings",
        "SYSTEM",
        `
            <div class="setting-group">

                <h2>Map</h2>

                <div class="setting-row">

                    <div>
                        <div class="setting-name">
                            Satellite Imagery
                        </div>

                        <div class="setting-description">
                            Use satellite imagery as the
                            primary map.
                        </div>
                    </div>

                    <button
                        id="satelliteToggle"
                        class="toggle ${state.satellite ? "on" : ""}"
                        aria-label="Toggle satellite imagery"
                    ></button>

                </div>


                <div class="setting-row">

                    <div>
                        <div class="setting-name">
                            Parcel Boundaries
                        </div>

                        <div class="setting-description">
                            Display parcel boundaries when
                            sufficiently zoomed in.
                        </div>
                    </div>

                    <button
                        id="parcelToggle"
                        class="toggle ${state.showParcels ? "on" : ""}"
                        aria-label="Toggle parcel boundaries"
                    ></button>

                </div>


                <div class="setting-row">

                    <div>
                        <div class="setting-name">
                            Automatic Parcel Loading
                        </div>

                        <div class="setting-description">
                            Automatically refresh parcel
                            boundaries when the map moves.
                        </div>
                    </div>

                    <button
                        id="autoParcelToggle"
                        class="toggle ${state.autoParcelLoading ? "on" : ""}"
                        aria-label="Toggle automatic parcel loading"
                    ></button>

                </div>

            </div>


            <div class="setting-group">

                <h2>Search</h2>

                <div class="setting-row">

                    <div>
                        <div class="setting-name">
                            Search Suggestions
                        </div>

                        <div class="setting-description">
                            Search addresses, parcel IDs,
                            APNs, names, cities and counties.
                        </div>
                    </div>

                    <div style="
                        color:#aaa;
                        font-size:12px;
                    ">
                        Enabled
                    </div>

                </div>

            </div>


            <div class="setting-group">

                <h2>Application</h2>

                <div class="setting-row">

                    <div>
                        <div class="setting-name">
                            Version
                        </div>

                        <div class="setting-description">
                            ParcelScope application version.
                        </div>
                    </div>

                    <div style="
                        color:#aaa;
                        font-size:12px;
                        font-family:monospace;
                    ">
                        ${VERSION}
                    </div>

                </div>

            </div>
        `
    );
}


// =========================================================
// ABOUT
// =========================================================

function showAboutPage() {

    openPage(
        "About ParcelScope",
        "PARCELSCOPE",
        `
            <div class="page-section">

                <h2>ParcelScope Idaho</h2>

                <p>
                    A property research interface for
                    exploring publicly available Idaho
                    parcel and map information.
                </p>

            </div>

            <div class="page-section">

                <div class="page-card">
                    <strong>Version</strong>
                    ${VERSION}
                </div>

                <div class="page-card">
                    <strong>Purpose</strong>
                    Public-data property research,
                    parcel mapping, and geographic
                    exploration.
                </div>

                <div class="page-card">
                    <strong>Parcel Coverage</strong>
                    Coverage depends on the participating
                    Idaho parcel data sources and their
                    current updates.
                </div>

            </div>
        `
    );
}


// =========================================================
// PAGE HANDLERS
// =========================================================

function attachPageHandlers() {

    attachCountyHandlers();
    attachSavedHandlers();

    document
        .getElementById("satelliteToggle")
        ?.addEventListener(
            "click",
            toggleSatellite
        );

    document
        .getElementById("parcelToggle")
        ?.addEventListener(
            "click",
            () => {

                state.showParcels =
                    !state.showParcels;

                if (!state.showParcels) {
                    clearParcelLayer();
                } else {
                    loadParcelsForCurrentMap();
                }

                showSettingsPage();
            }
        );

    document
        .getElementById("autoParcelToggle")
        ?.addEventListener(
            "click",
            () => {

                state.autoParcelLoading =
                    !state.autoParcelLoading;

                showSettingsPage();
            }
        );
}


// =========================================================
// SATELLITE TOGGLE
// =========================================================

function toggleSatellite() {

    state.satellite =
        !state.satellite;

    if (state.satellite) {

        if (!map.hasLayer(satelliteLayer)) {
            satelliteLayer.addTo(map);
        }

        if (!map.hasLayer(satelliteLabels)) {
            satelliteLabels.addTo(map);
        }

        if (map.hasLayer(streetLayer)) {
            map.removeLayer(streetLayer);
        }

    } else {

        if (!map.hasLayer(streetLayer)) {
            streetLayer.addTo(map);
        }

        if (map.hasLayer(satelliteLayer)) {
            map.removeLayer(satelliteLayer);
        }

        if (map.hasLayer(satelliteLabels)) {
            map.removeLayer(satelliteLabels);
        }
    }

    showSettingsPage();
}


// =========================================================
// SAVED STORAGE
// =========================================================

function loadSaved() {

    try {

        const raw =
            localStorage.getItem(
                "parcelscope_saved"
            );

        return raw ?
            JSON.parse(raw) :
            [];

    } catch {

        return [];
    }
}


function saveSaved() {

    try {

        localStorage.setItem(
            "parcelscope_saved",
            JSON.stringify(state.saved)
        );

    } catch (error) {

        console.warn(
            "Unable to save properties",
            error
        );
    }
}


// =========================================================
// HELPERS
// =========================================================

function makePropertyKey(p) {

    return String(
        p.apn ||
        p.parcelid ||
        p.PARCEL_ID ||
        p.propfuladd ||
        [
            p.propcity,
            p.prophsnum,
            p.propstname
        ].filter(Boolean).join("-") ||
        Math.random()
    ).toLowerCase();
}


function getFeatureCenter(feature) {

    try {

        const layer =
            L.geoJSON(feature);

        const center =
            layer.getBounds().getCenter();

        return [
            center.lat,
            center.lng
        ];

    } catch {

        return null;
    }
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// CLOSE PANELS WITH ESC
// =========================================================

document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") {
            return;
        }

        sideMenu?.classList.remove("open");
        closePropertyPanel();
        closeResultsPanel();
        closePage();
    }
);


// =========================================================
// STARTUP
// =========================================================

setStatus(
    `ParcelScope ${VERSION} ready`
);

console.log(
    `ParcelScope Idaho ${VERSION} initialized`
);
