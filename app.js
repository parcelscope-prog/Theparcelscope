/* =========================================================
   PARCELSCOPE IDAHO
   Main Application
   Fresh parcel data on every app launch
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

    const mapStatus = document.getElementById("mapStatus");


    /* =====================================================
       DATA SOURCE

       A fresh cache-busting value is added when the app
       starts so the browser doesn't reuse an old request.
    ===================================================== */

    const cacheBuster = Date.now();

    const PARCEL_URL =
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";

    const PARCEL_QUERY_URL =
        PARCEL_URL + "/query";

    console.log(
        "ParcelScope starting fresh session:",
        new Date(cacheBuster).toLocaleString()
    );


    /* =====================================================
       OPEN / CLOSE MENU
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
       CREATE MAP
    ===================================================== */

    const map = L.map("map", {
        zoomControl: true,
        attributionControl: true
    });


    /* =====================================================
       SATELLITE MAP
    ===================================================== */

    const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution: "Tiles © Esri"
        }
    );

    satelliteLayer.addTo(map);


    /* =====================================================
       IDAHO STARTING VIEW
    ===================================================== */

    map.setView(
        [44.0682, -114.7420],
        6
    );


    /* =====================================================
       PARCEL BOUNDARIES
    ===================================================== */

    const parcelLayer = L.esri.featureLayer({
        url: PARCEL_URL,

        style: {
            color: "#7cff6b",
            weight: 1,
            opacity: 0.65,
            fillOpacity: 0
        },

        minZoom: 12
    });

    parcelLayer.addTo(map);


    /* =====================================================
       SELECTED PARCEL
    ===================================================== */

    let selectedParcel = null;

    function clearSelectedParcel() {

        if (selectedParcel) {
            map.removeLayer(selectedParcel);
            selectedParcel = null;
        }

    }


    function showSelectedParcel(feature) {

        clearSelectedParcel();

        selectedParcel = L.geoJSON(feature, {

            style: {
                color: "#00ffff",
                weight: 4,
                opacity: 1,
                fillColor: "#00ffff",
                fillOpacity: 0.12
            }

        }).addTo(map);

    }


    /* =====================================================
       MAP STATUS
    ===================================================== */

    mapStatus.innerHTML = `
        <span class="status-dot"></span>
        <span>Connecting to Idaho parcel data...</span>
    `;


    /* =====================================================
       FRESH DATA CHECK
       
       This runs when ParcelScope opens.
       It contacts the Idaho service instead of using a
       saved property database.
    ===================================================== */

    async function checkParcelService() {

        try {

            const response = await fetch(
                PARCEL_QUERY_URL +
                "?where=1%3D1&returnCountOnly=true&f=json&_=" +
                cacheBuster,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Parcel service returned an error."
                );
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(
                    data.error.message ||
                    "Parcel service error."
                );
            }

            mapStatus.innerHTML = `
                <span class="status-dot"></span>
                <span>Idaho parcel data ready</span>
            `;

            console.log(
                "Fresh Idaho parcel connection established."
            );

        } catch (error) {

            console.error(
                "Parcel service connection error:",
                error
            );

            mapStatus.innerHTML = `
                <span class="status-dot"></span>
                <span>Parcel data connection unavailable</span>
            `;

        }

    }


    checkParcelService();


    /* =====================================================
       HELPERS
    ===================================================== */

    function valueOrUnavailable(value) {

        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {

            return "Not available";

        }

        return escapeHTML(String(value));

    }


    function formatNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return "Not available";

        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return escapeHTML(String(value));
        }

        return number.toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );

    }


    function escapeHTML(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    /* =====================================================
       DISPLAY PROPERTY
    ===================================================== */

    function displayProperty(attributes) {

        const owner1 =
            valueOrUnavailable(attributes.OWNER1);

        const owner2 =
            valueOrUnavailable(attributes.OWNER2);

        const parcelID =
            valueOrUnavailable(attributes.PARCEL_ID);

        const county =
            valueOrUnavailable(attributes.County);

        const acreage =
            formatNumber(attributes.ASR_ACRES);

        const address =
            valueOrUnavailable(attributes.SITE_ADD);

        const city =
            valueOrUnavailable(attributes.SITE_CITY);

        const zip =
            valueOrUnavailable(attributes.SITE_ZIP);

        const mailingAddress =
            valueOrUnavailable(attributes.MAIL_ADD1);

        const mailingCity =
            valueOrUnavailable(attributes.MAIL_CITY);

        const mailingState =
            valueOrUnavailable(attributes.MAIL_STATE);

        const mailingZip =
            valueOrUnavailable(attributes.MAIL_ZIP);

        const legalDescription =
            valueOrUnavailable(attributes.LGL_DESCR);

        const updated =
            attributes.UPDATED
                ? new Date(attributes.UPDATED)
                    .toLocaleDateString()
                : "Not available";


        propertyTitle.textContent =
            owner1 !== "Not available"
                ? owner1
                : "Property Information";


        propertyContent.innerHTML = `

            <div class="property-field">
                <div class="property-label">
                    Current Owner
                </div>

                <div class="property-value">
                    ${owner1}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Additional Owner
                </div>

                <div class="property-value">
                    ${owner2}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Parcel ID
                </div>

                <div class="property-value">
                    ${parcelID}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    County
                </div>

                <div class="property-value">
                    ${county}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Acreage
                </div>

                <div class="property-value">
                    ${acreage} acres
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Property Address
                </div>

                <div class="property-value">
                    ${address}<br>
                    ${city}, ID ${zip}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Mailing Address
                </div>

                <div class="property-value">
                    ${mailingAddress}<br>
                    ${mailingCity},
                    ${mailingState}
                    ${mailingZip}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Legal Description
                </div>

                <div class="property-value">
                    ${legalDescription}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Parcel Data Updated
                </div>

                <div class="property-value">
                    ${updated}
                </div>
            </div>


            <div class="property-field">
                <div class="property-label">
                    Ownership History
                </div>

                <div class="property-value">
                    Historical ownership records are not
                    included in this statewide parcel layer.
                    County historical records can be added
                    separately when available.
                </div>
            </div>

        `;

        propertyPanel.classList.add("open");

    }


    /* =====================================================
       FIND PARCEL AT CLICK LOCATION
    ===================================================== */

    function findParcel(latitude, longitude) {

        mapStatus.innerHTML = `
            <span class="status-dot"></span>
            <span>Getting fresh parcel information...</span>
        `;


        parcelLayer
            .query()
            .intersects(
                L.latLng(latitude, longitude)
            )
            .fields([
                "PARCEL_ID",
                "OWNER1",
                "OWNER2",
                "County",
                "ASR_ACRES",
                "SITE_ADD",
                "SITE_CITY",
                "SITE_ZIP",
                "MAIL_ADD1",
                "MAIL_CITY",
                "MAIL_STATE",
                "MAIL_ZIP",
                "LGL_DESCR",
                "UPDATED"
            ])
            .returnGeometry(true)
            .run((error, featureCollection) => {

                if (error) {

                    console.error(
                        "Parcel lookup error:",
                        error
                    );

                    mapStatus.innerHTML = `
                        <span class="status-dot"></span>
                        <span>Parcel lookup failed</span>
                    `;

                    propertyTitle.textContent =
                        "Parcel Lookup";

                    propertyContent.innerHTML = `
                        <p class="empty-message">
                            We couldn't retrieve parcel
                            information right now.
                        </p>
                    `;

                    propertyPanel.classList.add("open");

                    return;
                }


                if (
                    !featureCollection ||
                    !featureCollection.features ||
                    featureCollection.features.length === 0
                ) {

                    mapStatus.innerHTML = `
                        <span class="status-dot"></span>
                        <span>No parcel found</span>
                    `;

                    propertyTitle.textContent =
                        "No Parcel Found";

                    propertyContent.innerHTML = `
                        <p class="empty-message">
                            There is no parcel record at
                            this location in the statewide
                            Idaho parcel layer.
                        </p>
                    `;

                    propertyPanel.classList.add("open");

                    return;
                }


                const feature =
                    featureCollection.features[0];


                showSelectedParcel(feature);

                displayProperty(
                    feature.properties
                );


                mapStatus.innerHTML = `
                    <span class="status-dot"></span>
                    <span>Fresh parcel information loaded</span>
                `;

            });

    }


    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on("click", (event) => {

        findParcel(
            event.latlng.lat,
            event.latlng.lng
        );

    });


    /* =====================================================
       SEARCH
    ===================================================== */

    function performSearch() {

        const query =
            searchInput.value.trim();


        if (!query) {

            searchResults.classList.remove("open");

            return;

        }


        mapStatus.innerHTML = `
            <span class="status-dot"></span>
            <span>Searching fresh parcel data...</span>
        `;


        const safeQuery =
            query.replaceAll("'", "''");


        const where = `
            PARCEL_ID LIKE '%${safeQuery}%'
            OR OWNER1 LIKE '%${safeQuery}%'
            OR OWNER2 LIKE '%${safeQuery}%'
            OR SITE_ADD LIKE '%${safeQuery}%'
        `;


        parcelLayer
            .query()
            .where(where)
            .limit(25)
            .fields([
                "PARCEL_ID",
                "OWNER1",
                "OWNER2",
                "County",
                "ASR_ACRES",
                "SITE_ADD",
                "SITE_CITY",
                "SITE_ZIP"
            ])
            .returnGeometry(true)
            .run((error, featureCollection) => {

                if (error) {

                    console.error(
                        "Search error:",
                        error
                    );

                    resultsContent.innerHTML = `
                        <div class="search-result">

                            <div class="search-result-title">
                                Search failed
                            </div>

                            <div class="search-result-details">
                                The parcel service could
                                not complete the search.
                            </div>

                        </div>
                    `;

                    searchResults.classList.add("open");

                    return;
                }


                const features =
                    featureCollection &&
                    featureCollection.features
                        ? featureCollection.features
                        : [];


                if (features.length === 0) {

                    resultsContent.innerHTML = `
                        <div class="search-result">

                            <div class="search-result-title">
                                No parcels found
                            </div>

                            <div class="search-result-details">
                                No matching Idaho parcel
                                records were found.
                            </div>

                        </div>
                    `;

                    searchResults.classList.add("open");

                    mapStatus.innerHTML = `
                        <span class="status-dot"></span>
                        <span>No results</span>
                    `;

                    return;
                }


                resultsContent.innerHTML = "";


                features.forEach((feature) => {

                    const data =
                        feature.properties;


                    const result =
                        document.createElement("div");

                    result.className =
                        "search-result";


                    result.innerHTML = `

                        <div class="search-result-title">
                            ${valueOrUnavailable(data.OWNER1)}
                        </div>

                        <div class="search-result-details">

                            Parcel:
                            ${valueOrUnavailable(data.PARCEL_ID)}

                            <br>

                            ${valueOrUnavailable(data.SITE_ADD)}

                            <br>

                            ${valueOrUnavailable(data.SITE_CITY)},
                            ID
                            ${valueOrUnavailable(data.SITE_ZIP)}

                            <br>

                            ${valueOrUnavailable(data.County)}
                            County

                        </div>

                    `;


                    result.addEventListener(
                        "click",
                        () => {

                            showSelectedParcel(
                                feature
                            );

                            displayProperty(
                                data
                            );

                            searchResults.classList.remove(
                                "open"
                            );


                            if (feature.geometry) {

                                const bounds =
                                    L.geoJSON(
                                        feature
                                    ).getBounds();


                                if (bounds.isValid()) {

                                    map.fitBounds(
                                        bounds,
                                        {
                                            padding: [
                                                50,
                                                50
                                            ]
                                        }
                                    );

                                }

                            }

                        }
                    );


                    resultsContent.appendChild(
                        result
                    );

                });


                searchResults.classList.add(
                    "open"
                );


                mapStatus.innerHTML = `
                    <span class="status-dot"></span>
                    <span>
                        ${features.length}
                        fresh result${features.length === 1 ? "" : "s"}
                    </span>
                `;

            });

    }


    searchButton.addEventListener(
        "click",
        performSearch
    );


    searchInput.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {
                performSearch();
            }

        }
    );


    /* =====================================================
       MENU ITEMS
    ===================================================== */

    const menuItems =
        document.querySelectorAll(".menu-item");


    menuItems.forEach((item) => {

        item.addEventListener("click", () => {

            menuItems.forEach((button) => {
                button.classList.remove("active");
            });

            item.classList.add("active");

        });

    });


    /* =====================================================
       WINDOW RESIZE
    ===================================================== */

    window.addEventListener("resize", () => {

        setTimeout(() => {
            map.invalidateSize();
        }, 200);

    });


    /* =====================================================
       INITIALIZATION COMPLETE
    ===================================================== */

    console.log(
        "ParcelScope Idaho initialized with fresh data."
    );

});