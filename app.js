/* =========================================================
   PARCELSCOPE IDAHO
   Main Application
   MULTI-SOURCE PARCEL SYSTEM
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
       PARCEL DATA SOURCES
    ===================================================== */

    /*
     * SOURCE 1
     * Idaho IDWR statewide parcel compilation.
     *
     * Includes Bonner and Boundary Counties.
     */

    const IDWR_PARCEL_URL =
        "https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0";


    /*
     * SOURCE 2
     * Bonner County GIS parcel layer.
     */

    const BONNER_PARCEL_URL =
        "https://services5.arcgis.com/lIHH39JBU3FScVe5/ArcGIS/rest/services/220100_Bayview_WS_District_v6_WFL1/FeatureServer/23";


    /*
     * SOURCE 3
     * Boundary County parcel layer.
     */

    const BOUNDARY_PARCEL_URL =
        "https://services5.arcgis.com/4CllgMSJJaeToEFP/ArcGIS/rest/services/Zoning_Map_Online/FeatureServer/2";


    /* =====================================================
       BOUNDARY SOURCES
    ===================================================== */

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
       MAP LAYERS
    ===================================================== */

    let countyLayer = null;
    let idahoLayer = null;
    let parcelLayer = null;

    let selectedParcelLayer = null;
    let selectedParcelID = null;

    let parcelRequestController = null;
    let moveTimer = null;


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
       MENU
    ===================================================== */

    function openMenu() {

        sideMenu.classList.add("open");

    }


    function closeMenuPanel() {

        sideMenu.classList.remove("open");

    }


    menuButton.addEventListener(
        "click",
        () => {

            if (
                sideMenu.classList.contains("open")
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

            propertyPanel.classList.remove("open");

        }
    );


    closeResults.addEventListener(
        "click",
        () => {

            searchResults.classList.remove("open");

        }
    );


    closeAppPage.addEventListener(
        "click",
        () => {

            appPage.classList.remove("open");

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

        appPage.classList.add("open");

        closeMenuPanel();

    }


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on("click", () => {

        closeMenuPanel();

    });


    /* =====================================================
       COUNTY + STATE BOUNDARIES
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
       PARCEL SOURCE HELPERS
    ===================================================== */

    function getViewportGeometry() {

        const bounds =
            map.getBounds();

        return [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(",");

    }


    /*
     * Returns the approximate center of the current map.
     */

    function getMapCenter() {

        return map.getCenter();

    }


    /*
     * Northern Idaho detection.
     *
     * Bonner and Boundary are far north, so we use
     * the county-specific sources when the viewport
     * reaches that area.
     */

    function isNorthernIdaho() {

        const center =
            getMapCenter();

        return (
            center.lat >= 47.0
        );

    }


    /*
     * Determines which county-specific sources should
     * be queried.
     *
     * We don't use these everywhere because doing so
     * would unnecessarily increase requests.
     */

    function getRegionalSources() {

        const center =
            getMapCenter();


        const sources = [];


        /*
         * Bonner County is roughly north of 47.3 and
         * west of 116.5.
         */

        if (
            center.lat >= 47.0 &&
            center.lat <= 49.0 &&
            center.lng <= -115.5 &&
            center.lng >= -117.5
        ) {

            sources.push({
                name: "Bonner County",
                url: BONNER_PARCEL_URL,
                fields:
                    "OBJECTID,PIN,Owner,Owner2,Acreage",
                sourceType: "bonner"
            });

        }


        /*
         * Boundary County.
         */

        if (
            center.lat >= 48.0 &&
            center.lat <= 49.1 &&
            center.lng <= -115.0 &&
            center.lng >= -117.0
        ) {

            sources.push({
                name: "Boundary County",
                url: BOUNDARY_PARCEL_URL,
                fields:
                    "OBJECTID,PARCEL_ID,CALC_ACRES,PS_MAIL_NM,PS_PROP_AD,PS_MAIL_CT,PS_MAIL_ZP,PS_TOT_VAL,PS_NET_VAL",
                sourceType: "boundary"
            });

        }


        return sources;

    }


    /* =====================================================
       NORMALIZE PARCEL
    ===================================================== */

    function normalizeParcel(
        feature,
        sourceName
    ) {

        const p =
            feature?.properties || {};


        let parcelID =
            cleanValue(
                p.PARCEL_ID
            ) ||
            cleanValue(
                p.PIN
            ) ||
            cleanValue(
                p.FP_ID
            ) ||
            cleanValue(
                p.OBJECTID
            );


        let owner =
            cleanValue(
                p.OWNER1
            ) ||
            cleanValue(
                p.OWNER
            ) ||
            cleanValue(
                p.Owner
            ) ||
            cleanValue(
                p.PS_MAIL_NM
            );


        let owner2 =
            cleanValue(
                p.OWNER2
            ) ||
            cleanValue(
                p.Owner2
            );


        let acreage =
            p.ASR_ACRES ??
            p.Acreage ??
            p.CALC_ACRES;


        let address =
            cleanValue(
                p.SITE_ADD
            ) ||
            cleanValue(
                p.PS_PROP_AD
            );


        let city =
            cleanValue(
                p.SITE_CITY
            ) ||
            cleanValue(
                p.PS_MAIL_CT
            );


        let zip =
            cleanValue(
                p.SITE_ZIP
            ) ||
            cleanValue(
                p.PS_MAIL_ZP
            );


        let value =
            p.VAL_TOTAL ??
            p.PS_TOT_VAL ??
            p.PS_NET_VAL;


        let county =
            cleanValue(
                p.County
            ) ||
            cleanValue(
                p.COUNTY
            );


        if (
            !county &&
            sourceName === "Bonner County"
        ) {

            county = "Bonner";

        }


        if (
            !county &&
            sourceName === "Boundary County"
        ) {

            county = "Boundary";

        }


        return {

            ...feature,

            properties: {

                ...p,

                PARCEL_ID:
                    parcelID,

                OWNER1:
                    owner,

                OWNER2:
                    owner2,

                ASR_ACRES:
                    acreage,

                SITE_ADD:
                    address,

                SITE_CITY:
                    city,

                SITE_ZIP:
                    zip,

                VAL_TOTAL:
                    value,

                County:
                    county,

                _source:
                    sourceName

            }

        };

    }


    /* =====================================================
       GEOMETRY FINGERPRINT
    ===================================================== */

    function geometryFingerprint(
        feature
    ) {

        try {

            const layer =
                L.geoJSON(
                    feature
                );


            const bounds =
                layer.getBounds();


            if (
                !bounds.isValid()
            ) {

                return "";

            }


            const center =
                bounds.getCenter();


            const north =
                bounds.getNorth();


            const south =
                bounds.getSouth();


            const east =
                bounds.getEast();


            const west =
                bounds.getWest();


            /*
             * Rounding prevents tiny geometry differences
             * between sources from creating duplicates.
             */

            return [
                center.lat.toFixed(5),
                center.lng.toFixed(5),
                north.toFixed(5),
                south.toFixed(5),
                east.toFixed(5),
                west.toFixed(5)
            ].join("|");

        } catch {

            return "";

        }

    }


    /* =====================================================
       DUPLICATE FILTER
    ===================================================== */

    function deduplicateParcels(
        features
    ) {

        const byParcelID =
            new Map();

        const withoutIDs = [];


        /*
         * First pass:
         * use parcel IDs whenever available.
         */

        features.forEach(
            feature => {

                const p =
                    feature.properties ||
                    {};


                const id =
                    cleanValue(
                        p.PARCEL_ID
                    );


                if (!id) {

                    withoutIDs.push(
                        feature
                    );

                    return;

                }


                const key =
                    [
                        cleanValue(
                            p.County
                        ).toLowerCase(),
                        id.toLowerCase()
                    ].join("|");


                if (
                    !byParcelID.has(key)
                ) {

                    byParcelID.set(
                        key,
                        feature
                    );

                } else {

                    const existing =
                        byParcelID.get(
                            key
                        );


                    byParcelID.set(
                        key,
                        chooseBetterParcel(
                            existing,
                            feature
                        )
                    );

                }

            }
        );


        /*
         * Second pass:
         * catch duplicates where two sources use
         * different parcel ID formats.
         */

        const finalFeatures =
            Array.from(
                byParcelID.values()
            );


        const geometryKeys =
            new Set();


        finalFeatures.forEach(
            feature => {

                const key =
                    geometryFingerprint(
                        feature
                    );


                if (key) {

                    geometryKeys.add(
                        key
                    );

                }

            }
        );


        withoutIDs.forEach(
            feature => {

                const key =
                    geometryFingerprint(
                        feature
                    );


                if (
                    !key ||
                    !geometryKeys.has(
                        key
                    )
                ) {

                    finalFeatures.push(
                        feature
                    );

                    if (key) {

                        geometryKeys.add(
                            key
                        );

                    }

                }

            }
        );


        return finalFeatures;

    }


    /* =====================================================
       CHOOSE BEST RECORD
    ===================================================== */

    function chooseBetterParcel(
        a,
        b
    ) {

        const scoreA =
            parcelCompletenessScore(
                a
            );


        const scoreB =
            parcelCompletenessScore(
                b
            );


        return scoreB > scoreA
            ? b
            : a;

    }


    function parcelCompletenessScore(
        feature
    ) {

        const p =
            feature?.properties ||
            {};


        let score = 0;


        const fields = [

            "PARCEL_ID",
            "OWNER1",
            "OWNER2",
            "SITE_ADD",
            "SITE_CITY",
            "SITE_ZIP",
            "County",
            "ASR_ACRES",
            "VAL_TOTAL"

        ];


        fields.forEach(
            field => {

                if (
                    cleanValue(
                        p[field]
                    )
                ) {

                    score += 1;

                }

            }
        );


        /*
         * Prefer county-specific data when available.
         */

        if (
            p._source ===
            "Bonner County"
        ) {

            score += 5;

        }


        if (
            p._source ===
            "Boundary County"
        ) {

            score += 5;

        }


        /*
         * Prefer actual geometry.
         */

        if (
            feature.geometry
        ) {

            score += 5;

        }


        return score;

    }


    /* =====================================================
       QUERY ONE PARCEL SOURCE
    ===================================================== */

    async function queryParcelSource(
        source,
        geometry,
        signal
    ) {

        const params =
            new URLSearchParams({

                where: "1=1",

                geometry:
                    geometry,

                geometryType:
                    "esriGeometryEnvelope",

                inSR:
                    "4326",

                spatialRel:
                    "esriSpatialRelIntersects",

                outFields:
                    source.fields,

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
                `${source.url}/query?${params.toString()}`,
                {
                    signal
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `${source.name} returned HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                data.error.message ||
                `${source.name} returned an ArcGIS error`
            );

        }


        const features =
            Array.isArray(
                data.features
            )
                ? data.features
                : [];


        return features.map(
            feature =>
                normalizeParcel(
                    feature,
                    source.name
                )
        );

    }


    /* =====================================================
       LOAD PARCELS
    ===================================================== */

    async function loadParcels() {

        if (
            !settings.parcels
        ) {

            if (
                parcelLayer
            ) {

                map.removeLayer(
                    parcelLayer
                );

            }

            return;

        }


        /*
         * Do not draw parcels across the entire state.
         */

        if (
            map.getZoom() < 10
        ) {

            if (
                parcelLayer
            ) {

                map.removeLayer(
                    parcelLayer
                );

            }


            setStatus(
                "Zoom in to view parcel boundaries"
            );


            return;

        }


        if (
            parcelRequestController
        ) {

            parcelRequestController.abort();

        }


        parcelRequestController =
            new AbortController();


        const signal =
            parcelRequestController.signal;


        const geometry =
            getViewportGeometry();


        /*
         * Main statewide source.
         */

        const sources = [

            {
                name:
                    "Idaho IDWR",

                url:
                    IDWR_PARCEL_URL,

                fields:
                    "OBJECTID,PIN,COUNTY,OWNER"

            }

        ];


        /*
         * Add county-specific sources where
         * they are useful.
         */

        const regionalSources =
            getRegionalSources();


        regionalSources.forEach(
            source => {

                sources.push(
                    source
                );

            }
        );


        try {

            setStatus(
                regionalSources.length
                    ? "Loading parcel boundaries from multiple GIS sources..."
                    : "Loading parcel boundaries..."
            );


            /*
             * Query all sources simultaneously.
             */

            const results =
                await Promise.allSettled(

                    sources.map(
                        source =>
                            queryParcelSource(
                                source,
                                geometry,
                                signal
                            )
                    )

                );


            if (
                signal.aborted
            ) {

                return;

            }


            let allFeatures = [];


            let successfulSources =
                0;


            results.forEach(
                result => {

                    if (
                        result.status ===
                        "fulfilled"
                    ) {

                        successfulSources +=
                            1;


                        allFeatures =
                            allFeatures.concat(
                                result.value
                            );

                    } else {

                        console.warn(
                            "Parcel source failed:",
                            result.reason
                        );

                    }

                }
            );


            /*
             * The site should still work if one source
             * is unavailable.
             */

            if (
                !successfulSources
            ) {

                throw new Error(
                    "All parcel sources failed"
                );

            }


            /*
             * Strong duplicate filtering.
             */

            const uniqueFeatures =
                deduplicateParcels(
                    allFeatures
                );


            /*
             * Remove the previous parcel layer.
             */

            if (
                parcelLayer
            ) {

                map.removeLayer(
                    parcelLayer
                );

            }


            parcelLayer =
                L.geoJSON(
                    {
                        type:
                            "FeatureCollection",

                        features:
                            uniqueFeatures
                    },
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


            setStatus(
                `${uniqueFeatures.length.toLocaleString()} parcel boundaries loaded`
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

    map.on(
        "moveend",
        () => {

            clearTimeout(
                moveTimer
            );


            moveTimer =
                setTimeout(
                    loadParcels,
                    350
                );

        }
    );


    /* =====================================================
       CLICK A PROPERTY
    ===================================================== */

    map.on(
        "click",
        async event => {

            if (
                map.getZoom() < 10
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


        const sources = [

            {
                name:
                    "Idaho IDWR",

                url:
                    IDWR_PARCEL_URL,

                fields:
                    "OBJECTID,PIN,COUNTY,OWNER"

            }

        ];


        getRegionalSources()
            .forEach(
                source =>
                    sources.push(
                        source
                    )
            );


        try {

            setStatus(
                "Finding property..."
            );


            const results =
                await Promise.allSettled(

                    sources.map(
                        source => {

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
                                        source.fields,

                                    returnGeometry:
                                        "true",

                                    outSR:
                                        "4326",

                                    resultRecordCount:
                                        "10",

                                    f:
                                        "geojson"

                                });


                            return fetch(
                                `${source.url}/query?${params.toString()}`
                            )
                            .then(
                                response => {

                                    if (
                                        !response.ok
                                    ) {

                                        throw new Error(
                                            `${source.name} failed`
                                        );

                                    }


                                    return response.json();

                                }
                            )
                            .then(
                                data => {

                                    return (
                                        data.features ||
                                        []
                                    ).map(
                                        feature =>
                                            normalizeParcel(
                                                feature,
                                                source.name
                                            )
                                    );

                                }
                            );

                        }
                    )

                );


            let features = [];


            results.forEach(
                result => {

                    if (
                        result.status ===
                        "fulfilled"
                    ) {

                        features =
                            features.concat(
                                result.value
                            );

                    }

                }
            );


            features =
                deduplicateParcels(
                    features
                );


            if (
                features.length
            ) {

                /*
                 * Prefer the most complete record.
                 */

                features.sort(
                    (
                        a,
                        b
                    ) =>
                        parcelCompletenessScore(
                            b
                        ) -
                        parcelCompletenessScore(
                            a
                        )
                );


                showParcel(
                    features[0]
                );


            } else {

                showMapLocation(
                    latlng
                );

            }


        } catch (error) {

            console.error(
                "Point parcel search error:",
                error
            );


            showMapLocation(
                latlng
            );

        }

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
                    Zoom in closer to select a parcel.
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


        return cleanValue(
            p.PARCEL_ID
        ) ||
        cleanValue(
            p.PIN
        ) ||
        cleanValue(
            p.FP_ID
        ) ||
        cleanValue(
            p.OBJECTID
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


        if (
            sourceLayer
        ) {

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
                    ${escapeHTML(
                        parcelID
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    County
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        county
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Acreage
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        acres
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Total Assessed Value
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        assessed
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Data Source
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        cleanValue(
                            p._source
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
            query.replaceAll(
                "'",
                "''"
            );


        const sources = [

            {
                name:
                    "Idaho IDWR",

                url:
                    IDWR_PARCEL_URL,

                fields:
                    "OBJECTID,PIN,COUNTY,OWNER",

                where:
                    `PIN LIKE '%${safeQuery}%' OR OWNER LIKE '%${safeQuery}%' OR COUNTY LIKE '%${safeQuery}%'`

            },

            {
                name:
                    "Bonner County",

                url:
                    BONNER_PARCEL_URL,

                fields:
                    "OBJECTID,PIN,Owner,Owner2,Acreage",

                where:
                    `PIN LIKE '%${safeQuery}%' OR Owner LIKE '%${safeQuery}%' OR Owner2 LIKE '%${safeQuery}%'`

            },

            {
                name:
                    "Boundary County",

                url:
                    BOUNDARY_PARCEL_URL,

                fields:
                    "OBJECTID,PARCEL_ID,CALC_ACRES,PS_MAIL_NM,PS_PROP_AD,PS_MAIL_CT,PS_MAIL_ZP,PS_TOT_VAL,PS_NET_VAL",

                where:
                    `PARCEL_ID LIKE '%${safeQuery}%' OR PS_MAIL_NM LIKE '%${safeQuery}%' OR PS_PROP_AD LIKE '%${safeQuery}%'`

            }

        ];


        try {

            const results =
                await Promise.allSettled(

                    sources.map(
                        source => {

                            const params =
                                new URLSearchParams({

                                    where:
                                        source.where,

                                    outFields:
                                        source.fields,

                                    returnGeometry:
                                        "true",

                                    outSR:
                                        "4326",

                                    resultRecordCount:
                                        "50",

                                    f:
                                        "geojson"

                                });


                            return fetch(
                                `${source.url}/query?${params.toString()}`
                            )
                            .then(
                                response => {

                                    if (
                                        !response.ok
                                    ) {

                                        throw new Error(
                                            `${source.name} failed`
                                        );

                                    }


                                    return response.json();

                                }
                            )
                            .then(
                                data => {

                                    return (
                                        data.features ||
                                        []
                                    ).map(
                                        feature =>
                                            normalizeParcel(
                                                feature,
                                                source.name
                                            )
                                    );

                                }
                            );

                        }
                    )

                );


            let features = [];


            results.forEach(
                result => {

                    if (
                        result.status ===
                        "fulfilled"
                    ) {

                        features =
                            features.concat(
                                result.value
                            );

                    }

                }
            );


            features =
                deduplicateParcels(
                    features
                );


            if (
                !features.length
            ) {

                resultsContent.innerHTML = `

                    <div class="search-result">

                        <div class="search-result-title">
                            No properties found
                        </div>

                        <div class="search-result-details">
                            Try an owner name,
                            parcel ID,
                            or address.
                        </div>

                    </div>

                `;

                return;

            }


            const normalized =
                query.toLowerCase();


            features.sort(
                (
                    a,
                    b
                ) => {

                    const pa =
                        a.properties ||
                        {};

                    const pb =
                        b.properties ||
                        {};


                    const ownerA =
                        cleanValue(
                            pa.OWNER1
                        ).toLowerCase();


                    const ownerB =
                        cleanValue(
                            pb.OWNER1
                        ).toLowerCase();


                    const idA =
                        cleanValue(
                            pa.PARCEL_ID
                        ).toLowerCase();


                    const idB =
                        cleanValue(
                            pb.PARCEL_ID
                        ).toLowerCase();


                    const addressA =
                        cleanValue(
                            pa.SITE_ADD
                        ).toLowerCase();


                    const addressB =
                        cleanValue(
                            pb.SITE_ADD
                        ).toLowerCase();


                    const scoreA =
                        (
                            idA ===
                            normalized
                                ? 100
                                : 0
                        ) +

                        (
                            ownerA ===
                            normalized
                                ? 80
                                : 0
                        ) +

                        (
                            ownerA.startsWith(
                                normalized
                            )
                                ? 30
                                : 0
                        ) +

                        (
                            addressA.includes(
                                normalized
                            )
                                ? 20
                                : 0
                        ) +

                        parcelCompletenessScore(
                            a
                        );


                    const scoreB =
                        (
                            idB ===
                            normalized
                                ? 100
                                : 0
                        ) +

                        (
                            ownerB ===
                            normalized
                                ? 80
                                : 0
                        ) +

                        (
                            ownerB.startsWith(
                                normalized
                            )
                                ? 30
                                : 0
                        ) +

                        (
                            addressB.includes(
                                normalized
                            )
                                ? 20
                                : 0
                        ) +

                        parcelCompletenessScore(
                            b
                        );


                    return (
                        scoreB -
                        scoreA
                    );

                }
            );


            resultsContent.innerHTML =
                features
                    .slice(
                        0,
                        50
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

                                        <br>

                                        Source:
                                        ${
                                            escapeHTML(
                                                p._source ||
                                                "Public GIS"
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
                                    features[
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
                        The public GIS services did not
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
                        <strong>Already Saved</strong>
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


        if (
            countyLayer
        ) {

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


            if (
                found
            ) {

                appPage.classList.remove(
                    "open"
                );

                return;

            }

        }


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
                    `${IDWR_PARCEL_URL}/query?${params.toString()}`
                );


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
                        padding:
                            [
                                30,
                                30
                            ]
                    }
                );

            }


        } catch (
            error
        ) {

            console.error(
                "County selection error:",
                error
            );

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


        if (
            !saved.length
        ) {

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
                        Idaho IDWR
                    </h2>

                    <p>
                        Statewide parcel compilation containing
                        parcel polygons obtained from Idaho county
                        assessor offices.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Bonner County GIS
                    </h2>

                    <p>
                        County-specific parcel data used as a
                        northern Idaho fallback and verification
                        source.
                    </p>

                </div>


                <div class="page-section">

                    <h2>
                        Boundary County GIS
                    </h2>

                    <p>
                        County-specific parcel data used as a
                        northern Idaho fallback and verification
                        source.
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
                            ${escapeHTML(
                                last
                            )}
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

        if (
            mapStatusText
        ) {

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
        "ParcelScope Idaho initialized with multi-source parcel system."
    );

});
