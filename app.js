/* =========================================================
   PARCELSCOPE IDAHO
   Main Application
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const menuButton = document.getElementById("menuButton");
    const closeMenu = document.getElementById("closeMenu");
    const sideMenu = document.getElementById("sideMenu");

    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");

    const searchResults = document.getElementById("searchResults");
    const resultsContent = document.getElementById("resultsContent");
    const closeResults = document.getElementById("closeResults");

    const propertyPanel = document.getElementById("propertyPanel");
    const closeProperty = document.getElementById("closeProperty");

    const propertyContent = document.getElementById("propertyContent");
    const propertyTitle = document.getElementById("propertyTitle");

    const mapStatus = document.getElementById("mapStatus");
    const mapStatusText = document.getElementById("mapStatusText");

    const appPage = document.getElementById("appPage");
    const appPageTitle = document.getElementById("appPageTitle");
    const appPageKicker = document.getElementById("appPageKicker");
    const appPageContent = document.getElementById("appPageContent");
    const closeAppPage = document.getElementById("closeAppPage");


    /* =====================================================
       DATA SOURCES
    ===================================================== */

    const PARCEL_URL =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";

    const COUNTY_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/2";

    const IDAHO_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/3";


    /* =====================================================
       MAP
    ===================================================== */

    const map = L.map("map", {
        zoomControl: true,
        attributionControl: true
    });


    /* =====================================================
       MAP STYLES
    ===================================================== */

    const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Tiles © Esri"
        }
    );

    const standardLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    );

    satelliteLayer.addTo(map);


    /* =====================================================
       MAP OVERLAYS
    ===================================================== */

    let countyLayer = null;
    let idahoLayer = null;
    let parcelLayer = null;

    let selectedParcelLayer = null;

    let parcelRequestController = null;


    /* =====================================================
       SETTINGS
    ===================================================== */

    const defaultSettings = {
        mapStyle: "satellite",
        parcels: true,
        counties: true,
        idaho: true
    };

    let settings = loadSettings();


    function loadSettings() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem("parcelScopeSettings")
                );

            return {
                ...defaultSettings,
                ...(saved || {})
            };

        } catch {

            return {
                ...defaultSettings
            };

        }

    }


    function saveSettings() {

        localStorage.setItem(
            "parcelScopeSettings",
            JSON.stringify(settings)
        );

    }


    /* =====================================================
       INITIAL MAP VIEW
    ===================================================== */

    map.setView(
        [44.0682, -114.7420],
        6
    );


    /* =====================================================
       MENU
    ===================================================== */

    function openMenu() {

        sideMenu.classList.add("open");

    }


    function closeMenuPanel() {

        sideMenu.classList.remove("open");

    }


    menuButton.addEventListener("click", () => {

        if (sideMenu.classList.contains("open")) {

            closeMenuPanel();

        } else {

            openMenu();

        }

    });


    closeMenu.addEventListener(
        "click",
        closeMenuPanel
    );


    /* Clicking map closes menu */

    map.on("click", () => {

        closeMenuPanel();

    });


    /* =====================================================
       PROPERTY PANEL
    ===================================================== */

    closeProperty.addEventListener("click", () => {

        propertyPanel.classList.remove("open");

    });


    closeResults.addEventListener("click", () => {

        searchResults.classList.remove("open");

    });


    /* =====================================================
       PAGE
    ===================================================== */

    closeAppPage.addEventListener("click", () => {

        appPage.classList.remove("open");

    });


    function openPage(title, content, kicker = "PARCELSCOPE") {

        appPageKicker.textContent = kicker;
        appPageTitle.textContent = title;
        appPageContent.innerHTML = content;

        appPage.classList.add("open");

        closeMenuPanel();

    }


    /* =====================================================
       STATE / COUNTY BOUNDARIES
    ===================================================== */

    async function loadBoundaryLayers() {

        try {

            const [countyResponse, idahoResponse] =
                await Promise.all([
                    fetch(
                        `${COUNTY_URL}/query?where=1%3D1&outFields=CountyName,CountyFIPS&returnGeometry=true&outSR=4326&f=geojson`
                    ),
                    fetch(
                        `${IDAHO_URL}/query?where=1%3D1&outFields=Name,NameAbbr&returnGeometry=true&outSR=4326&f=geojson`
                    )
                ]);

            if (!countyResponse.ok || !idahoResponse.ok) {
                throw new Error("Boundary request failed");
            }

            const countyGeoJSON =
                await countyResponse.json();

            const idahoGeoJSON =
                await idahoResponse.json();


            countyLayer = L.geoJSON(
                countyGeoJSON,
                {
                    style: {
                        color: "#d7a84a",
                        weight: 1.2,
                        opacity: 0.9,
                        fillOpacity: 0
                    },

                    onEachFeature: (
                        feature,
                        layer
                    ) => {

                        const name =
                            feature.properties?.CountyName ||
                            "County";

                        layer.bindTooltip(name, {
                            sticky: true,
                            direction: "center"
                        });

                    }
                }
            );


            idahoLayer = L.geoJSON(
                idahoGeoJSON,
                {
                    style: {
                        color: "#ffffff",
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0
                    }
                }
            );


            updateBoundaryVisibility();

        } catch (error) {

            console.error(
                "Boundary loading error:",
                error
            );

        }

    }


    function updateBoundaryVisibility() {

        if (!countyLayer || !idahoLayer) {
            return;
        }


        if (
            settings.counties &&
            !map.hasLayer(countyLayer)
        ) {

            countyLayer.addTo(map);

        }


        if (
            !settings.counties &&
            map.hasLayer(countyLayer)
        ) {

            map.removeLayer(countyLayer);

        }


        if (
            settings.idaho &&
            !map.hasLayer(idahoLayer)
        ) {

            idahoLayer.addTo(map);

        }


        if (
            !settings.idaho &&
            map.hasLayer(idahoLayer)
        ) {

            map.removeLayer(idahoLayer);

        }

    }


    /* =====================================================
       PARCEL DATA
    ===================================================== */

    async function loadParcels() {

        if (!settings.parcels) {

            if (parcelLayer) {

                map.removeLayer(parcelLayer);

            }

            return;

        }


        /*
         * Parcel data is loaded for the current map window.
         * This prevents thousands of statewide parcel polygons
         * from being downloaded at once.
         */

        if (map.getZoom() < 10) {

            if (parcelLayer) {

                map.removeLayer(parcelLayer);

            }

            return;

        }


        if (parcelRequestController) {

            parcelRequestController.abort();

        }


        parcelRequestController =
            new AbortController();


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

            geometryType:
                "esriGeometryEnvelope",

            inSR: "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                "OBJECTID,PARCEL_ID,STEWARD,County,UPDATED,OWNER1,OWNER2,ASR_ACRES,SITE_ADD,SITE_CITY,SITE_ZIP,VAL_TOTAL,FP_ID",

            returnGeometry: "true",

            outSR: "4326",

            resultRecordCount: "2000",

            f: "geojson"

        });


        try {

            setStatus(
                "Loading parcel boundaries..."
            );


            const response =
                await fetch(
                    `${PARCEL_URL}/query?${params.toString()}`,
                    {
                        signal:
                            parcelRequestController.signal
                    }
                );


            if (!response.ok) {
                throw new Error(
                    "Parcel request failed"
                );
            }


            const data =
                await response.json();


            if (parcelLayer) {

                map.removeLayer(parcelLayer);

            }


            parcelLayer =
                L.geoJSON(
                    data,
                    {
                        style: {
                            color: "#ffffff",
                            weight: 0.7,
                            opacity: 0.75,
                            fillOpacity: 0
                        },

                        onEachFeature: (
                            feature,
                            layer
                        ) => {

                            layer.on(
                                "click",
                                (event) => {

                                    L.DomEvent.stopPropagation(
                                        event
                                    );

                                    showParcel(
                                        feature,
                                        layer
                                    );

                                }
                            );

                        }
                    }
                );


            if (settings.parcels) {

                parcelLayer.addTo(map);

            }


            setStatus(
                `Parcel boundaries loaded`
            );


        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {

                return;

            }


            console.error(
                "Parcel loading error:",
                error
            );


            setStatus(
                "Parcel data unavailable"
            );

        }

    }


    /* =====================================================
       MAP MOVE / ZOOM
    ===================================================== */

    let moveTimer = null;


    map.on("moveend", () => {

        clearTimeout(moveTimer);

        moveTimer = setTimeout(
            loadParcels,
            250
        );

    });


    /* =====================================================
       CLICK LOCATION
    ===================================================== */

    map.on("click", async (event) => {

        if (map.getZoom() < 10) {

            showMapLocation(
                event.latlng
            );

            return;

        }


        await findParcelAtPoint(
            event.latlng
        );

    });


    async function findParcelAtPoint(latlng) {

        const geometry =
            `${latlng.lng},${latlng.lat}`;


        const params = new URLSearchParams({

            where: "1=1",

            geometry: geometry,

            geometryType:
                "esriGeometryPoint",

            inSR: "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                "OBJECTID,PARCEL_ID,STEWARD,County,UPDATED,OWNER1,OWNER2,ASR_ACRES,SITE_ADD,SITE_CITY,SITE_ZIP,VAL_TOTAL,FP_ID",

            returnGeometry: "true",

            outSR: "4326",

            resultRecordCount: "1",

            f: "geojson"

        });


        try {

            setStatus(
                "Finding property..."
            );


            const response =
                await fetch(
                    `${PARCEL_URL}/query?${params.toString()}`
                );


            if (!response.ok) {
                throw new Error(
                    "Property query failed"
                );
            }


            const data =
                await response.json();


            if (
                data.features &&
                data.features.length
            ) {

                const feature =
                    data.features[0];

                showParcel(
                    feature
                );

            } else {

                showMapLocation(
                    latlng
                );

            }

        } catch (error) {

            console.error(
                error
            );

            showMapLocation(
                latlng
            );

        }

    }


    /* =====================================================
       SHOW MAP LOCATION
    ===================================================== */

    function showMapLocation(latlng) {

        propertyTitle.textContent =
            "Map Location";

        propertyContent.innerHTML = `

            <div class="property-field">
                <div class="property-label">
                    Latitude
                </div>

                <div class="property-value">
                    ${latlng.lat.toFixed(6)}
                </div>
            </div>

            <div class="property-field">
                <div class="property-label">
                    Longitude
                </div>

                <div class="property-value">
                    ${latlng.lng.toFixed(6)}
                </div>
            </div>

            <div class="property-field">
                <div class="property-label">
                    Parcel
                </div>

                <div class="property-value">
                    Zoom in closer to select a parcel.
                </div>
            </div>

        `;

        propertyPanel.classList.add("open");

    }


    /* =====================================================
       SHOW PARCEL
    ===================================================== */

    function showParcel(
        feature,
        sourceLayer = null
    ) {

        const p =
            feature.properties || {};


        if (selectedParcelLayer) {

            selectedParcelLayer.setStyle({
                color: "#ffffff",
                weight: 0.7,
                opacity: 0.75,
                fillOpacity: 0
            });

        }


        if (sourceLayer) {

            selectedParcelLayer =
                sourceLayer;

        }


        if (
            selectedParcelLayer &&
            selectedParcelLayer.setStyle
        ) {

            selectedParcelLayer.setStyle({
                color: "#00e5ff",
                weight: 3,
                opacity: 1,
                fillColor: "#00e5ff",
                fillOpacity: 0.15
            });

        }


        const owner =
            cleanValue(
                p.OWNER1
            ) ||
            "Owner information unavailable";


        const address =
            [
                cleanValue(p.SITE_ADD),
                cleanValue(p.SITE_CITY),
                cleanValue(p.SITE_ZIP)
            ]
            .filter(Boolean)
            .join(", ");


        const county =
            cleanValue(p.County) ||
            "Unavailable";


        const acres =
            p.ASR_ACRES !== null &&
            p.ASR_ACRES !== undefined &&
            p.ASR_ACRES !== ""
                ? Number(p.ASR_ACRES)
                    .toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 2
                        }
                    )
                : "Unavailable";


        const parcelID =
            cleanValue(
                p.PARCEL_ID
            ) ||
            cleanValue(
                p.FP_ID
            ) ||
            "Unavailable";


        propertyTitle.textContent =
            owner;


        propertyContent.innerHTML = `

            <div class="property-field">

                <div class="property-label">
                    Owner
                </div>

                <div class="property-value">
                    ${escapeHTML(owner)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Property Address
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        address ||
                        "Address unavailable"
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Parcel ID
                </div>

                <div class="property-value">
                    ${escapeHTML(parcelID)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    County
                </div>

                <div class="property-value">
                    ${escapeHTML(county)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Acreage
                </div>

                <div class="property-value">
                    ${escapeHTML(acres)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Total Assessed Value
                </div>

                <div class="property-value">
                    ${
                        p.VAL_TOTAL !== null &&
                        p.VAL_TOTAL !== undefined &&
                        p.VAL_TOTAL !== ""
                            ? "$" +
                              Number(
                                  p.VAL_TOTAL
                              ).toLocaleString()
                            : "Unavailable"
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Data Steward
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        cleanValue(p.STEWARD) ||
                        "Unavailable"
                    )}
                </div>

            </div>


            <button
                class="save-property"
                id="savePropertyButton"
            >
                ⭐ Save Property
            </button>

        `;


        propertyPanel.classList.add("open");


        document
            .getElementById(
                "savePropertyButton"
            )
            .addEventListener(
                "click",
                () => {

                    saveProperty(
                        feature
                    );

                }
            );


        setStatus(
            "Property selected"
        );

    }


    /* =====================================================
       SEARCH
    ===================================================== */

    searchButton.addEventListener(
        "click",
        performSearch
    );


    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                performSearch();

            }

        }
    );


    async function performSearch() {

        const query =
            searchInput.value.trim();


        if (!query) {

            searchResults.classList.remove(
                "open"
            );

            return;

        }


        resultsContent.innerHTML = `
            <div class="search-result">
                Searching Idaho property records...
            </div>
        `;


        searchResults.classList.add(
            "open"
        );


        const safeQuery =
            query
                .replaceAll("'", "''");


        const where =
            `PARCEL_ID LIKE '%${safeQuery}%' OR ` +
            `OWNER1 LIKE '%${safeQuery}%' OR ` +
            `SITE_ADD LIKE '%${safeQuery}%' OR ` +
            `SITE_CITY LIKE '%${safeQuery}%'`;


        const params =
            new URLSearchParams({

                where: where,

                outFields:
                    "OBJECTID,PARCEL_ID,STEWARD,County,UPDATED,OWNER1,OWNER2,ASR_ACRES,SITE_ADD,SITE_CITY,SITE_ZIP,VAL_TOTAL,FP_ID",

                returnGeometry: "true",

                outSR: "4326",

                resultRecordCount: "30",

                f: "geojson"

            });


        try {

            const response =
                await fetch(
                    `${PARCEL_URL}/query?${params.toString()}`
                );


            if (!response.ok) {
                throw new Error(
                    "Search failed"
                );
            }


            const data =
                await response.json();


            if (
                !data.features ||
                !data.features.length
            ) {

                resultsContent.innerHTML = `
                    <div class="search-result">
                        <div class="search-result-title">
                            No properties found
                        </div>

                        <div class="search-result-details">
                            Try an owner name, address,
                            parcel ID, or city.
                        </div>
                    </div>
                `;

                return;

            }


            resultsContent.innerHTML =
                data.features
                    .map(
                        (
                            feature,
                            index
                        ) => {

                            const p =
                                feature.properties ||
                                {};

                            const owner =
                                cleanValue(
                                    p.OWNER1
                                ) ||
                                "Owner unavailable";

                            const address =
                                [
                                    cleanValue(
                                        p.SITE_ADD
                                    ),
                                    cleanValue(
                                        p.SITE_CITY
                                    )
                                ]
                                .filter(Boolean)
                                .join(", ");


                            return `

                                <div
                                    class="search-result"
                                    data-result-index="${index}"
                                >

                                    <div
                                        class="search-result-title"
                                    >
                                        ${escapeHTML(
                                            owner
                                        )}
                                    </div>

                                    <div
                                        class="search-result-details"
                                    >
                                        ${
                                            escapeHTML(
                                                address ||
                                                "Address unavailable"
                                            )
                                        }

                                        <br>

                                        Parcel:
                                        ${
                                            escapeHTML(
                                                cleanValue(
                                                    p.PARCEL_ID
                                                ) ||
                                                "Unavailable"
                                            )
                                        }
                                    </div>

                                </div>

                            `;

                        }
                    )
                    .join("");


            document
                .querySelectorAll(
                    "[data-result-index]"
                )
                .forEach(
                    element => {

                        element.addEventListener(
                            "click",
                            () => {

                                const index =
                                    Number(
                                        element
                                            .dataset
                                            .resultIndex
                                    );

                                selectSearchResult(
                                    data.features[
                                        index
                                    ]
                                );

                            }
                        );

                    }
                );


        } catch (error) {

            console.error(
                error
            );

            resultsContent.innerHTML = `
                <div class="search-result">

                    <div class="search-result-title">
                        Search unavailable
                    </div>

                    <div class="search-result-details">
                        The public GIS service did not
                        return a result. Try again.
                    </div>

                </div>
            `;

        }

    }


    function selectSearchResult(
        feature
    ) {

        const geometry =
            feature.geometry;


        if (
            geometry &&
            geometry.type ===
            "Polygon"
        ) {

            const tempLayer =
                L.geoJSON(feature);


            map.fitBounds(
                tempLayer.getBounds(),
                {
                    padding: [
                        60,
                        60
                    ],
                    maxZoom: 17
                }
            );

        }


        searchResults.classList.remove(
            "open"
        );


        showParcel(
            feature
        );

    }


    /* =====================================================
       SAVED PROPERTIES
    ===================================================== */

    function getSavedProperties() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    "parcelScopeSaved"
                )
            ) || [];

        } catch {

            return [];

        }

    }


    function saveProperty(
        feature
    ) {

        const p =
            feature.properties || {};


        const parcelID =
            cleanValue(
                p.PARCEL_ID
            ) ||
            cleanValue(
                p.FP_ID
            );


        if (!parcelID) {

            return;

        }


        const saved =
            getSavedProperties();


        const alreadySaved =
            saved.some(
                item =>
                    item.parcelID ===
                    parcelID
            );


        if (alreadySaved) {

            openPage(
                "Saved Properties",
                `
                    <div class="page-card">
                        <strong>Already Saved</strong>
                        This property is already in
                        your saved properties.
                    </div>
                `,
                "SAVED PROPERTIES"
            );

            return;

        }


        saved.push({

            parcelID: parcelID,

            owner:
                cleanValue(
                    p.OWNER1
                ) ||
                "Owner unavailable",

            address:
                [
                    cleanValue(
                        p.SITE_ADD
                    ),
                    cleanValue(
                        p.SITE_CITY
                    ),
                    cleanValue(
                        p.SITE_ZIP
                    )
                ]
                .filter(Boolean)
                .join(", "),

            latitude:
                Number(
                    p.LAT_DD
                ) || null,

            longitude:
                Number(
                    p.LONG_DD
                ) || null

        });


        localStorage.setItem(
            "parcelScopeSaved",
            JSON.stringify(saved)
        );


        propertyPanel.classList.remove(
            "open"
        );

    }


    /* =====================================================
       MENU ITEMS
    ===================================================== */

    document
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const section =
                            button.dataset.section;

                        if (section) {

                            openSection(
                                section
                            );

                        }

                    }
                );

            }
        );


    function openSection(
        section
    ) {

        if (
            section ===
            "counties"
        ) {

            showCounties();

        }


        if (
            section ===
            "saved"
        ) {

            showSavedProperties();

        }


        if (
            section ===
            "sources"
        ) {

            showDataSources();

        }


        if (
            section ===
            "history"
        ) {

            showUpdateHistory();

        }


        if (
            section ===
            "settings"
        ) {

            showSettings();

        }


        if (
            section ===
            "about"
        ) {

            showAbout();

        }

    }


    /* =====================================================
       COUNTIES
    ===================================================== */

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


    function showCounties() {

        const html = `

            <div class="page-section">

                <p>
                    Select an Idaho county to move the map
                    to that county.
                </p>

            </div>

            <div class="county-grid">

                ${
                    counties
                        .map(
                            county => `
                                <button
                                    class="county-button"
                                    data-county="${escapeHTML(
                                        county
                                    )}"
                                >
                                    ${escapeHTML(
                                        county
                                    )} County
                                </button>
                            `
                        )
                        .join("")
                }

            </div>

        `;


        openPage(
            "Counties",
            html,
            "IDAHO COUNTIES"
        );


        document
            .querySelectorAll(
                ".county-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            selectCounty(
                                button.dataset.county
                            );

                        }
                    );

                }
            );

    }


    async function selectCounty(
        county
    ) {

        const safeCounty =
            county.replaceAll(
                "'",
                "''"
            );


        const params =
            new URLSearchParams({

                where:
                    `County = '${safeCounty}'`,

                outFields:
                    "County",

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "1",

                f:
                    "geojson"

            });


        try {

            const response =
                await fetch(
                    `${PARCEL_URL}/query?${params.toString()}`
                );


            if (!response.ok) {
                throw new Error(
                    "County search failed"
                );
            }


            const data =
                await response.json();


            if (
                data.features &&
                data.features.length
            ) {

                const layer =
                    L.geoJSON(
                        data.features[0]
                    );


                map.fitBounds(
                    layer.getBounds(),
                    {
                        padding: [
                            30,
                            30
                        ]
                    }
                );

            } else {

                /*
                 * Fall back to the official county
                 * boundary layer.
                 */

                if (
                    countyLayer
                ) {

                    let found =
                        false;


                    countyLayer.eachLayer(
                        layer => {

                            const name =
                                layer.feature
                                    ?.properties
                                    ?.CountyName;


                            if (
                                name &&
                                name.toLowerCase() ===
                                county.toLowerCase()
                            ) {

                                map.fitBounds(
                                    layer.getBounds(),
                                    {
                                        padding: [
                                            30,
                                            30
                                        ]
                                    }
                                );

                                found = true;

                            }

                        }
                    );


                    if (!found) {

                        alert(
                            "County boundary not found."
                        );

                    }

                }

            }


        } catch (error) {

            console.error(
                error
            );

        }


        appPage.classList.remove(
            "open"
        );

        closeMenuPanel();

    }


    /* =====================================================
       SAVED PAGE
    ===================================================== */

    function showSavedProperties() {

        const saved =
            getSavedProperties();


        if (!saved.length) {

            openPage(
                "Saved Properties",
                `
                    <div class="page-card">

                        <strong>
                            No Saved Properties
                        </strong>

                        Select a parcel and press
                        "Save Property" to add it here.

                    </div>
                `,
                "SAVED PROPERTIES"
            );

            return;

        }


        const html =
            saved
                .map(
                    (
                        item,
                        index
                    ) => `

                        <div
                            class="saved-property"
                            data-saved-index="${index}"
                        >

                            <div>

                                <div class="saved-name">
                                    ${escapeHTML(
                                        item.owner
                                    )}
                                </div>

                                <div class="saved-address">
                                    ${
                                        escapeHTML(
                                            item.address ||
                                            "Address unavailable"
                                        )
                                    }
                                </div>

                            </div>

                            <button
                                class="remove-saved"
                                data-remove-index="${index}"
                                aria-label="Remove saved property"
                            >
                                ✕
                            </button>

                        </div>

                    `
                )
                .join("");


        openPage(
            "Saved Properties",
            html,
            "SAVED PROPERTIES"
        );


        document
            .querySelectorAll(
                "[data-saved-index]"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target
                                    .closest(
                                        ".remove-saved"
                                    )
                            ) {

                                return;

                            }


                            const index =
                                Number(
                                    element
                                        .dataset
                                        .savedIndex
                                );


                            openSavedProperty(
                                saved[index]
                            );

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-remove-index]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            const index =
                                Number(
                                    button
                                        .dataset
                                        .removeIndex
                                );


                            saved.splice(
                                index,
                                1
                            );


                            localStorage.setItem(
                                "parcelScopeSaved",
                                JSON.stringify(
                                    saved
                                )
                            );


                            showSavedProperties();

                        }
                    );

                }
            );

    }


    async function openSavedProperty(
        saved
    ) {

        appPage.classList.remove(
            "open"
        );


        closeMenuPanel();


        if (
            saved.latitude &&
            saved.longitude
        ) {

            map.setView(
                [
                    saved.latitude,
                    saved.longitude
                ],
                16
            );

        }


        searchInput.value =
            saved.parcelID;


        await performSearch();

    }


    /* =====================================================
       DATA SOURCES
    ===================================================== */

    function showDataSources() {

        openPage(
            "Data Sources",
            `

                <div class="page-section">

                    <h2>
                        Property & Parcel Data
                    </h2>

                    <p>
                        ParcelScope uses the Public Idaho
                        Parcels statewide GIS service. The
                        service contains standardized parcel
                        polygons and public property attributes
                        supplied through Idaho's statewide
                        parcel data program.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Idaho State & County Boundaries
                    </h2>

                    <p>
                        State and county boundary layers come
                        from the Idaho Transportation Department's
                        public Political Boundaries GIS service.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Satellite Imagery
                    </h2>

                    <p>
                        Satellite imagery is provided by
                        Esri World Imagery.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Standard Map
                    </h2>

                    <p>
                        The standard road map uses
                        OpenStreetMap data.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Data Updates
                    </h2>

                    <p>
                        Parcel data is maintained by the
                        participating county data providers
                        and updated as new statewide data is
                        received. ParcelScope requests the
                        current public GIS data whenever the
                        application starts and when you manually
                        refresh the site.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Important Notice
                    </h2>

                    <p>
                        ParcelScope displays public GIS
                        information. The underlying records
                        belong to their respective data
                        providers. Property information can
                        change and should be verified with
                        the appropriate county or government
                        agency when accuracy is important.
                    </p>

                </div>

            `,
            "DATA SOURCES"
        );

    }


    /* =====================================================
       UPDATE HISTORY
    ===================================================== */

    function getLastRefresh() {

        return localStorage.getItem(
            "parcelScopeLastRefresh"
        );

    }


    function setLastRefresh() {

        const now =
            new Date().toLocaleString();


        localStorage.setItem(
            "parcelScopeLastRefresh",
            now
        );

    }


    function showUpdateHistory() {

        const last =
            getLastRefresh() ||
            "This is the first refresh.";


        openPage(
            "Update History",
            `

                <div class="page-section">

                    <div class="last-refresh">

                        Last site refresh:
                        <strong>
                            ${escapeHTML(last)}
                        </strong>

                    </div>


                    <button
                        id="refreshNowButton"
                        class="refresh-button"
                    >
                        ↻ Refresh Now
                    </button>

                </div>


                <div class="page-section">

                    <h2>
                        Automatic Refresh
                    </h2>

                    <p>
                        ParcelScope requests fresh public
                        GIS information when the application
                        opens.
                    </p>

                </div>

            `,
            "UPDATE HISTORY"
        );


        document
            .getElementById(
                "refreshNowButton"
            )
            .addEventListener(
                "click",
                () => {

                    setLastRefresh();

                    loadBoundaryLayers();

                    loadParcels();

                    showUpdateHistory();

                }
            );

    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function showSettings() {

        openPage(
            "Settings",
            `

                <div class="setting-group">

                    <h2>
                        Map Style
                    </h2>


                    <div class="setting-row">

                        <div>

                            <div class="setting-name">
                                🛰️ Satellite
                            </div>

                            <div class="setting-description">
                                Aerial satellite imagery
                            </div>

                        </div>

                        <button
                            class="toggle ${
                                settings.mapStyle ===
                                "satellite"
                                    ? "on"
                                    : ""
                            }"
                            data-map-style="satellite"
                        ></button>

                    </div>


                    <div class="setting-row">

                        <div>

                            <div class="setting-name">
                                🗺️ Standard
                            </div>

                            <div class="setting-description">
                                Normal road and place map
                            </div>

                        </div>

                        <button
                            class="toggle ${
                                settings.mapStyle ===
                                "standard"
                                    ? "on"
                                    : ""
                            }"
                            data-map-style="standard"
                        ></button>

                    </div>

                </div>


                <div class="setting-group">

                    <h2>
                        Map Layers
                    </h2>


                    ${createToggle(
                        "parcels",
                        "🏠 Parcel Boundaries",
                        "Property parcel outlines",
                        settings.parcels
                    )}


                    ${createToggle(
                        "counties",
                        "🏛️ County Boundaries",
                        "Idaho county lines",
                        settings.counties
                    )}


                    ${createToggle(
                        "idaho",
                        "🟦 Idaho State Boundary",
                        "Official Idaho outline",
                        settings.idaho
                    )}

                </div>

            `,
            "SETTINGS"
        );


        document
            .querySelectorAll(
                "[data-map-style]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            setMapStyle(
                                button
                                    .dataset
                                    .mapStyle
                            );

                            showSettings();

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-layer-toggle]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const layer =
                                button
                                    .dataset
                                    .layerToggle;


                            settings[layer] =
                                !settings[layer];


                            saveSettings();


                            if (
                                layer ===
                                "parcels"
                            ) {

                                if (
                                    settings.parcels
                                ) {

                                    loadParcels();

                                } else if (
                                    parcelLayer
                                ) {

                                    map.removeLayer(
                                        parcelLayer
                                    );

                                }

                            }


                            if (
                                layer ===
                                "counties" ||
                                layer ===
                                "idaho"
                            ) {

                                updateBoundaryVisibility();

                            }


                            showSettings();

                        }
                    );

                }
            );

    }


    function createToggle(
        key,
        name,
        description,
        enabled
    ) {

        return `

            <div class="setting-row">

                <div>

                    <div class="setting-name">
                        ${name}
                    </div>

                    <div class="setting-description">
                        ${description}
                    </div>

                </div>

                <button
                    class="toggle ${
                        enabled
                            ? "on"
                            : ""
                    }"
                    data-layer-toggle="${key}"
                ></button>

            </div>

        `;

    }


    function setMapStyle(
        style
    ) {

        settings.mapStyle =
            style;


        if (
            style ===
            "satellite"
        ) {

            if (
                map.hasLayer(
                    standardLayer
                )
            ) {

                map.removeLayer(
                    standardLayer
                );

            }


            satelliteLayer.addTo(
                map
            );

        } else {

            if (
                map.hasLayer(
                    satelliteLayer
                )
            ) {

                map.removeLayer(
                    satelliteLayer
                );

            }


            standardLayer.addTo(
                map
            );

        }


        saveSettings();

    }


    /* =====================================================
       ABOUT
    ===================================================== */

    function showAbout() {

        openPage(
            "About ParcelScope",
            `

                <div class="page-section">

                    <h2>
                        Idaho Property Research
                    </h2>

                    <p>
                        ParcelScope Idaho is a public-data
                        property research tool designed to make
                        it easier to explore property information
                        across Idaho.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        What You Can Do
                    </h2>

                    <ul>

                        <li>
                            Explore Idaho property parcels
                            on an interactive map.
                        </li>

                        <li>
                            View property boundaries.
                        </li>

                        <li>
                            Select individual parcels.
                        </li>

                        <li>
                            Search by owner, address,
                            or parcel ID.
                        </li>

                        <li>
                            View available ownership and
                            property information.
                        </li>

                        <li>
                            Explore county boundaries.
                        </li>

                        <li>
                            Save properties for later.
                        </li>

                    </ul>

                </div>


                <div class="page-section">

                    <h2>
                        Data & Accuracy
                    </h2>

                    <p>
                        ParcelScope uses publicly available
                        GIS and property information from
                        Idaho public GIS sources.
                    </p>

                    <p>
                        Property information may change as
                        counties update their records.
                        ParcelScope displays information from
                        those sources and does not independently
                        verify the underlying records.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Map Information
                    </h2>

                    <p>
                        Satellite imagery:
                        Esri World Imagery
                    </p>

                    <p>
                        Standard map:
                        OpenStreetMap
                    </p>

                    <p>
                        Boundary data:
                        Idaho Transportation Department
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Important Notice
                    </h2>

                    <p>
                        ParcelScope is a property research
                        interface and is not a county assessor.
                        Information shown by the application
                        should be verified with the appropriate
                        official government agency when an
                        official record is required.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Version
                    </h2>

                    <p>
                        ParcelScope Idaho — Version 1.0
                    </p>

                </div>

            `,
            "ABOUT PARCELSCOPE"
        );

    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function cleanValue(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }

        return String(value).trim();

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }


    function setStatus(
        text
    ) {

        mapStatusText.textContent =
            text;

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    setMapStyle(
        settings.mapStyle
    );


    setLastRefresh();


    setStatus(
        "Loading Idaho GIS data..."
    );


    loadBoundaryLayers();


    /*
     * Load parcel data when the app opens.
     * It will wait until the user zooms in enough
     * to avoid downloading the entire state's parcels.
     */

    loadParcels();


    window.addEventListener(
        "resize",
        () => {

            setTimeout(
                () => {

                    map.invalidateSize();

                },
                200
            );

        }
    );


    console.log(
        "ParcelScope Idaho initialized."
    );

});
