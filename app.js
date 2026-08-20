/* =========================================================
   PARCELSCOPE IDAHO
   NEW MULTI-SOURCE PARCEL ENGINE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const mapElement =
        document.getElementById("map");

    const menuButton =
        document.getElementById("menuButton");

    const closeMenu =
        document.getElementById("closeMenu");

    const sideMenu =
        document.getElementById("sideMenu");

    const searchInput =
        document.getElementById("searchInput");

    const searchButton =
        document.getElementById("searchButton");

    const searchResults =
        document.getElementById("searchResults");

    const resultsContent =
        document.getElementById("resultsContent");

    const closeResults =
        document.getElementById("closeResults");

    const propertyPanel =
        document.getElementById("propertyPanel");

    const closeProperty =
        document.getElementById("closeProperty");

    const propertyContent =
        document.getElementById("propertyContent");

    const propertyTitle =
        document.getElementById("propertyTitle");

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

       These are deliberately separate.

       SOURCE 1:
       Idaho statewide standardized parcel framework.

       SOURCE 2:
       Idaho Department of Water Resources.

       SOURCE 3:
       Idaho Department of Lands / WhiteStar.
    ===================================================== */

    const SOURCES = [

        {
            id: "statewide",
            name: "Idaho Statewide Parcels",

            url:
                "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7",

            color: "#ffffff",

            fields: [
                "OBJECTID",
                "PARCEL_ID",
                "FP_ID",
                "OWNER1",
                "OWNER2",
                "SITE_ADD",
                "SITE_CITY",
                "SITE_ZIP",
                "COUNTY",
                "County",
                "ASR_ACRES",
                "VAL_TOTAL",
                "STEWARD",
                "UPDATED"
            ]
        },

        {
            id: "idwr",
            name: "Idaho Department of Water Resources",

            url:
                "https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/FeatureServer/0",

            color: "#ffffff",

            fields: [
                "OBJECTID",
                "PIN",
                "COUNTY",
                "OWNER"
            ]
        },

        {
            id: "whitestar",
            name: "Idaho WhiteStar Parcels",

            url:
                "https://gis1.idl.idaho.gov/arcgis/rest/services/Portal/WhiteStar_Parcels/FeatureServer/0",

            color: "#ffffff",

            fields: [
                "OBJECTID",
                "owner1",
                "owner2",
                "taxacctnum",
                "mailfuladd",
                "mailcity",
                "mailstate",
                "mailzip",
                "county",
                "parcelid",
                "gisacres"
            ]
        }

    ];


    /* =====================================================
       MAP
    ===================================================== */

    const map =
        L.map(
            mapElement,
            {
                zoomControl: true,
                attributionControl: true,
                minZoom: 4,
                maxZoom: 19,
                zoomSnap: 0.25,
                zoomDelta: 0.5
            }
        );

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
                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        );

    satelliteLayer.addTo(map);

    map.setView(
        [44.0682, -114.7420],
        6
    );


    /* =====================================================
       STATE
    ===================================================== */

    let parcelLayer =
        L.featureGroup().addTo(map);

    let selectedLayer = null;

    let selectedRecord = null;

    let loadTimer = null;

    let requestNumber = 0;

    let activeController = null;

    let sourceMetadata = new Map();

    let lastLoadedBounds = null;

    const featureCache =
        new Map();


    /* =====================================================
       SETTINGS
    ===================================================== */

    const defaultSettings = {

        mapStyle:
            "satellite",

        parcels:
            true,

        counties:
            true,

        idaho:
            true
    };

    let settings =
        readSettings();


    function readSettings() {

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
       STATUS
    ===================================================== */

    function status(text) {

        if (mapStatusText) {
            mapStatusText.textContent =
                text;
        }
    }


    /* =====================================================
       GLITCH SYSTEM
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

            padding: 0 15px;

            text-align: center;

            font-family:
                "Courier New",
                monospace;

            font-weight: 900;

            font-size:
                clamp(24px, 6vw, 80px);

            line-height: .9;

            letter-spacing: 2px;

            color: white;

            text-shadow:
                -5px 0 #ff003c,
                5px 0 #00eaff,
                0 0 10px white;

            mix-blend-mode: screen;
        }


        #parcelScopeGlitchWarning.show {

            display: block;

            animation:
                parcelScopeGlitch
                .12s
                infinite
                steps(2);
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


    let glitchTimer =
        null;


    function glitch(message, duration = 3200) {

        clearTimeout(
            glitchTimer
        );

        glitchWarning.textContent =
            message;

        glitchWarning.classList.add(
            "show"
        );

        glitchTimer =
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
       YOUR JOKES
    ===================================================== */

    function maybePropertyJoke() {

        const r =
            Math.random();

        if (r < 0.001) {

            glitch(
                "CONGRATS — YOU FOUND DIRT",
                4200
            );

            return;
        }

        if (r < 0.002) {

            const places = [

                "SOME PLACE IN IDAHO",

                "PROBABLY IDAHO",

                "SOMEWHERE IN IDAHO",

                "AN EXTREMELY IDAHO PLACE",

                "IDAHO™",

                "YOU FOUND... IDAHO"
            ];

            glitch(
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
       ZOOM JOKE
    ===================================================== */

    let zoomWarningShown =
        false;


    map.on(
        "zoomend",
        () => {

            const zoom =
                map.getZoom();

            if (zoom <= 8) {

                if (!zoomWarningShown) {

                    zoomWarningShown =
                        true;

                    glitch(
                        "ZOOM BACK IN, YOU'RE GONNA BREAK THE MAP",
                        5000
                    );
                }

            } else {

                zoomWarningShown =
                    false;
            }

            scheduleParcelLoad();
        }
    );


    /* =====================================================
       MENU
    ===================================================== */

    menuButton?.addEventListener(
        "click",
        () => {

            sideMenu.classList.toggle(
                "open"
            );
        }
    );


    closeMenu?.addEventListener(
        "click",
        () => {

            sideMenu.classList.remove(
                "open"
            );
        }
    );


    closeProperty?.addEventListener(
        "click",
        () => {

            propertyPanel.classList.remove(
                "open"
            );

            clearSelection();
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
       SOURCE METADATA
    ===================================================== */

    async function loadSourceMetadata() {

        await Promise.allSettled(

            SOURCES.map(
                async source => {

                    try {

                        const response =
                            await fetch(
                                `${source.url}?f=json`,
                                {
                                    cache:
                                        "no-store"
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                `HTTP ${response.status}`
                            );
                        }

                        const json =
                            await response.json();

                        const fields =
                            Array.isArray(
                                json.fields
                            )
                                ? json.fields
                                : [];

                        const fieldNames =
                            fields.map(
                                field =>
                                    field.name
                            );

                        sourceMetadata.set(
                            source.id,
                            fieldNames
                        );

                    } catch (error) {

                        console.warn(
                            `Metadata failed for ${source.name}:`,
                            error
                        );

                        sourceMetadata.set(
                            source.id,
                            []
                        );
                    }
                }
            )
        );
    }


    /* =====================================================
       FIELD HELPERS
    ===================================================== */

    function hasField(
        source,
        field
    ) {

        const fields =
            sourceMetadata.get(
                source.id
            );

        if (!fields?.length) {

            return source.fields.includes(
                field
            );
        }

        return fields.some(
            name =>
                name.toLowerCase() ===
                field.toLowerCase()
        );
    }


    function actualField(
        source,
        candidates
    ) {

        for (
            const candidate of candidates
        ) {

            const fields =
                sourceMetadata.get(
                    source.id
                ) || [];

            const found =
                fields.find(
                    field =>
                        field.toLowerCase() ===
                        candidate.toLowerCase()
                );

            if (found) {
                return found;
            }

            if (
                source.fields.some(
                    field =>
                        field.toLowerCase() ===
                        candidate.toLowerCase()
                )
            ) {

                return candidate;
            }
        }

        return null;
    }


    /* =====================================================
       NORMALIZE RECORD
    ===================================================== */

    function normalizeRecord(
        feature,
        source
    ) {

        const raw =
            feature.properties || {};

        const parcelID =
            firstValue(
                raw,
                [
                    "PARCEL_ID",
                    "FP_ID",
                    "PIN",
                    "parcelid",
                    "PARCELID",
                    "taxacctnum",
                    "OBJECTID"
                ]
            );

        const owner =
            firstValue(
                raw,
                [
                    "OWNER1",
                    "owner1",
                    "OWNER",
                    "owner"
                ]
            );

        const owner2 =
            firstValue(
                raw,
                [
                    "OWNER2",
                    "owner2"
                ]
            );

        const county =
            firstValue(
                raw,
                [
                    "County",
                    "COUNTY",
                    "county"
                ]
            );

        const address =
            firstValue(
                raw,
                [
                    "SITE_ADD",
                    "site_add",
                    "mailfuladd"
                ]
            );

        const city =
            firstValue(
                raw,
                [
                    "SITE_CITY",
                    "site_city",
                    "mailcity"
                ]
            );

        const zip =
            firstValue(
                raw,
                [
                    "SITE_ZIP",
                    "site_zip",
                    "mailzip"
                ]
            );

        const acres =
            firstValue(
                raw,
                [
                    "ASR_ACRES",
                    "gisacres"
                ]
            );

        const assessed =
            firstValue(
                raw,
                [
                    "VAL_TOTAL"
                ]
            );

        return {

            type:
                "Feature",

            geometry:
                feature.geometry,

            properties: {

                ...raw,

                __source:
                    source.id,

                __sourceName:
                    source.name,

                __parcelID:
                    parcelID,

                __owner:
                    owner,

                __owner2:
                    owner2,

                __county:
                    county,

                __address:
                    address,

                __city:
                    city,

                __zip:
                    zip,

                __acres:
                    acres,

                __assessed:
                    assessed
            }
        };
    }


    function firstValue(
        object,
        names
    ) {

        for (
            const name of names
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    name
                )
            ) {

                const value =
                    clean(
                        object[name]
                    );

                if (value) {
                    return value;
                }
            }
        }

        /*
         * Some ArcGIS services can return field
         * casing differently.
         */

        const keys =
            Object.keys(
                object
            );

        for (
            const name of names
        ) {

            const match =
                keys.find(
                    key =>
                        key.toLowerCase() ===
                        name.toLowerCase()
                );

            if (match) {

                const value =
                    clean(
                        object[match]
                    );

                if (value) {
                    return value;
                }
            }
        }

        return "";
    }


    /* =====================================================
       QUERY BUILDER
    ===================================================== */

    function boundsGeometry(
        bounds
    ) {

        return [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(",");
    }


    function makeSpatialParams(
        bounds,
        fields,
        count
    ) {

        return {

            where:
                "1=1",

            geometry:
                boundsGeometry(bounds),

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
                String(count),

            f:
                "geojson"
        };
    }


    function toQueryString(
        params
    ) {

        return new URLSearchParams(
            params
        ).toString();
    }


    /* =====================================================
       REQUEST SOURCE
    ===================================================== */

    async function requestSource(
        source,
        bounds,
        signal,
        count = 1000
    ) {

        let fields =
            [];

        /*
         * Use fields actually present in the
         * service whenever metadata succeeded.
         */

        const metadata =
            sourceMetadata.get(
                source.id
            );

        if (
            Array.isArray(metadata) &&
            metadata.length
        ) {

            fields =
                metadata.filter(
                    field => {

                        const wanted =
                            source.fields.some(
                                candidate =>
                                    candidate.toLowerCase() ===
                                    field.toLowerCase()
                            );

                        return wanted;
                    }
                );
        }

        if (!fields.length) {

            fields =
                source.fields.filter(
                    field =>
                        hasField(
                            source,
                            field
                        )
                );
        }

        /*
         * OBJECTID is useful as a last resort.
         */

        if (
            !fields.some(
                field =>
                    field.toLowerCase() ===
                    "objectid"
            )
        ) {

            fields.push(
                "OBJECTID"
            );
        }

        const params =
            makeSpatialParams(
                bounds,
                fields.join(","),
                count
            );

        const url =
            `${source.url}/query?${toQueryString(params)}`;

        const response =
            await fetch(
                url,
                {
                    signal,
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `${source.name}: HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        if (data.error) {

            throw new Error(
                `${source.name}: ${
                    data.error.message ||
                    "ArcGIS error"
                }`
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
                normalizeRecord(
                    feature,
                    source
                )
        );
    }


    /* =====================================================
       TILE GENERATION
    ===================================================== */

    function createTiles(
        bounds
    ) {

        const zoom =
            map.getZoom();

        let columns = 1;
        let rows = 1;

        if (zoom >= 14) {

            columns = 1;
            rows = 1;

        } else if (zoom >= 12) {

            columns = 2;
            rows = 2;

        } else if (zoom >= 10) {

            columns = 3;
            rows = 3;

        } else {

            columns = 4;
            rows = 4;
        }

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


    function tileKey(
        bounds
    ) {

        return [
            bounds.getWest().toFixed(5),
            bounds.getSouth().toFixed(5),
            bounds.getEast().toFixed(5),
            bounds.getNorth().toFixed(5)
        ].join("|");
    }


    /* =====================================================
       LOAD PARCELS
    ===================================================== */

    async function loadParcels() {

        if (
            !settings.parcels
        ) {

            parcelLayer.clearLayers();

            status(
                "Parcel boundaries disabled"
            );

            return;
        }

        const zoom =
            map.getZoom();

        if (zoom < 9) {

            parcelLayer.clearLayers();

            status(
                "Zoom in to view parcel boundaries"
            );

            return;
        }

        if (activeController) {

            activeController.abort();
        }

        activeController =
            new AbortController();

        const signal =
            activeController.signal;

        const generation =
            ++requestNumber;

        const bounds =
            map.getBounds();

        const tiles =
            createTiles(bounds);

        const combined =
            new Map();

        let completed =
            0;

        status(
            "Loading Idaho parcels..."
        );


        /*
         * Each tile queries ALL available sources.
         *
         * This is different from the old engine:
         * a failed source doesn't prevent the other
         * sources from returning data.
         */

        for (
            const tile of tiles
        ) {

            if (
                signal.aborted ||
                generation !== requestNumber
            ) {
                return;
            }

            const key =
                tileKey(tile);

            let tileFeatures =
                featureCache.get(key);

            if (!tileFeatures) {

                const responses =
                    await Promise.allSettled(

                        SOURCES.map(
                            source =>
                                requestSource(
                                    source,
                                    tile,
                                    signal,
                                    1000
                                )
                        )
                    );

                tileFeatures =
                    [];

                responses.forEach(
                    result => {

                        if (
                            result.status ===
                            "fulfilled"
                        ) {

                            tileFeatures.push(
                                ...result.value
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
                 * Cache only actual responses.
                 */

                if (
                    tileFeatures.length
                ) {

                    featureCache.set(
                        key,
                        tileFeatures
                    );
                }
            }

            for (
                const feature of tileFeatures
            ) {

                const id =
                    stableID(
                        feature
                    );

                if (!id) {
                    continue;
                }

                if (
                    !combined.has(id)
                ) {

                    combined.set(
                        id,
                        feature
                    );
                }
            }

            completed++;

            status(
                `Loading Idaho parcels... ${completed}/${tiles.length}`
            );
        }


        if (
            signal.aborted ||
            generation !== requestNumber
        ) {
            return;
        }


        const features =
            Array.from(
                combined.values()
            );


        if (!features.length) {

            status(
                "No parcel boundaries returned — try moving slightly"
            );

            return;
        }


        /*
         * Do NOT destroy the old layer until
         * successful new data exists.
         */

        const newLayer =
            L.featureGroup();


        features.forEach(
            feature => {

                if (!feature.geometry) {
                    return;
                }

                const layer =
                    L.geoJSON(
                        feature,
                        {
                            style: {

                                color:
                                    "#ffffff",

                                weight:
                                    0.75,

                                opacity:
                                    0.75,

                                fillOpacity:
                                    0
                            }
                        }
                    );

                layer.eachLayer(
                    child => {

                        child.on(
                            "click",
                            event => {

                                L.DomEvent.stopPropagation(
                                    event
                                );

                                showProperty(
                                    feature,
                                    child
                                );
                            }
                        );
                    }
                );

                newLayer.addLayer(
                    layer
                );
            }
        );


        parcelLayer.clearLayers();

        parcelLayer.addLayer(
            newLayer
        );


        /*
         * Restore selected property.
         */

        if (selectedRecord) {

            const selectedID =
                stableID(
                    selectedRecord
                );

            findLayerByID(
                selectedID
            );
        }


        lastLoadedBounds =
            bounds;


        status(
            `${features.length.toLocaleString()} parcel boundaries loaded`
        );
    }


    /* =====================================================
       FIND LAYER BY ID
    ===================================================== */

    function findLayerByID(
        id
    ) {

        if (!id) {
            return;
        }

        parcelLayer.eachLayer(
            outer => {

                if (
                    outer.eachLayer
                ) {

                    outer.eachLayer(
                        inner => {

                            const feature =
                                inner.feature;

                            if (
                                feature &&
                                stableID(
                                    feature
                                ) === id
                            ) {

                                selectedLayer =
                                    inner;

                                highlight(
                                    inner
                                );
                            }
                        }
                    );
                }
            }
        );
    }


    /* =====================================================
       STABLE ID
    ===================================================== */

    function stableID(
        feature
    ) {

        const p =
            feature?.properties ||
            {};

        const source =
            p.__source ||
            "unknown";

        const id =
            p.__parcelID ||
            firstValue(
                p,
                [
                    "PARCEL_ID",
                    "FP_ID",
                    "PIN",
                    "parcelid",
                    "PARCELID",
                    "taxacctnum",
                    "OBJECTID"
                ]
            );

        if (!id) {
            return "";
        }

        return `${source}:${id}`;
    }


    /* =====================================================
       HIGHLIGHT
    ===================================================== */

    function highlight(
        layer
    ) {

        if (!layer?.setStyle) {
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


    function clearSelection() {

        if (
            selectedLayer?.setStyle
        ) {

            selectedLayer.setStyle({

                color:
                    "#ffffff",

                weight:
                    0.75,

                opacity:
                    0.75,

                fillOpacity:
                    0
            });
        }

        selectedLayer =
            null;

        selectedRecord =
            null;
    }


    /* =====================================================
       POINT LOOKUP
    ===================================================== */

    async function findParcelAtPoint(
        latlng
    ) {

        status(
            "Finding property..."
        );

        if (activeController) {
            activeController.abort();
        }

        const controller =
            new AbortController();

        const requests =
            SOURCES.map(
                source =>
                    pointQuery(
                        source,
                        latlng,
                        controller.signal
                    )
            );

        const results =
            await Promise.allSettled(
                requests
            );

        const records =
            [];

        results.forEach(
            result => {

                if (
                    result.status ===
                    "fulfilled"
                ) {

                    records.push(
                        ...result.value
                    );
                }
            }
        );


        if (!records.length) {

            showMapLocation(
                latlng
            );

            return;
        }


        /*
         * Prefer a record with an owner.
         */

        records.sort(
            (a, b) => {

                const ownerA =
                    a.properties.__owner
                        ? 1
                        : 0;

                const ownerB =
                    b.properties.__owner
                        ? 1
                        : 0;

                return ownerB -
                    ownerA;
            }
        );


        showProperty(
            records[0]
        );
    }


    async function pointQuery(
        source,
        latlng,
        signal
    ) {

        const metadata =
            sourceMetadata.get(
                source.id
            ) || [];

        let fields =
            metadata.length
                ? metadata
                : source.fields;

        fields =
            fields.filter(
                field =>
                    source.fields.some(
                        wanted =>
                            wanted.toLowerCase() ===
                            field.toLowerCase()
                    )
            );


        if (!fields.length) {
            fields = [
                "OBJECTID"
            ];
        }


        const params = {

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
                "5",

            f:
                "geojson"
        };


        const response =
            await fetch(
                `${source.url}/query?${toQueryString(params)}`,
                {
                    signal,
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {
            throw new Error(
                `${source.name}: HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (data.error) {
            throw new Error(
                data.error.message
            );
        }


        return (
            Array.isArray(
                data.features
            )
                ? data.features.map(
                    feature =>
                        normalizeRecord(
                            feature,
                            source
                        )
                  )
                : []
        );
    }


    /* =====================================================
       SHOW PROPERTY
    ===================================================== */

    function showProperty(
        feature,
        layer = null
    ) {

        clearSelection();

        selectedRecord =
            feature;

        selectedLayer =
            layer;

        if (
            selectedLayer
        ) {

            highlight(
                selectedLayer
            );
        }


        maybePropertyJoke();


        const p =
            feature.properties ||
            {};


        const owner =
            p.__owner ||
            "Owner information unavailable";


        const owner2 =
            p.__owner2;


        const addressParts =
            [
                p.__address,
                p.__city,
                p.__zip
            ]
            .filter(Boolean);


        const address =
            addressParts.join(
                ", "
            );


        const parcelID =
            p.__parcelID ||
            "Unavailable";


        const county =
            p.__county ||
            "Unavailable";


        const acres =
            formatNumber(
                p.__acres
            );


        const assessed =
            formatMoney(
                p.__assessed
            );


        const source =
            p.__sourceName ||
            "Idaho public parcel data";


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
                    ${escapeHTML(source)}
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
            ?.addEventListener(
                "click",
                () => {

                    saveProperty(
                        feature
                    );
                }
            );


        status(
            "Property selected"
        );
    }


    /* =====================================================
       MAP LOCATION
    ===================================================== */

    function showMapLocation(
        latlng
    ) {

        clearSelection();

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
                    No parcel was returned at that exact
                    point. Try clicking slightly inside
                    the parcel.
                </div>

            </div>

        `;


        propertyPanel.classList.add(
            "open"
        );


        status(
            "No parcel found at that point"
        );
    }


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on(
        "click",
        event => {

            sideMenu.classList.remove(
                "open"
            );

            if (
                map.getZoom() < 9
            ) {

                showMapLocation(
                    event.latlng
                );

                return;
            }

            findParcelAtPoint(
                event.latlng
            );
        }
    );


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

                event.preventDefault();

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


        searchResults.classList.add(
            "open"
        );


        resultsContent.innerHTML = `

            <div class="search-result">

                <div class="search-result-title">
                    Searching Idaho parcel sources...
                </div>

                <div class="search-result-details">
                    Checking multiple public GIS datasets.
                </div>

            </div>

        `;


        status(
            "Searching multiple Idaho parcel sources..."
        );


        const results =
            [];


        await Promise.all(

            SOURCES.map(
                async source => {

                    try {

                        const found =
                            await searchSource(
                                source,
                                query
                            );

                        results.push(
                            ...found
                        );

                    } catch (error) {

                        console.warn(
                            `${source.name} search failed:`,
                            error
                        );
                    }
                }
            )
        );


        const unique =
            dedupeResults(
                results
            );


        unique.sort(
            (a, b) =>
                scoreResult(
                    b,
                    query
                ) -
                scoreResult(
                    a,
                    query
                )
        );


        const limited =
            unique.slice(
                0,
                50
            );


        if (!limited.length) {

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


            status(
                "No matching properties found"
            );

            return;
        }


        resultsContent.innerHTML =
            limited.map(
                (feature, index) => {

                    const p =
                        feature.properties ||
                        {};

                    const owner =
                        p.__owner ||
                        "Owner information unavailable";

                    const address =
                        [
                            p.__address,
                            p.__city,
                            p.__zip
                        ]
                        .filter(Boolean)
                        .join(", ");


                    const county =
                        p.__county ||
                        "";


                    const parcelID =
                        p.__parcelID ||
                        "Unavailable";


                    const source =
                        p.__sourceName ||
                        "Public parcel data";


                    return `

                        <div
                            class="search-result"
                            data-search-index="${index}"
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

                                <br>

                                Source:
                                ${escapeHTML(source)}

                            </div>

                        </div>
                    `;
                }
            )
            .join("");


        document
            .querySelectorAll(
                "[data-search-index]"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    element.dataset
                                        .searchIndex
                                );

                            selectSearchResult(
                                limited[index]
                            );
                        }
                    );
                }
            );


        status(
            `${limited.length} matching properties`
        );
    }


    /* =====================================================
       SEARCH SOURCE
    ===================================================== */

    async function searchSource(
        source,
        query
    ) {

        const fields =
            sourceMetadata.get(
                source.id
            ) || source.fields;


        const searchable =
            fields.filter(
                field => {

                    const lower =
                        field.toLowerCase();

                    return [

                        "owner",
                        "owner1",
                        "owner2",
                        "parcel",
                        "parcel_id",
                        "parcelid",
                        "pin",
                        "fp_id",
                        "taxacctnum",
                        "site_add",
                        "site_city",
                        "county",
                        "mailfuladd",
                        "mailcity"

                    ].some(
                        key =>
                            lower.includes(
                                key
                            )
                    );
                }
            );


        if (!searchable.length) {
            return [];
        }


        const safe =
            query
                .replaceAll(
                    "'",
                    "''"
                );


        const where =
            searchable
                .map(
                    field =>
                        `${field} LIKE '%${safe}%'`
                )
                .join(
                    " OR "
                );


        const params = {

            where,

            outFields:
                fields.join(","),

            returnGeometry:
                "true",

            outSR:
                "4326",

            resultRecordCount:
                "50",

            f:
                "geojson"
        };


        const response =
            await fetch(
                `${source.url}/query?${toQueryString(params)}`,
                {
                    cache:
                        "no-store"
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
                data.error.message
            );
        }


        return (
            Array.isArray(
                data.features
            )
                ? data.features.map(
                    feature =>
                        normalizeRecord(
                            feature,
                            source
                        )
                  )
                : []
        );
    }


    /* =====================================================
       SEARCH DEDUPE
    ===================================================== */

    function dedupeResults(
        features
    ) {

        const map =
            new Map();


        for (
            const feature of features
        ) {

            const id =
                stableID(
                    feature
                );


            if (!id) {
                continue;
            }


            const existing =
                map.get(id);


            /*
             * If two sources have the same parcel,
             * prefer the record containing more useful
             * property information.
             */

            if (!existing) {

                map.set(
                    id,
                    feature
                );

                continue;
            }


            const existingScore =
                informationScore(
                    existing
                );

            const newScore =
                informationScore(
                    feature
                );


            if (
                newScore >
                existingScore
            ) {

                map.set(
                    id,
                    feature
                );
            }
        }


        return Array.from(
            map.values()
        );
    }


    function informationScore(
        feature
    ) {

        const p =
            feature.properties ||
            {};

        let score = 0;

        if (p.__owner) score += 5;
        if (p.__address) score += 3;
        if (p.__city) score += 2;
        if (p.__county) score += 2;
        if (p.__acres) score += 1;
        if (p.__assessed) score += 1;

        return score;
    }


    function scoreResult(
        feature,
        query
    ) {

        const q =
            query
                .toLowerCase()
                .trim();


        const p =
            feature.properties ||
            {};


        const values =
            [
                p.__owner,
                p.__owner2,
                p.__address,
                p.__city,
                p.__county,
                p.__parcelID
            ]
            .filter(Boolean)
            .map(
                value =>
                    String(value)
                        .toLowerCase()
            );


        let score = 0;


        for (
            const value of values
        ) {

            if (
                value === q
            ) {

                score += 100;

            } else if (
                value.startsWith(q)
            ) {

                score += 60;

            } else if (
                value.includes(q)
            ) {

                score += 25;
            }
        }


        return score;
    }


    /* =====================================================
       SEARCH RESULT SELECT
    ===================================================== */

    function selectSearchResult(
        feature
    ) {

        searchResults.classList.remove(
            "open"
        );


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
                        padding:
                            [60, 60],

                        maxZoom:
                            17
                    }
                );
            }
        }


        showProperty(
            feature
        );
    }


    /* =====================================================
       SAVE
    ===================================================== */

    function getSaved() {

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
            p.__parcelID;


        if (!parcelID) {
            return;
        }


        const saved =
            getSaved();


        const exists =
            saved.some(
                item =>
                    item.parcelID ===
                    parcelID
            );


        if (exists) {

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
                ? getCenter(
                    feature.geometry
                  )
                : null;


        saved.push({

            parcelID,

            owner:
                p.__owner ||
                "Owner unavailable",

            address:
                [
                    p.__address,
                    p.__city,
                    p.__zip
                ]
                .filter(Boolean)
                .join(", "),

            latitude:
                center?.lat ??
                null,

            longitude:
                center?.lng ??
                null
        });


        localStorage.setItem(
            "parcelScopeSaved",
            JSON.stringify(saved)
        );


        propertyPanel.classList.remove(
            "open"
        );


        status(
            "Property saved"
        );
    }


    function getCenter(
        geometry
    ) {

        try {

            return L.geoJSON(
                {
                    type:
                        "Feature",

                    properties:
                        {},

                    geometry
                }
            )
            .getBounds()
            .getCenter();

        } catch {

            return null;
        }
    }


    /* =====================================================
       FULL PAGES
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

        sideMenu.classList.remove(
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

                        openSection(
                            button.dataset.section
                        );
                    }
                );
            }
        );


    function openSection(
        section
    ) {

        switch (section) {

            case "counties":
                showCounties();
                break;

            case "saved":
                showSaved();
                break;

            case "sources":
                showSources();
                break;

            case "history":
                showHistory();
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
                        Search for an Idaho county
                        or select one below.
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


        input?.addEventListener(
            "input",
            () => {

                const q =
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
                                !q ||
                                name.includes(q)
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

                            status(
                                `${button.dataset.county} County selected`
                            );

                            appPage.classList.remove(
                                "open"
                            );

                        }
                    );
                }
            );
    }


    /* =====================================================
       SAVED PAGE
    ===================================================== */

    function showSaved() {

        const saved =
            getSaved();


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


        openPage(
            "Saved Properties",

            saved
                .map(
                    (item, index) => `

                        <div
                            class="saved-property"
                            data-saved="${index}"
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
                                data-remove="${index}"
                            >
                                X
                            </button>

                        </div>
                    `
                )
                .join(""),

            "SAVED PROPERTIES"
        );


        document
            .querySelectorAll(
                "[data-remove]"
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
                                        .remove
                                );

                            saved.splice(
                                index,
                                1
                            );

                            localStorage.setItem(
                                "parcelScopeSaved",
                                JSON.stringify(saved)
                            );

                            showSaved();
                        }
                    );
                }
            );
    }


    /* =====================================================
       SOURCES
    ===================================================== */

    function showSources() {

        openPage(
            "Data Sources",
            `
                <div class="page-section">

                    <h2>
                        Idaho Statewide Parcels
                    </h2>

                    <p>
                        Statewide standardized Idaho parcel
                        polygons supplied through Idaho's
                        public GIS parcel framework.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Idaho Department of Water Resources
                    </h2>

                    <p>
                        Secondary parcel dataset containing
                        PIN, county, and owner information.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Idaho WhiteStar Parcels
                    </h2>

                    <p>
                        Additional Idaho parcel dataset
                        containing assessed-owner and
                        tax-account information.
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
                        Notice
                    </h2>

                    <p>
                        ParcelScope displays public GIS
                        information. Data should be verified
                        with the appropriate county or
                        government agency when an official
                        record is required.
                    </p>

                </div>
            `,
            "DATA SOURCES"
        );
    }


    /* =====================================================
       HISTORY
    ===================================================== */

    function showHistory() {

        const now =
            new Date()
                .toLocaleString();


        openPage(
            "Update History",
            `
                <div class="page-section">

                    <div class="last-refresh">

                        Current session:
                        <strong>
                            ${escapeHTML(now)}
                        </strong>

                    </div>

                    <button
                        id="refreshNowButton"
                        class="refresh-button"
                    >
                        Refresh Parcel Data
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
                () => {

                    featureCache.clear();

                    loadParcels();

                    showHistory();
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
                            data-style="satellite"
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
                            data-style="standard"
                        ></button>

                    </div>

                </div>


                <div class="setting-group">

                    <h2>
                        Parcel Layer
                    </h2>

                    <div class="setting-row">

                        <div>

                            <div class="setting-name">
                                Parcel Boundaries
                            </div>

                            <div class="setting-description">
                                Show public Idaho parcel outlines
                            </div>

                        </div>

                        <button
                            class="toggle ${
                                settings.parcels
                                    ? "on"
                                    : ""
                            }"
                            data-parcels
                        ></button>

                    </div>

                </div>
            `,
            "SETTINGS"
        );


        document
            .querySelectorAll(
                "[data-style]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            settings.mapStyle =
                                button.dataset.style;

                            saveSettings();

                            applyMapStyle(
                                settings.mapStyle
                            );

                            showSettings();
                        }
                    );
                }
            );


        document
            .querySelector(
                "[data-parcels]"
            )
            ?.addEventListener(
                "click",
                () => {

                    settings.parcels =
                        !settings.parcels;

                    saveSettings();

                    if (
                        settings.parcels
                    ) {

                        loadParcels();

                    } else {

                        parcelLayer.clearLayers();

                        if (
                            activeController
                        ) {

                            activeController.abort();
                        }
                    }

                    showSettings();
                }
            );
    }


    function applyMapStyle(
        style
    ) {

        if (
            style ===
            "standard"
        ) {

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

        } else {

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
        }
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
                        ParcelScope is a public-data
                        property research tool for
                        exploring Idaho parcel boundaries
                        and available property information.
                    </p>

                </div>

                <div class="page-section">

                    <h2>
                        Features
                    </h2>

                    <ul>

                        <li>
                            Multiple parcel data sources.
                        </li>

                        <li>
                            Parcel boundary mapping.
                        </li>

                        <li>
                            Property selection.
                        </li>

                        <li>
                            Owner and parcel searching.
                        </li>

                        <li>
                            Saved properties.
                        </li>

                        <li>
                            Idaho county exploration.
                        </li>

                    </ul>

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
       MAP MOVEMENT
    ===================================================== */

    map.on(
        "moveend",
        scheduleParcelLoad
    );


    function scheduleParcelLoad() {

        clearTimeout(
            loadTimer
        );

        loadTimer =
            setTimeout(
                () => {

                    loadParcels();

                },
                350
            );
    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function clean(
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


    function formatNumber(
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

            return clean(value);
        }


        return number.toLocaleString(
            undefined,
            {
                maximumFractionDigits:
                    2
            }
        );
    }


    function formatMoney(
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

            return clean(value);
        }


        return (
            "$" +
            number.toLocaleString(
                undefined,
                {
                    maximumFractionDigits:
                        0
                }
            )
        );
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    applyMapStyle(
        settings.mapStyle
    );


    status(
        "Connecting to Idaho parcel sources..."
    );


    /*
     * Load service schemas first.
     * Then load parcels.
     */

    (async () => {

        await loadSourceMetadata();

        status(
            "Idaho parcel sources connected"
        );

        setTimeout(
            () => {

                loadParcels();

            },
            300
        );

    })();


    console.log(
        "ParcelScope Idaho — new multi-source parcel engine initialized."
    );

});
