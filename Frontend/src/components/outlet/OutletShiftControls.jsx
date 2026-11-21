
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import {
  Clock3,
  Play,
  Square,
  RefreshCw,
} from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

function getToken() {
  try {
    const auth = JSON.parse(
      sessionStorage.getItem("seventeen_auth") || "null"
    );

    return (
      auth?.token ||
      auth?.accessToken ||
      auth?.jwt ||
      auth?.user?.token ||
      null
    );
  } catch {
    return null;
  }
}

async function shiftRequest(path, method = "GET") {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Login session missing. Please sign in again."
    );
  }

  const response = await fetch(
    `${API_BASE}/api/outlet/shifts${path}`,
    {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your login has expired. Please sign in again."
      );
    }

    throw new Error(
      data?.detail ||
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function OutletShiftControls({
  onLogout,
}) {
  const [shift, setShift] = useState(null);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  const [exiting, setExiting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const checkShift = useCallback(async () => {
    setChecking(true);
    setError("");

    try {
      const result = await shiftRequest("/active");
      setShift(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkShift();
  }, [checkShift]);

  async function startShift() {
    if (working || checking) return;

    const confirmed = window.confirm(
      "Start your Outlet Manager work shift now?"
    );

    if (!confirmed) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const result = await shiftRequest(
        "/start",
        "POST"
      );

      setShift(result);

      setMessage(
        "Shift started successfully. " +
        "Your start time has been recorded."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

async function handleExitOutlet() {
  if (exiting || working || checking) return;

  const confirmed = window.confirm(
    "Are you leaving the outlet?\n\n" +
    "If your work shift is active, the system will " +
    "record your ending time and calculate your " +
    "working hours before logging you out."
  );

  if (!confirmed) return;

  setExiting(true);
  setError("");
  setMessage("");

  try {
    // STEP 1: If currently on duty, end the shift.
    if (shift?.active) {
      const result = await shiftRequest(
        "/end",
        "POST"
      );

      const totalSeconds = Number(
        result.workSeconds || 0
      );

      const hours = Math.floor(
        totalSeconds / 3600
      );

      const minutes = Math.floor(
        (totalSeconds % 3600) / 60
      );

      // STEP 2: Confirm saved working duration.
      window.alert(
        "Your work shift has ended successfully.\n\n" +
        `Working Date: ${result.shiftDate}\n` +
        `Working Duration: ${hours}h ${minutes}m`
      );
    }

    // STEP 3: Clear authentication using
    // the existing application's logout logic.
    if (typeof onLogout !== "function") {
      throw new Error(
        "Logout is not configured. " +
        "Please connect the existing AuthContext logout function."
      );
    }

    await onLogout();

    // STEP 4: Return to login page.
    navigate("/login", {
      replace: true,
    });

  } catch (err) {
    setError(
      err.message ||
      "Unable to exit the outlet. Please try again."
    );
  } finally {
    setExiting(false);
  }
}


  async function endShift() {
    if (working || checking) return;

    const confirmed = window.confirm(
      "End your work shift now?\n\n" +
      "The system will save your end time " +
      "and calculate your working duration."
    );

    if (!confirmed) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const result = await shiftRequest(
        "/end",
        "POST"
      );

      setShift({ active: false });

      setMessage(
        `Shift completed on ${result.shiftDate}. ` +
        `Total working time: ${
          formatDuration(result.workSeconds)
        }.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  const active = Boolean(shift?.active);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>
          <div className="flex items-center gap-2">
            <Clock3
              size={21}
              className="text-[#3654FF]"
            />

            <h2 className="text-lg font-bold text-[#17265B]">
              Outlet Manager Work Shift
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {checking
              ? "Checking your shift..."
              : active
                ? "You are currently on duty."
                : "Start your shift when you arrive at work."}
          </p>

          {active && (
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>
                <strong>Outlet:</strong>{" "}
                {shift.outletName}
              </p>

              <p>
                <strong>Working Date:</strong>{" "}
                {shift.shiftDate}
              </p>

              <p>
                <strong>Started:</strong>{" "}
                {formatDateTime(shift.startedAt)}
              </p>

              <p>
                <strong>Elapsed at last check:</strong>{" "}
                {formatDuration(shift.elapsedSeconds)}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={checkShift}
            disabled={working || checking}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#17265B] disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          {!active && (
            <button
              type="button"
              onClick={startShift}
              disabled={working || checking || Boolean(error)}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Play size={17} />

              {working
                ? "Starting..."
                : "Start Shift"}
            </button>
          )}

          {active && (
            <button
              type="button"
              onClick={endShift}
              disabled={working || checking}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Square size={17} />

              {working
                ? "Ending..."
                : "End Shift"}
            </button>
          )}

          <button
            type="button"
            onClick={handleExitOutlet}
            disabled={exiting || working || checking}
            className={
              "flex items-center gap-2 rounded-xl " +
              "bg-[#17265B] px-5 py-3 text-sm " +
              "font-bold text-white " +
              "hover:bg-[#243A82] " +
              "disabled:cursor-not-allowed " +
              "disabled:opacity-50"
            }
          >
            <LogOut size={17} />

            {exiting
              ? "Exiting Outlet..."
              : "Exit Outlet & Logout"}
          </button>


        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700"
        >
          {message}
        </p>
      )}
    </section>
  );
}
