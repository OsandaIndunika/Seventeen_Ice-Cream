
/**
 * WHOLESALE PAYMENT API SERVICE
 * Seventeen Ice Cream Management System
 *
 * Frontend: React + Vite
 * Backend: Spring Boot
 *
 * Wholesale customers can:
 *
 * - View their order payment details.
 * - Upload bank transfer slips.
 * - View Admin approval status.
 * - View confirmed paid amount.
 * - View remaining balance.
 * - Download their own authorized payment proof.
 *
 * Only Admin can approve bank transfers.
 */

// =====================================================
// 1. API CONFIGURATION
// =====================================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const AUTH_KEY = "seventeen_auth";

// Existing Spring Boot endpoints retained.

const PAYMENT_BASE =
  "/api/wholesale/payments";

// =====================================================
// 2. READ JWT AUTHENTICATION TOKEN
// =====================================================

function getToken() {
  let auth;

  try {
    auth = JSON.parse(
      sessionStorage.getItem(AUTH_KEY) ||
      "null"
    );
  } catch {
    auth = null;
  }

  return (
    auth?.token ||
    auth?.accessToken ||
    auth?.jwt ||
    auth?.user?.token ||
    ""
  );
}

// =====================================================
// 3. VALIDATE DATABASE ID
// =====================================================

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

// =====================================================
// 4. VALIDATE PAYMENT AMOUNT
// =====================================================

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
      "Enter a valid transferred amount " +
      "with at most two decimal places."
    );
  }

  return amount.toFixed(2);
}

// =====================================================
// 5. VALIDATE BANK SLIP FILE
// =====================================================

function validateFile(file) {
  if (!(file instanceof File)) {
    throw new Error(
      "Please select a bank transfer slip."
    );
  }

  const permittedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (!permittedTypes.includes(file.type)) {
    throw new Error(
      "Only JPG, PNG or PDF files are supported."
    );
  }

  if (file.size === 0) {
    throw new Error(
      "The selected bank slip file is empty."
    );
  }

  if (file.size > 5_000_000) {
    throw new Error(
      "Maximum bank slip file size is 5 MB."
    );
  }

  return file;
}

// =====================================================
// 6. VALIDATE RECEIPT KEY
//
// Receipt keys help prevent duplicate payments
// when the same upload request is retried.
// =====================================================

function validReceiptKey(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(value)
  ) {
    throw new Error(
      "A valid payment receipt key is required."
    );
  }

  return value;
}

// =====================================================
// 7. STABLE BANK SLIP UPLOAD KEYS
//
// Reuse the same receipt key when retrying an
// upload with the same order, file and amount.
//
// Keys are stored temporarily in memory.
// =====================================================

const pendingUploadKeys = new WeakMap();

function getUploadReceiptKey(
  orderId,
  file,
  amount
) {
  let fileKeys = pendingUploadKeys.get(file);

  if (!fileKeys) {
    fileKeys = new Map();

    pendingUploadKeys.set(
      file,
      fileKeys
    );
  }

  const uploadIdentifier =
    `${orderId}:${amount}`;

  if (!fileKeys.has(uploadIdentifier)) {
    fileKeys.set(
      uploadIdentifier,
      crypto.randomUUID()
    );
  }

  return fileKeys.get(
    uploadIdentifier
  );
}

function clearUploadReceiptKey(
  orderId,
  file,
  amount
) {
  const fileKeys =
    pendingUploadKeys.get(file);

  if (!fileKeys) return;

  const uploadIdentifier =
    `${orderId}:${amount}`;

  fileKeys.delete(uploadIdentifier);

  if (fileKeys.size === 0) {
    pendingUploadKeys.delete(file);
  }
}

// =====================================================
// 8. HANDLE BACKEND ERROR MESSAGES
// =====================================================

function getErrorMessage(data, status) {
  const backendMessage =
    typeof data === "object" && data !== null
      ? data.message ||
        data.detail ||
        data.error
      : typeof data === "string"
        ? data
        : null;

  if (status === 401) {
    return (
      "Your login session has expired. " +
      "Please log in again."
    );
  }

  if (status === 403) {
    return (
      backendMessage ||
      "You are not authorized to access this payment."
    );
  }

  if (status === 404) {
    return (
      backendMessage ||
      "The requested payment record or API was not found."
    );
  }

  if (status === 409) {
    return (
      backendMessage ||
      "This payment conflicts with an existing " +
      "payment record. Please refresh payment details."
    );
  }

  if (status === 400) {
    return (
      backendMessage ||
      "Invalid payment request. Please check your information."
    );
  }

  if (status === 413) {
    return (
      "The uploaded bank slip exceeds the " +
      "maximum permitted file size."
    );
  }

  if (status === 415) {
    return (
      "Unsupported file type. " +
      "Please upload a JPG, PNG or PDF file."
    );
  }

  return (
    backendMessage ||
    `Request failed (HTTP ${status}).`
  );
}

// =====================================================
// 9. PARSE BACKEND RESPONSE
//
// Handles:
// - JSON responses
// - Plain-text responses
// - Empty responses
// - Spring Boot problem+json responses
// =====================================================

async function parseResponse(response) {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") ||
    "";

  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    try {
      return JSON.parse(raw);

    } catch {
      if (!response.ok) {
        return raw;
      }

      throw new Error(
        "Invalid JSON response from Spring Boot."
      );
    }
  }

  // Some backend endpoints may return JSON
  // without the correct Content-Type header.

  try {
    return JSON.parse(raw);

  } catch {
    return raw;
  }
}

// =====================================================
// 10. COMMON AUTHENTICATED API REQUEST
//
// Correctly supports JSON, multipart uploads
// and binary payment proof downloads.
// =====================================================

async function request(
  path,
  options = {},
  responseType = "json"
) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Your login session has expired. " +
      "Please log in again."
    );
  }

  const headers = new Headers(
    options.headers || {}
  );

  // Attach JWT authentication.

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  // Preserve an existing Accept header.

  if (!headers.has("Accept")) {
    headers.set(
      "Accept",
      responseType === "blob"
        ? "*/*"
        : "application/json"
    );
  }

  // IMPORTANT:
  // Browser must generate multipart boundaries
  // automatically when uploading FormData.

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");

  } else if (
    options.body != null &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers,
      }
    );

  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    console.error(
      "Wholesale payment API connection error:",
      error
    );

    throw new Error(
      "Cannot connect to Spring Boot. " +
      "Check that your backend is running on port 8080."
    );
  }

  // ===================================================
  // HANDLE UNSUCCESSFUL RESPONSES
  // ===================================================

  if (!response.ok) {
    const data =
      await parseResponse(response);

    throw new Error(
      getErrorMessage(
        data,
        response.status
      )
    );
  }

  // ===================================================
  // HANDLE BINARY FILE DOWNLOADS
  // ===================================================

  if (responseType === "blob") {
    return response.blob();
  }

  // ===================================================
  // HANDLE JSON OR TEXT RESPONSES
  // ===================================================

  return parseResponse(response);
}

// =====================================================
// 11. GET MY WHOLESALE ORDER PAYMENT
//
// Existing endpoint:
//
// GET /api/wholesale/payments/orders/{orderId}
//
// Returns:
// - Order total
// - Confirmed paid amount
// - Remaining balance
// - Payment method
// - Payment status
// - Payment receipt history
// - Admin approval status
//
// This method is read-only.
// =====================================================

export function getMyOrderPayment(orderId) {
  const id = validId(
    orderId,
    "order ID"
  );

  return request(
    `${PAYMENT_BASE}/orders/${encodeURIComponent(id)}`,
    {
      method: "GET",

      // Retrieve the latest Admin approval status.

      cache: "no-store",
    }
  );
}

// =====================================================
// 12. UPLOAD MY BANK TRANSFER SLIP
//
// Existing endpoint:
//
// POST /api/wholesale/payments/orders/{orderId}/bank-slip
//
// Multipart fields:
// - file
// - amount
// - receiptKey
//
// Customer uploads payment proof.
//
// Only Admin can verify and approve
// the actual credited bank amount.
//
// Uploading a slip does not confirm payment.
// =====================================================

export async function uploadMyBankSlip(
  orderId,
  file,
  amount,
  receiptKey = null
) {
  const id = validId(
    orderId,
    "order ID"
  );

  const validFile = validateFile(file);

  const declaredAmount =
    validAmount(amount);

  // Preserve an explicitly supplied receipt key.
  // Otherwise reuse an existing key for retries.

  const key = validReceiptKey(
    receiptKey ??
    getUploadReceiptKey(
      id,
      validFile,
      declaredAmount
    )
  );

  // Prepare multipart request.

  const form = new FormData();

  form.append(
    "file",
    validFile
  );

  form.append(
    "amount",
    declaredAmount
  );

  form.append(
    "receiptKey",
    key
  );

  try {
    const response = await request(
      `${PAYMENT_BASE}/orders/${encodeURIComponent(id)}/bank-slip`,
      {
        method: "POST",

        body: form,
      }
    );

    // Remove the temporary receipt key only
    // after the backend confirms successful upload.

    if (receiptKey == null) {
      clearUploadReceiptKey(
        id,
        validFile,
        declaredAmount
      );
    }

    return response;

  } catch (error) {
    // Preserve the existing receipt key so
    // an identical retry can be recognized
    // by the backend.

    throw error;
  }
}

// =====================================================
// 13. GET MY PAYMENT PROOF
//
// Existing endpoint:
//
// GET /api/wholesale/payments/receipts/{receiptId}/proof
//
// Returns an actual Blob.
//
// Wholesale customers can retrieve only
// their own authorized payment proof.
//
// Spring Boot must enforce order ownership.
// This does not grant approval permission.
// =====================================================

export async function getMyPaymentProof(
  receiptId
) {
  const id = validId(
    receiptId,
    "receipt ID"
  );

  const blob = await request(
    `${PAYMENT_BASE}/receipts/${encodeURIComponent(id)}/proof`,
    {
      method: "GET",

      headers: {
        Accept: "*/*",
      },

      cache: "no-store",
    },
    "blob"
  );

  if (
    !(blob instanceof Blob) ||
    blob.size === 0
  ) {
    throw new Error(
      "No payment proof file was returned."
    );
  }

  return blob;
}
