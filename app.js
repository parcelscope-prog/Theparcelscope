/*
==========================================================
PARCELSCOPE
==========================================================

CLIENT-ONLY VERSION

13 accounts.
4-digit passwords.
Account 01 = Admin.

No Firebase.
No Google login.
No Gmail.
No backend.

Account-specific data:
- saved properties
- recent properties
- display name
- notifications

Admin:
- login history
- account list
- send notification to one account
- send notification to all accounts

IMPORTANT:
Because this is static Cloudflare hosting, localStorage
belongs to the individual browser/device.

A true shared admin log and cross-device notification
system requires a backend/database.
==========================================================
*/


/* ======================================================
   ACCOUNTS
======================================================

   Users type only these four digits.

   13 accounts total.

   Change these numbers whenever you want.
*/

const ACCOUNTS = {

  "4821": {
    id: "01",
    name: "Admin",
    admin: true
  },

  "7354": {
    id: "02",
    name: "User",
    admin: false
  },

  "1968": {
    id: "03",
    name: "User",
    admin: false
  },

  "5247": {
    id: "04",
    name: "User",
    admin: false
  },

  "8036": {
    id: "05",
    name: "User",
    admin: false
  },

  "2419": {
    id: "06",
    name: "User",
    admin: false
  },

  "6713": {
    id: "07",
    name: "User",
    admin: false
  },

  "9582": {
    id: "08",
    name: "User",
    admin: false
  },

  "3146": {
    id: "09",
    name: "User",
    admin: false
  },

  "8605": {
    id: "10",
    name: "User",
    admin: false
  },

  "4278": {
    id: "11",
    name: "User",
    admin: false
  },

  "5931": {
    id: "12",
    name: "User",
    admin: false
  },

  "7049": {
    id: "13",
    name: "User",
    admin: false
  }

};


/* ======================================================
   GIS SOURCES
======================================================

   These are intentionally empty until verified parcel
   FeatureServer endpoints are connected.

   The map itself still works.
*/

const STATE_SOURCES = {

  WA: [],

  OR: [],

  ID: [],

  MT: []

};


/* ======================================================
   MAP SETTINGS
====================================================== */

const PARCEL_ZOOM = 10;

const NORTHWEST_CENTER = [
  46.1,
  -116.7
];


/* ======================================================
   MAP
====================================================== */

const map = L.map("map", {

  zoomControl: false,

  doubleClickZoom: false,

  rotate: false,

  touchZoom: true,

  scrollWheelZoom: true,

  dragging: true,

  keyboard: true

}).setView(
  NORTHWEST_CENTER,
  5.55
);


/* ======================================================
   BASEMAPS
====================================================== */

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


/* ======================================================
   LAYERS
====================================================== */

const parcelLayer =
  L.layerGroup().addTo(map);

const selectedLayer =
  L.layerGroup().addTo(map);

const unavailableCountyLayer =
  L.layerGroup().addTo(map);

const measureLayer =
  L.layerGroup().addTo(map);

const coordinateLayer =
  L.layerGroup().addTo(map);


/* ======================================================
   STATE
====================================================== */

let currentAccount = null;

let selectedParcel = null;

let followingLocation = false;

let locationWatch = null;

let measureMode = false;

let measurePoints = [];

let measureLine = null;

let parcelsEnabled = true;

let countyLayerEnabled = false;

let stateLayerEnabled = false;

let labelsEnabled = true;

let menuOpen = false;


/* ======================================================
   HELPERS
====================================================== */

function $(id) {
  return document.getElementById(id);
}


function escapeHTML(value) {

  return String(value ?? "Currently unavailable")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function toast(message) {

  $("toast").textContent = message;

  $("toast").classList.remove("hidden");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {

    $("toast").classList.add("hidden");

  }, 2600);

}


function accountStorageKey(type) {

  return `parcelScope.${type}.${currentAccount.key}`;

}


function getJSON(key, fallback) {

  try {

    return JSON.parse(
      localStorage.getItem(key)
    ) ?? fallback;

  } catch {

    return fallback;

  }

}


function setJSON(key, value) {

  localStorage.setItem(
    key,
    JSON.stringify(value)
  );

}


/* ======================================================
   LOGIN HISTORY
====================================================== */

function getLoginHistory() {

  return getJSON(
    "parcelScope.loginHistory",
    []
  );

}


function addLoginHistory(account, success) {

  const history =
    getLoginHistory();

  history.unshift({

    accountId:
      account?.id || "unknown",

    name:
      account?.name || "Unknown",

    success:
      Boolean(success),

    time:
      new Date().toISOString()

  });


  setJSON(
    "parcelScope.loginHistory",
    history.slice(0, 500)
  );

}


/* ======================================================
   LOGIN
====================================================== */

function login(password) {

  const account =
    ACCOUNTS[password];


  if (!account) {

    addLoginHistory(
      null,
      false
    );

    $("loginError").textContent =
      "Invalid password.";

    $("loginError")
      .classList
      .remove("hidden");

    $("passwordInput").value = "";

    $("passwordInput").focus();

    return;

  }


  currentAccount = {

    key: password,

    ...account

  };


  /*
    sessionStorage means the session does not survive
    a browser/tab session ending.
  */

  setJSON(
    "parcelScope.session",
    currentAccount
  );


  addLoginHistory(
    account,
    true
  );


  $("loginError")
    .classList
    .add("hidden");


  initializeAccountUI();

  $("loginScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");


  setTimeout(() => {

    map.invalidateSize();

  }, 100);

}


function restoreSession() {

  const raw =
    sessionStorage.getItem(
      "parcelScope.session"
    );


  if (!raw) {

    showLogin();

    return;

  }


  try {

    const session =
      JSON.parse(raw);


    if (
      !session ||
      !session.key ||
      !ACCOUNTS[session.key]
    ) {

      sessionStorage.removeItem(
        "parcelScope.session"
      );

      showLogin();

      return;

    }


    currentAccount = {

      key: session.key,

      ...ACCOUNTS[session.key]

    };


    initializeAccountUI();

    $("loginScreen")
      .classList
      .add("hidden");

    $("app")
      .classList
      .remove("hidden");

  }

  catch {

    sessionStorage.removeItem(
      "parcelScope.session"
    );

    showLogin();

  }

}


function showLogin() {

  $("loginScreen")
    .classList
    .remove("hidden");

  $("app")
    .classList
    .add("hidden");

  setTimeout(() => {

    $("passwordInput").focus();

  }, 100);

}


$("loginForm").addEventListener(
  "submit",
  event => {

    event.preventDefault();

    const password =
      $("passwordInput").value.trim();


    if (!/^\d{4}$/.test(password)) {

      $("loginError").textContent =
        "Enter exactly 4 numbers.";

      $("loginError")
        .classList
        .remove("hidden");

      return;

    }


    login(password);

  }
);


/* ======================================================
   LOGOUT
====================================================== */

function logout() {

  stopFollowingLocation();

  stopMeasure();

  currentAccount = null;

  selectedParcel = null;

  sessionStorage.removeItem(
    "parcelScope.session"
  );

  closeAllPanels();

  showLogin();

}


$("logoutBtn").onclick =
  logout;


/* ======================================================
   ACCOUNT NAME
====================================================== */

function getNames() {

  return getJSON(
    "parcelScope.names",
    {}
  );

}


function getDisplayName() {

  const names =
    getNames();


  return names[currentAccount.key] ||
    "User";

}


function saveDisplayName(name) {

  const names =
    getNames();


  const clean =
    String(name || "")
      .trim()
      .slice(0, 40);


  names[currentAccount.key] =
    clean || "User";


  setJSON(
    "parcelScope.names",
    names
  );


  $("menuUserName").textContent =
    names[currentAccount.key];


  toast("Name saved.");

}


function initializeAccountUI() {

  $("menuUserName").textContent =
    getDisplayName();


  $("adminMenuBtn")
    .classList
    .toggle(
      "hidden",
      !currentAccount.admin
    );


  updateNotificationDot();

}


/* ======================================================
   MENU
====================================================== */

function setMenu(open) {

  menuOpen = open;

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


document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.onclick = () => {

      openPage(
        button.dataset.page
      );

    };

  });


/* ======================================================
   PANELS
====================================================== */

function closeDrawer() {

  $("drawer")
    .classList
    .add("hidden");

}


function closeAllPanels() {

  closeDrawer();

  $("property")
    .classList
    .add("hidden");

  $("results")
    .classList
    .add("hidden");

  $("mapsModal")
    .classList
    .add("hidden");

  setMenu(false);

}


$("drawerClose").onclick =
  closeDrawer;


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


/* ======================================================
   PAGE ROUTER
====================================================== */

function openPage(page) {

  const titles = {

    saved: "Saved Properties",

    recent: "Recent Properties",

    notifications: "Notifications",

    layers: "Map Layers",

    measure: "Measure Distance",

    settings: "Settings",

    about: "About ParcelScope",

    admin: "Admin"

  };


  if (page === "measure") {

    closeDrawer();

    setMenu(false);

    startMeasure();

    return;

  }


  if (
    page === "admin" &&
    !currentAccount.admin
  ) {

    toast("Admin access required.");

    return;

  }


  $("drawerTitle").textContent =
    titles[page] || page;


  $("drawer")
    .classList
    .remove("hidden");


  setMenu(false);


  switch (page) {

    case "saved":
      renderSaved();
      break;

    case "recent":
      renderRecent();
      break;

    case "notifications":
      renderNotifications();
      break;

    case "layers":
      renderLayers();
      break;

    case "settings":
      renderSettings();
      break;

    case "about":
      renderAbout();
      break;

    case "admin":
      renderAdmin();
      break;

  }

}


/* ======================================================
   SAVED PROPERTIES
====================================================== */

function getSaved() {

  return getJSON(
    accountStorageKey("saved"),
    []
  );

}


function setSaved(properties) {

  setJSON(
    accountStorageKey("saved"),
    properties
  );

}


function isSaved(property) {

  return getSaved().some(
    p =>
      p.parcelId ===
      property.parcelId
  );

}


function toggleSave(property) {

  const saved =
    getSaved();


  const index =
    saved.findIndex(
      p =>
        p.parcelId ===
        property.parcelId
    );


  if (index >= 0) {

    saved.splice(index, 1);

    setSaved(saved);

    $("saveBtn").textContent =
      "Save Property";

    toast(
      "Property removed from saved."
    );

    return;

  }


  saved.unshift(property);

  setSaved(saved);

  $("saveBtn").textContent =
    "Remove Saved Property";

  toast("Property saved.");

}


function renderSaved() {

  const properties =
    getSaved();


  if (!properties.length) {

    $("drawerBody").innerHTML = `
      <div class="menu-page">
        <p>No saved properties.</p>
      </div>
    `;

    return;

  }


  $("drawerBody").innerHTML =
    properties
      .map(
        (property, index) => `

          <button
            class="result"
            data-saved="${index}"
            type="button"
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
              ${property.state ? " · " : ""}
              ${escapeHTML(
                property.state || ""
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll("[data-saved]")
    .forEach(button => {

      button.onclick = () => {

        const property =
          properties[
            Number(button.dataset.saved)
          ];

        closeDrawer();

        selectParcel(
          property,
          true
        );

      };

    });

}


/* ======================================================
   RECENT
====================================================== */

function getRecent() {

  return getJSON(
    accountStorageKey("recent"),
    []
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


  recent.unshift(property);


  setJSON(
    accountStorageKey("recent"),
    recent.slice(0, 25)
  );

}


function renderRecent() {

  const recent =
    getRecent();


  if (!recent.length) {

    $("drawerBody").innerHTML = `
      <div class="menu-page">
        <p>No recent properties.</p>
      </div>
    `;

    return;

  }


  $("drawerBody").innerHTML =
    recent
      .map(
        (property, index) => `

          <button
            class="result"
            data-recent="${index}"
            type="button"
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
              ${property.state ? " · " : ""}
              ${escapeHTML(
                property.state || ""
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll("[data-recent]")
    .forEach(button => {

      button.onclick = () => {

        const property =
          recent[
            Number(button.dataset.recent)
          ];

        closeDrawer();

        selectParcel(
          property,
          true
        );

      };

    });

}


/* ======================================================
   NOTIFICATIONS
====================================================== */

function getNotifications() {

  return getJSON(
    accountStorageKey("notifications"),
    []
  );

}


function setNotifications(notifications) {

  setJSON(
    accountStorageKey("notifications"),
    notifications
  );

}


function updateNotificationDot() {

  if (!currentAccount) {
    return;
  }


  const notifications =
    getNotifications();


  const unread =
    notifications.some(
      n =>
        !n.read
    );


  $("redDot")
    .classList
    .toggle(
      "hidden",
      !unread
    );

}


function addNotification(
  title,
  message
) {

  const notifications =
    getNotifications();


  notifications.unshift({

    id:
      Date.now().toString() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2),

    title:
      String(title || "Notification"),

    message:
      String(message || ""),

    time:
      new Date().toISOString(),

    read: false

  });


  setNotifications(
    notifications.slice(0, 100)
  );


  updateNotificationDot();

}


function deleteNotification(id) {

  const notifications =
    getNotifications()
      .filter(
        n =>
          n.id !== id
      );


  setNotifications(
    notifications
  );


  renderNotifications();

}


function deleteAllNotifications() {

  setNotifications([]);

  updateNotificationDot();

  renderNotifications();

}


function formatDate(iso) {

  return new Date(iso)
    .toLocaleString();

}


function renderNotifications() {

  const notifications =
    getNotifications();


  /*
    Opening Notifications marks all notifications
    as read, which removes the red dot.
  */

  notifications.forEach(
    n => {
      n.read = true;
    }
  );


  setNotifications(
    notifications
  );


  updateNotificationDot();


  if (!notifications.length) {

    $("drawerBody").innerHTML = `
      <div class="menu-page">

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
        type="button"
      >
        Delete All
      </button>

      <div id="notificationList"></div>

    </div>

  `;


  $("deleteAllNotifications").onclick =
    deleteAllNotifications;


  $("notificationList").innerHTML =
    notifications
      .map(
        notification => `

          <div class="notification">

            <div class="notification-head">

              <div>

                <div class="notification-title">
                  ${escapeHTML(
                    notification.title
                  )}
                </div>

                <div class="notification-time">
                  ${escapeHTML(
                    formatDate(
                      notification.time
                    )
                  )}
                </div>

              </div>

              <button
                class="notification-delete"
                data-delete-notification="${escapeHTML(
                  notification.id
                )}"
                type="button"
              >
                ×
              </button>

            </div>

            <div class="notification-message">
              ${escapeHTML(
                notification.message
              )}
            </div>

          </div>

        `
      )
      .join("");


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


/* ======================================================
   MAP LAYERS
====================================================== */

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

      <div class="row">
        <span>County Boundaries</span>

        <input
          id="countyToggle"
          type="checkbox"
          ${countyLayerEnabled ? "checked" : ""}
        >
      </div>

      <div class="row">
        <span>State Boundaries</span>

        <input
          id="stateToggle"
          type="checkbox"
          ${stateLayerEnabled ? "checked" : ""}
        >
      </div>

      <div class="row">
        <span>State & Town Labels</span>

        <input
          id="labelsToggle"
          type="checkbox"
          ${labelsEnabled ? "checked" : ""}
        >
      </div>

    </div>

  `;


  $("satelliteRadio").onchange =
    () => {

      map.removeLayer(street);

      satellite.addTo(map);

    };


  $("streetRadio").onchange =
    () => {

      map.removeLayer(satellite);

      street.addTo(map);

    };


  $("parcelToggle").onchange =
    event => {

      parcelsEnabled =
        event.target.checked;


      if (
        parcelsEnabled &&
        map.getZoom() >= PARCEL_ZOOM
      ) {

        loadVisibleParcels();

      } else {

        parcelLayer.clearLayers();

      }

    };


  $("countyToggle").onchange =
    event => {

      countyLayerEnabled =
        event.target.checked;

      toast(
        countyLayerEnabled
          ? "County layer enabled."
          : "County layer disabled."
      );

    };


  $("stateToggle").onchange =
    event => {

      stateLayerEnabled =
        event.target.checked;

      toast(
        stateLayerEnabled
          ? "State layer enabled."
          : "State layer disabled."
      );

    };


  $("labelsToggle").onchange =
    event => {

      labelsEnabled =
        event.target.checked;

      toast(
        labelsEnabled
          ? "Labels enabled."
          : "Labels disabled."
      );

    };

}


/* ======================================================
   SETTINGS
====================================================== */

function renderSettings() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <h3>
        Account
      </h3>

      <div class="field">

        <b>
          Display Name
        </b>

        <input
          id="displayNameInput"
          maxlength="40"
          value="${escapeHTML(
            getDisplayName()
          )}"
          style="
            width:100%;
            padding:10px;
            border:1px solid var(--line);
            border-radius:8px;
            background:#101b27;
            color:var(--text);
            outline:none;
          "
        >

      </div>

      <button
        id="saveNameBtn"
        type="button"
      >
        Save Name
      </button>


      <h3>
        Location
      </h3>

      <button
        id="followSetting"
        type="button"
      >
        ${
          followingLocation
            ? "Stop Following"
            : "Follow My Location"
        }
      </button>


      <h3>
        Session
      </h3>

      <p>
        You are signed in as
        <strong>
          ${escapeHTML(
            getDisplayName()
          )}
        </strong>.
      </p>

      <p>
        Closing the browser session logs you out.
      </p>

    </div>

  `;


  $("saveNameBtn").onclick =
    () => {

      saveDisplayName(
        $("displayNameInput").value
      );

    };


  $("followSetting").onclick =
    () => {

      if (followingLocation) {

        stopFollowingLocation();

      } else {

        startFollowingLocation();

      }

      renderSettings();

    };

}


/* ======================================================
   ABOUT
====================================================== */

function renderAbout() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <h3>
        ParcelScope
      </h3>

      <p>
        ParcelScope is a private property mapping
        application for exploring parcels, saving
        properties and managing personal property
        information.
      </p>

      <h3>
        Coverage
      </h3>

      <p>
        Washington · Oregon · Idaho · Montana
      </p>

      <h3>
        Version
      </h3>

      <p>
        Client application
      </p>

    </div>

  `;

}


/* ======================================================
   ADMIN
====================================================== */

function renderAdmin() {

  if (!currentAccount?.admin) {

    $("drawerBody").innerHTML = `
      <p>Admin access required.</p>
    `;

    return;

  }


  const history =
    getLoginHistory();


  const successfulLogins =
    history.filter(
      item =>
        item.success
    );


  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <div class="admin-box">

        <h3>
          Account Summary
        </h3>

        <div class="admin-stat">
          13
        </div>

        <p>
          Total accounts
        </p>

      </div>


      <div class="admin-box">

        <h3>
          Login Activity
        </h3>

        <div class="admin-stat">
          ${successfulLogins.length}
        </div>

        <p>
          Successful logins recorded on this browser.
        </p>

      </div>


      <div class="admin-box">

        <h3>
          Send Notification
        </h3>

        <div class="admin-send">

          <select id="adminRecipient">

            <option value="ALL">
              All Users
            </option>

            ${Object.entries(ACCOUNTS)
              .filter(
                ([key, account]) =>
                  !account.admin
              )
              .map(
                ([key, account]) => `

                  <option value="${key}">
                    Account ${escapeHTML(
                      account.id
                    )}
                    -
                    ${escapeHTML(
                      getAccountNameByKey(key)
                    )}
                  </option>

                `
              )
              .join("")}

          </select>


          <input
            id="adminNotificationTitle"
            type="text"
            maxlength="80"
            placeholder="Notification title"
          >


          <textarea
            id="adminNotificationMessage"
            maxlength="500"
            placeholder="Notification message"
          ></textarea>


          <button
            id="adminSendNotification"
            type="button"
          >
            Send Notification
          </button>

        </div>

      </div>


      <div class="admin-box">

        <h3>
          Login History
        </h3>

        <div id="adminLoginHistory"></div>

      </div>

    </div>

  `;


  $("adminSendNotification").onclick =
    adminSendNotification;


  renderAdminLoginHistory();

}


function getAccountNameByKey(key) {

  const names =
    getNames();


  return names[key] ||
    ACCOUNTS[key]?.name ||
    "User";

}


function renderAdminLoginHistory() {

  const history =
    getLoginHistory();


  const container =
    $("adminLoginHistory");


  if (!history.length) {

    container.innerHTML = `
      <p>
        No login activity recorded.
      </p>
    `;

    return;

  }


  container.innerHTML =
    history
      .slice(0, 100)
      .map(
        item => `

          <div class="admin-log">

            <strong>
              Account ${escapeHTML(
                item.accountId
              )}
              ·
              ${escapeHTML(
                item.name
              )}
            </strong>

            <small>
              ${
                item.success
                  ? "Successful login"
                  : "Failed login"
              }
              ·
              ${escapeHTML(
                formatDate(
                  item.time
                )
              )}
            </small>

          </div>

        `
      )
      .join("");

}


function adminSendNotification() {

  if (!currentAccount?.admin) {

    toast("Admin access required.");

    return;

  }


  const recipient =
    $("adminRecipient").value;


  const title =
    $("adminNotificationTitle")
      .value
      .trim();


  const message =
    $("adminNotificationMessage")
      .value
      .trim();


  if (!title) {

    toast(
      "Enter a notification title."
    );

    return;

  }


  if (!message) {

    toast(
      "Enter a notification message."
    );

    return;

  }


  /*
    Send to every non-admin account.
  */

  if (recipient === "ALL") {

    Object.keys(ACCOUNTS)
      .filter(
        key =>
          !ACCOUNTS[key].admin
      )
      .forEach(
        key => {

          addNotificationForAccount(
            key,
            title,
            message
          );

        }
      );


    toast(
      "Notification sent to all users."
    );

  }

  else {

    if (!ACCOUNTS[recipient]) {

      toast("Invalid account.");

      return;

    }


    addNotificationForAccount(
      recipient,
      title,
      message
    );


    toast(
      `Notification sent to Account ${
        ACCOUNTS[recipient].id
      }.`
    );

  }


  $("adminNotificationTitle")
    .value = "";

  $("adminNotificationMessage")
    .value = "";

}


function addNotificationForAccount(
  accountKey,
  title,
  message
) {

  const storageKey =
    `parcelScope.notifications.${accountKey}`;


  const notifications =
    getJSON(
      storageKey,
      []
    );


  notifications.unshift({

    id:
      Date.now().toString() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2),

    title,

    message,

    time:
      new Date().toISOString(),

    read: false

  });


  setJSON(
    storageKey,
    notifications.slice(0, 100)
  );

}


/* ======================================================
   LOCATION
====================================================== */

function locateOnce() {

  if (
    !navigator.geolocation
  ) {

    toast(
      "Location is not available."
    );

    return;

  }


  toast(
    "Finding your location..."
  );


  navigator.geolocation.getCurrentPosition(

    position => {

      const lat =
        position.coords.latitude;

      const lng =
        position.coords.longitude;


      map.setView(
        [lat, lng],
        16
      );


      coordinateLayer.clearLayers();


      L.circleMarker(
        [lat, lng],
        {
          radius: 8,
          weight: 2,
          fillOpacity: .8
        }
      )
      .bindPopup(
        "Your location"
      )
      .addTo(coordinateLayer)
      .openPopup();


      toast(
        "Location found."
      );

    },

    error => {

      if (error.code === 1) {

        toast(
          "Location permission was denied."
        );

      } else {

        toast(
          "Unable to find your location."
        );

      }

    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    }

  );

}


$("locateBtn").onclick =
  locateOnce;


function startFollowingLocation() {

  if (
    !navigator.geolocation
  ) {

    toast(
      "Location is not available."
    );

    return;

  }


  if (locationWatch !== null) {

    return;

  }


  followingLocation = true;


  locationWatch =
    navigator.geolocation.watchPosition(

      position => {

        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;


        coordinateLayer.clearLayers();


        L.circleMarker(
          [lat, lng],
          {
            radius: 8,
            weight: 2,
            fillOpacity: .8
          }
        )
        .addTo(coordinateLayer);


        map.setView(
          [lat, lng],
          Math.max(
            map.getZoom(),
            15
          ),
          {
            animate: true
          }
        );

      },

      () => {

        toast(
          "Unable to follow location."
        );

        stopFollowingLocation();

      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }

    );


  toast(
    "Location following enabled."
  );

}


function stopFollowingLocation() {

  if (
    locationWatch !== null
  ) {

    navigator.geolocation.clearWatch(
      locationWatch
    );

  }


  locationWatch = null;

  followingLocation = false;

}


/* ======================================================
   SEARCH
====================================================== */

$("searchBtn").onclick =
  searchProperties;


$("searchInput").addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      searchProperties();

    }

  }
);


async function searchProperties() {

  const query =
    $("searchInput")
      .value
      .trim();


  const state =
    $("stateSelect")
      .value;


  if (!query) {

    toast(
      "Enter an address, owner or parcel ID."
    );

    return;

  }


  /*
    First try parcel GIS sources.
  */

  const results =
    await searchGIS(
      query,
      state
    );


  if (results.length) {

    showSearchResults(results);

    return;

  }


  /*
    If no GIS endpoint has been configured,
    provide a useful map search fallback.
  */

  await fallbackAddressSearch(
    query,
    state
  );

}


/* ======================================================
   GIS SEARCH
====================================================== */

async function searchGIS(
  query,
  state
) {

  const sources =
    getSourcesForState(state);


  const output = [];


  for (
    const source of sources
  ) {

    try {

      const url =
        buildFeatureServerSearchURL(
          source,
          query
        );


      const response =
        await fetch(url);


      if (!response.ok) {
        continue;
      }


      const data =
        await response.json();


      if (
        !Array.isArray(
          data.features
        )
      ) {

        continue;

      }


      data.features.forEach(
        feature => {

          output.push(
            normalizeFeature(
              feature,
              source
            )
          );

        }
      );

    }

    catch (error) {

      console.warn(
        "GIS search failed:",
        error
      );

    }

  }


  return output;

}


function getSourcesForState(state) {

  if (state === "ALL") {

    return Object.values(
      STATE_SOURCES
    ).flat();

  }


  return STATE_SOURCES[state] || [];

}


function buildFeatureServerSearchURL(
  source,
  query
) {

  const fields =
    Object.values(
      source.fields || {}
    )
      .flat()
      .filter(Boolean);


  const whereParts =
    fields.map(
      field =>
        `UPPER(${field}) LIKE UPPER('%${escapeSQL(query)}%')`
    );


  const where =
    whereParts.length
      ? whereParts.join(" OR ")
      : "1=1";


  const params =
    new URLSearchParams({

      where,

      outFields: "*",

      returnGeometry: "true",

      f: "json",

      resultRecordCount: "50"

    });


  return (
    source.url +
    "?" +
    params.toString()
  );

}


function escapeSQL(value) {

  return String(value)
    .replaceAll("'", "''");

}


function normalizeFeature(
  feature,
  source
) {

  const attributes =
    feature.attributes || {};


  const fields =
    source.fields || {};


  const readField =
    names => {

      for (
        const name of names || []
      ) {

        if (
          attributes[name] !==
          undefined &&
          attributes[name] !==
          null
        ) {

          return attributes[name];

        }

      }

      return null;

    };


  let lat = null;
  let lng = null;


  if (
    feature.geometry
  ) {

    if (
      feature.geometry.x !==
      undefined
    ) {

      lng =
        feature.geometry.x;

      lat =
        feature.geometry.y;

    }

    else if (
      feature.geometry.latitude !==
      undefined
    ) {

      lat =
        feature.geometry.latitude;

      lng =
        feature.geometry.longitude;

    }

  }


  return {

    parcelId:
      readField(
        fields.parcelId
      ) ||
      attributes.OBJECTID ||
      cryptoRandomId(),

    owner:
      readField(
        fields.owner
      ),

    address:
      readField(
        fields.address
      ),

    county:
      readField(
        fields.county
      ),

    acres:
      readField(
        fields.acres
      ),

    value:
      readField(
        fields.value
      ),

    state:
      source.state,

    lat,

    lng,

    geometry:
      feature.geometry || null

  };

}


function cryptoRandomId() {

  return (
    "parcel-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


/* ======================================================
   FALLBACK ADDRESS SEARCH
====================================================== */

async function fallbackAddressSearch(
  query,
  state
) {

  let searchQuery =
    query;


  if (state !== "ALL") {

    searchQuery +=
      `, ${state}`;

  }


  try {

    const params =
      new URLSearchParams({

        q: searchQuery,

        format: "json",

        limit: "10",

        addressdetails: "1"

      });


    const response =
      await fetch(
        "https://nominatim.openstreetmap.org/search?" +
        params.toString(),
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "Address search failed"
      );

    }


    const data =
      await response.json();


    const results =
      data.map(
        item => ({

          parcelId:
            "address-" +
            item.place_id,

          address:
            item.display_name,

          owner:
            null,

          county:
            item.address?.county ||
            null,

          acres:
            null,

          value:
            null,

          state:
            state !== "ALL"
              ? state
              : null,

          lat:
            Number(item.lat),

          lng:
            Number(item.lon),

          geometry:
            null

        })
      );


    if (!results.length) {

      toast(
        "No results found."
      );

      return;

    }


    showSearchResults(
      results
    );

  }

  catch (error) {

    console.error(error);

    toast(
      "Search is temporarily unavailable."
    );

  }

}


/* ======================================================
   SEARCH RESULTS UI
====================================================== */

function showSearchResults(results) {

  $("results")
    .classList
    .remove("hidden");


  $("resultsBody").innerHTML =
    results
      .map(
        (property, index) => `

          <button
            class="result"
            data-search-result="${index}"
            type="button"
          >

            <strong>
              ${escapeHTML(
                property.address ||
                property.parcelId
              )}
            </strong>

            <small>

              ${
                property.owner
                  ? escapeHTML(
                      property.owner
                    ) + " · "
                  : ""
              }

              ${
                property.county
                  ? escapeHTML(
                      property.county
                    ) + " · "
                  : ""
              }

              ${
                property.state
                  ? escapeHTML(
                      property.state
                    )
                  : ""
              }

            </small>

          </button>

        `
      )
      .join("");


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
          false
        );

      };

    });

}


/* ======================================================
   PARCEL SELECTION
====================================================== */

function selectParcel(
  property,
  fromSaved
) {

  selectedParcel =
    property;


  addRecent(property);


  selectedLayer.clearLayers();


  if (
    property.geometry
  ) {

    drawGeometry(
      property.geometry
    );

  }


  if (
    Number.isFinite(
      property.lat
    ) &&
    Number.isFinite(
      property.lng
    )
  ) {

    const marker =
      L.circleMarker(
        [
          property.lat,
          property.lng
        ],
        {
          radius: 8,
          weight: 3,
          fillOpacity: .4
        }
      );


    marker.addTo(
      selectedLayer
    );


    map.setView(
      [
        property.lat,
        property.lng
      ],
      Math.max(
        map.getZoom(),
        15
      )
    );

  }


  $("propertyTitle")
    .textContent =
      property.address ||
      property.parcelId ||
      "Property";


  $("propertyBody").innerHTML = `

    <div class="field">

      <b>
        Parcel ID
      </b>

      ${escapeHTML(
        property.parcelId
      )}

    </div>


    <div class="field">

      <b>
        Address
      </b>

      ${escapeHTML(
        property.address
      )}

    </div>


    <div class="field">

      <b>
        Owner
      </b>

      ${escapeHTML(
        property.owner
      )}

    </div>


    <div class="field">

      <b>
        County
      </b>

      ${escapeHTML(
        property.county
      )}

    </div>


    <div class="field">

      <b>
        State
      </b>

      ${escapeHTML(
        property.state
      )}

    </div>


    <div class="field">

      <b>
        Acres
      </b>

      ${escapeHTML(
        property.acres
      )}

    </div>


    <div class="field">

      <b>
        Assessed Value
      </b>

      ${escapeHTML(
        property.value
      )}

    </div>

  `;


  $("saveBtn").textContent =
    isSaved(property)
      ? "Remove Saved Property"
      : "Save Property";


  $("property")
    .classList
    .remove("hidden");

}


function drawGeometry(
  geometry
) {

  try {

    if (
      geometry.rings
    ) {

      L.polygon(
        geometry.rings.map(
          ring =>
            ring.map(
              point =>
                [
                  point[1],
                  point[0]
                ]
            )
        ),
        {
          weight: 3,
          fillOpacity: .15
        }
      )
      .addTo(selectedLayer);

    }

    else if (
      geometry.paths
    ) {

      geometry.paths.forEach(
        path => {

          L.polyline(
            path.map(
              point =>
                [
                  point[1],
                  point[0]
                ]
            ),
            {
              weight: 3
            }
          )
          .addTo(selectedLayer);

        }
      );

    }

  }

  catch (error) {

    console.warn(
      "Could not draw parcel geometry:",
      error
    );

  }

}


/* ======================================================
   PROPERTY BUTTONS
====================================================== */

$("saveBtn").onclick =
  () => {

    if (
      selectedParcel
    ) {

      toggleSave(
        selectedParcel
      );

    }

  };


$("shareBtn").onclick =
  async () => {

    if (
      !selectedParcel
    ) {

      return;

    }


    const params =
      new URLSearchParams({

        parcel:
          selectedParcel.parcelId || "",

        lat:
          selectedParcel.lat || "",

        lng:
          selectedParcel.lng || ""

      });


    const url =
      location.origin +
      location.pathname +
      "?" +
      params.toString();


    try {

      if (
        navigator.share
      ) {

        await navigator.share({

          title:
            "ParcelScope Property",

          text:
            selectedParcel.address ||
            selectedParcel.parcelId,

          url

        });

      }

      else if (
        navigator.clipboard
      ) {

        await navigator.clipboard.writeText(
          url
        );

        toast(
          "Parcel link copied."
        );

      }

      else {

        toast(
          "Share is not available."
        );

      }

    }

    catch {

      /*
        User cancelled share.
      */

    }

  };


$("mapsBtn").onclick =
  () => {

    if (
      !selectedParcel
    ) {

      return;

    }


    $("mapsModal")
      .classList
      .remove("hidden");

  };


$("mapsClose").onclick =
  () => {

    $("mapsModal")
      .classList
      .add("hidden");

  };


$("mapsCancel").onclick =
  () => {

    $("mapsModal")
      .classList
      .add("hidden");

  };


function getPropertyCoordinates() {

  if (
    selectedParcel &&
    Number.isFinite(
      Number(
        selectedParcel.lat
      )
    ) &&
    Number.isFinite(
      Number(
        selectedParcel.lng
      )
    )
  ) {

    return {

      lat:
        Number(
          selectedParcel.lat
        ),

      lng:
        Number(
          selectedParcel.lng
        )

    };

  }


  return null;

}


$("googleBtn").onclick =
  () => {

    const coords =
      getPropertyCoordinates();


    if (!coords) {

      toast(
        "This property has no map coordinates."
      );

      return;

    }


    const url =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(
        `${coords.lat},${coords.lng}`
      );


    window.open(
      url,
      "_blank",
      "noopener"
    );


    $("mapsModal")
      .classList
      .add("hidden");

  };


$("appleBtn").onclick =
  () => {

    const coords =
      getPropertyCoordinates();


    if (!coords) {

      toast(
        "This property has no map coordinates."
      );

      return;

    }


    const url =
      "https://maps.apple.com/?ll=" +
      encodeURIComponent(
        `${coords.lat},${coords.lng}`
      );


    window.open(
      url,
      "_blank",
      "noopener"
    );


    $("mapsModal")
      .classList
      .add("hidden");

  };


/* ======================================================
   MEASURE
====================================================== */

function startMeasure() {

  measureMode = true;

  measurePoints = [];

  measureLayer.clearLayers();

  measureLine = null;

  $("measureValue")
    .textContent =
      "0 ft";

  $("measure")
    .classList
    .remove("hidden");


  map.getContainer()
    .classList
    .add("measuring");


  toast(
    "Tap the map to measure."
  );

}


function stopMeasure() {

  measureMode = false;

  measurePoints = [];

  measureLine = null;

  measureLayer.clearLayers();

  $("measure")
    .classList
    .add("hidden");

  map.getContainer()
    .classList
    .remove("measuring");

}


function clearMeasure() {

  measurePoints = [];

  measureLayer.clearLayers();

  measureLine = null;

  $("measureValue")
    .textContent =
      "0 ft";

}


$("finishMeasure").onclick =
  () => {

    if (
      measurePoints.length >= 2
    ) {

      toast(
        "Measurement finished."
      );

    }

    stopMeasure();

  };


$("clearMeasure").onclick =
  clearMeasure;


map.on(
  "click",
  event => {

    if (
      !measureMode
    ) {

      return;

    }


    measurePoints.push(
      event.latlng
    );


    L.circleMarker(
      event.latlng,
      {
        radius: 5,
        weight: 2,
        fillOpacity: .8
      }
    )
    .addTo(measureLayer);


    if (
      measurePoints.length >= 2
    ) {

      if (measureLine) {

        measureLayer.removeLayer(
          measureLine
        );

      }


      measureLine =
        L.polyline(
          measurePoints,
          {
            weight: 3
          }
        )
        .addTo(
          measureLayer
        );


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


      updateMeasureDisplay(
        meters
      );

    }

  }
);


function updateMeasureDisplay(
  meters
) {

  const feet =
    meters *
    3.280839895;


  if (
    feet < 5280
  ) {

    $("measureValue")
      .textContent =
        `${Math.round(feet)} ft`;

  }

  else {

    $("measureValue")
      .textContent =
        `${(
          feet / 5280
        ).toFixed(2)} mi`;

  }

}


/* ======================================================
   MAP MOVEMENT
====================================================== */

map.on(
  "mousemove",
  event => {

    $("coords").textContent =
      `${event.latlng.lat.toFixed(6)}, ` +
      `${event.latlng.lng.toFixed(6)}`;

  }
);


map.on(
  "zoomend",
  () => {

    if (
      parcelsEnabled &&
      map.getZoom() >= PARCEL_ZOOM
    ) {

      loadVisibleParcels();

    }

  }
);


/* ======================================================
   PARCEL LOADING
====================================================== */

async function loadVisibleParcels() {

  const bounds =
    map.getBounds();


  const state =
    $("stateSelect").value;


  const sources =
    getSourcesForState(state);


  if (!sources.length) {

    /*
      No parcel endpoint configured yet.
    */

    return;

  }


  parcelLayer.clearLayers();


  for (
    const source of sources
  ) {

    try {

      const params =
        new URLSearchParams({

          where: "1=1",

          geometry:
            [
              bounds.getWest(),
              bounds.getSouth(),
              bounds.getEast(),
              bounds.getNorth()
            ].join(","),

          geometryType:
            "esriGeometryEnvelope",

          inSR: "4326",

          spatialRel:
            "esriSpatialRelIntersects",

          outFields: "*",

          returnGeometry:
            "true",

          f: "json",

          resultRecordCount:
            "1000"

        });


      const response =
        await fetch(
          source.url +
          "?" +
          params.toString()
        );


      if (!response.ok) {

        continue;

      }


      const data =
        await response.json();


      if (
        !Array.isArray(
          data.features
        )
      ) {

        continue;

      }


      data.features.forEach(
        feature => {

          drawParcelFeature(
            feature,
            source
          );

        }
      );

    }

    catch (error) {

      console.warn(
        "Parcel loading failed:",
        error
      );

    }

  }

}


function drawParcelFeature(
  feature,
  source
) {

  if (
    !feature.geometry
  ) {

    return;

  }


  const property =
    normalizeFeature(
      feature,
      source
    );


  let layer = null;


  if (
    feature.geometry.rings
  ) {

    layer =
      L.polygon(
        feature.geometry.rings.map(
          ring =>
            ring.map(
              point =>
                [
                  point[1],
                  point[0]
                ]
            )
        ),
        {
          weight: 1,
          fillOpacity: .05
        }
      );

  }


  if (!layer) {

    return;

  }


  layer.on(
    "click",
    () => {

      selectParcel(
        property,
        false
      );

    }
  );


  layer.addTo(
    parcelLayer
  );

}


/* ======================================================
   URL PROPERTY OPEN
====================================================== */

async function openURLParcel() {

  const params =
    new URLSearchParams(
      location.search
    );


  const parcelId =
    params.get("parcel");


  if (!parcelId) {

    return;

  }


  const lat =
    Number(
      params.get("lat")
    );


  const lng =
    Number(
      params.get("lng")
    );


  const property = {

    parcelId,

    address:
      "Shared Parcel",

    owner:
      null,

    county:
      null,

    acres:
      null,

    value:
      null,

    state:
      null,

    lat:
      Number.isFinite(lat)
        ? lat
        : null,

    lng:
      Number.isFinite(lng)
        ? lng
        : null

  };


  selectParcel(
    property,
    false
  );

}


/* ======================================================
   MAP CLICK / COORDINATES
====================================================== */

map.on(
  "dblclick",
  event => {

    $("coords").textContent =
      `${event.latlng.lat.toFixed(6)}, ` +
      `${event.latlng.lng.toFixed(6)}`;

    $("coords")
      .classList
      .remove("hidden");

    clearTimeout(
      map.coordinateTimer
    );

    map.coordinateTimer =
      setTimeout(
        () => {

          $("coords")
            .classList
            .add("hidden");

        },
        3000
      );

  }
);


/* ======================================================
   INITIALIZATION
====================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    restoreSession();

    openURLParcel();

  }
);


/*
==========================================================
SECURITY / ARCHITECTURE NOTE
==========================================================

This is intentionally a static/client-only implementation.

The passwords are visible in the JavaScript source.
They are therefore NOT secure authentication credentials.

The account separation is useful for a small private
friend group where the purpose is separating saved data,
names and local settings.

For actual cross-device behavior:

- login history must be stored server-side
- notifications must be stored server-side
- admin messages must be pushed/server-stored
- saved properties must be stored server-side
- passwords must be hashed server-side

That requires a backend such as Cloudflare Workers + D1,
Cloudflare Access, Firebase, Supabase, etc.

The current version does not pretend that localStorage
can synchronize information between different devices.
==========================================================
*/
