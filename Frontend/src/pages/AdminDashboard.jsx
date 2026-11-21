
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LayoutDashboard,
  Factory,
  Tag,
  Store,
  Truck,
  Users,
  Package,
  LogOut,
  ChartNoAxesCombined,
  Plus,
  Trash2,
  Clock,
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
  CalendarDays,
  Loader2,
} from "lucide-react";

import BankTransferPayments from
  "../components/BankTransferPayments";

import ChequePayments from
  "../components/ChequePayments";

  import AdminSalesBillPayment from
  "../components/payments/AdminSalesBillPayment";

// ==========================================
// BACKEND CONFIGURATION
// ==========================================

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// ==========================================
// ORIGINAL ADMIN MENU
//
// NEW:
// Direct Sales Payments
//
// Existing menu items remain unchanged.
// ==========================================

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Production",
    icon: Factory,
  },
  {
    label: "Edit Prices",
    icon: Tag,
  },
  {
    label: "Outlets",
    icon: Store,
  },
  {
    label: "Delivery",
    icon: Truck,
  },
  {
    label: "Employees",
    icon: Users,
  },
  {
    label: "Raw Materials",
    icon: Package,
  },
  {
    label: "Bank Transfer Payments",
    icon: Landmark,
  },
  {
    label: "Cheque Payments",
    icon: ReceiptText,
  },

  // NEW: Sales Manager direct invoices

  {
    label: "Direct Sales Payments",
    icon: FileCheck2,
  },
];

// ==========================================
// EXISTING PRODUCTION DATA
// ==========================================

const flavors = [
  "Strawberry Swirl",
  "Mint Chocolate",
  "Classic Vanilla",
  "Chocolate",
  "Mango",
  "Fruit & Nut",
];

const flavorColors = {
  "Strawberry Swirl": "#FFB8CC",
  "Mint Chocolate": "#80DDB1",
  "Classic Vanilla": "#FFE79A",
  Chocolate: "#B58A77",
  Mango: "#FFCB70",
  "Fruit & Nut": "#B6A2DE",
};

const initialRecords = [
  {
    id: 1,
    coolRoom: 1,
    flavor: "Strawberry Swirl",
    batch: "FD-2026-003",
    date: "10:30 AM",
    quantity: 45,
  },
  {
    id: 2,
    coolRoom: 1,
    flavor: "Mint Chocolate",
    batch: "FD-2026-002",
    date: "09:15 AM",
    quantity: 60,
  },
  {
    id: 3,
    coolRoom: 1,
    flavor: "Classic Vanilla",
    batch: "FD-2026-001",
    date: "Yesterday",
    quantity: 120,
  },
];

// ==========================================
// COMMON HELPERS
// ==========================================

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "LKR 0.00";
  }

  return (
    "LKR " +
    amount.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(value) {
  if (!value) {
    return "Not available";
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
  return String(
    value || "PENDING_REVIEW"
  )
    .trim()
    .toUpperCase();
}

function paymentMethodLabel(value) {
  const method = String(
    value || ""
  ).toUpperCase();

  if (method === "BANK_TRANSFER") {
    return "Bank Transfer";
  }

  if (method === "CHEQUE") {
    return "Cheque";
  }

  return method.replaceAll("_", " ");
}

// ==========================================
// JWT AUTHENTICATION
//
// Same session storage used throughout
// the existing Seventeen application.
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
// ADMIN API REQUEST
//
// This helper is only used for the NEW
// direct-sales payment workflow.
//
// Existing wholesale components continue
// using their original API services.
// ==========================================

async function adminPaymentRequest(
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

  if (
    options.body != null &&
    typeof options.body === "string"
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
        headers,
        cache: "no-store",
      }
    );

  } catch {
    throw new Error(
      "Cannot connect to Spring Boot."
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
// ORIGINAL COOL ROOM CARD
// ==========================================

function CoolRoomCard({
  room,
  records,
}) {
  return (
    <section className="rounded-[22px] border border-[#9BAED1] bg-[#FFF0E6] p-5 shadow-sm sm:p-6">

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

        <h2 className="font-serif text-xl font-bold text-[#283247]">
          Production for CoolRoom{room}
        </h2>

        <button
          type="button"
          onClick={() =>
            window.alert(
              `${records.length} records shown for CoolRoom ${room}`
            )
          }
          className="text-xs font-medium text-pink-500 hover:underline"
        >
          View Full History →
        </button>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[490px] text-left text-sm">

          <thead>
            <tr className="text-[10px] tracking-wider text-[#98A6BF]">

              <th className="pb-3 font-semibold">
                FLAVOR
              </th>

              <th className="pb-3 font-semibold">
                BATCH
              </th>

              <th className="pb-3 font-semibold">
                DATE/TIME
              </th>

              <th className="pb-3 text-right font-semibold">
                QUANTITY
              </th>

            </tr>
          </thead>

          <tbody>

            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="border-t border-[#B5C1D8] py-6 text-center text-slate-500"
                >
                  No production records yet.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-[#B5C1D8] text-[#35415A]"
                >

                  <td className="py-4">
                    <div className="flex items-center gap-3 font-semibold">

                      <span
                        className="h-6 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            flavorColors[
                              record.flavor
                            ] || "#D0D8E9",
                        }}
                      />

                      {record.flavor}

                    </div>
                  </td>

                  <td className="py-4 text-xs">
                    {record.batch}
                  </td>

                  <td className="py-4 text-xs">
                    {record.date}
                  </td>

                  <td className="py-4 text-right font-bold">
                    {record.quantity} L
                  </td>

                </tr>
              ))
            )}

          </tbody>

        </table>

      </div>

    </section>
  );
}

// ==========================================
// NEW: DIRECT SALES PAYMENT STATUS BADGE
// ==========================================

function DirectPaymentStatus({
  status,
}) {
  const normalized =
    normalizeStatus(status);

  const styles = {
    PENDING_REVIEW: {
      label: "Pending Admin Review",
      className:
        "bg-amber-100 text-amber-800",
    },

    APPROVED: {
      label: "Approved - Awaiting Clearance",
      className:
        "bg-blue-100 text-blue-800",
    },

    CONFIRMED: {
      label: "Payment Confirmed",
      className:
        "bg-green-100 text-green-800",
    },

    REJECTED: {
      label: "Rejected",
      className:
        "bg-red-100 text-red-800",
    },
  };

  const item =
    styles[normalized] || {
      label:
        normalized.replaceAll("_", " "),
      className:
        "bg-slate-100 text-slate-700",
    };

  return (
    <span
      className={
        "inline-flex rounded-full " +
        "px-3 py-1 text-xs font-bold " +
        item.className
      }
    >
      {item.label}
    </span>
  );
}

// ==========================================
// NEW: DIRECT SALES PAYMENT DETAIL ROW
// ==========================================

function DirectPaymentDetail({
  label,
  value,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 text-sm">

      <span className="text-slate-500">
        {label}
      </span>

      <strong className="break-words text-right text-[#17265B]">
        {value ?? "Not available"}
      </strong>

    </div>
  );
}

// ==========================================
// NEW: DIRECT SALES PAYMENT REVIEW PANEL
//
// Admin-only endpoints:
//
// GET:
// /api/admin/sales-bill-payments
//
// GET:
// /api/admin/sales-bill-payments/{id}/proof
//
// POST:
// /api/admin/sales-bill-payments/{id}/approve
//
// POST:
// /api/admin/sales-bill-payments/{id}/confirm-cleared
//
// POST:
// /api/admin/sales-bill-payments/{id}/reject
//
// IMPORTANT:
// Wholesale payments are not handled here.
// ==========================================

function AdminDirectSalesPayments() {
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

  const [rejectingId, setRejectingId] =
    useState(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  // ========================================
  // LOAD DIRECT SALES PAYMENT PROOFS
  // ========================================

  const loadPayments = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setRefreshing(true);
      }

      try {
        const response =
          await adminPaymentRequest(
            "/api/admin/sales-bill-payments"
          );

        // Support a direct JSON array or a
        // named list returned by the backend.

        const rows =
          Array.isArray(response)
            ? response
            : (
                response?.payments ??
                response?.proofs ??
                response?.content ??
                response?.items
              );

        if (!Array.isArray(rows)) {
          throw new Error(
            "Invalid direct-sales payment response."
          );
        }

        setPayments(rows);
        setError("");

      } catch (err) {
        setError(
          err.message ||
          "Unable to load direct-sales payments."
        );

      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // ========================================
  // LOAD WHEN ADMIN OPENS THIS PAGE
  // ========================================

  useEffect(() => {
    loadPayments(false);
  }, [loadPayments]);

  // ========================================
  // AUTOMATIC STATUS REFRESH
  // ========================================

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (
          document.visibilityState ===
            "visible" &&
          busyId == null &&
          proofLoadingId == null
        ) {
          loadPayments(false);
        }
      },
      15000
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    loadPayments,
    busyId,
    proofLoadingId,
  ]);

  // ========================================
  // NORMALIZE PAYMENT ROWS
  // ========================================

  const normalizedPayments = useMemo(
    () =>
      payments.map((payment) => ({
        ...payment,

        id: Number(
          payment.id ??
          payment.proofId ??
          payment.paymentId
        ),

        billId: Number(
          payment.billId ??
          payment.bill_id ??
          payment.salesBillId
        ),

        method: String(
          payment.method ??
          payment.paymentMethod ??
          ""
        ).toUpperCase(),

        status: normalizeStatus(
          payment.status
        ),

        amount: Number(
          payment.amount ??
          payment.paymentAmount ??
          0
        ),

        customerName:
          payment.customerName ??
          payment.shopName ??
          payment.customer ??
          "Not available",

        invoiceTotal:
          payment.invoiceTotal ??
          payment.totalAmount ??
          payment.billTotal ??
          null,

        submittedByName:
          payment.submittedByName ??
          payment.salesManagerName ??
          payment.submittedByEmail ??
          payment.salesRepresentativeName ??
          payment.submittedBy ??
          "Not available",

        transferReference:
          payment.transferReference ??
          payment.bankReference ??
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

        createdAt:
          payment.createdAt ??
          payment.submittedAt ??
          payment.created_at ??
          null,

        rejectionReason:
          payment.rejectionReason ??
          payment.rejection_reason ??
          "",
      })),
    [payments]
  );

  // ========================================
  // SEARCH AND FILTER
  // ========================================

  const filteredPayments = useMemo(
    () => {
      const keyword =
        search.trim().toLowerCase();

      return normalizedPayments.filter(
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

          const searchText = [
            payment.id,
            payment.billId,
            `INV-${payment.billId}`,
            payment.customerName,
            payment.submittedByName,
            payment.method,
            payment.status,
            payment.transferReference,
            payment.chequeNumber,
            payment.issuingBank,
          ]
            .join(" ")
            .toLowerCase();

          return searchText.includes(keyword);
        }
      );
    },
    [
      normalizedPayments,
      search,
      methodFilter,
      statusFilter,
    ]
  );

  // ========================================
  // SUMMARY COUNTS
  // ========================================

  const summary = useMemo(
    () => ({
      total: normalizedPayments.length,

      pending: normalizedPayments.filter(
        (payment) =>
          payment.status ===
          "PENDING_REVIEW"
      ).length,

      approvedCheques:
        normalizedPayments.filter(
          (payment) =>
            payment.method === "CHEQUE" &&
            payment.status === "APPROVED"
        ).length,

      confirmed:
        normalizedPayments.filter(
          (payment) =>
            payment.status === "CONFIRMED"
        ).length,
    }),
    [normalizedPayments]
  );

  // ========================================
  // SECURELY VIEW PAYMENT PROOF
  //
  // Requires ADMIN JWT.
  //
  // Cannot use an ordinary unauthenticated
  // image URL because the backend is secured.
  // ========================================

  async function viewProof(payment) {
    if (
      !Number.isSafeInteger(payment.id) ||
      payment.id <= 0
    ) {
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
      const response = await fetch(
        `${BASE_URL}/api/admin/sales-bill-payments/${payment.id}/proof`,
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
          "Unable to load payment proof.";

        try {
          const data =
            await response.json();

          reason =
            data?.detail ||
            data?.message ||
            reason;
        } catch {
          // Keep default error.
        }

        throw new Error(reason);
      }

      const blob =
        await response.blob();

      if (!blob.size) {
        throw new Error(
          "Payment proof is empty."
        );
      }

      // Opening a Blob URL allows the
      // authenticated evidence to be viewed
      // without exposing the JWT in the URL.

      const objectUrl =
        URL.createObjectURL(blob);

      const opened =
        window.open(
          objectUrl,
          "_blank",
          "noopener,noreferrer"
        );

      if (!opened) {
        const anchor =
          document.createElement("a");

        anchor.href = objectUrl;

        anchor.target = "_blank";

        anchor.rel =
          "noopener noreferrer";

        anchor.click();
      }

      // Release the temporary URL later
      // to avoid retaining the file in memory.

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            objectUrl
          );
        },
        60000
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to view payment proof."
      );

    } finally {
      setProofLoadingId(null);
    }
  }

  // ========================================
  // ADMIN APPROVE PAYMENT
  //
  // BANK_TRANSFER:
  // Admin checks that the full amount
  // actually reached the company bank.
  //
  // CHEQUE:
  // Admin approves cheque details only.
  // No invoice payment is recorded until
  // the cheque clears.
  // ========================================

  async function approvePayment(payment) {
    if (
      busyId != null ||
      payment.status !== "PENDING_REVIEW"
    ) {
      return;
    }

    const isBank =
      payment.method === "BANK_TRANSFER";

    const confirmationMessage = isBank
      ? (
          `Have you independently verified ` +
          `that ${money(payment.amount)} ` +
          `was credited to the company bank ` +
          `account for INV-${payment.billId}? ` +
          `Only confirm after checking the ` +
          `actual bank transaction.`
        )
      : (
          `Approve cheque ${payment.chequeNumber} ` +
          `for invoice INV-${payment.billId}? ` +
          `This approval will NOT mark the ` +
          `invoice as paid until the cheque clears.`
        );

    if (
      !window.confirm(
        confirmationMessage
      )
    ) {
      return;
    }

    setBusyId(payment.id);
    setError("");
    setMessage("");

    try {
      await adminPaymentRequest(
        `/api/admin/sales-bill-payments/${payment.id}/approve`,
        {
          method: "POST",
        }
      );

      setMessage(
        isBank
          ? (
              `Bank transfer for invoice ` +
              `INV-${payment.billId} confirmed.`
            )
          : (
              `Cheque for invoice ` +
              `INV-${payment.billId} approved. ` +
              `Bank clearance is still required.`
            )
      );

      await loadPayments(false);

    } catch (err) {
      setError(
        err.message ||
        "Unable to approve payment."
      );

    } finally {
      setBusyId(null);
    }
  }

  // ========================================
  // CONFIRM ACTUAL CHEQUE BANK CLEARANCE
  // ========================================

  async function confirmChequeCleared(
    payment
  ) {
    if (
      busyId != null ||
      payment.method !== "CHEQUE" ||
      payment.status !== "APPROVED"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Have you verified that cheque ` +
        `${payment.chequeNumber} for ` +
        `${money(payment.amount)} has ` +
        `actually cleared the bank? ` +
        `This action will confirm payment ` +
        `against invoice INV-${payment.billId}.`
      )
    ) {
      return;
    }

    setBusyId(payment.id);
    setError("");
    setMessage("");

    try {
      await adminPaymentRequest(
        `/api/admin/sales-bill-payments/${payment.id}/confirm-cleared`,
        {
          method: "POST",
        }
      );

      setMessage(
        `Cheque for invoice ` +
        `INV-${payment.billId} ` +
        `confirmed as cleared.`
      );

      await loadPayments(false);

    } catch (err) {
      setError(
        err.message ||
        "Unable to confirm cheque clearance."
      );

    } finally {
      setBusyId(null);
    }
  }

  // ========================================
  // OPEN REJECTION FORM
  // ========================================

  function openRejectForm(payment) {
    if (
      busyId != null ||
      payment.status === "CONFIRMED"
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
  // Admin must provide a reason.
  //
  // Backend records the rejection.
  // ========================================

  async function rejectPayment(payment) {
    if (
      busyId != null ||
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
        `Reject payment proof for ` +
        `invoice INV-${payment.billId}?`
      )
    ) {
      return;
    }

    setBusyId(payment.id);
    setError("");
    setMessage("");

    try {
      await adminPaymentRequest(
        `/api/admin/sales-bill-payments/${payment.id}/reject`,
        {
          method: "POST",

          body: JSON.stringify({
            reason,
            rejectionReason: reason,
          }),
        }
      );

      setMessage(
        `Payment proof for invoice ` +
        `INV-${payment.billId} rejected.`
      );

      setRejectingId(null);
      setRejectionReason("");

      await loadPayments(false);

    } catch (err) {
      setError(
        err.message ||
        "Unable to reject payment."
      );

    } finally {
      setBusyId(null);
    }
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-[#17265B]">
            <FileCheck2
              className="text-[#3654FF]"
            />

            Direct Sales Payments
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Review bank transfers and cheques
            submitted by Sales Managers for
            direct sales invoices.
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Wholesale order payments are
            managed separately.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() =>
            loadPayments(true)
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-4 py-3 text-sm font-bold text-white hover:bg-[#2942D2] disabled:opacity-50"
        >
          <RefreshCw size={17} />

          {refreshing
            ? "Refreshing..."
            : "Refresh Payments"}
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={18}
            className="shrink-0"
          />

          <p>{error}</p>
        </div>
      )}

      {/* SUCCESS */}

      {message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          <CheckCircle2
            size={18}
            className="shrink-0"
          />

          <p>{message}</p>
        </div>
      )}

      {/* ================================== */}
      {/* PAYMENT SUMMARY CARDS */}
      {/* ================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

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

      </div>

      {/* ================================== */}
      {/* SEARCH AND FILTER */}
      {/* ================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="grid gap-4 lg:grid-cols-3">

          {/* SEARCH */}

          <div>
            <label
              htmlFor="direct-payment-search"
              className="mb-2 block text-xs font-bold text-slate-600"
            >
              Search Invoice / Shop / Cheque
            </label>

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3 top-3.5 text-slate-400"
              />

              <input
                id="direct-payment-search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="INV-12, shop, cheque number..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#3654FF]"
              />

            </div>
          </div>

          {/* METHOD */}

          <div>
            <label
              htmlFor="direct-payment-method"
              className="mb-2 block text-xs font-bold text-slate-600"
            >
              Payment Method
            </label>

            <select
              id="direct-payment-method"
              value={methodFilter}
              onChange={(event) =>
                setMethodFilter(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#3654FF]"
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

          {/* STATUS */}

          <div>
            <label
              htmlFor="direct-payment-status"
              className="mb-2 block text-xs font-bold text-slate-600"
            >
              Payment Status
            </label>

            <select
              id="direct-payment-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#3654FF]"
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

          Loading direct-sales payments...

        </div>
      )}

      {/* ================================== */}
      {/* NO PAYMENTS */}
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
              No payment evidence matches
              your current filters.
            </p>

          </div>
        )}

      {/* ================================== */}
      {/* PAYMENT RECORDS */}
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

                  <DirectPaymentStatus
                    status={payment.status}
                  />

                </div>

                {/* PAYMENT METHOD */}

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#F3F5FF] p-4">

                  {isBank ? (
                    <Landmark
                      size={20}
                      className="text-[#3654FF]"
                    />
                  ) : (
                    <ReceiptText
                      size={20}
                      className="text-[#3654FF]"
                    />
                  )}

                  <span className="text-sm font-bold text-[#17265B]">
                    {paymentMethodLabel(
                      payment.method
                    )}
                  </span>

                </div>

                {/* PAYMENT DETAILS */}

                <div className="mt-5 space-y-3">

                  <DirectPaymentDetail
                    label="Proof ID"
                    value={`#${payment.id}`}
                  />

                  <DirectPaymentDetail
                    label="Invoice Number"
                    value={`INV-${payment.billId}`}
                  />

                  <DirectPaymentDetail
                    label="Submitted Amount"
                    value={money(
                      payment.amount
                    )}
                  />

                  {payment.invoiceTotal != null && (
                    <DirectPaymentDetail
                      label="Invoice Total"
                      value={money(
                        payment.invoiceTotal
                      )}
                    />
                  )}

                  <DirectPaymentDetail
                    label="Sales Manager"
                    value={
                      payment.submittedByName
                    }
                  />

                  <DirectPaymentDetail
                    label="Submitted At"
                    value={formatDate(
                      payment.createdAt
                    )}
                  />

                  {isBank && (
                    <DirectPaymentDetail
                      label="Transfer Reference"
                      value={
                        payment.transferReference
                      }
                    />
                  )}

                  {isCheque && (
                    <>

                      <DirectPaymentDetail
                        label="Cheque Number"
                        value={
                          payment.chequeNumber
                        }
                      />

                      <DirectPaymentDetail
                        label="Issuing Bank"
                        value={
                          payment.issuingBank
                        }
                      />

                      <DirectPaymentDetail
                        label="Cheque Date"
                        value={
                          payment.chequeDate
                        }
                      />

                    </>
                  )}

                </div>

                {/* REJECTION DETAILS */}

                {payment.status ===
                  "REJECTED" && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

                    <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                      <XCircle size={17} />
                      Payment Rejected
                    </p>

                    <p className="mt-2 text-sm text-red-700">
                      {payment.rejectionReason ||
                        "No reason provided."}
                    </p>

                  </div>
                )}

                {/* IMPORTANT PAYMENT STATUS */}

                {approvedCheque && (
                  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

                    <p className="flex items-center gap-2 text-sm font-bold text-blue-800">
                      <ShieldCheck size={18} />
                      Cheque Approved
                    </p>

                    <p className="mt-2 text-sm text-blue-800">
                      The cheque is approved,
                      but the invoice is not
                      paid until the bank
                      confirms clearance.
                    </p>

                  </div>
                )}

                {confirmed && (
                  <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

                    <p className="flex items-center gap-2 text-sm font-bold text-green-800">
                      <CheckCircle2 size={18} />
                      Payment Confirmed
                    </p>

                  </div>
                )}

                {/* ================================== */}
                {/* ACTIONS */}
                {/* ================================== */}

                <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">

                  {/* VIEW UPLOADED EVIDENCE */}

                  <button
                    type="button"
                    onClick={() =>
                      viewProof(payment)
                    }
                    disabled={
                      proofLoadingId ===
                      payment.id
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#BFCBFF] bg-[#F3F5FF] px-4 py-3 text-sm font-bold text-[#3654FF] hover:bg-[#E5EAFF] disabled:opacity-50"
                  >
                    <Eye size={18} />

                    {proofLoadingId ===
                      payment.id
                      ? "Loading Proof..."
                      : (
                          isBank
                            ? "View Bank Slip"
                            : "View Cheque Photo"
                        )}
                  </button>

                  {/* ADMIN APPROVAL */}

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

                  {/* CHEQUE BANK CLEARANCE */}

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
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Wallet size={18} />

                      {busy
                        ? "Confirming..."
                        : "Confirm Cheque Cleared"}
                    </button>
                  )}

                  {/* REJECT PAYMENT */}

                  {canReject &&
                    rejectingId !==
                      payment.id && (
                    <button
                      type="button"
                      disabled={
                        busyId != null
                      }
                      onClick={() =>
                        openRejectForm(
                          payment
                        )
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

                      <label className="block text-sm font-bold text-red-800">
                        Rejection Reason
                      </label>

                      <textarea
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
                        placeholder="Explain why the bank slip or cheque was rejected."
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
                            rejectPayment(
                              payment
                            )
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

      {/* BOTTOM REMINDER */}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

        <p className="font-bold">
          Payment Verification Policy
        </p>

        <p className="mt-2">
          Bank transfers must be confirmed
          against actual company bank records.

          Cheques must be approved first
          and recorded as paid only after
          successful bank clearance.

          Uploaded photographs alone are
          not proof that money has been received.
        </p>

      </div>

    </section>
  );
}

// ==========================================
// MAIN ADMIN DASHBOARD
//
// All original production functionality
// is retained.
//
// NEW:
// Direct Sales Payments section.
// ==========================================

export default function AdminDashboard({
  user,
  onLogout,
}) {
  // ========================================
  // ORIGINAL STATE
  // ========================================

  const [activeMenu, setActiveMenu] =
    useState("Production");

  const [records, setRecords] =
    useState(initialRecords);

  const [coolRoom, setCoolRoom] =
    useState("3");

  const [flavor, setFlavor] =
    useState("Strawberry Swirl");

  const [quantity, setQuantity] =
    useState("");

  const [
    pendingEntries,
    setPendingEntries,
  ] = useState([]);

  const [message, setMessage] =
    useState("");

  // ========================================
  // ORIGINAL PRODUCTION TOTAL
  // ========================================

  const totalProduced =
    pendingEntries.reduce(
      (total, entry) =>
        total + entry.quantity,
      0
    );

  // ========================================
  // ADD PRODUCTION ENTRY
  // ========================================

  function addEntry(event) {
    event.preventDefault();

    const amount =
      Number(quantity);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        "Enter a valid quantity greater than zero."
      );
      return;
    }

    setPendingEntries(
      (previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),

          coolRoom:
            Number(coolRoom),

          flavor,

          quantity:
            amount,
        },
      ]
    );

    setQuantity("");
    setMessage("");
  }

  // ========================================
  // REMOVE PRODUCTION ENTRY
  // ========================================

  function removeEntry(id) {
    setPendingEntries(
      (previous) =>
        previous.filter(
          (entry) =>
            entry.id !== id
        )
    );
  }

  // ========================================
  // SAVE PRODUCTION
  //
  // Original session-based functionality
  // preserved.
  // ========================================

  function saveProduction() {
    if (
      pendingEntries.length === 0
    ) {
      setMessage(
        "Add at least one production entry."
      );
      return;
    }

    const newRecords =
      pendingEntries.map(
        (entry, index) => ({
          ...entry,

          batch:
            `FD-${Date.now()}-${index + 1}`,

          date:
            new Date().toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            ),
        })
      );

    setRecords(
      (previous) => [
        ...newRecords,
        ...previous,
      ]
    );

    setPendingEntries([]);

    setMessage(
      "Production records saved for this session."
    );
  }

  // ========================================
  // EXISTING INPUT STYLES
  // ========================================

  const inputClasses =
    "h-11 w-full rounded-xl border " +
    "border-slate-200 bg-[#FFFDFC] " +
    "px-3 text-sm text-[#27344B] " +
    "outline-none focus:border-cyan-400 " +
    "focus:ring-2 focus:ring-cyan-200";

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9F3] text-[#263047] md:flex-row">

      {/* ================================== */}
      {/* SIDEBAR */}
      {/* ================================== */}

      <aside className="flex w-full shrink-0 flex-col bg-white md:min-h-screen md:w-56">

        {/* BRAND */}

        <div className="px-5 pb-6 pt-8">

          <h2 className="font-serif text-2xl font-bold">
            Frosty Delights
          </h2>

          <p className="mt-1 text-[9px] tracking-[2px] text-[#526E80]">
            FACTORY MANAGEMENT
          </p>

        </div>

        {/* SIDEBAR NAVIGATION */}

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col">

          {menuItems.map(
            ({
              label,
              icon: Icon,
            }) => (

              <button
                key={label}
                type="button"
                onClick={() =>
                  setActiveMenu(
                    label
                  )
                }
                className={
                  "flex shrink-0 items-center " +
                  "gap-3 rounded-xl px-4 py-3 " +
                  "text-left text-sm " +
                  "transition-colors md:w-full " +
                  (
                    activeMenu === label
                      ? (
                          "bg-white font-semibold " +
                          "text-pink-500"
                        )
                      : (
                          "text-[#49657B] " +
                          "hover:bg-white/50"
                        )
                  )
                }
              >
                <Icon size={17} />

                {label}

              </button>

            )
          )}

        </nav>

        {/* LOGOUT */}

        <button
          type="button"
          onClick={
            onLogout
          }
          className="mt-auto flex items-center gap-3 border-t border-white/40 px-7 py-5 text-sm font-semibold text-pink-500 hover:bg-white/20"
        >
          <LogOut size={18} />

          Logout
        </button>

      </aside>

      {/* ================================== */}
      {/* MAIN CONTENT */}
      {/* ================================== */}

      <main className="min-w-0 flex-1">

        {/* ================================== */}
        {/* TOP HEADER */}
        {/* ================================== */}

        <header className="flex flex-wrap items-center justify-between gap-4 bg-white px-5 py-5 lg:px-8">

          <div className="flex items-center gap-3">

            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFE7AA] text-pink-600">

              <ChartNoAxesCombined
                size={21}
              />

            </div>

            <div>

              <h1 className="text-sm font-bold">
                Admin Overview
              </h1>

              <p className="mt-1 text-[9px] tracking-widest text-[#587E8C]">
                HEAD OFFICE · ALL OUTLETS
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2 rounded-full bg-[#FFF0CE] px-4 py-2 text-xs">

            <Clock size={14} />

            {new Date().toLocaleDateString(
              "en-GB",
              {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              }
            )}

          </div>

          <div className="flex items-center gap-3">

            <div className="text-right">

              <p className="text-sm font-bold">
                {user?.fullName ||
                  "Admin User"}
              </p>

              <p className="text-[10px]">
                MANAGER
              </p>

            </div>

            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#D98CAB] font-bold text-white">
              {(user?.fullName || "A")
                .charAt(0)
                .toUpperCase()}
            </div>

          </div>

        </header>

        {/* ================================== */}
        {/* CONTENT */}
        {/* ================================== */}

        <div className="p-4 sm:p-6 lg:p-8">

          {/* SECTION HEADER */}

          <div className="mb-6">

            <h2 className="text-2xl font-bold">
              {activeMenu}
            </h2>

            <p className="mt-1 text-sm text-slate-500">

              {activeMenu === "Production"
                ? (
                    "Manage ice cream production " +
                    "across cool rooms."
                  )
                : activeMenu ===
                    "Direct Sales Payments"
                  ? (
                      "Review Sales Manager bank " +
                      "transfers and cheque payments."
                    )
                  : (
                      `Manage ${activeMenu.toLowerCase()} operations.`
                    )}

            </p>

          </div>

          {/* ================================== */}
          {/* PRODUCTION */}
          {/* ORIGINAL FUNCTIONALITY */}
          {/* ================================== */}

          {activeMenu === "Production" ? (

            <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">

              {/* COOL ROOMS */}

              <div className="flex flex-col gap-6">

                {[1, 2, 3].map(
                  (room) => (

                    <CoolRoomCard
                      key={room}
                      room={room}
                      records={
                        records.filter(
                          (record) =>
                            record.coolRoom === room
                        )
                      }
                    />

                  )
                )}

              </div>

              {/* ================================== */}
              {/* RECORD PRODUCTION */}
              {/* ================================== */}

              <aside className="flex min-h-[680px] flex-col rounded-[25px] bg-[#C99BAF] p-6">

                <h2 className="font-serif text-[22px] font-bold">
                  Record Production
                </h2>

                <p className="mb-6 mt-2 text-xs text-[#D8E2EF]">
                  Enter production details
                </p>

                <form onSubmit={addEntry}>

                  {/* COOL ROOM */}

                  <label
                    htmlFor="coolRoom"
                    className="mb-2 block text-xs text-white/80"
                  >
                    Select CoolRoom
                  </label>

                  <select
                    id="coolRoom"
                    value={coolRoom}
                    onChange={(event) =>
                      setCoolRoom(
                        event.target.value
                      )
                    }
                    className={
                      inputClasses +
                      " mb-5"
                    }
                  >
                    <option value="1">
                      CoolRoom 1
                    </option>

                    <option value="2">
                      CoolRoom 2
                    </option>

                    <option value="3">
                      CoolRoom 3
                    </option>
                  </select>

                  {/* FLAVOUR AND QUANTITY */}

                  <div className="mb-5 grid grid-cols-[1.3fr_1fr] gap-3">

                    <div className="min-w-0">

                      <label
                        htmlFor="flavor"
                        className="mb-2 block text-xs text-white/80"
                      >
                        Flavour
                      </label>

                      <select
                        id="flavor"
                        value={flavor}
                        onChange={(event) =>
                          setFlavor(
                            event.target.value
                          )
                        }
                        className={
                          inputClasses
                        }
                      >

                        {flavors.map(
                          (item) => (
                            <option
                              key={item}
                              value={item}
                            >
                              {item}
                            </option>
                          )
                        )}

                      </select>

                    </div>

                    <div className="min-w-0">

                      <label
                        htmlFor="quantity"
                        className="mb-2 block text-xs text-white/80"
                      >
                        Quantity (L)
                      </label>

                      <input
                        id="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 50"
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(
                            event.target.value
                          )
                        }
                        className={
                          inputClasses
                        }
                      />

                    </div>

                  </div>

                  {/* ADD ENTRY */}

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FFE1B5] text-xs font-semibold text-blue-700 transition hover:brightness-95"
                  >
                    <Plus size={17} />

                    Add Entry
                  </button>

                </form>

                <div className="my-6 h-px bg-white/40" />

                {/* ================================== */}
                {/* TODAY'S BATCHES */}
                {/* ================================== */}

                <div className="mb-4 flex items-center justify-between gap-2">

                  <h3 className="text-sm font-bold">
                    Today's Batches
                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      setPendingEntries([])
                    }
                    className="text-[10px] font-semibold text-pink-400"
                  >
                    CLEAR ALL
                  </button>

                </div>

                <div className="flex flex-col gap-4">

                  {pendingEntries.length === 0 ? (

                    <p className="text-xs text-white/80">
                      No new entries added yet.
                    </p>

                  ) : (

                    pendingEntries.map(
                      (entry) => (

                        <div
                          key={entry.id}
                          className="flex items-center gap-2 text-xs"
                        >

                          <span
                            className="h-6 w-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                flavorColors[
                                  entry.flavor
                                ] ||
                                "#D0D8E9",
                            }}
                          />

                          <div className="min-w-0 flex-1">

                            <p className="truncate">
                              {entry.flavor}
                            </p>

                            <p className="mt-1 text-[10px] text-white/70">
                              CoolRoom {entry.coolRoom}
                            </p>

                          </div>

                          <strong className="whitespace-nowrap">
                            {entry.quantity} L
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              removeEntry(
                                entry.id
                              )
                            }
                            aria-label={
                              `Remove ${entry.flavor}`
                            }
                            className="text-pink-200 hover:text-white"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>

                      )
                    )
                  )}

                </div>

                {/* ================================== */}
                {/* SAVE PRODUCTION */}
                {/* ================================== */}

                <div className="mt-auto pt-8">

                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-[#FFFDFC] p-5">

                    <span className="text-xs text-slate-500">
                      Total Produced
                    </span>

                    <strong className="text-2xl text-pink-500">
                      {totalProduced} L
                    </strong>

                  </div>

                  <button
                    type="button"
                    onClick={
                      saveProduction
                    }
                    className="h-12 w-full rounded-xl bg-[#D7E8C5] text-xs font-semibold text-green-900 transition hover:brightness-95"
                  >
                    Save Production Log in Cool Room
                  </button>

                  {message && (
                    <p
                      className="mt-3 text-xs text-white"
                      role="status"
                    >
                      {message}
                    </p>
                  )}

                </div>

              </aside>

            </div>

          ) : activeMenu ===
            "Bank Transfer Payments" ? (

            // EXISTING WHOLESALE BANK PAGE

            <BankTransferPayments />

          ) : activeMenu ===
            "Cheque Payments" ? (

            // EXISTING WHOLESALE CHEQUE PAGE

            <ChequePayments />

          ) : activeMenu ===
            "Direct Sales Payments" ? (

            // NEW DIRECT SALES PAYMENT PAGE

            <AdminSalesBillPayment />

          ) : (

            // EXISTING PLACEHOLDER MODULES

            <section className="rounded-2xl bg-[#FFF0E6] p-8">

              <h3 className="text-xl font-semibold">
                {activeMenu}
              </h3>

              <p className="mt-3 text-sm text-slate-600">
                This module will be connected
                to its Spring Boot API.
              </p>

              <button
                type="button"
                onClick={() =>
                  setActiveMenu(
                    "Production"
                  )
                }
                className="mt-5 rounded-lg bg-[#F8D7E5] px-5 py-3 text-sm font-semibold"
              >
                Return to Production
              </button>

            </section>

          )}

        </div>

      </main>

    </div>
  );
}
