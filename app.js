/*
==========================================================
PARCELSCOPE
STATIC CLOUDFLARE VERSION
==========================================================

13 accounts.
4678 = Admin.

No backend.
Account-specific data is stored in browser storage.
Closing the site logs the user out.
==========================================================
*/


/* ======================================================
   ACCOUNTS
====================================================== */

const ACCOUNTS = {

  "4678": {
    id: "u01",
    name: "User",
    admin: true
  },

  "7453": {
    id: "u02",
    name: "User",
    admin: false
  },

  "2110": {
    id: "u03",
    name: "User",
    admin: false
  },

  "8657": {
    id: "u04",
    name: "User",
    admin: false
  },

  "8061": {
    id: "u05",
    name: "User",
    admin: false
  },

  "2104": {
    id: "u06",
    name: "User",
    admin: false
  },

  "4487": {
    id: "u07",
    name: "User",
    admin: false
  },

  "5609": {
    id: "u08",
    name: "User",
    admin: false
  },

  "0553": {
    id: "u09",
    name: "User",
    admin: false
  },

  "3282": {
    id: "u10",
    name: "User",
    admin: false
  },

  "1318": {
    id: "u11",
    name: "User",
    admin: false
  },

  "7467": {
    id: "u12",
    name: "User",
    admin: false
  },

  "4979": {
    id: "u13",
    name: "User",
    admin: false
  }

};


/* ======================================================
   GIS
====================================================== */

const SOURCES = {

  WA: {
    name: "Washington",

    url:
      "https://services.arcgis.com/jsIt88o09Q0r1j8h/ArcGIS/rest/services/Current_Parcels/FeatureServer/0",

    fields: {
      id: "PARCEL_ID_NR",
      address: "SITUS_ADDRESS",
      city: "SITUS_CITY_NM",
      zip: "SITUS_ZIP_NR",
      county: "COUNTY_NM",
      owner: null,
      acres: null,
      land: "VALUE_LAND",
      bldg: "VALUE_BLDG",
      total: null
    }
  },

  ID: {
    name: "Idaho",

    url:
      "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7",

    fields: {
      id: "PARCEL_ID",
      address: "SITE_ADD",
      city: "SITE_CITY",
      zip: "SITE_ZIP",
      county: "County",
      owner: "OWNER1",
      acres: "ASR_ACRES",
      land: "VAL_LAND",
      bldg: "VAL_IMPVTS",
      total: "VAL_TOTAL"
    }
  },

  MT: {
    name: "Montana",

    url:
      "https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/FeatureServer/0",

    fields: {
      id: "PARCELID",
      address: "AddressLine1",
      city: "CityStateZip",
      zip: null,
      county: "COUNTYCD",
      owner: "OwnerName",
      acres: "TotalAcres",
      land: "TotalLandValue",
      bldg: "TotalBuildingValue",
      total: "TotalValue"
    }
  },

  OR: {
    name: "Oregon",

    url:
      "https://gis.wrd.state.or.us/server/rest/services/tax/Tax_Lots_Public_View_WGS84/FeatureServer/2",

    fields: {
      id: "maptaxlot",
      address: "site_address",
      city: "site_citystatezip",
      zip: null,
      county: "county_name",
      owner: "owner_address",
      acres: "taxlot_acre",
      land: null,
      bldg: null,
      total: null
    }
  }

};


/* ======================================================
   STORAGE
====================================================== */

const storage = {

  get(key, fallback) {

    try {

      const value =
        localStorage.getItem(key);

      if (value === null)
        return fallback;

      return JSON.parse(value);

    } catch {

      return fallback;

    }

  },

  set(key, value) {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

  }

};


let current = null;

let selectedParcel = null;

let locationWatch = null;

let measureMode = false;

let measurePoints = [];

let measureLine = null;


/* ======================================================
   HELPERS
====================================================== */

function $(id) {
  return document.getElementById(id);
}


function escapeHTML(value) {

  return String(
    value ?? "Currently unavailable"
  )

  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

}


function stateName(state) {

  return SOURCES[state]?.name || state;

}


function accountKey(name) {

  return `parcelScope.${current.id}.${name}`;

}


function getAccountData(name, fallback) {

  return storage.get(
    accountKey(name),
    fallback
  );

}


function setAccountData(name, value) {

  storage.set(
    accountKey(name),
    value
  );

}


function toast(message) {

  $("toast").textContent =
    message;

  $("toast")
    .classList
    .remove("hidden");

  clearTimeout(
    window.toastTimer
  );

  window.toastTimer =
    setTimeout(() => {

      $("toast")
        .classList
        .add("hidden");

    }, 2800);

}


function displayName() {

  const names =
    storage.get(
      "parcelScope.names",
      {}
    );

  return (
    names[current.id] ||
    current.name ||
    "User"
  );

}


/* ======================================================
   LOGIN
====================================================== */

function login() {

  const code =
    $("loginCode")
      .value
      .replace(/\D/g, "")
      .slice(0, 4);

  $("loginCode").value =
    code;

  const account =
    ACCOUNTS[code];

  if (!account) {

    $("loginError")
      .textContent =
      "Invalid 4-digit code.";

    return;

  }

  current = {
    ...account,
    code
  };

  /*
    Session storage means closing the
    browser/tab ends the session.
  */

  sessionStorage.setItem(
    "parcelScope.session",
    JSON.stringify(current)
  );


  /* Login activity */

  const logs =
    storage.get(
      "parcelScope.loginLogs",
      []
    );

  logs.unshift({

    id: account.id,

    name: account.name,

    admin: account.admin,

    time:
      new Date().toISOString()

  });

  storage.set(
    "parcelScope.loginLogs",
    logs.slice(0, 500)
  );


  $("loginError")
    .textContent = "";

  showApp();

}


$("loginBtn").onclick =
  login;


$("loginCode")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {

        login();

      }

    }
  );


$("loginCode")
  .addEventListener(
    "input",
    () => {

      if (
        $("loginCode")
          .value
          .length === 4
      ) {

        login();

      }

    }
  );


try {

  const savedSession =
    sessionStorage.getItem(
      "parcelScope.session"
    );

  if (savedSession) {

    current =
      JSON.parse(
        savedSession
      );

  }

} catch {}


/* ======================================================
   MAP
====================================================== */

const map =
  L.map("map", {

    zoomControl: false,

    doubleClickZoom: false,

    rotate: false,

    touchZoom: true,

    scrollWheelZoom: true,

    dragging: true,

    keyboard: true

  })

  .setView(
    [46.1, -116.7],
    5.55
  );


const satellite =
  L.tileLayer(

    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

    {

      maxZoom: 19,

      attribution:
        "Tiles © Esri"

    }

  );


const street =
  L.tileLayer(

    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

    {

      maxZoom: 19,

      attribution:
        "© OpenStreetMap contributors"

    }

  );


satellite.addTo(map);


const parcelLayer =
  L.geoJSON(

    null,

    {

      style: {

        color: "#55d6ff",

        weight: 1,

        fillOpacity: .02

      },

      onEachFeature:
        (feature, layer) => {

          layer.on(
            "click",
            () => {

              selectParcel(

                normalizeFeature(
                  feature.properties,
                  feature.geometry
                ),

                false

              );

            }
          );

        }

    }

  ).addTo(map);


const selectedLayer =
  L.geoJSON(

    null,

    {

      style: {

        color: "#ff4350",

        weight: 3,

        fillOpacity: .12

      }

    }

  ).addTo(map);


/* ======================================================
   GIS FUNCTIONS
====================================================== */

function queryURL(
  source,
  params
) {

  const url =
    new URL(
      source.url + "/query"
    );

  Object.entries({

    ...params,

    f: "geojson",

    outSR: "4326"

  })

  .forEach(
    ([key, value]) => {

      url.searchParams.set(
        key,
        value
      );

    }
  );

  return url.toString();

}


async function arcgis(
  source,
  params
) {

  const response =
    await fetch(
      queryURL(
        source,
        params
      )
    );

  if (!response.ok)
    throw new Error(
      "GIS request failed"
    );

  const json =
    await response.json();

  if (json.error)
    throw new Error(
      json.error.message ||
      "GIS error"
    );

  return json;

}


function whereForSource(
  state,
  search
) {

  const fields =
    SOURCES[state].fields;

  const safe =
    search
      .replaceAll("'", "''");

  const searchable = [

    fields.id,

    fields.address,

    fields.city,

    fields.county,

    fields.owner

  ].filter(Boolean);

  if (!searchable.length)
    return "1=0";

  return searchable
    .map(
      field =>
        `${field} LIKE '%${safe}%'`
    )
    .join(" OR ");

}


function normalizeFeature(
  properties,
  geometry
) {

  const state =
    properties.__state ||
    $("stateSelect").value;

  const fields =
    SOURCES[state]?.fields || {};

  return {

    state,

    parcelId:
      properties[fields.id],

    address:
      properties[fields.address],

    city:
      properties[fields.city],

    zip:
      properties[fields.zip],

    county:
      properties[fields.county],

    owner:
      properties[fields.owner],

    acres:
      properties[fields.acres],

    land:
      properties[fields.land],

    bldg:
      properties[fields.bldg],

    total:
      properties[fields.total],

    geometry,

    raw:
      properties

  };

}


/* ======================================================
   LOAD PARCELS
====================================================== */

async function loadVisibleParcels() {

  if (
    map.getZoom() < 10
  )
    return;


  const bounds =
    map.getBounds();

  const selectedState =
    $("stateSelect").value;

  const states =
    selectedState === "ALL"
      ? Object.keys(SOURCES)
      : [selectedState];


  const geometry =
    JSON.stringify({

      xmin:
        bounds.getWest(),

      ymin:
        bounds.getSouth(),

      xmax:
        bounds.getEast(),

      ymax:
        bounds.getNorth(),

      spatialReference: {
        wkid: 4326
      }

    });


  parcelLayer.clearLayers();


  for (
    const state of states
  ) {

    try {

      const result =
        await arcgis(
          SOURCES[state],
          {

            where: "1=1",

            geometry,

            geometryType:
              "esriGeometryEnvelope",

            inSR: "4326",

            spatialRel:
              "esriSpatialRelIntersects",

            outFields: "*",

            returnGeometry:
              "true",

            resultRecordCount:
              350

          }
        );


      const features =
        result.features || [];


      features.forEach(
        feature => {

          feature.properties.__state =
            state;

        }
      );


      if (features.length) {

        parcelLayer
          .addData(features);

      }

    } catch (error) {

      console.warn(
        state,
        error
      );

    }

  }

}


/* ======================================================
   SEARCH
====================================================== */

async function search() {

  const query =
    $("searchInput")
      .value
      .trim();

  if (!query) {

    toast(
      "Enter an address, owner, or parcel ID."
    );

    return;

  }


  $("results")
    .classList
    .remove("hidden");


  $("resultsBody")
    .innerHTML =
    "<p class='muted'>Searching GIS sources…</p>";


  const selectedState =
    $("stateSelect").value;


  const states =
    selectedState === "ALL"
      ? Object.keys(SOURCES)
      : [selectedState];


  const results = [];


  for (
    const state of states
  ) {

    try {

      const response =
        await arcgis(

          SOURCES[state],

          {

            where:
              whereForSource(
                state,
                query
              ),

            outFields:
              "*",

            returnGeometry:
              "true",

            resultRecordCount:
              25

          }

        );


      (
        response.features ||
        []
      ).forEach(
        feature => {

          feature.properties.__state =
            state;

          results.push(
            feature
          );

        }
      );

    } catch (error) {

      console.warn(
        state,
        error
      );

    }

  }


  if (!results.length) {

    $("resultsBody")
      .innerHTML =
      "<p>No matching public parcel records were returned.</p>";

    return;

  }


  $("resultsBody")
    .innerHTML =

    results
      .map(
        (feature, index) => {

          const property =
            normalizeFeature(
              feature.properties,
              feature.geometry
            );

          return `

            <button
              class="result"
              data-result="${index}"
            >

              <strong>
                ${escapeHTML(
                  property.address ||
                  property.parcelId ||
                  "Parcel"
                )}
              </strong>

              <small>

                ${escapeHTML(
                  property.county || ""
                )}

                ${property.city
                  ? " · " +
                    escapeHTML(
                      property.city
                    )
                  : ""}

                ·

                ${escapeHTML(
                  stateName(
                    property.state
                  )
                )}

              </small>

            </button>

          `;

        }
      )
      .join("");


  results.forEach(
    (feature, index) => {

      const button =
        document.querySelector(
          `[data-result="${index}"]`
        );

      button.onclick =
        () => {

          const property =
            normalizeFeature(
              feature.properties,
              feature.geometry
            );

          selectParcel(
            property,
            true
          );

          $("results")
            .classList
            .add("hidden");

        };

    }
  );

}


$("searchBtn").onclick =
  search;


$("searchInput")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      )
        search();

    }
  );


/* ======================================================
   PROPERTY
====================================================== */

function propertyId(
  property
) {

  return (

    property.state +
    ":" +
    (
      property.parcelId ||
      property.address ||
      JSON.stringify(
        property.geometry
      )
    )

  );

}


function selectParcel(
  property,
  fit
) {

  selectedParcel =
    property;


  selectedLayer
    .clearLayers();


  if (
    property.geometry
  ) {

    const layer =
      L.geoJSON({

        type: "Feature",

        geometry:
          property.geometry

      });


    layer.setStyle({

      color: "#ff4350",

      weight: 3,

      fillOpacity: .12

    });


    selectedLayer
      .addLayer(layer);


    if (fit) {

      try {

        map.fitBounds(
          layer
            .getBounds()
            .pad(.25)
        );

      } catch {}

    }

  }


  addRecent(
    property
  );


  renderProperty();

}


function renderProperty() {

  const property =
    selectedParcel;


  $("property")
    .classList
    .remove("hidden");


  $("propertyTitle")
    .textContent =

    property.address ||
    property.parcelId ||
    "Property";


  const rows = [

    [
      "Address",

      property.address
        ? `${property.address}${
            property.city
              ? ", " + property.city
              : ""
          }${
            property.zip
              ? " " + property.zip
              : ""
          }`

        : null
    ],

    [
      "Owner",
      property.owner
    ],

    [
      "Parcel ID",
      property.parcelId
    ],

    [
      "State",
      stateName(
        property.state
      )
    ],

    [
      "County",
      property.county
    ],

    [
      "Acres",

      property.acres != null

        ? Number(
            property.acres
          ).toLocaleString() +
          " acres"

        : null
    ],

    [
      "Land Value",
      formatMoney(
        property.land
      )
    ],

    [
      "Building Value",
      formatMoney(
        property.bldg
      )
    ],

    [
      "Total Value",
      formatMoney(
        property.total
      )
    ]

  ];


  $("propertyBody")
    .innerHTML =

    rows
      .map(
        ([label, value]) => `

          <div class="field">

            <b>
              ${label}
            </b>

            <span>
              ${escapeHTML(
                value
              )}
            </span>

          </div>

        `
      )
      .join("");


  $("saveBtn")
    .textContent =
    isSaved(property)

      ? "Remove Saved Property"

      : "Save Property";

}


function formatMoney(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  )
    return "Currently unavailable";


  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }
  );

}


/* ======================================================
   SAVED
====================================================== */

function getSaved() {

  return getAccountData(
    "saved",
    []
  );

}


function setSaved(
  properties
) {

  setAccountData(
    "saved",
    properties
  );

}


function isSaved(
  property
) {

  const id =
    propertyId(
      property
    );

  return getSaved()
    .some(
      property =>
        property._key === id
    );

}


$("saveBtn").onclick =
  () => {

    const property =
      selectedParcel;

    let saved =
      getSaved();

    const id =
      propertyId(
        property
      );


    if (
      saved.some(
        item =>
          item._key === id
      )
    ) {

      saved =
        saved.filter(
          item =>
            item._key !== id
        );

      toast(
        "Property removed."
      );

    } else {

      saved.unshift({

        ...property,

        _key: id

      });

      toast(
        "Property saved."
      );

    }


    setSaved(
      saved.slice(
        0,
        200
      )
    );


    renderProperty();

  };


/* ======================================================
   RECENT
====================================================== */

function getRecent() {

  return getAccountData(
    "recent",
    []
  );

}


function addRecent(
  property
) {

  const id =
    propertyId(
      property
    );


  let recent =
    getRecent()
      .filter(
        item =>
          item._key !== id
      );


  recent.unshift({

    ...property,

    _key: id

  });


  setAccountData(
    "recent",
    recent.slice(
      0,
      25
    )
  );

}


/* ======================================================
   MENU
====================================================== */

$("menuBtn").onclick =
  () => {

    $("menu")
      .classList
      .remove("hidden");

    updateNotificationDot();

  };


$("closeMenu").onclick =
  () => {

    $("menu")
      .classList
      .add("hidden");

  };


$("drawerClose").onclick =
  () => {

    $("drawer")
      .classList
      .add("hidden");

  };


$("resultsClose").onclick =
  () => {

    $("results")
      .classList
      .add("hidden");

  };


$("propertyClose").onclick =
  () => {

    $("property")
      .classList
      .add("hidden");

    selectedLayer
      .clearLayers();

    selectedParcel =
      null;

  };


document
  .querySelectorAll(
    "[data-page]"
  )
  .forEach(
    button => {

      button.onclick =
        () =>
          openPage(
            button.dataset.page
          );

    }
  );


function openPage(
  page
) {

  const titles = {

    saved:
      "Saved Properties",

    recent:
      "Recent Properties",

    notifications:
      "Notifications",

    layers:
      "Map Layers",

    measure:
      "Measure Distance",

    settings:
      "Settings",

    about:
      "About ParcelScope"

  };


  if (
    page === "measure"
  ) {

    startMeasure();

    $("menu")
      .classList
      .add("hidden");

    return;

  }


  $("drawerTitle")
    .textContent =
    titles[page];


  $("drawer")
    .classList
    .remove("hidden");


  if (
    page === "saved"
  )
    renderSaved();


  if (
    page === "recent"
  )
    renderRecent();


  if (
    page === "notifications"
  )
    renderNotifications();


  if (
    page === "layers"
  )
    renderLayers();


  if (
    page === "settings"
  )
    renderSettings();


  if (
    page === "about"
  )
    renderAbout();

}


/* ======================================================
   SAVED / RECENT DISPLAY
====================================================== */

function renderPropertyList(
  properties
) {

  if (!properties.length) {

    $("drawerBody")
      .innerHTML =
      "<p class='muted'>No properties yet.</p>";

    return;

  }


  $("drawerBody")
    .innerHTML =

    properties
      .map(
        (property, index) => `

          <button
            class="result"
            data-property="${index}"
          >

            <strong>

              ${escapeHTML(
                property.address ||
                property.parcelId ||
                "Property"
              )}

            </strong>

            <small>

              ${escapeHTML(
                property.county || ""
              )}

              ·

              ${escapeHTML(
                stateName(
                  property.state
                )
              )}

            </small>

          </button>

        `
      )
      .join("");


  properties.forEach(
    (property, index) => {

      document.querySelector(
        `[data-property="${index}"]`
      ).onclick = () => {

        selectParcel(
          property,
          true
        );

        $("drawer")
          .classList
          .add("hidden");

      };

    }
  );

}


function renderSaved() {

  renderPropertyList(
    getSaved()
  );

}


function renderRecent() {

  renderPropertyList(
    getRecent()
  );

}


/* ======================================================
   NOTIFICATIONS
====================================================== */

function getNotifications() {

  return getAccountData(
    "notifications",
    []
  );

}


function setNotifications(
  notifications
) {

  setAccountData(
    "notifications",
    notifications
  );

}


function updateNotificationDot() {

  const unread =
    getNotifications()
      .some(
        notification =>
          !notification.read
      );


  $("menuRedDot")
    .classList
    .toggle(
      "hidden",
      !unread
    );

}


function renderNotifications() {

  let notifications =
    getNotifications();


  notifications =
    notifications.map(
      notification => ({

        ...notification,

        read: true

      })
    );


  setNotifications(
    notifications
  );


  updateNotificationDot();


  if (!notifications.length) {

    $("drawerBody")
      .innerHTML =
      `

        <div class="menu-page">

          <p>
            No notifications.
          </p>

        </div>

      `;

    return;

  }


  $("drawerBody")
    .innerHTML =

    `

      <button
        id="deleteAllNotifications"
        class="danger-btn"
      >
        Delete All
      </button>

    ` +

    notifications
      .map(
        (notification, index) => `

          <div class="notice">

            <div class="notice-head">

              <strong>
                ${escapeHTML(
                  notification.title
                )}
              </strong>

              <button
                data-delete-notification="${index}"
              >
                ×
              </button>

            </div>

            <div>
              ${escapeHTML(
                notification.body
              )}
            </div>

            <small class="muted">

              ${new Date(
                notification.time
              ).toLocaleString()}

            </small>

          </div>

        `
      )
      .join("");


  $("deleteAllNotifications")
    .onclick = () => {

      setNotifications([]);

      renderNotifications();

      updateNotificationDot();

    };


  notifications.forEach(
    (notification, index) => {

      document.querySelector(
        `[data-delete-notification="${index}"]`
      ).onclick = () => {

        const list =
          getNotifications();

        list.splice(
          index,
          1
        );

        setNotifications(
          list
        );

        renderNotifications();

        updateNotificationDot();

      };

    }
  );

}


/* ======================================================
   LAYERS
====================================================== */

function renderLayers() {

  $("drawerBody")
    .innerHTML = `

      <div class="menu-page">

        <div class="row">

          <span>
            Satellite
          </span>

          <input
            id="satRadio"
            type="radio"
            name="base"
            checked
          >

        </div>

        <div class="row">

          <span>
            Street Map
          </span>

          <input
            id="streetRadio"
            type="radio"
            name="base"
          >

        </div>

        <div class="row">

          <span>
            Parcel Boundaries
          </span>

          <input
            id="parcelToggle"
            type="checkbox"
            checked
          >

        </div>

      </div>

    `;


  $("satRadio").onchange =
    () => {

      map.removeLayer(
        street
      );

      satellite.addTo(
        map
      );

    };


  $("streetRadio").onchange =
    () => {

      map.removeLayer(
        satellite
      );

      street.addTo(
        map
      );

    };


  $("parcelToggle")
    .onchange =
    event => {

      if (
        event.target.checked
      ) {

        loadVisibleParcels();

      } else {

        parcelLayer
          .clearLayers();

      }

    };

}


/* ======================================================
   SETTINGS
====================================================== */

function renderSettings() {

  $("drawerBody")
    .innerHTML = `

      <div class="menu-page">

        <h3>
          Profile
        </h3>

        <div class="admin-grid">

          <label>

            Display name

            <input
              id="nameInput"
              maxlength="40"
              value="${escapeHTML(
                displayName()
              )}"
            >

          </label>

          <button
            id="saveName"
          >
            Save Name
          </button>

        </div>

        <h3>
          Session
        </h3>

        <button
          id="settingsLogout"
          class="danger-btn"
        >
          Log Out
        </button>

      </div>

    `;


  $("saveName")
    .onclick = () => {

      const name =
        $("nameInput")
          .value
          .trim() ||
        "User";


      const names =
        storage.get(
          "parcelScope.names",
          {}
        );


      names[current.id] =
        name;


      storage.set(
        "parcelScope.names",
        names
      );


      $("menuUserName")
        .textContent =
        name;


      toast(
        "Name saved."
      );

    };


  $("settingsLogout")
    .onclick =
    logout;

}


/* ======================================================
   ABOUT
====================================================== */

function renderAbout() {

  $("drawerBody")
    .innerHTML = `

      <div class="menu-page">

        <h3>
          ParcelScope
        </h3>

        <p>
          Private parcel research
          interface for Washington,
          Oregon, Idaho and Montana.
        </p>

        <p class="muted">

          Parcel data comes from
          public GIS services and
          should be verified with
          the appropriate county or
          state agency before being
          relied upon.

        </p>

      </div>

    `;

}


/* ======================================================
   ADMIN
====================================================== */

function renderAdmin() {

  if (!current.admin)
    return;


  $("drawerTitle")
    .textContent =
    "Admin";


  $("drawer")
    .classList
    .remove("hidden");


  const logs =
    storage.get(
      "parcelScope.loginLogs",
      []
    );


  const names =
    storage.get(
      "parcelScope.names",
      {}
    );


  $("drawerBody")
    .innerHTML = `

      <div class="menu-page">

        <h3>
          Send Notification
        </h3>

        <div class="admin-grid">

          <input
            id="noticeTitle"
            placeholder="Title"
          >

          <textarea
            id="noticeBody"
            placeholder="Message"
          ></textarea>

          <select
            id="noticeTarget"
          >

            <option value="ALL">
              All Users
            </option>

            ${
              Object.entries(
                ACCOUNTS
              )

              .filter(
                ([code, account]) =>
                  !account.admin
              )

              .map(
                ([code, account]) => `

                  <option
                    value="${account.id}"
                  >

                    ${escapeHTML(
                      names[
                        account.id
                      ] ||
                      "User"
                    )}

                    (${account.id})

                  </option>

                `
              )

              .join("")
            }

          </select>

          <button
            id="sendNotice"
            class="primary"
          >
            Send Notification
          </button>

        </div>


        <h3>
          Login Activity
        </h3>

        ${
          logs.length

          ? `

            <table
              class="admin-table"
            >

              <thead>

                <tr>

                  <th>
                    Account
                  </th>

                  <th>
                    Time
                  </th>

                </tr>

              </thead>

              <tbody>

                ${
                  logs
                    .map(
                      log => `

                        <tr>

                          <td>

                            ${escapeHTML(
                              names[
                                log.id
                              ] ||
                              "User"
                            )}

                            ${
                              log.admin
                                ? " · Admin"
                                : ""
                            }

                          </td>

                          <td>

                            ${new Date(
                              log.time
                            ).toLocaleString()}

                          </td>

                        </tr>

                      `
                    )
                    .join("")
                }

              </tbody>

            </table>

          `

          : "<p>No login activity.</p>"
        }


        <h3>
          Account Codes
        </h3>

        <table
          class="admin-table"
        >

          <tbody>

            ${
              Object.entries(
                ACCOUNTS
              )
              .map(
                ([code, account]) => `

                  <tr>

                    <td>

                      ${
                        account.admin
                          ? "Admin"
                          : escapeHTML(
                              names[
                                account.id
                              ] ||
                              "User"
                            )
                      }

                    </td>

                    <td>
                      ${code}
                    </td>

                  </tr>

                `
              )
              .join("")
            }

          </tbody>

        </table>

      </div>

    `;


  $("sendNotice")
    .onclick = () => {

      const title =
        $("noticeTitle")
          .value
          .trim() ||
        "ParcelScope";


      const body =
        $("noticeBody")
          .value
          .trim();


      if (!body) {

        toast(
          "Enter a message."
        );

        return;

      }


      const target =
        $("noticeTarget")
          .value;


      const userIds =
        target === "ALL"

          ? Object.values(
              ACCOUNTS
            )

            .filter(
              account =>
                !account.admin
            )

            .map(
              account =>
                account.id
            )

          : [target];


      userIds.forEach(
        userId => {

          const key =
            `parcelScope.${userId}.notifications`;


          const notifications =
            storage.get(
              key,
              []
            );


          notifications.unshift({

            id:
              String(
                Date.now() +
                Math.random()
              ),

            title,

            body,

            time:
              new Date()
                .toISOString(),

            read: false

          });


          storage.set(
            key,

            notifications.slice(
              0,
              200
            )

          );

        }
      );


      $("noticeBody")
        .value = "";


      toast(
        target === "ALL"

          ? "Notification sent to all users."

          : "Notification sent."

      );

    };

}


$("adminMenu")
  .onclick =
  renderAdmin;


/* ======================================================
   LOGOUT
====================================================== */

function logout() {

  sessionStorage.removeItem(
    "parcelScope.session"
  );

  location.reload();

}


$("logoutBtn")
  .onclick =
  logout;


/* ======================================================
   LOCATION
====================================================== */

$("locateBtn")
  .onclick = () => {

    if (
      !navigator.geolocation
    ) {

      toast(
        "Location is not supported."
      );

      return;

    }


    if (locationWatch) {

      navigator.geolocation
        .clearWatch(
          locationWatch
        );

      locationWatch =
        null;

      $("locateBtn")
        .textContent =
        "Locate";

      return;

    }


    $("locateBtn")
      .textContent =
      "Following";


    locationWatch =
      navigator.geolocation
        .watchPosition(

          position => {

            const lat =
              position.coords
                .latitude;

            const lng =
              position.coords
                .longitude;


            map.setView(
              [
                lat,
                lng
              ],

              Math.max(
                map.getZoom(),
                15
              )
            );

          },

          () => {

            toast(
              "Location permission was denied or unavailable."
            );

          },

          {

            enableHighAccuracy:
              true

          }

        );

  };


/* ======================================================
   MEASUREMENT
====================================================== */

function startMeasure() {

  measureMode =
    true;

  measurePoints =
    [];


  $("measure")
    .classList
    .remove("hidden");


  $("measureValue")
    .textContent =
    "0 ft";


  toast(
    "Tap the map to add measurement points."
  );

}


function addMeasurePoint(
  point
) {

  measurePoints.push(
    point
  );


  if (
    measurePoints.length >
    1
  ) {

    if (measureLine)
      map.removeLayer(
        measureLine
      );


    measureLine =
      L.polyline(
        measurePoints,
        {
          color:
            "#55d6ff",

          weight: 3
        }
      )
      .addTo(map);

  }


  let total = 0;


  for (
    let i = 1;

    i <
    measurePoints.length;

    i++
  ) {

    total +=
      map.distance(
        measurePoints[
          i - 1
        ],

        measurePoints[i]
      );

  }


  $("measureValue")
    .textContent =

    total < 5280

      ? `${Math.round(total)} ft`

      : `${(
          total / 5280
        ).toFixed(2)} mi`;

}


function finishMeasure() {

  measureMode =
    false;

  $("measure")
    .classList
    .add("hidden");

}


function clearMeasure() {

  measurePoints =
    [];


  if (measureLine) {

    map.removeLayer(
      measureLine
    );

    measureLine =
      null;

  }


  $("measureValue")
    .textContent =
    "0 ft";

}


$("finishMeasure")
  .onclick =
  finishMeasure;


$("clearMeasure")
  .onclick =
  clearMeasure;


map.on(
  "click",
  event => {

    if (
      measureMode
    ) {

      addMeasurePoint(
        event.latlng
      );

    }

  }
);


map.on(
  "moveend",
  () => {

    if (
      map.getZoom() >= 10
    ) {

      loadVisibleParcels();

    }

  }
);


map.on(
  "mousemove",
  event => {

    $("coords")
      .textContent =
      `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;

    $("coords")
      .classList
      .remove("hidden");

  }
);


map.on(
  "mouseout",
  () => {

    $("coords")
      .classList
      .add("hidden");

  }
);


/* ======================================================
   START APP
====================================================== */

function showApp() {

  $("loginScreen")
    .classList
    .add("hidden");


  $("menuUserName")
    .textContent =
    displayName();


  $("menuUserCode")
    .textContent =

    current.admin

      ? "Administrator"

      : "Account";


  $("adminMenu")
    .classList
    .toggle(
      "hidden",
      !current.admin
    );


  updateNotificationDot();


  setTimeout(
    () => {

      loadVisibleParcels();

    },

    500
  );

}


if (current) {

  showApp();

}
