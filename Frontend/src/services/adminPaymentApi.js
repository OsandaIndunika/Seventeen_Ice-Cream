
/**
 * ADMIN PAYMENT API SERVICE
 * Seventeen Ice Cream Management System
 *
 * Supports:
 * - Bank transfer slip verification
 * - Bank transfer approval and rejection
 * - Cheque photo verification
 * - Cheque approval and rejection
 * - Cheque bank clearance confirmation
 *
 * Only ADMIN is authorized to perform
 * payment approval operations.
 */

// ==========================================
// 1. API CONFIGURATION
// ==========================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const PAYMENT_BASE = "/api/admin/payments";

// ==========================================
// 2. GET JWT AUTHENTICATION TOKEN
// ==========================================

function getToken() {
  try {
    const auth = JSON.parse(
      sessionStorage.getItem("seventeen_auth") ||
      "null"
    );

    return (
      auth?.token ||
      auth?.accessToken ||
      auth?.jwt ||
      auth?.user?.token ||
      ""
    );

  } catch {
    return "";
  }
}

// ==========================================
// 3. VALIDATE PAYMENT RECEIPT ID
// ==========================================

function validId(value) {

  const id = String(
    value ?? ""
  ).trim();

  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  ) {
    throw new Error(
      "Invalid payment receipt ID."
    );
  }

  return id;
}

// ==========================================
// 4. COMMON AUTHENTICATED API REQUEST
//
// Supports:
// - JSON responses
// - Empty responses
// - Bank slip downloads
// - Cheque photo downloads
// - JWT authentication
// ==========================================

async function request(
  path = "",
  {
    method = "GET",
    body,
    blob = false,
    signal,
  } = {}
) {

  const token = getToken();

  if (!token) {
    throw new Error(
      "Your login session has expired. " +
      "Please log in again."
    );
  }

  // ========================================
  // REQUEST HEADERS
  // ========================================

  const headers = {

    Authorization: `Bearer ${token}`,

    Accept: blob
      ? "*/*"
      : "application/json",
  };

  if (body !== undefined) {

    headers["Content-Type"] =
      "application/json";
  }

  // ========================================
  // SEND REQUEST TO SPRING BOOT
  // ========================================

  let response;

  try {

    response = await fetch(
      `${API_BASE}${PAYMENT_BASE}${path}`,
      {
        method,

        headers,

        cache: "no-store",

        signal,

        ...(body !== undefined
          ? {
              body: JSON.stringify(body),
            }
          : {}),
      }
    );

  } catch (err) {

    if (err.name === "AbortError") {
      throw err;
    }

    throw new Error(
      "Cannot connect to Spring Boot. " +
      "Check your backend on port 8080."
    );
  }

  // ========================================
  // HANDLE BINARY PAYMENT PROOF
  //
  // Returns the actual image or PDF
  // as a Blob object.
  // ========================================

  if (response.ok && blob) {

    const proof =
      await response.blob();

    if (!proof.size) {
      throw new Error(
        "The bank slip is empty."
      );
    }

    return proof;
  }

  // ========================================
  // HANDLE JSON OR EMPTY RESPONSE
  // ========================================

  const raw =
    await response.text();

  let data = null;

  if (raw) {

    try {

      data = JSON.parse(raw);

    } catch {

      data = raw;
    }
  }

  // ========================================
  // HANDLE BACKEND ERRORS
  // ========================================

  if (!response.ok) {

    const message =
      typeof data === "object" &&
      data !== null

        ? data.message ||
          data.detail ||
          data.error

        : data;

    // Authentication failure

    if (response.status === 401) {

      throw new Error(
        "Please log in again."
      );
    }

    // Authorization failure

    if (response.status === 403) {

      throw new Error(
        "Only Admin can review bank transfers."
      );
    }

    // Other backend errors

    throw new Error(

      message ||

      `Payment request failed (HTTP ${response.status}).`
    );
  }

  return data;
}

// ==========================================
// SECTION A: BANK TRANSFER PAYMENTS
//
// EXISTING FUNCTIONALITY RETAINED
// ==========================================

// ==========================================
// 5. GET ALL BANK TRANSFER PAYMENTS
//
// GET /api/admin/payments/bank-transfers
// ==========================================

export async function getBankTransfers(
  signal
) {

  const data = await request(
    "/bank-transfers",
    {
      signal,
    }
  );

  if (!Array.isArray(data)) {

    throw new Error(
      "Invalid bank transfer list returned by Spring Boot."
    );
  }

  return data;
}

// ==========================================
// 6. GET UPLOADED BANK SLIP
//
// GET /api/admin/payments/
// bank-transfers/{receiptId}/proof
//
// Returns:
// JPG, PNG or PDF as Blob.
// ==========================================

export function getBankSlip(
  receiptId,
  signal
) {

  return request(

    `/bank-transfers/${validId(receiptId)}/proof`,

    {

      blob: true,

      signal,
    }
  );
}

// ==========================================
// 7. APPROVE BANK TRANSFER
//
// POST /api/admin/payments/
// bank-transfers/{receiptId}/approve
//
// Admin enters the actual verified amount.
//
// Status:
// PENDING_REVIEW -> CONFIRMED
// ==========================================

export function approveBankTransfer(
  receiptId,
  amount
) {

  const value = String(
    amount ?? ""
  ).trim();

  // Validate the verified amount.

  if (
    !/^\d{1,10}(\.\d{1,2})?$/.test(value) ||
    Number(value) <= 0
  ) {

    throw new Error(
      "Enter a positive verified amount " +
      "with at most two decimal places."
    );
  }

  return request(

    `/bank-transfers/${validId(receiptId)}/approve`,

    {

      method: "POST",

      body: {

        amount: value,
      },
    }
  );
}

// ==========================================
// 8. REJECT BANK TRANSFER
//
// POST /api/admin/payments/
// bank-transfers/{receiptId}/reject
//
// Status:
// PENDING_REVIEW -> REJECTED
// ==========================================

export function rejectBankTransfer(
  receiptId,
  reason
) {

  const value = String(
    reason ?? ""
  ).trim();

  if (
    !value ||
    value.length > 500
  ) {

    throw new Error(
      "Enter a rejection reason " +
      "(1–500 characters)."
    );
  }

  return request(

    `/bank-transfers/${validId(receiptId)}/reject`,

    {

      method: "POST",

      body: {

        reason: value,
      },
    }
  );
}

// ==========================================
// SECTION B: CHEQUE PAYMENT MANAGEMENT
//
// NEW FUNCTIONALITIES
// ==========================================

// ==========================================
// 9. GET ALL CHEQUE PAYMENTS
//
// GET /api/admin/payments/cheques
//
// Returns:
// - Receipt ID
// - Wholesale order ID
// - Cheque amount
// - Cheque submission status
// - Photo availability
// - Submission date
// - Approval information
// - Rejection reason
// - Clearance status
// ==========================================

export async function getChequePayments(
  signal
) {

  const data = await request(

    "/cheques",

    {
      signal,
    }
  );

  if (!Array.isArray(data)) {

    throw new Error(
      "Invalid cheque payment list."
    );
  }

  return data;
}

// ==========================================
// 10. GET UPLOADED CHEQUE PHOTO
//
// GET /api/admin/payments/
// cheques/{receiptId}/proof
//
// Retrieves the uploaded cheque proof
// through the authorized backend endpoint.
//
// Returns an actual Blob object.
// ==========================================

export function getChequeProof(
  receiptId,
  signal
) {

  return request(

    `/cheques/${validId(receiptId)}/proof`,

    {

      blob: true,

      signal,
    }
  );
}

// ==========================================
// 11. APPROVE CHEQUE
//
// POST /api/admin/payments/
// cheques/{receiptId}/approve
//
// Admin reviews the uploaded cheque photo
// and approves the cheque.
//
// Status:
// PENDING_REVIEW -> APPROVED
//
// IMPORTANT:
// Approval does NOT mean the cheque
// has cleared through the bank.
//
// The amount should not yet be included
// in the confirmed paid balance.
// ==========================================

export function approveCheque(
  receiptId
) {

  return request(

    `/cheques/${validId(receiptId)}/approve`,

    {

      method: "POST",
    }
  );
}

// ==========================================
// 12. CONFIRM CHEQUE BANK CLEARANCE
//
// POST /api/admin/payments/
// cheques/{receiptId}/confirm-cleared
//
// Admin must verify that the cheque
// has actually cleared and the money
// has been credited to the company.
//
// Status:
// APPROVED -> CONFIRMED
//
// After confirmation:
// - Confirmed paid amount is updated.
// - Remaining balance is recalculated.
// - Customer dashboard shows confirmation.
// - Sales Manager dashboard shows confirmation.
// ==========================================

export function confirmChequeCleared(
  receiptId
) {

  return request(

    `/cheques/${validId(receiptId)}/confirm-cleared`,

    {

      method: "POST",
    }
  );
}

// ==========================================
// 13. REJECT CHEQUE PAYMENT
//
// POST /api/admin/payments/
// cheques/{receiptId}/reject
//
// Admin must provide a rejection reason.
//
// Supports:
// - Invalid cheque
// - Incorrect cheque details
// - Incorrect amount
// - Dishonoured cheque before confirmation
//
// Status:
// PENDING_REVIEW -> REJECTED
// or
// APPROVED -> REJECTED
// ==========================================

export function rejectCheque(
  receiptId,
  reason
) {

  const value = String(
    reason ?? ""
  ).trim();

  // Validate rejection reason.

  if (
    !value ||
    value.length > 500
  ) {

    throw new Error(
      "Enter a rejection reason " +
      "(1–500 characters)."
    );
  }

  return request(

    `/cheques/${validId(receiptId)}/reject`,

    {

      method: "POST",

      body: {

        reason: value,
      },
    }
  );
}

// ==========================================
// 14. EXPORT COMPLETE ADMIN PAYMENT API
// ==========================================

export const adminPaymentApi = {

  // ========================================
  // EXISTING BANK TRANSFER PAYMENTS
  // ========================================

  getBankTransfers,

  getBankSlip,

  approveBankTransfer,

  rejectBankTransfer,

  // ========================================
  // NEW CHEQUE PAYMENTS
  // ========================================

  getChequePayments,

  getChequeProof,

  approveCheque,

  confirmChequeCleared,

  rejectCheque,
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default adminPaymentApi;
