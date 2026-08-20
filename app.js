/* =========================================================
   PARCELSCOPE IDAHO
   Live Idaho Parcel GIS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

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

    const mapStatus =
        document.getElementById("mapStatus");


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
       IDAHO STATE OUTLINE
       
       Simple geographic outline using Idaho's approximate
       state boundary coordinates.
    ===================================================== */

    const idahoOutline = [
        [49.0000, -117.0319],
        [49.0000, -116.0486],
        [47.9772, -116.0486],
        [47.9772, -115.7307],
        [47.5805, -115.7307],
        [47.5805, -115.7280],
        [47.3000, -115.7280],
        [47.3000, -115.6200],
        [46.5000, -115.6200],
        [46.5000, -114.9000],
        [45.9000, -114.9000],
        [45.9000, -114.0000],
        [45.5500, -114.0000],
        [45.5500, -113.8000],
        [45.3000, -113.8000],
        [45.3000, -112.6000],
        [44.4800, -112.6000],
        [44.4800, -111.0500],
        [42.0000, -111.0500],
        [42.0000, -117.2430],
        [43.0000, -117.2430],
        [43.0000, -117.0260],
        [44.0000, -117.0260],
        [44.0000, -117.0000],
        [45.0000, -117.0000],
        [45.0000, -116.0000],
        [46.0000, -116.0000],
        [47.0000, -116.0000],
        [47.0000, -117.0319],
        [49.0000, -117.0319]
    ];


    L.polygon(
        idahoOutline,
        {
            color: "#ffffff",
            weight: 3,
            opacity: 0.9,
            fill: false,
            interactive: false
        }
    ).addTo(map);


    /* =====================================================
       COUNTY BOUNDARIES
       
       Loaded from Idaho's public GIS service when available.
    ===================================================== */

    try {

        L.esri.dynamicMapLayer({

            url:
                "https://gis2.idaho.gov/arcgis/rest/services/Boundaries/Idaho_Counties/MapServer",

            opacity: 0.55,

            layers: [0]

        }).addTo(map);

    } catch (error) {

        console.warn(
            "County boundary layer unavailable.",
            error
        );

    }


    /* =====================================================
       STATEWIDE IDAHO PARCEL SERVICE
    ===================================================== */

    const PARCEL_SERVICE =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/7";


    let parcelLayer = null;


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
       LOAD PARCELS
    ===================================================== */

    function loadParcels() {

        if (map.getZoom() < 10) {

            if (parcelLayer) {

                map.removeLayer(parcelLayer);

                parcelLayer = null;

            }

            setStatus(
                "Zoom in to view parcel boundaries"
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

                outFields:
                    "*",

                returnGeometry:
                    "true",

                outSR:
                    "4326",

                f:
                    "geojson",

                resultRecordCount:
                    "1000"

            });


        setStatus(
            "Loading parcel boundaries..."
        );


        fetch(
            `${PARCEL_SERVICE}/query?${params}`
        )

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    "Parcel server error"
                );

            }

            return response.json();

        })

        .then(data => {

            if (!data.features) {

                throw new Error(
                    "No parcel features returned"
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

                        style: {

                            color: "#62a5d5",

                            weight: 1,

                            opacity: 0.9,

                            fillColor: "#3f7aa8",

                            fillOpacity: 0.04

                        },


                        onEachFeature:
                            (feature, layer) => {

                                layer.on(
                                    "click",
                                    () => {

                                        showProperty(
                                            feature.properties
                                        );

                                    }
                                );


                                layer.on(
                                    "mouseover",
                                    () => {

                                        layer.setStyle({

                                            weight: 2,

                                            fillOpacity: 0.16

                                        });

                                    }
                                );


                                layer.on(
                                    "mouseout",
                                    () => {

                                        parcelLayer.resetStyle(
                                            layer
                                        );

                                    }
                                );

                            }

                    }
                );


            parcelLayer.addTo(map);


            setStatus(
                `${data.features.length} parcels loaded`
            );

        })

        .catch(error => {

            console.error(
                error
            );

            setStatus(
                "Parcel data could not be loaded"
            );

        });

    }


    /* =====================================================
       MAP MOVEMENT
    ===================================================== */

    let loadTimer;


    function scheduleLoad() {

        clearTimeout(
            loadTimer
        );


        loadTimer =
            setTimeout(
                loadParcels,
                500
            );

    }


    map.on(
        "moveend",
        scheduleLoad
    );

    map.on(
        "zoomend",
        scheduleLoad
    );


    /* =====================================================
       PROPERTY INFORMATION
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
                    Address
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
                        p.COUNTY ||
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
                    ${escapeHTML(
                        p.ASR_ACRES ??
                        "Not provided"
                    )}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Land Value
                </div>

                <div class="property-value">
                    ${formatMoney(
                        p.VAL_LAND
                    )}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Improvement Value
                </div>

                <div class="property-value">
                    ${formatMoney(
                        p.VAL_IMPVTS
                    )}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Total Value
                </div>

                <div class="property-value">
                    ${formatMoney(
                        p.VAL_TOTAL
                    )}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Data Updated
                </div>

                <div class="property-value">
                    ${escapeHTML(
                        p.UPDATED ??
                        "Not provided"
                    )}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Ownership History
                </div>

                <div class="property-value">
                    Historical owners are not included
                    in the statewide parcel dataset.
                    County records may contain additional
                    historical information.
                </div>
            </div>

        `;


        propertyPanel.classList.add(
            "open"
        );

    }


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
                    Searching...
                </div>

            </div>

        `;


        searchResults.classList.add(
            "open"
        );


        const safe =
            query.replaceAll(
                "'",
                "''"
            );


        const where = `
            OWNER1 LIKE '%${safe}%'
            OR OWNER2 LIKE '%${safe}%'
            OR SITE_ADD LIKE '%${safe}%'
            OR PARCEL_ID LIKE '%${safe}%'
        `;


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
                    "json"

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
                            No results found
                        </div>

                        <div class="search-result-details">
                            No matching public Idaho
                            parcel was found.
                        </div>

                    </div>

                `;

                return;

            }


            data.features.forEach(
                feature => {

                    const p =
                        feature.attributes;


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
                                p.COUNTY ||
                                "County not provided"
                            )}

                            County

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

                            const geometry =
                                feature.geometry;


                            if (
                                geometry &&
                                geometry.x !== undefined
                            ) {

                                map.setView(
                                    [
                                        geometry.y,
                                        geometry.x
                                    ],
                                    17
                                );

                            }


                            showProperty(
                                p
                            );


                            searchResults.classList.remove(
                                "open"
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
                error
            );


            resultsContent.innerHTML = `

                <div class="search-result">

                    <div class="search-result-title">
                        Search unavailable
                    </div>

                    <div class="search-result-details">
                        The public Idaho parcel service
                        could not be reached.
                    </div>

                </div>

            `;

        });

    }


    searchButton.addEventListener(
        "click",
        performSearch
    );


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
                        .querySelectorAll(".menu-item")
                        .forEach(button =>
                            button.classList.remove(
                                "active"
                            )
                        );


                    item.classList.add(
                        "active"
                    );

                }
            );

        });


    /* =====================================================
       UTILITIES
    ===================================================== */

    function escapeHTML(value) {

        return String(value)

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
       INITIAL LOAD
    ===================================================== */

    loadParcels();


    setStatus(
        "Idaho parcel map ready"
    );


    console.log(
        "ParcelScope Idaho initialized."
    );

});
