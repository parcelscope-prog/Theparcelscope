/* =========================================================
   PARCELSCOPE IDAHO
   Live Parcel Map
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

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


    /* =====================================================
       MENU
    ===================================================== */

    menuButton.addEventListener("click", () => {
        sideMenu.classList.add("open");
    });

    closeMenu.addEventListener("click", () => {
        sideMenu.classList.remove("open");
    });


    /* =====================================================
       CLOSE PANELS
    ===================================================== */

    closeProperty.addEventListener("click", () => {
        propertyPanel.classList.remove("open");

        if (selectedParcel) {
            selectedParcel.setStyle({
                color: "#62a5d5",
                weight: 1,
                fillColor: "#3f7aa8",
                fillOpacity: 0.04
            });
        }
    });

    closeResults.addEventListener("click", () => {
        searchResults.classList.remove("open");
    });


    /* =====================================================
       MAP
    ===================================================== */

    const map = L.map("map", {
        zoomControl: true,
        attributionControl: true
    });


    /* =====================================================
       SATELLITE
    ===================================================== */

    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Tiles © Esri"
        }
    ).addTo(map);


    map.setView(
        [44.0682, -114.7420],
        6
    );


    /* =====================================================
       PARCEL SERVICE
       
       Idaho statewide public parcel polygons.
    ===================================================== */

    const PARCEL_SERVICE =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";


    let parcelLayer = null;
    let selectedParcel = null;


    /* =====================================================
       STATUS
    ===================================================== */

    function setStatus(message) {

        mapStatus.innerHTML = `
            <span class="status-dot"></span>
            <span>${escapeHTML(message)}</span>
        `;

    }


    /* =====================================================
       DEFAULT PARCEL STYLE
    ===================================================== */

    function parcelStyle() {

        return {
            color: "#72a9cc",
            weight: 1,
            opacity: 0.85,
            fillColor: "#3f7aa8",
            fillOpacity: 0.025
        };

    }


    /* =====================================================
       SELECTED PARCEL STYLE
    ===================================================== */

    function selectedStyle() {

        return {
            color: "#ffffff",
            weight: 4,
            opacity: 1,
            fillColor: "#3f7aa8",
            fillOpacity: 0.25
        };

    }


    /* =====================================================
       SELECT A PARCEL
    ===================================================== */

    function selectParcel(feature, layer) {

        if (selectedParcel) {

            selectedParcel.setStyle(
                parcelStyle()
            );

        }


        selectedParcel = layer;


        layer.setStyle(
            selectedStyle()
        );


        layer.bringToFront();


        showProperty(
            feature.properties
        );


        propertyPanel.classList.add(
            "open"
        );

    }


    /* =====================================================
       SHOW PROPERTY INFORMATION
    ===================================================== */

    function showProperty(p) {

        const owner =
            [p.OWNER1, p.OWNER2]
                .filter(Boolean)
                .join(" / ") ||
            "Not provided";


        const address =
            p.SITE_ADD ||
            "Not provided";


        const city =
            p.SITE_CITY ||
            "";


        const zip =
            p.SITE_ZIP ||
            "";


        propertyTitle.textContent =
            "Property Information";


        propertyContent.innerHTML = `

            <div class="property-field">

                <div class="property-label">
                    Current Owner
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

                    ${escapeHTML(address)}

                    <br>

                    ${escapeHTML(city)}
                    ${escapeHTML(zip)}

                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    County
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        p.County ||
                        "Not provided"
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Parcel ID
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        p.PARCEL_ID ||
                        "Not provided"
                    )}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Acreage
                </div>

                <div class="property-value">
                    ${
                        p.ASR_ACRES !== null &&
                        p.ASR_ACRES !== undefined
                            ? escapeHTML(
                                Number(
                                    p.ASR_ACRES
                                ).toFixed(2)
                              ) + " acres"
                            : "Not provided"
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Land Value
                </div>

                <div class="property-value">
                    ${formatMoney(p.VAL_LAND)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Improvement Value
                </div>

                <div class="property-value">
                    ${formatMoney(p.VAL_IMPVTS)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Total Assessed Value
                </div>

                <div class="property-value">
                    ${formatMoney(p.VAL_TOTAL)}
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Data Updated
                </div>

                <div class="property-value">
                    ${
                        p.UPDATED
                            ? escapeHTML(
                                new Date(
                                    p.UPDATED
                                ).toLocaleDateString()
                              )
                            : "Not provided"
                    }
                </div>

            </div>


            <div class="property-field">

                <div class="property-label">
                    Ownership History
                </div>

                <div class="property-value">

                    Historical ownership is not included
                    in the statewide parcel layer.

                    County assessor records may contain
                    additional historical information.

                </div>

            </div>

        `;

    }


    /* =====================================================
       LOAD PARCELS IN CURRENT MAP AREA
       
       Parcels remain visible whenever the map is zoomed
       close enough to actually display them.
    ===================================================== */

    function loadParcels() {

        const zoom =
            map.getZoom();


        if (zoom < 9) {

            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

                parcelLayer = null;

            }


            setStatus(
                "Zoom in to view property boundaries"
            );

            return;

        }


        const bounds =
            map.getBounds();


        const params =
            new URLSearchParams({

                where: "1=1",

                geometry:
                    `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,

                geometryType:
                    "esriGeometryEnvelope",

                inSR: "4326",

                spatialRel:
                    "esriSpatialRelIntersects",

                outFields: "*",

                returnGeometry: "true",

                outSR: "4326",

                f: "geojson",

                resultRecordCount: "2000"

            });


        setStatus(
            "Loading property boundaries..."
        );


        fetch(
            `${PARCEL_SERVICE}/query?${params}`
        )

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    "Parcel service error"
                );

            }

            return response.json();

        })

        .then(data => {

            if (
                !data.features ||
                !Array.isArray(data.features)
            ) {

                throw new Error(
                    "No parcel data returned"
                );

            }


            if (parcelLayer) {

                map.removeLayer(
                    parcelLayer
                );

            }


            parcelLayer =
                L.geoJSON(
                    data,
                    {

                        style:
                            parcelStyle,


                        onEachFeature:
                            (feature, layer) => {

                                layer.on(
                                    "click",
                                    event => {

                                        L.DomEvent.stopPropagation(
                                            event
                                        );


                                        selectParcel(
                                            feature,
                                            layer
                                        );

                                    }
                                );


                                layer.on(
                                    "mouseover",
                                    () => {

                                        if (
                                            layer !==
                                            selectedParcel
                                        ) {

                                            layer.setStyle({
                                                weight: 2,
                                                fillOpacity: 0.12
                                            });

                                        }

                                    }
                                );


                                layer.on(
                                    "mouseout",
                                    () => {

                                        if (
                                            layer !==
                                            selectedParcel
                                        ) {

                                            layer.setStyle(
                                                parcelStyle()
                                            );

                                        }

                                    }
                                );

                            }

                    }
                );


            parcelLayer.addTo(
                map
            );


            setStatus(
                `${data.features.length} property boundaries loaded`
            );

        })

        .catch(error => {

            console.error(
                "Parcel loading error:",
                error
            );


            setStatus(
                "Unable to load property boundaries"
            );

        });

    }


    /* =====================================================
       RELOAD PARCELS AFTER MAP MOVEMENT
    ===================================================== */

    let reloadTimer = null;


    function scheduleParcelReload() {

        clearTimeout(
            reloadTimer
        );


        reloadTimer =
            setTimeout(
                () => {

                    loadParcels();

                },
                400
            );

    }


    map.on(
        "moveend",
        scheduleParcelReload
    );


    map.on(
        "zoomend",
        scheduleParcelReload
    );


    /* =====================================================
       SEARCH
    ===================================================== */

    function performSearch() {

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

                <div class="search-result-title">
                    Searching Idaho parcels...
                </div>

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


        const where = `
            OWNER1 LIKE '%${safeQuery}%'
            OR OWNER2 LIKE '%${safeQuery}%'
            OR SITE_ADD LIKE '%${safeQuery}%'
            OR SITE_CITY LIKE '%${safeQuery}%'
            OR PARCEL_ID LIKE '%${safeQuery}%'
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


        fetch(
            `${PARCEL_SERVICE}/query?${params}`
        )

        .then(response =>
            response.json()
        )

        .then(data => {

            resultsContent.innerHTML =
                "";


            if (
                !data.features ||
                data.features.length === 0
            ) {

                resultsContent.innerHTML = `

                    <div class="search-result">

                        <div class="search-result-title">
                            No properties found
                        </div>

                        <div class="search-result-details">
                            Try an owner name,
                            address, or parcel ID.
                        </div>

                    </div>

                `;

                return;

            }


            data.features.forEach(
                feature => {

                    const p =
                        feature.properties;


                    const result =
                        document.createElement(
                            "div"
                        );


                    result.className =
                        "search-result";


                    result.innerHTML = `

                        <div class="search-result-title">

                            ${escapeHTML(
                                [p.OWNER1, p.OWNER2]
                                    .filter(Boolean)
                                    .join(" / ") ||
                                "Owner not provided"
                            )}

                        </div>


                        <div class="search-result-details">

                            ${escapeHTML(
                                p.SITE_ADD ||
                                "Address not provided"
                            )}

                            <br>

                            ${escapeHTML(
                                p.SITE_CITY ||
                                ""
                            )}

                            ${escapeHTML(
                                p.SITE_ZIP ||
                                ""
                            )}

                            <br>

                            Parcel:
                            ${escapeHTML(
                                p.PARCEL_ID ||
                                "Not provided"
                            )}

                        </div>

                    `;


                    result.addEventListener(
                        "click",
                        () => {

                            selectSearchedProperty(
                                feature
                            );

                        }
                    );


                    resultsContent.appendChild(
                        result
                    );

                }
            );

        })

        .catch(error => {

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
                        The Idaho parcel service
                        could not be reached.
                    </div>

                </div>

            `;

        });

    }


    /* =====================================================
       SELECT SEARCHED PROPERTY
       
       Finds the exact property geometry,
       zooms to it, highlights it,
       and opens its information.
    ===================================================== */

    function selectSearchedProperty(feature) {

        const geometry =
            feature.geometry;


        if (!geometry) {

            showProperty(
                feature.properties
            );

            propertyPanel.classList.add(
                "open"
            );

            return;

        }


        const temporaryLayer =
            L.geoJSON(
                feature
            );


        const bounds =
            temporaryLayer.getBounds();


        if (
            bounds.isValid()
        ) {

            map.fitBounds(
                bounds,
                {
                    padding: [50, 50],
                    maxZoom: 18
                }
            );

        }


        searchResults.classList.remove(
            "open"
        );


        showProperty(
            feature.properties
        );


        propertyPanel.classList.add(
            "open"
        );


        /*
         * After the map moves and parcels reload,
         * find the exact parcel again and highlight it.
         */

        setTimeout(
            () => {

                highlightMatchingParcel(
                    feature.properties
                );

            },
            700
        );

    }


    /* =====================================================
       HIGHLIGHT SEARCHED PARCEL
    ===================================================== */

    function highlightMatchingParcel(
        properties
    ) {

        if (!parcelLayer) {
            return;
        }


        const parcelID =
            properties.PARCEL_ID;


        parcelLayer.eachLayer(
            layer => {

                const p =
                    layer.feature.properties;


                if (
                    parcelID &&
                    p.PARCEL_ID === parcelID
                ) {

                    selectParcel(
                        layer.feature,
                        layer
                    );

                }

            }
        );

    }


    /* =====================================================
       MAP CLICK FALLBACK
       
       If the user clicks outside a parcel, nothing
       fake is displayed.
    ===================================================== */

    map.on(
        "click",
        () => {

            /*
             * Parcel clicks are handled by the
             * individual polygon layers.
             */

        }
    );


    /* =====================================================
       MENU ITEMS
    ===================================================== */

    document
        .querySelectorAll(".menu-item")
        .forEach(item => {

            item.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".menu-item"
                        )
                        .forEach(button => {

                            button.classList.remove(
                                "active"
                            );

                        });


                    item.classList.add(
                        "active"
                    );

                }
            );

        });


    /* =====================================================
       HELPERS
    ===================================================== */

    function escapeHTML(value) {

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


    function formatMoney(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return "Not provided";

        }


        const number =
            Number(value);


        if (
            Number.isNaN(number)
        ) {

            return escapeHTML(
                value
            );

        }


        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0
            }
        ).format(number);

    }


    /* =====================================================
       RESIZE
    ===================================================== */

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


    /* =====================================================
       START
    ===================================================== */

    setStatus(
        "Idaho map ready"
    );


    /*
     * Load immediately.
     *
     * At the initial statewide zoom the app waits until
     * you zoom in enough to display individual parcels.
     */

    loadParcels();


    console.log(
        "ParcelScope Idaho initialized."
    );

});
