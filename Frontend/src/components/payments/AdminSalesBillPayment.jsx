
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from "react";
  
  import {
    Landmark,
    ReceiptText,
    RefreshCw,
    Search,
    Eye,
    CheckCircle2,
    XCircle,
    AlertCircle,
    FileCheck2,
    Wallet,
    ShieldCheck,
    Loader2,
    Clock3,
    CalendarDays,
    UserRound,
    Download,
    X,
  } from "lucide-react";
  
  import { adminSalesBillPaymentApi } from
  "../../services/adminSalesBillPaymentApi";
  
  // ==========================================
  // 1. BACKEND CONFIGURATION
  // ==========================================
  
  const BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  const API_PATH =
    "/api/admin/sales-bill-payments";
  
  const inputClass =
    "w-full rounded-xl border border-slate-200 " +
    "bg-white px-4 py-3 text-sm outline-none " +
    "focus:border-[#3654FF] focus:ring-2 " +
    "focus:ring-blue-100";
  
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 " +
    "rounded-xl bg-[#3654FF] px-5 py-3 text-sm " +
    "font-bold text-white hover:bg-[#2942D2] " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  
  // ==========================================
  // 2. COMMON HELPERS
  // ==========================================
  
  function money(value) {
    const number = Number(value);
  
    if (!Number.isFinite(number)) {
      return "LKR 0.00";
    }
  
    return (
      "LKR " +
      number.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  
  function formatDate(value) {
    if (!value) {
      return "Not available";
    }
  
    // PostgreSQL DATE for cheque dates
    // should remain a date, not be shifted
    // into another timezone.
  
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      const [year, month, day] =
        value.split("-");
  
      return `${day}/${month}/${year}`;
    }
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
  
    return date.toLocaleString("en-GB", {
      timeZone: "Asia/Colombo",
    });
  }
  
  function normalizeStatus(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  }
  
  function paymentMethodLabel(value) {
    switch (
      String(value || "").toUpperCase()
    ) {
      case "BANK_TRANSFER":
        return "Bank Transfer";
  
      case "CHEQUE":
        return "Cheque";
  
      default:
        return String(value || "Unknown")
          .replaceAll("_", " ");
    }
  }
  
  function isValidId(value) {
    const id = Number(value);
  
    return (
      Number.isSafeInteger(id) &&
      id > 0
    );
  }
  
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
  // 3. AUTHENTICATED ADMIN API
  // ==========================================
  
  async function adminRequest(
    path,
    options = {}
  ) {
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Please log in again as Admin."
      );
    }
  
    let response;
  
    try {
      response = await fetch(
        `${BASE_URL}${path}`,
        {
          ...options,
  
          cache: "no-store",
  
          headers: {
            Accept: "application/json",
  
            Authorization:
              `Bearer ${token}`,
  
            ...(options.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),
  
            ...options.headers,
          },
        }
      );
  
    } catch {
      throw new Error(
        "Cannot connect to Spring Boot."
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
  // 4. NORMALIZE BACKEND PAYMENT RECORD
  //
  // Matches the fields returned by
  // AdminSalesBillPaymentController.java.
  // ==========================================
  
  function normalizePayment(row) {
    return {
      ...row,
  
      id: Number(
        row.id ??
        row.paymentId ??
        row.proofId
      ),
  
      billId: Number(
        row.billId ??
        row.salesBillId ??
        row.bill_id
      ),
  
      invoiceNumber:
        row.invoiceNumber ||
        `INV-${row.billId ?? row.bill_id}`,
  
      method: String(
        row.method ??
        row.paymentMethod ??
        ""
      ).toUpperCase(),
  
      status: normalizeStatus(
        row.status
      ),
  
      amount: Number(
        row.amount ?? 0
      ),
  
      invoiceTotal: Number(
        row.invoiceTotal ??
        row.totalAmount ??
        0
      ),
  
      customerName:
        row.customerName ??
        row.shopName ??
        "Not available",
  
      customerPhone:
        row.customerPhone ??
        "",
  
      submittedBy:
        row.submittedBy ??
        null,
  
      transferReference:
        row.transferReference ??
        "",
  
      chequeNumber:
        row.chequeNumber ??
        "",
  
      issuingBank:
        row.issuingBank ??
        "",
  
      chequeDate:
        row.chequeDate ??
        null,
  
      proofOriginalName:
        row.proofOriginalName ??
        "Payment evidence",
  
      proofContentType:
        row.proofContentType ??
        "",
  
      rejectionReason:
        row.rejectionReason ??
        "",
  
      createdAt:
        row.createdAt ??
        null,
  
      reviewedAt:
        row.reviewedAt ??
        null,
  
      confirmedAt:
        row.confirmedAt ??
        null,
  
      invoicePaymentStatus:
        row.invoicePaymentStatus ??
        "",
    };
  }
  
  // ==========================================
  // 5. PAYMENT STATUS BADGE
  // ==========================================
  
  function PaymentStatusBadge({
    status,
  }) {
    const normalized =
      normalizeStatus(status);
  
    const statuses = {
      PENDING_REVIEW: {
        label: "Pending Admin Review",
        color:
          "bg-amber-100 text-amber-800",
      },
  
      APPROVED: {
        label: "Approved - Awaiting Clearance",
        color:
          "bg-blue-100 text-blue-800",
      },
  
      CONFIRMED: {
        label: "Payment Confirmed",
        color:
          "bg-green-100 text-green-800",
      },
  
      REJECTED: {
        label: "Rejected",
        color:
          "bg-red-100 text-red-800",
      },
    };
  
    const current =
      statuses[normalized] || {
        label:
          normalized.replaceAll("_", " "),
        color:
          "bg-slate-100 text-slate-700",
      };
  
    return (
      <span
        className={
          "inline-flex rounded-full " +
          "px-3 py-1 text-xs font-bold " +
          current.color
        }
      >
        {current.label}
      </span>
    );
  }
  
  // ==========================================
  // 6. PAYMENT DETAIL ROW
  // ==========================================
  
  function DetailRow({
    label,
    value,
  }) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
  
        <span className="text-slate-500">
          {label}
        </span>
  
        <strong className="max-w-[65%] break-words text-right text-[#17265B]">
          {value === null ||
          value === undefined ||
          value === ""
            ? "Not available"
            : value}
        </strong>
  
      </div>
    );
  }
  
  // ==========================================
  // 7. SECURE PAYMENT PROOF VIEWER
  //
  // The browser requests the file using
  // the Admin JWT, then displays it using
  // a temporary local Blob URL.
  //
  // JWT is never added to the URL.
  // ==========================================
  
  function ProofViewer({
    proof,
    onClose,
  }) {
    useEffect(() => {
      if (!proof?.url) {
        return;
      }
  
      return () => {
        URL.revokeObjectURL(
          proof.url
        );
      };
    }, [proof]);
  
    if (!proof) {
      return null;
    }
  
    const isImage =
      proof.type === "image/png" ||
      proof.type === "image/jpeg";
  
    const isPdf =
      proof.type === "application/pdf";
  
    function downloadProof() {
      const anchor =
        document.createElement("a");
  
      anchor.href = proof.url;
  
      anchor.download =
        proof.filename ||
        "payment-proof";
  
      document.body.appendChild(anchor);
  
      anchor.click();
      anchor.remove();
    }
  
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Payment evidence viewer"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4"
      >
        <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
  
          {/* HEADER */}
  
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
  
            <div>
              <h3 className="font-bold text-[#17265B]">
                Invoice INV-{proof.billId}
              </h3>
  
              <p className="mt-1 text-xs text-slate-500">
                {proof.filename}
              </p>
            </div>
  
            <div className="flex items-center gap-2">
  
              <button
                type="button"
                onClick={downloadProof}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-4 py-2 text-sm font-bold text-white"
              >
                <Download size={16} />
                Download
              </button>
  
              <button
                type="button"
                onClick={onClose}
                aria-label="Close proof viewer"
                className="rounded-xl border border-slate-200 p-2"
              >
                <X size={19} />
              </button>
  
            </div>
  
          </div>
  
          {/* EVIDENCE */}
  
          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
  
            {isImage ? (
              <img
                src={proof.url}
                alt="Uploaded payment evidence"
                className="mx-auto max-h-full max-w-full object-contain"
              />
            ) : isPdf ? (
              <iframe
                src={proof.url}
                title="Uploaded payment PDF"
                className="h-full min-h-[400px] w-full rounded-lg bg-white"
              />
            ) : (
              <p className="p-5 text-sm text-red-700">
                Unsupported payment evidence type.
              </p>
            )}
  
          </div>
  
          <div className="border-t border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
            Verify payment against official bank
            records before confirming.
          </div>
  
        </div>
      </div>
    );
  }
  
  // ==========================================
  // 8. MAIN ADMIN SALES BILL PAYMENT PANEL
  // ==========================================
  
  export default function AdminSalesBillPayment() {
  
    // ========================================
    // STATE
    // ========================================
  
    const [payments, setPayments] =
      useState([]);
  
    const [loading, setLoading] =
      useState(true);
  
    const [refreshing, setRefreshing] =
      useState(false);
  
    const [error, setError] =
      useState("");
  
    const [message, setMessage] =
      useState("");
  
    const [search, setSearch] =
      useState("");
  
    const [methodFilter, setMethodFilter] =
      useState("ALL");
  
    const [statusFilter, setStatusFilter] =
      useState("ALL");
  
    const [busyId, setBusyId] =
      useState(null);
  
    const [proofLoadingId, setProofLoadingId] =
      useState(null);
  
    const [proof, setProof] =
      useState(null);
  
    const [rejectingId, setRejectingId] =
      useState(null);
  
    const [rejectionReason, setRejectionReason] =
      useState("");
  
    const mountedRef = useRef(false);
  
    const requestRef = useRef(0);
  
    const actionRef = useRef(false);
  
    // ========================================
    // LOAD PAYMENT EVIDENCE
    // ========================================
  
    const loadPayments = useCallback(
      async (showSpinner = true) => {
        const requestId =
          ++requestRef.current;
  
        if (showSpinner) {
          setRefreshing(true);
        }
  
        try {
          const result =
            await adminRequest(
              API_PATH,
              {
                method: "GET",
              }
            );
  
          const rows =
            Array.isArray(result)
              ? result
              : (
                  result?.payments ??
                  result?.proofs ??
                  result?.content ??
                  result?.items
                );
  
          if (!Array.isArray(rows)) {
            throw new Error(
              "Invalid direct sales payment response."
            );
          }
  
          const normalized =
            rows.map(normalizePayment);
  
          if (
            mountedRef.current &&
            requestId === requestRef.current
          ) {
            setPayments(normalized);
            setError("");
          }
  
        } catch (err) {
          if (
            mountedRef.current &&
            requestId === requestRef.current
          ) {
            setError(
              err.message ||
              "Unable to load payments."
            );
          }
  
        } finally {
          if (
            mountedRef.current &&
            requestId === requestRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      []
    );
  
    // ========================================
    // INITIAL LOAD
    // ========================================
  
    useEffect(() => {
      mountedRef.current = true;
  
      loadPayments(false);
  
      return () => {
        mountedRef.current = false;
        requestRef.current += 1;
      };
    }, [loadPayments]);
  
    // ========================================
    // AUTO REFRESH EVERY 15 SECONDS
    // ========================================
  
    useEffect(() => {
      let running = false;
  
      const timer = window.setInterval(
        async () => {
          if (
            running ||
            actionRef.current ||
            document.visibilityState !==
              "visible"
          ) {
            return;
          }
  
          running = true;
  
          try {
            await loadPayments(false);
          } finally {
            running = false;
          }
        },
        15000
      );
  
      return () => {
        window.clearInterval(timer);
      };
    }, [loadPayments]);
  
    // ========================================
    // FILTER PAYMENTS
    // ========================================
  
    const filteredPayments = useMemo(
      () => {
        const keyword =
          search.trim().toLowerCase();
  
        return payments.filter(
          (payment) => {
            if (
              methodFilter !== "ALL" &&
              payment.method !== methodFilter
            ) {
              return false;
            }
  
            if (
              statusFilter !== "ALL" &&
              payment.status !== statusFilter
            ) {
              return false;
            }
  
            if (!keyword) {
              return true;
            }
  
            const value = [
              payment.id,
              payment.billId,
              payment.invoiceNumber,
              payment.customerName,
              payment.customerPhone,
              payment.submittedBy,
              payment.method,
              payment.status,
              payment.transferReference,
              payment.chequeNumber,
              payment.issuingBank,
            ]
              .join(" ")
              .toLowerCase();
  
            return value.includes(keyword);
          }
        );
      },
      [
        payments,
        search,
        methodFilter,
        statusFilter,
      ]
    );
  
    // ========================================
    // PAYMENT COUNTS
    // ========================================
  
    const summary = useMemo(
      () => ({
        total: payments.length,
  
        pending:
          payments.filter(
            (payment) =>
              payment.status ===
              "PENDING_REVIEW"
          ).length,
  
        approvedCheques:
          payments.filter(
            (payment) =>
              payment.method === "CHEQUE" &&
              payment.status === "APPROVED"
          ).length,
  
        confirmed:
          payments.filter(
            (payment) =>
              payment.status === "CONFIRMED"
          ).length,
  
        rejected:
          payments.filter(
            (payment) =>
              payment.status === "REJECTED"
          ).length,
      }),
      [payments]
    );
  
    // ========================================
    // VIEW PAYMENT PROOF
    // ========================================
  
    async function viewProof(payment) {
      if (!isValidId(payment.id)) {
        setError(
          "Invalid payment proof ID."
        );
        return;
      }
  
      const token = getToken();
  
      if (!token) {
        setError(
          "Please log in again as Admin."
        );
        return;
      }
  
      setProofLoadingId(payment.id);
      setError("");
  
      try {
        const response =
          await fetch(
            `${BASE_URL}${API_PATH}/${payment.id}/proof`,
            {
              method: "GET",
  
              cache: "no-store",
  
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );
  
        if (!response.ok) {
          let reason =
            "Unable to load payment evidence.";
  
          try {
            const result =
              await response.json();
  
            reason =
              result?.detail ||
              result?.message ||
              reason;
          } catch {
            // Keep the original error.
          }
  
          throw new Error(reason);
        }
  
        const blob =
          await response.blob();
  
        if (!blob.size) {
          throw new Error(
            "The uploaded proof is empty."
          );
        }
  
        const type =
          blob.type.toLowerCase() ||
          payment.proofContentType.toLowerCase();
  
        if (
          ![
            "image/png",
            "image/jpeg",
            "application/pdf",
          ].includes(type)
        ) {
          throw new Error(
            "Unsupported payment evidence type."
          );
        }
  
        const url =
          URL.createObjectURL(blob);
  
        if (!mountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
  
        // Close the previous proof before
        // displaying the new file.
  
        setProof({
          url,
          type,
  
          billId:
            payment.billId,
  
          filename:
            payment.proofOriginalName,
        });
  
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err.message ||
            "Unable to view payment proof."
          );
        }
  
      } finally {
        if (mountedRef.current) {
          setProofLoadingId(null);
        }
      }
    }
  
    function closeProof() {
      setProof(null);
    }
  
    // ========================================
    // APPROVE BANK TRANSFER OR CHEQUE
    //
    // BANK_TRANSFER:
    // Backend changes proof to CONFIRMED.
    //
    // CHEQUE:
    // Backend changes proof to APPROVED.
    // Invoice remains unpaid until cleared.
    // ========================================
  
    async function approvePayment(payment) {
      if (
        actionRef.current ||
        !isValidId(payment.id) ||
        payment.status !==
          "PENDING_REVIEW"
      ) {
        return;
      }
  
      const isBank =
        payment.method ===
        "BANK_TRANSFER";
  
      const prompt = isBank
        ? (
            "Have you independently verified " +
            `that ${money(payment.amount)} ` +
            "was credited to the company's " +
            "actual bank account for " +
            `invoice INV-${payment.billId}?`
          )
        : (
            "Approve the details of cheque " +
            `${payment.chequeNumber} for ` +
            `invoice INV-${payment.billId}? ` +
            "This does not confirm bank clearance."
          );
  
      if (!window.confirm(prompt)) {
        return;
      }
  
      actionRef.current = true;
  
      setBusyId(payment.id);
      setError("");
      setMessage("");
  
      try {
        const result =
          await adminRequest(
            `${API_PATH}/${payment.id}/approve`,
            {
              method: "POST",
            }
          );
  
        setMessage(
          isBank
            ? (
                `Bank deposit for INV-${payment.billId} ` +
                "confirmed in company records."
              )
            : (
                `Cheque for INV-${payment.billId} ` +
                "approved. Bank clearance is still required."
              )
        );
  
        await loadPayments(false);
  
        return result;
  
      } catch (err) {
        setError(
          (err.message ||
            "Unable to approve payment.") +
          " Refresh the list before retrying " +
          "if the result is uncertain."
        );
  
      } finally {
        actionRef.current = false;
        setBusyId(null);
      }
    }
  
    // ========================================
    // CONFIRM CHEQUE BANK CLEARANCE
    //
    // Allowed only for APPROVED cheques.
    // ========================================
  
    async function confirmChequeCleared(
      payment
    ) {
      if (
        actionRef.current ||
        !isValidId(payment.id) ||
        payment.method !== "CHEQUE" ||
        payment.status !== "APPROVED"
      ) {
        return;
      }
  
      const confirmed = window.confirm(
        "Have you verified from the bank that " +
        `cheque ${payment.chequeNumber} ` +
        `for ${money(payment.amount)} ` +
        `has cleared for INV-${payment.billId}? ` +
        "This will record the invoice payment."
      );
  
      if (!confirmed) {
        return;
      }
  
      actionRef.current = true;
  
      setBusyId(payment.id);
      setError("");
      setMessage("");
  
      try {
        const result =
          await adminRequest(
            `${API_PATH}/${payment.id}/confirm-cleared`,
            {
              method: "POST",
            }
          );
  
        setMessage(
          `Cheque payment for INV-${payment.billId} ` +
          "confirmed as cleared."
        );
  
        await loadPayments(false);
  
        return result;
  
      } catch (err) {
        setError(
          (err.message ||
            "Unable to confirm cheque clearance.") +
          " Refresh the list before retrying " +
          "if the result is uncertain."
        );
  
      } finally {
        actionRef.current = false;
        setBusyId(null);
      }
    }
  
    // ========================================
    // OPEN REJECTION FORM
    // ========================================
  
    function openRejectForm(payment) {
      if (
        actionRef.current ||
        ![
          "PENDING_REVIEW",
          "APPROVED",
        ].includes(payment.status)
      ) {
        return;
      }
  
      setRejectingId(payment.id);
      setRejectionReason("");
  
      setError("");
      setMessage("");
    }
  
    // ========================================
    // REJECT PAYMENT EVIDENCE
    //
    // Matches backend RejectRequest(String reason).
    // ========================================
  
    async function rejectPayment(payment) {
      if (
        actionRef.current ||
        rejectingId !== payment.id
      ) {
        return;
      }
  
      const reason =
        rejectionReason.trim();
  
      if (
        reason.length < 3 ||
        reason.length > 500
      ) {
        setError(
          "Enter a rejection reason between " +
          "3 and 500 characters."
        );
        return;
      }
  
      if (
        !window.confirm(
          `Reject payment proof for INV-${payment.billId}?`
        )
      ) {
        return;
      }
  
      actionRef.current = true;
  
      setBusyId(payment.id);
      setError("");
      setMessage("");
  
      try {
        await adminRequest(
          `${API_PATH}/${payment.id}/reject`,
          {
            method: "POST",
  
            body: JSON.stringify({
              reason,
            }),
          }
        );
  
        setRejectingId(null);
        setRejectionReason("");
  
        setMessage(
          `Payment proof for INV-${payment.billId} rejected.`
        );
  
        await loadPayments(false);
  
      } catch (err) {
        setError(
          (err.message ||
            "Unable to reject payment.") +
          " Refresh before retrying if " +
          "the result is uncertain."
        );
  
      } finally {
        actionRef.current = false;
        setBusyId(null);
      }
    }
  
    // ========================================
    // RENDER
    // ========================================
  
    return (
      <section className="space-y-6">
  
        {/* ================================== */}
        {/* HEADER */}
        {/* ================================== */}
  
        <div className="flex flex-wrap items-start justify-between gap-4">
  
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-[#17265B]">
              <FileCheck2
                size={25}
                className="text-[#3654FF]"
              />
              Direct Sales Payments
            </h2>
  
            <p className="mt-2 text-sm text-slate-600">
              Review bank transfer slips and
              cheque evidence submitted by Sales
              Managers for direct sales invoices.
            </p>
  
            <p className="mt-1 text-xs text-slate-500">
              Wholesale order payments remain
              managed in their separate modules.
            </p>
          </div>
  
          <button
            type="button"
            onClick={() =>
              loadPayments(true)
            }
            disabled={
              refreshing ||
              busyId != null
            }
            className={primaryButtonClass}
          >
            <RefreshCw size={17} />
  
            {refreshing
              ? "Refreshing..."
              : "Refresh Payments"}
          </button>
  
        </div>
  
        {/* ================================== */}
        {/* ERROR */}
        {/* ================================== */}
  
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={19}
              className="shrink-0"
            />
  
            <p>{error}</p>
          </div>
        )}
  
        {/* ================================== */}
        {/* SUCCESS */}
        {/* ================================== */}
  
        {message && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2
              size={19}
              className="shrink-0"
            />
  
            <p>{message}</p>
          </div>
        )}
  
        {/* ================================== */}
        {/* SUMMARY CARDS */}
        {/* ================================== */}
  
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
  
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">
              Submitted Proofs
            </p>
  
            <p className="mt-2 text-3xl font-bold text-[#17265B]">
              {summary.total}
            </p>
          </article>
  
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold text-amber-800">
              Pending Review
            </p>
  
            <p className="mt-2 text-3xl font-bold text-amber-800">
              {summary.pending}
            </p>
          </article>
  
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-semibold text-blue-800">
              Cheques Awaiting Clearance
            </p>
  
            <p className="mt-2 text-3xl font-bold text-blue-800">
              {summary.approvedCheques}
            </p>
          </article>
  
          <article className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-xs font-semibold text-green-800">
              Confirmed Payments
            </p>
  
            <p className="mt-2 text-3xl font-bold text-green-800">
              {summary.confirmed}
            </p>
          </article>
  
          <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-xs font-semibold text-red-800">
              Rejected Evidence
            </p>
  
            <p className="mt-2 text-3xl font-bold text-red-800">
              {summary.rejected}
            </p>
          </article>
  
        </div>
  
        {/* ================================== */}
        {/* SEARCH AND FILTERS */}
        {/* ================================== */}
  
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  
          <div className="grid gap-4 lg:grid-cols-3">
  
            {/* SEARCH */}
  
            <div>
              <label
                htmlFor="admin-direct-payment-search"
                className="mb-2 block text-xs font-bold text-slate-600"
              >
                Search Invoice / Customer / Cheque
              </label>
  
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-3.5 text-slate-400"
                />
  
                <input
                  id="admin-direct-payment-search"
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="INV-12, shop, reference..."
                  className={
                    inputClass +
                    " pl-10"
                  }
                />
              </div>
            </div>
  
            {/* PAYMENT METHOD */}
  
            <div>
              <label
                htmlFor="admin-direct-method"
                className="mb-2 block text-xs font-bold text-slate-600"
              >
                Payment Method
              </label>
  
              <select
                id="admin-direct-method"
                value={methodFilter}
                onChange={(event) =>
                  setMethodFilter(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="ALL">
                  All Methods
                </option>
  
                <option value="BANK_TRANSFER">
                  Bank Transfer
                </option>
  
                <option value="CHEQUE">
                  Cheque
                </option>
              </select>
            </div>
  
            {/* PAYMENT STATUS */}
  
            <div>
              <label
                htmlFor="admin-direct-status"
                className="mb-2 block text-xs font-bold text-slate-600"
              >
                Verification Status
              </label>
  
              <select
                id="admin-direct-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="ALL">
                  All Statuses
                </option>
  
                <option value="PENDING_REVIEW">
                  Pending Review
                </option>
  
                <option value="APPROVED">
                  Approved
                </option>
  
                <option value="CONFIRMED">
                  Confirmed
                </option>
  
                <option value="REJECTED">
                  Rejected
                </option>
              </select>
            </div>
  
          </div>
  
        </div>
  
        {/* ================================== */}
        {/* LOADING */}
        {/* ================================== */}
  
        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-10 text-slate-600">
  
            <Loader2
              size={20}
              className="animate-spin"
            />
  
            Loading direct sales payments...
  
          </div>
        )}
  
        {/* ================================== */}
        {/* EMPTY RESULTS */}
        {/* ================================== */}
  
        {!loading &&
          filteredPayments.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
  
              <ReceiptText
                size={35}
                className="mx-auto text-slate-400"
              />
  
              <h3 className="mt-4 font-bold text-[#17265B]">
                No Matching Payments
              </h3>
  
              <p className="mt-2 text-sm text-slate-500">
                No direct sales payment evidence
                matches your current filters.
              </p>
  
            </div>
          )}
  
        {/* ================================== */}
        {/* PAYMENT CARDS */}
        {/* ================================== */}
  
        <div className="grid gap-5 xl:grid-cols-2">
  
          {filteredPayments.map(
            (payment) => {
              const isBank =
                payment.method ===
                "BANK_TRANSFER";
  
              const isCheque =
                payment.method ===
                "CHEQUE";
  
              const pending =
                payment.status ===
                "PENDING_REVIEW";
  
              const approvedCheque =
                isCheque &&
                payment.status ===
                "APPROVED";
  
              const confirmed =
                payment.status ===
                "CONFIRMED";
  
              const rejected =
                payment.status ===
                "REJECTED";
  
              const canReject =
                pending ||
                approvedCheque;
  
              const busy =
                busyId === payment.id;
  
              return (
                <article
                  key={payment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
  
                  {/* PAYMENT HEADER */}
  
                  <div className="flex flex-wrap items-start justify-between gap-3">
  
                    <div>
                      <h3 className="text-lg font-bold text-[#17265B]">
                        Invoice INV-{payment.billId}
                      </h3>
  
                      <p className="mt-1 text-sm text-slate-500">
                        {payment.customerName}
                      </p>
                    </div>
  
                    <PaymentStatusBadge
                      status={payment.status}
                    />
  
                  </div>
  
                  {/* PAYMENT METHOD */}
  
                  <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#F3F5FF] p-4">
  
                    {isBank ? (
                      <Landmark
                        size={21}
                        className="text-[#3654FF]"
                      />
                    ) : (
                      <ReceiptText
                        size={21}
                        className="text-[#3654FF]"
                      />
                    )}
  
                    <div>
                      <p className="text-sm font-bold text-[#17265B]">
                        {paymentMethodLabel(
                          payment.method
                        )}
                      </p>
  
                      <p className="mt-1 text-xs text-slate-500">
                        Proof #{payment.id}
                      </p>
                    </div>
  
                  </div>
  
                  {/* PAYMENT DETAILS */}
  
                  <div className="mt-5 space-y-3">
  
                    <DetailRow
                      label="Invoice Number"
                      value={
                        payment.invoiceNumber
                      }
                    />
  
                    <DetailRow
                      label="Invoice Total"
                      value={money(
                        payment.invoiceTotal
                      )}
                    />
  
                    <DetailRow
                      label="Submitted Amount"
                      value={money(
                        payment.amount
                      )}
                    />
  
                    <DetailRow
                      label="Customer"
                      value={
                        payment.customerName
                      }
                    />
  
                    {payment.customerPhone && (
                      <DetailRow
                        label="Customer Phone"
                        value={
                          payment.customerPhone
                        }
                      />
                    )}
  
                    <DetailRow
                      label="Sales Manager User ID"
                      value={
                        payment.submittedBy ??
                        "Not available"
                      }
                    />
  
                    <DetailRow
                      label="Submitted At"
                      value={formatDate(
                        payment.createdAt
                      )}
                    />
  
                    {isBank && (
                      <DetailRow
                        label="Bank Transaction Reference"
                        value={
                          payment.transferReference
                        }
                      />
                    )}
  
                    {isCheque && (
                      <>
                        <DetailRow
                          label="Cheque Number"
                          value={
                            payment.chequeNumber
                          }
                        />
  
                        <DetailRow
                          label="Issuing Bank"
                          value={
                            payment.issuingBank
                          }
                        />
  
                        <DetailRow
                          label="Cheque Date"
                          value={formatDate(
                            payment.chequeDate
                          )}
                        />
                      </>
                    )}
  
                    {payment.reviewedAt && (
                      <DetailRow
                        label="Reviewed At"
                        value={formatDate(
                          payment.reviewedAt
                        )}
                      />
                    )}
  
                    {payment.confirmedAt && (
                      <DetailRow
                        label="Confirmed At"
                        value={formatDate(
                          payment.confirmedAt
                        )}
                      />
                    )}
  
                    {payment.invoicePaymentStatus && (
                      <DetailRow
                        label="Invoice Payment Status"
                        value={
                          payment.invoicePaymentStatus
                        }
                      />
                    )}
  
                  </div>
  
                  {/* REJECTION INFORMATION */}
  
                  {rejected && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
  
                      <p className="flex items-center gap-2 text-sm font-bold text-red-800">
                        <XCircle size={18} />
                        Payment Evidence Rejected
                      </p>
  
                      <p className="mt-2 text-sm text-red-700">
                        {payment.rejectionReason ||
                          "No rejection reason provided."}
                      </p>
                    </div>
                  )}
  
                  {/* CHEQUE APPROVED STATUS */}
  
                  {approvedCheque && (
                    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
  
                      <p className="flex items-center gap-2 text-sm font-bold text-blue-800">
                        <ShieldCheck size={18} />
                        Cheque Approved
                      </p>
  
                      <p className="mt-2 text-sm text-blue-800">
                        This cheque has been
                        approved for processing.
  
                        The invoice is not yet paid.
                        Confirm bank clearance
                        before recording payment.
                      </p>
                    </div>
                  )}
  
                  {/* PENDING STATUS */}
  
                  {pending && (
                    <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
  
                      <Clock3
                        size={19}
                        className="shrink-0"
                      />
  
                      <p>
                        Payment evidence is waiting
                        for Admin verification.
                      </p>
                    </div>
                  )}
  
                  {/* CONFIRMED STATUS */}
  
                  {confirmed && (
                    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
  
                      <p className="flex items-center gap-2 text-sm font-bold text-green-800">
                        <CheckCircle2 size={18} />
                        Payment Confirmed
                      </p>
  
                      <p className="mt-2 text-sm text-green-700">
                        This payment has been
                        confirmed in the company
                        payment records.
                      </p>
                    </div>
                  )}
  
                  {/* ================================== */}
                  {/* PAYMENT ACTIONS */}
                  {/* ================================== */}
  
                  <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
  
                    {/* VIEW PAYMENT PROOF */}
  
                    <button
                      type="button"
                      onClick={() =>
                        viewProof(payment)
                      }
                      disabled={
                        proofLoadingId != null
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#BFCBFF] bg-[#F3F5FF] px-4 py-3 text-sm font-bold text-[#3654FF] hover:bg-[#E5EAFF] disabled:opacity-50"
                    >
                      <Eye size={18} />
  
                      {proofLoadingId ===
                        payment.id
                        ? "Loading Evidence..."
                        : (
                            isBank
                              ? "View Bank Transfer Slip"
                              : "View Cheque Photograph"
                          )}
                    </button>
  
                    {/* APPROVE */}
  
                    {pending && (
                      <button
                        type="button"
                        disabled={
                          busyId != null
                        }
                        onClick={() =>
                          approvePayment(
                            payment
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={18} />
  
                        {busy
                          ? "Processing..."
                          : (
                              isBank
                                ? "Confirm Bank Deposit"
                                : "Approve Cheque"
                            )}
                      </button>
                    )}
  
                    {/* CHEQUE CLEARANCE */}
  
                    {approvedCheque && (
                      <button
                        type="button"
                        disabled={
                          busyId != null
                        }
                        onClick={() =>
                          confirmChequeCleared(
                            payment
                          )
                        }
                        className={primaryButtonClass +
                          " w-full"}
                      >
                        <Wallet size={18} />
  
                        {busy
                          ? "Confirming..."
                          : "Confirm Cheque Cleared"}
                      </button>
                    )}
  
                    {/* REJECTION BUTTON */}
  
                    {canReject &&
                      rejectingId !==
                        payment.id && (
                        <button
                          type="button"
                          disabled={
                            busyId != null
                          }
                          onClick={() =>
                            openRejectForm(payment)
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={18} />
                          Reject Payment
                        </button>
                      )}
  
                    {/* REJECTION FORM */}
  
                    {rejectingId ===
                      payment.id && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
  
                        <label
                          htmlFor={`reject-${payment.id}`}
                          className="block text-sm font-bold text-red-800"
                        >
                          Rejection Reason
                        </label>
  
                        <textarea
                          id={`reject-${payment.id}`}
                          rows={3}
                          maxLength={500}
                          value={
                            rejectionReason
                          }
                          onChange={(event) =>
                            setRejectionReason(
                              event.target.value
                            )
                          }
                          placeholder="Explain why the slip or cheque cannot be accepted."
                          className="mt-3 w-full rounded-xl border border-red-200 bg-white p-3 text-sm outline-none focus:border-red-400"
                        />
  
                        <div className="mt-3 flex flex-wrap gap-3">
  
                          <button
                            type="button"
                            disabled={
                              busyId != null ||
                              rejectionReason.trim()
                                .length < 3
                            }
                            onClick={() =>
                              rejectPayment(payment)
                            }
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Confirm Rejection
                          </button>
  
                          <button
                            type="button"
                            disabled={
                              busyId != null
                            }
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                            }}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                          >
                            Cancel
                          </button>
  
                        </div>
  
                      </div>
                    )}
  
                  </div>
  
                </article>
              );
            }
          )}
  
        </div>
  
        {/* ================================== */}
        {/* PAYMENT POLICY NOTICE */}
        {/* ================================== */}
  
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
  
          <p className="flex items-center gap-2 font-bold">
            <ShieldCheck size={18} />
            Payment Verification Rules
          </p>
  
          <p className="mt-2">
            A bank transfer is confirmed only
            after the full amount appears in the
            company's bank account.
  
            A cheque is first approved by Admin,
            but payment is not recorded until
            the bank confirms cheque clearance.
  
            Uploaded evidence by itself does
            not constitute confirmed payment.
          </p>
  
        </div>
  
        {/* ================================== */}
        {/* PROOF VIEWER */}
        {/* ================================== */}
  
        <ProofViewer
          proof={proof}
          onClose={closeProof}
        />
  
      </section>
    );
  }
  