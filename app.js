/* =========================================================
   PARCELSCOPE IDAHO
   MULTI-SOURCE PARCEL ENGINE
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
       PARCEL SOURCES
       ===================================================== */

    const PARCEL_SOURCES = [

        {
            name: "Idaho Public Parcels",
            url:
                "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7",
            priority: 1
        },

        {
            name: "Idaho Lands WhiteStar",
            url:
                "https://gis1.idl.idaho.gov/arcgis/rest/services/Portal/WhiteStar_Parcels/FeatureServer/0",
            priority: 2
        }

    ];


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

        wheelPxPerZoomLevel: 220

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


    /* =====================================================
       LAYERS
       ===================================================== */

    let countyLayer = null;
    let idahoLayer = null;
    let parcelLayer = null;

    let selectedParcelLayer = null;
    let selectedParcelID = null;

    let parcelRequestController = null;
    let moveTimer = null;

    let mapWasTooFarOut = false;
    let pullingMapBack = false;


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

    map.on("zoomend", () => {

        const zoom = map.getZoom();

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

                    if (map.getZoom() <= 4) {

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
       GLITCH STYLE
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

    document.head.appendChild(glitchStyle);


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

        clearTimeout(glitchTimeout);

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
       FUNNY PROPERTY STUFF
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

            const places = [

                "SOME PLACE IN IDAHO",
                "PROBABLY IDAHO",
                "SOMEWHERE IN IDAHO",
                "AN EXTREMELY IDAHO PLACE",
                "IDAHO™",
                "YOU FOUND... IDAHO"

            ];

            const place =
                places[
                    Math.floor(
                        Math.random() *
                        places.length
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

        if (sideMenu) {

            sideMenu.classList.add(
                "open"
            );

        }

    }


    function closeMenuPanel() {

        if (sideMenu) {

            sideMenu.classList.remove(
                "open"
            );

        }

    }


    if (menuButton) {

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

    }


    if (closeMenu) {

        closeMenu.addEventListener(
            "click",
            closeMenuPanel
        );

    }


    /* =====================================================
       PANELS
       ===================================================== */

    if (closeProperty) {

        closeProperty.addEventListener(
            "click",
            () => {

                propertyPanel.classList.remove(
                    "open"
                );

            }
        );

    }


    if (closeResults) {

        closeResults.addEventListener(
            "click",
            () => {

                searchResults.classList.remove(
                    "open"
                );

            }
        );

    }


    if (closeAppPage) {

        closeAppPage.addEventListener(
            "click",
            () => {

                appPage.classList.remove(
                    "open"
                );

            }
        );

    }


    function openPage(
        title,
        content,
        kicker = "PARCELSCOPE"
    ) {

        if (appPageKicker)
            appPageKicker.textContent = kicker;

        if (appPageTitle)
            appPageTitle.textContent = title;

        if (appPageContent)
            appPageContent.innerHTML = content;

        if (appPage)
            appPage.classList.add("open");

        closeMenuPanel();

    }


    /* =====================================================
       COUNTY + IDAHO BOUNDARIES
       ===================================================== */

    async function loadBoundaryLayers() {

        try {

            const results =
                await Promise.allSettled([

                    fetch(
                        `${COUNTY_URL}/query?where=1%3D1&outFields=CountyName,CountyFIPS&returnGeometry=true&outSR=4326&f=geojson`
                    ),

                    fetch(
                        `${IDAHO_URL}/query?where=1%3D1&outFields=Name,NameAbbr&returnGeometry=true&outSR=4326&f=geojson`
                    )

                ]);


            if (
                results[0].status ===
                "fulfilled"
            ) {

                const response =
                    results[0].value;

                if (response.ok) {

                    const geojson =
                        await response.json();

                    countyLayer =
                        L.geoJSON(
                            geojson,
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

                }

            }


            if (
                results[1].status ===
                "fulfilled"
            ) {

                const response =
                    results[1].value;

                if (response.ok) {

                    const geojson =
                        await response.json();

                    idahoLayer =
                        L.geoJSON(
                            geojson,
                            {

                                style: {

                                    color: "#ffffff",
                                    weight: 3,
                                    opacity: 1,
                                    fillOpacity: 0

                                }

                            }
                        );

                }

            }


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
            settings.counties &&
            countyLayer &&
            !map.hasLayer(countyLayer)
        ) {

            countyLayer.addTo(map);

        }


        if (
            !settings.counties &&
            countyLayer &&
            map.hasLayer(countyLayer)
        ) {

            map.removeLayer(
                countyLayer
            );

        }


        if (
            settings.idaho &&
            idahoLayer &&
            !map.hasLayer(idahoLayer)
        ) {

            idahoLayer.addTo(map);

        }


        if (
            !settings.idaho &&
            idahoLayer &&
            map.hasLayer(idahoLayer)
        ) {

            map.removeLayer(
                idahoLayer
            );

        }

    }


    /* =====================================================
       PARCEL HELPERS
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


    function normalizeParcelKey(feature) {

        const p =
            feature?.properties || {};

        const id =
            getParcelID(feature);

        if (id) {

            return "ID:" +
                String(id)
                    .trim()
                    .toUpperCase();

        }


        const county =
            cleanValue(
                p.County ||
                p.COUNTY
            )
            .toUpperCase();


        const address =
            cleanValue(
                p.SITE_ADD
            )
            .toUpperCase();


        if (
            county ||
            address
        ) {

            return (
                "A:" +
                county +
                "|" +
                address
            );

        }


        return null;

    }


    function featureHasGeometry(feature) {

        if (
            !feature ||
            !feature.geometry
        ) {

            return false;

        }


        const geometry =
            feature.geometry;


        if (
            geometry.type ===
            "Polygon"
        ) {

            return (
                Array.isArray(
                    geometry.coordinates
                ) &&
                geometry.coordinates.length > 0
            );

        }


        if (
            geometry.type ===
            "MultiPolygon"
        ) {

            return (
                Array.isArray(
                    geometry.coordinates
                ) &&
                geometry.coordinates.length > 0
            );

        }


        return false;

    }


    function mergeParcelFeatures(
        features
    ) {

        const mapByKey =
            new Map();


        for (
            const feature of features
        ) {

            if (
                !featureHasGeometry(
                    feature
                )
            ) {

                continue;

            }


            const key =
                normalizeParcelKey(
                    feature
                );


            if (!key) {

                continue;

            }


            if (
                !mapByKey.has(key)
            ) {

                mapByKey.set(
                    key,
                    feature
                );

                continue;

            }


            const existing =
                mapByKey.get(key);


            /*
             * Prefer the feature containing
             * more useful property information.
             */

            const existingScore =
                propertyQualityScore(
                    existing
                );

            const newScore =
                propertyQualityScore(
                    feature
                );


            if (
                newScore >
                existingScore
            ) {

                mapByKey.set(
                    key,
                    feature
                );

            }

        }


        return Array.from(
            mapByKey.values()
        );

    }


    function propertyQualityScore(
        feature
    ) {

        const p =
            feature?.properties || {};

        let score = 0;


        const fields = [

            p.PARCEL_ID,
            p.FP_ID,
            p.PIN,
            p.OWNER1,
            p.OWNER,
            p.SITE_ADD,
            p.SITE_CITY,
            p.SITE_ZIP,
            p.County,
            p.COUNTY,
            p.ASR_ACRES,
            p.VAL_TOTAL

        ];


        fields.forEach(
            value => {

                if (
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                ) {

                    score++;

                }

            }
        );


        return score;

    }


    /* =====================================================
       PARCEL REQUEST
       ===================================================== */

    async function queryParcelSource(
        source,
        bounds,
        signal
    ) {

        const west =
            bounds.getWest();

        const south =
            bounds.getSouth();

        const east =
            bounds.getEast();

        const north =
            bounds.getNorth();


        /*
         * IMPORTANT:
         *
         * Input is WGS84.
         * ArcGIS converts the geometry into
         * its native spatial reference.
         */

        const geometry = JSON.stringify({

            xmin: west,
            ymin: south,
            xmax: east,
            ymax: north,
            spatialReference: {
                wkid: 4326
            }

        });


        const params =
            new URLSearchParams({

                where:
                    "1=1",

                geometry:
                    geometry,

                geometryType:
                    "esriGeometryEnvelope",

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

                resultRecordCount:
                    "1000",

                resultOffset:
                    "0",

                f:
                    "geojson"

            });


        const response =
            await fetch(
                `${source.url}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `${source.name}: HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                `${source.name}: ` +
                data.error.message
            );

        }


        if (
            !data.features ||
            !Array.isArray(
                data.features
            )
        ) {

            return [];

        }


        return data.features;

    }


    /* =====================================================
       PARCEL LOADING
       ===================================================== */

    async function loadParcels() {

        if (!settings.parcels) {

            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }

            setStatus(
                "Parcel boundaries disabled"
            );

            return;

        }


        const zoom =
            map.getZoom();


        /*
         * Do not even hit the parcel APIs
         * while zoomed too far out.
         */

        if (zoom < 9) {

            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }

            setStatus(
                "Zoom in to view parcel boundaries"
            );

            return;

        }


        /*
         * Cancel previous request.
         */

        if (parcelRequestController) {

            parcelRequestController.abort();

        }


        parcelRequestController =
            new AbortController();


        const signal =
            parcelRequestController.signal;


        try {

            setStatus(
                "Loading parcel boundaries..."
            );


            const originalBounds =
                map.getBounds();


            /*
             * Shrink the requested area slightly
             * at lower zooms.
             *
             * This prevents enormous queries.
             */

            let bounds =
                originalBounds;


            if (zoom < 11) {

                bounds =
                    shrinkBounds(
                        originalBounds,
                        0.72
                    );

            } else if (zoom < 13) {

                bounds =
                    shrinkBounds(
                        originalBounds,
                        0.88
                    );

            }


            /*
             * Run sources sequentially.
             * This is MUCH lighter than firing
             * 16 requests simultaneously.
             */

            const collected = [];


            for (
                const source of PARCEL_SOURCES
            ) {

                if (
                    signal.aborted
                ) {

                    throw new DOMException(
                        "Request aborted",
                        "AbortError"
                    );

                }


                try {

                    const features =
                        await queryParcelSource(
                            source,
                            bounds,
                            signal
                        );


                    collected.push(
                        ...features
                    );


                    /*
                     * If first source gives
                     * enough data, don't hammer
                     * the second source.
                     *
                     * We still use the second
                     * source when the first source
                     * returns too little.
                     */

                    if (
                        features.length >= 700
                    ) {

                        break;

                    }

                } catch (error) {

                    if (
                        error.name ===
                        "AbortError"
                    ) {

                        throw error;

                    }

                    console.warn(
                        source.name +
                        " failed:",
                        error
                    );

                }

            }


            /*
             * Filter and merge.
             */

            const features =
                mergeParcelFeatures(
                    collected
                );


            if (
                signal.aborted
            ) {

                return;

            }


            /*
             * Remove old parcel layer.
             */

            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }


            /*
             * Draw new parcel layer.
             */

            parcelLayer =
                L.geoJSON(
                    {
                        type:
                            "FeatureCollection",

                        features:
                            features

                    },
                    {

                        style: {

                            color: "#ffffff",

                            weight:
                                zoom >= 14
                                    ? 0.8
                                    : 0.55,

                            opacity:
                                zoom >= 14
                                    ? 0.78
                                    : 0.58,

                            fillOpacity:
                                0

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


            if (
                features.length === 0
            ) {

                setStatus(
                    "No parcel boundaries found in this area"
                );

            } else {

                setStatus(
                    `${features.length.toLocaleString()} parcel boundaries loaded`
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
                "Parcel loading error:",
                error
            );


            setStatus(
                "Parcel data temporarily unavailable"
            );

        }

    }


    function shrinkBounds(
        bounds,
        factor
    ) {

        const center =
            bounds.getCenter();


        const latSpan =
            bounds.getNorth() -
            bounds.getSouth();


        const lngSpan =
            bounds.getEast() -
            bounds.getWest();


        const newLatSpan =
            latSpan * factor;


        const newLngSpan =
            lngSpan * factor;


        return L.latLngBounds(

            [

                center.lat -
                newLatSpan / 2,

                center.lng -
                newLngSpan / 2

            ],

            [

                center.lat +
                newLatSpan / 2,

                center.lng +
                newLngSpan / 2

            ]

        );

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
                    500
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
       POINT QUERY
       ===================================================== */

    async function findParcelAtPoint(
        latlng
    ) {

        setStatus(
            "Finding property..."
        );


        const point =
            JSON.stringify({

                x:
                    latlng.lng,

                y:
                    latlng.lat,

                spatialReference:
                    {
                        wkid: 4326
                    }

            });


        for (
            const source of PARCEL_SOURCES
        ) {

            try {

                const params =
                    new URLSearchParams({

                        where:
                            "1=1",

                        geometry:
                            point,

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

                        resultRecordCount:
                            "1",

                        f:
                            "geojson"

                    });


                const response =
                    await fetch(
                        `${source.url}/query?${params.toString()}`
                    );


                if (!response.ok) {

                    continue;

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

            } catch (error) {

                console.warn(
                    "Point source failed:",
                    source.name,
                    error
                );

            }

        }


        showMapLocation(
            latlng
        );

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
       HIGHLIGHT
       ===================================================== */

    function highlightParcel(
        layer
    ) {

        if (!layer) return;


        layer.setStyle({

            color: "#00e5ff",

            weight: 3,

            opacity: 1,

            fillColor: "#00e5ff",

            fillOpacity: 0.18

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

                color: "#ffffff",

                weight: 0.7,

                opacity: 0.75,

                fillOpacity: 0

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
            feature.properties || {};


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

                            fillColor:
                                "#00e5ff",

                            fillOpacity:
                                0.18

                        }

                    }
                ).addTo(map);

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
                        maximumFractionDigits: 2
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

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            performSearch
        );

    }


    if (searchInput) {

        searchInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    performSearch();

                }

            }
        );

    }


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


        const allResults = [];


        for (
            const source of PARCEL_SOURCES
        ) {

            try {

                const where =
                    `PARCEL_ID LIKE '%${safeQuery}%' OR ` +
                    `FP_ID LIKE '%${safeQuery}%' OR ` +
                    `PIN LIKE '%${safeQuery}%' OR ` +
                    `OWNER1 LIKE '%${safeQuery}%' OR ` +
                    `OWNER LIKE '%${safeQuery}%' OR ` +
                    `SITE_ADD LIKE '%${safeQuery}%' OR ` +
                    `SITE_CITY LIKE '%${safeQuery}%'`;


                const params =
                    new URLSearchParams({

                        where,

                        outFields:
                            "*",

                        returnGeometry:
                            "true",

                        outSR:
                            "4326",

                        resultRecordCount:
                            "50",

                        f:
                            "geojson"

                    });


                const response =
                    await fetch(
                        `${source.url}/query?${params.toString()}`
                    );


                if (!response.ok) {

                    continue;

                }


                const data =
                    await response.json();


                if (
                    data.features
                ) {

                    allResults.push(
                        ...data.features
                    );

                }

            } catch (error) {

                console.warn(
                    "Search source failed:",
                    source.name,
                    error
                );

            }

        }


        const features =
            mergeParcelFeatures(
                allResults
            );


        if (!features.length) {

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


        const normalized =
            query.toLowerCase();


        features.sort(
            (a, b) => {

                return (
                    searchScore(
                        b,
                        normalized
                    ) -
                    searchScore(
                        a,
                        normalized
                    )
                );

            }
        );


        const limited =
            features.slice(
                0,
                50
            );


        resultsContent.innerHTML =
            limited
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
                            cleanValue(
                                p.OWNER
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
                            ) ||
                            cleanValue(
                                p.COUNTY
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
                                limited[index]
                            );

                        }
                    );

                }
            );

    }


    function searchScore(
        feature,
        query
    ) {

        const p =
            feature.properties || {};


        const values = [

            p.PARCEL_ID,
            p.FP_ID,
            p.PIN,
            p.OWNER1,
            p.OWNER,
            p.OWNER2,
            p.SITE_ADD,
            p.SITE_CITY

        ]
        .map(
            value =>
                cleanValue(
                    value
                ).toLowerCase()
        );


        let score = 0;


        values.forEach(
            value => {

                if (!value) return;


                if (
                    value === query
                ) {

                    score += 100;

                } else if (
                    value.startsWith(query)
                ) {

                    score += 60;

                } else if (
                    value.includes(query)
                ) {

                    score += 25;

                }

            }
        );


        return score;

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


    function saveProperty(
        feature
    ) {

        const parcelID =
            getParcelID(
                feature
            );


        if (!parcelID) return;


        const saved =
            getSavedProperties();


        if (
            saved.some(
                item =>
                    item.parcelID ===
                    parcelID
            )
        ) {

            showGlitchMessage(
                "YOU ALREADY SAVED THIS ONE",
                3000
            );

            return;

        }


        const p =
            feature.properties || {};


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

            return L.geoJSON({

                type:
                    "Feature",

                properties:
                    {},

                geometry

            })
            .getBounds()
            .getCenter();

        } catch {

            return null;

        }

    }


    /* =====================================================
       COUNTY LIST
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
                );

            }
        );


    /* =====================================================
       COUNTIES
       ===================================================== */

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


                <input
                    id="countySearchInput"
                    type="search"
                    placeholder="Search counties..."
                >


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


        const input =
            document.getElementById(
                "countySearchInput"
            );


        input.addEventListener(
            "input",
            () => {

                const query =
                    input.value
                        .toLowerCase()
                        .trim();


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
       SAVED
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
                        "Save Property".

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
                                    ${escapeHTML(
                                        item.address ||
                                        "Address unavailable"
                                    )}
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


    /* =====================================================
       DATA SOURCES PAGE
       ===================================================== */

    function showDataSources() {

        openPage(
            "Data Sources",
            `

                <div class="page-section">

                    <h2>
                        Parcel Sources
                    </h2>

                    <p>
                        ParcelScope checks multiple public
                        Idaho parcel datasets and filters
                        duplicate and invalid records.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Idaho Public Parcels
                    </h2>

                    <p>
                        Statewide standardized parcel data
                        assembled from participating Idaho
                        counties.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        WhiteStar Parcels
                    </h2>

                    <p>
                        A separate Idaho parcel boundary
                        source used as a fallback and
                        cross-check.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Satellite
                    </h2>

                    <p>
                        Esri World Imagery.
                    </p>

                </div>

            `,
            "DATA SOURCES"
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


                    ${createToggle(
                        "satellite",
                        "Satellite",
                        "Aerial imagery",
                        settings.mapStyle ===
                        "satellite"
                    )}


                    ${createToggle(
                        "standard",
                        "Standard",
                        "Road map",
                        settings.mapStyle ===
                        "standard"
                    )}

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
                        "Idaho outline",
                        settings.idaho
                    )}

                </div>

            `,
            "SETTINGS"
        );


        document
            .querySelectorAll(
                "[data-setting]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const key =
                                button.dataset
                                    .setting;


                            if (
                                key ===
                                "satellite"
                            ) {

                                setMapStyle(
                                    "satellite"
                                );

                            }


                            if (
                                key ===
                                "standard"
                            ) {

                                setMapStyle(
                                    "standard"
                                );

                            }


                            if (
                                [
                                    "parcels",
                                    "counties",
                                    "idaho"
                                ].includes(
                                    key
                                )
                            ) {

                                settings[key] =
                                    !settings[key];

                                saveSettings();

                                updateBoundaryVisibility();

                                if (
                                    key ===
                                    "parcels"
                                ) {

                                    loadParcels();

                                }

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
                        ${escapeHTML(name)}
                    </div>

                    <div class="setting-description">
                        ${escapeHTML(description)}
                    </div>

                </div>


                <button
                    class="toggle ${
                        enabled
                            ? "on"
                            : ""
                    }"
                    data-setting="${escapeHTML(key)}"
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
                        ParcelScope is an Idaho property
                        exploration tool using public GIS
                        sources.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Features
                    </h2>

                    <ul>

                        <li>
                            Multiple parcel sources
                        </li>

                        <li>
                            Duplicate filtering
                        </li>

                        <li>
                            Property search
                        </li>

                        <li>
                            Parcel selection
                        </li>

                        <li>
                            County exploration
                        </li>

                        <li>
                            Saved properties
                        </li>

                    </ul>

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


    setStatus(
        "Loading Idaho GIS data..."
    );


    loadBoundaryLayers();


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
        "ParcelScope Idaho — multi-source parcel engine initialized."
    );

});
