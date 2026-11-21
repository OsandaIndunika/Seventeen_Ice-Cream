
const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// ==========================================
// 1. CONFIGURATION
// ==========================================

const MAX_PAYMENT_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_PAYMENT_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

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
      null
    );
  } catch {
    return null;
  }
}

// ==========================================
// 3. COMMON AUTHENTICATED API REQUEST
//
// Supports:
// - JSON
// - FormData
//
// IMPORTANT:
// Do not manually set Content-Type for
// FormData because the browser must add
// the multipart boundary.
// ==========================================

async function request(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Please log in again."
    );
  }

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = {
    Accept: "application/json",

    Authorization: `Bearer ${token}`,

    ...(!isFormData
      ? {
          "Content-Type": "application/json",
        }
      : {}),

    ...options.headers,
  };

  // Prevent an accidental JSON Content-Type
  // when sending multipart form uploads.

  if (isFormData) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }

  let response;

  try {
    response = await fetch(
      `${BASE_URL}${path}`,
      {
        ...options,
        headers,
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to Spring Boot on port 8080."
    );
  }

  const text = await response.text();

  let result;

  try {
    result = text
      ? JSON.parse(text)
      : null;
  } catch {
    result = text;
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
      result?.message ||
      result?.error ||
      (
        typeof result === "string"
          ? result
          : `Request failed: ${response.status}`
      )
    );
  }

  return result;
}

// ==========================================
// 4. VALIDATE SALES BILL ID
// ==========================================

function validBillId(value) {
  const id = Number(value);

  if (
    value == null ||
    String(value).trim() === "" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Invalid sales invoice ID."
    );
  }

  return id;
}

// ==========================================
// 4A. VALIDATE VEHICLE ID
//
// Used to retrieve batch inventory from
// the selected Sales Manager lorry.
//
// Spring Boot must independently verify
// that the authenticated Sales Manager
// has an active session for this vehicle.
// ==========================================

function validVehicleId(value) {
  const id = Number(value);

  if (
    value == null ||
    String(value).trim() === "" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Select a valid lorry before " +
      "loading production batches."
    );
  }

  return id;
}

// ==========================================
// 5. VALIDATE PAYMENT AMOUNT
//
// Applies to:
// - Cash collections
// - Bank transfers
// - Cheques
//
// Server remains the authoritative source
// for invoice amount and payment balance.
// ==========================================

function validAmount(value) {
  const amount = String(
    value ?? ""
  ).trim();

  if (
    !/^\d{1,10}(\.\d{1,2})?$/.test(amount) ||
    Number(amount) <= 0
  ) {
    throw new Error(
      "Enter a valid positive amount " +
      "with at most two decimal places."
    );
  }

  return Number(amount).toFixed(2);
}

// ==========================================
// 6. VALIDATE UUID RECEIPT KEY
//
// Keep the same UUID when retrying a
// potentially successful request.
// ==========================================

function validReceiptKey(value) {
  const receiptKey = String(
    value ?? ""
  ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      receiptKey
    )
  ) {
    throw new Error(
      "Invalid payment receipt key."
    );
  }

  return receiptKey;
}

// ==========================================
// 7. VALIDATE PAYMENT EVIDENCE FILE
// ==========================================

function validPaymentFile(file) {
  if (
    typeof File === "undefined" ||
    !(file instanceof File)
  ) {
    throw new Error(
      "Select a payment slip or cheque photo."
    );
  }

  if (
    file.size <= 0 ||
    file.size > MAX_PAYMENT_FILE_SIZE
  ) {
    throw new Error(
      "Payment evidence must be smaller than " +
      "or equal to 5 MB."
    );
  }

  if (
    !ALLOWED_PAYMENT_FILE_TYPES.includes(
      file.type
    )
  ) {
    throw new Error(
      "Only JPG, PNG and PDF payment " +
      "evidence files are allowed."
    );
  }

  return file;
}

// ==========================================
// 8. VALIDATE BANK TRANSACTION REFERENCE
// ==========================================

function validTransferReference(value) {
  const reference = String(
    value ?? ""
  ).trim();

  if (
    !reference ||
    reference.length > 150
  ) {
    throw new Error(
      "Enter a valid bank transaction reference " +
      "(maximum 150 characters)."
    );
  }

  return reference;
}

// ==========================================
// 9. VALIDATE CHEQUE DETAILS
// ==========================================

function validChequeNumber(value) {
  const number = String(
    value ?? ""
  ).trim();

  if (
    !number ||
    number.length > 100
  ) {
    throw new Error(
      "Enter a valid cheque number " +
      "(maximum 100 characters)."
    );
  }

  return number;
}

function validIssuingBank(value) {
  const bank = String(
    value ?? ""
  ).trim();

  if (
    !bank ||
    bank.length > 150
  ) {
    throw new Error(
      "Enter a valid cheque issuing bank " +
      "(maximum 150 characters)."
    );
  }

  return bank;
}

function validChequeDate(value) {
  const date = String(
    value ?? ""
  ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error(
      "Enter a valid cheque date in YYYY-MM-DD format."
    );
  }

  const parsedDate = new Date(
    `${date}T00:00:00`
  );

  if (
    Number.isNaN(
      parsedDate.getTime()
    ) ||
    Number.isNaN(
      Date.parse(date)
    )
  ) {
    throw new Error(
      "Invalid cheque date."
    );
  }

  // Reject invalid calendar dates such as
  // February 30, which JavaScript may normalize.

  const [
    year,
    month,
    day,
  ] = date.split("-").map(Number);

  const checkDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    throw new Error(
      "Invalid cheque calendar date."
    );
  }

  return date;
}

// ==========================================
// 9A. VALIDATE BATCH BILL ITEMS
//
// The SalesBillingPanel sends one
// vehicleBatchStockId for each bill line.
//
// Different batches of the same product
// remain separate invoice lines.
//
// No batch approval status is required.
//
// The backend must perform authoritative
// product, vehicle, stock and batch checks.
// ==========================================

function validateBatchBillItems(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "Add at least one product to the bill."
    );
  }

  return items.map((item, index) => {
    if (
      !item ||
      typeof item !== "object"
    ) {
      throw new Error(
        `Invalid bill item at row ${index + 1}.`
      );
    }

    const productId = String(
      item.productId ?? ""
    ).trim();

    const flavour = String(
      item.flavour ?? ""
    ).trim();

    const quantity = Number(
      item.quantity
    );

    const vehicleBatchStockId = Number(
      item.vehicleBatchStockId
    );

    if (!productId || !flavour) {
      throw new Error(
        `Select a valid product and flavour ` +
        `for row ${index + 1}.`
      );
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Enter a valid quantity for ` +
        `row ${index + 1}.`
      );
    }

    if (
      item.vehicleBatchStockId == null ||
      String(item.vehicleBatchStockId).trim() === "" ||
      !Number.isSafeInteger(vehicleBatchStockId) ||
      vehicleBatchStockId <= 0
    ) {
      throw new Error(
        `Select a production batch for ` +
        `row ${index + 1}.`
      );
    }

    return {
      ...item,

      productId,
      flavour,
      quantity,
      vehicleBatchStockId,
    };
  });
}

// ==========================================
// 10. COMPLETE SALES BILLING API
// ==========================================

export const salesBillingApi = {

  // ========================================
  // EXISTING: GET BILLABLE PRODUCTS
  //
  // GET /api/sales/bills/products
  // ========================================

  getProducts() {
    return request(
      "/api/sales/bills/products"
    );
  },

  // ========================================
  // GET GROUPED VEHICLE BATCH INVENTORY
  //
  // GET /api/sales/vehicles/{vehicleId}/batch-inventory
  //
  // Used by:
  // SalesBillingPanel.jsx
  //
  // Returns:
  //
  // [
  //   {
  //     vehicleStockId,
  //     productId,
  //     productName,
  //     size,
  //     flavour,
  //     totalQuantity,
  //     availableQuantity,
  //     batches: [
  //       {
  //         vehicleBatchStockId,
  //         batchNumber,
  //         quantity,
  //         reservedQuantity,
  //         availableQuantity
  //       }
  //     ]
  //   }
  // ]
  //
  // Batch eligibility is determined
  // from available stock quantities.
  //
  // No batch approval-status field
  // is required in this response.
  //
  // Batch availability is verified again
  // by the backend when saving the bill.
  // ========================================

  async getBatchInventory(vehicleId) {
    const id =
      validVehicleId(vehicleId);

    const result = await request(
      `/api/sales/vehicles/${id}/batch-inventory`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!Array.isArray(result)) {
      throw new Error(
        "Invalid lorry batch inventory response " +
        "from Spring Boot."
      );
    }

    return result;
  },

  // ========================================
  // EXISTING: CREATE SALES BILL
  //
  // POST /api/sales/bills
  //
  // BATCH-AWARE BILLING
  //
  // Supports:
  // CASH
  // CREDIT
  // BANK_TRANSFER
  // CHEQUE
  //
  // Each bill item includes:
  //
  // productId
  // flavour
  // vehicleBatchStockId
  // quantity
  //
  // IMPORTANT:
  //
  // The backend must atomically:
  //
  // 1. Validate the selected lorry.
  // 2. Validate selected production batches.
  // 3. Validate available batch quantities.
  // 4. Save the invoice.
  // 5. Deduct aggregate vehicle stock.
  // 6. Deduct individual batch stock.
  // 7. Save bill-to-batch traceability.
  //
  // No batch approval-status field
  // is included in the request.
  //
  // A receipt key must remain stable when
  // retrying an uncertain request.
  // ========================================

  createBill(payload) {
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw new Error(
        "Invalid sales bill request."
      );
    }

    const validatedItems =
      validateBatchBillItems(
        payload.items
      );

    return request(
      "/api/sales/bills",
      {
        method: "POST",

        body: JSON.stringify({
          ...payload,

          items: validatedItems,
        }),
      }
    );
  },

  // ========================================
  // EXISTING: GET BILL DETAILS
  //
  // GET /api/sales/bills/{billId}
  //
  // The backend returns the saved
  // batch number for each invoice item.
  //
  // Example:
  //
  // {
  //   id: 12,
  //   items: [
  //     {
  //       productId: "4l-bag",
  //       flavour: "Chocolate",
  //       batchNumber: "055",
  //       vehicleBatchStockId: 41,
  //       quantity: 1
  //     }
  //   ]
  // }
  //
  // No change to the existing endpoint.
  // ========================================

  getBill(billId) {
    return request(
      `/api/sales/bills/${
        validBillId(billId)
      }`,
      {
        method: "GET",
        cache: "no-store",
      }
    );
  },

  // ========================================
  // EXISTING: RECORD CASH RECEIVED
  //
  // POST /api/sales/bills/{billId}/cash
  //
  // Used during initial billing.
  // ========================================

  receiveCash(
    billId,
    amount,
    receiptKey
  ) {
    return request(
      `/api/sales/bills/${encodeURIComponent(
        billId
      )}/cash`,
      {
        method: "POST",

        body: JSON.stringify({
          amount,
          receiptKey,
        }),
      }
    );
  },

  // ========================================
  // EXISTING: GET CREDIT BALANCES
  //
  // GET /api/sales/bills/credit-balances
  //
  // Returns only outstanding direct-sales
  // CREDIT invoices belonging to the
  // authenticated Sales Manager.
  // ========================================

  async getCreditBalances() {
    const result = await request(
      "/api/sales/bills/credit-balances",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!Array.isArray(result)) {
      throw new Error(
        "Invalid sales credit balances response " +
        "from Spring Boot."
      );
    }

    return result;
  },

  // ========================================
  // EXISTING: COLLECT CREDIT CASH
  //
  // POST /api/sales/bills/{billId}/collections
  //
  // Retains the original request format
  // and validation.
  // ========================================

  collectCreditCash(
    billId,
    amount,
    receiptKey
  ) {
    const id =
      validBillId(billId);

    const validCashAmount =
      validAmount(amount);

    const key =
      validReceiptKey(receiptKey);

    return request(
      `/api/sales/bills/${id}/collections`,
      {
        method: "POST",

        body: JSON.stringify({
          amount: validCashAmount,
          receiptKey: key,
        }),
      }
    );
  },

  // ========================================
  // GET COMPANY BANK DETAILS
  //
  // GET /api/sales/bills/company-bank-details
  //
  // Returns:
  // accountName
  // bankName
  // branch
  // accountNumber
  // chequePayeeName
  //
  // Used by:
  // DirectBankTransferPayment.jsx
  // DirectChequePayment.jsx
  // ========================================

  getCompanyBankDetails() {
    return request(
      "/api/sales/bills/company-bank-details",
      {
        method: "GET",
        cache: "no-store",
      }
    );
  },

  // ========================================
  // GET DIRECT SALES PAYMENT DETAILS
  //
  // GET /api/sales/bills/{billId}/payments
  //
  // Returns:
  // billId
  // totalAmount
  // confirmedPaid
  // confirmedNonCash
  // remainingBalance
  // payments[]
  //
  // Payment status examples:
  // PENDING_REVIEW
  // APPROVED
  // CONFIRMED
  // REJECTED
  //
  // These are PAYMENT statuses and
  // are unrelated to production batches.
  // ========================================

  getBillPayments(billId) {
    const id =
      validBillId(billId);

    return request(
      `/api/sales/bills/${id}/payments`,
      {
        method: "GET",
        cache: "no-store",
      }
    );
  },

  // ========================================
  // SUBMIT BANK TRANSFER SLIP
  //
  // POST /api/sales/bills/{billId}/bank-slip
  //
  // Required FormData:
  // receiptKey
  // amount
  // transferReference
  // file
  //
  // IMPORTANT:
  // Bank transfer must equal FULL invoice.
  //
  // Spring Boot must reject partial
  // transfers and duplicate payments.
  // ========================================

  submitBankSlip(
    billId,
    amount,
    transferReference,
    file,
    receiptKey
  ) {
    const id =
      validBillId(billId);

    const validatedAmount =
      validAmount(amount);

    const reference =
      validTransferReference(
        transferReference
      );

    const validatedFile =
      validPaymentFile(file);

    const key =
      validReceiptKey(receiptKey);

    const formData =
      new FormData();

    formData.append(
      "receiptKey",
      key
    );

    formData.append(
      "amount",
      validatedAmount
    );

    formData.append(
      "transferReference",
      reference
    );

    formData.append(
      "file",
      validatedFile
    );

    return request(
      `/api/sales/bills/${id}/bank-slip`,
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      }
    );
  },

  // ========================================
  // SUBMIT CHEQUE PHOTOGRAPH
  //
  // POST /api/sales/bills/{billId}/cheque
  //
  // Required FormData:
  // receiptKey
  // amount
  // chequeNumber
  // issuingBank
  // chequeDate
  // file
  //
  // Cheque must equal full invoice total.
  // ========================================

  submitCheque(
    billId,
    amount,
    chequeNumber,
    issuingBank,
    chequeDate,
    file,
    receiptKey
  ) {
    const id =
      validBillId(billId);

    const validatedAmount =
      validAmount(amount);

    const validatedChequeNumber =
      validChequeNumber(
        chequeNumber
      );

    const validatedIssuingBank =
      validIssuingBank(
        issuingBank
      );

    const validatedChequeDate =
      validChequeDate(
        chequeDate
      );

    const validatedFile =
      validPaymentFile(file);

    const key =
      validReceiptKey(receiptKey);

    const formData =
      new FormData();

    formData.append(
      "receiptKey",
      key
    );

    formData.append(
      "amount",
      validatedAmount
    );

    formData.append(
      "chequeNumber",
      validatedChequeNumber
    );

    formData.append(
      "issuingBank",
      validatedIssuingBank
    );

    formData.append(
      "chequeDate",
      validatedChequeDate
    );

    formData.append(
      "file",
      validatedFile
    );

    return request(
      `/api/sales/bills/${id}/cheque`,
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      }
    );
  },

  // ========================================
  // EXISTING: GET WHOLESALE PRODUCT PRICES
  //
  // PUBLIC ENDPOINT
  //
  // GET /api/wholesale/prices
  //
  // No JWT required.
  // ========================================

  getWholesalePrices() {
    return fetch(
      `${BASE_URL}/api/wholesale/prices`
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          "Unable to load wholesale prices."
        );
      }

      return response.json();
    });
  },
};

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default salesBillingApi;
