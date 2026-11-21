
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Wallet,
  CheckCircle2,
  CreditCard,
  FileText,
  Upload,
  Download,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

import {
  salesVehicleApi,
} from "../../services/salesVehicleApi";

// ==========================================
// CURRENCY FORMATTING
// ==========================================

const money = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not available";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(amount);
};

// ==========================================
// PAYMENT METHOD LABELS
// ==========================================

const labels = {
  cash: "Cash",
  bank: "Bank Transfer",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit: "Credit",
  confirm: "Confirm with Wholesale Team",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 " +
  "bg-white px-3 py-2.5 text-sm outline-none " +
  "focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

// ==========================================
// NORMALIZE PAYMENT METHOD
// ==========================================

function normalizeMethod(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isBankReceipt(receipt) {
  const method = normalizeMethod(
    receipt?.method ?? receipt?.paymentMethod
  );

  return (
    method === "BANK_TRANSFER" ||
    method === "BANK"
  );
}

// ==========================================
// BANK PAYMENT APPROVAL STATUS
//
// Read-only information for Sales Manager.
//
// Only Admin can approve or reject.
// ==========================================

function bankStatusDetails(status) {
  const normalized = String(
    status ?? ""
  ).toUpperCase();

  switch (normalized) {
    case "CONFIRMED":
    case "VERIFIED":
      return {
        label: "Payment Approved by Admin",
        className:
          "bg-emerald-50 text-emerald-700",
      };

    case "APPROVED":
      return {
        label: "Approved by Admin",
        className:
          "bg-emerald-50 text-emerald-700",
      };

    case "PENDING_REVIEW":
    case "PENDING":
      return {
        label: "Awaiting Admin Approval",
        className:
          "bg-amber-50 text-amber-700",
      };

    case "REJECTED":
      return {
        label: "Bank Slip Rejected by Admin",
        className:
          "bg-red-50 text-red-700",
      };

    default:
      return {
        label:
          normalized.replaceAll("_", " ") ||
          "Payment Not Confirmed",

        className:
          "bg-slate-100 text-slate-600",
      };
  }
}

// ==========================================
// READ-ONLY BANK PAYMENT STATUS
// ==========================================

function BankPaymentStatus({ receipt }) {
  const details = bankStatusDetails(
    receipt?.status
  );

  return (
    <div
      className={
        "mt-3 rounded-lg px-3 py-2 " +
        "text-xs font-bold " +
        details.className
      }
    >
      {details.label}
    </div>
  );
}

// ==========================================
// VALIDATE PAYMENT AMOUNT
// ==========================================

function validAmount(value, remaining) {
  const text = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return false;
  }

  const amount = Number(text);

  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    Number.isFinite(remaining) &&
    amount <= remaining
  );
}

// ==========================================
// DOWNLOAD NON-BANK PAYMENT PROOF
//
// Existing cheque proof viewing retained.
// Bank slip viewing belongs to Admin.
// ==========================================

async function openProof(receipt) {
  if (isBankReceipt(receipt)) {
    throw new Error(
      "Only the Admin can view bank transfer slips."
    );
  }

  const receiptId =
    receipt.id ?? receipt.receiptId;

  if (!receiptId) {
    throw new Error(
      "Invalid payment receipt ID."
    );
  }

  const blob =
    await salesVehicleApi.getPaymentProof(
      receiptId
    );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `payment-proof-${receiptId}`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==========================================
// MAIN WHOLESALE PAYMENT PANEL
// ==========================================

export default function WholesalePaymentPanel({
  order,
  onRecorded,
}) {
  const orderId = order.orderId ?? order.id;

  const method = normalizeMethod(
    order.paymentMethod
  ).toLowerCase();

  const delivered =
    String(
      order.deliveryStatus ||
      order.status ||
      ""
    ).toUpperCase() === "DELIVERED";

  const isCash = method === "cash";

  const isCredit = method === "credit";

  const isCheque = method === "cheque";

  const isBank =
    method === "bank" ||
    method === "bank_transfer";

  // ========================================
  // STATES
  // ========================================

  const [summary, setSummary] =
    useState(null);

  const [amount, setAmount] =
    useState("");

  const [file, setFile] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [receiptKey, setReceiptKey] =
    useState(() => crypto.randomUUID());

  // ========================================
  // LOAD PAYMENT SUMMARY
  //
  // Retrieves latest payment status from
  // Spring Boot and PostgreSQL.
  // ========================================

  const load = useCallback(async () => {
    if (!delivered) {
      setSummary(null);

      setLoading(false);

      return;
    }

    setLoading(true);

    try {
      const data =
        await salesVehicleApi.getPaymentSummary(
          orderId
        );

      setSummary(data);

      setError("");

    } catch (err) {
      setSummary(null);

      setError(
        err.message ||
        "Unable to load payment information."
      );

    } finally {
      setLoading(false);
    }
  }, [orderId, delivered]);

  // ========================================
  // INITIAL PAYMENT SUMMARY
  // ========================================

  useEffect(() => {
    load();
  }, [load]);

  // ========================================
  // AUTO REFRESH BANK PAYMENT STATUS
  //
  // When Admin approves the bank slip,
  // the Sales Manager sees the updated
  // status without logging out.
  //
  // Refresh every 15 seconds.
  // ========================================

  useEffect(() => {
    if (!delivered || !isBank) {
      return;
    }

    let running = false;

    const timer = window.setInterval(
      async () => {
        if (
          document.visibilityState !== "visible" ||
          running ||
          busy ||
          loading
        ) {
          return;
        }

        running = true;

        try {
          await load();

        } finally {
          running = false;
        }
      },
      15000
    );

    return () => {
      window.clearInterval(timer);
    };

  }, [
    delivered,
    isBank,
    busy,
    loading,
    load,
  ]);

  // ========================================
  // RESET FORM WHEN ORDER CHANGES
  // ========================================

  useEffect(() => {
    setAmount("");

    setFile(null);

    setReceiptKey(
      crypto.randomUUID()
    );

    setMessage("");

    setError("");

  }, [orderId]);

  // ========================================
  // CALCULATE PAYMENT DETAILS
  // ========================================

  const total =
    summary?.orderTotal ??
    order.orderTotal;

  const confirmedPaid =
    summary?.confirmedPaid ??
    null;

  const remaining =
    summary?.remainingBalance == null
      ? null
      : Number(summary.remainingBalance);

  const plannedCash =
    summary?.plannedCash ??
    order.creditCashAmount;

  const requestedCredit =
    total != null &&
    plannedCash != null &&
    Number.isFinite(Number(total)) &&
    Number.isFinite(Number(plannedCash))
      ? Math.max(
          0,
          Number(total) -
          Number(plannedCash)
        )
      : null;

  const receipts = Array.isArray(
    summary?.receipts
  )
    ? summary.receipts
    : [];

  // ========================================
  // BANK TRANSFER RECEIPTS
  // ========================================

  const bankReceipts =
    receipts.filter(isBankReceipt);

  const pendingBank =
    bankReceipts.some(
      (receipt) =>
        String(
          receipt.status ?? ""
        ).toUpperCase() ===
        "PENDING_REVIEW"
    );

  const approvedBank =
    bankReceipts.some((receipt) =>
      [
        "APPROVED",
        "VERIFIED",
        "CONFIRMED",
      ].includes(
        String(
          receipt.status ?? ""
        ).toUpperCase()
      )
    );

  const rejectedBank =
    bankReceipts.some(
      (receipt) =>
        String(
          receipt.status ?? ""
        ).toUpperCase() ===
        "REJECTED"
    );

  // ========================================
  // PAYMENT AMOUNT VALIDATION
  // ========================================

  const amountIsValid =
    remaining !== null &&
    validAmount(amount, remaining);

  // ========================================
  // PENDING CHEQUE
  // ========================================

  const pendingCheque = receipts.some(
    (receipt) =>
      receipt.method === "CHEQUE" &&
      (
        receipt.status === "PENDING_REVIEW" ||
        receipt.status === "APPROVED"
      )
  );

  // ========================================
  // CHANGE PAYMENT AMOUNT
  // ========================================

  function changeAmount(value) {
    if (busy) return;

    setAmount(value);

    // A changed amount represents
    // a different payment attempt.

    setReceiptKey(
      crypto.randomUUID()
    );

    setError("");

    setMessage("");
  }

  // ========================================
  // NOTIFY SALES DASHBOARD
  // ========================================

  async function notifyDashboard() {
    if (!onRecorded) return;

    try {
      await onRecorded();

    } catch (err) {
      setError(
        "Payment was saved, but dashboard " +
        "refresh failed. Please refresh the page."
      );
    }
  }

  // ========================================
  // CASH RECEIVED
  //
  // EXISTING FUNCTIONALITY RETAINED
  // ========================================

  async function receiveCash() {
    if (
      busy ||
      !delivered ||
      !summary ||
      !amountIsValid ||
      !(isCash || isCredit)
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Have you actually received ${money(amount)} ` +
      `in cash for order #${orderId}?`
    );

    if (!confirmed) return;

    setBusy(true);

    setError("");

    setMessage("");

    try {
      await salesVehicleApi.receiveWholesaleCash(
        orderId,
        amount,
        receiptKey
      );

      setMessage(
        "Cash received and recorded successfully."
      );

      setAmount("");

      // Generate a new key only after success.

      setReceiptKey(
        crypto.randomUUID()
      );

      await load();

      await notifyDashboard();

    } catch (err) {
      // Keep receipt key for identical retry.

      setError(err.message);

    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // SUBMIT CHEQUE FOR ADMIN REVIEW
  //
  // EXISTING FUNCTIONALITY RETAINED
  // ========================================

  async function submitCheque() {
    if (
      busy ||
      !delivered ||
      !summary ||
      !isCheque ||
      !amountIsValid ||
      !file ||
      pendingCheque
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Submit cheque worth ${money(amount)} ` +
      `for wholesale order #${orderId} ` +
      "to the admin?"
    );

    if (!confirmed) return;

    setBusy(true);

    setError("");

    setMessage("");

    try {
      await salesVehicleApi.submitCheque(
        orderId,
        amount,
        file,
        receiptKey
      );

      setMessage(
        "Cheque submitted for admin review. " +
        "Payment has not been confirmed yet."
      );

      setFile(null);

      setAmount("");

      setReceiptKey(
        crypto.randomUUID()
      );

      await load();

      await notifyDashboard();

    } catch (err) {
      setError(err.message);

    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // BANK TRANSFER VERIFICATION REMOVED
  //
  // Sales Manager cannot approve payments.
  //
  // No verifyBank() function.
  // No verifyBankTransfer() API call.
  // No bank approval button.
  //
  // Only Admin can approve bank transfers.
  // ========================================

  // ========================================
  // VIEW NON-BANK PAYMENT PROOF
  //
  // Cheque proof viewing retained.
  // ========================================

  async function handleOpenProof(receipt) {
    setError("");

    if (isBankReceipt(receipt)) {
      setError(
        "Only the Admin can view bank transfer slips."
      );

      return;
    }

    try {
      await openProof(receipt);

    } catch (err) {
      setError(
        err.message ||
        "Unable to download payment proof."
      );
    }
  }

  // ========================================
  // RENDER PAYMENT PANEL
  // ========================================

  return (
    <section className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-5">

      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <div className="flex items-center gap-2">

        <Wallet
          size={20}
          className="text-blue-600"
        />

        <h3 className="font-bold text-slate-800">
          Wholesale Payment
        </h3>

      </div>

      {/* ================================== */}
      {/* SELECTED PAYMENT METHOD */}
      {/* ================================== */}

      <div className="mt-4 space-y-2 text-sm text-slate-700">

        <p>
          <strong>
            Selected Method:
          </strong>{" "}

          {labels[method] ||
            method ||
            "Not specified"}
        </p>

        <p>
          <strong>
            Order Total:
          </strong>{" "}

          {money(total)}
        </p>

        <p>
          <strong>
            Payment Status:
          </strong>{" "}

          {summary?.paymentStatus ||
            order.paymentStatus ||
            "PENDING"}
        </p>

        {isCredit && (
          <div className="mt-3 space-y-2 rounded-lg bg-white p-3">

            <p>
              <strong>
                Planned Cash:
              </strong>{" "}

              {money(plannedCash)}
            </p>

            <p>
              <strong>
                Requested Credit:
              </strong>{" "}

              {money(requestedCredit)}
            </p>

            <p className="text-xs text-slate-500">
              Planned cash is not counted as paid
              until actual receipt is confirmed.
            </p>

          </div>
        )}

      </div>

      {/* ================================== */}
      {/* NOT DELIVERED */}
      {/* ================================== */}

      {!delivered && (
        <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">

          <AlertTriangle
            size={18}
            className="shrink-0"
          />

          <p>
            Payment collection becomes available
            after the delivery person marks this
            wholesale order as Delivered.
          </p>

        </div>
      )}

      {/* ================================== */}
      {/* DELIVERED ORDER */}
      {/* ================================== */}

      {delivered && (
        <>

          {/* LOADING */}

          {loading && !summary && (
            <p className="mt-4 text-sm text-slate-500">
              Loading payment records...
            </p>
          )}

          {/* REFRESH */}

          <button
            type="button"
            disabled={busy || loading}
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 disabled:opacity-50"
          >

            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh Payment Details

          </button>

          {/* ================================== */}
          {/* PAYMENT BALANCES */}
          {/* ================================== */}

          {summary && (
            <div className="mt-4 grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-2">

              <div>

                <p className="text-xs text-slate-500">
                  Confirmed Paid
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {money(confirmedPaid)}
                </p>

              </div>

              <div>

                <p className="text-xs text-slate-500">
                  Remaining Balance
                </p>

                <p className="mt-1 text-lg font-bold text-rose-600">
                  {money(remaining)}
                </p>

              </div>

            </div>
          )}

          {/* ================================== */}
          {/* CASH AND CREDIT ORDERS */}
          {/* EXISTING FUNCTIONALITY RETAINED */}
          {/* ================================== */}

          {summary &&
            remaining > 0 &&
            (isCash || isCredit) && (

              <div className="mt-5 space-y-3 rounded-lg bg-white p-4">

                <div className="flex items-center gap-2">

                  <CheckCircle2
                    size={18}
                    className="text-emerald-600"
                  />

                  <h4 className="font-bold">
                    Cash Collection
                  </h4>

                </div>

                <label className="block text-sm font-semibold">
                  Actual Cash Received (LKR)
                </label>

                <input
                  type="number"
                  min="0.01"
                  max={remaining}
                  step="0.01"
                  value={amount}
                  disabled={busy}
                  onChange={(event) =>
                    changeAmount(event.target.value)
                  }
                  placeholder="Enter received amount"
                  className={inputClass}
                />

                <button
                  type="button"
                  disabled={
                    busy ||
                    !amountIsValid
                  }
                  onClick={receiveCash}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >

                  <CheckCircle2 size={18} />

                  {busy
                    ? "Saving..."
                    : "Cash Received"}

                </button>

                {isCredit && (
                  <p className="text-xs text-slate-500">
                    Confirmed cash reduces the
                    customer's remaining credit
                    balance and increases
                    Today's Cash.
                  </p>
                )}

              </div>
            )}

          {/* ================================== */}
          {/* BANK TRANSFER */}
          {/* ADMIN APPROVAL — READ ONLY */}
          {/* ================================== */}

          {summary && isBank && (

            <div className="mt-5 rounded-lg border border-blue-100 bg-white p-4">

              <div className="flex items-center gap-2">

                <CreditCard
                  size={18}
                  className="text-blue-600"
                />

                <h4 className="font-bold">
                  Bank Transfer
                </h4>

              </div>

              <p className="mt-2 text-xs text-slate-500">
                The wholesale customer uploads
                the bank transfer slip through
                their dashboard after delivery.
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Only the Admin can review bank
                slips, verify the transferred
                amount and approve or reject
                bank payments.
              </p>

              {/* NO BANK SLIP */}

              {bankReceipts.length === 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">

                  <AlertTriangle
                    size={18}
                    className="shrink-0"
                  />

                  Waiting for the customer to
                  upload the bank transfer slip.

                </div>
              )}

              {/* PENDING ADMIN APPROVAL */}

              {pendingBank && (
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4">

                  <div className="flex items-center gap-2 font-bold text-amber-700">

                    <AlertTriangle size={18} />

                    Awaiting Admin Approval

                  </div>

                  <p className="mt-2 text-xs text-amber-700">
                    The customer has submitted a
                    bank transfer receipt.
                    Payment will be confirmed
                    after Admin verification.
                  </p>

                </div>
              )}

              {/* APPROVED BANK TRANSFER */}

              {approvedBank && (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">

                  <div className="flex items-center gap-2 font-bold text-emerald-700">

                    <CheckCircle2 size={20} />

                    Payment Approved by Admin

                  </div>

                  <p className="mt-2 text-sm text-emerald-700">
                    At least one bank transfer
                    receipt has been approved
                    by the administration team.
                  </p>

                  <div className="mt-3 space-y-2 border-t border-emerald-200 pt-3 text-sm">

                    <div className="flex justify-between gap-3">

                      <span>
                        Confirmed Paid
                      </span>

                      <strong>
                        {money(confirmedPaid)}
                      </strong>

                    </div>

                    <div className="flex justify-between gap-3">

                      <span>
                        Remaining Balance
                      </span>

                      <strong>
                        {money(remaining)}
                      </strong>

                    </div>

                  </div>

                </div>
              )}

              {/* REJECTED BANK SLIP */}

              {rejectedBank && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">

                  <div className="flex items-center gap-2 font-bold text-red-700">

                    <AlertTriangle size={18} />

                    Bank Slip Rejected by Admin

                  </div>

                  <p className="mt-2 text-xs text-red-700">
                    A submitted bank slip has
                    been rejected. The customer
                    can check the payment details
                    and upload corrected proof.
                  </p>

                </div>
              )}

              {/* READ ONLY NOTICE */}

              <div className="mt-4 rounded-lg bg-slate-50 p-3">

                <p className="text-xs font-semibold text-slate-500">
                  Admin Approval Required
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Bank transfer information is
                  read-only for Sales Managers.
                  Payment status updates automatically
                  after Admin approval.
                </p>

              </div>

            </div>
          )}

          {/* ================================== */}
          {/* CHEQUE SUBMISSION */}
          {/* EXISTING FUNCTIONALITY RETAINED */}
          {/* ================================== */}

          {summary &&
            isCheque &&
            remaining > 0 && (

              <div className="mt-5 space-y-3 rounded-lg bg-white p-4">

                <div className="flex items-center gap-2">

                  <FileText
                    size={18}
                    className="text-blue-600"
                  />

                  <h4 className="font-bold">
                    Cheque Collection
                  </h4>

                </div>

                {pendingCheque ? (

                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">

                    A cheque has already been
                    submitted and is awaiting
                    admin review or bank clearance.

                  </p>

                ) : (

                  <>

                    <label className="block text-sm font-semibold">
                      Cheque Amount (LKR)
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      max={remaining}
                      step="0.01"
                      value={amount}
                      disabled={busy}
                      onChange={(event) =>
                        changeAmount(event.target.value)
                      }
                      placeholder="Enter cheque amount"
                      className={inputClass}
                    />

                    <label className="block text-sm font-semibold">
                      Upload Cheque Photo
                    </label>

                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      disabled={busy}
                      onChange={(event) => {
                        if (busy) return;

                        setFile(
                          event.target.files?.[0] ||
                          null
                        );

                        setReceiptKey(
                          crypto.randomUUID()
                        );

                        setError("");
                      }}
                      className={inputClass}
                    />

                    <button
                      type="button"
                      disabled={
                        busy ||
                        !file ||
                        !amountIsValid
                      }
                      onClick={submitCheque}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >

                      <Upload size={18} />

                      {busy
                        ? "Uploading..."
                        : "Submit Cheque for Admin"}

                    </button>

                    <p className="text-xs text-slate-500">
                      Submitting a cheque does not
                      confirm payment. Admin review
                      and bank clearance are required.
                    </p>

                  </>
                )}

              </div>
            )}

          {/* ================================== */}
          {/* PAYMENT HISTORY */}
          {/* ================================== */}

          {summary && (

            <div className="mt-5">

              <h4 className="mb-3 font-bold text-slate-800">
                Payment History
              </h4>

              {receipts.length === 0 ? (

                <p className="text-sm text-slate-500">
                  No payment records yet.
                </p>

              ) : (

                <div className="space-y-3">

                  {receipts.map((receipt) => {

                    const bankReceipt =
                      isBankReceipt(receipt);

                    const receiptId =
                      receipt.id ??
                      receipt.receiptId;

                    const receiptMethod =
                      normalizeMethod(
                        receipt.method
                      ).toLowerCase();

                    const hasProof =
                      receipt.hasProof === true ||
                      receipt.proofAvailable === true;

                    return (

                      <div
                        key={receiptId}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                      >

                        <div className="flex flex-wrap items-start justify-between gap-3">

                          <div>

                            <p className="text-sm font-bold">

                              {labels[receiptMethod] ||
                                receipt.method}

                            </p>

                            <p className="mt-1 text-sm">

                              {money(receipt.amount)}

                            </p>

                            <p className="mt-1 text-xs text-slate-500">

                              Status:{" "}

                              {receipt.status ||
                                "PENDING"}

                            </p>

                            {bankReceipt &&
                              receipt.verifiedAmount != null && (

                                <p className="mt-2 text-sm font-semibold text-emerald-700">

                                  Verified Amount:{" "}

                                  {money(
                                    receipt.verifiedAmount
                                  )}

                                </p>
                              )}

                          </div>

                          {/* ======================== */}
                          {/* CHEQUE / NON-BANK PROOF */}
                          {/* ======================== */}

                          {!bankReceipt &&
                            hasProof &&
                            receiptId && (

                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenProof(
                                    receipt
                                  )
                                }
                                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600"
                              >

                                <Download size={16} />

                                View Proof

                              </button>
                            )}

                          {/* ======================== */}
                          {/* BANK SLIP ACCESS REMOVED */}
                          {/* ======================== */}

                          {bankReceipt && (
                            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">

                              Admin Review Only

                            </span>
                          )}

                        </div>

                        {/* ======================== */}
                        {/* BANK APPROVAL STATUS */}
                        {/* ======================== */}

                        {bankReceipt && (

                          <>

                            <BankPaymentStatus
                              receipt={receipt}
                            />

                            {receipt.verifiedAt && (

                              <p className="mt-2 text-xs text-slate-500">

                                Verified At:{" "}

                                {receipt.verifiedAt}

                              </p>
                            )}

                            {String(
                              receipt.status ?? ""
                            ).toUpperCase() ===
                              "REJECTED" &&
                              receipt.rejectionReason && (

                                <p className="mt-2 text-xs text-red-600">

                                  Reason:{" "}

                                  {receipt.rejectionReason}

                                </p>
                              )}

                          </>
                        )}

                        {/* ======================== */}
                        {/* NO BANK APPROVAL BUTTON */}
                        {/* ======================== */}

                      </div>
                    );
                  })}

                </div>
              )}

            </div>
          )}

          {/* ================================== */}
          {/* FULLY PAID */}
          {/* ================================== */}

          {summary && remaining === 0 && (

            <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">

              <CheckCircle2 size={18} />

              This wholesale order is fully paid.

            </div>
          )}

        </>
      )}

      {/* ================================== */}
      {/* ERROR */}
      {/* ================================== */}

      {error && (

        <div
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >

          {error}

        </div>
      )}

      {/* ================================== */}
      {/* SUCCESS */}
      {/* ================================== */}

      {message && (

        <div
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >

          {message}

        </div>
      )}

    </section>
  );
}
