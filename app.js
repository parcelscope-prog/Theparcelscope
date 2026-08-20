/* =========================================================
   PARCELSCOPE IDAHO
   STABLE PARCEL ENGINE
   PRIMARY + IDWR FALLBACK
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
       DATA SOURCES
    ===================================================== */

    const PRIMARY_URL =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";

    const SECONDARY_URL =
        "https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0";

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
       LAYERS / STATE
    ===================================================== */

    let countyLayer = null;
    let idahoLayer = null;
    let parcelLayer = null;
    let selectedParcelLayer = null;

    let selectedParcelID = null;

    let parcelAbortController = null;

    let parcelLoadTimer = null;
    let resizeTimer = null;

    let requestGeneration = 0;

    const parcelCache = new Map();

    const pointLookupCache = new Map();


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
                localStorage.getItem("parcelScopeSettings")
            );

            return {
                ...defaultSettings,
                ...(saved || {})
            };

        } catch {
            return { ...defaultSettings };
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
    ===================================================== */

    const glitchStyle = document.createElement("style");

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

    document.head.appendChild(glitchStyle);

    const glitchWarning = document.createElement("div");
    glitchWarning.id = "parcelScopeGlitchWarning";
    document.body.appendChild(glitchWarning);

    let glitchTimeout = null;

    function showGlitchMessage(message, duration = 3200) {

        clearTimeout(glitchTimeout);

        glitchWarning.textContent = message;
        glitchWarning.classList.add("show");

        glitchTimeout = setTimeout(() => {
            glitchWarning.classList.remove("show");
        }, duration);
    }


    /* =====================================================
       RANDOM JOKES
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
                        Math.random() * places.length
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
        sideMenu.classList.add("open");
    }

    function closeMenuPanel() {
        sideMenu.classList.remove("open");
    }

    menuButton?.addEventListener("click", () => {

        if (sideMenu.classList.contains("open")) {
            closeMenuPanel();
        } else {
            openMenu();
        }

    });

    closeMenu?.addEventListener(
        "click",
        closeMenuPanel
    );


    /* =====================================================
       PANEL CLOSES
    ===================================================== */

    closeProperty?.addEventListener("click", () => {
        propertyPanel.classList.remove("open");
        clearSelectedParcel();
    });

    closeResults?.addEventListener("click", () => {
        searchResults.classList.remove("open");
    });

    closeAppPage?.addEventListener("click", () => {
        appPage.classList.remove("open");
    });


    /* =====================================================
       FULL PAGE
    ===================================================== */

    function openPage(title, content, kicker = "PARCELSCOPE") {

        appPageKicker.textContent = kicker;
        appPageTitle.textContent = title;
        appPageContent.innerHTML = content;

        appPage.classList.add("open");

        closeMenuPanel();
    }


    /* =====================================================
       BOUNDARIES
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

            if (!countyResponse.ok ||
                !idahoResponse.ok) {

                throw new Error(
                    "Boundary request failed"
                );
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

                    onEachFeature: (feature, layer) => {

                        const name =
                            feature.properties?.CountyName ||
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
       FIELD NORMALIZATION
    ===================================================== */

    function normalizePrimaryFeature(feature) {

        const p = feature?.properties || {};

        return {
            ...feature,

            properties: {
                ...p,

                PARCEL_ID:
                    cleanValue(p.PARCEL_ID) ||
                    cleanValue(p.FP_ID) ||
                    cleanValue(p.PIN) ||
                    cleanValue(p.OBJECTID),

                OWNER1:
                    cleanValue(p.OWNER1) ||
                    cleanValue(p.OWNER),

                OWNER2:
                    cleanValue(p.OWNER2),

                County:
                    cleanValue(p.County) ||
                    cleanValue(p.COUNTY),

                SITE_ADD:
                    cleanValue(p.SITE_ADD),

                SITE_CITY:
                    cleanValue(p.SITE_CITY),

                SITE_ZIP:
                    cleanValue(p.SITE_ZIP),

                ASR_ACRES:
                    p.ASR_ACRES,

                VAL_TOTAL:
                    p.VAL_TOTAL,

                STEWARD:
                    cleanValue(p.STEWARD) ||
                    "Idaho public parcel data"
            }
        };
    }

    function normalizeSecondaryFeature(feature) {

        const p = feature?.properties || {};

        return {
            ...feature,

            properties: {

                OBJECTID:
                    p.OBJECTID,

                PARCEL_ID:
                    cleanValue(p.PIN) ||
                    cleanValue(p.OBJECTID),

                FP_ID:
                    cleanValue(p.PIN),

                PIN:
                    cleanValue(p.PIN),

                OWNER1:
                    cleanValue(p.OWNER),

                OWNER2:
                    "",

                County:
                    cleanValue(p.COUNTY),

                STEWARD:
                    "Idaho Department of Water Resources",

                UPDATED:
                    "",

                ASR_ACRES:
                    "",

                SITE_ADD:
                    "",

                SITE_CITY:
                    "",

                SITE_ZIP:
                    "",

                VAL_TOTAL:
                    ""
            }
        };
    }


    /* =====================================================
       PARCEL ID
    ===================================================== */

    function getParcelID(feature) {

        const p =
            feature?.properties || {};

        return (
            cleanValue(p.PARCEL_ID) ||
            cleanValue(p.FP_ID) ||
            cleanValue(p.PIN) ||
            cleanValue(p.OBJECTID)
        );
    }


    /* =====================================================
       REQUEST HELPERS
    ===================================================== */

    async function fetchJSON(url, signal) {

        const response = await fetch(
            url,
            {
                signal,
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (data?.error) {
            throw new Error(
                data.error.message ||
                "ArcGIS service error"
            );
        }

        return data;
    }


    function buildEnvelopeParams(
        bounds,
        fields
    ) {

        return new URLSearchParams({

            where: "1=1",

            geometry: [
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth()
            ].join(","),

            geometryType:
                "esriGeometryEnvelope",

            inSR: "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                fields,

            returnGeometry:
                "true",

            outSR:
                "4326",

            resultRecordCount:
                "1000",

            f:
                "geojson"
        });
    }


    /* =====================================================
       PRIMARY VIEWPORT QUERY
    ===================================================== */

    async function requestPrimaryParcels(
        bounds,
        signal
    ) {

        const fields = [
            "OBJECTID",
            "PARCEL_ID",
            "STEWARD",
            "County",
            "UPDATED",
            "OWNER1",
            "OWNER2",
            "ASR_ACRES",
            "SITE_ADD",
            "SITE_CITY",
            "SITE_ZIP",
            "VAL_TOTAL",
            "FP_ID"
        ].join(",");

        const params =
            buildEnvelopeParams(
                bounds,
                fields
            );

        const url =
            `${PRIMARY_URL}/query?${params.toString()}`;

        const data =
            await fetchJSON(
                url,
                signal
            );

        return (
            Array.isArray(data.features)
                ? data.features.map(
                    normalizePrimaryFeature
                  )
                : []
        );
    }


    /* =====================================================
       SECONDARY VIEWPORT QUERY
    ===================================================== */

    async function requestSecondaryParcels(
        bounds,
        signal
    ) {

        const params =
            buildEnvelopeParams(
                bounds,
                "OBJECTID,PIN,COUNTY,OWNER"
            );

        const url =
            `${SECONDARY_URL}/query?${params.toString()}`;

        const data =
            await fetchJSON(
                url,
                signal
            );

        return (
            Array.isArray(data.features)
                ? data.features.map(
                    normalizeSecondaryFeature
                  )
                : []
        );
    }


    /* =====================================================
       TILE GENERATION
    ===================================================== */

    function createParcelTiles(bounds) {

        const west =
            bounds.getWest();

        const east =
            bounds.getEast();

        const south =
            bounds.getSouth();

        const north =
            bounds.getNorth();

        const width =
            east - west;

        const height =
            north - south;

        const zoom =
            map.getZoom();

        let columns = 1;
        let rows = 1;

        /*
         * At high zoom one request is usually enough.
         * At medium zoom split into 4.
         * At lower parcel zoom split into 9.
         *
         * This prevents a single large request from
         * hitting ArcGIS record limits.
         */

        if (zoom >= 14) {

            columns = 1;
            rows = 1;

        } else if (zoom >= 11) {

            columns = 2;
            rows = 2;

        } else {

            columns = 3;
            rows = 3;
        }

        const tiles = [];

        for (let row = 0; row < rows; row++) {

            for (
                let column = 0;
                column < columns;
                column++
            ) {

                tiles.push(
                    L.latLngBounds(
                        [
                            south +
                            height *
                            row /
                            rows,

                            west +
                            width *
                            column /
                            columns
                        ],

                        [
                            south +
                            height *
                            (row + 1) /
                            rows,

                            west +
                            width *
                            (column + 1) /
                            columns
                        ]
                    )
                );
            }
        }

        return tiles;
    }


    /* =====================================================
       TILE KEY
    ===================================================== */

    function makeTileKey(bounds) {

        return [
            bounds.getWest().toFixed(5),
            bounds.getSouth().toFixed(5),
            bounds.getEast().toFixed(5),
            bounds.getNorth().toFixed(5)
        ].join("|");
    }


    /* =====================================================
       CLEAR PARCELS
    ===================================================== */

    function clearParcelDisplay() {

        if (parcelLayer) {

            map.removeLayer(parcelLayer);

            parcelLayer = null;
        }
    }


    /* =====================================================
       LOAD PARCELS
    ===================================================== */

    async function loadParcels(force = false) {

        if (!settings.parcels) {

            clearParcelDisplay();

            setStatus(
                "Parcel boundaries disabled"
            );

            return;
        }

        if (map.getZoom() < 9) {

            clearParcelDisplay();

            setStatus(
                "Zoom in to view parcel boundaries"
            );

            return;
        }

        /*
         * Cancel the previous viewport request.
         */

        if (parcelAbortController) {
            parcelAbortController.abort();
        }

        parcelAbortController =
            new AbortController();

        const signal =
            parcelAbortController.signal;

        const generation =
            ++requestGeneration;

        const bounds =
            map.getBounds();

        const tiles =
            createParcelTiles(bounds);

        const allFeatures = [];

        setStatus(
            "Loading parcel boundaries..."
        );

        /*
         * Only use cached data when the user has not
         * explicitly forced a refresh.
         */

        const cacheAllowed = !force;

        let completed = 0;

        /*
         * Two simultaneous requests.
         */

        let nextIndex = 0;

        async function worker() {

            while (
                nextIndex < tiles.length
            ) {

                if (signal.aborted) {
                    return;
                }

                if (
                    generation !==
                    requestGeneration
                ) {
                    return;
                }

                const index =
                    nextIndex++;

                const tile =
                    tiles[index];

                const tileKey =
                    makeTileKey(tile);

                if (
                    cacheAllowed &&
                    parcelCache.has(tileKey)
                ) {

                    const cached =
                        parcelCache.get(tileKey);

                    allFeatures.push(
                        ...cached
                    );

                    completed++;

                    setStatus(
                        `Loading parcels... ${completed}/${tiles.length}`
                    );

                    continue;
                }

                let features = [];

                /*
                 * PRIMARY
                 */

                try {

                    features =
                        await requestPrimaryParcels(
                            tile,
                            signal
                        );

                } catch (primaryError) {

                    if (
                        primaryError.name ===
                        "AbortError"
                    ) {
                        return;
                    }

                    console.warn(
                        "Primary parcel request failed:",
                        primaryError
                    );

                    /*
                     * FALLBACK
                     */

                    try {

                        features =
                            await requestSecondaryParcels(
                                tile,
                                signal
                            );

                    } catch (secondaryError) {

                        if (
                            secondaryError.name ===
                            "AbortError"
                        ) {
                            return;
                        }

                        console.warn(
                            "Secondary parcel request failed:",
                            secondaryError
                        );

                        features = [];
                    }
                }

                /*
                 * Only cache non-empty responses.
                 * This prevents temporary service failures
                 * from poisoning the cache.
                 */

                if (features.length > 0) {

                    parcelCache.set(
                        tileKey,
                        features
                    );

                    allFeatures.push(
                        ...features
                    );
                }

                completed++;

                setStatus(
                    `Loading parcels... ${completed}/${tiles.length}`
                );
            }
        }

        try {

            await Promise.all([
                worker(),
                worker()
            ]);

            if (
                signal.aborted ||
                generation !== requestGeneration
            ) {
                return;
            }

            /*
             * Deduplicate.
             */

            const unique =
                new Map();

            for (
                const feature of allFeatures
            ) {

                const id =
                    getParcelID(feature);

                if (!id) {
                    continue;
                }

                if (!unique.has(id)) {
                    unique.set(
                        id,
                        feature
                    );
                }
            }

            const features =
                Array.from(
                    unique.values()
                );

            /*
             * Empty result should not destroy a
             * previous successful parcel display.
             */

            if (!features.length) {

                if (parcelLayer) {

                    setStatus(
                        "No new parcels returned"
                    );

                } else {

                    setStatus(
                        "Parcel data unavailable — try moving slightly"
                    );
                }

                return;
            }

            const geojson = {
                type: "FeatureCollection",
                features
            };

            clearParcelDisplay();

            parcelLayer =
                L.geoJSON(
                    geojson,
                    {
                        style: {
                            color: "#ffffff",
                            weight: 0.7,
                            opacity: 0.75,
                            fillOpacity: 0
                        },

                        onEachFeature:
                            (feature, layer) => {

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

            parcelLayer.addTo(map);

            /*
             * Restore selected parcel highlight.
             */

            if (selectedParcelID) {

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

            setStatus(
                `${features.length.toLocaleString()} parcel boundaries loaded`
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
                "Parcel data unavailable — try moving slightly"
            );
        }
    }


    /* =====================================================
       MAP MOVEMENT
    ===================================================== */

    map.on("moveend", () => {

        clearTimeout(
            parcelLoadTimer
        );

        parcelLoadTimer =
            setTimeout(
                () => {
                    loadParcels(false);
                },
                250
            );
    });


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on("click", async event => {

        closeMenuPanel();

        if (
            map.getZoom() < 9
        ) {

            showMapLocation(
                event.latlng
            );

            return;
        }

        await findParcelAtPoint(
            event.latlng
        );
    });


    /* =====================================================
       POINT QUERY
    ===================================================== */

    async function queryPoint(
        url,
        fields,
        latlng,
        signal
    ) {

        const params =
            new URLSearchParams({

                where: "1=1",

                geometry:
                    `${latlng.lng},${latlng.lat}`,

                geometryType:
                    "esriGeometryPoint",

                inSR: "4326",

                spatialRel:
                    "esriSpatialRelIntersects",

                outFields:
                    fields,

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "1",

                f:
                    "geojson"
            });

        const data =
            await fetchJSON(
                `${url}/query?${params.toString()}`
            );

        return (
            Array.isArray(data.features)
                ? data.features
                : []
        );
    }


    async function findParcelAtPoint(latlng) {

        const cacheKey =
            `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;

        if (
            pointLookupCache.has(cacheKey)
        ) {

            const cached =
                pointLookupCache.get(
                    cacheKey
                );

            showParcel(
                cached
            );

            return;
        }

        setStatus(
            "Finding property..."
        );

        /*
         * PRIMARY
         */

        try {

            const features =
                await queryPoint(
                    PRIMARY_URL,
                    [
                        "OBJECTID",
                        "PARCEL_ID",
                        "STEWARD",
                        "County",
                        "UPDATED",
                        "OWNER1",
                        "OWNER2",
                        "ASR_ACRES",
                        "SITE_ADD",
                        "SITE_CITY",
                        "SITE_ZIP",
                        "VAL_TOTAL",
                        "FP_ID"
                    ].join(","),
                    latlng
                );

            if (features.length) {

                const feature =
                    normalizePrimaryFeature(
                        features[0]
                    );

                pointLookupCache.set(
                    cacheKey,
                    feature
                );

                showParcel(
                    feature
                );

                return;
            }

        } catch (error) {

            console.warn(
                "Primary point lookup failed:",
                error
            );
        }

        /*
         * SECONDARY
         */

        try {

            const features =
                await queryPoint(
                    SECONDARY_URL,
                    "OBJECTID,PIN,COUNTY,OWNER",
                    latlng
                );

            if (features.length) {

                const feature =
                    normalizeSecondaryFeature(
                        features[0]
                    );

                pointLookupCache.set(
                    cacheKey,
                    feature
                );

                showParcel(
                    feature
                );

                return;
            }

        } catch (error) {

            console.warn(
                "Secondary point lookup failed:",
                error
            );
        }

        showMapLocation(
            latlng
        );
    }


    /* =====================================================
       SHOW MAP LOCATION
    ===================================================== */

    function showMapLocation(latlng) {

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

        propertyPanel.classList.add("open");

        setStatus(
            "No parcel found at that point"
        );
    }


    /* =====================================================
       HIGHLIGHTING
    ===================================================== */

    function highlightParcel(layer) {

        if (!layer?.setStyle) {
            return;
        }

        layer.setStyle({
            color: "#00e5ff",
            weight: 3,
            opacity: 1,
            fillColor: "#00e5ff",
            fillOpacity: 0.18
        });

        if (layer.bringToFront) {
            layer.bringToFront();
        }
    }


    function clearSelectedParcel() {

        if (
            selectedParcelLayer &&
            selectedParcelLayer.setStyle
        ) {

            selectedParcelLayer.setStyle({
                color: "#ffffff",
                weight: 0.7,
                opacity: 0.75,
                fillOpacity: 0
            });
        }

        /*
         * If the selected layer was a temporary
         * search-result layer, remove it.
         */

        if (
            selectedParcelLayer &&
            selectedParcelLayer !==
            parcelLayer &&
            map.hasLayer(selectedParcelLayer)
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

        const p =
            feature?.properties || {};

        clearSelectedParcel();

        selectedParcelID =
            getParcelID(feature);

        maybeShowPropertyJoke();

        /*
         * Use existing parcel layer if possible.
         */

        if (sourceLayer) {

            selectedParcelLayer =
                sourceLayer;

        } else if (feature.geometry) {

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

        if (selectedParcelLayer) {

            highlightParcel(
                selectedParcelLayer
            );
        }

        const owner =
            cleanValue(p.OWNER1) ||
            cleanValue(p.OWNER);

        const address = [
            cleanValue(p.SITE_ADD),
            cleanValue(p.SITE_CITY),
            cleanValue(p.SITE_ZIP)
        ]
        .filter(Boolean)
        .join(", ");

        const county =
            cleanValue(p.County) ||
            cleanValue(p.COUNTY);

        const acres =
            p.ASR_ACRES !== null &&
            p.ASR_ACRES !== undefined &&
            p.ASR_ACRES !== "" &&
            !Number.isNaN(
                Number(p.ASR_ACRES)
            )
                ? Number(
                    p.ASR_ACRES
                  ).toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits: 2
                    }
                  )
                : "";

        const assessed =
            p.VAL_TOTAL !== null &&
            p.VAL_TOTAL !== undefined &&
            p.VAL_TOTAL !== "" &&
            !Number.isNaN(
                Number(p.VAL_TOTAL)
            )
                ? "$" +
                  Number(
                      p.VAL_TOTAL
                  ).toLocaleString()
                : "";

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
                            "Owner information unavailable in this source"
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
                            "Address information unavailable in this source"
                        )
                    }
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
                    ${
                        escapeHTML(
                            county ||
                            "County information unavailable"
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
                            "Unavailable from this source"
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
                            assessed ||
                            "Unavailable from this source"
                        )
                    }
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Data Source
                </div>

                <div class="property-value">
                    ${
                        escapeHTML(
                            cleanValue(
                                p.STEWARD
                            ) ||
                            "Public Idaho parcel data"
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

        if (saveButton) {

            saveButton.addEventListener(
                "click",
                () => {

                    saveProperty(
                        feature
                    );
                }
            );
        }

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
                event.key === "Enter"
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

        setStatus(
            "Searching property records..."
        );

        let results = [];

        /*
         * PRIMARY SEARCH
         */

        try {

            results =
                await searchPrimary(
                    query
                );

        } catch (error) {

            console.warn(
                "Primary search failed:",
                error
            );
        }

        /*
         * If primary gives nothing, use IDWR.
         */

        if (!results.length) {

            try {

                results =
                    await searchSecondary(
                        query
                    );

            } catch (error) {

                console.warn(
                    "Secondary search failed:",
                    error
                );
            }
        }

        /*
         * Still nothing.
         */

        if (!results.length) {

            resultsContent.innerHTML = `

                <div class="search-result">

                    <div class="search-result-title">
                        No properties found
                    </div>

                    <div class="search-result-details">
                        Try an owner name, address,
                        parcel ID, PIN, or county.
                    </div>

                </div>

            `;

            setStatus(
                "No matching properties found"
            );

            return;
        }

        results =
            dedupeFeatures(
                results
            );

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

        resultsContent.innerHTML =
            results.map(
                (feature, index) => {

                    const p =
                        feature.properties ||
                        {};

                    const owner =
                        cleanValue(
                            p.OWNER1
                        ) ||
                        cleanValue(
                            p.OWNER
                        ) ||
                        "Owner information unavailable";

                    const address = [
                        cleanValue(p.SITE_ADD),
                        cleanValue(p.SITE_CITY),
                        cleanValue(p.SITE_ZIP)
                    ]
                    .filter(Boolean)
                    .join(", ");

                    const county =
                        cleanValue(p.County) ||
                        cleanValue(p.COUNTY);

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
                                ${escapeHTML(parcelID)}

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
            .forEach(element => {

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
            });

        setStatus(
            `${results.length} matching properties`
        );
    }


    /* =====================================================
       PRIMARY SEARCH
    ===================================================== */

    async function searchPrimary(query) {

        const safe =
            query
                .replaceAll("'", "''");

        const where =
            `PARCEL_ID LIKE '%${safe}%' OR ` +
            `OWNER1 LIKE '%${safe}%' OR ` +
            `OWNER2 LIKE '%${safe}%' OR ` +
            `SITE_ADD LIKE '%${safe}%' OR ` +
            `SITE_CITY LIKE '%${safe}%' OR ` +
            `FP_ID LIKE '%${safe}%'`;

        const params =
            new URLSearchParams({

                where,

                outFields: [
                    "OBJECTID",
                    "PARCEL_ID",
                    "STEWARD",
                    "County",
                    "UPDATED",
                    "OWNER1",
                    "OWNER2",
                    "ASR_ACRES",
                    "SITE_ADD",
                    "SITE_CITY",
                    "SITE_ZIP",
                    "VAL_TOTAL",
                    "FP_ID"
                ].join(","),

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "50",

                f:
                    "geojson"
            });

        const data =
            await fetchJSON(
                `${PRIMARY_URL}/query?${params.toString()}`
            );

        return (
            Array.isArray(data.features)
                ? data.features.map(
                    normalizePrimaryFeature
                  )
                : []
        );
    }


    /* =====================================================
       SECONDARY SEARCH
    ===================================================== */

    async function searchSecondary(query) {

        const safe =
            query
                .replaceAll("'", "''");

        const where =
            `PIN LIKE '%${safe}%' OR ` +
            `OWNER LIKE '%${safe}%' OR ` +
            `COUNTY LIKE '%${safe}%'`;

        const params =
            new URLSearchParams({

                where,

                outFields:
                    "OBJECTID,PIN,COUNTY,OWNER",

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "50",

                f:
                    "geojson"
            });

        const data =
            await fetchJSON(
                `${SECONDARY_URL}/query?${params.toString()}`
            );

        return (
            Array.isArray(data.features)
                ? data.features.map(
                    normalizeSecondaryFeature
                  )
                : []
        );
    }


    /* =====================================================
       SEARCH HELPERS
    ===================================================== */

    function dedupeFeatures(features) {

        const unique =
            new Map();

        for (
            const feature of features
        ) {

            const id =
                getParcelID(feature);

            if (!id) {
                continue;
            }

            if (!unique.has(id)) {
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


    function rankSearchResults(
        features,
        query
    ) {

        const normalized =
            query
                .toLowerCase()
                .trim();

        function score(feature) {

            const p =
                feature.properties ||
                {};

            const fields = [

                cleanValue(p.OWNER1),
                cleanValue(p.OWNER2),
                cleanValue(p.SITE_ADD),
                cleanValue(p.SITE_CITY),
                cleanValue(p.PARCEL_ID),
                cleanValue(p.FP_ID),
                cleanValue(p.PIN),
                cleanValue(p.COUNTY)

            ]
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
                    value === normalized
                ) {

                    total += 100;

                } else if (
                    value.startsWith(
                        normalized
                    )
                ) {

                    total += 50;

                } else if (
                    value.includes(
                        normalized
                    )
                ) {

                    total += 20;
                }
            }

            return total;
        }

        return features.sort(
            (a, b) =>
                score(b) - score(a)
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

        if (feature.geometry) {

            const temp =
                L.geoJSON(
                    feature
                );

            const bounds =
                temp.getBounds();

            if (bounds.isValid()) {

                map.fitBounds(
                    bounds,
                    {
                        padding: [60, 60],
                        maxZoom: 17
                    }
                );
            }

            /*
             * Put the selected feature above
             * the normal parcel layer.
             */

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
                ).addTo(map);

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


    function saveProperty(feature) {

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
                cleanValue(p.OWNER1) ||
                cleanValue(p.OWNER) ||
                "Owner unavailable",

            address: [
                cleanValue(p.SITE_ADD),
                cleanValue(p.SITE_CITY),
                cleanValue(p.SITE_ZIP)
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
            JSON.stringify(saved)
        );

        propertyPanel.classList.remove(
            "open"
        );

        setStatus(
            "Property saved"
        );
    }


    function getFeatureCenter(geometry) {

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
       MENU ITEMS
    ===================================================== */

    document
        .querySelectorAll(".menu-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const section =
                        button.dataset.section;

                    if (section) {
                        openSection(section);
                    }
                }
            );
        });


    function openSection(section) {

        switch (section) {

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
                                county => `
                                    <button
                                        class="county-button"
                                        data-county="${escapeHTML(county)}"
                                    >
                                        ${escapeHTML(county)}
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

        input.addEventListener(
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
                    .forEach(button => {

                        const name =
                            button.dataset
                                .county
                                .toLowerCase();

                        button.style.display =
                            !query ||
                            name.includes(query)
                                ? ""
                                : "none";
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

                        selectCounty(
                            button.dataset
                                .county
                        );
                    }
                );
            });
    }


    async function selectCounty(county) {

        closeMenuPanel();

        if (!countyLayer) {
            appPage.classList.remove("open");
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
                            padding: [30, 30]
                        }
                    );

                    found = true;
                }
            }
        );

        appPage.classList.remove("open");

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
                (item, index) => `

                    <div
                        class="saved-property"
                        data-saved-index="${index}"
                    >

                        <div>

                            <div class="saved-name">
                                ${escapeHTML(item.owner)}
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
            .forEach(element => {

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
            });

        document
            .querySelectorAll(
                "[data-remove-index]"
            )
            .forEach(button => {

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
                            JSON.stringify(saved)
                        );

                        showSavedProperties();
                    }
                );
            });
    }


    async function openSavedProperty(saved) {

        appPage.classList.remove("open");
        closeMenuPanel();

        searchInput.value =
            saved.parcelID;

        await performSearch();
    }


    /* =====================================================
       DATA SOURCES PAGE
    ===================================================== */

    function showDataSources() {

        openPage(
            "Data Sources",
            `
                <div class="page-section">
                    <h2>
                        Primary Parcel Data
                    </h2>

                    <p>
                        Idaho statewide public parcel
                        information and parcel geometry.
                    </p>
                </div>

                <div class="page-section">
                    <h2>
                        Secondary Parcel Data
                    </h2>

                    <p>
                        Idaho Department of Water Resources
                        parcel polygons are used when the
                        primary service cannot return a parcel.
                    </p>
                </div>

                <div class="page-section">
                    <h2>
                        Idaho Boundaries
                    </h2>

                    <p>
                        Idaho public GIS boundary services.
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
            .addEventListener(
                "click",
                () => {

                    setLastRefresh();

                    parcelCache.clear();
                    pointLookupCache.clear();

                    loadBoundaryLayers();

                    loadParcels(true);

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
            .forEach(button => {

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
            });

        document
            .querySelectorAll(
                "[data-layer-toggle]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

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

                                loadParcels(true);

                            } else {

                                clearParcelDisplay();

                                if (
                                    parcelAbortController
                                ) {
                                    parcelAbortController.abort();
                                }
                            }
                        }

                        if (
                            layer === "counties" ||
                            layer === "idaho"
                        ) {

                            updateBoundaryVisibility();
                        }

                        showSettings();
                    }
                );
            });
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


    function setMapStyle(style) {

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

            satelliteLayer.addTo(map);

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

            standardLayer.addTo(map);
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
                        ParcelScope Idaho — Version 1.1
                    </p>

                </div>
            `,
            "ABOUT PARCELSCOPE"
        );
    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function cleanValue(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }


    function escapeHTML(value) {

        return String(
            value ?? ""
        )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }


    /* =====================================================
       INITIALIZATION
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
     * Parcel boundaries are deliberately not loaded
     * while zoomed out over the whole state.
     */

    setTimeout(
        () => {
            loadParcels(false);
        },
        700
    );


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
        "ParcelScope Idaho — stable multi-source parcel engine initialized."
    );

});
