/* =========================================================
   PARCELSCOPE IDAHO
   Version: 5781683

   State parcel source:
   Idaho Public Parcel Framework
   ========================================================= */

const VERSION = "5781683";

const PARCEL_SERVICE =
    "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7";

const GEOCODER =
    "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

let map;
let parcelLayer = null;
let selectedProperty = null;

let savedProperties =
    JSON.parse(localStorage.getItem("parcelscope_saved") || "[]");


/* =========================================================
   MAP
   ========================================================= */

function startMap() {

    map = L.map("map", {
        zoomControl: true,
        preferCanvas: true,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false
    }).setView([44.0682, -114.7420], 7);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(map);

    setStatus("ParcelScope ready");

    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {

    const status =
        document.getElementById("mapStatusText");

    if (status) {
        status.textContent = text;
    }
}


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function esc(value) {

    if (value === null ||
        value === undefined ||
        value === "") {

        return "Unavailable";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function clean(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return "";
    }

    return String(value).trim();
}


function formatMoney(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Unavailable";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return esc(value);
    }

    return number.toLocaleString(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    );
}


function formatAcres(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Unavailable";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return esc(value);
    }

    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 2
        }
    ) + " acres";
}


/* =========================================================
   ARC GIS QUERY
   ========================================================= */

async function arcgisQuery(where, options = {}) {

    const params = new URLSearchParams();

    params.set("where", where);
    params.set(
        "outFields",
        options.outFields ||
        "*"
    );

    params.set(
        "returnGeometry",
        options.returnGeometry === false
            ? "false"
            : "true"
    );

    params.set(
        "outSR",
        "4326"
    );

    params.set(
        "f",
        "json"
    );

    if (options.resultRecordCount) {
        params.set(
            "resultRecordCount",
            String(options.resultRecordCount)
        );
    }

    const url =
        PARCEL_SERVICE +
        "/query?" +
        params.toString();

    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error(
            "Parcel service returned " +
            response.status
        );
    }

    const data =
        await response.json();

    if (data.error) {
        throw new Error(
            data.error.message ||
            "ArcGIS query failed"
        );
    }

    return data;
}


/* =========================================================
   SEARCH
   ========================================================= */

async function searchParcels(rawSearch) {

    const search =
        clean(rawSearch);

    if (!search) {
        setStatus(
            "Enter an address, owner, or parcel ID"
        );

        return;
    }

    setStatus("Searching Idaho parcel records...");

    closePropertyPanel();

    const searchResults =
        document.getElementById("searchResults");

    const resultsContent =
        document.getElementById("resultsContent");

    searchResults.classList.add("open");

    resultsContent.innerHTML = `
        <div class="page-card">
            Searching statewide parcel data...
        </div>
    `;

    try {

        const safe =
            search
                .replace(/'/g, "''")
                .trim();

        const compact =
            safe
                .replace(/[\s,.-]/g, "");

        /*
         * Search several useful statewide fields.
         *
         * Exact/partial parcel ID
         * Site address
         * Owner
         * City
         */

        const where = `
            UPPER(PARCEL_ID) LIKE UPPER('%${safe}%')
            OR UPPER(SITE_ADD) LIKE UPPER('%${safe}%')
            OR UPPER(SITE_CITY) LIKE UPPER('%${safe}%')
            OR UPPER(OWNER1) LIKE UPPER('%${safe}%')
            OR UPPER(OWNER2) LIKE UPPER('%${safe}%')
            OR UPPER(MAIL_ADD1) LIKE UPPER('%${safe}%')
            OR UPPER(MAIL_CITY) LIKE UPPER('%${safe}%')
        `;

        let data =
            await arcgisQuery(
                where,
                {
                    returnGeometry: true,
                    resultRecordCount: 30
                }
            );

        let features =
            data.features || [];

        /*
         * If the first search returned nothing,
         * try a compact parcel-ID search.
         */

        if (
            features.length === 0 &&
            compact !== safe
        ) {

            const idWhere =
                `UPPER(PARCEL_ID) LIKE UPPER('%${compact}%')`;

            data =
                await arcgisQuery(
                    idWhere,
                    {
                        returnGeometry: true,
                        resultRecordCount: 30
                    }
                );

            features =
                data.features || [];
        }

        if (features.length === 0) {

            resultsContent.innerHTML = `
                <div class="page-card">
                    <strong>No parcels found</strong>
                    <div style="margin-top:6px;color:#aaa;">
                        Try a full or partial street address,
                        owner name, or parcel ID.
                    </div>
                </div>
            `;

            setStatus("No parcel matches found");

            return;
        }

        renderSearchResults(features);

        setStatus(
            `${features.length} parcel` +
            (features.length === 1 ? "" : "s") +
            " found"
        );

    } catch (error) {

        console.error(error);

        resultsContent.innerHTML = `
            <div class="page-card">
                <strong>Parcel search failed</strong>

                <div style="margin-top:7px;color:#aaa;">
                    The statewide parcel service could not
                    be reached right now.
                </div>

                <div style="margin-top:7px;color:#777;font-size:11px;">
                    ${esc(error.message)}
                </div>
            </div>
        `;

        setStatus("Parcel service unavailable");
    }
}


/* =========================================================
   RESULTS
   ========================================================= */

function renderSearchResults(features) {

    const resultsContent =
        document.getElementById("resultsContent");

    resultsContent.innerHTML = "";

    features.forEach((feature, index) => {

        const a =
            feature.attributes || {};

        const address =
            buildSiteAddress(a);

        const owner =
            clean(a.OWNER1) ||
            clean(a.OWNER2);

        const parcelId =
            clean(a.PARCEL_ID);

        const county =
            clean(a.COUNTY);

        const result =
            document.createElement("div");

        result.className =
            "search-result";

        result.innerHTML = `

            <div class="search-result-title">
                ${esc(address || "Parcel " + (index + 1))}
            </div>

            <div class="search-result-details">

                ${
                    parcelId
                        ? `Parcel ID: ${esc(parcelId)}`
                        : ""
                }

                ${
                    owner
                        ? `<br>Owner: ${esc(owner)}`
                        : ""
                }

                ${
                    county
                        ? `<br>County: ${esc(county)}`
                        : ""
                }

            </div>
        `;

        result.addEventListener(
            "click",
            () => selectParcel(feature)
        );

        resultsContent.appendChild(result);
    });
}


/* =========================================================
   ADDRESS
   ========================================================= */

function buildSiteAddress(a) {

    const parts = [];

    const address =
        clean(a.SITE_ADD);

    const city =
        clean(a.SITE_CITY);

    const zip =
        clean(a.SITE_ZIP);

    if (address) {
        parts.push(address);
    }

    if (city) {
        parts.push(city);
    }

    if (zip) {
        parts.push(zip);
    }

    return parts.join(", ");
}


/* =========================================================
   SELECT PARCEL
   ========================================================= */

function selectParcel(feature) {

    selectedProperty =
        feature;

    const attributes =
        feature.attributes || {};

    const geometry =
        feature.geometry;

    drawParcel(feature);

    openPropertyPanel(
        attributes,
        geometry
    );

    document
        .getElementById("searchResults")
        .classList.remove("open");

    setStatus("Parcel selected");
}


/* =========================================================
   DRAW PARCEL
   ========================================================= */

function drawParcel(feature) {

    if (parcelLayer) {

        map.removeLayer(
            parcelLayer
        );

        parcelLayer = null;
    }

    if (
        !feature ||
        !feature.geometry
    ) {
        return;
    }

    try {

        parcelLayer =
            L.geoJSON(
                {
                    type: "Feature",
                    properties:
                        feature.attributes || {},
                    geometry:
                        feature.geometry
                },
                {
                    style: {
                        color: "#62a7d6",
                        weight: 3,
                        opacity: 1,
                        fillColor: "#3f7aa8",
                        fillOpacity: 0.22
                    }
                }
            ).addTo(map);

        const bounds =
            parcelLayer.getBounds();

        if (bounds.isValid()) {

            map.fitBounds(
                bounds,
                {
                    padding: [80, 80],
                    maxZoom: 18
                }
            );
        }

    } catch (error) {

        console.error(
            "Could not draw parcel:",
            error
        );
    }
}


/* =========================================================
   PROPERTY PANEL
   ========================================================= */

function openPropertyPanel(a) {

    const panel =
        document.getElementById(
            "propertyPanel"
        );

    const title =
        document.getElementById(
            "propertyTitle"
        );

    const content =
        document.getElementById(
            "propertyContent"
        );

    const address =
        buildSiteAddress(a);

    title.textContent =
        address ||
        clean(a.PARCEL_ID) ||
        "Property Information";

    const owner =
        clean(a.OWNER1) ||
        clean(a.OWNER2);

    const owner2 =
        clean(a.OWNER2);

    let html = "";

    html += field(
        "Parcel ID",
        a.PARCEL_ID
    );

    html += field(
        "County",
        a.COUNTY
    );

    html += field(
        "Site Address",
        address
    );

    html += field(
        "Owner",
        owner
    );

    if (owner2 && owner2 !== owner) {

        html += field(
            "Additional Owner",
            owner2
        );
    }

    html += field(
        "Acreage",
        formatAcres(a.ASR_ACRES)
    );

    html += field(
        "Property Category",
        a.ASR_CATS
    );

    html += field(
        "Legal Description",
        a.LGL_DESCR
    );

    html += field(
        "Land Value",
        formatMoney(a.VAL_LAND)
    );

    html += field(
        "Improvement Value",
        formatMoney(a.VAL_IMPVTS)
    );

    html += field(
        "Total Assessed Value",
        formatMoney(a.VAL_TOTAL)
    );

    html += field(
        "Homeowner Exemption",
        formatYesNo(a.HOME_EXMPT)
    );

    html += field(
        "Data Steward",
        a.STEWARD
    );

    html += field(
        "Data Updated",
        a.UPDATED
    );

    html += `
        <button
            class="save-property"
            id="savePropertyButton"
        >
            Save Property
        </button>
    `;

    content.innerHTML =
        html;

    panel.classList.add("open");

    document
        .getElementById(
            "savePropertyButton"
        )
        .addEventListener(
            "click",
            saveCurrentProperty
        );
}


function field(label, value) {

    return `
        <div class="property-field">

            <div class="property-label">
                ${esc(label)}
            </div>

            <div class="property-value">
                ${esc(value)}
            </div>

        </div>
    `;
}


function formatYesNo(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "yes" ||
        String(value).toLowerCase() === "y"
    ) {
        return "Yes";
    }

    if (
        value === false ||
        value === 0 ||
        value === "0" ||
        String(value).toLowerCase() === "no" ||
        String(value).toLowerCase() === "n"
    ) {
        return "No";
    }

    return value || "Unavailable";
}


/* =========================================================
   SAVE
   ========================================================= */

function saveCurrentProperty() {

    if (!selectedProperty) {
        return;
    }

    const a =
        selectedProperty.attributes || {};

    const id =
        clean(a.PARCEL_ID);

    if (!id) {
        return;
    }

    const existing =
        savedProperties.find(
            p => p.PARCEL_ID === id
        );

    if (!existing) {

        savedProperties.push(a);

        localStorage.setItem(
            "parcelscope_saved",
            JSON.stringify(
                savedProperties
            )
        );
    }

    const button =
        document.getElementById(
            "savePropertyButton"
        );

    if (button) {

        button.textContent =
            "Property Saved";

        button.style.background =
            "#4f8f68";
    }
}


/* =========================================================
   CLOSE PANELS
   ========================================================= */

function closePropertyPanel() {

    document
        .getElementById(
            "propertyPanel"
        )
        .classList.remove("open");
}


function closeResults() {

    document
        .getElementById(
            "searchResults"
        )
        .classList.remove("open");
}


/* =========================================================
   SIDE MENU
   ========================================================= */

function openMenu() {

    document
        .getElementById(
            "sideMenu"
        )
        .classList.add("open");
}


function closeMenu() {

    document
        .getElementById(
            "sideMenu"
        )
        .classList.remove("open");
}


/* =========================================================
   FULL PAGES
   ========================================================= */

function openAppPage(
    title,
    kicker,
    html
) {

    document
        .getElementById("appPageTitle")
        .textContent = title;

    document
        .getElementById("appPageKicker")
        .textContent = kicker;

    document
        .getElementById("appPageContent")
        .innerHTML = html;

    document
        .getElementById("appPage")
        .classList.add("open");
}


function closeAppPage() {

    document
        .getElementById("appPage")
        .classList.remove("open");
}


/* =========================================================
   COUNTIES
   ========================================================= */

const IDAHO_COUNTIES = [
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

    const buttons =
        IDAHO_COUNTIES
            .map(
                county => `
                    <button
                        class="county-button"
                        data-county="${esc(county)}"
                    >
                        ${esc(county)} County
                    </button>
                `
            )
            .join("");

    openAppPage(
        "Idaho Counties",
        "PROPERTY",
        `
            <div class="page-section">

                <h2>
                    Search a county
                </h2>

                <div class="county-search">

                    <input
                        id="countyFilter"
                        type="search"
                        placeholder="Filter counties..."
                    >

                </div>

                <div class="county-grid">
                    ${buttons}
                </div>

            </div>
        `
    );

    const filter =
        document.getElementById(
            "countyFilter"
        );

    filter.addEventListener(
        "input",
        () => {

            const query =
                filter.value
                    .toLowerCase()
                    .trim();

            document
                .querySelectorAll(
                    ".county-button"
                )
                .forEach(button => {

                    button.classList.toggle(
                        "hidden",
                        !button.textContent
                            .toLowerCase()
                            .includes(query)
                    );
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

                    document
                        .getElementById(
                            "searchInput"
                        )
                        .value =
                        button.dataset.county +
                        " County";

                    closeAppPage();

                    searchParcels(
                        button.dataset.county
                    );
                }
            );
        });
}


/* =========================================================
   SAVED PROPERTIES
   ========================================================= */

function showSaved() {

    if (savedProperties.length === 0) {

        openAppPage(
            "Saved Properties",
            "PROPERTY",
            `
                <div class="page-card">
                    <strong>No saved properties</strong>

                    <div style="margin-top:6px;color:#aaa;">
                        Search for a parcel and use
                        "Save Property" to keep it here.
                    </div>
                </div>
            `
        );

        return;
    }

    const html =
        savedProperties
            .map(
                (p, index) => {

                    const address =
                        buildSiteAddress(p);

                    return `
                        <div
                            class="saved-property"
                            data-index="${index}"
                        >

                            <div>

                                <div class="saved-name">
                                    ${
                                        esc(
                                            address ||
                                            p.PARCEL_ID
                                        )
                                    }
                                </div>

                                <div class="saved-address">
                                    Parcel ID:
                                    ${esc(p.PARCEL_ID)}
                                </div>

                            </div>

                            <button
                                class="remove-saved"
                                data-remove="${index}"
                            >
                                ×
                            </button>

                        </div>
                    `;
                }
            )
            .join("");

    openAppPage(
        "Saved Properties",
        "PROPERTY",
        html
    );

    document
        .querySelectorAll(
            ".saved-property"
        )
        .forEach(item => {

            item.addEventListener(
                "click",
                event => {

                    if (
                        event.target
                            .closest(
                                ".remove-saved"
                            )
                    ) {
                        return;
                    }

                    const index =
                        Number(
                            item.dataset.index
                        );

                    const property =
                        savedProperties[index];

                    if (!property) {
                        return;
                    }

                    closeAppPage();

                    searchParcels(
                        property.PARCEL_ID
                    );
                }
            );
        });

    document
        .querySelectorAll(
            ".remove-saved"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const index =
                        Number(
                            button.dataset.remove
                        );

                    savedProperties.splice(
                        index,
                        1
                    );

                    localStorage.setItem(
                        "parcelscope_saved",
                        JSON.stringify(
                            savedProperties
                        )
                    );

                    showSaved();
                }
            );
        });
}


/* =========================================================
   DATA SOURCES
   ========================================================= */

function showSources() {

    openAppPage(
        "Data Sources",
        "DATA",
        `
            <div class="page-section">

                <h2>
                    Idaho Statewide Parcel Framework
                </h2>

                <div class="page-card">

                    <strong>
                        Idaho Public Parcel Data
                    </strong>

                    <div>
                        ParcelScope uses the statewide
                        standardized Idaho parcel layer
                        for parcel lookup and mapping.
                    </div>

                </div>

                <div class="page-card">

                    <strong>
                        County Data
                    </strong>

                    <div>
                        The statewide layer is assembled
                        from participating Idaho counties.
                        County assessor offices remain the
                        authoritative source for questions
                        about individual records.
                    </div>

                </div>

                <div class="page-card">

                    <strong>
                        Map
                    </strong>

                    <div>
                        OpenStreetMap is used as the
                        background map.
                    </div>

                </div>

            </div>
        `
    );
}


/* =========================================================
   UPDATE HISTORY
   ========================================================= */

function showHistory() {

    openAppPage(
        "Update History",
        "DATA",
        `
            <div class="page-section">

                <div class="page-card">

                    <strong>
                        ParcelScope Version
                    </strong>

                    <div>
                        ${VERSION}
                    </div>

                </div>

                <div class="page-card">

                    <strong>
                        Parcel Data
                    </strong>

                    <div>
                        Parcel records are supplied through
                        the statewide Idaho parcel framework
                        and may change as county data is updated.
                    </div>

                </div>

            </div>
        `
    );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function showSettings() {

    openAppPage(
        "Settings",
        "SYSTEM",
        `
            <div class="setting-group">

                <h2>
                    Map
                </h2>

                <div class="setting-row">

                    <div>

                        <div class="setting-name">
                            Keep map position
                        </div>

                        <div class="setting-description">
                            Prevent ParcelScope from changing
                            the map view while you browse.
                        </div>

                    </div>

                    <button
                        class="toggle"
                        id="lockMapToggle"
                    ></button>

                </div>

            </div>
        `
    );

    const toggle =
        document.getElementById(
            "lockMapToggle"
        );

    const locked =
        localStorage.getItem(
            "parcelscope_lock_map"
        ) === "true";

    if (locked) {
        toggle.classList.add("on");
    }

    toggle.addEventListener(
        "click",
        () => {

            const next =
                !toggle.classList.contains(
                    "on"
                );

            toggle.classList.toggle(
                "on",
                next
            );

            localStorage.setItem(
                "parcelscope_lock_map",
                String(next)
            );
        }
    );
}


/* =========================================================
   ABOUT
   ========================================================= */

function showAbout() {

    openAppPage(
        "About ParcelScope",
        "PARCELSCOPE",
        `
            <div class="page-section">

                <div class="page-card">

                    <strong>
                        ParcelScope Idaho
                    </strong>

                    <div>
                        Version ${VERSION}
                    </div>

                </div>

                <div class="page-card">

                    <strong>
                        What it does
                    </strong>

                    <div>
                        ParcelScope is a public-data research
                        interface for exploring Idaho parcel
                        information.
                    </div>

                </div>

                <div class="page-card">

                    <strong>
                        Important
                    </strong>

                    <div>
                        Parcel information can change and may
                        contain errors or omissions. Always
                        verify important property information
                        with the appropriate county assessor.
                    </div>

                </div>

            </div>
        `
    );
}


/* =========================================================
   MENU ROUTING
   ========================================================= */

function handleMenuSection(section) {

    closeMenu();

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


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

    document
        .getElementById("menuButton")
        .addEventListener(
            "click",
            openMenu
        );

    document
        .getElementById("closeMenu")
        .addEventListener(
            "click",
            closeMenu
        );

    document
        .getElementById("closeProperty")
        .addEventListener(
            "click",
            closePropertyPanel
        );

    document
        .getElementById("closeResults")
        .addEventListener(
            "click",
            closeResults
        );

    document
        .getElementById("closeAppPage")
        .addEventListener(
            "click",
            closeAppPage
        );

    document
        .getElementById("searchButton")
        .addEventListener(
            "click",
            () => {

                searchParcels(
                    document
                        .getElementById(
                            "searchInput"
                        )
                        .value
                );
            }
        );

    document
        .getElementById("searchInput")
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    searchParcels(
                        event.target.value
                    );
                }
            }
        );

    document
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(item => {

            item.addEventListener(
                "click",
                () => {

                    handleMenuSection(
                        item.dataset.section
                    );
                }
            );
        });
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        startMap();

        setupEvents();

        setStatus(
            `ParcelScope ${VERSION} ready`
        );
    }
);
