/* =========================================================
   PARCELSCOPE
   Complete static Cloudflare version

   13 accounts:
   1 admin
   12 users

   ADMIN:
   4821

   USERS:
   7354
   1968
   5247
   8036
   2419
   6713
   9582
   3146
   8605
   4278
   5931
   7049
========================================================= */


/* =========================================================
   ACCOUNT DATABASE
========================================================= */

const ACCOUNTS = {

  "4821": {
    id: "admin",
    name: "User",
    admin: true
  },

  "7354": {
    id: "user1",
    name: "User",
    admin: false
  },

  "1968": {
    id: "user2",
    name: "User",
    admin: false
  },

  "5247": {
    id: "user3",
    name: "User",
    admin: false
  },

  "8036": {
    id: "user4",
    name: "User",
    admin: false
  },

  "2419": {
    id: "user5",
    name: "User",
    admin: false
  },

  "6713": {
    id: "user6",
    name: "User",
    admin: false
  },

  "9582": {
    id: "user7",
    name: "User",
    admin: false
  },

  "3146": {
    id: "user8",
    name: "User",
    admin: false
  },

  "8605": {
    id: "user9",
    name: "User",
    admin: false
  },

  "4278": {
    id: "user10",
    name: "User",
    admin: false
  },

  "5931": {
    id: "user11",
    name: "User",
    admin: false
  },

  "7049": {
    id: "user12",
    name: "User",
    admin: false
  }

};


/* =========================================================
   GLOBAL STATE
========================================================= */

const PARCEL_ZOOM = 10;

const NORTHWEST_CENTER = [
  46.1,
  -116.7
];

let currentAccount = null;

let selectedProperty = null;

let map = null;

let satellite = null;

let street = null;

let markerLayer = null;

let measureLayer = null;

let measureMode = false;

let measurePoints = [];

let measureLine = null;

let locationMarker = null;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function toast(message) {

  const element = $("toast");

  element.textContent = message;

  element.classList.remove("hidden");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    element.classList.add("hidden");

  }, 2600);

}


/* =========================================================
   STORAGE KEYS
========================================================= */

function accountKey() {

  return currentAccount
    ? currentAccount.id
    : "none";

}


function storageKey(type) {

  return `parcelScope.${type}.${accountKey()}`;

}


/* =========================================================
   JSON STORAGE
========================================================= */

function readJSON(key, fallback) {

  try {

    const value =
      localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);

  } catch {

    return fallback;

  }

}


function writeJSON(key, value) {

  localStorage.setItem(
    key,
    JSON.stringify(value)
  );

}


/* =========================================================
   LOGIN
========================================================= */

function login() {

  const password =
    $("passwordInput").value.trim();

  $("loginError")
    .classList
    .add("hidden");


  if (!/^\d{4}$/.test(password)) {

    showLoginError();

    return;

  }


  const account =
    ACCOUNTS[password];


  if (!account) {

    showLoginError();

    return;

  }


  currentAccount = {

    password: password,

    id: account.id,

    name:
      getAccountName(account.id) ||
      account.name,

    admin: account.admin

  };


  sessionStorage.setItem(
    "parcelScope.currentAccount",
    JSON.stringify(currentAccount)
  );


  recordLogin();


  showApplication();


  $("passwordInput").value = "";

}


function showLoginError() {

  $("loginError")
    .classList
    .remove("hidden");

  $("passwordInput").focus();

}


/* =========================================================
   LOGIN BUTTON
========================================================= */

$("loginBtn").addEventListener(
  "click",
  login
);


/* =========================================================
   ENTER KEY LOGIN
========================================================= */

$("passwordInput").addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      login();

    }

  }
);


/* =========================================================
   ACCOUNT NAME
========================================================= */

function getAccountName(id) {

  return localStorage.getItem(
    `parcelScope.name.${id}`
  );

}


function saveAccountName(name) {

  localStorage.setItem(
    `parcelScope.name.${currentAccount.id}`,
    name
  );

  currentAccount.name = name;

  sessionStorage.setItem(
    "parcelScope.currentAccount",
    JSON.stringify(currentAccount)
  );

}


/* =========================================================
   LOGIN HISTORY
========================================================= */

function getLoginHistory() {

  return readJSON(
    "parcelScope.loginHistory",
    []
  );

}


function recordLogin() {

  const history =
    getLoginHistory();

  const cutoff =
    Date.now() -
    (30 * 24 * 60 * 60 * 1000);


  const cleaned =
    history.filter(
      entry =>
        new Date(entry.time).getTime() >=
        cutoff
    );


  cleaned.unshift({

    accountId: currentAccount.id,

    accountName:
      currentAccount.name,

    admin:
      currentAccount.admin,

    time:
      new Date().toISOString()

  });


  writeJSON(
    "parcelScope.loginHistory",
    cleaned.slice(0, 500)
  );

}


/* =========================================================
   APPLICATION DISPLAY
========================================================= */

function showApplication() {

  $("loginScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");


  $("menuAccountName")
    .textContent =
      currentAccount.name;


  if (currentAccount.admin) {

    $("adminMenuButton")
      .classList
      .remove("hidden");

  } else {

    $("adminMenuButton")
      .classList
      .add("hidden");

  }


  initializeMap();

  updateNotificationDot();

}


/* =========================================================
   SESSION RESTORE
========================================================= */

function restoreSession() {

  const saved =
    sessionStorage.getItem(
      "parcelScope.currentAccount"
    );


  if (!saved) {

    $("loginScreen")
      .classList
      .remove("hidden");

    return;

  }


  try {

    const account =
      JSON.parse(saved);

    const realAccount =
      ACCOUNTS[account.password];


    if (!realAccount) {

      sessionStorage.clear();

      return;

    }


    currentAccount = {

      password:
        account.password,

      id:
        realAccount.id,

      name:
        getAccountName(realAccount.id) ||
        "User",

      admin:
        realAccount.admin

    };


    showApplication();

  } catch {

    sessionStorage.clear();

  }

}


restoreSession();


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  currentAccount = null;

  selectedProperty = null;

  sessionStorage.removeItem(
    "parcelScope.currentAccount"
  );


  $("app")
    .classList
    .add("hidden");


  $("loginScreen")
    .classList
    .remove("hidden");


  $("menu")
    .classList
    .add("hidden");


  $("drawer")
    .classList
    .add("hidden");


  $("property")
    .classList
    .add("hidden");


  $("results")
    .classList
    .add("hidden");


  $("passwordInput").value = "";

  $("passwordInput").focus();

}


$("logoutBtn").addEventListener(
  "click",
  logout
);


/* =========================================================
   MAP
========================================================= */

function initializeMap() {

  if (map) {

    setTimeout(
      () => map.invalidateSize(),
      100
    );

    return;

  }


  map = L.map("map", {

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


  satellite =
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles © Esri"
      }
    );


  street =
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          "© OpenStreetMap contributors"
      }
    );


  satellite.addTo(map);


  markerLayer =
    L.layerGroup().addTo(map);


  measureLayer =
    L.layerGroup().addTo(map);


  map.on(
    "click",
    handleMapClick
  );


  map.on(
    "mousemove",
    event => {

      if (!measureMode) {
        return;
      }

      $("coords").textContent =
        `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;

    }
  );

}


/* =========================================================
   MENU
========================================================= */

$("menuBtn").addEventListener(
  "click",
  () => {

    $("menu")
      .classList
      .remove("hidden");

  }
);


$("closeMenu").addEventListener(
  "click",
  () => {

    $("menu")
      .classList
      .add("hidden");

  }
);


/* =========================================================
   MENU PAGES
========================================================= */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        openPage(
          button.dataset.page
        );

      }
    );

  });


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


  if (
    page === "admin" &&
    !currentAccount?.admin
  ) {

    toast("Admin access only.");

    return;

  }


  $("drawerTitle").textContent =
    titles[page] || page;


  $("drawer")
    .classList
    .remove("hidden");


  if (page === "saved") {
    renderSaved();
  }

  if (page === "recent") {
    renderRecent();
  }

  if (page === "notifications") {
    renderNotifications();
  }

  if (page === "layers") {
    renderLayers();
  }

  if (page === "measure") {

    closeDrawer();

    startMeasure();

  }

  if (page === "settings") {
    renderSettings();
  }

  if (page === "about") {
    renderAbout();
  }

  if (page === "admin") {
    renderAdmin();
  }

}


$("drawerClose").addEventListener(
  "click",
  closeDrawer
);


function closeDrawer() {

  $("drawer")
    .classList
    .add("hidden");

}


/* =========================================================
   SAVED PROPERTIES
========================================================= */

function getSaved() {

  return readJSON(
    storageKey("saved"),
    []
  );

}


function setSaved(properties) {

  writeJSON(
    storageKey("saved"),
    properties
  );

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
            data-saved-index="${index}"
            type="button"
          >

            <strong>
              ${escapeHTML(
                property.address ||
                "Saved Location"
              )}
            </strong>

            <small>
              ${escapeHTML(
                property.state || ""
              )}
              ·
              ${escapeHTML(
                property.lat
              )},
              ${escapeHTML(
                property.lng
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-saved-index]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const property =
            properties[
              Number(
                button.dataset.savedIndex
              )
            ];

          closeDrawer();

          selectProperty(
            property,
            true
          );

        }
      );

    });

}


/* =========================================================
   SAVE PROPERTY
========================================================= */

function saveCurrentProperty() {

  if (!selectedProperty) {

    return;

  }


  const saved =
    getSaved();


  const alreadySaved =
    saved.some(
      property =>
        property.key ===
        selectedProperty.key
    );


  if (alreadySaved) {

    toast("Property is already saved.");

    return;

  }


  saved.unshift(
    selectedProperty
  );


  setSaved(saved);


  toast("Property saved.");

}


/* =========================================================
   RECENT
========================================================= */

function getRecent() {

  return readJSON(
    storageKey("recent"),
    []
  );

}


function addRecent(property) {

  const recent =
    getRecent()
      .filter(
        item =>
          item.key !== property.key
      );


  recent.unshift(property);


  writeJSON(
    storageKey("recent"),
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
            data-recent-index="${index}"
            type="button"
          >

            <strong>
              ${escapeHTML(
                property.address ||
                "Recent Location"
              )}
            </strong>

            <small>
              ${escapeHTML(
                property.state || ""
              )}
            </small>

          </button>

        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-recent-index]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const property =
            recent[
              Number(
                button.dataset.recentIndex
              )
            ];

          closeDrawer();

          selectProperty(
            property,
            true
          );

        }
      );

    });

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function getNotifications() {

  const notifications =
    readJSON(
      storageKey("notifications"),
      []
    );


  const cutoff =
    Date.now() -
    (30 * 24 * 60 * 60 * 1000);


  return notifications.filter(
    notification =>
      new Date(
        notification.date
      ).getTime() >= cutoff
  );

}


function setNotifications(
  notifications
) {

  writeJSON(
    storageKey("notifications"),
    notifications
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
      `${Date.now()}-${Math.random()}`,

    title,

    message,

    date:
      new Date().toISOString()

  });


  setNotifications(
    notifications
  );

}


/* =========================================================
   NOTIFICATION DOT
========================================================= */

function updateNotificationDot() {

  if (!currentAccount) {
    return;
  }


  const unread =
    localStorage.getItem(
      `parcelScope.unread.${currentAccount.id}`
    ) === "1";


  $("redDot")
    .classList
    .toggle(
      "hidden",
      !unread
    );

}


function markNotificationsRead() {

  localStorage.setItem(
    `parcelScope.unread.${currentAccount.id}`,
    "0"
  );


  updateNotificationDot();

}


/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {

  markNotificationsRead();


  const notifications =
    getNotifications();


  let html = `
    <div class="menu-page">
  `;


  if (notifications.length) {

    html += `
      <button
        id="deleteAllNotifications"
        class="delete-all"
        type="button"
      >
        Delete All
      </button>
    `;


    html += notifications
      .map(
        notification => `

          <div
            class="notification"
          >

            <button
              class="notification-delete"
              data-delete-notification="${escapeHTML(
                notification.id
              )}"
              type="button"
              aria-label="Delete notification"
            >
              ×
            </button>

            <div class="notification-title">
              ${escapeHTML(
                notification.title
              )}
            </div>

            <div class="notification-message">
              ${escapeHTML(
                notification.message
              )}
            </div>

            <div class="notification-date">
              ${formatDate(
                notification.date
              )}
            </div>

          </div>

        `
      )
      .join("");

  } else {

    html += `
      <p>
        No notifications.
      </p>
    `;

  }


  html += `
    </div>
  `;


  $("drawerBody").innerHTML =
    html;


  const deleteAll =
    $("deleteAllNotifications");


  if (deleteAll) {

    deleteAll.addEventListener(
      "click",
      () => {

        setNotifications([]);

        renderNotifications();

        toast(
          "All notifications deleted."
        );

      }
    );

  }


  document
    .querySelectorAll(
      "[data-delete-notification]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset
              .deleteNotification;


          const remaining =
            getNotifications()
              .filter(
                item =>
                  item.id !== id
              );


          setNotifications(
            remaining
          );


          renderNotifications();

        }
      );

    });

}


/* =========================================================
   LAYERS
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
        <span>Location Marker</span>
        <input
          id="locationToggle"
          type="checkbox"
          checked
        >
      </div>

    </div>

  `;


  $("satelliteRadio")
    .addEventListener(
      "change",
      () => {

        if (!map) {
          return;
        }

        if (
          map.hasLayer(street)
        ) {

          map.removeLayer(street);

        }

        if (
          !map.hasLayer(satellite)
        ) {

          satellite.addTo(map);

        }

      }
    );


  $("streetRadio")
    .addEventListener(
      "change",
      () => {

        if (!map) {
          return;
        }

        if (
          map.hasLayer(satellite)
        ) {

          map.removeLayer(satellite);

        }

        if (
          !map.hasLayer(street)
        ) {

          street.addTo(map);

        }

      }
    );


  $("locationToggle")
    .addEventListener(
      "change",
      event => {

        if (!locationMarker) {
          return;
        }


        if (event.target.checked) {

          locationMarker.addTo(map);

        } else {

          map.removeLayer(
            locationMarker
          );

        }

      }
    );

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

      <p>
        Change the name displayed for this account.
      </p>

      <input
        id="accountNameInput"
        class="admin-select"
        maxlength="40"
        value="${escapeHTML(
          currentAccount.name
        )}"
        placeholder="User"
      >

      <button
        id="saveNameButton"
        type="button"
      >
        Save Name
      </button>

      <h3>
        Account Information
      </h3>

      <div class="row">
        <span>Account</span>
        <strong>
          ${escapeHTML(
            currentAccount.id
          )}
        </strong>
      </div>

      <div class="row">
        <span>Access</span>
        <strong>
          ${
            currentAccount.admin
              ? "Admin"
              : "User"
          }
        </strong>
      </div>

    </div>

  `;


  $("saveNameButton")
    .addEventListener(
      "click",
      () => {

        const name =
          $("accountNameInput")
            .value
            .trim() || "User";


        saveAccountName(name);


        $("menuAccountName")
          .textContent =
            name;


        toast("Name saved.");

        renderSettings();

      }
    );

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
        ParcelScope is a private property research
        mapping application for Washington, Oregon,
        Idaho and Montana.
      </p>

      <h3>
        Current Account
      </h3>

      <p>
        ${escapeHTML(
          currentAccount.name
        )}
      </p>

      <h3>
        Data
      </h3>

      <p>
        Map imagery and address search are provided
        by the connected map services.
      </p>

    </div>

  `;

}


/* =========================================================
   ADMIN PAGE
========================================================= */

function renderAdmin() {

  if (!currentAccount?.admin) {

    return;

  }


  const history =
    getLoginHistory();


  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <div class="admin-box">

        <h3>
          Send Notification
        </h3>

        <select
          id="adminRecipient"
          class="admin-select"
        >

          <option value="ALL">
            All Users
          </option>

          ${Object.entries(ACCOUNTS)
            .filter(
              ([, account]) =>
                !account.admin
            )
            .map(
              ([password, account]) => `
                <option value="${password}">
                  ${escapeHTML(
                    getAccountName(
                      account.id
                    ) || "User"
                  )}
                  —
                  ${account.id}
                </option>
              `
            )
            .join("")}

        </select>

        <input
          id="adminNotificationTitle"
          class="admin-select"
          maxlength="80"
          placeholder="Notification title"
        >

        <textarea
          id="adminNotificationMessage"
          class="admin-text"
          maxlength="1000"
          placeholder="Notification message"
        ></textarea>

        <button
          id="adminSendNotification"
          class="admin-send"
          type="button"
        >
          Send Notification
        </button>

      </div>


      <div class="admin-box">

        <h3>
          Login Activity
        </h3>

        <p>
          Login history is kept for 30 days.
        </p>

        ${
          history.length
            ? history
                .map(
                  entry => `

                    <div class="login-record">

                      <strong>
                        ${escapeHTML(
                          entry.accountName
                        )}
                        ${
                          entry.admin
                            ? " — ADMIN"
                            : ""
                        }
                      </strong>

                      <small>
                        Account:
                        ${escapeHTML(
                          entry.accountId
                        )}
                        ·
                        ${formatDate(
                          entry.time
                        )}
                      </small>

                    </div>

                  `
                )
                .join("")
            : `
                <p>
                  No login activity yet.
                </p>
              `
        }

      </div>

    </div>

  `;


  $("adminSendNotification")
    .addEventListener(
      "click",
      adminSendNotification
    );

}


/* =========================================================
   ADMIN SEND NOTIFICATION
========================================================= */

function adminSendNotification() {

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


  if (!title || !message) {

    toast(
      "Enter a title and message."
    );

    return;

  }


  if (recipient === "ALL") {

    Object.values(ACCOUNTS)
      .filter(
        account =>
          !account.admin
      )
      .forEach(
        account => {

          sendToAccount(
            account.id,
            title,
            message
          );

        }
      );


    toast(
      "Notification sent to all users."
    );

  } else {

    const account =
      ACCOUNTS[recipient];


    if (!account) {

      toast(
        "Account not found."
      );

      return;

    }


    sendToAccount(
      account.id,
      title,
      message
    );


    toast(
      "Notification sent."
    );

  }


  $("adminNotificationTitle")
    .value = "";


  $("adminNotificationMessage")
    .value = "";

}


function sendToAccount(
  accountId,
  title,
  message
) {

  const notifications =
    readJSON(
      `parcelScope.notifications.${accountId}`,
      []
    );


  notifications.unshift({

    id:
      `${Date.now()}-${Math.random()}`,

    title,

    message,

    date:
      new Date().toISOString()

  });


  const cutoff =
    Date.now() -
    (30 * 24 * 60 * 60 * 1000);


  const cleaned =
    notifications.filter(
      notification =>
        new Date(
          notification.date
        ).getTime() >= cutoff
    );


  writeJSON(
    `parcelScope.notifications.${accountId}`,
    cleaned
  );


  localStorage.setItem(
    `parcelScope.unread.${accountId}`,
    "1"
  );

}


/* =========================================================
   SEARCH
========================================================= */

$("searchBtn")
  .addEventListener(
    "click",
    searchAddress
  );


$("searchInput")
  .addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        searchAddress();

      }

    }
  );


async function searchAddress() {

  const query =
    $("searchInput")
      .value
      .trim();


  if (!query) {

    toast(
      "Enter an address to search."
    );

    return;

  }


  const state =
    $("stateSelect").value;


  const finalQuery =
    state === "ALL"
      ? query
      : `${query}, ${state}`;


  $("searchBtn").disabled =
    true;


  $("searchBtn").textContent =
    "Searching...";


  try {

    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({

        q: finalQuery,

        format: "json",

        limit: "8",

        addressdetails: "1"

      });


    const response =
      await fetch(url, {
        headers: {
          "Accept":
            "application/json"
        }
      });


    if (!response.ok) {

      throw new Error(
        "Search request failed."
      );

    }


    const results =
      await response.json();


    renderSearchResults(
      results
    );

  } catch (error) {

    console.error(error);

    toast(
      "Search failed. Please try again."
    );

  } finally {

    $("searchBtn").disabled =
      false;

    $("searchBtn").textContent =
      "Search";

  }

}


/* =========================================================
   SEARCH RESULTS
========================================================= */

function renderSearchResults(
  results
) {

  if (!results.length) {

    $("resultsBody").innerHTML = `
      <p>
        No results found.
      </p>
    `;

    $("results")
      .classList
      .remove("hidden");

    return;

  }


  $("resultsBody").innerHTML =
    results
      .map(
        (result, index) => `

          <button
            class="result"
            data-search-result="${index}"
            type="button"
          >

            <strong>
              ${escapeHTML(
                result.display_name
              )}
            </strong>

            <small>
              ${escapeHTML(
                result.type ||
                "Location"
              )}
            </small>

          </button>

        `
      )
      .join("");


  $("results")
    .classList
    .remove("hidden");


  document
    .querySelectorAll(
      "[data-search-result]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const result =
            results[
              Number(
                button.dataset
                  .searchResult
              )
            ];


          const property = {

            key:
              `${result.lat},${result.lon}`,

            address:
              result.display_name,

            state:
              result.address?.state ||
              "",

            county:
              result.address?.county ||
              "",

            parcelId:
              "",

            lat:
              Number(result.lat),

            lng:
              Number(result.lon)

          };


          $("results")
            .classList
            .add("hidden");


          selectProperty(
            property,
            true
          );

        }
      );

    });

}


/* =========================================================
   SELECT PROPERTY
========================================================= */

function selectProperty(
  property,
  flyTo = false
) {

  selectedProperty =
    property;


  markerLayer.clearLayers();


  const marker =
    L.marker([
      property.lat,
      property.lng
    ]);


  marker.bindPopup(
    `<strong>${escapeHTML(
      property.address ||
      "Selected Location"
    )}</strong>`
  );


  marker.addTo(
    markerLayer
  );


  if (flyTo) {

    map.flyTo(
      [
        property.lat,
        property.lng
      ],
      Math.max(
        map.getZoom(),
        15
      ),
      {
        duration: 1
      }
    );

  }


  $("propertyTitle")
    .textContent =
      property.address ||
      "Selected Location";


  $("propertyBody").innerHTML = `

    <div class="field">

      <b>Address</b>

      ${escapeHTML(
        property.address ||
        "Currently unavailable"
      )}

    </div>

    <div class="field">

      <b>County</b>

      ${escapeHTML(
        property.county ||
        "Currently unavailable"
      )}

    </div>

    <div class="field">

      <b>State</b>

      ${escapeHTML(
        property.state ||
        "Currently unavailable"
      )}

    </div>

    <div class="field">

      <b>Parcel ID</b>

      ${escapeHTML(
        property.parcelId ||
        "Currently unavailable"
      )}

    </div>

    <div class="field">

      <b>Coordinates</b>

      ${property.lat.toFixed(6)},
      ${property.lng.toFixed(6)}

    </div>

  `;


  $("property")
    .classList
    .remove("hidden");


  addRecent(property);

}


/* =========================================================
   PROPERTY CLOSE
========================================================= */

$("propertyClose")
  .addEventListener(
    "click",
    () => {

      $("property")
        .classList
        .add("hidden");

      selectedProperty =
        null;

    }
  );


/* =========================================================
   SAVE
========================================================= */

$("saveBtn")
  .addEventListener(
    "click",
    saveCurrentProperty
  );


/* =========================================================
   SHARE
========================================================= */

$("shareBtn")
  .addEventListener(
    "click",
    async () => {

      if (!selectedProperty) {
        return;
      }


      const url =
        `${location.origin}${location.pathname}` +
        `?lat=${encodeURIComponent(
          selectedProperty.lat
        )}` +
        `&lng=${encodeURIComponent(
          selectedProperty.lng
        )}`;


      try {

        await navigator.clipboard.writeText(
          url
        );

        toast(
          "Property link copied."
        );

      } catch {

        toast(
          "Unable to copy link."
        );

      }

    }
  );


/* =========================================================
   MAPS
========================================================= */

$("mapsBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedProperty) {
        return;
      }

      $("mapsModal")
        .classList
        .remove("hidden");

    }
  );


$("mapsClose")
  .addEventListener(
    "click",
    closeMapsModal
  );


$("mapsCancel")
  .addEventListener(
    "click",
    closeMapsModal
  );


function closeMapsModal() {

  $("mapsModal")
    .classList
    .add("hidden");

}


$("googleBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedProperty) {
        return;
      }


      const url =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
          `${selectedProperty.lat},${selectedProperty.lng}`
        );


      window.open(
        url,
        "_blank"
      );

    }
  );


$("appleBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedProperty) {
        return;
      }


      const url =
        "https://maps.apple.com/?ll=" +
        encodeURIComponent(
          `${selectedProperty.lat},${selectedProperty.lng}`
        );


      window.open(
        url,
        "_blank"
      );

    }
  );


/* =========================================================
   LOCATE
========================================================= */

$("locateBtn")
  .addEventListener(
    "click",
    locateUser
  );


function locateUser() {

  if (!navigator.geolocation) {

    toast(
      "Location is not supported."
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


      if (
        locationMarker &&
        map.hasLayer(locationMarker)
      ) {

        map.removeLayer(
          locationMarker
        );

      }


      locationMarker =
        L.circleMarker(
          [lat, lng],
          {
            radius: 8
          }
        );


      locationMarker.addTo(
        map
      );


      map.flyTo(
        [lat, lng],
        16,
        {
          duration: 1
        }
      );


      toast(
        "Location found."
      );

    },

    error => {

      console.error(error);

      toast(
        "Unable to get your location."
      );

    },

    {
      enableHighAccuracy: true,

      timeout: 10000,

      maximumAge: 30000

    }

  );

}


/* =========================================================
   MEASUREMENT
========================================================= */

function startMeasure() {

  if (!map) {
    return;
  }


  measureMode =
    true;

  measurePoints =
    [];

  measureLayer.clearLayers();


  if (measureLine) {

    measureLine = null;

  }


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


function finishMeasure() {

  measureMode =
    false;


  $("measure")
    .classList
    .add("hidden");


  $("coords")
    .classList
    .add("hidden");


  if (measurePoints.length) {

    toast(
      "Measurement finished."
    );

  }

}


function clearMeasure() {

  measurePoints =
    [];

  measureLayer.clearLayers();

  measureLine =
    null;


  $("measureValue")
    .textContent =
      "0 ft";

}


$("finishMeasure")
  .addEventListener(
    "click",
    finishMeasure
  );


$("clearMeasure")
  .addEventListener(
    "click",
    clearMeasure
  );


function handleMapClick(
  event
) {

  if (!measureMode) {
    return;
  }


  const point =
    event.latlng;


  measurePoints.push(
    point
  );


  L.circleMarker(
    point,
    {
      radius: 5
    }
  ).addTo(
    measureLayer
  );


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
        measurePoints
      ).addTo(
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


    $("measureValue")
      .textContent =
        formatDistance(
          meters
        );

  }

}


/* =========================================================
   DISTANCE FORMAT
========================================================= */

function formatDistance(
  meters
) {

  const feet =
    meters * 3.28084;


  if (feet < 5280) {

    return `${Math.round(feet)} ft`;

  }


  return `${(
    feet / 5280
  ).toFixed(2)} mi`;

}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
  value
) {

  try {

    return new Date(
      value
    ).toLocaleString();

  } catch {

    return value;

  }

}


/* =========================================================
   CLOSE RESULTS
========================================================= */

$("resultsClose")
  .addEventListener(
    "click",
    () => {

      $("results")
        .classList
        .add("hidden");

    }
  );


/* =========================================================
   CLOSE MODAL WHEN BACKGROUND CLICKED
========================================================= */

$("mapsModal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("mapsModal")
      ) {

        closeMapsModal();

      }

    }
  );


/* =========================================================
   CLEAN OLD LOGIN HISTORY
========================================================= */

(function cleanOldLoginHistory() {

  const history =
    getLoginHistory();


  const cutoff =
    Date.now() -
    (30 * 24 * 60 * 60 * 1000);


  const cleaned =
    history.filter(
      entry =>
        new Date(
          entry.time
        ).getTime() >= cutoff
    );


  writeJSON(
    "parcelScope.loginHistory",
    cleaned
  );

})();


/* =========================================================
   NOTIFICATION CHECK
========================================================= */

updateNotificationDot();


/* =========================================================
   INITIAL PASSWORD FOCUS
========================================================= */

setTimeout(
  () => {

    if (
      !$("loginScreen")
        .classList
        .contains("hidden")
    ) {

      $("passwordInput")
        .focus();

    }

  },
  150
);
