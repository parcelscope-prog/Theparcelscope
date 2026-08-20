/* =========================================================
   PARCELSCOPE IDAHO
   Version: 5781683
   ========================================================= */

const VERSION = "5781683";

/* =========================================================
   MAP
   ========================================================= */

const map = L.map("map", {
    center: [44.0682, -114.7420],
    zoom: 7,
    zoomControl: true,
    preferCanvas: true
});

/* Normal map */

const streetLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }
);

/* Satellite */

const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri"
    }
);

/* Start with satellite */

satelliteLayer.addTo(map);

/* =========================================================
   IDAHO PARCEL SERVICE
   ========================================================= */

const PARCEL_SERVICE =
    "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";

const PARCEL_QUERY = `${PARCEL_SERVICE}/query`;

let parcelLayer = null;
let selectedParcel = null;

/* =========================================================
   STATE
   ========================================================= */

let settings = {
    satellite: true,
    showParcelLines: true,
    autoZoom: true
};

let savedProperties =
    JSON.parse(localStorage.getItem("parcelscope_saved") || "[]");

/* =========================================================
   ELEMENTS
   ========================================================= */

const menuButton =
    document.getElementById("menuButton");

const closeMenu =
    document.getElementById("closeMenu");

const sideMenu =
    document.getElementById("sideMenu");

const propertyPanel =
    document.getElementById("propertyPanel");

const closeProperty =
    document.getElementById("closeProperty");

const propertyTitle =
    document.getElementById("propertyTitle");

const propertyContent =
    document.getElementById("propertyContent");

const searchResults =
    document.getElementById("searchResults");

const resultsContent =
    document.getElementById("resultsContent");

const closeResults =
    document.getElementById("closeResults");

const searchInput =
    document.getElementById("searchInput");

const searchButton =
    document.getElementById("searchButton");

const appPage =
    document.getElementById("appPage");

const appPageTitle =
    document.getElementById("appPageTitle");

const appPageKicker =
    document.getElementById("appPageKicker");

const appPageContent =
    document.getElementById("appPageContent");

const closeAppPage =
    document.getElementById("closeAppPage");

const mapStatusText =
    document.getElementById("mapStatusText");

/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {
    if (mapStatusText) {
        mapStatusText.textContent = text;
    }
}

/* =========================================================
   MENU
   ========================================================= */

menuButton?.addEventListener("click", () => {
    sideMenu.classList.add("open");
});

closeMenu?.addEventListener("click", () => {
    sideMenu.classList.remove("open");
});

/* =========================================================
   CLOSE PANELS
   ========================================================= */

closeProperty?.addEventListener("click", () => {
    propertyPanel.classList.remove("open");

    if (selectedParcel) {
        selectedParcel.setStyle({
            weight: 1,
            color: "#5f8eaf",
            fillOpacity: 0.04
        });
    }

    selectedParcel = null;
});

closeResults?.addEventListener("click", () => {
    searchResults.classList.remove("open");
});

closeAppPage?.addEventListener("click", () => {
    appPage.classList.remove("open");
});

/* =========================================================
   MAP LAYERS
   ========================================================= */

function setSatellite(enabled) {

    settings.satellite = enabled;

    if (enabled) {

        if (map.hasLayer(streetLayer)) {
            map.removeLayer(streetLayer);
        }

        if (!map.hasLayer(satelliteLayer)) {
            satelliteLayer.addTo(map);
        }

    } else {

        if (map.hasLayer(satelliteLayer)) {
            map.removeLayer(satelliteLayer);
        }

        if (!map.hasLayer(streetLayer)) {
            streetLayer.addTo(map);
        }
    }

    localStorage.setItem(
        "parcelscope_settings",
        JSON.stringify(settings)
    );
}

/* =========================================================
   PARCEL DISPLAY
   ========================================================= */

function createParcelLayer() {

    if (parcelLayer) {
        map.removeLayer(parcelLayer);
    }

    parcelLayer = L.geoJSON(null, {
        style: {
            color: "#70a9d2",
            weight: 1,
            opacity: 0.85,
            fillColor: "#3f7aa8",
            fillOpacity: 0.035
        },

        onEachFeature: function(feature, layer) {

            layer.on("click", function() {
                showParcel(feature, layer);
            });

            layer.on("mouseover", function() {

                layer.setStyle({
                    weight: 2,
                    color: "#8fc4e8",
                    fillOpacity: 0.10
                });

                if (layer.bringToFront) {
                    layer.bringToFront();
                }
            });

            layer.on("mouseout", function() {

                if (selectedParcel !== layer) {

                    layer.setStyle({
                        weight: 1,
                        color: "#5f8eaf",
                        fillOpacity: 0.04
                    });
                }
            });
        }
    });

    if (settings.showParcelLines) {
        parcelLayer.addTo(map);
    }
}

/* =========================================================
   LOAD PARCELS IN VIEW
   ========================================================= */

let parcelLoadTimer = null;

function loadParcelsInView() {

    if (!settings.showParcelLines) {
        return;
    }

    clearTimeout(parcelLoadTimer);

    parcelLoadTimer = setTimeout(async () => {

        /*
         * Don't request thousands of parcels while zoomed
         * way out. The map can still be used normally.
         */

        if (map.getZoom() < 12) {

            if (parcelLayer) {
                parcelLayer.clearLayers();
            }

            setStatus("Zoom in to view parcel boundaries");
            return;
        }

        const bounds = map.getBounds();

        const geometry = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(",");

        const params = new URLSearchParams({

            where: "1=1",

            geometry: geometry,

            geometryType: "esriGeometryEnvelope",

            inSR: "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                "*",

            returnGeometry:
                "true",

            outSR:
                "4326",

            resultRecordCount:
                "1000",

            f:
                "geojson"
        });

        try {

            setStatus("Loading parcels...");

            const response =
                await fetch(
                    `${PARCEL_QUERY}?${params.toString()}`
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            if (!data.features) {
                throw new Error(
                    "Parcel service returned no features"
                );
            }

            parcelLayer.clearLayers();

            parcelLayer.addData(data);

            setStatus(
                `${data.features.length} parcels loaded`
            );

        } catch (error) {

            console.error(
                "Parcel loading error:",
                error
            );

            setStatus(
                "Parcel layer unavailable — try zooming in"
            );
        }

    }, 350);
}

createParcelLayer();

map.on("moveend", loadParcelsInView);
map.on("zoomend", loadParcelsInView);

/* =========================================================
   PROPERTY DISPLAY
   ========================================================= */

function getField(feature, names) {

    const props =
        feature?.properties || {};

    for (const name of names) {

        if (
            props[name] !== undefined &&
            props[name] !== null &&
            String(props[name]).trim() !== ""
        ) {
            return props[name];
        }
    }

    return "Not available";
}

function showParcel(feature, layer) {

    const props =
        feature.properties || {};

    if (selectedParcel && selectedParcel !== layer) {

        selectedParcel.setStyle({
            weight: 1,
            color: "#5f8eaf",
            fillOpacity: 0.04
        });
    }

    selectedParcel = layer;

    layer.setStyle({
        weight: 3,
        color: "#9dd2f3",
        fillOpacity: 0.16
    });

    if (layer.bringToFront) {
        layer.bringToFront();
    }

    const parcelId =
        getField(feature, [
            "PARCEL_ID",
            "PIN",
            "PARCELID",
            "Parcel_ID",
            "parcel_id"
        ]);

    const owner =
        getField(feature, [
            "OWNER",
            "Owner",
            "owner"
        ]);

    const county =
        getField(feature, [
            "COUNTY",
            "County",
            "county"
        ]);

    const address =
        getField(feature, [
            "SITE_ADDRESS",
            "SITEADDR",
            "ADDRESS",
            "Address",
            "SITE_ADDR",
            "LOCATION"
        ]);

    propertyTitle.textContent =
        address !== "Not available"
            ? address
            : `Parcel ${parcelId}`;

    propertyContent.innerHTML = `

        <div class="property-field">
            <div class="property-label">
                Parcel ID
            </div>

            <div class="property-value">
                ${escapeHtml(parcelId)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">
                Address
            </div>

            <div class="property-value">
                ${escapeHtml(address)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">
                County
            </div>

            <div class="property-value">
                ${escapeHtml(county)}
            </div>
        </div>

        <div class="property-field">
            <div class="property-label">
                Owner / Record
            </div>

            <div class="property-value">
                ${escapeHtml(owner)}
            </div>
        </div>

        <button
            class="save-property"
            id="saveCurrentProperty"
        >
            Save Property
        </button>
    `;

    document
        .getElementById("saveCurrentProperty")
        ?.addEventListener(
            "click",
            () => saveProperty(feature)
        );

    propertyPanel.classList.add("open");
}

/* =========================================================
   SEARCH
   ========================================================= */

async function searchProperties() {

    const raw =
        searchInput.value.trim();

    if (!raw) {
        return;
    }

    setStatus("Searching Idaho parcels...");

    resultsContent.innerHTML = `
        <div class="page-card">
            Searching parcel records...
        </div>
    `;

    searchResults.classList.add("open");

    /*
     * Search several likely fields instead of depending on
     * one specific county's field naming.
     */

    const safe =
        raw.replace(/'/g, "''");

    const where = `
        PARCEL_ID LIKE '%${safe}%'
        OR OWNER LIKE '%${safe}%'
        OR SITE_ADDRESS LIKE '%${safe}%'
    `;

    const params =
        new URLSearchParams({

            where: where,

            outFields: "*",

            returnGeometry: "true",

            outSR: "4326",

            resultRecordCount: "50",

            f: "geojson"
        });

    try {

        let response =
            await fetch(
                `${PARCEL_QUERY}?${params.toString()}`
            );

        let data =
            await response.json();

        /*
         * Some records may not have all optional fields.
         * If the first field-based query fails, try a
         * broader text query against the parcel ID.
         */

        if (
            data.error ||
            !Array.isArray(data.features)
        ) {

            const fallbackParams =
                new URLSearchParams({

                    where:
                        `PARCEL_ID LIKE '%${safe}%'`,

                    outFields: "*",

                    returnGeometry: "true",

                    outSR: "4326",

                    resultRecordCount: "50",

                    f: "geojson"
                });

            response =
                await fetch(
                    `${PARCEL_QUERY}?${fallbackParams.toString()}`
                );

            data =
                await response.json();
        }

        if (
            !data.features ||
            data.features.length === 0
        ) {

            /*
             * If it looks like an address, use the public
             * geocoder to find the location first, then
             * locate the parcel around that point.
             */

            const geocodeResult =
                await geocodeAddress(raw);

            if (geocodeResult) {

                await searchParcelAtPoint(
                    geocodeResult.lat,
                    geocodeResult.lng,
                    raw
                );

                return;
            }

            resultsContent.innerHTML = `
                <div class="page-card">
                    <strong>No parcels found</strong>
                    <div>
                        Try a parcel ID, street address,
                        owner name, or a shorter search.
                    </div>
                </div>
            `;

            setStatus("No matching parcels");

            return;
        }

        displaySearchResults(
            data.features
        );

        setStatus(
            `${data.features.length} result${
                data.features.length === 1 ? "" : "s"
            } found`
        );

    } catch (error) {

        console.error(
            "Search error:",
            error
        );

        resultsContent.innerHTML = `
            <div class="page-card">
                <strong>Search temporarily unavailable</strong>
                <div>
                    Try again or zoom to the area and
                    click the parcel directly.
                </div>
            </div>
        `;

        setStatus("Search unavailable");
    }
}

searchButton?.addEventListener(
    "click",
    searchProperties
);

searchInput?.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            event.preventDefault();
            searchProperties();
        }
    }
);

/* =========================================================
   GEOCODING
   ========================================================= */

async function geocodeAddress(address) {

    try {

        const params =
            new URLSearchParams({

                q:
                    `${address}, Idaho`,

                format:
                    "json",

                limit:
                    "1",

                countrycodes:
                    "us"
            });

        const response =
            await fetch(
                `https://nominatim.openstreetmap.org/search?${params.toString()}`,
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const data =
            await response.json();

        if (
            !data ||
            data.length === 0
        ) {
            return null;
        }

        return {
            lat:
                Number(data[0].lat),

            lng:
                Number(data[0].lon)
        };

    } catch (error) {

        console.error(
            "Geocoder error:",
            error
        );

        return null;
    }
}

/* =========================================================
   FIND PARCEL AT ADDRESS POINT
   ========================================================= */

async function searchParcelAtPoint(
    lat,
    lng,
    originalSearch
) {

    const params =
        new URLSearchParams({

            geometry:
                `${lng},${lat}`,

            geometryType:
                "esriGeometryPoint",

            inSR:
                "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                "*",

            returnGeometry:
                "true",

            outSR:
                "4326",

            f:
                "geojson"
        });

    try {

        const response =
            await fetch(
                `${PARCEL_QUERY}?${params.toString()}`
            );

        const data =
            await response.json();

        if (
            !data.features ||
            data.features.length === 0
        ) {

            /*
             * No parcel directly underneath the geocoded
             * point. Still show the location.
             */

            map.setView(
                [lat, lng],
                17
            );

            resultsContent.innerHTML = `
                <div class="page-card">
                    <strong>Address located</strong>
                    <div>
                        ${escapeHtml(originalSearch)}
                    </div>
                    <div style="margin-top:8px;color:#aaa">
                        No matching public parcel was found
                        at that exact location.
                    </div>
                </div>
            `;

            setStatus(
                "Address located — no parcel found"
            );

            return;
        }

        displaySearchResults(
            data.features
        );

        map.setView(
            [lat, lng],
            17
        );

        setStatus(
            `${data.features.length} parcel${
                data.features.length === 1 ? "" : "s"
            } found near address`
        );

    } catch (error) {

        console.error(
            "Point parcel search error:",
            error
        );

        setStatus(
            "Could not locate parcel"
        );
    }
}

/* =========================================================
   SEARCH RESULT UI
   ========================================================= */

function displaySearchResults(features) {

    resultsContent.innerHTML = "";

    features.forEach(
        (feature, index) => {

            const props =
                feature.properties || {};

            const parcelId =
                getField(feature, [
                    "PARCEL_ID",
                    "PIN",
                    "PARCELID"
                ]);

            const owner =
                getField(feature, [
                    "OWNER",
                    "Owner"
                ]);

            const address =
                getField(feature, [
                    "SITE_ADDRESS",
                    "SITEADDR",
                    "ADDRESS",
                    "Address",
                    "SITE_ADDR",
                    "LOCATION"
                ]);

            const county =
                getField(feature, [
                    "COUNTY",
                    "County"
                ]);

            const item =
                document.createElement("div");

            item.className =
                "search-result";

            item.innerHTML = `

                <div class="search-result-title">
                    ${
                        address !== "Not available"
                            ? escapeHtml(address)
                            : `Parcel ${escapeHtml(parcelId)}`
                    }
                </div>

                <div class="search-result-details">
                    Parcel ID:
                    ${escapeHtml(parcelId)}
                    <br>

                    County:
                    ${escapeHtml(county)}
                    <br>

                    Record:
                    ${escapeHtml(owner)}
                </div>
            `;

            item.addEventListener(
                "click",
                () => {

                    if (
                        feature.geometry &&
                        feature.geometry.coordinates
                    ) {

                        const bounds =
                            L.geoJSON(
                                feature
                            ).getBounds();

                        if (
                            bounds.isValid()
                        ) {

                            map.fitBounds(
                                bounds,
                                {
                                    padding:
                                        [80, 80],
                                    maxZoom:
                                        18
                                }
                            );
                        }
                    }

                    /*
                     * Add this result to the visible
                     * parcel layer so the user can select it.
                     */

                    const tempLayer =
                        L.geoJSON(
                            feature,
                            {
                                style: {
                                    color:
                                        "#9dd2f3",
                                    weight:
                                        3,
                                    fillColor:
                                        "#3f7aa8",
                                    fillOpacity:
                                        0.15
                                }
                            }
                        ).addTo(map);

                    showParcel(
                        feature,
                        tempLayer
                    );

                    searchResults.classList.remove(
                        "open"
                    );
                }
            );

            resultsContent.appendChild(
                item
            );
        }
    );
}

/* =========================================================
   SAVE PROPERTY
   ========================================================= */

function saveProperty(feature) {

    const parcelId =
        getField(feature, [
            "PARCEL_ID",
            "PIN",
            "PARCELID"
        ]);

    const owner =
        getField(feature, [
            "OWNER",
            "Owner"
        ]);

    const address =
        getField(feature, [
            "SITE_ADDRESS",
            "SITEADDR",
            "ADDRESS",
            "Address",
            "SITE_ADDR",
            "LOCATION"
        ]);

    const county =
        getField(feature, [
            "COUNTY",
            "County"
        ]);

    const existing =
        savedProperties.find(
            item =>
                item.parcelId === parcelId
        );

    if (existing) {

        setStatus(
            "Property already saved"
        );

        return;
    }

    savedProperties.push({

        parcelId,
        owner,
        address,
        county,

        savedAt:
            new Date().toISOString(),

        feature
    });

    localStorage.setItem(
        "parcelscope_saved",
        JSON.stringify(
            savedProperties
        )
    );

    setStatus(
        "Property saved"
    );
}

/* =========================================================
   MENU PAGES
   ========================================================= */

document
    .querySelectorAll(".menu-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const section =
                    button.dataset.section;

                sideMenu.classList.remove(
                    "open"
                );

                openAppPage(section);
            }
        );
    });

function openAppPage(section) {

    appPage.classList.add("open");

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

        default:
            showAboutPage();
    }
}

/* =========================================================
   COUNTIES
   ========================================================= */

const counties = [
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

    appPageKicker.textContent =
        "PROPERTY";

    appPageTitle.textContent =
        "Idaho Counties";

    appPageContent.innerHTML = `

        <div class="page-section">

            <p>
                Select a county to use as a starting
                point for parcel research.
            </p>

            <div class="county-search">

                <input
                    id="countyFilter"
                    type="search"
                    placeholder="Search counties..."
                    autocomplete="off"
                >

            </div>

            <div
                id="countyGrid"
                class="county-grid"
            >

                ${counties.map(
                    county => `
                        <button
                            class="county-button"
                            data-county="${escapeHtml(county)}"
                        >
                            ${escapeHtml(county)} County
                        </button>
                    `
                ).join("")}

            </div>

        </div>
    `;

    const filter =
        document.getElementById(
            "countyFilter"
        );

    filter?.addEventListener(
        "input",
        () => {

            const value =
                filter.value
                    .toLowerCase()
                    .trim();

            document
                .querySelectorAll(
                    ".county-button"
                )
                .forEach(button => {

                    const name =
                        button.dataset
                            .county
                            .toLowerCase();

                    button.classList.toggle(
                        "hidden",
                        !name.includes(value)
                    );
                });
        }
    );

    document
        .querySelectorAll(
            ".county-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const county =
                        button.dataset.county;

                    searchInput.value =
                        county;

                    appPage.classList.remove(
                        "open"
                    );

                    searchProperties();
                }
            );
        });
}

/* =========================================================
   SAVED PAGE
   ========================================================= */

function showSavedPage() {

    appPageKicker.textContent =
        "PROPERTY";

    appPageTitle.textContent =
        "Saved Properties";

    if (
        savedProperties.length === 0
    ) {

        appPageContent.innerHTML = `

            <div class="page-card">

                <strong>
                    No saved properties
                </strong>

                <div>
                    Properties you save will
                    appear here.
                </div>

            </div>
        `;

        return;
    }

    appPageContent.innerHTML =
        savedProperties.map(
            (item, index) => `

                <div
                    class="saved-property"
                    data-index="${index}"
                >

                    <div>

                        <div class="saved-name">
                            ${
                                escapeHtml(
                                    item.address ||
                                    `Parcel ${item.parcelId}`
                                )
                            }
                        </div>

                        <div class="saved-address">
                            Parcel ID:
                            ${escapeHtml(item.parcelId)}
                            <br>

                            ${escapeHtml(item.county)}
                            County
                        </div>

                    </div>

                    <button
                        class="remove-saved"
                        data-remove="${index}"
                        aria-label="Remove saved property"
                    >
                        ×
                    </button>

                </div>
            `
        ).join("");

    document
        .querySelectorAll(
            ".remove-saved"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const index =
                        Number(
                            button.dataset.remove
                        );

                    savedProperties.splice(
                        index,
                        1
                    );

                    localStorage.setItem(
                        "parcelscope_saved",
                        JSON.stringify(
                            savedProperties
                        )
                    );

                    showSavedPage();
                }
            );
        });
}

/* =========================================================
   DATA SOURCES
   ========================================================= */

function showSourcesPage() {

    appPageKicker.textContent =
        "DATA";

    appPageTitle.textContent =
        "Data Sources";

    appPageContent.innerHTML = `

        <div class="page-section">

            <h2>Idaho Parcel Data</h2>

            <p>
                ParcelScope uses publicly available
                Idaho parcel data published through
                ArcGIS services.
            </p>

        </div>

        <div class="page-card">

            <strong>
                Statewide Idaho Parcel Layer
            </strong>

            <div>
                Public parcel polygons and attributes
                supplied through Idaho's statewide
                parcel initiative.
            </div>

        </div>

        <div class="page-card">

            <strong>
                Map Imagery
            </strong>

            <div>
                Satellite imagery is provided through
                Esri World Imagery.
            </div>

        </div>

        <div class="page-card">

            <strong>
                Address Search
            </strong>

            <div>
                Address searches use public geocoding
                to locate an address before attempting
                to identify the parcel beneath it.
            </div>

        </div>

        <div class="page-section">

            <p>
                Parcel information can vary by county
                and should be verified with the
                appropriate county assessor before
                being relied upon for official purposes.
            </p>

        </div>
    `;
}

/* =========================================================
   HISTORY
   ========================================================= */

function showHistoryPage() {

    appPageKicker.textContent =
        "DATA";

    appPageTitle.textContent =
        "Update History";

    appPageContent.innerHTML = `

        <div class="page-card">

            <strong>
                Version ${VERSION}
            </strong>

            <div>
                Current ParcelScope build.
            </div>

        </div>

        <div class="page-card">

            <strong>
                Parcel Search
            </strong>

            <div>
                Improved parcel-ID, property-record,
                and address searching.
            </div>

        </div>

        <div class="page-card">

            <strong>
                Mapping
            </strong>

            <div>
                Satellite imagery and parcel
                boundaries restored.
            </div>

        </div>

    `;
}

/* =========================================================
   SETTINGS
   ========================================================= */

function showSettingsPage() {

    appPageKicker.textContent =
        "SYSTEM";

    appPageTitle.textContent =
        "Settings";

    appPageContent.innerHTML = `

        <div class="setting-group">

            <h2>Map</h2>

            <div class="setting-row">

                <div>

                    <div class="setting-name">
                        Satellite imagery
                    </div>

                    <div class="setting-description">
                        Use satellite imagery as the
                        primary map.
                    </div>

                </div>

                <button
                    id="satelliteToggle"
                    class="toggle ${
                        settings.satellite
                            ? "on"
                            : ""
                    }"
                    aria-label="Toggle satellite imagery"
                ></button>

            </div>

            <div class="setting-row">

                <div>

                    <div class="setting-name">
                        Parcel boundaries
                    </div>

                    <div class="setting-description">
                        Display parcel outlines when
                        zoomed in.
                    </div>

                </div>

                <button
                    id="parcelToggle"
                    class="toggle ${
                        settings.showParcelLines
                            ? "on"
                            : ""
                    }"
                    aria-label="Toggle parcel boundaries"
                ></button>

            </div>

            <div class="setting-row">

                <div>

                    <div class="setting-name">
                        Automatic map zoom
                    </div>

                    <div class="setting-description">
                        Automatically zoom to selected
                        search results.
                    </div>

                </div>

                <button
                    id="autoZoomToggle"
                    class="toggle ${
                        settings.autoZoom
                            ? "on"
                            : ""
                    }"
                    aria-label="Toggle automatic zoom"
                ></button>

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
                        ParcelScope build number.
                    </div>

                </div>

                <div>
                    ${VERSION}
                </div>

            </div>

        </div>

        <div class="setting-group">

            <button
                id="resetSettings"
                class="refresh-button"
            >
                Reset Settings
            </button>

        </div>
    `;

    document
        .getElementById(
            "satelliteToggle"
        )
        ?.addEventListener(
            "click",
            () => {

                setSatellite(
                    !settings.satellite
                );

                showSettingsPage();
            }
        );

    document
        .getElementById(
            "parcelToggle"
        )
        ?.addEventListener(
            "click",
            () => {

                settings.showParcelLines =
                    !settings.showParcelLines;

                localStorage.setItem(
                    "parcelscope_settings",
                    JSON.stringify(settings)
                );

                if (
                    settings.showParcelLines
                ) {

                    if (!parcelLayer) {
                        createParcelLayer();
                    } else {
                        parcelLayer.addTo(map);
                    }

                    loadParcelsInView();

                } else if (parcelLayer) {

                    map.removeLayer(
                        parcelLayer
                    );
                }

                showSettingsPage();
            }
        );

    document
        .getElementById(
            "autoZoomToggle"
        )
        ?.addEventListener(
            "click",
            () => {

                settings.autoZoom =
                    !settings.autoZoom;

                localStorage.setItem(
                    "parcelscope_settings",
                    JSON.stringify(settings)
                );

                showSettingsPage();
            }
        );

    document
        .getElementById(
            "resetSettings"
        )
        ?.addEventListener(
            "click",
            () => {

                settings = {
                    satellite: true,
                    showParcelLines: true,
                    autoZoom: true
                };

                localStorage.setItem(
                    "parcelscope_settings",
                    JSON.stringify(settings)
                );

                setSatellite(true);

                if (parcelLayer) {
                    parcelLayer.addTo(map);
                }

                showSettingsPage();

                loadParcelsInView();
            }
        );
}

/* =========================================================
   ABOUT
   ========================================================= */

function showAboutPage() {

    appPageKicker.textContent =
        "PARCELSCOPE";

    appPageTitle.textContent =
        "About";

    appPageContent.innerHTML = `

        <div class="page-section">

            <h2>ParcelScope Idaho</h2>

            <p>
                A public-data property research map
                for Idaho.
            </p>

        </div>

        <div class="page-card">

            <strong>
                Version
            </strong>

            <div>
                ${VERSION}
            </div>

        </div>

        <div class="page-card">

            <strong>
                Purpose
            </strong>

            <div>
                ParcelScope makes it easier to explore
                publicly available parcel information,
                map locations, and property records.
            </div>

        </div>

        <div class="page-section">

            <p>
                ParcelScope is not an official county
                assessor website and does not replace
                official property records.
            </p>

        </div>
    `;
}

/* =========================================================
   LOAD SETTINGS
   ========================================================= */

try {

    const stored =
        JSON.parse(
            localStorage.getItem(
                "parcelscope_settings"
            )
        );

    if (stored) {

        settings = {
            ...settings,
            ...stored
        };
    }

} catch (error) {

    console.warn(
        "Could not load saved settings",
        error
    );
}

/* Apply startup map */

setSatellite(
    settings.satellite
);

if (!settings.showParcelLines) {

    if (parcelLayer) {
        map.removeLayer(
            parcelLayer
        );
    }
}

/* =========================================================
   SEARCH PLACEHOLDER
   ========================================================= */

if (searchInput) {

    searchInput.placeholder =
        "Search address, owner, or parcel ID...";
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    if (
        value === undefined ||
        value === null
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

/* =========================================================
   INITIAL STATUS
   ========================================================= */

setStatus(
    "ParcelScope ready"
);
