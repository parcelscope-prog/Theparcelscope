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

    const PARCEL_SOURCES = [

        {
            name: "Idaho Statewide",
            url:
                "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7"
        },

        /*
         * Backup parcel source.
         *
         * This source is intentionally queried only for
         * parcels inside the current map window.
         *
         * If a source doesn't contain the area, the next
         * source is tried automatically.
         */
        {
            name: "Idaho Parcel Viewer",
            url:
                "https://services.arcgis.com/91hXl6NfvLGEi8x5/ArcGIS/rest/services/TaxParcels/FeatureServer/0"
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

    let tooFarMessageVisible = false;


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
            "Search something\nI'm good but I can't read minds.";

        searchInput.setAttribute(
            "title",
            "Search something — I'm good but I can't read minds."
        );

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
       TOO-FAR-OUT MESSAGE
    ===================================================== */

    function createTooFarMessage() {

        if (
            document.getElementById(
                "parcelTooFarMessage"
            )
        ) {

            return;

        }


        const message =
            document.createElement("div");

        message.id =
            "parcelTooFarMessage";

        message.innerHTML = `
            <div class="glitch-text">
                THE MAP CAN'T<br>
                STRETCH THAT FAR
            </div>
        `;


        Object.assign(
            message.style,
            {
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: "99999",
                pointerEvents: "none",
                textAlign: "center",
                fontFamily:
                    "monospace",
                fontWeight: "900",
                fontSize:
                    "clamp(26px, 6vw, 72px)",
                lineHeight:
                    "0.9",
                letterSpacing:
                    "3px",
                color:
                    "#ff0000",
                textShadow:
                    "-5px 0 #00ffff, 5px 0 #0066ff, 0 0 12px #ff0000",
                mixBlendMode:
                    "screen",
                display:
                    "none"
            }
        );


        document.body.appendChild(
            message
        );


        const style =
            document.createElement("style");

        style.textContent = `

            @keyframes parcelGlitch {

                0% {
                    transform:
                        translate(-50%, -50%)
                        translate(0,0);
                    opacity: 1;
                }

                20% {
                    transform:
                        translate(-50%, -50%)
                        translate(-4px,2px);
                }

                40% {
                    transform:
                        translate(-50%, -50%)
                        translate(5px,-2px);
                }

                60% {
                    transform:
                        translate(-50%, -50%)
                        translate(-2px,-1px);
                }

                80% {
                    transform:
                        translate(-50%, -50%)
                        translate(3px,2px);
                }

                100% {
                    transform:
                        translate(-50%, -50%)
                        translate(0,0);
                    opacity: 1;
                }

            }


            #parcelTooFarMessage .glitch-text {

                animation:
                    parcelGlitch
                    0.18s
                    infinite;

            }

        `;

        document.head.appendChild(
            style
        );

    }


    function updateTooFarMessage() {

        createTooFarMessage();


        const message =
            document.getElementById(
                "parcelTooFarMessage"
            );


        /*
         * The full-state view is intentionally
         * limited so the parcel system doesn't
         * try to stretch across the whole country.
         */

        const show =
            map.getZoom() < 5;


        if (show) {

            message.style.display =
                "block";

            tooFarMessageVisible =
                true;

        } else {

            message.style.display =
                "none";

            tooFarMessageVisible =
                false;

        }

    }


    map.on(
        "zoomend",
        updateTooFarMessage
    );


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
       PARCEL QUERY
    ===================================================== */

    function buildParcelParams(
        url,
        bounds
    ) {

        const geometry = [

            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()

        ].join(",");


        return new URLSearchParams({

            where: "1=1",

            geometry: geometry,

            geometryType:
                "esriGeometryEnvelope",

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
                "2000",

            f:
                "geojson"

        });

    }


    async function queryParcelSource(
        source,
        bounds,
        signal
    ) {

        const params =
            buildParcelParams(
                source.url,
                bounds
            );


        const response =
            await fetch(
                `${source.url}/query?${params.toString()}`,
                {
                    signal: signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `${source.name} request failed`
            );

        }


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                data.error.message ||
                `${source.name} returned an error`
            );

        }


        return data.features || [];

    }


    /* =====================================================
       DUPLICATE FILTER
    ===================================================== */

    function normalizeParcelID(
        feature
    ) {

        const p =
            feature?.properties || {};


        const values = [

            p.PARCEL_ID,
            p.Parcel_ID,
            p.PARCELID,
            p.ParcelID,
            p.PIN,
            p.PIN_ID,
            p.ACCOUNT,
            p.ACCOUNT_NO,
            p.TAX_ID,
            p.TAXPARCEL,
            p.OBJECTID

        ];


        for (
            const value of values
        ) {

            const cleaned =
                cleanValue(value);


            if (cleaned) {

                return cleaned
                    .toUpperCase()
                    .replace(
                        /\s+/g,
                        ""
                    );

            }

        }


        /*
         * If no parcel ID exists, make a
         * geometry-based fallback key.
         */

        try {

            return JSON.stringify(
                feature.geometry
            );

        } catch {

            return "";

        }

    }


    function filterDuplicateParcels(
        features
    ) {

        const seen =
            new Set();

        const result =
            [];


        for (
            const feature of features
        ) {

            const key =
                normalizeParcelID(
                    feature
                );


            if (
                !key ||
                seen.has(key)
            ) {

                continue;

            }


            seen.add(key);

            result.push(
                feature
            );

        }


        return result;

    }


    /* =====================================================
       PARCEL LOADING
    ===================================================== */

    async function loadParcels() {

        updateTooFarMessage();


        if (!settings.parcels) {

            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }

            return;

        }


        /*
         * Parcel boundaries start at zoom 9.
         * This allows large northern Idaho properties
         * to be seen without requiring excessive zoom.
         */

        if (map.getZoom() < 9) {

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


        if (parcelRequestController) {

            parcelRequestController.abort();

        }


        parcelRequestController =
            new AbortController();


        const bounds =
            map.getBounds();


        try {

            setStatus(
                "Loading parcel boundaries..."
            );


            let allFeatures =
                [];


            /*
             * Query every available source.
             *
             * This is slower than relying on one source,
             * but it makes missing county coverage much
             * less likely.
             */

            for (
                const source of PARCEL_SOURCES
            ) {

                try {

                    const features =
                        await queryParcelSource(
                            source,
                            bounds,
                            parcelRequestController.signal
                        );


                    if (
                        features.length
                    ) {

                        allFeatures =
                            allFeatures.concat(
                                features
                            );

                    }

                } catch (error) {

                    if (
                        error.name ===
                        "AbortError"
                    ) {

                        throw error;

                    }


                    console.warn(
                        `${source.name} unavailable:`,
                        error
                    );

                }

            }


            const uniqueFeatures =
                filterDuplicateParcels(
                    allFeatures
                );


            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }


            parcelLayer =
                L.geoJSON(
                    {
                        type: "FeatureCollection",
                        features:
                            uniqueFeatures
                    },
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


            parcelLayer.addTo(
                map
            );


            /*
             * Re-highlight selected parcel.
             */

            if (selectedParcelID) {

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
                uniqueFeatures.length
            ) {

                setStatus(
                    `${uniqueFeatures.length.toLocaleString()} parcel boundaries loaded`
                );

            } else {

                setStatus(
                    "No parcel boundaries found in this area"
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
                    300
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


    async function findParcelAtPoint(
        latlng
    ) {

        const geometry =
            `${latlng.lng},${latlng.lat}`;


        const sources =
            PARCEL_SOURCES;


        setStatus(
            "Finding property..."
        );


        for (
            const source of sources
        ) {

            const params =
                new URLSearchParams({

                    where: "1=1",

                    geometry: geometry,

                    geometryType:
                        "esriGeometryPoint",

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
                        "1",

                    f:
                        "geojson"

                });


            try {

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
            feature?.properties || {};


        return cleanValue(
            p.PARCEL_ID
        ) ||
        cleanValue(
            p.Parcel_ID
        ) ||
        cleanValue(
            p.PARCELID
        ) ||
        cleanValue(
            p.ParcelID
        ) ||
        cleanValue(
            p.FP_ID
        ) ||
        cleanValue(
            p.PIN
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
       RANDOM JOKES
    ===================================================== */

    function maybeShowParcelJoke() {

        const random =
            Math.random();


        /*
         * 0.1% chance
         */

        if (
            random < 0.001
        ) {

            showGlitchJoke(
                "CONGRATS<br>YOU FOUND DIRT",
                "#ff0000"
            );

            return true;

        }


        /*
         * Another independent 0.1% chance
         */

        if (
            random < 0.002
        ) {

            const places = [

                "SOMEWHERE IN IDAHO",
                "A SECRET PLACE IN IDAHO",
                "DEFINITELY IDAHO",
                "SOMEWHERE NORTH OF BOISE",
                "PROBABLY IDAHO",
                "THE MIDDLE OF NOWHERE, IDAHO"

            ];


            const place =
                places[
                    Math.floor(
                        Math.random() *
                        places.length
                    )
                ];


            showGlitchJoke(
                place,
                "#0066ff"
            );

            return true;

        }


        return false;

    }


    function showGlitchJoke(
        text,
        color
    ) {

        const joke =
            document.createElement(
                "div"
            );


        joke.innerHTML =
            text;


        Object.assign(
            joke.style,
            {

                position:
                    "fixed",

                left:
                    "50%",

                top:
                    "50%",

                transform:
                    "translate(-50%,-50%)",

                zIndex:
                    "100000",

                pointerEvents:
                    "none",

                textAlign:
                    "center",

                fontFamily:
                    "monospace",

                fontWeight:
                    "900",

                fontSize:
                    "clamp(32px, 8vw, 90px)",

                lineHeight:
                    "0.9",

                letterSpacing:
                    "4px",

                color:
                    color,

                textShadow:
                    "-6px 0 #ff00ff, 6px 0 #00ffff, 0 0 15px " +
                    color,

                animation:
                    "parcelJokeGlitch 0.12s infinite"

            }
        );


        document.body.appendChild(
            joke
        );


        setTimeout(
            () => {

                joke.remove();

            },
            3500
        );

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
                cleanValue(p.SITE_ADD),
                cleanValue(p.SITE_CITY),
                cleanValue(p.SITE_ZIP)
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
                :
            p.ACRES !== null &&
            p.ACRES !== undefined &&
            p.ACRES !== ""
                ? Number(
                    p.ACRES
                  ).toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits: 2
                    }
                  )
                :
                "Unavailable";


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
                :
            p.VALUE !== null &&
            p.VALUE !== undefined &&
            p.VALUE !== ""
                ? "$" +
                  Number(
                      p.VALUE
                  ).toLocaleString()
                :
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
                        cleanValue(
                            p.SOURCE
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


        /*
         * The jokes are separate from actual
         * property selection.
         */

        maybeShowParcelJoke();

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
            `SITE_CITY LIKE '%${safeQuery}%'`;


        const allResults =
            [];


        for (
            const source of PARCEL_SOURCES
        ) {

            const params =
                new URLSearchParams({

                    where: where,

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


            try {

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
                    source.name,
                    error
                );

            }

        }


        const features =
            filterDuplicateParcels(
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

                const pa =
                    a.properties || {};

                const pb =
                    b.properties || {};


                const ownerA =
                    cleanValue(
                        pa.OWNER1 ||
                        pa.OWNER
                    ).toLowerCase();


                const ownerB =
                    cleanValue(
                        pb.OWNER1 ||
                        pb.OWNER
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
                    (ownerA === normalized
                        ? 100
                        : 0) +
                    (ownerA.startsWith(normalized)
                        ? 30
                        : 0) +
                    (addressA.includes(normalized)
                        ? 20
                        : 0);


                const scoreB =
                    (ownerB === normalized
                        ? 100
                        : 0) +
                    (ownerB.startsWith(normalized)
                        ? 30
                        : 0) +
                    (addressB.includes(normalized)
                        ? 20
                        : 0);


                return scoreB - scoreA;

            }
        );


        resultsContent.innerHTML =
            features
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
                                p.OWNER1 ||
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
                                p.County ||
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
                                features[index]
                            );

                        }
                    );

                }
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

        const p =
            feature.properties || {};


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
                    p.OWNER1 ||
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
                    type: "Feature",
                    properties: {},
                    geometry: geometry
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


            if (found) {

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
                    `${PARCEL_SOURCES[0].url}/query?${params.toString()}`
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
                        padding: [
                            30,
                            30
                        ]
                    }
                );

            }


        } catch (error) {

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
                        ParcelScope checks multiple public
                        GIS parcel sources and removes duplicate
                        parcel records when possible.
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
                                layer === "counties" ||
                                layer === "idaho"
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
                        enabled ? "on" : ""
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

    createTooFarMessage();


    updateTooFarMessage();


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
        "ParcelScope Idaho initialized."
    );

});
