/* =========================================================
   PARCELSCOPE IDAHO
   NEW PARCEL ENGINE
   - Direct Idaho statewide parcel layer
   - JSON ArcGIS queries
   - Automatic layer validation
   - Paginated searches
   - Point parcel identification
   - Viewport parcel loading
   - Local caching
   - Original jokes preserved
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

    const mapStatusText = document.getElementById("mapStatusText");

    const appPage = document.getElementById("appPage");
    const appPageTitle = document.getElementById("appPageTitle");
    const appPageKicker = document.getElementById("appPageKicker");
    const appPageContent = document.getElementById("appPageContent");
    const closeAppPage = document.getElementById("closeAppPage");


    /* =====================================================
       VERIFIED IDAHO PARCEL SERVICE
    ===================================================== */

    const PARCEL_SERVICE =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer";

    const PARCEL_LAYER =
        `${PARCEL_SERVICE}/7`;

    const COUNTY_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/2";

    const IDAHO_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/3";


    /* =====================================================
       MAP
    ===================================================== */

    const map = L.map("map", {
        zoomControl: true,
        attributionControl: true,
        minZoom: 4,
        maxZoom: 19,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 180
    });

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

    map.setView([44.0682, -114.7420], 6);


    /* =====================================================
       STATE
    ===================================================== */

    let parcelLayer = null;
    let selectedParcelLayer = null;

    let countyLayer = null;
    let idahoLayer = null;

    let selectedParcelID = null;

    let parcelRequestController = null;

    let viewportTimer = null;

    let layerInfo = null;

    let parcelCache = new Map();

    let searchCache = new Map();

    let pointCache = new Map();


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

            const saved = JSON.parse(
                localStorage.getItem(
                    "parcelScopeSettings"
                )
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
       STATUS
    ===================================================== */

    function setStatus(text) {

        if (mapStatusText) {
            mapStatusText.textContent = text;
        }
    }


    /* =====================================================
       GLITCH MESSAGE
       ORIGINAL JOKES PRESERVED
    ===================================================== */

    const glitchStyle =
        document.createElement("style");

    glitchStyle.textContent = `
        #parcelScopeGlitchWarning {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 999999;
            pointer-events: none;
            display: none;
            width: 100%;
            text-align: center;
            padding: 0 15px;
            font-family: "Courier New", monospace;
            font-weight: 900;
            font-size: clamp(24px, 6vw, 80px);
            line-height: 0.9;
            letter-spacing: 2px;
            color: white;
            text-shadow:
                -5px 0 #ff003c,
                5px 0 #00eaff,
                0 0 10px #ffffff;
            mix-blend-mode: screen;
        }

        #parcelScopeGlitchWarning.show {
            display: block;
            animation:
                parcelScopeGlitch 0.12s
                infinite steps(2);
        }

        @keyframes parcelScopeGlitch {

            0% {
                transform:
                    translate(-50%, -50%)
                    skewX(0deg);
            }

            25% {
                transform:
                    translate(
                        calc(-50% - 7px),
                        calc(-50% + 2px)
                    )
                    skewX(-4deg);
            }

            50% {
                transform:
                    translate(
                        calc(-50% + 6px),
                        calc(-50% - 2px)
                    )
                    skewX(4deg);
            }

            75% {
                transform:
                    translate(
                        calc(-50% - 3px),
                        calc(-50% + 1px)
                    )
                    skewX(-2deg);
            }

            100% {
                transform:
                    translate(-50%, -50%)
                    skewX(0deg);
            }
        }
    `;

    document.head.appendChild(
        glitchStyle
    );

    const glitchWarning =
        document.createElement("div");

    glitchWarning.id =
        "parcelScopeGlitchWarning";

    document.body.appendChild(
        glitchWarning
    );

    let glitchTimeout = null;

    function showGlitchMessage(
        message,
        duration = 3200
    ) {

        clearTimeout(
            glitchTimeout
        );

        glitchWarning.textContent =
            message;

        glitchWarning.classList.add(
            "show"
        );

        glitchTimeout =
            setTimeout(
                () => {
                    glitchWarning.classList.remove(
                        "show"
                    );
                },
                duration
            );
    }


    /* =====================================================
       RANDOM JOKES
       DO NOT CHANGE
    ===================================================== */

    function maybeShowPropertyJoke() {

        const random = Math.random();

        if (random < 0.001) {

            showGlitchMessage(
                "CONGRATS — YOU FOUND DIRT",
                4200
            );

            return;
        }

        if (random < 0.002) {

            const places = [
                "SOME PLACE IN IDAHO",
                "PROBABLY IDAHO",
                "SOMEWHERE IN IDAHO",
                "AN EXTREMELY IDAHO PLACE",
                "IDAHO™",
                "YOU FOUND... IDAHO"
            ];

            showGlitchMessage(
                places[
                    Math.floor(
                        Math.random() *
                        places.length
                    )
                ],
                4200
            );
        }
    }


    /* =====================================================
       MENU
    ===================================================== */

    function openMenu() {

        sideMenu?.classList.add(
            "open"
        );
    }

    function closeMenuPanel() {

        sideMenu?.classList.remove(
            "open"
        );
    }

    menuButton?.addEventListener(
        "click",
        () => {

            if (
                sideMenu.classList.contains(
                    "open"
                )
            ) {
                closeMenuPanel();
            } else {
                openMenu();
            }
        }
    );

    closeMenu?.addEventListener(
        "click",
        closeMenuPanel
    );


    /* =====================================================
       CLOSE BUTTONS
    ===================================================== */

    closeProperty?.addEventListener(
        "click",
        () => {

            propertyPanel.classList.remove(
                "open"
            );

            clearSelectedParcel();
        }
    );

    closeResults?.addEventListener(
        "click",
        () => {

            searchResults.classList.remove(
                "open"
            );
        }
    );

    closeAppPage?.addEventListener(
        "click",
        () => {

            appPage.classList.remove(
                "open"
            );
        }
    );


    /* =====================================================
       GENERIC PAGE
    ===================================================== */

    function openPage(
        title,
        content,
        kicker = "PARCELSCOPE"
    ) {

        appPageKicker.textContent =
            kicker;

        appPageTitle.textContent =
            title;

        appPageContent.innerHTML =
            content;

        appPage.classList.add(
            "open"
        );

        closeMenuPanel();
    }


    /* =====================================================
       GENERIC FETCH
    ===================================================== */

    async function fetchJSON(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    cache: "no-store",
                    ...options
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (data.error) {

            throw new Error(
                data.error.message ||
                "ArcGIS error"
            );
        }

        return data;
    }


    /* =====================================================
       LOAD REAL LAYER INFORMATION
    ===================================================== */

    async function initializeParcelLayer() {

        try {

            setStatus(
                "Connecting to Idaho parcel database..."
            );

            layerInfo =
                await fetchJSON(
                    PARCEL_LAYER
                );

            if (
                !layerInfo ||
                !Array.isArray(
                    layerInfo.fields
                )
            ) {

                throw new Error(
                    "Parcel layer schema unavailable"
                );
            }

            console.log(
                "Parcel layer loaded:",
                layerInfo
            );

            setStatus(
                "Idaho parcel database connected"
            );

            return true;

        } catch (error) {

            console.error(
                "Parcel layer initialization failed:",
                error
            );

            setStatus(
                "Unable to connect to Idaho parcel database"
            );

            return false;
        }
    }


    /* =====================================================
       FIELD CHECK
    ===================================================== */

    function fieldExists(name) {

        if (!layerInfo?.fields) {
            return false;
        }

        return layerInfo.fields.some(
            field =>
                field.name === name
        );
    }


    function getAvailableFields() {

        const wanted = [

            "OBJECTID",
            "PARCEL_ID",
            "STEWARD",
            "County",
            "UPDATED",
            "WEBSITE",
            "FIPS",
            "ASR_ACRES",
            "LAT_DD",
            "LONG_DD",
            "OWNER1",
            "OWNER2",
            "PUBLIC_STD",
            "MAIL_ADD1",
            "MAIL_ADD2",
            "MAIL_CITY",
            "MAIL_STATE",
            "MAIL_ZIP",
            "MAIL_CNTRY",
            "SITE_ADD",
            "SITE_CITY",
            "SITE_ZIP",
            "ASR_CATS",
            "LGL_DESCR",
            "VAL_LAND",
            "VAL_IMPVTS",
            "VAL_TOTAL",
            "HOME_EXMPT",
            "FP_ID"
        ];

        return wanted.filter(
            fieldExists
        );
    }


    /* =====================================================
       NORMALIZE ARC GIS FEATURE
    ===================================================== */

    function normalizeFeature(
        feature
    ) {

        if (!feature) {
            return null;
        }

        const attributes =
            feature.attributes ||
            {};

        return {

            type: "Feature",

            properties: {
                ...attributes
            },

            geometry:
                arcGISGeometryToGeoJSON(
                    feature.geometry
                )
        };
    }


    /* =====================================================
       ARC GIS GEOMETRY → GEOJSON
    ===================================================== */

    function arcGISGeometryToGeoJSON(
        geometry
    ) {

        if (!geometry) {
            return null;
        }

        /*
         * Polygon
         */

        if (
            Array.isArray(
                geometry.rings
            )
        ) {

            return {
                type: "Polygon",
                coordinates:
                    geometry.rings.map(
                        ring =>
                            ring.map(
                                point => [
                                    point[0],
                                    point[1]
                                ]
                            )
                    )
            };
        }

        /*
         * Point
         */

        if (
            typeof geometry.x ===
                "number" &&
            typeof geometry.y ===
                "number"
        ) {

            return {
                type: "Point",
                coordinates: [
                    geometry.x,
                    geometry.y
                ]
            };
        }

        /*
         * Polyline
         */

        if (
            Array.isArray(
                geometry.paths
            )
        ) {

            return {
                type: "MultiLineString",
                coordinates:
                    geometry.paths
            };
        }

        return null;
    }


    /* =====================================================
       GEOJSON → LEAFLET
    ===================================================== */

    function featureCollection(
        features
    ) {

        return {
            type: "FeatureCollection",
            features
        };
    }


    /* =====================================================
       PARCEL ID
    ===================================================== */

    function getParcelID(
        feature
    ) {

        const p =
            feature?.properties ||
            {};

        return (
            cleanValue(
                p.PARCEL_ID
            ) ||
            cleanValue(
                p.FP_ID
            ) ||
            cleanValue(
                p.OBJECTID
            )
        );
    }


    /* =====================================================
       VIEWPORT QUERY
    ===================================================== */

    async function queryViewport(
        bounds,
        signal
    ) {

        const fields =
            getAvailableFields();

        const params =
            new URLSearchParams({

                where:
                    "1=1",

                geometry:
                    [
                        bounds.getWest(),
                        bounds.getSouth(),
                        bounds.getEast(),
                        bounds.getNorth()
                    ].join(","),

                geometryType:
                    "esriGeometryEnvelope",

                inSR:
                    "4326",

                spatialRel:
                    "esriSpatialRelIntersects",

                outFields:
                    fields.join(","),

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultType:
                    "tile",

                resultRecordCount:
                    "2000",

                f:
                    "json"
            });

        const data =
            await fetchJSON(
                `${PARCEL_LAYER}/query?${params.toString()}`,
                {
                    signal
                }
            );

        return (
            Array.isArray(
                data.features
            )
                ? data.features
                    .map(normalizeFeature)
                    .filter(Boolean)
                : []
        );
    }


    /* =====================================================
       LOAD PARCELS
    ===================================================== */

    async function loadParcels(
        force = false
    ) {

        if (!settings.parcels) {

            clearParcelDisplay();

            setStatus(
                "Parcel boundaries disabled"
            );

            return;
        }

        if (!layerInfo) {

            return;
        }

        const zoom =
            map.getZoom();

        if (zoom < 11) {

            clearParcelDisplay();

            setStatus(
                "Zoom in further to view parcel boundaries"
            );

            return;
        }

        if (parcelRequestController) {

            parcelRequestController.abort();
        }

        parcelRequestController =
            new AbortController();

        const signal =
            parcelRequestController.signal;

        const bounds =
            map.getBounds();

        const cacheKey =
            [
                bounds.getWest().toFixed(4),
                bounds.getSouth().toFixed(4),
                bounds.getEast().toFixed(4),
                bounds.getNorth().toFixed(4),
                zoom
            ].join("|");

        if (
            !force &&
            parcelCache.has(cacheKey)
        ) {

            drawParcels(
                parcelCache.get(
                    cacheKey
                )
            );

            return;
        }

        setStatus(
            "Loading parcel boundaries..."
        );

        try {

            const features =
                await queryViewport(
                    bounds,
                    signal
                );

            if (
                signal.aborted
            ) {
                return;
            }

            const unique =
                dedupeFeatures(
                    features
                );

            if (unique.length) {

                parcelCache.set(
                    cacheKey,
                    unique
                );

                /*
                 * Keep cache from becoming enormous.
                 */

                if (
                    parcelCache.size > 30
                ) {

                    const firstKey =
                        parcelCache.keys()
                            .next()
                            .value;

                    parcelCache.delete(
                        firstKey
                    );
                }

                drawParcels(
                    unique
                );

                setStatus(
                    `${unique.length.toLocaleString()} parcel boundaries loaded`
                );

            } else {

                clearParcelDisplay();

                setStatus(
                    "No parcel boundaries returned at this zoom"
                );
            }

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                return;
            }

            console.error(
                "Parcel viewport error:",
                error
            );

            setStatus(
                "Parcel data temporarily unavailable — try moving slightly"
            );
        }
    }


    /* =====================================================
       DRAW PARCELS
    ===================================================== */

    function drawParcels(
        features
    ) {

        clearParcelDisplay();

        if (!features.length) {
            return;
        }

        parcelLayer =
            L.geoJSON(
                featureCollection(
                    features
                ),
                {

                    style: {
                        color: "#ffffff",
                        weight: 0.8,
                        opacity: 0.8,
                        fillOpacity: 0
                    },

                    onEachFeature:
                        (
                            feature,
                            layer
                        ) => {

                            layer.on(
                                "click",
                                event => {

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

        parcelLayer.addTo(
            map
        );

        /*
         * Restore selected parcel.
         */

        if (
            selectedParcelID
        ) {

            parcelLayer.eachLayer(
                layer => {

                    if (
                        getParcelID(
                            layer.feature
                        ) ===
                        selectedParcelID
                    ) {

                        selectedParcelLayer =
                            layer;

                        highlightParcel(
                            layer
                        );
                    }
                }
            );
        }
    }


    /* =====================================================
       CLEAR PARCEL DISPLAY
    ===================================================== */

    function clearParcelDisplay() {

        if (parcelLayer) {

            map.removeLayer(
                parcelLayer
            );

            parcelLayer = null;
        }
    }


    /* =====================================================
       MAP MOVEMENT
    ===================================================== */

    map.on(
        "moveend",
        () => {

            clearTimeout(
                viewportTimer
            );

            viewportTimer =
                setTimeout(
                    () => {
                        loadParcels(
                            false
                        );
                    },
                    300
                );
        }
    );


    /* =====================================================
       POINT IDENTIFICATION
    ===================================================== */

    async function findParcelAtPoint(
        latlng
    ) {

        const key =
            [
                latlng.lat.toFixed(6),
                latlng.lng.toFixed(6)
            ].join(",");

        if (
            pointCache.has(key)
        ) {

            showParcel(
                pointCache.get(key)
            );

            return;
        }

        setStatus(
            "Finding property..."
        );

        try {

            const fields =
                getAvailableFields();

            const params =
                new URLSearchParams({

                    where:
                        "1=1",

                    geometry:
                        `${latlng.lng},${latlng.lat}`,

                    geometryType:
                        "esriGeometryPoint",

                    inSR:
                        "4326",

                    spatialRel:
                        "esriSpatialRelIntersects",

                    outFields:
                        fields.join(","),

                    returnGeometry:
                        "true",

                    outSR:
                        "4326",

                    resultRecordCount:
                        "1",

                    f:
                        "json"
                });

            const data =
                await fetchJSON(
                    `${PARCEL_LAYER}/query?${params.toString()}`
                );

            if (
                data.features &&
                data.features.length
            ) {

                const feature =
                    normalizeFeature(
                        data.features[0]
                    );

                pointCache.set(
                    key,
                    feature
                );

                showParcel(
                    feature
                );

                return;
            }

            showMapLocation(
                latlng
            );

        } catch (error) {

            console.error(
                "Point parcel lookup failed:",
                error
            );

            showMapLocation(
                latlng
            );
        }
    }


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on(
        "click",
        async event => {

            closeMenuPanel();

            if (
                map.getZoom() < 11
            ) {

                showMapLocation(
                    event.latlng
                );

                return;
            }

            await findParcelAtPoint(
                event.latlng
            );
        }
    );


    /* =====================================================
       SHOW MAP LOCATION
    ===================================================== */

    function showMapLocation(
        latlng
    ) {

        clearSelectedParcel();

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
                    No parcel was returned at this exact point.
                    Try clicking slightly inside the parcel.
                </div>

            </div>
        `;

        propertyPanel.classList.add(
            "open"
        );

        setStatus(
            "No parcel found at that point"
        );
    }


    /* =====================================================
       HIGHLIGHT
    ===================================================== */

    function highlightParcel(
        layer
    ) {

        if (
            !layer?.setStyle
        ) {
            return;
        }

        layer.setStyle({

            color: "#00e5ff",
            weight: 3,
            opacity: 1,
            fillColor: "#00e5ff",
            fillOpacity: 0.18

        });

        layer.bringToFront?.();
    }


    function clearSelectedParcel() {

        if (
            selectedParcelLayer &&
            selectedParcelLayer.setStyle
        ) {

            selectedParcelLayer.setStyle({

                color: "#ffffff",
                weight: 0.8,
                opacity: 0.8,
                fillOpacity: 0

            });
        }

        if (
            selectedParcelLayer &&
            selectedParcelLayer !==
                parcelLayer &&
            map.hasLayer(
                selectedParcelLayer
            )
        ) {

            map.removeLayer(
                selectedParcelLayer
            );
        }

        selectedParcelLayer = null;

        selectedParcelID = null;
    }


    /* =====================================================
       SHOW PARCEL
    ===================================================== */

    function showParcel(
        feature,
        sourceLayer = null
    ) {

        if (!feature) {
            return;
        }

        const p =
            feature.properties ||
            {};

        clearSelectedParcel();

        selectedParcelID =
            getParcelID(
                feature
            );

        maybeShowPropertyJoke();

        if (sourceLayer) {

            selectedParcelLayer =
                sourceLayer;

        } else if (
            feature.geometry
        ) {

            selectedParcelLayer =
                L.geoJSON(
                    feature,
                    {
                        style: {

                            color: "#00e5ff",
                            weight: 3,
                            opacity: 1,
                            fillColor: "#00e5ff",
                            fillOpacity: 0.18

                        }
                    }
                );

            selectedParcelLayer.addTo(
                map
            );
        }

        if (
            selectedParcelLayer
        ) {

            highlightParcel(
                selectedParcelLayer
            );
        }

        const owner =
            cleanValue(
                p.OWNER1
            ) ||
            cleanValue(
                p.OWNER2
            );

        const address = [

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
        .join(", ");

        const county =
            cleanValue(
                p.County
            );

        const acres =
            numericValue(
                p.ASR_ACRES
            );

        const assessed =
            numericValue(
                p.VAL_TOTAL
            );

        const parcelID =
            selectedParcelID ||
            "Unavailable";

        propertyTitle.textContent =
            owner ||
            "Property Record";

        propertyContent.innerHTML = `

            <div class="property-field">

                <div class="property-label">
                    Owner
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            owner ||
                            "Owner information unavailable"
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Additional Owner
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            cleanValue(
                                p.OWNER2
                            ) ||
                            "None listed"
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Property Address
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            address ||
                            "Address information unavailable"
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Parcel ID
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            parcelID
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    County
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            county ||
                            "County unavailable"
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Acreage
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            acres ||
                            "Unavailable"
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Total Assessed Value
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            assessed
                        )
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Mailing Address
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            buildMailingAddress(p)
                        ) ||
                            "Unavailable"
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Data Steward
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            cleanValue(
                                p.STEWARD
                            ) ||
                            "Idaho public parcel data"
                        )
                    }
                </div>

            </div>


            <button
                class="save-property"
                id="savePropertyButton"
            >
                Save Property
            </button>
        `;

        propertyPanel.classList.add(
            "open"
        );

        const saveButton =
            document.getElementById(
                "savePropertyButton"
            );

        saveButton?.addEventListener(
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

    searchButton?.addEventListener(
        "click",
        performSearch
    );

    searchInput?.addEventListener(
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

        const cacheKey =
            query.toLowerCase();

        resultsContent.innerHTML = `

            <div class="search-result">
                Searching Idaho parcel records...
            </div>

        `;

        searchResults.classList.add(
            "open"
        );

        setStatus(
            "Searching Idaho parcel records..."
        );

        try {

            let results;

            if (
                searchCache.has(
                    cacheKey
                )
            ) {

                results =
                    searchCache.get(
                        cacheKey
                    );

            } else {

                results =
                    await searchParcels(
                        query
                    );

                searchCache.set(
                    cacheKey,
                    results
                );
            }

            results =
                rankSearchResults(
                    results,
                    query
                );

            results =
                results.slice(
                    0,
                    50
                );

            renderSearchResults(
                results,
                query
            );

        } catch (error) {

            console.error(
                "Search error:",
                error
            );

            resultsContent.innerHTML = `

                <div class="search-result">

                    <div class="search-result-title">
                        Search temporarily unavailable
                    </div>

                    <div class="search-result-details">
                        Try the search again in a moment.
                    </div>

                </div>
            `;

            setStatus(
                "Search temporarily unavailable"
            );
        }
    }


    /* =====================================================
       SEARCH ENGINE
    ===================================================== */

    async function searchParcels(
        query
    ) {

        const safe =
            query.replaceAll(
                "'",
                "''"
            );

        const fields =
            getAvailableFields();

        /*
         * Search the fields that actually exist
         * in the verified Idaho layer.
         */

        const searchFields = [

            "PARCEL_ID",
            "FP_ID",
            "OWNER1",
            "OWNER2",
            "SITE_ADD",
            "SITE_CITY",
            "SITE_ZIP",
            "County"

        ].filter(
            fieldExists
        );

        const clauses =
            searchFields.map(
                field =>
                    `${field} LIKE '%${safe}%'`
            );

        const where =
            clauses.join(
                " OR "
            );

        const allResults = [];

        let offset = 0;

        const pageSize = 1000;

        /*
         * Pagination means we aren't stuck
         * with the old 50-result limitation.
         */

        while (
            allResults.length < 2000
        ) {

            const params =
                new URLSearchParams({

                    where,

                    outFields:
                        fields.join(","),

                    returnGeometry:
                        "true",

                    outSR:
                        "4326",

                    resultOffset:
                        String(offset),

                    resultRecordCount:
                        String(pageSize),

                    orderByFields:
                        "OWNER1 ASC",

                    f:
                        "json"
                });

            const data =
                await fetchJSON(
                    `${PARCEL_LAYER}/query?${params.toString()}`
                );

            const page =
                Array.isArray(
                    data.features
                )
                    ? data.features
                        .map(
                            normalizeFeature
                        )
                        .filter(Boolean)
                    : [];

            allResults.push(
                ...page
            );

            if (
                page.length <
                pageSize
            ) {
                break;
            }

            offset +=
                pageSize;

            if (
                offset >= 2000
            ) {
                break;
            }
        }

        return dedupeFeatures(
            allResults
        );
    }


    /* =====================================================
       RENDER SEARCH RESULTS
    ===================================================== */

    function renderSearchResults(
        results,
        query
    ) {

        if (!results.length) {

            resultsContent.innerHTML = `

                <div class="search-result">

                    <div class="search-result-title">
                        No properties found
                    </div>

                    <div class="search-result-details">
                        Try an owner name, street address,
                        parcel ID, PIN, city, or county.
                    </div>

                </div>
            `;

            setStatus(
                "No matching properties found"
            );

            return;
        }

        resultsContent.innerHTML =
            results.map(
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
                        cleanValue(
                            p.OWNER2
                        ) ||
                        "Owner information unavailable";

                    const address = [

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
                    .join(", ");

                    const county =
                        cleanValue(
                            p.County
                        );

                    const parcelID =
                        getParcelID(
                            feature
                        );

                    return `

                        <div
                            class="search-result"
                            data-result-index="${index}"
                        >

                            <div class="search-result-title">
                                ${escapeHTML(owner)}
                            </div>

                            <div class="search-result-details">

                                ${
                                    escapeHTML(
                                        address ||
                                        "Address unavailable"
                                    )
                                }

                                <br>

                                ${
                                    county
                                        ? escapeHTML(
                                            county
                                          ) +
                                          " County"
                                        : ""
                                }

                                <br>

                                Parcel:
                                ${
                                    escapeHTML(
                                        parcelID
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
                                    element.dataset
                                        .resultIndex
                                );

                            selectSearchResult(
                                results[index]
                            );
                        }
                    );
                }
            );

        setStatus(
            `${results.length} matching properties`
        );
    }


    /* =====================================================
       SEARCH RANKING
    ===================================================== */

    function rankSearchResults(
        features,
        query
    ) {

        const normalized =
            query
                .toLowerCase()
                .trim();

        function score(
            feature
        ) {

            const p =
                feature.properties ||
                {};

            const fields = [

                p.OWNER1,
                p.OWNER2,
                p.SITE_ADD,
                p.SITE_CITY,
                p.SITE_ZIP,
                p.PARCEL_ID,
                p.FP_ID,
                p.County

            ]
            .map(cleanValue)
            .filter(Boolean)
            .map(
                value =>
                    value.toLowerCase()
            );

            let total = 0;

            for (
                const value of fields
            ) {

                if (
                    value ===
                    normalized
                ) {

                    total +=
                        1000;

                } else if (
                    value.startsWith(
                        normalized
                    )
                ) {

                    total +=
                        500;

                } else if (
                    value.includes(
                        normalized
                    )
                ) {

                    total +=
                        100;
                }
            }

            return total;
        }

        return features.sort(
            (
                a,
                b
            ) =>
                score(b) -
                score(a)
        );
    }


    /* =====================================================
       SELECT SEARCH RESULT
    ===================================================== */

    function selectSearchResult(
        feature
    ) {

        searchResults.classList.remove(
            "open"
        );

        clearSelectedParcel();

        if (
            feature.geometry
        ) {

            const temp =
                L.geoJSON(
                    feature
                );

            const bounds =
                temp.getBounds();

            if (
                bounds.isValid()
            ) {

                map.fitBounds(
                    bounds,
                    {
                        padding: [
                            60,
                            60
                        ],
                        maxZoom: 17
                    }
                );
            }

            selectedParcelLayer =
                L.geoJSON(
                    feature,
                    {
                        style: {

                            color: "#00e5ff",
                            weight: 3,
                            opacity: 1,
                            fillColor: "#00e5ff",
                            fillOpacity: 0.18

                        }
                    }
                );

            selectedParcelLayer.addTo(
                map
            );

            selectedParcelID =
                getParcelID(
                    feature
                );
        }

        showParcel(
            feature,
            selectedParcelLayer
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
            feature.properties ||
            {};

        const parcelID =
            getParcelID(
                feature
            );

        if (!parcelID) {
            return;
        }

        const saved =
            getSavedProperties();

        if (
            saved.some(
                item =>
                    item.parcelID ===
                    parcelID
            )
        ) {

            openPage(
                "Saved Properties",
                `
                    <div class="page-card">

                        <strong>
                            Already Saved
                        </strong>

                        This property is already saved.

                    </div>
                `,
                "SAVED PROPERTIES"
            );

            return;
        }

        const center =
            feature.geometry
                ? getFeatureCenter(
                    feature.geometry
                  )
                : null;

        saved.push({

            parcelID,

            owner:
                cleanValue(
                    p.OWNER1
                ) ||
                cleanValue(
                    p.OWNER2
                ) ||
                "Owner unavailable",

            address: [

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
                center
                    ? center.lat
                    : null,

            longitude:
                center
                    ? center.lng
                    : null
        });

        localStorage.setItem(
            "parcelScopeSaved",
            JSON.stringify(
                saved
            )
        );

        propertyPanel.classList.remove(
            "open"
        );

        setStatus(
            "Property saved"
        );
    }


    function getFeatureCenter(
        geometry
    ) {

        try {

            const layer =
                L.geoJSON({

                    type: "Feature",

                    properties: {},

                    geometry

                });

            return layer
                .getBounds()
                .getCenter();

        } catch {

            return null;
        }
    }


    /* =====================================================
       BOUNDARIES
    ===================================================== */

    async function loadBoundaryLayers() {

        try {

            const [
                countyResponse,
                idahoResponse
            ] =
                await Promise.all([

                    fetch(
                        `${COUNTY_URL}/query?where=1%3D1&outFields=CountyName,CountyFIPS&returnGeometry=true&outSR=4326&f=geojson`
                    ),

                    fetch(
                        `${IDAHO_URL}/query?where=1%3D1&outFields=Name,NameAbbr&returnGeometry=true&outSR=4326&f=geojson`
                    )

                ]);

            if (
                !countyResponse.ok ||
                !idahoResponse.ok
            ) {

                throw new Error(
                    "Boundary request failed"
                );
            }

            const countyGeoJSON =
                await countyResponse.json();

            const idahoGeoJSON =
                await idahoResponse.json();

            countyLayer =
                L.geoJSON(
                    countyGeoJSON,
                    {

                        style: {

                            color: "#d7a84a",
                            weight: 1.2,
                            opacity: 0.9,
                            fillOpacity: 0

                        },

                        onEachFeature:
                            (
                                feature,
                                layer
                            ) => {

                                const name =
                                    feature
                                        .properties
                                        ?.CountyName ||
                                    "County";

                                layer.bindTooltip(
                                    name,
                                    {
                                        sticky: true,
                                        direction: "center"
                                    }
                                );
                            }
                    }
                );

            idahoLayer =
                L.geoJSON(
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

        if (
            !countyLayer ||
            !idahoLayer
        ) {
            return;
        }

        if (
            settings.counties &&
            !map.hasLayer(
                countyLayer
            )
        ) {

            countyLayer.addTo(
                map
            );
        }

        if (
            !settings.counties &&
            map.hasLayer(
                countyLayer
            )
        ) {

            map.removeLayer(
                countyLayer
            );
        }

        if (
            settings.idaho &&
            !map.hasLayer(
                idahoLayer
            )
        ) {

            idahoLayer.addTo(
                map
            );
        }

        if (
            !settings.idaho &&
            map.hasLayer(
                idahoLayer
            )
        ) {

            map.removeLayer(
                idahoLayer
            );
        }
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
                            button.dataset
                                .section;

                        if (
                            section
                        ) {

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

        switch (
            section
        ) {

            case "counties":
                showCounties();
                break;

            case "saved":
                showSavedProperties();
                break;

            case "sources":
                showDataSources();
                break;

            case "history":
                showUpdateHistory();
                break;

            case "settings":
                showSettings();
                break;

            case "about":
                showAbout();
                break;
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

        openPage(
            "Counties",

            `
                <div class="page-section">

                    <p>
                        Search for an Idaho county or
                        select one below.
                    </p>

                </div>

                <div class="county-search">

                    <input
                        id="countySearchInput"
                        type="search"
                        placeholder="Search counties..."
                        autocomplete="off"
                    >

                </div>

                <div
                    id="countyList"
                    class="county-grid"
                >

                    ${
                        counties
                            .map(
                                county =>
                                    `
                                    <button
                                        class="county-button"
                                        data-county="${escapeHTML(
                                            county
                                        )}"
                                    >
                                        ${escapeHTML(
                                            county
                                        )}
                                        County
                                    </button>
                                    `
                            )
                            .join("")
                    }

                </div>
            `,

            "IDAHO COUNTIES"
        );

        const input =
            document.getElementById(
                "countySearchInput"
            );

        input?.addEventListener(
            "input",
            () => {

                const query =
                    input.value
                        .trim()
                        .toLowerCase();

                document
                    .querySelectorAll(
                        ".county-button"
                    )
                    .forEach(
                        button => {

                            const name =
                                button.dataset
                                    .county
                                    .toLowerCase();

                            button.style.display =
                                !query ||
                                name.includes(
                                    query
                                )
                                    ? ""
                                    : "none";
                        }
                    );
            }
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
                                button.dataset
                                    .county
                            );
                        }
                    );
                }
            );
    }


    async function selectCounty(
        county
    ) {

        closeMenuPanel();

        if (!countyLayer) {

            appPage.classList.remove(
                "open"
            );

            return;
        }

        let found = false;

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

        appPage.classList.remove(
            "open"
        );

        if (found) {

            setStatus(
                `${county} County selected`
            );
        }
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

                        Select a property and press
                        "Save Property" to add it here.

                    </div>
                `,

                "SAVED PROPERTIES"
            );

            return;
        }

        const html =
            saved.map(
                (
                    item,
                    index
                ) =>
                    `

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
                        >
                            X
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
                                event.target.closest(
                                    ".remove-saved"
                                )
                            ) {
                                return;
                            }

                            const index =
                                Number(
                                    element.dataset
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
                                    button.dataset
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
                        Idaho Statewide Parcel Framework
                    </h2>

                    <p>
                        ParcelScope uses the official
                        Public Idaho Parcels statewide
                        standardized parcel layer.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Parcel Information
                    </h2>

                    <p>
                        Available records can include
                        parcel ID, owner, address, county,
                        acreage, mailing information,
                        and assessed value.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Satellite Imagery
                    </h2>

                    <p>
                        Esri World Imagery.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Standard Map
                    </h2>

                    <p>
                        OpenStreetMap.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Important Notice
                    </h2>

                    <p>
                        ParcelScope displays public GIS
                        information. Records can change and
                        should be verified with the appropriate
                        county or government agency when an
                        official record is required.
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

        localStorage.setItem(
            "parcelScopeLastRefresh",
            new Date().toLocaleString()
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
                        Refresh Now
                    </button>

                </div>
            `,

            "UPDATE HISTORY"
        );

        document
            .getElementById(
                "refreshNowButton"
            )
            ?.addEventListener(
                "click",
                async () => {

                    setLastRefresh();

                    parcelCache.clear();

                    searchCache.clear();

                    pointCache.clear();

                    await initializeParcelLayer();

                    await loadBoundaryLayers();

                    await loadParcels(
                        true
                    );

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
                                Satellite
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
                                Standard
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
                        "Parcel Boundaries",
                        "Property parcel outlines",
                        settings.parcels
                    )}

                    ${createToggle(
                        "counties",
                        "County Boundaries",
                        "Idaho county lines",
                        settings.counties
                    )}

                    ${createToggle(
                        "idaho",
                        "Idaho State Boundary",
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
                                button.dataset
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
                        async () => {

                            const layer =
                                button.dataset
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

                                    await loadParcels(
                                        true
                                    );

                                } else {

                                    if (
                                        parcelRequestController
                                    ) {

                                        parcelRequestController.abort();
                                    }

                                    clearParcelDisplay();
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
                        property research tool for exploring
                        property parcels and available public
                        property information across Idaho.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        What You Can Do
                    </h2>

                    <ul>

                        <li>
                            Explore Idaho property parcels.
                        </li>

                        <li>
                            View parcel boundaries.
                        </li>

                        <li>
                            Select individual properties.
                        </li>

                        <li>
                            Search by owner, address,
                            parcel ID, or PIN.
                        </li>

                        <li>
                            View available property information.
                        </li>

                        <li>
                            Explore counties.
                        </li>

                        <li>
                            Save properties for later.
                        </li>

                    </ul>

                </div>

                <div class="page-section">

                    <h2>
                        Accuracy
                    </h2>

                    <p>
                        ParcelScope displays information from
                        public GIS sources and does not
                        independently verify the underlying
                        records.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Version
                    </h2>

                    <p>
                        ParcelScope Idaho — Version 2.0
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

        return String(
            value
        ).trim();
    }


    function numericValue(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return "";
        }

        const number =
            Number(value);

        if (
            Number.isNaN(
                number
            )
        ) {

            return "";
        }

        return number.toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );
    }


    function buildMailingAddress(
        p
    ) {

        return [

            cleanValue(
                p.MAIL_ADD1
            ),

            cleanValue(
                p.MAIL_ADD2
            ),

            cleanValue(
                p.MAIL_CITY
            ),

            cleanValue(
                p.MAIL_STATE
            ),

            cleanValue(
                p.MAIL_ZIP
            )

        ]
        .filter(Boolean)
        .join(", ");
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


    function dedupeFeatures(
        features
    ) {

        const unique =
            new Map();

        for (
            const feature of features
        ) {

            const id =
                getParcelID(
                    feature
                );

            if (!id) {
                continue;
            }

            if (
                !unique.has(id)
            ) {

                unique.set(
                    id,
                    feature
                );
            }
        }

        return Array.from(
            unique.values()
        );
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    setMapStyle(
        settings.mapStyle
    );

    setLastRefresh();

    setStatus(
        "Starting ParcelScope..."
    );

    /*
     * Initialize the actual parcel database first.
     */

    (async () => {

        const parcelReady =
            await initializeParcelLayer();

        await loadBoundaryLayers();

        if (
            parcelReady
        ) {

            /*
             * Don't hammer the service while
             * the map is zoomed way out.
             */

            setTimeout(
                () => {

                    loadParcels(
                        false
                    );

                },
                500
            );
        }

    })();


    /* =====================================================
       RESIZE
    ===================================================== */

    let resizeTimer = null;

    window.addEventListener(
        "resize",
        () => {

            clearTimeout(
                resizeTimer
            );

            resizeTimer =
                setTimeout(
                    () => {

                        map.invalidateSize();

                    },
                    200
                );
        }
    );


    console.log(
        "ParcelScope Idaho — NEW direct statewide parcel engine initialized."
    );

});
