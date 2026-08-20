/* =========================================================
   PARCELSCOPE IDAHO
   MAIN APPLICATION
   FAST PARCEL ENGINE + MULTI-SOURCE FALLBACK
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

    const mapStatusText =
        document.getElementById("mapStatusText");

    const appPage = document.getElementById("appPage");
    const appPageTitle = document.getElementById("appPageTitle");
    const appPageKicker = document.getElementById("appPageKicker");
    const appPageContent = document.getElementById("appPageContent");
    const closeAppPage = document.getElementById("closeAppPage");


    /* =====================================================
       DATA SOURCES
    ===================================================== */

    /*
     * PRIMARY:
     * Idaho statewide standardized public parcels.
     */
    const PARCEL_URL =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";


    /*
     * SECONDARY:
     * Idaho Department of Water Resources parcel compilation.
     *
     * This source has different field names, so it is only
     * used as a geometry / basic parcel fallback.
     */
    const SECONDARY_PARCEL_URL =
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
       MAP LAYERS
    ===================================================== */

    let countyLayer = null;
    let idahoLayer = null;

    let parcelLayer = null;
    let secondaryParcelLayer = null;

    let selectedParcelLayer = null;
    let selectedParcelID = null;

    let parcelRequestController = null;

    let moveTimer = null;
    let resizeTimer = null;

    let lastParcelBoundsKey = "";
    let parcelLoadInProgress = false;

    const parcelCache = new Map();


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
       INITIAL VIEW
    ===================================================== */

    map.setView(
        [44.0682, -114.7420],
        6
    );


    /* =====================================================
       SEARCH BAR
    ===================================================== */

    if (searchInput) {

        searchInput.placeholder =
            "Search something — I'm good, but I can't read minds.";

        searchInput.style.fontSize =
            "clamp(10px, 2.2vw, 13px)";

        searchInput.setAttribute(
            "aria-label",
            "Search something — I'm good, but I can't read minds."
        );

    }


    /* =====================================================
       MAP ZOOM RESISTANCE
    ===================================================== */

    let mapWasTooFarOut = false;
    let pullingMapBack = false;


    map.on("zoomend", () => {

        const zoom =
            map.getZoom();


        if (zoom <= 4) {

            if (!mapWasTooFarOut) {

                mapWasTooFarOut = true;

                showGlitchMessage(
                    "THE MAP CAN'T STRETCH THAT FAR",
                    3000
                );

            }


            if (!pullingMapBack) {

                pullingMapBack = true;


                setTimeout(() => {

                    if (
                        map.getZoom() <= 4
                    ) {

                        map.flyTo(
                            map.getCenter(),
                            5,
                            {
                                duration: 0.8,
                                easeLinearity: 0.25
                            }
                        );

                    }


                    setTimeout(() => {

                        pullingMapBack = false;

                    }, 850);


                }, 150);

            }

        } else {

            mapWasTooFarOut = false;

        }

    });


    /* =====================================================
       GLITCH WARNING
    ===================================================== */

    const glitchStyle =
        document.createElement("style");


    glitchStyle.textContent = `

        #parcelScopeGlitchWarning {

            position: fixed;

            left: 50%;
            top: 50%;

            transform:
                translate(-50%, -50%);

            z-index: 999999;

            pointer-events: none;

            display: none;

            width: 100%;

            text-align: center;

            padding: 0 15px;

            font-family:
                "Courier New",
                monospace;

            font-weight: 900;

            font-size:
                clamp(24px, 6vw, 80px);

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

            20% {

                transform:
                    translate(
                        calc(-50% - 8px),
                        calc(-50% + 3px)
                    )
                    skewX(-5deg);

            }

            40% {

                transform:
                    translate(
                        calc(-50% + 7px),
                        calc(-50% - 2px)
                    )
                    skewX(5deg);

            }

            60% {

                transform:
                    translate(
                        calc(-50% - 3px),
                        calc(-50% + 1px)
                    )
                    skewX(-2deg);

            }

            80% {

                transform:
                    translate(
                        calc(-50% + 4px),
                        calc(-50% - 3px)
                    )
                    skewX(4deg);

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
       RANDOM PROPERTY JOKES
    ===================================================== */

    function maybeShowPropertyJoke() {

        const random =
            Math.random();


        if (random < 0.001) {

            showGlitchMessage(
                "CONGRATS — YOU FOUND DIRT",
                4200
            );

            return true;

        }


        if (random < 0.002) {

            const IdahoPlaces = [

                "SOME PLACE IN IDAHO",
                "PROBABLY IDAHO",
                "SOMEWHERE IN IDAHO",
                "AN EXTREMELY IDAHO PLACE",
                "IDAHO™",
                "YOU FOUND... IDAHO"

            ];


            const place =
                IdahoPlaces[
                    Math.floor(
                        Math.random() *
                        IdahoPlaces.length
                    )
                ];


            showGlitchMessage(
                place,
                4200
            );


            return true;

        }


        return false;

    }


    /* =====================================================
       MENU
    ===================================================== */

    function openMenu() {

        sideMenu.classList.add(
            "open"
        );

    }


    function closeMenuPanel() {

        sideMenu.classList.remove(
            "open"
        );

    }


    menuButton.addEventListener(
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


    closeMenu.addEventListener(
        "click",
        closeMenuPanel
    );


    /* =====================================================
       PANELS
    ===================================================== */

    closeProperty.addEventListener(
        "click",
        () => {

            propertyPanel.classList.remove(
                "open"
            );

        }
    );


    closeResults.addEventListener(
        "click",
        () => {

            searchResults.classList.remove(
                "open"
            );

        }
    );


    closeAppPage.addEventListener(
        "click",
        () => {

            appPage.classList.remove(
                "open"
            );

        }
    );


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
       MAP CLICK
    ===================================================== */

    map.on("click", () => {

        closeMenuPanel();

    });


    /* =====================================================
       BOUNDARIES
    ===================================================== */

    async function loadBoundaryLayers() {

        try {

            const [
                countyResponse,
                idahoResponse
            ] = await Promise.all([

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
                            (feature, layer) => {

                                const name =
                                    feature.properties
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
            !map.hasLayer(countyLayer)
        ) {

            countyLayer.addTo(map);

        }


        if (
            !settings.counties &&
            map.hasLayer(countyLayer)
        ) {

            map.removeLayer(
                countyLayer
            );

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

            map.removeLayer(
                idahoLayer
            );

        }

    }


    /* =====================================================
       PARCEL FIELD LIST
    ===================================================== */

    const PRIMARY_FIELDS =
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
        ].join(",");


    /* =====================================================
       PARCEL CACHE
    ===================================================== */

    function makeBoundsKey(
        bounds
    ) {

        return [

            bounds.getWest().toFixed(4),

            bounds.getSouth().toFixed(4),

            bounds.getEast().toFixed(4),

            bounds.getNorth().toFixed(4),

            Math.round(
                map.getZoom()
            )

        ].join("|");

    }


    /* =====================================================
       REMOVE PARCEL LAYERS
    ===================================================== */

    function clearParcelDisplay() {

        if (parcelLayer) {

            map.removeLayer(
                parcelLayer
            );

            parcelLayer = null;

        }


        if (secondaryParcelLayer) {

            map.removeLayer(
                secondaryParcelLayer
            );

            secondaryParcelLayer = null;

        }

    }


    /* =====================================================
       PRIMARY PARCEL REQUEST
    ===================================================== */

    async function requestPrimaryParcels(
        bounds,
        signal
    ) {

        const params =
            new URLSearchParams({

                where: "1=1",

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
                    PRIMARY_FIELDS,

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultType:
                    "tile",

                resultRecordCount:
                    "2000",

                f:
                    "geojson"

            });


        const response =
            await fetch(
                `${PARCEL_URL}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `Primary parcel HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                data.error.message ||
                "Primary parcel service error"
            );

        }


        return data;

    }


    /* =====================================================
       SECONDARY PARCEL REQUEST
    ===================================================== */

    async function requestSecondaryParcels(
        bounds,
        signal
    ) {

        const params =
            new URLSearchParams({

                where: "1=1",

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
                    "OBJECTID,PIN,COUNTY,OWNER",

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "2000",

                f:
                    "geojson"

            });


        const response =
            await fetch(
                `${SECONDARY_PARCEL_URL}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `Secondary parcel HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                data.error.message ||
                "Secondary parcel service error"
            );

        }


        /*
         * Normalize the secondary source so the rest of
         * ParcelScope can understand it.
         */

        if (
            Array.isArray(
                data.features
            )
        ) {

            data.features =
                data.features.map(
                    feature => {

                        const p =
                            feature.properties ||
                            {};


                        return {

                            ...feature,

                            properties: {

                                OBJECTID:
                                    p.OBJECTID,

                                PARCEL_ID:
                                    p.PIN || "",

                                FP_ID:
                                    p.PIN || "",

                                OWNER1:
                                    p.OWNER || "",

                                OWNER2:
                                    "",

                                County:
                                    p.COUNTY || "",

                                STEWARD:
                                    "Idaho IDWR",

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
                );

        }


        return data;

    }


    /* =====================================================
       SPLIT LARGE VIEWPORT INTO SMALL REQUESTS
    ===================================================== */

    function createParcelTiles(
        bounds
    ) {

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


        /*
         * We deliberately keep this small.
         *
         * Low zoom = very few requests.
         * High zoom = usually one request.
         */

        let columns = 1;
        let rows = 1;


        const zoom =
            map.getZoom();


        if (zoom >= 14) {

            columns = 1;
            rows = 1;

        } else if (zoom >= 12) {

            columns = 2;
            rows = 2;

        } else if (zoom >= 10) {

            columns = 2;
            rows = 2;

        } else {

            columns = 2;
            rows = 2;

        }


        const tiles = [];


        for (
            let row = 0;
            row < rows;
            row++
        ) {

            for (
                let column = 0;
                column < columns;
                column++
            ) {

                tiles.push({

                    west:
                        west +
                        width *
                        column /
                        columns,

                    south:
                        south +
                        height *
                        row /
                        rows,

                    east:
                        west +
                        width *
                        (column + 1) /
                        columns,

                    north:
                        south +
                        height *
                        (row + 1) /
                        rows

                });

            }

        }


        return tiles.map(
            tile =>
                L.latLngBounds(
                    [
                        tile.south,
                        tile.west
                    ],
                    [
                        tile.north,
                        tile.east
                    ]
                )
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


        /*
         * Do not even query the parcel service while
         * looking at most of Idaho.
         */

        if (
            map.getZoom() < 9
        ) {

            clearParcelDisplay();

            setStatus(
                "Zoom in to view parcel boundaries"
            );

            return;

        }


        const bounds =
            map.getBounds();


        const boundsKey =
            makeBoundsKey(
                bounds
            );


        if (
            !force &&
            boundsKey ===
            lastParcelBoundsKey
        ) {

            return;

        }


        if (
            parcelLoadInProgress
        ) {

            return;

        }


        lastParcelBoundsKey =
            boundsKey;


        if (
            parcelRequestController
        ) {

            parcelRequestController.abort();

        }


        parcelRequestController =
            new AbortController();


        const signal =
            parcelRequestController.signal;


        parcelLoadInProgress =
            true;


        try {

            setStatus(
                "Loading parcel boundaries..."
            );


            const tiles =
                createParcelTiles(
                    bounds
                );


            const allFeatures = [];


            /*
             * Load only a couple of requests at once.
             * This prevents the browser from getting
             * hammered by dozens of ArcGIS requests.
             */

            const concurrency = 2;


            let currentIndex = 0;


            async function worker() {

                while (
                    currentIndex <
                    tiles.length
                ) {

                    const index =
                        currentIndex++;


                    const tile =
                        tiles[index];


                    const tileKey =
                        [
                            tile.getWest().toFixed(4),
                            tile.getSouth().toFixed(4),
                            tile.getEast().toFixed(4),
                            tile.getNorth().toFixed(4),
                            Math.round(map.getZoom())
                        ].join("|");


                    if (
                        parcelCache.has(
                            tileKey
                        )
                    ) {

                        const cached =
                            parcelCache.get(
                                tileKey
                            );


                        allFeatures.push(
                            ...cached
                        );


                        continue;

                    }


                    try {

                        const data =
                            await requestPrimaryParcels(
                                tile,
                                signal
                            );


                        const features =
                            Array.isArray(
                                data.features
                            )
                                ? data.features
                                : [];


                        parcelCache.set(
                            tileKey,
                            features
                        );


                        allFeatures.push(
                            ...features
                        );


                    } catch (error) {

                        if (
                            error.name ===
                            "AbortError"
                        ) {

                            throw error;

                        }


                        console.warn(
                            "Primary tile failed:",
                            error
                        );


                        /*
                         * Try the second source for this
                         * tile instead of giving up.
                         */

                        try {

                            const fallback =
                                await requestSecondaryParcels(
                                    tile,
                                    signal
                                );


                            const features =
                                Array.isArray(
                                    fallback.features
                                )
                                    ? fallback.features
                                    : [];


                            allFeatures.push(
                                ...features
                            );


                        } catch (fallbackError) {

                            console.warn(
                                "Secondary tile failed:",
                                fallbackError
                            );

                        }

                    }

                }

            }


            const workers =
                Array.from(
                    {
                        length:
                            Math.min(
                                concurrency,
                                tiles.length
                            )
                    },
                    worker
                );


            await Promise.all(
                workers
            );


            if (
                signal.aborted
            ) {

                return;

            }


            /*
             * Deduplicate.
             */

            const unique =
                new Map();


            allFeatures.forEach(
                feature => {

                    const id =
                        getParcelID(
                            feature
                        );


                    if (!id) {

                        return;

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
            );


            const features =
                Array.from(
                    unique.values()
                );


            /*
             * Don't replace a perfectly good parcel
             * display with an empty failed response.
             */

            if (
                features.length === 0
            ) {

                if (
                    parcelLayer
                ) {

                    setStatus(
                        "No parcel boundaries found in this area"
                    );

                } else {

                    setStatus(
                        "Parcel data unavailable — try moving slightly"
                    );

                }


                return;

            }


            const data = {

                type:
                    "FeatureCollection",

                features:
                    features

            };


            clearParcelDisplay();


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
             * Re-highlight selected parcel.
             */

            if (
                selectedParcelID
            ) {

                parcelLayer.eachLayer(
                    layer => {

                        const id =
                            getParcelID(
                                layer.feature
                            );


                        if (
                            id ===
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
                "Parcel data unavailable"
            );


        } finally {

            parcelLoadInProgress =
                false;

        }

    }


    /* =====================================================
       MAP MOVEMENT
    ===================================================== */

    map.on(
        "moveend",
        () => {

            clearTimeout(
                moveTimer
            );


            moveTimer =
                setTimeout(
                    () => {

                        loadParcels();

                    },
                    300
                );

        }
    );


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on(
        "click",
        async event => {

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

        }
    );


    /* =====================================================
       FIND PARCEL AT POINT
    ===================================================== */

    async function findParcelAtPoint(
        latlng
    ) {

        const geometry =
            `${latlng.lng},${latlng.lat}`;


        const params =
            new URLSearchParams({

                where:
                    "1=1",

                geometry:
                    geometry,

                geometryType:
                    "esriGeometryPoint",

                inSR:
                    "4326",

                spatialRel:
                    "esriSpatialRelIntersects",

                outFields:
                    PRIMARY_FIELDS,

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

            setStatus(
                "Finding property..."
            );


            const response =
                await fetch(
                    `${PARCEL_URL}/query?${params.toString()}`
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    "Primary point query failed"
                );

            }


            const data =
                await response.json();


            if (
                data.features &&
                data.features.length
            ) {

                showParcel(
                    data.features[0]
                );


                return;

            }


            /*
             * If statewide source doesn't return it,
             * ask the second source.
             */

            await findSecondaryParcelAtPoint(
                latlng
            );


        } catch (error) {

            console.warn(
                "Primary point lookup failed:",
                error
            );


            await findSecondaryParcelAtPoint(
                latlng
            );

        }

    }


    /* =====================================================
       SECONDARY POINT LOOKUP
    ===================================================== */

    async function findSecondaryParcelAtPoint(
        latlng
    ) {

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
                    "OBJECTID,PIN,COUNTY,OWNER",

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
                    `${SECONDARY_PARCEL_URL}/query?${params.toString()}`
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    "Secondary point query failed"
                );

            }


            const data =
                await response.json();


            if (
                data.features &&
                data.features.length
            ) {

                const feature =
                    normalizeSecondaryFeature(
                        data.features[0]
                    );


                showParcel(
                    feature
                );


            } else {

                showMapLocation(
                    latlng
                );

            }


        } catch (error) {

            console.warn(
                "Secondary point lookup failed:",
                error
            );


            showMapLocation(
                latlng
            );

        }

    }


    /* =====================================================
       NORMALIZE SECONDARY FEATURE
    ===================================================== */

    function normalizeSecondaryFeature(
        feature
    ) {

        const p =
            feature.properties ||
            {};


        return {

            ...feature,

            properties: {

                OBJECTID:
                    p.OBJECTID,

                PARCEL_ID:
                    p.PIN || "",

                FP_ID:
                    p.PIN || "",

                OWNER1:
                    p.OWNER || "",

                OWNER2:
                    "",

                County:
                    p.COUNTY || "",

                STEWARD:
                    "Idaho IDWR",

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
       MAP LOCATION
    ===================================================== */

    function showMapLocation(
        latlng
    ) {

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
                    No parcel was found at this exact point.
                </div>

            </div>

        `;


        propertyPanel.classList.add(
            "open"
        );

    }


    /* =====================================================
       PARCEL HELPERS
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
                p.PIN
            ) ||

            cleanValue(
                p.OBJECTID
            )

        );

    }


    function highlightParcel(
        layer
    ) {

        if (!layer) {

            return;

        }


        layer.setStyle({

            color:
                "#00e5ff",

            weight:
                3,

            opacity:
                1,

            fillColor:
                "#00e5ff",

            fillOpacity:
                0.18

        });


        if (
            layer.bringToFront
        ) {

            layer.bringToFront();

        }

    }


    function clearSelectedParcel() {

        if (
            selectedParcelLayer &&
            selectedParcelLayer.setStyle
        ) {

            selectedParcelLayer.setStyle({

                color:
                    "#ffffff",

                weight:
                    0.7,

                opacity:
                    0.75,

                fillOpacity:
                    0

            });

        }


        selectedParcelLayer =
            null;


        selectedParcelID =
            null;

    }


    /* =====================================================
       SHOW PARCEL
    ===================================================== */

    function showParcel(
        feature,
        sourceLayer = null
    ) {

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

                            color:
                                "#00e5ff",

                            weight:
                                3,

                            opacity:
                                1,

                            fillColor:
                                "#00e5ff",

                            fillOpacity:
                                0.18

                        }

                    }
                ).addTo(
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
                p.OWNER
            ) ||

            "Owner information unavailable";


        const address =
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
            .join(", ");


        const county =
            cleanValue(
                p.County
            ) ||

            cleanValue(
                p.COUNTY
            ) ||

            "Unavailable";


        const acres =
            p.ASR_ACRES !== null &&
            p.ASR_ACRES !== undefined &&
            p.ASR_ACRES !== ""

                ? Number(
                    p.ASR_ACRES
                  ).toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits:
                            2
                    }
                  )

                : "Unavailable";


        const parcelID =
            selectedParcelID ||
            "Unavailable";


        const assessed =
            p.VAL_TOTAL !== null &&
            p.VAL_TOTAL !== undefined &&
            p.VAL_TOTAL !== ""

                ? "$" +
                  Number(
                      p.VAL_TOTAL
                  ).toLocaleString()

                : "Unavailable";


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
                    ${escapeHTML(assessed)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Data Steward
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        cleanValue(
                            p.STEWARD
                        ) ||
                        "Unavailable"
                    )}
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
            query.replaceAll(
                "'",
                "''"
            );


        const where =
            `PARCEL_ID LIKE '%${safeQuery}%' OR ` +
            `OWNER1 LIKE '%${safeQuery}%' OR ` +
            `OWNER2 LIKE '%${safeQuery}%' OR ` +
            `SITE_ADD LIKE '%${safeQuery}%' OR ` +
            `SITE_CITY LIKE '%${safeQuery}%' OR ` +
            `FP_ID LIKE '%${safeQuery}%'`;


        const params =
            new URLSearchParams({

                where:
                    where,

                outFields:
                    PRIMARY_FIELDS,

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "50",

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
                    "Search failed"
                );

            }


            const data =
                await response.json();


            if (
                data.error
            ) {

                throw new Error(
                    data.error.message
                );

            }


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


            const unique =
                new Map();


            data.features.forEach(
                feature => {

                    const id =
                        getParcelID(
                            feature
                        );


                    if (
                        id &&
                        !unique.has(id)
                    ) {

                        unique.set(
                            id,
                            feature
                        );

                    }

                }
            );


            data.features =
                Array.from(
                    unique.values()
                );


            const normalized =
                query.toLowerCase();


            data.features.sort(
                (a, b) => {

                    const pa =
                        a.properties ||
                        {};


                    const pb =
                        b.properties ||
                        {};


                    const fieldsA = [

                        cleanValue(
                            pa.OWNER1
                        ),

                        cleanValue(
                            pa.OWNER2
                        ),

                        cleanValue(
                            pa.SITE_ADD
                        ),

                        cleanValue(
                            pa.SITE_CITY
                        ),

                        cleanValue(
                            pa.PARCEL_ID
                        ),

                        cleanValue(
                            pa.FP_ID
                        )

                    ]
                    .map(
                        value =>
                            value.toLowerCase()
                    );


                    const fieldsB = [

                        cleanValue(
                            pb.OWNER1
                        ),

                        cleanValue(
                            pb.OWNER2
                        ),

                        cleanValue(
                            pb.SITE_ADD
                        ),

                        cleanValue(
                            pb.SITE_CITY
                        ),

                        cleanValue(
                            pb.PARCEL_ID
                        ),

                        cleanValue(
                            pb.FP_ID
                        )

                    ]
                    .map(
                        value =>
                            value.toLowerCase()
                    );


                    function score(
                        fields
                    ) {

                        let total = 0;


                        fields.forEach(
                            value => {

                                if (
                                    value ===
                                    normalized
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
                        );


                        return total;

                    }


                    return (
                        score(fieldsB) -
                        score(fieldsA)
                    );

                }
            );


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


                            return `

                                <div
                                    class="search-result"
                                    data-result-index="${index}"
                                >

                                    <div
                                        class="search-result-title"
                                    >
                                        ${escapeHTML(owner)}
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
                                                getParcelID(
                                                    feature
                                                )
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
                "Search error:",
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

            const exactLayer =
                L.geoJSON(
                    feature
                );


            const bounds =
                exactLayer.getBounds();


            if (
                bounds.isValid()
            ) {

                map.fitBounds(
                    bounds,
                    {

                        padding:
                            [
                                60,
                                60
                            ],

                        maxZoom:
                            17

                    }
                );

            }


            selectedParcelLayer =
                L.geoJSON(
                    feature,
                    {

                        style: {

                            color:
                                "#00e5ff",

                            weight:
                                3,

                            opacity:
                                1,

                            fillColor:
                                "#00e5ff",

                            fillOpacity:
                                0.18

                        }

                    }
                ).addTo(
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

            parcelID:
                parcelID,

            owner:
                cleanValue(
                    p.OWNER1
                ) ||
                cleanValue(
                    p.OWNER
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

    }


    function getFeatureCenter(
        geometry
    ) {

        try {

            const layer =
                L.geoJSON({

                    type:
                        "Feature",

                    properties:
                        {},

                    geometry:
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

            `,
            "IDAHO COUNTIES"
        );


        const countySearchInput =
            document.getElementById(
                "countySearchInput"
            );


        countySearchInput.addEventListener(
            "input",
            () => {

                const query =
                    countySearchInput.value
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
                                name.includes(query)
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


        if (countyLayer) {

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
                                padding:
                                    [
                                        30,
                                        30
                                    ]
                            }
                        );


                        found = true;

                    }

                }
            );


            if (found) {

                appPage.classList.remove(
                    "open"
                );


                return;

            }

        }


        appPage.classList.remove(
            "open"
        );

    }


    /* =====================================================
       SAVED PROPERTIES PAGE
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
                        Idaho statewide standardized public
                        parcel polygons and property attributes.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Secondary Parcel Data
                    </h2>

                    <p>
                        A second Idaho government parcel source
                        is used as a fallback when the primary
                        parcel service does not respond.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Idaho Boundaries
                    </h2>

                    <p>
                        State and county boundary information
                        comes from Idaho public GIS services.
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

                    lastParcelBoundsKey = "";

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

                                    lastParcelBoundsKey =
                                        "";

                                    loadParcels(
                                        true
                                    );

                                } else {

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
                            or parcel ID.
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


        return String(
            value
        ).trim();

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

        if (mapStatusText) {

            mapStatusText.textContent =
                text;

        }

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
     * Do NOT immediately load parcels at zoom 6.
     * They aren't useful at that scale and would make
     * the site painfully slow.
     */

    setTimeout(
        () => {

            loadParcels();

        },
        500
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
        "ParcelScope Idaho initialized — FAST MULTI-SOURCE PARCEL ENGINE."
    );

});
