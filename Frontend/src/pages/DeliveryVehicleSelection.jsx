
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Truck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Loader2,
  LogOut,
  MapPin,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8080";

const AUTH_STORAGE_KEY = "seventeen_auth";
const VEHICLE_STORAGE_KEY = "seventeen_delivery_vehicle";
const OLD_SHIFT_STORAGE_KEY = "seventeen_delivery_shift";

// ==========================================
// AVAILABLE DELIVERY VEHICLES
// ==========================================

const vehicles = [
  {
    id: 1,
    vehicleNumber: "LA-2398",
    vehicleName: "Delivery Vehicle 1",
    vehicleType: "Refrigerated Delivery Van",
  },
  {
    id: 2,
    vehicleNumber: "LA-2099",
    vehicleName: "Delivery Vehicle 2",
    vehicleType: "Refrigerated Delivery Van",
  },
];

// ==========================================
// READ STORED JSON SAFELY
// ==========================================

function readStoredJSON(key) {
  try {
    const value = sessionStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ==========================================
// NORMALIZE VEHICLE NUMBER
// ==========================================

function normalizeVehicleNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

// ==========================================
// READ BACKEND RESPONSE
// ==========================================

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

// ==========================================
// HANDLE API ERRORS
// ==========================================

function getRequestError(response, body) {
  const backendMessage =
    body?.message ||
    body?.detail ||
    body?.error;

  if (response.status === 401) {
    return new Error(
      "Your login session has expired. Please log in again."
    );
  }

  if (response.status === 403) {
    return new Error(
      "You do not have permission to select a delivery vehicle."
    );
  }

  if (response.status === 404) {
    return new Error(
      "The selected delivery vehicle was not found."
    );
  }

  if (response.status === 409) {
    return new Error(
      backendMessage ||
        "Vehicle selection conflict. Please try again."
    );
  }

  if (response.status === 400) {
    return new Error(
      backendMessage ||
        "Invalid vehicle selection."
    );
  }

  if (response.status >= 500) {
    return new Error(
      "Backend server error. Please try again later."
    );
  }

  return new Error(
    backendMessage ||
      "Unable to select the delivery vehicle."
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function DeliveryVehicleSelection({
  onLogout,
}) {
  const navigate = useNavigate();

  const [selectedVehicle, setSelectedVehicle] =
    useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // SELECT DELIVERY VEHICLE
  // ==========================================

  const handleVehicleSelection = async () => {
    if (!selectedVehicle) {
      setError("Please select your delivery vehicle.");
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // STEP 1: READ LOGIN DETAILS

      const auth = readStoredJSON(AUTH_STORAGE_KEY);

      if (!auth?.token) {
        throw new Error(
          "Authentication token is missing. Please log in again."
        );
      }

      // STEP 2: GET SELECTED VEHICLE

      const vehicleNumber = normalizeVehicleNumber(
        selectedVehicle.vehicleNumber
      );

      // STEP 3: SEND SELECTION TO BACKEND
      // No shift token or resume endpoint.

      const response = await fetch(
        `${API_BASE_URL}/api/delivery/vehicles/select`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            vehicleNumber,
          }),
        }
      );

      const data = await readResponseBody(response);

      // STEP 4: HANDLE BACKEND ERRORS

      if (!response.ok) {
        throw getRequestError(response, data);
      }

      // STEP 5: VALIDATE BACKEND RESPONSE

      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        throw new Error(
          "The backend returned an invalid vehicle response."
        );
      }

      const returnedVehicleNumber =
        normalizeVehicleNumber(data.vehicleNumber);

      const returnedVehicleId =
        data.vehicleId;

      if (!returnedVehicleNumber) {
        throw new Error(
          "The backend did not return the selected vehicle number."
        );
      }

      if (returnedVehicleId == null) {
        throw new Error(
          "The backend did not return the selected vehicle ID."
        );
      }

      if (returnedVehicleNumber !== vehicleNumber) {
        throw new Error(
          "The backend returned a different vehicle than the one selected."
        );
      }

      // STEP 6: SAVE VEHICLE INFORMATION

      sessionStorage.setItem(
        VEHICLE_STORAGE_KEY,
        JSON.stringify({
          vehicleId: returnedVehicleId,
          vehicleNumber: returnedVehicleNumber,
          vehicleName: selectedVehicle.vehicleName,
          vehicleType: selectedVehicle.vehicleType,
        })
      );

      // Remove obsolete shift data from this browser.
      // This does not end any old backend shift.

      sessionStorage.removeItem(
        OLD_SHIFT_STORAGE_KEY
      );

      // STEP 7: OPEN DELIVERY DASHBOARD

      navigate("/delivery/dashboard", {
        replace: true,
      });

    } catch (err) {
      console.error(
        "Delivery vehicle selection failed:",
        err?.message
      );

      setError(
        err?.message ||
          "Vehicle selection failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGOUT DELIVERY PERSON
  // ==========================================

  const handleLogout = () => {
    sessionStorage.removeItem(
      VEHICLE_STORAGE_KEY
    );

    if (typeof onLogout === "function") {
      onLogout();
    } else {
      sessionStorage.removeItem(
        AUTH_STORAGE_KEY
      );

      navigate("/login", {
        replace: true,
      });
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* HEADER */}

      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#75DADD] px-6 py-5 shadow-sm">

        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-800">
            Frosty
            <span className="text-pink-500">
              Delights
            </span>
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Seventeen Ice Cream Delivery Management
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          <LogOut size={18} />
          Logout
        </button>

      </header>

      {/* MAIN CONTENT */}

      <main className="mx-auto max-w-5xl px-5 py-12">

        {/* PAGE TITLE */}

        <div className="mb-10 text-center">

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100">
            <Truck
              size={32}
              className="text-cyan-600"
            />
          </div>

          <h2 className="font-serif text-3xl font-bold text-slate-800">
            Select Your Delivery Vehicle
          </h2>

          <p className="mt-3 text-slate-500">
            Choose the vehicle you will be using for deliveries.
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Multiple delivery persons can select the same
            vehicle and view its assigned wholesale orders.
          </p>

        </div>

        {/* VEHICLE SELECTION CARDS */}

        <div className="grid gap-6 md:grid-cols-2">

          {vehicles.map((vehicle) => {
            const isSelected =
              selectedVehicle?.vehicleNumber ===
              vehicle.vehicleNumber;

            return (
              <button
                key={vehicle.vehicleNumber}
                type="button"
                disabled={loading}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedVehicle(vehicle);
                  setError("");
                }}
                className={`rounded-2xl border-2 bg-white p-7 text-left shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-slate-200 hover:border-cyan-300"
                }`}
              >

                {/* VEHICLE ICON */}

                <div className="flex items-start justify-between">

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-100">
                    <Truck
                      size={32}
                      className="text-cyan-600"
                    />
                  </div>

                  {isSelected ? (
                    <CheckCircle2
                      size={28}
                      className="text-green-500"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full border-2 border-slate-300" />
                  )}

                </div>

                {/* VEHICLE DETAILS */}

                <h3 className="mt-6 text-xl font-bold text-slate-800">
                  {vehicle.vehicleName}
                </h3>

                <p className="mt-2 text-lg font-semibold text-cyan-600">
                  {vehicle.vehicleNumber}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {vehicle.vehicleType}
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={17} />
                  GPS tracking supported
                </div>

                {/* SELECTION STATUS */}

                <div
                  className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                    isSelected
                      ? "bg-cyan-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isSelected
                    ? "Selected Vehicle"
                    : "Select This Vehicle"}
                </div>

              </button>
            );
          })}

        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div
            role="alert"
            className="mt-8 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={20}
              className="shrink-0"
            />

            <span>{error}</span>
          </div>
        )}

        {/* SELECTED VEHICLE SUMMARY */}

        {selectedVehicle && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

            <h3 className="font-semibold text-slate-800">
              Selected Vehicle
            </h3>

            <p className="mt-2 text-slate-600">
              {selectedVehicle.vehicleName}
              {" — "}
              <span className="font-bold text-cyan-600">
                {selectedVehicle.vehicleNumber}
              </span>
            </p>

            <p className="mt-3 text-xs text-slate-400">
              Continue to view the wholesale orders
              assigned to this vehicle.
            </p>

          </div>
        )}

        {/* CONTINUE BUTTON */}

        <button
          type="button"
          onClick={handleVehicleSelection}
          disabled={!selectedVehicle || loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-500 px-6 py-4 text-lg font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2
                size={21}
                className="animate-spin"
              />
              Connecting to Vehicle...
            </>
          ) : (
            <>
              Continue to Delivery Dashboard
              <ArrowRight size={21} />
            </>
          )}
        </button>

        <p className="mt-5 text-center text-xs text-slate-400">
          Both delivery vehicles remain available for
          selection. Multiple authorized delivery persons
          may use the same vehicle.
        </p>

      </main>
    </div>
  );
}
