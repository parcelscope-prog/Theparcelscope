/* =========================================================
   PARCELSCOPE IDAHO
   MAIN APPLICATION
   MULTI-SOURCE PARCEL ENGINE
   =========================================================

   SOURCE PRIORITY

   1. Idaho Public Parcels
   2. Idaho Department of Lands WhiteStar Parcels
   3. Idaho Department of Water Resources Parcels

   The important difference from the old engine:

   A source returning a parcel WITHOUT useful attributes
   is NOT treated as a successful complete result.

   ParcelScope attempts to combine the best information
   available from all sources.
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


    /* =====================================================
       DATA SOURCES
    ===================================================== */

    /*
     * SOURCE 1
     *
     * Idaho statewide standardized public parcels.
     */
    const PARCEL_URL =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";


    /*
     * SOURCE 2
     *
     * Idaho Department of Lands / WhiteStar.
     *
     * This is now a PRIMARY FALLBACK rather than an
     * emergency-only fallback.
     */
    const WHITESTAR_URL =
        "https://gis1.idl.idaho.gov/arcgis/rest/services/Portal/WhiteStar_Parcels/FeatureServer/0";


    /*
     * SOURCE 3
     *
     * Idaho Department of Water Resources.
     */
    const IDWR_URL =
        "https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0";


    /*
     * Boundary sources.
     */
    const COUNTY_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/2";


    const IDAHO_URL =
        "https://gisp.itd.idaho.gov/server/rest/services/GDWarehouse/PoliticalBoundaries/FeatureServer/3";


    /* =====================================================
       FIELD LISTS
    ===================================================== */

    const PRIMARY_FIELDS = [
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
        "FP_ID",
        "PUBLIC_STD",
        "MAIL_ADD1",
        "MAIL_ADD2",
        "MAIL_CITY",
        "MAIL_STATE",
        "MAIL_ZIP"
    ].join(",");


    const WHITESTAR_FIELDS = [
        "OBJECTID",
        "fips",
        "state",
        "county",
        "apn",
        "dupapn",
        "propfuladd",
        "prophsnum",
        "propstdirl",
        "propstname",
        "propstsuff",
        "propcity",
        "propstate",
        "propzip",
        "owner1",
        "owner2",
        "taxacctnum",
        "mailfuladd",
        "mailcity",
        "mailstate",
        "mailzip",
        "acreage",
        "totalvalue",
        "landval",
        "improvval",
        "source",
        "wstar_id",
        "legacypapn",
        "amoddate"
    ].join(",");


    const IDWR_FIELDS = [
        "OBJECTID",
        "PIN",
        "COUNTY",
        "OWNER"
    ].join(",");


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

    const satelliteLayer =
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 19,
                attribution: "Tiles © Esri"
            }
        );


    const standardLayer =
        L.tileLayer(
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


                setTimeout(
                    () => {

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


                        setTimeout(
                            () => {

                                pullingMapBack =
                                    false;

                            },
                            850
                        );


                    },
                    150
                );

            }

        } else {

            mapWasTooFarOut = false;

        }

    });


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


    map.on(
        "click",
        () => {

            closeMenuPanel();

        }
    );


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
       CACHE
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
       BOUNDS PARAMETER
    ===================================================== */

    function createEnvelopeParams(
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

            inSR:
                "4326",

            spatialRel:
                "esriSpatialRelIntersects",

            outFields:
                fields,

            returnGeometry:
                "true",

            outSR:
                "4326",

            resultRecordCount:
                "2000",

            f:
                "geojson"

        });

    }


    /* =====================================================
       PRIMARY REQUEST
    ===================================================== */

    async function requestPrimaryParcels(
        bounds,
        signal
    ) {

        const params =
            createEnvelopeParams(
                bounds,
                PRIMARY_FIELDS
            );


        const response =
            await fetch(
                `${PARCEL_URL}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `Primary HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "Primary service error"
            );

        }


        return Array.isArray(
            data.features
        )
            ? data.features
            : [];

    }


    /* =====================================================
       WHITESTAR REQUEST
    ===================================================== */

    async function requestWhiteStarParcels(
        bounds,
        signal
    ) {

        const params =
            createEnvelopeParams(
                bounds,
                WHITESTAR_FIELDS
            );


        const response =
            await fetch(
                `${WHITESTAR_URL}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `WhiteStar HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "WhiteStar service error"
            );

        }


        return Array.isArray(
            data.features
        )
            ? data.features.map(
                normalizeWhiteStarFeature
              )
            : [];

    }


    /* =====================================================
       IDWR REQUEST
    ===================================================== */

    async function requestIDWRParcels(
        bounds,
        signal
    ) {

        const params =
            createEnvelopeParams(
                bounds,
                IDWR_FIELDS
            );


        const response =
            await fetch(
                `${IDWR_URL}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `IDWR HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "IDWR service error"
            );

        }


        return Array.isArray(
            data.features
        )
            ? data.features.map(
                normalizeIDWRFeature
              )
            : [];

    }


    /* =====================================================
       NORMALIZE WHITESTAR
    ===================================================== */

    function normalizeWhiteStarFeature(
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
                    cleanValue(
                        p.apn
                    ) ||
                    cleanValue(
                        p.legacypapn
                    ) ||
                    cleanValue(
                        p.wstar_id
                    ),

                FP_ID:
                    cleanValue(
                        p.apn
                    ) ||
                    cleanValue(
                        p.legacypapn
                    ),

                OWNER1:
                    cleanValue(
                        p.owner1
                    ),

                OWNER2:
                    cleanValue(
                        p.owner2
                    ),

                County:
                    cleanValue(
                        p.county
                    ),

                STEWARD:
                    "Idaho Department of Lands / WhiteStar",

                UPDATED:
                    cleanValue(
                        p.amoddate
                    ),

                ASR_ACRES:
                    p.acreage,

                SITE_ADD:
                    cleanValue(
                        p.propfuladd
                    ),

                SITE_CITY:
                    cleanValue(
                        p.propcity
                    ),

                SITE_ZIP:
                    cleanValue(
                        p.propzip
                    ),

                VAL_TOTAL:
                    p.totalvalue,

                MAIL_ADD1:
                    cleanValue(
                        p.mailfuladd
                    ),

                MAIL_CITY:
                    cleanValue(
                        p.mailcity
                    ),

                MAIL_STATE:
                    cleanValue(
                        p.mailstate
                    ),

                MAIL_ZIP:
                    cleanValue(
                        p.mailzip
                    ),

                PUBLIC_STD:
                    "",

                SOURCE:
                    "WhiteStar",

                TAX_ACCOUNT:
                    cleanValue(
                        p.taxacctnum
                    ),

                RAW_APN:
                    cleanValue(
                        p.apn
                    ),

                WHITE_STAR_ID:
                    cleanValue(
                        p.wstar_id
                    )

            }

        };

    }


    /* =====================================================
       NORMALIZE IDWR
    ===================================================== */

    function normalizeIDWRFeature(
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
                    cleanValue(
                        p.PIN
                    ),

                FP_ID:
                    cleanValue(
                        p.PIN
                    ),

                OWNER1:
                    cleanValue(
                        p.OWNER
                    ),

                OWNER2:
                    "",

                County:
                    cleanValue(
                        p.COUNTY
                    ),

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
                    "",

                SOURCE:
                    "IDWR"

            }

        };

    }


    /* =====================================================
       PARCEL QUALITY
    ===================================================== */

    function parcelQuality(
        feature
    ) {

        if (!feature) {

            return 0;

        }


        const p =
            feature.properties ||
            {};


        let score = 0;


        if (
            cleanValue(
                p.OWNER1
            )
        ) {

            score += 50;

        }


        if (
            cleanValue(
                p.OWNER2
            )
        ) {

            score += 10;

        }


        if (
            cleanValue(
                p.SITE_ADD
            )
        ) {

            score += 30;

        }


        if (
            cleanValue(
                p.SITE_CITY
            )
        ) {

            score += 10;

        }


        if (
            cleanValue(
                p.SITE_ZIP
            )
        ) {

            score += 5;

        }


        if (
            cleanValue(
                p.County
            )
        ) {

            score += 10;

        }


        if (
            cleanValue(
                p.ASR_ACRES
            )
        ) {

            score += 5;

        }


        if (
            cleanValue(
                p.VAL_TOTAL
            )
        ) {

            score += 5;

        }


        if (
            feature.geometry
        ) {

            score += 5;

        }


        return score;

    }


    /* =====================================================
       MERGE PARCEL RECORDS
    ===================================================== */

    function mergeParcelRecords(
        records
    ) {

        const valid =
            records.filter(
                Boolean
            );


        if (!valid.length) {

            return null;

        }


        /*
         * Start with the highest-quality source.
         */
        valid.sort(
            (a, b) =>
                parcelQuality(b) -
                parcelQuality(a)
        );


        const best =
            valid[0];


        const merged = {

            type:
                "Feature",

            geometry:
                best.geometry ||
                null,

            properties: {

                ...(best.properties || {})

            }

        };


        /*
         * Fill missing fields from every other source.
         */
        for (
            let i = 1;
            i < valid.length;
            i++
        ) {

            const p =
                valid[i].properties ||
                {};

            const m =
                merged.properties;


            const fields = [

                "PARCEL_ID",

                "FP_ID",

                "OWNER1",

                "OWNER2",

                "County",

                "STEWARD",

                "UPDATED",

                "ASR_ACRES",

                "SITE_ADD",

                "SITE_CITY",

                "SITE_ZIP",

                "VAL_TOTAL",

                "MAIL_ADD1",

                "MAIL_ADD2",

                "MAIL_CITY",

                "MAIL_STATE",

                "MAIL_ZIP",

                "PUBLIC_STD",

                "SOURCE",

                "TAX_ACCOUNT",

                "RAW_APN",

                "WHITE_STAR_ID"

            ];


            fields.forEach(
                field => {

                    if (
                        !cleanValue(
                            m[field]
                        ) &&
                        cleanValue(
                            p[field]
                        )
                    ) {

                        m[field] =
                            p[field];

                    }

                }
            );


            /*
             * Prefer geometry from a source that actually
             * returned it.
             */
            if (
                !merged.geometry &&
                valid[i].geometry
            ) {

                merged.geometry =
                    valid[i].geometry;

            }

        }


        /*
         * Keep track of all sources that contributed.
         */
        const sources =
            valid
                .map(
                    feature =>
                        feature.properties
                            ?.SOURCE ||
                        feature.properties
                            ?.STEWARD
                )
                .filter(Boolean);


        merged.properties.SOURCES =
            [...new Set(sources)].join(
                " + "
            );


        return merged;

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
                p.RAW_APN
            ) ||

            cleanValue(
                p.TAX_ACCOUNT
            ) ||

            cleanValue(
                p.WHITE_STAR_ID
            ) ||

            cleanValue(
                p.PIN
            ) ||

            cleanValue(
                p.OBJECTID
            )

        );

    }


    /* =====================================================
       CREATE VIEWPORT TILES
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


        const zoom =
            map.getZoom();


        /*
         * At high zoom the viewport is small enough that
         * one request per source is preferable.
         *
         * At lower parcel zooms we split the viewport so
         * ArcGIS does not hit its record limit as easily.
         */

        let columns = 1;
        let rows = 1;


        if (zoom >= 13) {

            columns = 1;
            rows = 1;

        } else if (zoom >= 11) {

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
         * Don't query millions of parcels when viewing
         * the whole state.
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
             * Only two tile workers at a time.
             */
            const concurrency =
                Math.min(
                    2,
                    tiles.length
                );


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
                            Math.round(
                                map.getZoom()
                            )
                        ].join("|");


                    /*
                     * Cache source results separately.
                     */
                    if (
                        parcelCache.has(
                            tileKey
                        )
                    ) {

                        allFeatures.push(
                            ...parcelCache.get(
                                tileKey
                            )
                        );

                        continue;

                    }


                    try {

                        /*
                         * Primary + WhiteStar together.
                         *
                         * This is the key change.
                         */
                        const results =
                            await Promise.allSettled([

                                requestPrimaryParcels(
                                    tile,
                                    signal
                                ),

                                requestWhiteStarParcels(
                                    tile,
                                    signal
                                )

                            ]);


                        let tileFeatures = [];


                        results.forEach(
                            result => {

                                if (
                                    result.status ===
                                    "fulfilled"
                                ) {

                                    tileFeatures.push(
                                        ...result.value
                                    );

                                }

                            }
                        );


                        /*
                         * If BOTH major sources failed,
                         * try IDWR.
                         */
                        if (
                            tileFeatures.length === 0
                        ) {

                            try {

                                const idwr =
                                    await requestIDWRParcels(
                                        tile,
                                        signal
                                    );


                                tileFeatures.push(
                                    ...idwr
                                );

                            } catch (
                                idwrError
                            ) {

                                if (
                                    idwrError.name ===
                                    "AbortError"
                                ) {

                                    throw idwrError;

                                }


                                console.warn(
                                    "IDWR tile failed:",
                                    idwrError
                                );

                            }

                        }


                        /*
                         * Deduplicate this tile.
                         */
                        const tileUnique =
                            new Map();


                        tileFeatures.forEach(
                            feature => {

                                const id =
                                    getParcelID(
                                        feature
                                    );


                                if (!id) {

                                    return;

                                }


                                const existing =
                                    tileUnique.get(
                                        id
                                    );


                                if (!existing) {

                                    tileUnique.set(
                                        id,
                                        feature
                                    );

                                } else {

                                    const merged =
                                        mergeParcelRecords(
                                            [
                                                existing,
                                                feature
                                            ]
                                        );


                                    tileUnique.set(
                                        id,
                                        merged
                                    );

                                }

                            }
                        );


                        const normalizedFeatures =
                            Array.from(
                                tileUnique.values()
                            );


                        parcelCache.set(
                            tileKey,
                            normalizedFeatures
                        );


                        allFeatures.push(
                            ...normalizedFeatures
                        );


                    } catch (error) {

                        if (
                            error.name ===
                            "AbortError"
                        ) {

                            throw error;

                        }


                        console.warn(
                            "Parcel tile failed:",
                            error
                        );

                    }

                }

            }


            const workers =
                Array.from(
                    {
                        length:
                            concurrency
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
             * Final deduplication.
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


                    const existing =
                        unique.get(
                            id
                        );


                    if (!existing) {

                        unique.set(
                            id,
                            feature
                        );

                    } else {

                        unique.set(
                            id,
                            mergeParcelRecords(
                                [
                                    existing,
                                    feature
                                ]
                            )
                        );

                    }

                }
            );


            const features =
                Array.from(
                    unique.values()
                );


            if (
                features.length === 0
            ) {

                setStatus(
                    "No parcel boundaries found in this area"
                );

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

                            color:
                                "#ffffff",

                            weight:
                                0.7,

                            opacity:
                                0.75,

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
             * Re-highlight the selected property.
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
                "Parcel services temporarily unavailable"
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
                    350
                );

        }
    );


    /* =====================================================
       POINT QUERY PARAMS
    ===================================================== */

    function createPointParams(
        latlng,
        fields
    ) {

        return new URLSearchParams({

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
                fields,

            returnGeometry:
                "true",

            outSR:
                "4326",

            resultRecordCount:
                "5",

            f:
                "geojson"

        });

    }


    /* =====================================================
       PRIMARY POINT LOOKUP
    ===================================================== */

    async function requestPrimaryPoint(
        latlng
    ) {

        const params =
            createPointParams(
                latlng,
                PRIMARY_FIELDS
            );


        const response =
            await fetch(
                `${PARCEL_URL}/query?${params.toString()}`
            );


        if (!response.ok) {

            throw new Error(
                "Primary point HTTP failure"
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "Primary point service error"
            );

        }


        return data.features?.[0] ||
            null;

    }


    /* =====================================================
       WHITESTAR POINT LOOKUP
    ===================================================== */

    async function requestWhiteStarPoint(
        latlng
    ) {

        const params =
            createPointParams(
                latlng,
                WHITESTAR_FIELDS
            );


        const response =
            await fetch(
                `${WHITESTAR_URL}/query?${params.toString()}`
            );


        if (!response.ok) {

            throw new Error(
                "WhiteStar point HTTP failure"
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "WhiteStar point service error"
            );

        }


        return data.features?.[0]
            ? normalizeWhiteStarFeature(
                data.features[0]
              )
            : null;

    }


    /* =====================================================
       IDWR POINT LOOKUP
    ===================================================== */

    async function requestIDWRPoint(
        latlng
    ) {

        const params =
            createPointParams(
                latlng,
                IDWR_FIELDS
            );


        const response =
            await fetch(
                `${IDWR_URL}/query?${params.toString()}`
            );


        if (!response.ok) {

            throw new Error(
                "IDWR point HTTP failure"
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "IDWR point service error"
            );

        }


        return data.features?.[0]
            ? normalizeIDWRFeature(
                data.features[0]
              )
            : null;

    }


    /* =====================================================
       FIND PARCEL AT POINT
    ===================================================== */

    async function findParcelAtPoint(
        latlng
    ) {

        if (
            map.getZoom() < 9
        ) {

            showMapLocation(
                latlng
            );

            return;

        }


        setStatus(
            "Checking multiple parcel sources..."
        );


        try {

            /*
             * Ask both major sources at the same time.
             */
            const results =
                await Promise.allSettled([

                    requestPrimaryPoint(
                        latlng
                    ),

                    requestWhiteStarPoint(
                        latlng
                    )

                ]);


            const records = [];


            results.forEach(
                result => {

                    if (
                        result.status ===
                        "fulfilled" &&
                        result.value
                    ) {

                        records.push(
                            result.value
                        );

                    }

                }
            );


            /*
             * If both major sources missed it,
             * try IDWR.
             */
            if (
                records.length === 0
            ) {

                try {

                    const idwr =
                        await requestIDWRPoint(
                            latlng
                        );


                    if (idwr) {

                        records.push(
                            idwr
                        );

                    }

                } catch (error) {

                    console.warn(
                        "IDWR point lookup failed:",
                        error
                    );

                }

            }


            if (
                records.length === 0
            ) {

                showMapLocation(
                    latlng
                );

                return;

            }


            /*
             * Merge all available information.
             */
            const merged =
                mergeParcelRecords(
                    records
                );


            if (!merged) {

                showMapLocation(
                    latlng
                );

                return;

            }


            showParcel(
                merged
            );


        } catch (error) {

            console.error(
                "Point lookup failed:",
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

            await findParcelAtPoint(
                event.latlng
            );

        }
    );


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


        setStatus(
            "No parcel found at this location"
        );

    }


    /* =====================================================
       HIGHLIGHT
    ===================================================== */

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


        const owner2 =
            cleanValue(
                p.OWNER2
            );


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

                ? formatNumber(
                    p.ASR_ACRES,
                    2
                  )

                : "Unavailable";


        const parcelID =
            selectedParcelID ||
            "Unavailable";


        const assessed =
            p.VAL_TOTAL !== null &&
            p.VAL_TOTAL !== undefined &&
            p.VAL_TOTAL !== ""

                ? formatCurrency(
                    p.VAL_TOTAL
                  )

                : "Unavailable";


        const source =
            cleanValue(
                p.SOURCES
            ) ||

            cleanValue(
                p.STEWARD
            ) ||

            "Public GIS";


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


            ${
                owner2
                    ? `
                        <div class="property-field">

                            <div class="property-label">
                                Additional Owner
                            </div>

                            <div class="property-value">
                                ${escapeHTML(owner2)}
                            </div>

                        </div>
                    `
                    : ""
            }


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
                    Data Sources
                </div>

                <div class="property-value">
                    ${escapeHTML(source)}
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
                        "Public GIS"
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
                    event.key ===
                    "Enter"
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

                Searching multiple Idaho property databases...

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


        /*
         * PRIMARY SEARCH
         */
        const primaryWhere =
            `PARCEL_ID LIKE '%${safeQuery}%' OR ` +
            `OWNER1 LIKE '%${safeQuery}%' OR ` +
            `OWNER2 LIKE '%${safeQuery}%' OR ` +
            `SITE_ADD LIKE '%${safeQuery}%' OR ` +
            `SITE_CITY LIKE '%${safeQuery}%' OR ` +
            `FP_ID LIKE '%${safeQuery}%'`;


        /*
         * WHITESTAR SEARCH
         */
        const whiteStarWhere =
            `apn LIKE '%${safeQuery}%' OR ` +
            `legacypapn LIKE '%${safeQuery}%' OR ` +
            `owner1 LIKE '%${safeQuery}%' OR ` +
            `owner2 LIKE '%${safeQuery}%' OR ` +
            `propfuladd LIKE '%${safeQuery}%' OR ` +
            `propcity LIKE '%${safeQuery}%' OR ` +
            `taxacctnum LIKE '%${safeQuery}%'`;


        const primaryParams =
            new URLSearchParams({

                where:
                    primaryWhere,

                outFields:
                    PRIMARY_FIELDS,

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "100",

                f:
                    "geojson"

            });


        const whiteStarParams =
            new URLSearchParams({

                where:
                    whiteStarWhere,

                outFields:
                    WHITESTAR_FIELDS,

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                resultRecordCount:
                    "100",

                f:
                    "geojson"

            });


        try {

            const results =
                await Promise.allSettled([

                    fetch(
                        `${PARCEL_URL}/query?${primaryParams.toString()}`
                    ),

                    fetch(
                        `${WHITESTAR_URL}/query?${whiteStarParams.toString()}`
                    )

                ]);


            const features = [];


            /*
             * Primary results.
             */
            if (
                results[0].status ===
                "fulfilled"
            ) {

                try {

                    const response =
                        results[0].value;


                    if (
                        response.ok
                    ) {

                        const data =
                            await response.json();


                        if (
                            !data.error &&
                            Array.isArray(
                                data.features
                            )
                        ) {

                            features.push(
                                ...data.features
                            );

                        }

                    }

                } catch (
                    primaryError
                ) {

                    console.warn(
                        "Primary search parsing failed:",
                        primaryError
                    );

                }

            }


            /*
             * WhiteStar results.
             */
            if (
                results[1].status ===
                "fulfilled"
            ) {

                try {

                    const response =
                        results[1].value;


                    if (
                        response.ok
                    ) {

                        const data =
                            await response.json();


                        if (
                            !data.error &&
                            Array.isArray(
                                data.features
                            )
                        ) {

                            features.push(
                                ...data.features.map(
                                    normalizeWhiteStarFeature
                                )
                            );

                        }

                    }

                } catch (
                    whiteStarError
                ) {

                    console.warn(
                        "WhiteStar search parsing failed:",
                        whiteStarError
                    );

                }

            }


            /*
             * If neither major source returned anything,
             * try IDWR.
             */
            if (
                features.length === 0
            ) {

                try {

                    const idwrParams =
                        new URLSearchParams({

                            where:
                                `PIN LIKE '%${safeQuery}%' OR OWNER LIKE '%${safeQuery}%'`,

                            outFields:
                                IDWR_FIELDS,

                            returnGeometry:
                                "true",

                            outSR:
                                "4326",

                            resultRecordCount:
                                "100",

                            f:
                                "geojson"

                        });


                    const response =
                        await fetch(
                            `${IDWR_URL}/query?${idwrParams.toString()}`
                        );


                    if (
                        response.ok
                    ) {

                        const data =
                            await response.json();


                        if (
                            !data.error &&
                            Array.isArray(
                                data.features
                            )
                        ) {

                            features.push(
                                ...data.features.map(
                                    normalizeIDWRFeature
                                )
                            );

                        }

                    }

                } catch (
                    idwrError
                ) {

                    console.warn(
                        "IDWR search failed:",
                        idwrError
                    );

                }

            }


            if (
                features.length === 0
            ) {

                resultsContent.innerHTML = `

                    <div class="search-result">

                        <div class="search-result-title">
                            No properties found
                        </div>

                        <div class="search-result-details">
                            Try an owner name, address,
                            parcel ID, APN, city, or tax account.
                        </div>

                    </div>

                `;


                return;

            }


            /*
             * Normalize everything.
             */
            const normalizedFeatures =
                features.map(
                    feature => {

                        const source =
                            feature.properties
                                ?.SOURCE;


                        if (
                            source ===
                            "WhiteStar"
                        ) {

                            return feature;

                        }


                        if (
                            source ===
                            "IDWR"
                        ) {

                            return feature;

                        }


                        return feature;

                    }
                );


            /*
             * Deduplicate.
             */
            const unique =
                new Map();


            normalizedFeatures.forEach(
                feature => {

                    const id =
                        getParcelID(
                            feature
                        );


                    if (!id) {

                        return;

                    }


                    const existing =
                        unique.get(
                            id
                        );


                    if (!existing) {

                        unique.set(
                            id,
                            feature
                        );

                    } else {

                        unique.set(
                            id,
                            mergeParcelRecords(
                                [
                                    existing,
                                    feature
                                ]
                            )
                        );

                    }

                }
            );


            const resultFeatures =
                Array.from(
                    unique.values()
                );


            /*
             * Search relevance scoring.
             */
            const normalizedQuery =
                query.toLowerCase();


            function searchScore(
                feature
            ) {

                const p =
                    feature.properties ||
                    {};


                const fields = [

                    cleanValue(
                        p.OWNER1
                    ),

                    cleanValue(
                        p.OWNER2
                    ),

                    cleanValue(
                        p.SITE_ADD
                    ),

                    cleanValue(
                        p.SITE_CITY
                    ),

                    cleanValue(
                        p.PARCEL_ID
                    ),

                    cleanValue(
                        p.FP_ID
                    ),

                    cleanValue(
                        p.RAW_APN
                    ),

                    cleanValue(
                        p.TAX_ACCOUNT
                    )

                ]
                .map(
                    value =>
                        value.toLowerCase()
                );


                let score = 0;


                fields.forEach(
                    value => {

                        if (
                            value ===
                            normalizedQuery
                        ) {

                            score += 100;

                        } else if (
                            value.startsWith(
                                normalizedQuery
                            )
                        ) {

                            score += 50;

                        } else if (
                            value.includes(
                                normalizedQuery
                            )
                        ) {

                            score += 20;

                        }

                    }
                );


                score +=
                    parcelQuality(
                        feature
                    ) *
                    0.1;


                return score;

            }


            resultFeatures.sort(
                (
                    a,
                    b
                ) =>
                    searchScore(b) -
                    searchScore(a)
            );


            resultsContent.innerHTML =
                resultFeatures
                    .slice(
                        0,
                        100
                    )
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


                            const parcelID =
                                getParcelID(
                                    feature
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
                                                parcelID ||
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
                                        element.dataset
                                            .resultIndex
                                    );


                                selectSearchResult(
                                    resultFeatures[
                                        index
                                    ]
                                );

                            }
                        );

                    }
                );


            setStatus(
                `${resultFeatures.length.toLocaleString()} matching properties found`
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
                        The public GIS services did not
                        return a usable result. Try again.
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
                        Idaho Public Parcels
                    </h2>

                    <p>
                        Primary statewide standardized
                        public parcel source.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        WhiteStar Parcels
                    </h2>

                    <p>
                        Idaho Department of Lands parcel
                        compilation containing parcel,
                        owner, address, acreage, and
                        assessment information where available.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Idaho Water Resources
                    </h2>

                    <p>
                        Additional Idaho parcel compilation
                        used as a third fallback source.
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
                            parcel ID, APN, or tax account.
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


    function formatNumber(
        value,
        decimals = 2
    ) {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "Unavailable";

        }


        return number.toLocaleString(
            undefined,
            {
                maximumFractionDigits:
                    decimals
            }
        );

    }


    function formatCurrency(
        value
    ) {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {

            return "Unavailable";

        }


        return "$" +
            number.toLocaleString(
                undefined,
                {
                    maximumFractionDigits:
                        0
                }
            );

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
     * Parcel loading waits until the map has initialized.
     *
     * At zoom 6 it will immediately stop because parcels
     * are intentionally disabled until zoom 9.
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
        "ParcelScope Idaho initialized — MULTI-SOURCE PARCEL ENGINE v2.0"
    );

});
