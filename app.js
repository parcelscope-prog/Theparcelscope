/* =========================================================
   PARCELSCOPE
   Static Cloudflare version
   ========================================================= */


/* =========================================================
   13 FIXED ACCOUNTS

   Account 0 = Admin
   Accounts 1-12 = Users

   Passwords are intentionally hard-coded because this
   version does not use a backend.
========================================================= */

const ACCOUNTS = [
  { id: "admin", password: "7314", admin: true },

  { id: "user1",  password: "4826", admin: false },
  { id: "user2",  password: "9153", admin: false },
  { id: "user3",  password: "2047", admin: false },
  { id: "user4",  password: "6381", admin: false },
  { id: "user5",  password: "7504", admin: false },
  { id: "user6",  password: "3169", admin: false },
  { id: "user7",  password: "8472", admin: false },
  { id: "user8",  password: "5618", admin: false },
  { id: "user9",  password: "2935", admin: false },
  { id: "user10", password: "6740", admin: false },
  { id: "user11", password: "1085", admin: false },
  { id: "user12", password: "4263", admin: false }
];


/* =========================================================
   GIS SOURCES

   Washington:
   Current statewide parcels.

   Idaho:
   Public statewide parcel layer.

   Montana:
   Montana cadastral parcel service.

   Oregon:
   Oregon Department of Forestry service containing
   county taxlot layers 0-34.
========================================================= */

const GIS = {

  WA: {
    name: "Washington",
    url:
      "https://services.arcgis.com/jsIt88o09Q0r1j8h/ArcGIS/rest/services/Current_Parcels/FeatureServer/0",
    type: "feature",
    fields: {
      id: "PARCEL_ID_NR",
      address: "SITUS_ADDRESS",
      city: "SITUS_CITY_NM",
      county: "COUNTY_NM",
      owner: null,
      acres: null,
      value: "VALUE_LAND"
    }
  },

  ID: {
    name: "Idaho",
    url:
      "https://services1.arcgis.com/CNPdEkvnGl65jCX8/ArcGIS/rest/services/Public_Idaho_Parcels_/FeatureServer/7",
    type: "feature",
    fields: {
      id: "PARCEL_ID",
      address: "SITE_ADD",
      city: "SITE_CITY",
      county: "County",
      owner: "OWNER1",
      acres: "ASR_ACRES",
      value: "VAL_TOTAL"
    }
  },

  MT: {
    name: "Montana",
    url:
      "https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/FeatureServer/0",
    type: "feature",
    fields: {
      id: "PARCELID",
      address: "AddressLine1",
      city: "CityStateZip",
      county: "COUNTYCD",
      owner: "OwnerName",
      acres: "GISAcres",
      value: "TotalValue"
    }
  },

  OR: {
    name: "Oregon",
    url:
      "https://gis.odf.oregon.gov/ags1/rest/services/WebMercator/TaxlotsDisplay/MapServer",
    type: "oregon"
  }

};


/* =========================================================
   OREGON COUNTY LAYERS
========================================================= */

const OREGON_COUNTIES = [
  "Baker",
  "Benton",
  "Clackamas",
  "Clatsop",
  "Columbia",
  "Coos",
  "Crook",
  "Curry",
  "Deschutes",
  "Douglas",
  "Gilliam",
  "Grant",
  "Harney",
  "Hood River",
  "Jackson",
  "Jefferson",
  "Josephine",
  "Klamath",
  "Lake",
  "Lane",
  "Lincoln",
  "Linn",
  "Malheur",
  "Marion",
  "Morrow",
  "Multnomah",
  "Polk",
  "Sherman",
  "Tillamook",
  "Umatilla",
  "Union",
  "Wallowa",
  "Wasco",
  "Washington",
  "Wheeler",
  "Yamhill"
];


/* =========================================================
   MAP
========================================================= */

const PARCEL_ZOOM = 10;

const NORTHWEST_CENTER = [
  46.1,
  -116.7
];

const map = L.map("map", {

  zoomControl: false,

  doubleClickZoom: false,

  touchZoom: true,

  scrollWheelZoom: true,

  dragging: true,

  keyboard: true

}).setView(
  NORTHWEST_CENTER,
  5.55
);


/* =========================================================
   BASE MAPS
========================================================= */

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles © Esri"
  }
);

const street = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }
);

satellite.addTo(map);


/* =========================================================
   DATA LAYERS
========================================================= */

const parcelLayer =
  L.layerGroup().addTo(map);

const selectedLayer =
  L.layerGroup().addTo(map);

const measureLayer =
  L.layerGroup().addTo(map);

const coordinateLayer =
  L.layerGroup().addTo(map);


/* =========================================================
   APPLICATION STATE
========================================================= */

let currentAccount = null;

let selectedParcel = null;

let followingLocation = false;

let locationWatch = null;

let measureMode = false;

let measurePoints = [];

let parcelsEnabled = true;

let countyLayerEnabled = false;

let stateLayerEnabled = false;

let labelsEnabled = true;

let notificationTimer = null;


/* =========================================================
   HELPERS
========================================================= */

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


function now() {

  return new Date().toLocaleString();

}


function toast(message) {

  $("toast").textContent = message;

  $("toast")
    .classList
    .remove("hidden");

  clearTimeout(notificationTimer);

  notificationTimer =
    setTimeout(() => {

      $("toast")
        .classList
        .add("hidden");

    }, 2600);
}


function accountKey(name) {

  return `parcelScope.${name}`;

}


/* =========================================================
   ACCOUNT NAME
========================================================= */

function getAccountName() {

  if (!currentAccount)
    return "User";

  return localStorage.getItem(
    accountKey(
      `${currentAccount.id}.name`
    )
  ) || "User";

}


function setAccountName(name) {

  if (!currentAccount)
    return;

  const clean =
    name.trim() || "User";

  localStorage.setItem(
    accountKey(
      `${currentAccount.id}.name`
    ),
    clean
  );

}


/* =========================================================
   LOGIN
========================================================= */

function findAccount(password) {

  return ACCOUNTS.find(
    account =>
      account.password === password
  );

}


function recordLogin(account, success) {

  const logs =
    JSON.parse(
      localStorage.getItem(
        "parcelScope.loginLogs"
      ) || "[]"
    );

  logs.unshift({

    account:
      account ? account.id : "unknown",

    success,

    time:
      new Date().toISOString()

  });

  localStorage.setItem(
    "parcelScope.loginLogs",
    JSON.stringify(
      logs.slice(0, 500)
    )
  );

}


function login() {

  const password =
    $("loginPassword").value.trim();

  const account =
    findAccount(password);

  if (!account) {

    recordLogin(
      null,
      false
    );

    $("loginError").textContent =
      "Invalid access code.";

    $("loginPassword").value = "";

    return;

  }

  currentAccount = account;

  recordLogin(
    account,
    true
  );

  sessionStorage.setItem(
    "parcelScope.loggedIn",
    account.id
  );

  $("loginScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");

  setupAfterLogin();

}


$("loginBtn").onclick =
  login;


$("loginPassword").addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      login();

    }

  }
);


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  sessionStorage.removeItem(
    "parcelScope.loggedIn"
  );

  currentAccount = null;

  location.reload();

}


/*
   sessionStorage deliberately means that closing the
   browser/tab ends the login session.
*/


/* =========================================================
   SESSION RESTORE
========================================================= */

function checkSession() {

  const id =
    sessionStorage.getItem(
      "parcelScope.loggedIn"
    );

  if (!id)
    return false;

  const account =
    ACCOUNTS.find(
      a => a.id === id
    );

  if (!account)
    return false;

  currentAccount = account;

  $("loginScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");

  setupAfterLogin();

  return true;

}


/* =========================================================
   MENU
========================================================= */

function setMenu(open) {

  $("menu")
    .classList
    .toggle(
      "hidden",
      !open
    );

}


$("menuBtn").onclick = () => {

  setMenu(true);

};


$("closeMenu").onclick = () => {

  setMenu(false);

};


/* =========================================================
   MENU PAGES
========================================================= */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.onclick = () => {

      openPage(
        button.dataset.page
      );

    };

  });


function openPage(page) {

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


  $("drawerTitle").textContent =
    titles[page];


  $("drawer")
    .classList
    .remove("hidden");


  if (page === "saved")
    renderSaved();


  if (page === "recent")
    renderRecent();


  if (page === "notifications")
    renderNotifications();


  if (page === "layers")
    renderLayers();


  if (page === "measure") {

    closeDrawer();

    startMeasure();

  }


  if (page === "settings")
    renderSettings();


  if (page === "about")
    renderAbout();

}


$("drawerClose").onclick =
  closeDrawer;


function closeDrawer() {

  $("drawer")
    .classList
    .add("hidden");

}


/* =========================================================
   SAVED PROPERTIES
========================================================= */

function savedStorageKey() {

  return accountKey(
    `${currentAccount.id}.saved`
  );

}


function getSaved() {

  return JSON.parse(
    localStorage.getItem(
      savedStorageKey()
    ) || "[]"
  );

}


function setSaved(properties) {

  localStorage.setItem(
    savedStorageKey(),
    JSON.stringify(properties)
  );

}


function isSaved(parcelId) {

  return getSaved()
    .some(
      p =>
        p.parcelId === parcelId
    );

}


function saveCurrentProperty() {

  if (!selectedParcel)
    return;

  const saved =
    getSaved();

  const exists =
    saved.some(
      p =>
        p.parcelId ===
        selectedParcel.parcelId
    );

  if (exists) {

    toast(
      "Property already saved."
    );

    return;

  }

  saved.unshift(
    selectedParcel
  );

  setSaved(
    saved.slice(0, 250)
  );

  toast(
    "Property saved."
  );

  $("saveBtn").textContent =
    "Saved";

}


$("saveBtn").onclick =
  saveCurrentProperty;


function renderSaved() {

  const properties =
    getSaved();


  if (!properties.length) {

    $("drawerBody").innerHTML =
      `<div class="menu-page">
        <p>No saved properties.</p>
      </div>`;

    return;

  }


  $("drawerBody").innerHTML =
    properties
      .map(
        (property, index) => `

          <button
            class="result"
            data-saved="${index}"
          >

            <strong>
              ${escapeHTML(
                property.address ||
                property.parcelId
              )}
            </strong>

            <small>
              ${escapeHTML(
                property.county
              )}
              ·
              ${escapeHTML(
                property.state
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-saved]"
    )
    .forEach(button => {

      button.onclick = () => {

        const property =
          properties[
            Number(
              button.dataset.saved
            )
          ];

        closeDrawer();

        selectParcel(
          property,
          true
        );

      };

    });

}


/* =========================================================
   RECENT
========================================================= */

function recentStorageKey() {

  return accountKey(
    `${currentAccount.id}.recent`
  );

}


function getRecent() {

  return JSON.parse(
    localStorage.getItem(
      recentStorageKey()
    ) || "[]"
  );

}


function addRecent(property) {

  const recent =
    getRecent()
      .filter(
        p =>
          p.parcelId !==
          property.parcelId
      );

  recent.unshift(
    property
  );

  localStorage.setItem(
    recentStorageKey(),
    JSON.stringify(
      recent.slice(0, 25)
    )
  );

}


function renderRecent() {

  const recent =
    getRecent();


  if (!recent.length) {

    $("drawerBody").innerHTML =
      `<div class="menu-page">
        <p>No recent properties.</p>
      </div>`;

    return;

  }


  $("drawerBody").innerHTML =
    recent
      .map(
        (property, index) => `

          <button
            class="result"
            data-recent="${index}"
          >

            <strong>
              ${escapeHTML(
                property.address ||
                property.parcelId
              )}
            </strong>

            <small>
              ${escapeHTML(
                property.county
              )}
              ·
              ${escapeHTML(
                property.state
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-recent]"
    )
    .forEach(button => {

      button.onclick = () => {

        const property =
          recent[
            Number(
              button.dataset.recent
            )
          ];

        closeDrawer();

        selectParcel(
          property,
          true
        );

      };

    });

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function notificationStorageKey() {

  return accountKey(
    `${currentAccount.id}.notifications`
  );

}


function getNotifications() {

  return JSON.parse(
    localStorage.getItem(
      notificationStorageKey()
    ) || "[]"
  );

}


function setNotifications(list) {

  localStorage.setItem(
    notificationStorageKey(),
    JSON.stringify(list)
  );

}


function addNotification(message) {

  const notifications =
    getNotifications();

  notifications.unshift({

    id:
      Date.now() +
      Math.random(),

    message,

    time:
      new Date().toLocaleString(),

    read: false

  });

  setNotifications(
    notifications.slice(0, 100)
  );

  updateNotificationDot();

}


function unreadNotifications() {

  return getNotifications()
    .some(
      notification =>
        !notification.read
    );

}


function updateNotificationDot() {

  const unread =
    unreadNotifications();

  $("redDot")
    .classList
    .toggle(
      "hidden",
      !unread
    );

  if ($("adminRedDot")) {

    $("adminRedDot")
      .classList
      .toggle(
        "hidden",
        !unread
      );

  }

}


function deleteNotification(id) {

  const list =
    getNotifications()
      .filter(
        notification =>
          String(notification.id) !==
          String(id)
      );

  setNotifications(list);

  renderNotifications();

  updateNotificationDot();

}


function deleteAllNotifications() {

  setNotifications([]);

  renderNotifications();

  updateNotificationDot();

}


function renderNotifications() {

  const notifications =
    getNotifications();


  notifications.forEach(
    notification => {
      notification.read = true;
    }
  );

  setNotifications(
    notifications
  );

  updateNotificationDot();


  if (!notifications.length) {

    $("drawerBody").innerHTML = `

      <div class="menu-page">

        <button
          id="deleteAllNotifications"
          disabled
        >
          Delete All
        </button>

        <p>
          No notifications.
        </p>

      </div>

    `;

    return;

  }


  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <button
        id="deleteAllNotifications"
      >
        Delete All
      </button>

      ${notifications.map(
        notification => `

          <div class="admin-card">

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:10px;
              "
            >

              <div>
                ${escapeHTML(
                  notification.message
                )}
              </div>

              <button
                data-delete-notification="${escapeHTML(
                  notification.id
                )}"
              >
                ×
              </button>

            </div>

            <small>
              ${escapeHTML(
                notification.time
              )}
            </small>

          </div>

        `
      ).join("")}

    </div>

  `;


  $("deleteAllNotifications")
    .onclick =
      deleteAllNotifications;


  document
    .querySelectorAll(
      "[data-delete-notification]"
    )
    .forEach(button => {

      button.onclick = () => {

        deleteNotification(
          button.dataset
            .deleteNotification
        );

      };

    });

}


/* =========================================================
   MAP LAYERS
========================================================= */

function renderLayers() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <div class="row">
        <span>Satellite</span>

        <input
          id="satelliteRadio"
          type="radio"
          name="basemap"
          checked
        >
      </div>

      <div class="row">
        <span>Street Map</span>

        <input
          id="streetRadio"
          type="radio"
          name="basemap"
        >
      </div>

      <div class="row">
        <span>Parcel Boundaries</span>

        <input
          id="parcelToggle"
          type="checkbox"
          ${parcelsEnabled ? "checked" : ""}
        >
      </div>

    </div>

  `;


  $("satelliteRadio").onchange =
    () => {

      map.removeLayer(
        street
      );

      satellite.addTo(map);

    };


  $("streetRadio").onchange =
    () => {

      map.removeLayer(
        satellite
      );

      street.addTo(map);

    };


  $("parcelToggle").onchange =
    event => {

      parcelsEnabled =
        event.target.checked;

      if (!parcelsEnabled) {

        parcelLayer.clearLayers();

      } else {

        loadVisibleParcels();

      }

    };

}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <h3>
        Account
      </h3>

      <div class="admin-card">

        <strong>
          Logged in as
        </strong>

        ${escapeHTML(
          getAccountName()
        )}

      </div>

      <label>
        Your Name
      </label>

      <input
        id="nameSetting"
        value="${escapeHTML(
          getAccountName() === "User"
            ? ""
            : getAccountName()
        )}"
        placeholder="User"
        style="
          width:100%;
          padding:10px;
          margin:7px 0;
          background:#08111b;
          color:white;
          border:1px solid var(--line);
          border-radius:8px;
        "
      >

      <button id="saveNameSetting">
        Save Name
      </button>

      <h3>
        Session
      </h3>

      <button id="logoutButton">
        Log Out
      </button>

    </div>

  `;


  $("saveNameSetting").onclick =
    () => {

      setAccountName(
        $("nameSetting").value
      );

      toast(
        "Name updated."
      );

      renderSettings();

    };


  $("logoutButton").onclick =
    logout;

}


/* =========================================================
   ABOUT
========================================================= */

function renderAbout() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <h3>
        ParcelScope
      </h3>

      <p>
        ParcelScope is a property mapping and
        parcel research interface for Washington,
        Oregon, Idaho and Montana.
      </p>

      <p>
        Parcel information is supplied by public
        GIS services and should be verified with
        the appropriate county or state agency.
      </p>

      <p>
        Version 1.0
      </p>

    </div>

  `;

}


/* =========================================================
   ADMIN
========================================================= */

function openAdmin() {

  if (!currentAccount ||
      !currentAccount.admin) {

    toast(
      "Admin access required."
    );

    return;

  }

  setMenu(false);

  $("drawerTitle").textContent =
    "Admin";

  $("drawer")
    .classList
    .remove("hidden");

  renderAdmin();

}


function renderAdmin() {

  const logs =
    JSON.parse(
      localStorage.getItem(
        "parcelScope.loginLogs"
      ) || "[]"
    );


  const accountRows =
    ACCOUNTS.map(
      account => {

        const name =
          localStorage.getItem(
            accountKey(
              `${account.id}.name`
            )
          ) || "User";

        return `

          <div class="admin-card">

            <strong>
              ${account.admin
                ? "Admin"
                : "User"}
            </strong>

            <div>
              Name:
              ${escapeHTML(name)}
            </div>

            <small>
              Account:
              ${escapeHTML(account.id)}
            </small>

          </div>

        `;

      }
    ).join("");


  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <div class="admin-section-title">
        Accounts
      </div>

      ${accountRows}


      <div class="admin-section-title">
        Send Notification
      </div>

      <div class="admin-form">

        <select id="notificationTarget">

          <option value="all">
            All Users
          </option>

          ${ACCOUNTS
            .filter(
              account =>
                !account.admin
            )
            .map(
              account => `

                <option
                  value="${account.id}"
                >
                  ${escapeHTML(
                    localStorage.getItem(
                      accountKey(
                        `${account.id}.name`
                      )
                    ) || "User"
                  )}
                  (${account.id})
                </option>

              `
            )
            .join("")}

        </select>


        <textarea
          id="notificationMessage"
          placeholder="Notification message..."
        ></textarea>


        <button id="sendNotification">
          Send Notification
        </button>

      </div>


      <div class="admin-section-title">
        Login History
      </div>

      ${
        logs.length
          ? logs.map(
              log => `

                <div class="admin-log">

                  <strong>
                    ${escapeHTML(
                      log.account
                    )}
                  </strong>

                  <small>
                    ${log.success
                      ? "Successful login"
                      : "Failed login"}
                    ·
                    ${escapeHTML(
                      new Date(
                        log.time
                      ).toLocaleString()
                    )}
                  </small>

                </div>

              `
            ).join("")
          : `
            <p>
              No login history.
            </p>
          `
      }

    </div>

  `;


  $("sendNotification").onclick =
    sendAdminNotification;

}


function sendAdminNotification() {

  const target =
    $("notificationTarget").value;

  const message =
    $("notificationMessage")
      .value
      .trim();


  if (!message) {

    toast(
      "Enter a notification first."
    );

    return;

  }


  if (target === "all") {

    ACCOUNTS
      .filter(
        account =>
          !account.admin
      )
      .forEach(
        account => {

          const old =
            currentAccount;

          currentAccount =
            account;

          addNotification(
            message
          );

          currentAccount =
            old;

        }
      );

  } else {

    const old =
      currentAccount;

    const targetAccount =
      ACCOUNTS.find(
        account =>
          account.id === target
      );

    if (targetAccount) {

      currentAccount =
        targetAccount;

      addNotification(
        message
      );

    }

    currentAccount =
      old;

  }


  $("notificationMessage")
    .value = "";

  toast(
    "Notification sent."
  );

}


/* =========================================================
   GIS HELPERS
========================================================= */

function buildQueryURL(
  base,
  params
) {

  const url =
    new URL(
      `${base}/query`
    );

  Object.entries(params)
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


function normalizeFeature(
  feature,
  state,
  source
) {

  const a =
    feature.attributes || {};

  const f =
    source.fields || {};

  return {

    state,

    sourceUrl:
      source.url,

    objectId:
      a.OBJECTID,

    parcelId:
      a[f.id] ||
      a.PARCELID ||
      a.PARCEL_ID ||
      a.ORTaxlot ||
      a.ORMapNum ||
      `OBJECT-${a.OBJECTID}`,

    address:
      a[f.address] ||
      a.SITUS_ADDRESS ||
      a.SITE_ADD ||
      a.AddressLine1 ||
      a.SITEADDNAM ||
      "",

    city:
      a[f.city] ||
      a.SITUS_CITY_NM ||
      a.SITE_CITY ||
      "",

    county:
      a[f.county] ||
      a.COUNTY_NM ||
      a.County ||
      "",

    owner:
      a[f.owner] ||
      a.OwnerName ||
      a.OWNER1 ||
      a.OWNERLINE1 ||
      "",

    acres:
      a[f.acres] ??
      a.GISAcres ??
      a.ASR_ACRES ??
      a.TaxlotAcre ??
      "",

    value:
      a[f.value] ??
      a.TotalValue ??
      a.VAL_TOTAL ??
      "",

    attributes:
      a,

    geometry:
      feature.geometry,

    layerUrl:
      source.url

  };

}


/* =========================================================
   SEARCH GIS
========================================================= */

async function searchFeatureSource(
  state,
  source,
  search
) {

  const fields = [
    source.fields.id,
    source.fields.address,
    source.fields.city,
    source.fields.county,
    source.fields.owner
  ]
    .filter(Boolean);


  if (!fields.length)
    return [];


  const safe =
    search
      .replaceAll("'", "''");


  const where =
    fields
      .map(
        field =>
          `UPPER(${field}) LIKE UPPER('%${safe}%')`
      )
      .join(" OR ");


  const url =
    buildQueryURL(
      source.url,
      {
        where,

        outFields: "*",

        returnGeometry: "true",

        outSR: "4326",

        resultRecordCount: "25",

        f: "geojson"
      }
    );


  const response =
    await fetch(url);


  if (!response.ok)
    throw new Error(
      `${state} GIS request failed`
    );


  const data =
    await response.json();


  return (
    data.features || []
  )
    .map(
      feature =>
        normalizeFeature(
          feature,
          state,
          source
        )
    );

}


/* =========================================================
   OREGON SEARCH
========================================================= */

async function searchOregon(
  search
) {

  const results = [];

  const safe =
    search
      .replaceAll("'", "''");


  for (
    let layerId = 0;
    layerId < OREGON_COUNTIES.length;
    layerId++
  ) {

    const url =
      `${GIS.OR.url}/${layerId}`;


    try {

      const infoResponse =
        await fetch(
          `${url}?f=json`
        );

      if (!infoResponse.ok)
        continue;

      const info =
        await infoResponse.json();


      const fields =
        (info.fields || [])
          .map(
            field =>
              field.name
          )
          .filter(
            field =>
              ![
                "OBJECTID",
                "Shape",
                "Shape__Area",
                "Shape__Length"
              ].includes(field)
          );


      const useful =
        fields.filter(
          field =>
            /tax|owner|address|site|map|parcel|ortax/i
              .test(field)
        );


      if (!useful.length)
        continue;


      const where =
        useful
          .map(
            field =>
              `UPPER(${field}) LIKE UPPER('%${safe}%')`
          )
          .join(" OR ");


      const query =
        buildQueryURL(
          url,
          {
            where,

            outFields: "*",

            returnGeometry: "true",

            outSR: "4326",

            resultRecordCount: "20",

            f: "geojson"
          }
        );


      const response =
        await fetch(query);


      if (!response.ok)
        continue;


      const data =
        await response.json();


      for (
        const feature of
        data.features || []
      ) {

        const a =
          feature.properties || {};


        results.push({

          state: "OR",

          sourceUrl: url,

          parcelId:
            a.ORTaxlot ||
            a.ORMapNum ||
            a.MapTaxlot ||
            a.Taxlot ||
            `OBJECT-${a.OBJECTID}`,

          address:
            a.SITEADDNAM ||
            "",

          city:
            a.SITEADDCTY ||
            "",

          county:
            OREGON_COUNTIES[
              layerId
            ],

          owner:
            a.OWNERLINE1 ||
            "",

          acres:
            a.TaxlotAcre ||
            "",

          value: "",

          attributes: a,

          geometry:
            feature.geometry,

          layerUrl: url

        });

      }

    } catch (error) {

      console.warn(
        "Oregon layer failed:",
        layerId,
        error
      );

    }

  }


  return results.slice(
    0,
    100
  );

}


/* =========================================================
   SEARCH
========================================================= */

async function performSearch() {

  const search =
    $("searchInput")
      .value
      .trim();

  const state =
    $("stateSelect")
      .value;


  if (!search) {

    toast(
      "Enter an address, owner or parcel ID."
    );

    return;

  }


  $("searchBtn").disabled =
    true;

  $("searchBtn").textContent =
    "Searching...";


  try {

    let results = [];


    const states =
      state === "ALL"
        ? ["WA", "OR", "ID", "MT"]
        : [state];


    for (
      const stateCode of states
    ) {

      if (
        stateCode === "OR"
      ) {

        const orResults =
          await searchOregon(
            search
          );

        results.push(
          ...orResults
        );

      } else {

        const source =
          GIS[stateCode];


        const features =
          await searchFeatureSource(
            stateCode,
            source,
            search
          );


        results.push(
          ...features
        );

      }

    }


    showSearchResults(
      results
    );

  } catch (error) {

    console.error(error);

    toast(
      "GIS search failed. Check your connection."
    );

  } finally {

    $("searchBtn").disabled =
      false;

    $("searchBtn").textContent =
      "Search";

  }

}


$("searchBtn").onclick =
  performSearch;


$("searchInput").addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      performSearch();

    }

  }
);


/* =========================================================
   SEARCH RESULTS
========================================================= */

function showSearchResults(
  results
) {

  $("results")
    .classList
    .remove("hidden");


  if (!results.length) {

    $("resultsBody").innerHTML =
      `<p>No parcels found.</p>`;

    return;

  }


  $("resultsBody").innerHTML =
    results.map(
      (property, index) => `

        <button
          class="result"
          data-search-result="${index}"
        >

          <strong>
            ${escapeHTML(
              property.address ||
              property.parcelId
            )}
          </strong>

          <small>
            ${escapeHTML(
              property.owner ||
              "Owner unavailable"
            )}
            ·
            ${escapeHTML(
              property.county
            )}
            ·
            ${escapeHTML(
              property.state
            )}
          </small>

        </button>

      `
    ).join("");


  document
    .querySelectorAll(
      "[data-search-result]"
    )
    .forEach(button => {

      button.onclick = () => {

        const property =
          results[
            Number(
              button.dataset
                .searchResult
            )
          ];

        $("results")
          .classList
          .add("hidden");

        selectParcel(
          property,
          true
        );

      };

    });

}


/* =========================================================
   SELECT PARCEL
========================================================= */

function selectParcel(
  property,
  zoom
) {

  selectedParcel =
    property;


  selectedLayer.clearLayers();


  if (
    property.geometry
  ) {

    const layer =
      L.geoJSON(
        {
          type: "Feature",
          geometry:
            property.geometry,
          properties: {}
        },
        {
          style: {
            color: "#55d6ff",
            weight: 4,
            fillOpacity: 0.12
          }
        }
      );


    selectedLayer.addLayer(
      layer
    );


    if (zoom) {

      try {

        map.fitBounds(
          layer.getBounds(),
          {
            padding: [
              30,
              30
            ],
            maxZoom: 17
          }
        );

      } catch {}

    }

  }


  $("propertyTitle")
    .textContent =
      property.address ||
      property.parcelId ||
      "Property";


  $("propertyBody").innerHTML = `

    <div class="field">
      <b>Parcel ID</b>
      ${escapeHTML(
        property.parcelId
      )}
    </div>

    <div class="field">
      <b>Address</b>
      ${escapeHTML(
        property.address
      )}
    </div>

    <div class="field">
      <b>Owner</b>
      ${escapeHTML(
        property.owner
      )}
    </div>

    <div class="field">
      <b>County</b>
      ${escapeHTML(
        property.county
      )}
    </div>

    <div class="field">
      <b>State</b>
      ${escapeHTML(
        property.state
      )}
    </div>

    <div class="field">
      <b>Acres</b>
      ${escapeHTML(
        property.acres
      )}
    </div>

    <div class="field">
      <b>Value</b>
      ${
        property.value !== "" &&
        property.value !== null
          ? "$" +
            Number(
              property.value
            ).toLocaleString()
          : "Currently unavailable"
      }
    </div>

  `;


  $("property")
    .classList
    .remove("hidden");


  $("saveBtn").textContent =
    isSaved(
      property.parcelId
    )
      ? "Saved"
      : "Save Property";


  addRecent(
    property
  );

}


/* =========================================================
   CLOSE PROPERTY
========================================================= */

$("propertyClose").onclick =
  () => {

    $("property")
      .classList
      .add("hidden");

    selectedLayer.clearLayers();

  };


$("resultsClose").onclick =
  () => {

    $("results")
      .classList
      .add("hidden");

  };


/* =========================================================
   SHARE
========================================================= */

$("shareBtn").onclick =
  async () => {

    if (!selectedParcel)
      return;


    const text =
      `ParcelScope parcel: ${
        selectedParcel.parcelId
      } ${
        selectedParcel.address || ""
      }`;


    try {

      if (
        navigator.share
      ) {

        await navigator.share({
          title:
            "ParcelScope Property",
          text
        });

      } else if (
        navigator.clipboard
      ) {

        await navigator.clipboard
          .writeText(text);

        toast(
          "Parcel information copied."
        );

      }

    } catch {}

  };


/* =========================================================
   MAP LINKS
========================================================= */

$("mapsBtn").onclick =
  () => {

    if (!selectedParcel)
      return;

    $("mapsModal")
      .classList
      .remove("hidden");

  };


$("mapsClose").onclick =
$("mapsCancel").onclick =
  () => {

    $("mapsModal")
      .classList
      .add("hidden");

  };


function selectedCoordinates() {

  if (
    !selectedParcel ||
    !selectedParcel.geometry
  )
    return null;


  const bounds =
    L.geoJSON(
      selectedParcel.geometry
    ).getBounds();


  const center =
    bounds.getCenter();


  return center;

}


$("googleBtn").onclick =
  () => {

    const center =
      selectedCoordinates();

    if (!center)
      return;


    window.open(
      `https://www.google.com/maps/search/?api=1&query=${
        center.lat
      },${
        center.lng
      }`,
      "_blank"
    );

  };


$("appleBtn").onclick =
  () => {

    const center =
      selectedCoordinates();

    if (!center)
      return;


    window.open(
      `https://maps.apple.com/?ll=${
        center.lat
      },${
        center.lng
      }`,
      "_blank"
    );

  };


/* =========================================================
   VISIBLE PARCELS
========================================================= */

let parcelRequestTimer = null;


map.on(
  "moveend",
  () => {

    clearTimeout(
      parcelRequestTimer
    );

    parcelRequestTimer =
      setTimeout(
        loadVisibleParcels,
        500
      );

  }
);


map.on(
  "zoomend",
  () => {

    if (
      parcelsEnabled
    ) {

      loadVisibleParcels();

    }

  }
);


async function loadVisibleParcels() {

  if (
    !parcelsEnabled ||
    map.getZoom() <
      PARCEL_ZOOM
  ) {

    parcelLayer.clearLayers();

    return;

  }


  const bounds =
    map.getBounds();


  const south =
    bounds.getSouth();

  const west =
    bounds.getWest();

  const north =
    bounds.getNorth();

  const east =
    bounds.getEast();


  parcelLayer.clearLayers();


  /*
    Don't hammer all 35 Oregon layers on every map move.
    For Oregon, parcels are displayed after the user
    searches or when the map is centered in Oregon.
  */


  const center =
    map.getCenter();


  const isOregon =
    center.lat >= 41.9 &&
    center.lat <= 46.4 &&
    center.lng >= -124.8 &&
    center.lng <= -116.4;


  const states = [];


  if (
    center.lng >= -124.8 &&
    center.lng <= -116.9
  ) {

    states.push("WA");

  }


  if (
    center.lat >= 41.9 &&
    center.lat <= 46.4 &&
    center.lng >= -124.8 &&
    center.lng <= -116.4
  ) {

    states.push("OR");

  }


  if (
    center.lat >= 41.9 &&
    center.lat <= 49.1 &&
    center.lng >= -117.3 &&
    center.lng <= -110.9
  ) {

    states.push("ID");

  }


  if (
    center.lat >= 44.2 &&
    center.lat <= 49.1 &&
    center.lng >= -116.2 &&
    center.lng <= -104.0
  ) {

    states.push("MT");

  }


  for (
    const state of states
  ) {

    if (
      state === "OR"
    ) {

      if (!isOregon)
        continue;

      /*
        Oregon's service contains separate county
        layers. Determine likely county layers by
        querying their extent would be expensive,
        so Oregon parcel display is primarily handled
        through search.
      */

      continue;

    }


    const source =
      GIS[state];


    const envelope =
      JSON.stringify({
        xmin: west,
        ymin: south,
        xmax: east,
        ymax: north,
        spatialReference: {
          wkid: 4326
        }
      });


    const url =
      buildQueryURL(
        source.url,
        {
          where: "1=1",

          geometry:
            envelope,

          geometryType:
            "esriGeometryEnvelope",

          inSR: "4326",

          spatialRel:
            "esriSpatialRelIntersects",

          outFields:
            source.fields.id,

          returnGeometry:
            "true",

          outSR:
            "4326",

          resultRecordCount:
            "1500",

          f:
            "geojson"
        }
      );


    try {

      const response =
        await fetch(url);


      if (!response.ok)
        continue;


      const data =
        await response.json();


      (
        data.features || []
      ).forEach(
        feature => {

          const layer =
            L.geoJSON(
              feature,
              {
                style: {
                  color:
                    "#55d6ff",

                  weight: 1,

                  opacity: .65,

                  fillOpacity: 0
                }
              }
            );


          layer.on(
            "click",
            () => {

              const property =
                normalizeFeature(
                  feature,
                  state,
                  source
                );

              selectParcel(
                property,
                false
              );

            }
          );


          parcelLayer.addLayer(
            layer
          );

        }
      );

    } catch (
      error
    ) {

      console.warn(
        "Parcel layer error:",
        state,
        error
      );

    }

  }

}


/* =========================================================
   LOCATION
========================================================= */

$("locateBtn").onclick =
  () => {

    if (
      followingLocation
    ) {

      stopFollowingLocation();

    } else {

      startFollowingLocation();

    }

  };


function startFollowingLocation() {

  if (
    !navigator.geolocation
  ) {

    toast(
      "Location is not available."
    );

    return;

  }


  followingLocation =
    true;

  $("locateBtn")
    .textContent =
      "Stop";


  locationWatch =
    navigator.geolocation.watchPosition(
      position => {

        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;


        coordinateLayer.clearLayers();


        L.circleMarker(
          [
            lat,
            lng
          ],
          {
            radius: 7,

            color:
              "#55d6ff",

            fillColor:
              "#55d6ff",

            fillOpacity: 1
          }
        )
        .addTo(
          coordinateLayer
        );


        map.setView(
          [
            lat,
            lng
          ],
          Math.max(
            map.getZoom(),
            14
          )
        );

      },
      error => {

        console.warn(
          error
        );

        stopFollowingLocation();

        toast(
          "Unable to get your location."
        );

      },
      {
        enableHighAccuracy: true,

        maximumAge: 5000,

        timeout: 15000
      }
    );

}


function stopFollowingLocation() {

  followingLocation =
    false;

  $("locateBtn")
    .textContent =
      "Locate";


  if (
    locationWatch !== null
  ) {

    navigator.geolocation
      .clearWatch(
        locationWatch
      );

    locationWatch = null;

  }

}


/* =========================================================
   MEASURE
========================================================= */

function startMeasure() {

  measureMode =
    true;

  measurePoints =
    [];

  measureLayer.clearLayers();

  $("measure")
    .classList
    .remove("hidden");

  updateMeasure();

}


$("finishMeasure").onclick =
  () => {

    measureMode =
      false;

    toast(
      "Measurement finished."
    );

  };


$("clearMeasure").onclick =
  () => {

    measurePoints =
      [];

    measureLayer.clearLayers();

    updateMeasure();

  };


map.on(
  "click",
  event => {

    if (
      !measureMode
    )
      return;


    measurePoints.push(
      event.latlng
    );


    if (
      measurePoints.length > 1
    ) {

      L.polyline(
        measurePoints,
        {
          color:
            "#55d6ff",

          weight: 4
        }
      )
      .addTo(
        measureLayer
      );

    }


    L.circleMarker(
      event.latlng,
      {
        radius: 5,

        color:
          "#55d6ff",

        fillColor:
          "#55d6ff",

        fillOpacity: 1
      }
    )
    .addTo(
      measureLayer
    );


    updateMeasure();

  }
);


function updateMeasure() {

  let meters = 0;


  for (
    let i = 1;
    i < measurePoints.length;
    i++
  ) {

    meters +=
      measurePoints[
        i - 1
      ].distanceTo(
        measurePoints[i]
      );

  }


  const feet =
    meters *
    3.280839895;


  if (
    feet < 5280
  ) {

    $("measureValue")
      .textContent =
        `${Math.round(
          feet
        )} ft`;

  } else {

    $("measureValue")
      .textContent =
        `${(
          feet / 5280
        ).toFixed(2)} mi`;

  }

}


/* =========================================================
   ADMIN BUTTON
========================================================= */

$("adminMenuButton").onclick =
  openAdmin;


/* =========================================================
   INITIALIZATION
========================================================= */

function setupAfterLogin() {

  if (
    currentAccount.admin
  ) {

    $("adminMenuButton")
      .classList
      .remove("hidden");

  } else {

    $("adminMenuButton")
      .classList
      .add("hidden");

  }


  updateNotificationDot();

  loadVisibleParcels();

}


/* =========================================================
   START
========================================================= */

if (
  !checkSession()
) {

  $("loginScreen")
    .classList
    .remove("hidden");

}
