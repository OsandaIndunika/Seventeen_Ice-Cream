
/**
 * SALES VEHICLE API SERVICE
 * Seventeen Ice Cream Management System
 *
 * Frontend: React + Vite
 * Backend: Spring Boot
 *
 * Existing API methods and routes preserved.
 *
 * Bank transfer approval belongs to Admin.
 * Sales Manager can only view payment status.
 */

// ==========================================
// 1. API CONFIGURATION
// ==========================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const AUTH_KEY = "seventeen_auth";

// ==========================================
// 2. READ JWT AUTHENTICATION
// ==========================================

function getToken() {
  try {
    const stored = sessionStorage.getItem(AUTH_KEY);

    if (!stored) return null;

    const auth = JSON.parse(stored);

    return (
      auth?.token ||
      auth?.accessToken ||
      auth?.jwt ||
      auth?.user?.token ||
      null
    );
  } catch (error) {
    console.error(
      "Unable to read authentication:",
      error
    );

    return null;
  }
}

// ==========================================
// 3. COMMON API REQUEST
// ==========================================

async function request(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Your login session has expired. Please log in again."
    );
  }

  const {
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...customHeaders,
  };

  // Let the browser set multipart boundaries.

  if (
    fetchOptions.body != null &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    console.error(
      "Sales API connection error:",
      error
    );

    throw new Error(
      "Cannot connect to Spring Boot. Check that your backend is running on port 8080."
    );
  }

  const raw = await response.text();

  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const backendMessage =
      data !== null && typeof data === "object"
        ? data.message || data.detail || data.error
        : typeof data === "string"
          ? data
          : null;

    if (response.status === 401) {
      throw new Error(
        "Your login session has expired. Please sign in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        backendMessage ||
        "Access denied. You are not authorized for this operation."
      );
    }

    if (response.status === 404) {
      throw new Error(
        backendMessage ||
        "The requested API endpoint or record was not found."
      );
    }

    if (response.status === 409) {
      throw new Error(
        backendMessage ||
        "This operation conflicts with the current order or vehicle state."
      );
    }

    if (response.status === 400) {
      throw new Error(
        backendMessage ||
        "Invalid request. Please check the entered information."
      );
    }

    throw new Error(
      backendMessage ||
      `Request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

// ==========================================
// 4. VALIDATE DATABASE IDs
// ==========================================

function validId(value, label = "ID") {
  const id = Number(value);

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === "" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      `Please provide a valid ${label}.`
    );
  }

  return id;
}

// ==========================================
// 5. VALIDATE PAYMENT AMOUNT
// ==========================================

function validAmount(value) {
  const raw = String(value ?? "").trim();

  const amount = Number(raw);

  if (
    raw === "" ||
    !/^\d+(\.\d{1,2})?$/.test(raw) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9999999999.99
  ) {
    throw new Error(
      "Enter a valid positive payment amount with at most two decimal places."
    );
  }

  return amount.toFixed(2);
}

// ==========================================
// 6. VALIDATE PAYMENT RECEIPT KEY
// ==========================================

function validReceiptKey(receiptKey) {
  if (
    typeof receiptKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(receiptKey)
  ) {
    throw new Error(
      "A valid payment receipt key is required."
    );
  }

  return receiptKey;
}

// ==========================================
// 7. PREPARE PAYMENT PROOF UPLOAD
//
// Existing cheque proof upload retained.
// ==========================================

function paymentForm(amount, file, receiptKey) {
  if (!(file instanceof File)) {
    throw new Error(
      "Please select a payment proof file."
    );
  }

  const supportedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (!supportedTypes.includes(file.type)) {
    throw new Error(
      "Upload a JPG, PNG or PDF file."
    );
  }

  if (file.size > 5_000_000) {
    throw new Error(
      "Payment proof must be smaller than 5 MB."
    );
  }

  const form = new FormData();

  form.append(
    "receiptKey",
    validReceiptKey(receiptKey)
  );

  form.append(
    "amount",
    validAmount(amount)
  );

  form.append("file", file);

  return form;
}

// ==========================================
// 8. DOWNLOAD PRIVATE PAYMENT PROOF
//
// Retained for existing authorized
// non-bank payment proof functionality.
//
// Spring Boot must deny Sales Manager
// access to BANK_TRANSFER proofs.
// ==========================================

async function downloadProof(path) {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in again.");
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to the payment server."
    );
  }

  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "You cannot access this payment proof."
        : response.status === 401
          ? "Please log in again."
          : "Unable to download payment proof."
    );
  }

  return response.blob();
}

// ==========================================
// 9. NORMALIZE BOOLEAN VALUES
// ==========================================

function toBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  if (value === false || value === 0) {
    return false;
  }

  const normalized = String(
    value ?? ""
  ).trim().toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1"
  );
}

// ==========================================
// 10. NORMALIZE VEHICLE RECORD
// ==========================================

function normalizeVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== "object") {
    throw new Error(
      "Invalid vehicle information returned by Spring Boot."
    );
  }

  const rawId =
    vehicle.id ??
    vehicle.vehicleId ??
    vehicle.vehicle_id;

  return {
    ...vehicle,

    id: validId(rawId, "vehicle ID"),

    vehicleNumber:
      vehicle.vehicleNumber ??
      vehicle.vehicle_number ??
      "Unknown Vehicle",

    status: String(
      vehicle.status ?? "UNKNOWN"
    ).toUpperCase(),

    occupied: toBoolean(vehicle.occupied),

    selectedByMe: toBoolean(
      vehicle.selectedByMe ??
      vehicle.selected_by_me
    ),
  };
}

// ==========================================
// 11. NORMALIZE CURRENT SALES SESSION
// ==========================================

function normalizeSession(data) {
  if (!data || typeof data !== "object") {
    return {
      active: false,
      vehicleId: null,
      vehicleNumber: "",
    };
  }

  const rawVehicleId =
    data.vehicleId ??
    data.vehicle_id ??
    data.vehicle?.id;

  const numericId = Number(rawVehicleId);

  const validVehicleId =
    rawVehicleId !== null &&
    rawVehicleId !== undefined &&
    rawVehicleId !== "" &&
    Number.isSafeInteger(numericId) &&
    numericId > 0;

  const active =
    toBoolean(data.active) &&
    validVehicleId;

  return {
    ...data,

    active,

    vehicleId: active ? numericId : null,

    vehicleNumber:
      data.vehicleNumber ??
      data.vehicle_number ??
      data.vehicle?.vehicleNumber ??
      "",
  };
}

// ==========================================
// 12. GET AVAILABLE SALES VEHICLES
// ==========================================

async function getVehicles() {
  const data = await request(
    "/api/sales/vehicles"
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "Spring Boot did not return a valid vehicle list."
    );
  }

  return data.map(normalizeVehicle);
}

// ==========================================
// 13. GET CURRENT SALES SESSION
// ==========================================

async function getCurrentSession() {
  const data = await request(
    "/api/sales/sessions/current"
  );

  if (
    data !== null &&
    (
      typeof data !== "object" ||
      Array.isArray(data)
    )
  ) {
    throw new Error(
      "Spring Boot returned an invalid sales session."
    );
  }

  return normalizeSession(data);
}

// ==========================================
// 14. SELECT SALES VEHICLE
// ==========================================

async function selectVehicle(vehicleId) {
  const id = validId(
    vehicleId,
    "vehicle ID"
  );

  return request(
    "/api/sales/sessions",
    {
      method: "POST",

      body: JSON.stringify({
        vehicleId: id,
      }),
    }
  );
}

// ==========================================
// 15. END CURRENT SALES SESSION
// ==========================================

async function endSession() {
  return request(
    "/api/sales/sessions/current/end",
    {
      method: "POST",
    }
  );
}

// ==========================================
// 16. GET SALES VEHICLE INVENTORY
// ==========================================

async function getInventory(vehicleId) {
  const id = validId(
    vehicleId,
    "vehicle ID"
  );

  const data = await request(
    `/api/sales/vehicles/${id}/inventory`
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "Spring Boot did not return a valid inventory list."
    );
  }

  return data;
}

// ==========================================
// 17. GET VEHICLE WHOLESALE ORDERS
// ==========================================

async function getOrders(vehicleId) {
  const id = validId(
    vehicleId,
    "vehicle ID"
  );

  const data = await request(
    `/api/sales/vehicles/${id}/orders`
  );

  if (!Array.isArray(data)) {
    throw new Error(
      "Spring Boot did not return a valid order list."
    );
  }

  return data;
}

// ==========================================
// 18. GET TODAY'S CONFIRMED CASH
//
// Only confirmed physical cash should
// be included in Today's Cash.
//
// Bank transfers are not physical cash.
// ==========================================

async function getTodaysCash() {
  return request(
    "/api/sales/cash/today"
  );
}

// ==========================================
// 19. GET WHOLESALE PAYMENT SUMMARY
//
// Used by:
// - SalesManagerDashboard.jsx
// - WholesalePaymentPanel.jsx
//
// Bank transfer status is read-only.
//
// Displays backend payment information:
// - Order total
// - Confirmed paid amount
// - Remaining balance
// - Payment receipt history
// - Admin approval status
// ==========================================

async function getPaymentSummary(orderId) {
  const id = validId(
    orderId,
    "order ID"
  );

  return request(
    `/api/sales/payments/orders/${id}`
  );
}

// ==========================================
// 20. RECORD CASH RECEIVED
//
// Only call after physically collecting cash.
// receiptKey prevents duplicate transactions.
//
// Existing cash and credit collection
// functionality retained.
// ==========================================

async function receiveWholesaleCash(
  orderId,
  amount,
  receiptKey
) {
  const id = validId(
    orderId,
    "order ID"
  );

  return request(
    `/api/sales/payments/orders/${id}/cash`,
    {
      method: "POST",

      body: JSON.stringify({
        receiptKey:
          validReceiptKey(receiptKey),

        amount:
          validAmount(amount),
      }),
    }
  );
}

// ==========================================
// BANK TRANSFER VERIFICATION REMOVED
// ==========================================
//
// Sales Manager cannot:
// - Approve bank transfers
// - Reject bank transfers
// - Review uploaded bank slips
// - Download uploaded bank slips
//
// Removed functions:
//
// verifyBankTransfer()
// getBankTransferSlips()
// getBankTransferProof()
//
// All bank transfer approval operations
// belong to the Admin payment API.
//
// Sales Manager reads payment status using:
//
// getPaymentSummary(orderId)
//
// ==========================================

// ==========================================
// 21. SUBMIT CHEQUE FOR ADMIN REVIEW
//
// Submission does not mean bank clearance.
//
// Existing cheque functionality retained.
// ==========================================

async function submitCheque(
  orderId,
  amount,
  file,
  receiptKey
) {
  const id = validId(
    orderId,
    "order ID"
  );

  return request(
    `/api/sales/payments/orders/${id}/cheque`,
    {
      method: "POST",

      body: paymentForm(
        amount,
        file,
        receiptKey
      ),
    }
  );
}

// ==========================================
// 22. GET PRIVATE PAYMENT PROOF
//
// Retained for existing cheque/non-bank
// proof viewing.
//
// IMPORTANT:
// Backend must reject bank-transfer
// receipt proof requests from Sales Manager.
// ==========================================

async function getPaymentProof(receiptId) {
  const id = validId(
    receiptId,
    "receipt ID"
  );

  return downloadProof(
    `/api/sales/payments/proof/${id}`
  );
}

// ==========================================
// 23. REFRESH SALES DASHBOARD
//
// Existing response structure retained:
//
// {
//   inventory,
//   orders,
//   cash
// }
// ==========================================

async function refreshDashboard(vehicleId) {
  const id = validId(
    vehicleId,
    "vehicle ID"
  );

  const [
    inventory,
    orders,
    cash,
  ] = await Promise.all([
    getInventory(id),
    getOrders(id),
    getTodaysCash(),
  ]);

  return {
    inventory,
    orders,
    cash,
  };
}

// ==========================================
// 24. EXPORT SALES VEHICLE API
//
// Existing non-bank method names preserved.
//
// Bank transfer approval and slip viewing
// methods have been removed.
// ==========================================

export const salesVehicleApi = {

  // ========================================
  // VEHICLE MANAGEMENT
  // ========================================

  getVehicles,

  // ========================================
  // SALES SESSION
  // ========================================

  currentSession: getCurrentSession,

  getCurrentSession,

  selectVehicle,

  endSession,

  // ========================================
  // INVENTORY
  // ========================================

  getInventory,

  // ========================================
  // WHOLESALE ORDERS
  // ========================================

  getOrders,

  // ========================================
  // DAILY CASH
  // ========================================

  getTodaysCash,

  // ========================================
  // PAYMENT SUMMARY
  //
  // Includes read-only bank approval status.
  // ========================================

  getPaymentSummary,

  // ========================================
  // CASH COLLECTION
  // ========================================

  receiveWholesaleCash,

  // ========================================
  // CHEQUE SUBMISSION
  // ========================================

  submitCheque,

  // ========================================
  // PAYMENT PROOF
  //
  // Authorized non-bank proof only.
  // ========================================

  getPaymentProof,

  // ========================================
  // DASHBOARD REFRESH
  // ========================================

  refreshDashboard,
};
