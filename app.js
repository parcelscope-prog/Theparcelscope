/*
=========================================================
PARCELSCOPE
Fresh JavaScript / data-source architecture
=========================================================
*/

"use strict";


/* =======================================================
   CONFIGURATION
======================================================= */

const CONFIG = {

  states: {

    ID: {
      name: "Idaho",

      bounds: [
        [42.0, -117.3],
        [49.1, -111.0]
      ],

      parcelSource:
        "https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/0"
    },

    WA: {
      name: "Washington",

      bounds: [
        [45.5, -124.9],
        [49.1, -116.8]
      ],

      parcelSource:
        "https://services.arcgis.com/jsIt88o09Q0r1j8h/ArcGIS/rest/services/Current_Parcels/FeatureServer/0"
    },

    OR: {
      name: "Oregon",

      bounds: [
        [41.9, -124.8],
        [46.4, -116.3]
      ],

      parcelMapSource:
        "https://gis.odf.oregon.gov/ags1/rest/services/WebMercator/TaxlotsDisplay/MapServer"
    },

    MT: {
      name: "Montana",

      bounds: [
        [44.3, -116.1],
        [49.1, -104.0]
      ],

      parcelSource:
        "https://gis.dnrc.mt.gov/arcgis/rest/services/DNRALL/Cadastral/FeatureServer/0"
    }

  },


  /*
  -------------------------------------------------------
  MAP SOURCES
  -------------------------------------------------------
  */

  street:
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",


  /*
  -------------------------------------------------------
  BOUNDARIES
  -------------------------------------------------------
  */

  stateBoundaries:
    "https://services7.arcgis.com/A1RDKaAsUAoUdZiz/ArcGIS/rest/services/State_Boundaries/FeatureServer/0",

  countyBoundaries:
    "https://services7.arcgis.com/A1RDKaAsUAoUdZiz/ArcGIS/rest/services/County_Boundaries/FeatureServer/0"

};


/* =======================================================
   MAP
======================================================= */

const map = L.map("map", {

  zoomControl: true,

  preferCanvas: true,

  zoomSnap: 0.25,

  zoomDelta: 0.5,

  wheelDebounceTime: 80,

  wheelPxPerZoomLevel: 140

}).setView([46.9, -116.4], 6);


/* =======================================================
   BASE MAPS
======================================================= */

const streetLayer = L.tileLayer(
  CONFIG.street,
  {
    maxZoom: 19,

    attribution:
      "© OpenStreetMap contributors"
  }
);


const satelliteLayer = L.tileLayer(
  CONFIG.satellite,
  {
    maxZoom: 19,

    attribution:
      "© Esri"
  }
);


streetLayer.addTo(map);


/* =======================================================
   LAYERS
======================================================= */

const parcelLayer = L.layerGroup().addTo(map);

let stateBoundaryLayer = null;

let countyBoundaryLayer = null;

let selectedParcelLayer = null;

let currentState = null;

let parcelRequestTimer = null;

let currentParcelRequest = 0;


/* =======================================================
   STYLES
======================================================= */

/*
   STATE + COUNTY = BLACK
*/

const stateBoundaryStyle = {

  color: "#000000",

  weight: 2,

  opacity: 0.95,

  fill: false,

  interactive: false
};


const countyBoundaryStyle = {

  color: "#000000",

  weight: 1.4,

  opacity: 0.8,

  fill: false,

  interactive: false
};


/*
   NORMAL PARCEL = WHITE
*/

const normalParcelStyle = {

  color: "#ffffff",

  weight: 1.15,

  opacity: 0.92,

  fillColor: "#ffffff",

  fillOpacity: 0
};


/*
   SELECTED PARCEL = NEON LIGHT BLUE
   TRANSPARENT FILL
*/

const selectedParcelStyle = {

  color: "#58d9ff",

  weight: 3,

  opacity: 1,

  fillColor: "#58d9ff",

  fillOpacity: 0.18
};


/* =======================================================
   STATUS
======================================================= */

let statusTimer = null;


function setStatus(message) {

  const status =
    document.getElementById("status");

  if (!status) return;

  status.textContent = message;

  clearTimeout(statusTimer);

  statusTimer = setTimeout(() => {

    status.textContent = "Ready";

  }, 7000);

}


/* =======================================================
   ARC GIS REQUEST HELPER
======================================================= */

async function arcgisQuery(
  service,
  options = {}
) {

  const url =
    new URL(service + "/query");


  url.searchParams.set(
    "f",
    "geojson"
  );


  url.searchParams.set(
    "where",
    options.where || "1=1"
  );


  url.searchParams.set(
    "outFields",
    options.outFields || "*"
  );


  if (options.geometry) {

    url.searchParams.set(
      "geometry",
      options.geometry
    );

    url.searchParams.set(
      "geometryType",
      options.geometryType ||
      "esriGeometryEnvelope"
    );

    url.searchParams.set(
      "inSR",
      options.inSR || "4326"
    );

    url.searchParams.set(
      "spatialRel",
      options.spatialRel ||
      "esriSpatialRelIntersects"
    );
  }


  if (options.returnGeometry !== undefined) {

    url.searchParams.set(
      "returnGeometry",
      String(options.returnGeometry)
    );
  }


  if (options.resultRecordCount) {

    url.searchParams.set(
      "resultRecordCount",
      String(options.resultRecordCount)
    );
  }


  const response =
    await fetch(url.toString());


  if (!response.ok) {

    throw new Error(
      `ArcGIS HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  if (data.error) {

    throw new Error(
      data.error.message ||
      "ArcGIS service error"
    );
  }


  return data;
}


/* =======================================================
   LOAD STATE BOUNDARIES
======================================================= */

async function loadStateBoundaries() {

  try {

    const data =
      await arcgisQuery(
        CONFIG.stateBoundaries,
        {
          where:
            "STATE_ABBR IN ('ID','WA','OR','MT')",

          outFields: "*"
        }
      );


    stateBoundaryLayer =
      L.geoJSON(
        data,
        {
          style:
            stateBoundaryStyle
        }
      );


    stateBoundaryLayer.addTo(map);


  } catch (error) {

    console.warn(
      "State boundary layer unavailable:",
      error
    );

  }

}


/* =======================================================
   LOAD COUNTY BOUNDARIES
======================================================= */

async function loadCountyBoundaries() {

  try {

    const data =
      await arcgisQuery(
        CONFIG.countyBoundaries,
        {
          where:
            "STATE_NAME IN ('Idaho','Washington','Oregon','Montana')",

          outFields: "*"
        }
      );


    countyBoundaryLayer =
      L.geoJSON(
        data,
        {
          style:
            countyBoundaryStyle
        }
      );


    countyBoundaryLayer.addTo(map);


  } catch (error) {

    console.warn(
      "County boundary layer unavailable:",
      error
    );

  }

}


/* =======================================================
   START BOUNDARIES
======================================================= */

loadStateBoundaries();

loadCountyBoundaries();


/* =======================================================
   DETERMINE STATE
======================================================= */

function detectState(
  latitude,
  longitude
) {

  for (
    const [code, state]
    of Object.entries(CONFIG.states)
  ) {

    const bounds =
      state.bounds;


    const south =
      bounds[0][0];

    const west =
      bounds[0][1];

    const north =
      bounds[1][0];

    const east =
      bounds[1][1];


    if (

      latitude >= south &&

      latitude <= north &&

      longitude >= west &&

      longitude <= east

    ) {

      return code;

    }

  }


  return null;

}


/* =======================================================
   GET CURRENT STATE
======================================================= */

function getCurrentState() {

  const center =
    map.getCenter();


  return detectState(
    center.lat,
    center.lng
  );

}


/* =======================================================
   LOAD VISIBLE PARCELS
======================================================= */

async function loadVisibleParcels() {

  const stateCode =
    getCurrentState();


  if (!stateCode) {

    setStatus(
      "Move over Idaho, Washington, Oregon, or Montana"
    );

    return;
  }


  currentState =
    stateCode;


  const source =
    CONFIG.states[stateCode];


  /*
    Avoid attempting huge parcel requests.
  */

  if (map.getZoom() < 13) {

    setStatus(
      `${source.name} parcel boundaries appear at closer zoom`
    );

    return;

  }


  /*
    Oregon needs its county tax-lot MapServer
    architecture handled separately.
  */

  if (!source.parcelSource) {

    if (stateCode === "OR") {

      setStatus(
        "Oregon tax lots use the statewide county tax-lot service"
      );

    }

    return;
  }


  const bounds =
    map.getBounds();


  const southwest =
    bounds.getSouthWest();


  const northeast =
    bounds.getNorthEast();


  const envelope = [

    southwest.lng,

    southwest.lat,

    northeast.lng,

    northeast.lat

  ].join(",");


  /*
    Request ID prevents an older slow request
    from overwriting a newer map position.
  */

  const requestId =
    ++currentParcelRequest;


  try {

    setStatus(
      `Loading ${source.name} parcels...`
    );


    const data =
      await arcgisQuery(
        source.parcelSource,
        {
          geometry: envelope,

          geometryType:
            "esriGeometryEnvelope",

          outFields: "*",

          resultRecordCount: 500
        }
      );


    if (
      requestId !==
      currentParcelRequest
    ) {

      return;

    }


    parcelLayer.clearLayers();


    if (
      !data.features ||
      !data.features.length
    ) {

      setStatus(
        "No parcel records returned for this area"
      );

      return;
    }


    const geojson =
      L.geoJSON(
        data,
        {

          style:
            normalParcelStyle,


          onEachFeature:
            (feature, layer) => {

              layer.on(
                "click",
                event => {

                  L.DomEvent.stopPropagation(
                    event
                  );


                  selectParcel(
                    layer,

                    feature.properties ||
                    {}
                  );

                }
              );

            }

        }
      );


    geojson.addTo(
      parcelLayer
    );


    setStatus(
      `${data.features.length} parcels loaded`
    );


  } catch (error) {

    console.error(
      "Parcel request failed:",
      error
    );


    setStatus(
      `${source.name} parcel source could not be reached`
    );

  }

}


/* =======================================================
   MAP MOVEMENT
======================================================= */

map.on(
  "moveend zoomend",
  () => {

    clearTimeout(
      parcelRequestTimer
    );


    parcelRequestTimer =
      setTimeout(
        loadVisibleParcels,
        300
      );

  }
);


/* =======================================================
   SELECT PARCEL
======================================================= */

function selectParcel(
  layer,
  properties
) {

  if (selectedParcelLayer) {

    selectedParcelLayer.setStyle(
      normalParcelStyle
    );

  }


  selectedParcelLayer =
    layer;


  layer.setStyle(
    selectedParcelStyle
  );


  if (
    typeof layer.bringToFront ===
    "function"
  ) {

    layer.bringToFront();

  }


  showProperty(
    properties
  );

}


/* =======================================================
   PROPERTY INFORMATION
======================================================= */

const PROPERTY_FIELDS = {

  "Identification": [

    "PARCELID",

    "ParcelID",

    "Parcel_Id",

    "PIN",

    "APN",

    "PropertyID",

    "FIPS_NR",

    "Geocode"

  ],


  "Address": [

    "Address",

    "AddressLine1",

    "AddressLine2",

    "Situs",

    "SitusAddress",

    "SitusAddress1",

    "SitusCity",

    "SitusState",

    "SitusZip",

    "CityStateZip"

  ],


  "Owner / Taxpayer": [

    "Owner",

    "OwnerName",

    "Owner_Name",

    "OwnerAddress",

    "OwnerAddress1",

    "OwnerAddress2",

    "OwnerCity",

    "OwnerState",

    "OwnerZip",

    "OwnerZipCode"

  ],


  "Land": [

    "Acres",

    "GISAcres",

    "TotalAcres",

    "Acreage",

    "LotSize",

    "PropType",

    "PropertyType",

    "LandUse",

    "LandUseCode",

    "AssessmentCode",

    "Subdivision",

    "Lot",

    "Block",

    "LegalDescription",

    "LegalDescriptionShort",

    "Township",

    "Range",

    "Section"

  ],


  "Buildings / Improvements": [

    "YearBuilt",

    "BuildingSqFt",

    "BuildingArea",

    "LivingArea",

    "ImprovementValue",

    "TotalBuildingValue",

    "Buildings",

    "BuildingCount"

  ],


  "Assessment": [

    "TaxYear",

    "AssessmentYear",

    "LandValue",

    "TotalLandValue",

    "ImprovementValue",

    "TotalBuildingValue",

    "TotalValue",

    "AssessedValue",

    "TaxableValue"

  ],


  "Tax / District": [

    "TaxCode",

    "TaxCodeArea",

    "TaxDistrict",

    "TaxDistrictCode",

    "LevyDistrict",

    "CountyCode",

    "COUNTYCD"

  ],


  "Agricultural": [

    "IrrigatedAcres",

    "GrazingAcres",

    "ForestAcres",

    "FallowAcres",

    "FarmsiteAcres",

    "WildHayAcres",

    "ContinuousCropAcres",

    "NonQualAcres"

  ]

};


/* =======================================================
   SHOW PROPERTY
======================================================= */

function showProperty(
  properties
) {

  const body =
    document.getElementById(
      "propertyBody"
    );


  body.innerHTML = "";


  let foundAny =
    false;


  for (
    const [group, fields]
    of Object.entries(
      PROPERTY_FIELDS
    )
  ) {

    const available =
      fields.filter(
        field => {

          const value =
            properties[field];


          return (

            value !== undefined &&

            value !== null &&

            String(value).trim() !== ""

          );

        }
      );


    if (!available.length) {

      continue;

    }


    foundAny = true;


    const section =
      document.createElement(
        "div"
      );


    section.className =
      "section";


    const title =
      document.createElement(
        "div"
      );


    title.className =
      "sectionTitle";


    title.textContent =
      group;


    section.appendChild(
      title
    );


    for (
      const field
      of available
    ) {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "infoRow";


      const label =
        document.createElement(
          "div"
        );


      label.className =
        "infoLabel";


      label.textContent =
        prettyFieldName(
          field
        );


      const value =
        document.createElement(
          "div"
        );


      value.className =
        "infoValue";


      value.textContent =
        formatPropertyValue(
          properties[field]
        );


      row.appendChild(
        label
      );


      row.appendChild(
        value
      );


      section.appendChild(
        row
      );

    }


    body.appendChild(
      section
    );

  }


  /*
    Show fields that weren't part
    of our known categories.
  */

  const knownFields =
    new Set(
      Object.values(
        PROPERTY_FIELDS
      ).flat()
    );


  const extraFields =
    Object.keys(
      properties
    ).filter(
      field =>

        !knownFields.has(
          field
        ) &&

        properties[field] !== null &&

        properties[field] !== undefined &&

        String(
          properties[field]
        ).trim() !== ""

    );


  if (extraFields.length) {

    const section =
      document.createElement(
        "div"
      );


    section.className =
      "section";


    const title =
      document.createElement(
        "div"
      );


    title.className =
      "sectionTitle";


    title.textContent =
      "Additional Source Data";


    section.appendChild(
      title
    );


    for (
      const field
      of extraFields
    ) {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "infoRow";


      const label =
        document.createElement(
          "div"
        );


      label.className =
        "infoLabel";


      label.textContent =
        prettyFieldName(
          field
        );


      const value =
        document.createElement(
          "div"
        );


      value.className =
        "infoValue";


      value.textContent =
        formatPropertyValue(
          properties[field]
        );


      row.appendChild(
        label
      );


      row.appendChild(
        value
      );


      section.appendChild(
        row
      );

    }


    body.appendChild(
      section
    );

    foundAny = true;

  }


  if (!foundAny) {

    const message =
      document.createElement(
        "p"
      );


    message.style.color =
      "#8fa3b5";


    message.style.lineHeight =
      "1.6";


    message.textContent =
      "The parcel source returned the parcel geometry, but no readable attribute information was available.";


    body.appendChild(
      message
    );

  }


  openPanel(
    "propertyPanel"
  );

}


/* =======================================================
   FIELD FORMATTING
======================================================= */

function prettyFieldName(
  field
) {

  return field

    .replace(
      /_/g,
      " "
    )

    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2"
    )

    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


function formatPropertyValue(
  value
) {

  if (
    typeof value ===
    "number"
  ) {

    return value.toLocaleString();

  }


  return String(
    value
  );

}


/* =======================================================
   SEARCH
======================================================= */

const searchInput =
  document.getElementById(
    "searchInput"
  );


const searchButton =
  document.getElementById(
    "searchButton"
  );


searchButton.addEventListener(
  "click",
  runSearch
);


searchInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      runSearch();

    }

  }
);


/* =======================================================
   RUN SEARCH
======================================================= */

async function runSearch() {

  const query =
    searchInput.value.trim();


  if (!query) {

    return;

  }


  /*
    Coordinate search.
  */

  const coordinates =
    query
      .split(",")
      .map(
        value =>
          Number(
            value.trim()
          )
      );


  if (

    coordinates.length === 2 &&

    Number.isFinite(
      coordinates[0]
    ) &&

    Number.isFinite(
      coordinates[1]
    ) &&

    Math.abs(
      coordinates[0]
    ) <= 90 &&

    Math.abs(
      coordinates[1]
    ) <= 180

  ) {

    const latitude =
      coordinates[0];

    const longitude =
      coordinates[1];


    map.setView(
      [
        latitude,
        longitude
      ],
      17
    );


    await queryParcelAtPoint(
      latitude,
      longitude
    );


    return;

  }


  /*
    Address lookup.
  */

  try {

    setStatus(
      "Finding address..."
    );


    const url =
      "https://nominatim.openstreetmap.org/search?" +

      new URLSearchParams({

        q: query,

        format: "json",

        limit: "1"

      });


    const response =
      await fetch(
        url,
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


    const results =
      await response.json();


    if (!results.length) {

      setStatus(
        "Address not found"
      );

      return;

    }


    const latitude =
      Number(
        results[0].lat
      );


    const longitude =
      Number(
        results[0].lon
      );


    map.setView(
      [
        latitude,
        longitude
      ],
      17
    );


    await queryParcelAtPoint(
      latitude,
      longitude
    );


  } catch (error) {

    console.error(
      error
    );


    setStatus(
      "Search failed"
    );

  }

}


/* =======================================================
   QUERY PARCEL AT POINT
======================================================= */

async function queryParcelAtPoint(
  latitude,
  longitude
) {

  const stateCode =
    detectState(
      latitude,
      longitude
    );


  if (!stateCode) {

    setStatus(
      "Location is outside the supported states"
    );

    return;

  }


  currentState =
    stateCode;


  const source =
    CONFIG.states[
      stateCode
    ];


  if (!source.parcelSource) {

    setStatus(
      `${source.name} requires its county tax-lot source`
    );

    return;

  }


  try {

    setStatus(
      `Finding ${source.name} parcel...`
    );


    const data =
      await arcgisQuery(
        source.parcelSource,
        {

          geometry:
            `${longitude},${latitude}`,

          geometryType:
            "esriGeometryPoint",

          inSR: "4326",

          spatialRel:
            "esriSpatialRelIntersects",

          outFields: "*",

          resultRecordCount: 10

        }
      );


    if (
      !data.features ||
      !data.features.length
    ) {

      setStatus(
        "No parcel found at this location"
      );

      return;

    }


    /*
      Clear old selected parcel,
      but leave normal visible parcels.
    */

    if (
      selectedParcelLayer
    ) {

      selectedParcelLayer.setStyle(
        normalParcelStyle
      );

      selectedParcelLayer =
        null;

    }


    const feature =
      data.features[0];


    const selected =
      L.geoJSON(
        feature,
        {
          style:
            selectedParcelStyle
        }
      );


    selected.addTo(
      parcelLayer
    );


    selected.eachLayer(
      layer => {

        selectedParcelLayer =
          layer;


        layer.bringToFront();


        layer.on(
          "click",
          event => {

            L.DomEvent.stopPropagation(
              event
            );


            showProperty(
              feature.properties ||
              {}
            );

          }
        );

      }
    );


    showProperty(
      feature.properties ||
      {}
    );


    setStatus(
      `${source.name} parcel found`
    );


  } catch (error) {

    console.error(
      "Point parcel lookup failed:",
      error
    );


    setStatus(
      "Parcel lookup failed"
    );

  }

}


/* =======================================================
   MENU
======================================================= */

const menuButtons =
  document.querySelectorAll(
    ".menu button"
  );


menuButtons.forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        menuButtons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        const panelId =
          button.dataset.panel;


        document
          .querySelectorAll(
            ".panel"
          )
          .forEach(
            panel =>
              panel.classList.remove(
                "open"
              )
          );


        if (
          panelId &&
          panelId !== "mapPanel"
        ) {

          const panel =
            document.getElementById(
              panelId
            );


          if (panel) {

            panel.classList.add(
              "open"
            );

          }

        }


        if (
          window.innerWidth <=
          760
        ) {

          document
            .getElementById(
              "sidebar"
            )
            .classList.remove(
              "mobileOpen"
            );

        }

      }
    );

  }
);


/* =======================================================
   CLOSE BUTTONS
======================================================= */

document
  .querySelectorAll(
    ".close"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const panel =
            button.closest(
              ".panel"
            );


          if (panel) {

            panel.classList.remove(
              "open"
            );

          }

        }
      );

    }
  );


/* =======================================================
   MOBILE MENU
======================================================= */

const mobileMenu =
  document.getElementById(
    "mobileMenu"
  );


mobileMenu.addEventListener(
  "click",
  () => {

    document
      .getElementById(
        "sidebar"
      )
      .classList.toggle(
        "mobileOpen"
      );

  }
);


/* =======================================================
   STREET / SATELLITE
======================================================= */

const streetButton =
  document.getElementById(
    "streetBtn"
  );


const satelliteButton =
  document.getElementById(
    "satelliteBtn"
  );


streetButton.addEventListener(
  "click",
  () => {

    if (
      !map.hasLayer(
        streetLayer
      )
    ) {

      map.addLayer(
        streetLayer
      );

    }


    if (
      map.hasLayer(
        satelliteLayer
      )
    ) {

      map.removeLayer(
        satelliteLayer
      );

    }


    streetButton.classList.add(
      "active"
    );


    satelliteButton.classList.remove(
      "active"
    );

  }
);


satelliteButton.addEventListener(
  "click",
  () => {

    if (
      !map.hasLayer(
        satelliteLayer
      )
    ) {

      map.addLayer(
        satelliteLayer
      );

    }


    if (
      map.hasLayer(
        streetLayer
      )
    ) {

      map.removeLayer(
        streetLayer
      );

    }


    satelliteButton.classList.add(
      "active"
    );


    streetButton.classList.remove(
      "active"
    );

  }
);


/* =======================================================
   LOCATE
======================================================= */

document
  .getElementById(
    "locateBtn"
  )
  .addEventListener(
    "click",
    () => {

      if (
        !navigator.geolocation
      ) {

        setStatus(
          "Location is not supported"
        );

        return;

      }


      setStatus(
        "Finding your location..."
      );


      navigator.geolocation.getCurrentPosition(

        position => {

          const latitude =
            position.coords.latitude;


          const longitude =
            position.coords.longitude;


          map.setView(
            [
              latitude,
              longitude
            ],
            17
          );


          queryParcelAtPoint(
            latitude,
            longitude
          );

        },


        error => {

          console.warn(
            error
          );


          setStatus(
            "Location permission was unavailable"
          );

        },


        {

          enableHighAccuracy:
            true,

          timeout:
            10000,

          maximumAge:
            30000

        }

      );

    }
  );


/* =======================================================
   SETTINGS
======================================================= */

const parcelVisibility =
  document.getElementById(
    "parcelVisibility"
  );


parcelVisibility.addEventListener(
  "change",
  event => {

    if (
      event.target.value ===
      "off"
    ) {

      if (
        map.hasLayer(
          parcelLayer
        )
      ) {

        map.removeLayer(
          parcelLayer
        );

      }

    } else {

      if (
        !map.hasLayer(
          parcelLayer
        )
      ) {

        parcelLayer.addTo(
          map
        );

      }

    }

  }
);


const countyVisibility =
  document.getElementById(
    "countyVisibility"
  );


countyVisibility.addEventListener(
  "change",
  event => {

    if (
      !countyBoundaryLayer
    ) {

      return;

    }


    if (
      event.target.value ===
      "off"
    ) {

      map.removeLayer(
        countyBoundaryLayer
      );

    } else {

      countyBoundaryLayer.addTo(
        map
      );

    }

  }
);


const stateVisibility =
  document.getElementById(
    "stateVisibility"
  );


stateVisibility.addEventListener(
  "change",
  event => {

    if (
      !stateBoundaryLayer
    ) {

      return;

    }


    if (
      event.target.value ===
      "off"
    ) {

      map.removeLayer(
        stateBoundaryLayer
      );

    } else {

      stateBoundaryLayer.addTo(
        map
      );

    }

  }
);


const defaultLayer =
  document.getElementById(
    "defaultLayer"
  );


defaultLayer.addEventListener(
  "change",
  event => {

    if (
      event.target.value ===
      "satellite"
    ) {

      satelliteButton.click();

    } else {

      streetButton.click();

    }

  }
);


/* =======================================================
   OPEN PANEL
======================================================= */

function openPanel(
  panelId
) {

  document
    .querySelectorAll(
      ".panel"
    )
    .forEach(
      panel =>
        panel.classList.remove(
          "open"
        )
    );


  const panel =
    document.getElementById(
      panelId
    );


  if (panel) {

    panel.classList.add(
      "open"
    );

  }

}


/* =======================================================
   INITIAL VIEW
======================================================= */

map.fitBounds(
  CONFIG.states.ID.bounds,
  {
    padding: [
      30,
      30
    ]
  }
);


setTimeout(
  () => {

    map.setView(
      [
        46.9,
        -116.4
      ],
      6
    );

  },
  50
);


/* =======================================================
   INITIAL PARCEL LOAD
======================================================= */

setTimeout(
  () => {

    loadVisibleParcels();

  },
  1000
);
