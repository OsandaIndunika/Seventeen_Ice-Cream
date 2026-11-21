
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Truck,
  Package,
  MapPin,
  Navigation,
  RefreshCw,
  CheckCircle2,
  Clock3,
  LogOut,
  ArrowLeft,
  Phone,
  AlertCircle,
  UserRound,
  CreditCard,
  Store,
} from "lucide-react";

// ==========================================
// NEW IMPORT
//
// Manual shop visit registration,
// GPS pin selection and saved shops map.
//
// Ensure DeliveryShopVisits.jsx exists
// in the same folder as this dashboard.
// ==========================================

import DeliveryShopVisits from "../components/DeliveryShopVisits";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const VEHICLE_API =
  `${API_URL}/api/delivery/vehicles`;

const CLAIM_API =
  `${API_URL}/api/delivery/claims`;

const AUTH_KEY = "seventeen_auth";

const VEHICLE_KEY =
  "seventeen_delivery_vehicle";

const REFRESH_INTERVAL = 5000;

const GPS_INTERVAL = 30000;

// ==========================================
// SESSION HELPERS
// ==========================================

function readSession(key) {
  try {
    return JSON.parse(
      sessionStorage.getItem(key) || "null"
    );
  } catch {
    return null;
  }
}

function getToken() {
  const auth = readSession(AUTH_KEY);

  return (
    auth?.token ||
    auth?.accessToken ||
    auth?.jwt ||
    auth?.user?.token ||
    null
  );
}

function currentUser() {
  const auth = readSession(AUTH_KEY);

  return (
    auth?.fullName ||
    auth?.name ||
    auth?.user?.fullName ||
    auth?.email ||
    auth?.user?.email ||
    "Delivery Person"
  );
}

// ==========================================
// API REQUEST HELPER
// ==========================================

async function request(
  url,
  method = "GET",
  body = null,
  signal
) {
  const jwt = getToken();

  if (!jwt) {
    throw new Error(
      "Session expired. Please log in again."
    );
  }

  let response;

  try {
    response = await fetch(url, {
      method,
      signal,

      headers: {
        Authorization: `Bearer ${jwt}`,

        Accept: "application/json",

        ...(body !== null
          ? {
              "Content-Type": "application/json",
            }
          : {}),
      },

      ...(body !== null
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw err;
    }

    throw new Error(
      "Cannot connect to Spring Boot on port 8080."
    );
  }

  const responseText =
    await response.text();

  let data = null;

  try {
    data = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    if (response.ok) {
      throw new Error(
        "Spring Boot returned invalid JSON."
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your login session has expired."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "You do not have permission to access this delivery service."
      );
    }

    throw new Error(
      data?.message ||
      data?.detail ||
      (
        typeof data?.error === "string"
          ? data.error
          : null
      ) ||
      `Backend returned HTTP ${response.status}.`
    );
  }

  return data;
}

// ==========================================
// FORMATTING HELPERS
// ==========================================

function money(value) {
  if (value == null) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return `Rs. ${amount.toLocaleString(
    "en-LK",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-LK");
}

function normalizeStatus(value) {
  const status = String(
    value || "WAITING"
  )
    .trim()
    .toUpperCase();

  if (status === "ASSIGNED") {
    return "PROCESSING";
  }

  if (status === "IN_TRANSIT") {
    return "ON_THE_WAY";
  }

  if (status === "PLACED") {
    return "WAITING";
  }

  return status;
}

// ==========================================
// GPS VALIDATION
// ==========================================

function hasValidGps(
  latitude,
  longitude
) {
  if (
    latitude == null ||
    longitude == null ||
    latitude === "" ||
    longitude === ""
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ==========================================
// ORDER LOCATION HELPERS
// ==========================================

function getOrderId(order) {
  return (
    order?.orderId ??
    order?.wholesaleOrderId ??
    order?.id
  );
}

function getShopGps(order) {
  const nested =
    order?.deliveryLocation || {};

  const latitude =
    order?.deliveryLatitude ??
    order?.delivery_latitude ??
    nested.latitude ??
    order?.latitude ??
    null;

  const longitude =
    order?.deliveryLongitude ??
    order?.delivery_longitude ??
    nested.longitude ??
    order?.longitude ??
    null;

  return {
    latitude,
    longitude,
  };
}

function getDeliveryAddress(order) {
  const nested =
    order?.deliveryLocation || {};

  const explicit =
    order?.deliveryAddress ||
    order?.address ||
    "";

  if (String(explicit).trim()) {
    return String(explicit).trim();
  }

  const parts = [
    order?.deliveryStreetAddress ??
      nested.streetAddress,

    order?.deliveryCity ??
      nested.city,

    order?.deliveryProvince ??
      nested.province,

    order?.deliveryPostalCode ??
      nested.postalCode,
  ].filter(
    (value) =>
      value != null &&
      String(value).trim() !== ""
  );

  return parts.join(", ");
}

function hasDestination(order) {
  const {
    latitude,
    longitude,
  } = getShopGps(order);

  return (
    hasValidGps(latitude, longitude) ||
    Boolean(getDeliveryAddress(order))
  );
}

// ==========================================
// MERGE DELIVERY ORDERS WITH SHOP LOCATIONS
//
// EXISTING FUNCTIONALITY PRESERVED
// ==========================================

function mergeOrdersWithLocations(
  ordersData,
  locationsData
) {
  const locationsById = new Map();

  for (const location of locationsData) {
    const id = getOrderId(location);

    if (id != null) {
      locationsById.set(
        String(id),
        location
      );
    }
  }

  return ordersData.map((order) => {
    const orderId =
      getOrderId(order);

    const location =
      locationsById.get(
        String(orderId)
      ) || {};

    return {
      ...order,

      orderId,

      shopName:
        location.shopName ||
        order.shopName ||
        "Wholesale Shop",

      phone:
        location.phone ||
        order.phone ||
        null,

      deliveryAddress:
        getDeliveryAddress(location) ||
        getDeliveryAddress(order) ||
        null,

      deliveryLatitude:
        getShopGps(location).latitude ??
        getShopGps(order).latitude,

      deliveryLongitude:
        getShopGps(location).longitude ??
        getShopGps(order).longitude,

      items:
        Array.isArray(order.items)
          ? order.items
          : [],
    };
  });
}

// ==========================================
// STATUS BADGE
// ==========================================

function StatusBadge({ status }) {
  const displayStatus =
    normalizeStatus(status);

  const styles = {
    WAITING:
      "bg-gray-100 text-gray-700",

    PROCESSING:
      "bg-blue-100 text-blue-700",

    ON_THE_WAY:
      "bg-amber-100 text-amber-700",

    DELIVERED:
      "bg-green-100 text-green-700",

    CANCELLED:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={
        "rounded-full px-3 py-1 text-xs font-bold " +
        (
          styles[displayStatus] ||
          "bg-gray-100 text-gray-700"
        )
      }
    >
      {displayStatus.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

// ==========================================
// STATISTICS CARD
// ==========================================

function StatCard({
  icon: Icon,
  title,
  count,
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <Icon
        size={23}
        className="text-[#3654FF]"
      />

      <p className="mt-3 text-sm text-gray-500">
        {title}
      </p>

      <h3 className="text-3xl font-bold text-[#17265B]">
        {count}
      </h3>
    </div>
  );
}

// ==========================================
// MAIN DASHBOARD
// ==========================================

export default function DeliveryPersonDashboard() {
  const navigate = useNavigate();

  // ========================================
  // EXISTING STATE
  // ========================================

  const [vehicle, setVehicle] =
    useState(null);

  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [gpsStatus, setGpsStatus] =
    useState("Waiting for GPS");

  const [filter, setFilter] =
    useState("ALL");

  // ========================================
  // NEW: DASHBOARD SECTION STATE
  //
  // ORDERS:
  // Existing wholesale delivery orders.
  //
  // SHOP_VISITS:
  // Manually registered shop visits.
  //
  // The default page remains ORDERS.
  // ========================================

  const [
    deliveryPage,
    setDeliveryPage,
  ] = useState("ORDERS");

  // ========================================
  // EXISTING REFS
  // ========================================

  const gpsRef = useRef(null);

  const mounted = useRef(false);

  const actionBusy =
    useRef(false);

  const orderRequestRef =
    useRef(null);

  // ========================================
  // LOAD ORDERS AND LOCATIONS
  //
  // EXISTING FUNCTIONALITY PRESERVED
  // ========================================

  const loadOrders = useCallback(
    async (
      manualRefresh = false,
      showError = true
    ) => {

      // Prevent overlapping polling requests.

      if (orderRequestRef.current) {
        return;
      }

      const controller =
        new AbortController();

      orderRequestRef.current =
        controller;

      if (
        manualRefresh &&
        mounted.current
      ) {
        setRefreshing(true);
      }

      try {
        const results =
          await Promise.allSettled([
            request(
              `${CLAIM_API}/orders`,
              "GET",
              null,
              controller.signal
            ),

            request(
              `${CLAIM_API}/order-locations`,
              "GET",
              null,
              controller.signal
            ),
          ]);

        if (
          !mounted.current ||
          controller.signal.aborted
        ) {
          return;
        }

        const [
          ordersResult,
          locationsResult,
        ] = results;

        if (
          ordersResult.status ===
          "rejected"
        ) {
          throw ordersResult.reason;
        }

        const ordersData =
          ordersResult.value;

        if (!Array.isArray(ordersData)) {
          throw new Error(
            "Invalid order response from Spring Boot."
          );
        }

        let locationsData = [];

        let locationWarning = "";

        if (
          locationsResult.status ===
            "fulfilled" &&
          Array.isArray(
            locationsResult.value
          )
        ) {
          locationsData =
            locationsResult.value;
        } else {
          locationWarning =
            locationsResult.status ===
            "rejected"
              ? (
                  locationsResult.reason
                    ?.message ||
                  "Unable to load shop locations."
                )
              : "Invalid shop location response.";
        }

        const mergedOrders =
          mergeOrdersWithLocations(
            ordersData,
            locationsData
          );

        setOrders(mergedOrders);

        setLocationError(
          locationWarning
        );

        if (showError) {
          setError("");
        }
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          mounted.current &&
          showError
        ) {
          setError(
            err.message ||
            "Unable to load delivery orders."
          );
        }
      } finally {
        if (
          orderRequestRef.current ===
          controller
        ) {
          orderRequestRef.current = null;
        }

        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  // ========================================
  // INITIALIZE SELECTED VEHICLE
  //
  // EXISTING FUNCTIONALITY PRESERVED
  // ========================================

  useEffect(() => {
    mounted.current = true;

    let active = true;

    const controller =
      new AbortController();

    let pollingInterval = null;

    async function initialize() {
      if (!getToken()) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      try {
        const selected =
          await request(
            `${VEHICLE_API}/selected`,
            "GET",
            null,
            controller.signal
          );

        if (!active) {
          return;
        }

        if (!selected?.vehicleId) {
          sessionStorage.removeItem(
            VEHICLE_KEY
          );

          navigate(
            "/delivery/select-vehicle",
            {
              replace: true,
            }
          );

          return;
        }

        setVehicle(selected);

        sessionStorage.setItem(
          VEHICLE_KEY,
          JSON.stringify(selected)
        );

        await loadOrders();

        if (!active) {
          return;
        }

        // Wholesale order polling remains active
        // while either dashboard tab is selected.
        //
        // Manual shop visits do not interfere
        // with order polling.

        pollingInterval = setInterval(
          () => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              loadOrders(false, false);
            }
          },
          REFRESH_INTERVAL
        );
      } catch (err) {
        if (
          !active ||
          err.name === "AbortError"
        ) {
          return;
        }

        setError(err.message);
        setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;

      mounted.current = false;

      controller.abort();

      if (pollingInterval) {
        clearInterval(
          pollingInterval
        );
      }

      if (
        orderRequestRef.current
      ) {
        orderRequestRef.current.abort();

        orderRequestRef.current =
          null;
      }
    };
  }, [
    navigate,
    loadOrders,
  ]);

  // ========================================
  // GPS LOCATION TRACKING
  //
  // EXISTING FUNCTIONALITY PRESERVED
  //
  // This tracks the selected delivery vehicle.
  //
  // Manual shop visits use their own GPS
  // capture inside DeliveryShopVisits.jsx.
  // ========================================

  useEffect(() => {
    if (!vehicle?.vehicleId) {
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus(
        "GPS is not supported by this browser."
      );

      return;
    }

    let active = true;
    let pending = false;

    async function sendLocation(position) {
      const coordinates = {
        latitude:
          position.coords.latitude,

        longitude:
          position.coords.longitude,
      };

      gpsRef.current =
        coordinates;

      try {
        await request(
          `${VEHICLE_API}/location`,
          "POST",
          coordinates
        );

        if (active) {
          setGpsStatus(
            "GPS connected"
          );
        }
      } catch (err) {
        if (active) {
          setGpsStatus(
            `GPS update failed: ${err.message}`
          );
        }
      } finally {
        pending = false;
      }
    }

    function updateGps() {
      if (
        !active ||
        pending
      ) {
        return;
      }

      pending = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) {
            pending = false;
            return;
          }

          sendLocation(position);
        },

        (err) => {
          if (active) {
            setGpsStatus(
              `Location unavailable: ${err.message}`
            );
          }

          pending = false;
        },

        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 20000,
        }
      );
    }

    updateGps();

    const interval = setInterval(
      updateGps,
      GPS_INTERVAL
    );

    return () => {
      active = false;

      clearInterval(
        interval
      );
    };
  }, [
    vehicle?.vehicleId,
  ]);

  // ========================================
  // OPEN GOOGLE MAPS ROUTE
  //
  // EXISTING WHOLESALE FEATURE PRESERVED
  // ========================================

  function openRoute(order) {
    const {
      latitude,
      longitude,
    } = getShopGps(order);

    const address =
      getDeliveryAddress(order);

    let destination = "";

    if (
      hasValidGps(
        latitude,
        longitude
      )
    ) {
      destination =
        `${Number(latitude)},` +
        `${Number(longitude)}`;
    } else if (address) {
      destination = address;
    } else {
      setError(
        `Order #${getOrderId(order)} has no saved ` +
        "delivery address or GPS coordinates."
      );

      return;
    }

    const params =
      new URLSearchParams({
        api: "1",
        destination,
        travelmode: "driving",
        dir_action: "navigate",
      });

    const currentLocation =
      gpsRef.current;

    if (
      currentLocation &&
      hasValidGps(
        currentLocation.latitude,
        currentLocation.longitude
      )
    ) {
      params.set(
        "origin",
        `${currentLocation.latitude},` +
        `${currentLocation.longitude}`
      );
    }

    const mapsUrl =
      "https://www.google.com/maps/dir/?" +
      params.toString();

    setError("");

    const opened =
      window.open(
        mapsUrl,
        "_blank"
      );

    if (opened) {
      opened.opener = null;
    } else {
      window.location.assign(
        mapsUrl
      );
    }
  }

  // ========================================
  // CLAIM / UPDATE ORDER STATUS
  //
  // EXISTING WHOLESALE FEATURE PRESERVED
  // ========================================

  async function updateOrder(
    orderId,
    action
  ) {
    if (actionBusy.current) {
      return;
    }

    actionBusy.current = true;

    setBusyId(orderId);

    setError("");

    try {
      await request(
        `${CLAIM_API}/orders/${orderId}/${action}`,
        "POST"
      );

      await loadOrders(true);
    } catch (err) {
      setError(err.message);

      await loadOrders(
        false,
        false
      );
    } finally {
      actionBusy.current = false;

      setBusyId(null);
    }
  }

  // ========================================
  // CHANGE VEHICLE
  //
  // EXISTING FUNCTIONALITY PRESERVED
  // ========================================

  async function changeVehicle() {
    if (actionBusy.current) {
      return;
    }

    actionBusy.current = true;

    try {
      await request(
        `${VEHICLE_API}/selection`,
        "DELETE"
      );

      sessionStorage.removeItem(
        VEHICLE_KEY
      );

      navigate(
        "/delivery/select-vehicle",
        {
          replace: true,
        }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      actionBusy.current = false;
    }
  }

  // ========================================
  // LOGOUT
  //
  // EXISTING FUNCTIONALITY PRESERVED
  // ========================================

  function logout() {
    sessionStorage.removeItem(
      AUTH_KEY
    );

    sessionStorage.removeItem(
      VEHICLE_KEY
    );

    sessionStorage.removeItem(
      "seventeen_delivery_shift"
    );

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  // ========================================
  // STATISTICS
  //
  // EXISTING WHOLESALE STATISTICS PRESERVED
  // ========================================

  const countStatus = (target) =>
    orders.filter(
      (order) =>
        normalizeStatus(
          order.status
        ) === target
    ).length;

  const stats = [
    {
      title: "Waiting",
      count: countStatus("WAITING"),
      icon: Clock3,
    },

    {
      title: "Processing",
      count: countStatus("PROCESSING"),
      icon: Package,
    },

    {
      title: "On the Way",
      count: countStatus("ON_THE_WAY"),
      icon: Truck,
    },

    {
      title: "Delivered",
      count: countStatus("DELIVERED"),
      icon: CheckCircle2,
    },
  ];

  const visibleOrders =
    orders.filter(
      (order) =>
        filter === "ALL" ||
        normalizeStatus(
          order.status
        ) === filter
    );

  // ========================================
  // NEW: SELECTED VEHICLE NUMBER
  //
  // Passed to DeliveryShopVisits.jsx.
  //
  // That component saves it along with
  // manually registered shop details.
  // ========================================

  const selectedVehicleNumber =
    vehicle?.vehicleNumber || "";

  // ========================================
  // RENDER DASHBOARD
  // ========================================

  return (
    <div className="min-h-screen bg-[#FFF9F3]">

      {/* ======================================
          HEADER - PRESERVED
      ====================================== */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-[#3654FF] p-3 text-white">
              <Truck size={26} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-[#17265B]">
                Delivery Vehicle Dashboard
              </h1>

              <p className="text-sm text-gray-500">
                Seventeen Ice Cream
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserRound size={18} />
              {currentUser()}
            </div>

            <button
              type="button"
              onClick={changeVehicle}
              className="flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50"
            >
              <ArrowLeft size={16} />

              Change Vehicle
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100"
            >
              <LogOut size={16} />

              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-5">

        {/* ====================================
            VEHICLE DETAILS - PRESERVED
        ==================================== */}

        <div className="flex flex-wrap justify-between gap-4 rounded-2xl bg-[#17265B] p-6 text-white">

          <div>
            <p className="text-sm text-blue-200">
              Selected Delivery Vehicle
            </p>

            <h2 className="text-3xl font-bold">
              {selectedVehicleNumber ||
                "Loading..."}
            </h2>

            <p className="mt-2 text-sm">
              <Navigation
                size={15}
                className="mr-2 inline"
              />

              {gpsStatus}
            </p>
          </div>

          <div className="text-sm text-blue-100">

            <p>
              New unclaimed orders are shared
              between delivery vehicles.
            </p>

            <p>
              Orders refresh every 5 seconds.
            </p>
          </div>
        </div>

        {/* ====================================
            STATISTICS - PRESERVED
        ==================================== */}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              count={stat.count}
              icon={stat.icon}
            />
          ))}
        </div>

        {/* ====================================
            GLOBAL ERROR - PRESERVED
        ==================================== */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            <AlertCircle
              size={20}
              className="shrink-0"
            />

            <div>
              <p className="font-semibold">
                Unable to complete request
              </p>

              <p className="mt-1 text-sm">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ====================================
            NEW: DELIVERY DASHBOARD TABS

            1. Wholesale Delivery Orders
            2. Manual Shop Visits & Map

            Existing wholesale page remains
            the default view.
        ==================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex flex-wrap gap-3">

            {/* EXISTING WHOLESALE ORDERS */}

            <button
              type="button"
              onClick={() =>
                setDeliveryPage("ORDERS")
              }
              aria-pressed={
                deliveryPage === "ORDERS"
              }
              className={
                "flex items-center justify-center gap-2 " +
                "rounded-xl px-5 py-3 text-sm font-bold " +
                (
                  deliveryPage === "ORDERS"
                    ? "bg-[#3654FF] text-white"
                    : "border border-slate-200 bg-white text-[#17265B] hover:bg-slate-50"
                )
              }
            >
              <Truck size={18} />

              Wholesale Delivery Orders
            </button>

            {/* NEW MANUAL SHOP VISITS */}

            <button
              type="button"
              onClick={() =>
                setDeliveryPage("SHOP_VISITS")
              }
              aria-pressed={
                deliveryPage === "SHOP_VISITS"
              }
              className={
                "flex items-center justify-center gap-2 " +
                "rounded-xl px-5 py-3 text-sm font-bold " +
                (
                  deliveryPage === "SHOP_VISITS"
                    ? "bg-[#3654FF] text-white"
                    : "border border-slate-200 bg-white text-[#17265B] hover:bg-slate-50"
                )
              }
            >
              <Store size={18} />

              Manual Shop Visits & Map
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {deliveryPage === "ORDERS"
              ? (
                  "Manage wholesale customer orders, " +
                  "delivery assignments and delivery status."
                )
              : (
                  "Register shops visited outside " +
                  "wholesale orders and save their " +
                  "locations as map pins."
                )}
          </p>
        </div>

        {/* ====================================
            WHOLESALE DELIVERY ORDERS

            EVERYTHING BELOW THIS SECTION
            IS THE EXISTING ORDER INTERFACE.

            It is displayed only when the
            Wholesale Delivery Orders tab
            is selected.
        ==================================== */}

        {deliveryPage === "ORDERS" && (
          <div className="space-y-6">

            {/* LOCATION API WARNING */}

            {locationError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
              >
                <AlertCircle
                  size={20}
                  className="shrink-0"
                />

                <div>
                  <p className="font-semibold">
                    Shop locations could not be fully loaded
                  </p>

                  <p className="mt-1 text-sm">
                    {locationError}
                  </p>

                  <p className="mt-1 text-xs">
                    Delivery orders remain visible,
                    but addresses and Google Maps routes
                    may be unavailable.
                  </p>
                </div>
              </div>
            )}

            {/* ==================================
                ORDERS HEADER - PRESERVED
            ================================== */}

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <h2 className="text-2xl font-bold text-[#17265B]">
                  Wholesale Delivery Orders
                </h2>

                <p className="text-sm text-gray-500">
                  Available orders and deliveries
                  assigned to your vehicle
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadOrders(true)
                }
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-[#3654FF] shadow-sm disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh Orders
              </button>
            </div>

            {/* ==================================
                STATUS FILTERS - PRESERVED
            ================================== */}

            <div className="flex flex-wrap gap-2">

              {[
                "ALL",
                "WAITING",
                "PROCESSING",
                "ON_THE_WAY",
                "DELIVERED",
              ].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setFilter(status)
                  }
                  className={
                    "rounded-xl px-4 py-2 text-sm font-semibold " +
                    (
                      filter === status
                        ? "bg-[#3654FF] text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    )
                  }
                >
                  {status.replaceAll(
                    "_",
                    " "
                  )}
                </button>
              ))}
            </div>

            {/* ==================================
                ORDER LIST - PRESERVED
            ================================== */}

            {loading ? (
              <div className="rounded-2xl bg-white p-12 text-center text-gray-500">
                Loading wholesale delivery orders...
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center">

                <Package
                  size={48}
                  className="mx-auto mb-4 text-gray-300"
                />

                <h3 className="text-lg font-bold text-[#17265B]">
                  No Orders Found
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  No wholesale delivery orders
                  match this filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-5">

                {visibleOrders.map((order) => {

                  const status =
                    normalizeStatus(
                      order.status
                    );

                  const orderId =
                    getOrderId(order);

                  const shopGps =
                    getShopGps(order);

                  const routeAvailable =
                    hasDestination(order);

                  return (
                    <div
                      key={orderId}
                      className="overflow-hidden rounded-2xl bg-white shadow-sm"
                    >

                      {/* ========================
                          ORDER HEADER
                      ======================== */}

                      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-5">

                        <div>
                          <h3 className="font-bold text-[#17265B]">
                            Order #{orderId}
                          </h3>

                          <p className="text-sm text-gray-500">
                            {order.shopName ||
                              "Wholesale Shop"}
                          </p>
                        </div>

                        <StatusBadge
                          status={order.status}
                        />
                      </div>

                      <div className="space-y-5 p-5">

                        {/* ======================
                            SHOP AND ASSIGNMENT
                        ====================== */}

                        <div className="grid gap-5 md:grid-cols-2">

                          {/* WHOLESALE SHOP */}

                          <div>
                            <h4 className="font-semibold text-[#17265B]">
                              Wholesale Shop Details
                            </h4>

                            <p className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                              <MapPin
                                size={17}
                                className="shrink-0"
                              />

                              <span>
                                {order.deliveryAddress ||
                                  "Delivery address not provided"}
                              </span>
                            </p>

                            <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">

                              <Phone size={17} />

                              {order.phone ? (
                                <a
                                  href={`tel:${order.phone}`}
                                  className="font-semibold text-[#3654FF] hover:underline"
                                >
                                  {order.phone}
                                </a>
                              ) : (
                                "Phone not provided"
                              )}
                            </p>

                            {hasValidGps(
                              shopGps.latitude,
                              shopGps.longitude
                            ) && (
                              <p className="mt-3 text-xs text-gray-500">
                                <strong>
                                  Shop GPS:
                                </strong>{" "}

                                {Number(
                                  shopGps.latitude
                                ).toFixed(6)},
                                {" "}
                                {Number(
                                  shopGps.longitude
                                ).toFixed(6)}
                              </p>
                            )}

                            {!routeAvailable && (
                              <p className="mt-3 text-xs font-medium text-amber-700">
                                This order has no saved
                                delivery destination.
                                Confirm the shop location
                                before travelling.
                              </p>
                            )}
                          </div>

                          {/* DELIVERY ASSIGNMENT */}

                          <div>
                            <h4 className="font-semibold text-[#17265B]">
                              Delivery Assignment
                            </h4>

                            <p className="mt-3 text-sm text-gray-600">
                              <strong>
                                Vehicle:
                              </strong>{" "}

                              {order.vehicleNumber ||
                                "Not claimed yet"}
                            </p>

                            <p className="mt-2 text-sm text-gray-600">
                              <strong>
                                Claimed By User ID:
                              </strong>{" "}

                              {order.claimedByUserId ??
                                "—"}
                            </p>

                            {order.claimedAt && (
                              <p className="mt-2 text-sm text-gray-600">
                                <strong>
                                  Claimed At:
                                </strong>{" "}

                                {formatDate(
                                  order.claimedAt
                                )}
                              </p>
                            )}

                            {order.startedAt && (
                              <p className="mt-2 text-sm text-gray-600">
                                <strong>
                                  Started At:
                                </strong>{" "}

                                {formatDate(
                                  order.startedAt
                                )}
                              </p>
                            )}

                            {order.deliveredAt && (
                              <p className="mt-2 text-sm text-gray-600">
                                <strong>
                                  Delivered At:
                                </strong>{" "}

                                {formatDate(
                                  order.deliveredAt
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* ======================
                            ORDER PRODUCTS
                        ====================== */}

                        <div>
                          <h4 className="mb-3 font-semibold text-[#17265B]">
                            Ordered Ice Cream Products
                          </h4>

                          <div className="overflow-x-auto rounded-xl border">

                            <table className="w-full min-w-[420px] text-sm">

                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="p-3 text-left">
                                    Product
                                  </th>

                                  <th className="p-3 text-left">
                                    Quantity
                                  </th>

                                  <th className="p-3 text-right">
                                    Subtotal
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {order.items.length > 0 ? (
                                  order.items.map(
                                    (item, index) => (
                                      <tr
                                        key={
                                          item.id ??
                                          index
                                        }
                                        className="border-t"
                                      >
                                        <td className="p-3">
                                          {item.productName ||
                                            item.productId ||
                                            "Product"}

                                          {(item.flavour ||
                                            item.selectedFlavour)
                                            ? ` - ${
                                                item.flavour ||
                                                item.selectedFlavour
                                              }`
                                            : ""}
                                        </td>

                                        <td className="p-3">
                                          {item.quantity ??
                                            "—"}
                                        </td>

                                        <td className="p-3 text-right">
                                          {money(
                                            item.subtotal ??
                                            item.lineTotal
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  )
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={3}
                                      className="p-5 text-center text-gray-500"
                                    >
                                      Product details
                                      are not available
                                      from the backend.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* ======================
                            PAYMENT DETAILS
                        ====================== */}

                        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#FFF9F3] p-4">

                          <div>
                            <p className="text-xs text-gray-500">
                              Order Total
                            </p>

                            <p className="text-xl font-bold text-[#17265B]">
                              {money(
                                order.finalTotal ??
                                order.totalAmount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              <CreditCard
                                size={17}
                              />

                              {order.paymentMethod ||
                                "Payment method unavailable"}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {order.paymentStatus ||
                                "Payment status unavailable"}
                            </p>
                          </div>
                        </div>

                        {/* ======================
                            DELIVERY ACTIONS
                        ====================== */}

                        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">

                          {/* GOOGLE MAPS ROUTE */}

                          <button
                            type="button"
                            onClick={() =>
                              openRoute(order)
                            }
                            title={
                              routeAvailable
                                ? "Open directions in Google Maps"
                                : "Shop delivery location is missing"
                            }
                            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 font-semibold text-[#3654FF] hover:bg-blue-50"
                          >
                            <Navigation
                              size={17}
                            />

                            Show Route
                          </button>

                          {/* CLAIM ORDER */}

                          {status === "WAITING" && (
                            <button
                              type="button"
                              disabled={
                                busyId !== null
                              }
                              onClick={() =>
                                updateOrder(
                                  orderId,
                                  "claim"
                                )
                              }
                              className="rounded-xl bg-[#3654FF] px-5 py-2 font-semibold text-white disabled:opacity-50"
                            >
                              {busyId === orderId
                                ? "Claiming..."
                                : "Claim Order"}
                            </button>
                          )}

                          {/* PROCESSING */}

                          {status === "PROCESSING" && (
                            <button
                              type="button"
                              disabled={
                                busyId !== null
                              }
                              onClick={() =>
                                updateOrder(
                                  orderId,
                                  "on-the-way"
                                )
                              }
                              className="rounded-xl bg-amber-500 px-5 py-2 font-semibold text-white disabled:opacity-50"
                            >
                              {busyId === orderId
                                ? "Updating..."
                                : "Mark On the Way"}
                            </button>
                          )}

                          {/* ON THE WAY */}

                          {status === "ON_THE_WAY" && (
                            <button
                              type="button"
                              disabled={
                                busyId !== null
                              }
                              onClick={() =>
                                updateOrder(
                                  orderId,
                                  "delivered"
                                )
                              }
                              className="rounded-xl bg-green-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
                            >
                              {busyId === orderId
                                ? "Updating..."
                                : "Mark Delivered"}
                            </button>
                          )}

                          {/* DELIVERED */}

                          {status === "DELIVERED" && (
                            <span className="flex items-center gap-2 font-semibold text-green-700">

                              <CheckCircle2
                                size={19}
                              />

                              Delivery Completed
                            </span>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ====================================
            NEW: MANUAL SHOP VISITS PAGE

            Rendered when SHOP_VISITS is selected.

            DeliveryShopVisits handles:
            - Shop registration
            - Shop address and phone
            - Contact person
            - Visit notes
            - Current GPS location
            - Manual map pin placement
            - Saving shops to PostgreSQL
            - Displaying saved map markers
            - Viewing saved shop visits

            This does not create or modify
            any wholesale orders.
        ==================================== */}

        {deliveryPage === "SHOP_VISITS" && (
          <DeliveryShopVisits
            vehicleNumber={
              selectedVehicleNumber
            }
          />
        )}

      </main>
    </div>
  );
}
