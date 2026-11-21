
const BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  const API_PATH =
    "/api/admin/sales-bill-payments";
  
  // ==========================================
  // 1. GET JWT AUTHENTICATION TOKEN
  // ==========================================
  
  function getToken() {
    try {
      const auth = JSON.parse(
        sessionStorage.getItem(
          "seventeen_auth"
        ) || "null"
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
  // 2. VALIDATE PAYMENT ID
  // ==========================================
  
  function validPaymentId(value) {
    const id = Number(value);
  
    if (
      value == null ||
      String(value).trim() === "" ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw new Error(
        "Invalid direct-sales payment ID."
      );
    }
  
    return id;
  }
  
  // ==========================================
  // 3. VALIDATE REJECTION REASON
  // ==========================================
  
  function validRejectionReason(value) {
    const reason = String(
      value ?? ""
    ).trim();
  
    if (
      reason.length < 3 ||
      reason.length > 500
    ) {
      throw new Error(
        "Enter a rejection reason between " +
        "3 and 500 characters."
      );
    }
  
    return reason;
  }
  
  // ==========================================
  // 4. COMMON ADMIN API REQUEST
  //
  // JWT Authorization is required.
  //
  // Spring Security allows these endpoints
  // only for users with ROLE_ADMIN.
  // ==========================================
  
  async function request(
    path,
    options = {}
  ) {
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Please log in again as Admin."
      );
    }
  
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };
  
    // Only set JSON Content-Type when sending
    // a JSON request body.
  
    if (
      typeof options.body === "string" &&
      !headers["Content-Type"] &&
      !headers["content-type"]
    ) {
      headers["Content-Type"] =
        "application/json";
    }
  
    let response;
  
    try {
      response = await fetch(
        `${BASE_URL}${path}`,
        {
          ...options,
          cache: "no-store",
          headers,
        }
      );
    } catch {
      throw new Error(
        "Cannot connect to Spring Boot on port 8080."
      );
    }
  
    const raw = await response.text();
  
    let result;
  
    try {
      result = raw
        ? JSON.parse(raw)
        : null;
    } catch {
      result = raw;
    }
  
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Your login session has expired. " +
          "Please log in again."
        );
      }
  
      if (response.status === 403) {
        throw new Error(
          "Access denied. Only Admin can " +
          "review direct-sales payments."
        );
      }
  
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
  // 5. DOWNLOAD AUTHENTICATED PROOF BLOB
  //
  // Payment evidence is protected by JWT.
  //
  // Unlike ordinary image URLs, the browser
  // must send Authorization to retrieve it.
  // ==========================================
  
  async function requestProofBlob(paymentId) {
    const id = validPaymentId(paymentId);
  
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Please log in again as Admin."
      );
    }
  
    let response;
  
    try {
      response = await fetch(
        `${BASE_URL}${API_PATH}/${id}/proof`,
        {
          method: "GET",
          cache: "no-store",
  
          headers: {
            Accept:
              "image/jpeg, image/png, application/pdf",
  
            Authorization:
              `Bearer ${token}`,
          },
        }
      );
    } catch {
      throw new Error(
        "Cannot connect to Spring Boot."
      );
    }
  
    if (!response.ok) {
      let message =
        "Unable to load payment evidence.";
  
      try {
        const result = await response.json();
  
        message =
          result?.detail ||
          result?.message ||
          result?.error ||
          message;
      } catch {
        // Keep the default error.
      }
  
      if (response.status === 401) {
        message =
          "Your Admin session has expired.";
      }
  
      if (response.status === 403) {
        message =
          "Only Admin can view payment evidence.";
      }
  
      throw new Error(message);
    }
  
    const blob = await response.blob();
  
    if (!blob.size) {
      throw new Error(
        "The uploaded payment proof is empty."
      );
    }
  
    const rawType = String(
      blob.type ||
      response.headers.get("Content-Type") ||
      ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();
  
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];
  
    if (!allowedTypes.includes(rawType)) {
      throw new Error(
        "Unsupported payment evidence format."
      );
    }
  
    // Reconstruct with the verified content
    // type, so the proof viewer can reliably
    // decide between image and PDF rendering.
  
    return new Blob(
      [blob],
      { type: rawType }
    );
  }
  
  // ==========================================
  // 6. NORMALIZE PAYMENT RECORDS
  //
  // Matches AdminSalesBillPaymentController.
  //
  // Handles both camelCase Java responses
  // and optional legacy field names.
  // ==========================================
  
  function normalizePayment(payment) {
    const billId =
      payment.billId ??
      payment.salesBillId ??
      payment.bill_id;
  
    return {
      ...payment,
  
      id: Number(
        payment.id ??
        payment.paymentId ??
        payment.proofId
      ),
  
      billId: Number(billId),
  
      invoiceNumber:
        payment.invoiceNumber ||
        `INV-${billId}`,
  
      method: String(
        payment.method ??
        payment.paymentMethod ??
        ""
      ).toUpperCase(),
  
      status: String(
        payment.status ??
        "PENDING_REVIEW"
      ).toUpperCase(),
  
      amount: Number(
        payment.amount ?? 0
      ),
  
      invoiceTotal:
        payment.invoiceTotal ??
        payment.totalAmount ??
        payment.billTotal ??
        null,
  
      customerName:
        payment.customerName ??
        payment.shopName ??
        "Not available",
  
      customerPhone:
        payment.customerPhone ??
        "",
  
      submittedBy:
        payment.submittedBy ??
        null,
  
      submittedByName:
        payment.submittedByName ??
        payment.salesManagerName ??
        payment.submittedByEmail ??
        null,
  
      transferReference:
        payment.transferReference ??
        "",
  
      chequeNumber:
        payment.chequeNumber ??
        "",
  
      issuingBank:
        payment.issuingBank ??
        "",
  
      chequeDate:
        payment.chequeDate ??
        null,
  
      proofOriginalName:
        payment.proofOriginalName ??
        "Payment evidence",
  
      proofContentType:
        payment.proofContentType ??
        "",
  
      rejectionReason:
        payment.rejectionReason ??
        "",
  
      createdAt:
        payment.createdAt ??
        payment.submittedAt ??
        null,
  
      reviewedAt:
        payment.reviewedAt ??
        null,
  
      confirmedAt:
        payment.confirmedAt ??
        null,
  
      invoicePaymentStatus:
        payment.invoicePaymentStatus ??
        payment.paymentStatus ??
        "",
    };
  }
  
  // ==========================================
  // 7. COMPLETE ADMIN SALES BILL PAYMENT API
  // ==========================================
  
  export const adminSalesBillPaymentApi = {
  
    // ========================================
    // GET ALL DIRECT-SALES PAYMENT EVIDENCE
    //
    // GET /api/admin/sales-bill-payments
    //
    // Includes bank transfer slips and
    // cheque submissions from Sales Managers.
    //
    // Excludes wholesale payment records.
    // ========================================
  
    async getPayments() {
      const response = await request(
        API_PATH,
        {
          method: "GET",
        }
      );
  
      const rows = Array.isArray(response)
        ? response
        : (
            response?.payments ??
            response?.proofs ??
            response?.content ??
            response?.items
          );
  
      if (!Array.isArray(rows)) {
        throw new Error(
          "Invalid direct-sales payment list " +
          "returned by Spring Boot."
        );
      }
  
      return rows.map(normalizePayment);
    },
  
    // ========================================
    // ALIAS FOR GET PAYMENTS
    //
    // Both names are available for frontend
    // compatibility.
    // ========================================
  
    getAllPayments() {
      return this.getPayments();
    },
  
    // ========================================
    // GET SECURE PAYMENT PROOF
    //
    // GET
    // /api/admin/sales-bill-payments/{id}/proof
    //
    // Returns a Blob suitable for:
    // URL.createObjectURL(blob)
    // ========================================
  
    getProof(paymentId) {
      return requestProofBlob(paymentId);
    },
  
    // ========================================
    // GET PAYMENT PROOF WITH OBJECT URL
    //
    // Returns:
    // {
    //   url,
    //   type,
    //   paymentId
    // }
    //
    // IMPORTANT:
    // Caller must release the URL using:
    // URL.revokeObjectURL(proof.url)
    // ========================================
  
    async getProofUrl(paymentId) {
      const id = validPaymentId(paymentId);
  
      const blob = await requestProofBlob(id);
  
      return {
        paymentId: id,
        url: URL.createObjectURL(blob),
        type: blob.type,
      };
    },
  
    // ========================================
    // APPROVE PAYMENT EVIDENCE
    //
    // POST
    // /api/admin/sales-bill-payments/{id}/approve
    //
    // BANK_TRANSFER:
    // Backend sets status CONFIRMED.
    //
    // CHEQUE:
    // Backend sets status APPROVED.
    // Invoice remains unpaid until cleared.
    // ========================================
  
    approvePayment(paymentId) {
      const id = validPaymentId(paymentId);
  
      return request(
        `${API_PATH}/${id}/approve`,
        {
          method: "POST",
        }
      );
    },
  
    // ========================================
    // ALIAS FOR APPROVAL
    // ========================================
  
    approve(paymentId) {
      return this.approvePayment(paymentId);
    },
  
    // ========================================
    // CONFIRM CLEARED CHEQUE
    //
    // POST
    // /api/admin/sales-bill-payments/{id}/confirm-cleared
    //
    // Only an APPROVED cheque can be cleared.
    //
    // Backend sets status CONFIRMED and
    // updates invoice payment balance.
    // ========================================
  
    confirmChequeCleared(paymentId) {
      const id = validPaymentId(paymentId);
  
      return request(
        `${API_PATH}/${id}/confirm-cleared`,
        {
          method: "POST",
        }
      );
    },
  
    // ========================================
    // ALIAS FOR CHEQUE CLEARANCE
    // ========================================
  
    confirmCleared(paymentId) {
      return this.confirmChequeCleared(
        paymentId
      );
    },
  
    // ========================================
    // REJECT PAYMENT EVIDENCE
    //
    // POST
    // /api/admin/sales-bill-payments/{id}/reject
    //
    // Exact Spring Boot DTO:
    // RejectRequest(String reason)
    //
    // Valid statuses:
    // PENDING_REVIEW
    // APPROVED (cheque)
    //
    // CONFIRMED payments cannot be rejected.
    // ========================================
  
    rejectPayment(paymentId, reason) {
      const id = validPaymentId(paymentId);
  
      const validatedReason =
        validRejectionReason(reason);
  
      return request(
        `${API_PATH}/${id}/reject`,
        {
          method: "POST",
  
          body: JSON.stringify({
            reason: validatedReason,
          }),
        }
      );
    },
  
    // ========================================
    // ALIAS FOR REJECTION
    // ========================================
  
    reject(paymentId, reason) {
      return this.rejectPayment(
        paymentId,
        reason
      );
    },
  
    // ========================================
    // FILTER DIRECT-SALES PAYMENT RECORDS
    //
    // This filters already-retrieved payment
    // data and does not send additional
    // backend requests.
    // ========================================
  
    filterPayments(
      payments,
      {
        method = "ALL",
        status = "ALL",
        search = "",
      } = {}
    ) {
      if (!Array.isArray(payments)) {
        return [];
      }
  
      const selectedMethod = String(
        method
      ).toUpperCase();
  
      const selectedStatus = String(
        status
      ).toUpperCase();
  
      const keyword = String(
        search
      )
        .trim()
        .toLowerCase();
  
      return payments.filter((payment) => {
        if (
          selectedMethod !== "ALL" &&
          String(payment.method).toUpperCase() !==
            selectedMethod
        ) {
          return false;
        }
  
        if (
          selectedStatus !== "ALL" &&
          String(payment.status).toUpperCase() !==
            selectedStatus
        ) {
          return false;
        }
  
        if (!keyword) {
          return true;
        }
  
        const searchable = [
          payment.id,
          payment.billId,
          payment.invoiceNumber,
          payment.customerName,
          payment.customerPhone,
          payment.submittedBy,
          payment.submittedByName,
          payment.transferReference,
          payment.chequeNumber,
          payment.issuingBank,
          payment.method,
          payment.status,
        ]
          .join(" ")
          .toLowerCase();
  
        return searchable.includes(keyword);
      });
    },
  
    // ========================================
    // SUMMARY COUNTS
    //
    // Used for Admin dashboard statistics.
    // ========================================
  
    getSummary(payments) {
      const records =
        Array.isArray(payments)
          ? payments
          : [];
  
      return {
        total: records.length,
  
        pending: records.filter(
          (payment) =>
            payment.status ===
            "PENDING_REVIEW"
        ).length,
  
        approvedCheques: records.filter(
          (payment) =>
            payment.method === "CHEQUE" &&
            payment.status === "APPROVED"
        ).length,
  
        confirmed: records.filter(
          (payment) =>
            payment.status === "CONFIRMED"
        ).length,
  
        rejected: records.filter(
          (payment) =>
            payment.status === "REJECTED"
        ).length,
      };
    },
  };
  
  // ==========================================
  // DEFAULT EXPORT
  // ==========================================
  
  export default adminSalesBillPaymentApi;
  