/*
==========================================================
PARCELSCOPE
Complete client-side version

13 accounts:
1 Admin
12 Users

IMPORTANT:
This is intentionally client-side because the site is
being hosted as a static Cloudflare site.
==========================================================
*/


/* ======================================================
   ACCOUNT DATABASE
====================================================== */

const ACCOUNTS = {

  "4827": {
    id: "admin",
    name: "User",
    admin: true
  },

  "1936": {
    id: "user1",
    name: "User",
    admin: false
  },

  "7041": {
    id: "user2",
    name: "User",
    admin: false
  },

  "5268": {
    id: "user3",
    name: "User",
    admin: false
  },

  "8315": {
    id: "user4",
    name: "User",
    admin: false
  },

  "2490": {
    id: "user5",
    name: "User",
    admin: false
  },

  "6752": {
    id: "user6",
    name: "User",
    admin: false
  },

  "4183": {
    id: "user7",
    name: "User",
    admin: false
  },

  "9506": {
    id: "user8",
    name: "User",
    admin: false
  },

  "3624": {
    id: "user9",
    name: "User",
    admin: false
  },

  "8179": {
    id: "user10",
    name: "User",
    admin: false
  },

  "5407": {
    id: "user11",
    name: "User",
    admin: false
  },

  "2861": {
    id: "user12",
    name: "User",
    admin: false
  }

};


/* ======================================================
   CONSTANTS
====================================================== */

const PARCEL_ZOOM = 10;

const NORTHWEST_CENTER = [
  46.1,
  -116.7
];


/* ======================================================
   STATE
====================================================== */

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

  setTimeout(() => {

    $("toast").classList.add("hidden");

  }, 2600);

}


/* ======================================================
   ACCOUNT STORAGE
====================================================== */

function accountKey(name) {

  return `parcelScope.${currentAccount.id}.${name}`;

}


function getAccountData(name, fallback) {

  try {

    return JSON.parse(
      localStorage.getItem(
        accountKey(name)
      ) || JSON.stringify(fallback)
    );

  } catch {

    return fallback;

  }

}


function setAccountData(name, value) {

  localStorage.setItem(
    accountKey(name),
    JSON.stringify(value)
  );

}


function getSaved() {

  return getAccountData(
    "saved",
    []
  );

}


function setSaved(properties) {

  setAccountData(
    "saved",
    properties
  );

}


function getRecent() {

  return getAccountData(
    "recent",
    []
  );

}


function getNotifications() {

  return getAccountData(
    "notifications",
    []
  );

}


function setNotifications(notifications) {

  setAccountData(
    "notifications",
    notifications
  );

}


function getName() {

  return localStorage.getItem(
    accountKey("name")
  ) || "User";

}


function setName(name) {

  localStorage.setItem(
    accountKey("name"),
    name
  );

}


/* ======================================================
   LOGIN
====================================================== */

function attemptLogin() {

  const password =
    $("passwordInput")
      .value
      .trim();


  const account =
    ACCOUNTS[password];


  if (!/^\d{4}$/.test(password) || !account) {

    $("loginError")
      .classList
      .remove("hidden");

    $("passwordInput").focus();

    return;

  }


  currentAccount = {
    ...account,
    password
  };


  if (!localStorage.getItem(
    accountKey("name")
  )) {

    localStorage.setItem(
      `parcelScope.${account.id}.name`,
      "User"
    );

  }


  sessionStorage.setItem(
    "parcelScope.loggedIn",
    "1"
  );

  sessionStorage.setItem(
    "parcelScope.account",
    account.id
  );


  $("loginError")
    .classList
    .add("hidden");

  $("passwordInput").value = "";


  showApp();

}


function showApp() {

  $("loginScreen")
    .classList
    .add("hidden");

  $("app")
    .classList
    .remove("hidden");


  updateAccountUI();

  updateNotificationDot();

  setTimeout(() => {

    map.invalidateSize();

  }, 100);

}


function updateAccountUI() {

  const name = getName();

  $("accountName").textContent = name;

  $("accountAvatar").textContent =
    name.charAt(0).toUpperCase() || "U";


  $("accountType").textContent =
    currentAccount.admin
      ? "Administrator"
      : "User Account";


  $("adminMenuSection")
    .classList
    .toggle(
      "hidden",
      !currentAccount.admin
    );

}


$("loginBtn").addEventListener(
  "click",
  attemptLogin
);


$("passwordInput").addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {

      event.preventDefault();

      attemptLogin();

    }

  }
);


/* Only numeric characters */

$("passwordInput").addEventListener(
  "input",
  event => {

    event.target.value =
      event.target.value
        .replace(/\D/g, "")
        .slice(0, 4);

  }
);


/* ======================================================
   LOGOUT
====================================================== */

function logout() {

  stopFollowing();

  stopMeasure();

  currentAccount = null;

  sessionStorage.removeItem(
    "parcelScope.loggedIn"
  );

  sessionStorage.removeItem(
    "parcelScope.account"
  );


  document
    .querySelectorAll(
      ".drawer, .property, .results, .modal, .menu"
    )
    .forEach(element => {

      element.classList.add("hidden");

    });


  $("app")
    .classList
    .add("hidden");


  $("loginScreen")
    .classList
    .remove("hidden");


  $("passwordInput").value = "";

  $("passwordInput").focus();

}


$("logoutBtn").addEventListener(
  "click",
  logout
);


/*
SessionStorage automatically disappears when the
browser/tab session ends.

The following also makes sure refreshing the page does
not accidentally leave the application without a valid
session.
*/

function restoreSession() {

  const loggedIn =
    sessionStorage.getItem(
      "parcelScope.loggedIn"
    );

  const accountId =
    sessionStorage.getItem(
      "parcelScope.account"
    );


  if (
    loggedIn === "1" &&
    accountId
  ) {

    const password =
      Object.keys(ACCOUNTS)
        .find(
          key =>
            ACCOUNTS[key].id === accountId
        );


    if (password) {

      currentAccount = {
        ...ACCOUNTS[password],
        password
      };

      showApp();

      return;

    }

  }


  $("loginScreen")
    .classList
    .remove("hidden");

  $("app")
    .classList
    .add("hidden");

}


window.addEventListener(
  "load",
  restoreSession
);


/* ======================================================
   MAP
====================================================== */

const map = L.map(
  "map",
  {
    zoomControl: false,

    doubleClickZoom: false,

    touchZoom: true,

    scrollWheelZoom: true,

    dragging: true,

    keyboard: true

  }
).setView(
  NORTHWEST_CENTER,
  5.55
);


/* ======================================================
   BASE MAPS
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
   DATA LAYERS
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
   MENU
====================================================== */

function setMenu(open) {

  $("menu")
    .classList
    .toggle(
      "hidden",
      !open
    );

}


$("menuBtn").addEventListener(
  "click",
  () => setMenu(true)
);


$("closeMenu").addEventListener(
  "click",
  () => setMenu(false)
);


/* ======================================================
   DRAWER
====================================================== */

function closeDrawer() {

  $("drawer")
    .classList
    .add("hidden");

}


$("drawerClose").addEventListener(
  "click",
  closeDrawer
);


/* ======================================================
   MENU PAGES
====================================================== */

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

  setMenu(false);


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

    startMeasure();

    return;

  }


  $("drawerTitle").textContent =
    titles[page] || "ParcelScope";


  $("drawer")
    .classList
    .remove("hidden");


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

      if (currentAccount.admin) {

        renderAdmin();

      } else {

        closeDrawer();

      }

      break;

  }

}


/* ======================================================
   SAVED
====================================================== */

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
    .querySelectorAll("[data-saved]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

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

        }
      );

    });

}


/* ======================================================
   RECENT
====================================================== */

function addRecent(property) {

  const recent =
    getRecent()
      .filter(
        item =>
          item.parcelId !==
          property.parcelId
      );


  recent.unshift(property);


  setAccountData(
    "recent",
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
    .querySelectorAll("[data-recent]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

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

        }
      );

    });

}


/* ======================================================
   NOTIFICATIONS
====================================================== */

function updateNotificationDot() {

  const notifications =
    getNotifications();


  const unread =
    notifications.some(
      notification =>
        !notification.read
    );


  $("redDot")
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

    $("drawerBody").innerHTML = `
      <div class="menu-page">

        <h3>
          Notifications
        </h3>

        <p>
          No notifications.
        </p>

      </div>
    `;

    return;

  }


  $("drawerBody").innerHTML = `

    <button
      id="deleteAllNotifications"
      class="delete-all"
    >
      Delete All
    </button>

    ${notifications
      .map(
        notification => `

          <div
            class="notification"
            data-notification="${escapeHTML(
              notification.id
            )}"
          >

            <strong>
              ${escapeHTML(
                notification.title
              )}
            </strong>

            <small>
              ${escapeHTML(
                notification.message
              )}
            </small>

            <small>
              ${escapeHTML(
                notification.date
              )}
            </small>

            <button
              class="notification-delete"
              data-delete-notification="${escapeHTML(
                notification.id
              )}"
            >
              ×
            </button>

          </div>

        `
      )
      .join("")}

  `;


  $("deleteAllNotifications")
    .addEventListener(
      "click",
      () => {

        setNotifications([]);

        updateNotificationDot();

        renderNotifications();

        toast(
          "Notifications deleted."
        );

      }
    );


  document
    .querySelectorAll(
      "[data-delete-notification]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const id =
            button.dataset
              .deleteNotification;


          setNotifications(
            getNotifications()
              .filter(
                notification =>
                  notification.id !== id
              )
          );


          updateNotificationDot();

          renderNotifications();

        }
      );

    });

}


/* ======================================================
   ADMIN
====================================================== */

function renderAdmin() {

  if (!currentAccount.admin) {

    return;

  }


  const users =
    Object.values(ACCOUNTS);


  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <h3>
        Administration
      </h3>

      <p>
        Send a notification to every account or to one
        selected account.
      </p>

      <label>
        Recipient
      </label>

      <select id="adminRecipient"
        style="width:100%; padding:10px; margin:6px 0 12px;
        background:#111d2a; color:white;
        border:1px solid #26384b; border-radius:8px;"
      >

        <option value="ALL">
          All Users
        </option>

        ${users
          .map(
            account => `
              <option value="${account.id}">
                ${account.id === "admin"
                  ? "Admin"
                  : account.id}
              </option>
            `
          )
          .join("")}

      </select>


      <label>
        Notification Title
      </label>

      <input
        id="adminNotificationTitle"
        type="text"
        placeholder="Notification title"
        style="width:100%; padding:10px; margin:6px 0 12px;
        background:#070e16; color:white;
        border:1px solid #26384b; border-radius:8px;"
      >


      <label>
        Message
      </label>

      <textarea
        id="adminNotificationMessage"
        placeholder="Write notification..."
        rows="5"
        style="width:100%; padding:10px; margin:6px 0 12px;
        background:#070e16; color:white;
        border:1px solid #26384b; border-radius:8px;
        resize:vertical;"
      ></textarea>


      <button
        id="sendAdminNotification"
        style="width:100%;"
      >
        Send Notification
      </button>


      <h3>
        Accounts
      </h3>

      <div class="row">
        <span>Total Accounts</span>
        <strong>13</strong>
      </div>

      <div class="row">
        <span>Administrator</span>
        <strong>1</strong>
      </div>

      <div class="row">
        <span>Regular Users</span>
        <strong>12</strong>
      </div>


      <h3>
        Login Activity
      </h3>

      <div id="loginActivity">
        ${renderLoginActivityHTML()}
      </div>

    </div>

  `;


  $("sendAdminNotification")
    .addEventListener(
      "click",
      sendAdminNotification
    );

}


function renderLoginActivityHTML() {

  const activity =
    JSON.parse(
      localStorage.getItem(
        "parcelScope.loginActivity"
      ) || "[]"
    );


  if (!activity.length) {

    return `
      <p>
        No login activity recorded yet.
      </p>
    `;

  }


  return activity
    .slice()
    .reverse()
    .map(
      entry => `

        <div class="row">

          <span>
            ${escapeHTML(
              entry.account
            )}
          </span>

          <small>
            ${escapeHTML(
              entry.time
            )}
          </small>

        </div>

      `
    )
    .join("");

}


function recordLogin(account) {

  const activity =
    JSON.parse(
      localStorage.getItem(
        "parcelScope.loginActivity"
      ) || "[]"
    );


  activity.push({

    account:
      account.admin
        ? "Admin"
        : account.id,

    time:
      new Date().toLocaleString()

  });


  localStorage.setItem(
    "parcelScope.loginActivity",
    JSON.stringify(
      activity.slice(-250)
    )
  );

}


/*
Replace attemptLogin with activity recording after
successful validation.
*/

const originalAttemptLogin = attemptLogin;


/* ======================================================
   ADMIN NOTIFICATIONS
====================================================== */

function sendAdminNotification() {

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


  const now =
    new Date().toLocaleString();


  const accounts =
    Object.values(ACCOUNTS);


  const targets =
    recipient === "ALL"
      ? accounts
      : accounts.filter(
          account =>
            account.id === recipient
        );


  targets.forEach(
    account => {

      const key =
        `parcelScope.${account.id}.notifications`;


      let notifications =
        JSON.parse(
          localStorage.getItem(key)
          || "[]"
        );


      notifications.push({

        id:
          `${Date.now()}-${Math.random()}`,

        title,

        message,

        date: now,

        read: false

      });


      localStorage.setItem(
        key,
        JSON.stringify(
          notifications
        )
      );

    }
  );


  $("adminNotificationTitle")
    .value = "";

  $("adminNotificationMessage")
    .value = "";


  toast(
    recipient === "ALL"
      ? "Notification sent to all users."
      : "Notification sent."
  );

}


/* ======================================================
   SETTINGS
====================================================== */

function renderSettings() {

  const name =
    getName();


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
          id="nameInput"
          type="text"
          maxlength="30"
          value="${escapeHTML(name)}"
          style="
            width:100%;
            padding:10px;
            background:#070e16;
            color:white;
            border:1px solid #26384b;
            border-radius:8px;
          "
        >

      </div>

      <button
        id="saveNameBtn"
        style="width:100%; margin-top:10px;"
      >
        Save Name
      </button>


      <h3>
        Map
      </h3>

      <div class="row">
        <span>Follow Location</span>

        <button id="settingsLocate">
          ${
            followingLocation
              ? "Stop"
              : "Start"
          }
        </button>

      </div>

    </div>

  `;


  $("saveNameBtn")
    .addEventListener(
      "click",
      () => {

        const newName =
          $("nameInput")
            .value
            .trim()
            .slice(0, 30);


        setName(
          newName || "User"
        );


        updateAccountUI();

        toast(
          "Name updated."
        );

      }
    );


  $("settingsLocate")
    .addEventListener(
      "click",
      () => {

        if (followingLocation) {

          stopFollowing();

        } else {

          startFollowing();

        }

        renderSettings();

      }
    );

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
        A private parcel mapping application for
        Washington, Oregon, Idaho and Montana.
      </p>

      <h3>
        Account
      </h3>

      <p>
        You are signed in as
        <strong>
          ${escapeHTML(
            getName()
          )}
        </strong>.
      </p>

      <h3>
        Version
      </h3>

      <p>
        ParcelScope 1.0
      </p>

    </div>

  `;

}


/* ======================================================
   MAP LAYERS
====================================================== */

function renderLayers() {

  $("drawerBody").innerHTML = `

    <div class="menu-page">

      <div class="row">

        <span>
          Satellite
        </span>

        <input
          id="satelliteRadio"
          type="radio"
          name="basemap"
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
          name="basemap"
        >

      </div>


      <div class="row">

        <span>
          Parcel Boundaries
        </span>

        <input
          id="parcelToggle"
          type="checkbox"
          ${parcelsEnabled ? "checked" : ""}
        >

      </div>


      <div class="row">

        <span>
          County Boundaries
        </span>

        <input
          id="countyToggle"
          type="checkbox"
          ${countyLayerEnabled ? "checked" : ""}
        >

      </div>


      <div class="row">

        <span>
          State Boundaries
        </span>

        <input
          id="stateToggle"
          type="checkbox"
          ${stateLayerEnabled ? "checked" : ""}
        >

      </div>


      <div class="row">

        <span>
          State & Town Labels
        </span>

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

      parcelLayer.clearLayers();

      if (
        parcelsEnabled &&
        map.getZoom() >= PARCEL_ZOOM
      ) {

        loadVisibleParcels();

      }

    };


  $("countyToggle").onchange =
    event => {

      countyLayerEnabled =
        event.target.checked;

    };


  $("stateToggle").onchange =
    event => {

      stateLayerEnabled =
        event.target.checked;

    };


  $("labelsToggle").onchange =
    event => {

      labelsEnabled =
        event.target.checked;

    };

}


/* ======================================================
   PROPERTY
====================================================== */

function selectParcel(
  property,
  fromSaved = false
) {

  selectedParcel =
    property;


  $("propertyTitle").textContent =
    property.address ||
    property.parcelId ||
    "Property";


  $("propertyBody").innerHTML = `

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
        Parcel ID
      </b>

      ${escapeHTML(
        property.parcelId
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


  updateSaveButton();


  $("property")
    .classList
    .remove("hidden");


  if (!fromSaved) {

    addRecent(property);

  }


  if (
    property.lat != null &&
    property.lng != null
  ) {

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

}


function updateSaveButton() {

  if (!selectedParcel) {

    return;

  }


  const saved =
    getSaved();


  const exists =
    saved.some(
      property =>
        property.parcelId ===
        selectedParcel.parcelId
    );


  $("saveBtn").textContent =
    exists
      ? "Remove Saved Property"
      : "Save Property";

}


$("propertyClose")
  .addEventListener(
    "click",
    () => {

      $("property")
        .classList
        .add("hidden");

      selectedLayer.clearLayers();

    }
  );


$("saveBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedParcel) {

        return;

      }


      const saved =
        getSaved();


      const index =
        saved.findIndex(
          property =>
            property.parcelId ===
            selectedParcel.parcelId
        );


      if (index >= 0) {

        saved.splice(
          index,
          1
        );

        toast(
          "Property removed."
        );

      } else {

        saved.push(
          selectedParcel
        );

        toast(
          "Property saved."
        );

      }


      setSaved(saved);

      updateSaveButton();

    }
  );


/* ======================================================
   SHARE
====================================================== */

$("shareBtn")
  .addEventListener(
    "click",
    async () => {

      if (!selectedParcel) {

        return;

      }


      const text =
        `${selectedParcel.address || "Property"}\n` +
        `Parcel ID: ${selectedParcel.parcelId || "Unavailable"}`;


      try {

        await navigator.clipboard.writeText(
          text
        );

        toast(
          "Parcel information copied."
        );

      } catch {

        toast(
          text
        );

      }

    }
  );


/* ======================================================
   MAPS
====================================================== */

$("mapsBtn")
  .addEventListener(
    "click",
    () => {

      if (!selectedParcel) {

        return;

      }


      $("mapsModal")
        .classList
        .remove("hidden");

    }
  );


function closeMapsModal() {

  $("mapsModal")
    .classList
    .add("hidden");

}


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


function getMapCoordinates() {

  if (
    selectedParcel &&
    selectedParcel.lat != null &&
    selectedParcel.lng != null
  ) {

    return [
      selectedParcel.lat,
      selectedParcel.lng
    ];

  }


  return map.getCenter();

}


$("googleBtn")
  .addEventListener(
    "click",
    () => {

      const point =
        getMapCoordinates();


      window.open(
        `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`,
        "_blank"
      );


      closeMapsModal();

    }
  );


$("appleBtn")
  .addEventListener(
    "click",
    () => {

      const point =
        getMapCoordinates();


      window.open(
        `https://maps.apple.com/?ll=${point.lat},${point.lng}`,
        "_blank"
      );


      closeMapsModal();

    }
  );


/* ======================================================
   SEARCH
====================================================== */

$("searchBtn")
  .addEventListener(
    "click",
    performSearch
  );


$("searchInput")
  .addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        performSearch();

      }

    }
  );


function performSearch() {

  const query =
    $("searchInput")
      .value
      .trim()
      .toLowerCase();


  if (!query) {

    toast(
      "Enter an address, owner or parcel ID."
    );

    return;

  }


  const state =
    $("stateSelect").value;


  /*
  Until live county FeatureServer endpoints are added,
  this creates a useful search result from local saved
  and recent properties.
  */

  const combined = [
    ...getSaved(),
    ...getRecent()
  ];


  const unique = [];

  combined.forEach(
    property => {

      if (
        !unique.some(
          item =>
            item.parcelId ===
            property.parcelId
        )
      ) {

        unique.push(property);

      }

    }
  );


  const matches =
    unique.filter(
      property => {

        const text =
          [
            property.address,
            property.owner,
            property.parcelId,
            property.county,
            property.state
          ]
          .join(" ")
          .toLowerCase();


        const stateMatch =
          state === "ALL" ||
          property.state === state;


        return (
          text.includes(query) &&
          stateMatch
        );

      }
    );


  renderSearchResults(
    matches
  );

}


function renderSearchResults(
  matches
) {

  $("results")
    .classList
    .remove("hidden");


  if (!matches.length) {

    $("resultsBody").innerHTML = `

      <div class="menu-page">

        <p>
          No local results found.
        </p>

        <p>
          Live parcel GIS sources can be connected
          to the STATE_SOURCES registry in the
          production version.
        </p>

      </div>

    `;

    return;

  }


  $("resultsBody").innerHTML =
    matches
      .map(
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
                property.owner
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
      )
      .join("");


  document
    .querySelectorAll(
      "[data-search-result]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const property =
            matches[
              Number(
                button.dataset.searchResult
              )
            ];


          $("results")
            .classList
            .add("hidden");


          selectParcel(
            property,
            true
          );

        }
      );

    });

}


$("resultsClose")
  .addEventListener(
    "click",
    () => {

      $("results")
        .classList
        .add("hidden");

    }
  );


/* ======================================================
   LOCATION
====================================================== */

$("locateBtn")
  .addEventListener(
    "click",
    () => {

      if (followingLocation) {

        stopFollowing();

      } else {

        startFollowing();

      }

    }
  );


function startFollowing() {

  if (!navigator.geolocation) {

    toast(
      "Location is not supported."
    );

    return;

  }


  followingLocation = true;

  $("locateBtn").textContent =
    "Stop";


  locationWatch =
    navigator.geolocation.watchPosition(

      position => {

        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;


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


        coordinateLayer.clearLayers();


        L.circleMarker(
          [
            lat,
            lng
          ],
          {
            radius: 7
          }
        )
        .addTo(
          coordinateLayer
        );


        $("coords")
          .textContent =
          `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        $("coords")
          .classList
          .remove("hidden");

      },

      error => {

        toast(
          "Unable to access your location."
        );

        stopFollowing();

      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }

    );

}


function stopFollowing() {

  followingLocation = false;

  $("locateBtn").textContent =
    "Locate";


  if (
    locationWatch !== null
  ) {

    navigator.geolocation.clearWatch(
      locationWatch
    );

    locationWatch = null;

  }


  coordinateLayer.clearLayers();

  $("coords")
    .classList
    .add("hidden");

}


/* ======================================================
   MEASURE
====================================================== */

function startMeasure() {

  setMenu(false);

  closeDrawer();

  measureMode = true;

  measurePoints = [];

  measureLayer.clearLayers();

  $("measure")
    .classList
    .remove("hidden");

  updateMeasureValue();

  toast(
    "Tap the map to add measurement points."
  );

}


function stopMeasure() {

  measureMode = false;

  measurePoints = [];

  measureLayer.clearLayers();

  $("measure")
    .classList
    .add("hidden");

}


function updateMeasureValue() {

  let total = 0;


  for (
    let i = 1;
    i < measurePoints.length;
    i++
  ) {

    total +=
      map.distance(
        measurePoints[i - 1],
        measurePoints[i]
      );

  }


  let display;


  if (total < 1609.344) {

    display =
      `${Math.round(total * 3.28084)} ft`;

  } else {

    display =
      `${(total / 1609.344).toFixed(2)} mi`;

  }


  $("measureValue")
    .textContent =
    display;

}


$("finishMeasure")
  .addEventListener(
    "click",
    () => {

      measureMode = false;

      toast(
        "Measurement finished."
      );

    }
  );


$("clearMeasure")
  .addEventListener(
    "click",
    () => {

      measurePoints = [];

      measureLayer.clearLayers();

      updateMeasureValue();

    }
  );


map.on(
  "click",
  event => {

    if (!measureMode) {

      return;

    }


    measurePoints.push(
      event.latlng
    );


    L.circleMarker(
      event.latlng,
      {
        radius: 5
      }
    )
    .addTo(
      measureLayer
    );


    if (
      measurePoints.length > 1
    ) {

      L.polyline(
        measurePoints
      )
      .addTo(
        measureLayer
      );

    }


    updateMeasureValue();

  }
);


/* ======================================================
   MAP COORDINATES
====================================================== */

map.on(
  "mousemove",
  event => {

    $("coords")
      .textContent =
      `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;

  }
);


/* ======================================================
   PARCEL PLACEHOLDER
====================================================== */

function loadVisibleParcels() {

  /*
  No fake parcel data is generated here.

  Real Washington, Oregon, Idaho and Montana parcel
  FeatureServer endpoints should be added once the
  county/state GIS sources are selected.

  This prevents ParcelScope from displaying invented
  property information.
  */

  parcelLayer.clearLayers();

}


/* ======================================================
   MAP ZOOM
====================================================== */

map.on(
  "zoomend",
  () => {

    if (
      !parcelsEnabled
    ) {

      return;

    }


    if (
      map.getZoom() >= PARCEL_ZOOM
    ) {

      loadVisibleParcels();

    } else {

      parcelLayer.clearLayers();

    }

  }
);


/* ======================================================
   FIX ADMIN LOGIN ACTIVITY
====================================================== */

/*
The login function above needs to record activity.
We do that by listening for successful login state
changes.
*/

const originalShowApp =
  showApp;


showApp = function() {

  if (currentAccount) {

    recordLogin(
      currentAccount
    );

  }


  originalShowApp();

};


/* ======================================================
   INITIAL FOCUS
====================================================== */

setTimeout(
  () => {

    if (
      $("loginScreen") &&
      !$("loginScreen")
        .classList
        .contains("hidden")
    ) {

      $("passwordInput")
        .focus();

    }

  },
  250
);
