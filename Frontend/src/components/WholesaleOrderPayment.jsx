
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Upload,
  RefreshCw,
  X,
} from "lucide-react";

import {
  getMyOrderPayment,
  uploadMyBankSlip,
} from "../services/wholesalePaymentApi";

// =====================================================
// CURRENCY FORMATTING
// =====================================================

function money(value) {
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

  return `LKR ${amount.toLocaleString(
    "en-LK",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

// =====================================================
// NORMALIZE PAYMENT METHOD
// =====================================================

function normalizePaymentMethod(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (
    method === "bank" ||
    method === "bank_transfer" ||
    method === "bank transfer"
  ) {
    return "BANK_TRANSFER";
  }

  if (method === "cash") return "CASH";

  if (method === "credit") return "CREDIT";

  if (method === "cheque") return "CHEQUE";

  return method.toUpperCase();
}

// =====================================================
// NORMALIZE PAYMENT STATUS
// =====================================================

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

// =====================================================
// CHECK BANK TRANSFER RECEIPT
// =====================================================

function isBankReceipt(receipt) {
  return (
    normalizePaymentMethod(
      receipt?.method ??
      receipt?.paymentMethod
    ) === "BANK_TRANSFER"
  );
}

// =====================================================
// BANK PAYMENT APPROVAL STATUS
// =====================================================

function isApprovedBankReceipt(receipt) {
  return [
    "APPROVED",
    "VERIFIED",
    "CONFIRMED",
  ].includes(
    normalizeStatus(receipt?.status)
  );
}

// =====================================================
// BANK PAYMENT STATUS DISPLAY
// =====================================================

function getBankStatusDetails(status) {
  const value = normalizeStatus(status);

  switch (value) {
    case "CONFIRMED":
    case "VERIFIED":
    case "APPROVED":
      return {
        label: "Payment Approved by Admin",

        className:
          "bg-green-100 text-green-700",
      };

    case "PENDING_REVIEW":
    case "PENDING":
      return {
        label: "Awaiting Admin Approval",

        className:
          "bg-amber-100 text-amber-700",
      };

    case "REJECTED":
      return {
        label: "Bank Slip Rejected by Admin",

        className:
          "bg-red-100 text-red-700",
      };

    default:
      return {
        label:
          value.replaceAll("_", " ") ||
          "Payment Not Confirmed",

        className:
          "bg-slate-100 text-slate-600",
      };
  }
}

// =====================================================
// FORMAT APPROVAL DATE
// =====================================================

function formatPaymentDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================================================
// MAIN WHOLESALE ORDER PAYMENT COMPONENT
// =====================================================

export default function WholesaleOrderPayment({
  order,
  onClose,
  onUpdated,
}) {
  const orderId =
    order?.orderId ??
    order?.id;

  // ===================================================
  // PAYMENT STATES
  // ===================================================

  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [file, setFile] =
    useState(null);

  const [amount, setAmount] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ===================================================
  // REQUEST CONTROL
  //
  // Prevent overlapping automatic refreshes
  // and outdated responses from changing
  // the current order.
  // ===================================================

  const mountedRef = useRef(false);

  const generationRef = useRef(0);

  const uploadRef = useRef(false);

  const activeRequestRef = useRef(null);

  const fileInputRef = useRef(null);

  // ===================================================
  // ORDER DELIVERY STATUS
  // ===================================================

  const orderStatus = normalizeStatus(
    order?.deliveryStatus ||
    order?.status
  );

  const delivered =
    orderStatus === "DELIVERED";

  // ===================================================
  // PAYMENT METHOD
  // ===================================================

  const method = normalizePaymentMethod(
    summary?.checkoutMethod ??
    summary?.paymentMethod ??
    order?.paymentMethod
  );

  const bankTransfer =
    method === "BANK_TRANSFER";

  // ===================================================
  // ORDER TOTAL
  // ===================================================

  const total = Number(
    summary?.orderTotal ??
    order?.finalTotal ??
    order?.total ??
    0
  );

  // ===================================================
  // CONFIRMED PAYMENTS
  //
  // Pending bank slips are not counted
  // as confirmed payments.
  // ===================================================

  const paid =
    summary?.confirmedPaid != null
      ? Number(summary.confirmedPaid)
      : summary?.confirmedTotal != null
        ? Number(summary.confirmedTotal)
        : null;

  // ===================================================
  // REMAINING BALANCE
  // ===================================================

  const remaining =
    summary?.remainingBalance != null
      ? Math.max(
          0,
          Number(summary.remainingBalance)
        )
      : summary &&
          paid !== null &&
          Number.isFinite(paid) &&
          Number.isFinite(total)
        ? Math.max(0, total - paid)
        : null;

  // ===================================================
  // PAYMENT RECEIPTS
  // ===================================================

  const receipts = Array.isArray(
    summary?.receipts
  )
    ? summary.receipts
    : [];

  // ===================================================
  // BANK TRANSFER RECEIPTS
  // ===================================================

  const bankReceipts =
    receipts.filter(isBankReceipt);

  // ===================================================
  // PENDING BANK SLIP
  // ===================================================

  const pendingSlip = bankReceipts.some(
    (receipt) =>
      [
        "PENDING_REVIEW",
        "PENDING",
      ].includes(
        normalizeStatus(receipt.status)
      )
  );

  // ===================================================
  // ADMIN APPROVED BANK RECEIPTS
  // ===================================================

  const approvedBankReceipts =
    bankReceipts.filter(
      isApprovedBankReceipt
    );

  const approvedBank =
    approvedBankReceipts.length > 0;

  // ===================================================
  // ADMIN REJECTED BANK RECEIPTS
  // ===================================================

  const rejectedBankReceipts =
    bankReceipts.filter(
      (receipt) =>
        normalizeStatus(receipt.status) ===
        "REJECTED"
    );

  const rejectedBank =
    rejectedBankReceipts.length > 0;

  // ===================================================
  // FULL PAYMENT STATUS
  //
  // Full payment is determined by
  // the backend's confirmed balance.
  // ===================================================

  const fullyPaid =
    summary !== null &&
    total > 0 &&
    remaining !== null &&
    Number.isFinite(remaining) &&
    remaining === 0;

  // ===================================================
  // PARTIAL PAYMENT STATUS
  // ===================================================

  const partiallyPaid =
    summary !== null &&
    paid !== null &&
    Number.isFinite(paid) &&
    paid > 0 &&
    remaining !== null &&
    remaining > 0;

  // ===================================================
  // CAN CUSTOMER UPLOAD BANK SLIP?
  //
  // Allowed only when:
  //
  // 1. Order is delivered.
  // 2. Payment method is bank transfer.
  // 3. No pending bank slip exists.
  // 4. Remaining balance is positive.
  // 5. Latest payment data is available.
  //
  // Rejected slips do not prevent a
  // corrected submission.
  // ===================================================

  const canUpload =
    summary !== null &&
    delivered &&
    bankTransfer &&
    !pendingSlip &&
    !fullyPaid &&
    remaining !== null &&
    Number.isFinite(remaining) &&
    remaining > 0 &&
    !loading &&
    !error;

  // ===================================================
  // LOAD PAYMENT SUMMARY
  //
  // Reads latest payment details from
  // Spring Boot through wholesalePaymentApi.
  // ===================================================

  const loadPayment = useCallback(
    async ({
      background = false,
      force = false,
    } = {}) => {
      if (orderId == null) {
        if (mountedRef.current) {
          setError("Invalid wholesale order ID.");

          setLoading(false);

          setRefreshing(false);
        }

        return false;
      }

      // Automatic refresh must not interrupt uploads.

      if (uploadRef.current && !force) {
        return false;
      }

      const existingRequest =
        activeRequestRef.current;

      if (
        existingRequest &&
        !force
      ) {
        return existingRequest.promise;
      }

      const generation =
        generationRef.current;

      const requestRecord = {
        promise: null,
      };

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const isCurrent = () =>
        mountedRef.current &&
        generationRef.current === generation &&
        activeRequestRef.current === requestRecord;

      requestRecord.promise = Promise.resolve()
        .then(async () => {
          try {
            const data =
              await getMyOrderPayment(orderId);

            if (
              !data ||
              typeof data !== "object" ||
              Array.isArray(data)
            ) {
              throw new Error(
                "Invalid payment summary returned by Spring Boot."
              );
            }

            if (isCurrent()) {
              setSummary(data);

              setError("");
            }

            return true;

          } catch (err) {
            if (isCurrent()) {
              setError(
                err.message ||
                "Unable to load payment details."
              );
            }

            return false;

          } finally {
            if (isCurrent()) {
              activeRequestRef.current = null;

              setLoading(false);

              setRefreshing(false);
            }
          }
        });

      activeRequestRef.current =
        requestRecord;

      return requestRecord.promise;
    },

    [orderId]
  );

  // ===================================================
  // INITIAL PAYMENT SUMMARY
  //
  // Reset the payment form when another
  // wholesale order is opened.
  // ===================================================

  useEffect(() => {
    mountedRef.current = true;

    generationRef.current += 1;

    activeRequestRef.current = null;

    uploadRef.current = false;

    setSummary(null);

    setFile(null);

    setAmount("");

    setError("");

    setSuccess("");

    setUploading(false);

    setRefreshing(false);

    setLoading(true);

    loadPayment();

    return () => {
      mountedRef.current = false;

      generationRef.current += 1;

      activeRequestRef.current = null;
    };

  }, [loadPayment]);

  // ===================================================
  // AUTOMATIC PAYMENT STATUS REFRESH
  //
  // After Admin approves the bank transfer,
  // the customer sees the updated status.
  //
  // Refreshes every 15 seconds.
  // ===================================================

  useEffect(() => {
    if (
      orderId == null ||
      !delivered ||
      !bankTransfer
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        uploadRef.current
      ) {
        return;
      }

      loadPayment({
        background: true,
      });

    }, 15000);

    return () => {
      window.clearInterval(timer);
    };

  }, [
    orderId,
    delivered,
    bankTransfer,
    loadPayment,
  ]);

  // ===================================================
  // REFRESH WHEN BROWSER TAB BECOMES VISIBLE
  // ===================================================

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        !uploadRef.current
      ) {
        loadPayment({
          background: true,
        });
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };

  }, [loadPayment]);

  // ===================================================
  // HANDLE BANK SLIP UPLOAD
  //
  // Only submits a bank slip for Admin review.
  //
  // Does NOT confirm payment.
  // ===================================================

  async function handleUpload(event) {
    event.preventDefault();

    if (
      !canUpload ||
      uploading ||
      uploadRef.current
    ) {
      return;
    }

    if (!file) {
      setError(
        "Please select a bank transfer slip."
      );

      return;
    }

    // =================================================
    // VALIDATE TRANSFERRED AMOUNT
    // =================================================

    const declaredAmount = Number(amount);

    if (
      !Number.isFinite(declaredAmount) ||
      declaredAmount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(amount)
    ) {
      setError(
        "Enter a valid transferred amount."
      );

      return;
    }

    if (
      remaining === null ||
      declaredAmount > remaining + 0.001
    ) {
      setError(
        "The declared transfer cannot exceed " +
        "the remaining balance."
      );

      return;
    }

    // =================================================
    // VALIDATE FILE TYPE
    // =================================================

    const permittedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (
      !permittedTypes.includes(file.type)
    ) {
      setError(
        "Only JPG, PNG or PDF files are supported."
      );

      return;
    }

    // =================================================
    // VALIDATE FILE SIZE
    // =================================================

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Maximum file size is 5 MB."
      );

      return;
    }

    if (file.size === 0) {
      setError(
        "The selected bank slip file is empty."
      );

      return;
    }

    // =================================================
    // SUBMIT BANK SLIP
    // =================================================

    const generation =
      generationRef.current;

    uploadRef.current = true;

    setUploading(true);

    setError("");

    setSuccess("");

    // Ignore any older payment refresh response.

    activeRequestRef.current = null;

    setRefreshing(false);

    const isCurrentOrder = () =>
      mountedRef.current &&
      generationRef.current === generation;

    try {
      // Existing API function retained.

      await uploadMyBankSlip(
        orderId,
        file,
        declaredAmount
      );

      if (!isCurrentOrder()) return;

      // Uploading does not mean approval.

      setSuccess(
        "Bank slip uploaded successfully. " +
        "Your payment is awaiting Admin approval."
      );

      setFile(null);

      setAmount("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Prevent another upload until the
      // latest payment summary is received.

      setSummary(null);

      const refreshed = await loadPayment({
        background: true,
        force: true,
      });

      if (!isCurrentOrder()) return;

      if (!refreshed) {
        setError(
          "Your slip was uploaded successfully, " +
          "but payment status could not be refreshed. " +
          "Please refresh the payment details."
        );
      }

      // Refresh the parent wholesale dashboard.

      if (typeof onUpdated === "function") {
        try {
          await onUpdated();

        } catch {
          if (isCurrentOrder()) {
            setError(
              "Your slip was uploaded successfully, " +
              "but order history could not be refreshed."
            );
          }
        }
      }

    } catch (err) {
      if (isCurrentOrder()) {
        setError(
          err.message ||
          "Unable to upload bank slip."
        );
      }

    } finally {
      if (isCurrentOrder()) {
        uploadRef.current = false;

        setUploading(false);
      }
    }
  }

  // ===================================================
  // CHANGE TRANSFER AMOUNT
  // ===================================================

  function handleAmountChange(event) {
    setAmount(event.target.value);

    setError("");

    setSuccess("");
  }

  // ===================================================
  // CHANGE BANK SLIP FILE
  // ===================================================

  function handleFileChange(event) {
    setFile(
      event.target.files?.[0] ||
      null
    );

    setError("");

    setSuccess("");
  }

  // ===================================================
  // RENDER COMPONENT
  // ===================================================

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7">

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}

      <div className="flex items-start justify-between gap-3">

        <div>

          <h3 className="text-xl font-bold text-[#17265B]">
            Payment Details — Order #{orderId}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            View payments and submit
            bank transfer proof.
          </p>

        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
          aria-label="Close payment details"
        >
          <X size={19} />
        </button>

      </div>

      {/* ============================================ */}
      {/* REFRESH PAYMENT DETAILS */}
      {/* ============================================ */}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

        <button
          type="button"
          disabled={
            loading ||
            refreshing ||
            uploading
          }
          onClick={() =>
            loadPayment({
              background: true,
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-[#3654FF] hover:bg-blue-50 disabled:opacity-50"
        >

          <RefreshCw
            size={15}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh Payment Details

        </button>

        {bankTransfer && delivered && (

          <span className="text-xs text-slate-400">
            Payment status refreshes
            every 15 seconds
          </span>

        )}

      </div>

      {/* ============================================ */}
      {/* LOADING */}
      {/* ============================================ */}

      {loading ? (

        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">

          <Loader2
            size={18}
            className="animate-spin"
          />

          Loading payment details...

        </p>

      ) : (

        <>

          {/* ======================================== */}
          {/* PAYMENT BALANCES */}
          {/* ======================================== */}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">

            {/* ORDER TOTAL */}

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs text-slate-500">
                Order Total
              </p>

              <p className="mt-2 font-bold text-[#17265B]">
                {money(total)}
              </p>

            </div>

            {/* CONFIRMED PAID */}

            <div className="rounded-xl bg-green-50 p-4">

              <p className="text-xs text-green-700">
                Confirmed Paid
              </p>

              <p className="mt-2 font-bold text-green-700">
                {money(paid)}
              </p>

            </div>

            {/* REMAINING BALANCE */}

            <div className="rounded-xl bg-blue-50 p-4">

              <p className="text-xs text-[#3654FF]">
                Remaining Balance
              </p>

              <p className="mt-2 font-bold text-[#3654FF]">
                {money(remaining)}
              </p>

            </div>

          </div>

          {/* ======================================== */}
          {/* PAYMENT METHOD AND DELIVERY STATUS */}
          {/* ======================================== */}

          <div className="mt-5 rounded-xl border border-slate-200 p-4">

            <p className="text-sm">

              <strong>
                Payment method:
              </strong>{" "}

              {method.replace(/_/g, " ") ||
                "Not specified"}

            </p>

            <p className="mt-2 text-sm">

              <strong>
                Delivery:
              </strong>{" "}

              {orderStatus.replace(/_/g, " ")}

            </p>

            <p className="mt-2 text-sm">

              <strong>
                Payment Status:
              </strong>{" "}

              {fullyPaid ? (

                <span className="font-semibold text-green-700">
                  PAID
                </span>

              ) : partiallyPaid ? (

                <span className="font-semibold text-amber-700">
                  PARTIALLY PAID
                </span>

              ) : pendingSlip ? (

                <span className="font-semibold text-amber-700">
                  AWAITING ADMIN APPROVAL
                </span>

              ) : (

                <span className="font-semibold text-slate-600">

                  {String(
                    summary?.paymentStatus ??
                    order?.paymentStatus ??
                    "PENDING"
                  ).replaceAll("_", " ")}

                </span>

              )}

            </p>

          </div>

          {/* ======================================== */}
          {/* BANK TRANSFER BEFORE DELIVERY */}
          {/* ======================================== */}

          {bankTransfer && !delivered && (

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">

              Please make your bank transfer after
              the order has been delivered to
              your shop.

              Slip upload becomes available
              after delivery.

            </div>

          )}

          {/* ======================================== */}
          {/* BANK TRANSFER AFTER DELIVERY */}
          {/* ======================================== */}

          {bankTransfer &&
            delivered &&
            !fullyPaid && (

              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

                <div className="flex items-center gap-2 font-semibold text-[#17265B]">

                  <Landmark size={19} />

                  Bank Transfer

                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">

                  Transfer your confirmed amount
                  using the verified company
                  account details provided
                  at checkout.

                  Upload a clear bank transfer
                  slip below.

                </p>

                <p className="mt-3 text-xs font-semibold text-[#3654FF]">

                  Only the Admin can review and
                  approve your bank transfer payment.

                </p>

              </div>

            )}

          {/* ======================================== */}
          {/* WAITING FOR CUSTOMER BANK SLIP */}
          {/* ======================================== */}

          {summary &&
            bankTransfer &&
            delivered &&
            !fullyPaid &&
            bankReceipts.length === 0 && (

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="flex items-center gap-2 font-semibold text-slate-700">

                  <FileText size={18} />

                  Awaiting Bank Slip Upload

                </p>

                <p className="mt-2 text-sm text-slate-600">

                  Please upload your bank transfer
                  slip after transferring the
                  payment amount.

                </p>

              </div>

            )}

          {/* ======================================== */}
          {/* PENDING ADMIN APPROVAL */}
          {/* ======================================== */}

          {pendingSlip && (

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">

              <p className="flex items-center gap-2 font-semibold text-amber-800">

                <FileText size={18} />

                Awaiting Admin Approval

              </p>

              <p className="mt-2 text-sm text-amber-800">

                Your bank slip has been submitted
                successfully.

                The Admin will verify the amount
                transferred against the company
                bank account before confirming
                your payment.

              </p>

              <p className="mt-3 text-xs font-semibold text-amber-700">

                You cannot submit another bank
                slip while an existing slip
                is awaiting approval.

              </p>

            </div>

          )}

          {/* ======================================== */}
          {/* APPROVED BANK TRANSFER */}
          {/* ======================================== */}

          {bankTransfer &&
            approvedBank && (

              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

                <p className="flex items-center gap-2 font-semibold text-green-800">

                  <CheckCircle2
                    size={20}
                    className="shrink-0"
                  />

                  {fullyPaid
                    ? "Payment Approved by Admin — Fully Paid"
                    : "Bank Transfer Approved by Admin"}

                </p>

                {fullyPaid ? (

                  <p className="mt-2 text-sm text-green-800">

                    Your bank transfer has been
                    verified by our administration
                    team.

                    This wholesale order is fully
                    paid. Thank you for your payment.

                  </p>

                ) : (

                  <p className="mt-2 text-sm text-green-800">

                    At least one of your bank
                    transfer receipts has been
                    approved by the Admin.

                    Please check your remaining
                    balance for any outstanding
                    payment.

                  </p>

                )}

                <div className="mt-4 space-y-3 border-t border-green-200 pt-3 text-sm">

                  <div className="flex justify-between gap-3">

                    <span className="text-green-700">
                      Confirmed Paid
                    </span>

                    <strong className="text-green-800">
                      {money(paid)}
                    </strong>

                  </div>

                  <div className="flex justify-between gap-3">

                    <span className="text-green-700">
                      Remaining Balance
                    </span>

                    <strong className="text-green-800">
                      {money(remaining)}
                    </strong>

                  </div>

                </div>

              </div>

            )}

          {/* ======================================== */}
          {/* PARTIALLY PAID BANK TRANSFER */}
          {/* ======================================== */}

          {bankTransfer &&
            partiallyPaid &&
            !fullyPaid && (

              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

                <p className="font-semibold text-[#17265B]">
                  Partial Payment Confirmed
                </p>

                <p className="mt-2 text-sm text-slate-600">

                  Your confirmed payments cover
                  part of the order total.

                  The remaining amount is{" "}

                  <strong>
                    {money(remaining)}
                  </strong>

                  .

                </p>

                {!pendingSlip && (

                  <p className="mt-2 text-xs text-slate-500">

                    You may submit another bank
                    transfer slip for the
                    outstanding balance.

                  </p>

                )}

              </div>

            )}

          {/* ======================================== */}
          {/* REJECTED BANK SLIP */}
          {/* ======================================== */}

          {bankTransfer &&
            rejectedBank &&
            !fullyPaid && (

              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

                <p className="flex items-center gap-2 font-semibold text-red-800">

                  <AlertCircle
                    size={19}
                    className="shrink-0"
                  />

                  Bank Slip Rejected by Admin

                </p>

                <p className="mt-2 text-sm text-red-700">

                  One or more submitted bank
                  slips could not be accepted
                  by the Admin.

                  Rejected receipts are not
                  counted as confirmed payments.

                </p>

                {rejectedBankReceipts.map(
                  (receipt, index) => (

                    <div
                      key={
                        receipt.id ??
                        receipt.receiptId ??
                        index
                      }
                      className="mt-3 rounded-lg bg-white p-3 text-sm"
                    >

                      <p className="font-semibold text-red-700">

                        Receipt #{receipt.id ??
                          receipt.receiptId ??
                          "—"}

                      </p>

                      <p className="mt-1 text-red-700">

                        Submitted Amount:{" "}

                        {money(receipt.amount)}

                      </p>

                      <p className="mt-2 text-red-700">

                        Reason:{" "}

                        {receipt.rejectionReason ||
                          receipt.rejectReason ||
                          "No rejection reason provided."}

                      </p>

                    </div>

                  )
                )}

                {!pendingSlip && (

                  <p className="mt-3 text-xs font-semibold text-red-700">

                    Please check your bank
                    transaction and upload
                    corrected payment proof below.

                  </p>

                )}

              </div>

            )}

          {/* ======================================== */}
          {/* FULLY PAID NON-BANK ORDERS */}
          {/* ======================================== */}

          {fullyPaid &&
            (!bankTransfer || !approvedBank) && (

              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

                <p className="flex items-center gap-2 font-semibold text-green-800">

                  <CheckCircle2 size={18} />

                  Payment Fully Confirmed

                </p>

              </div>

            )}

          {/* ======================================== */}
          {/* BANK SLIP UPLOAD FORM */}
          {/* ======================================== */}

          {canUpload && (

            <form
              onSubmit={handleUpload}
              className="mt-6 space-y-5 rounded-xl border border-slate-200 p-5"
            >

              <div>

                <h4 className="font-bold text-[#17265B]">

                  {rejectedBank
                    ? "Upload Corrected Bank Transfer Slip"
                    : "Upload Bank Transfer Slip"}

                </h4>

                <p className="mt-2 text-xs text-slate-500">

                  Your bank slip will be sent to
                  the Admin for payment approval.

                </p>

              </div>

              {/* TRANSFERRED AMOUNT */}

              <div>

                <label
                  htmlFor="transferAmount"
                  className="mb-2 block text-sm font-semibold text-[#17265B]"
                >

                  Amount Transferred (LKR)

                </label>

                <input
                  id="transferAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={amount}
                  disabled={uploading}
                  onChange={handleAmountChange}
                  placeholder="Enter actual transferred amount"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-slate-500">

                  Remaining balance:{" "}

                  {money(remaining)}

                </p>

              </div>

              {/* BANK TRANSFER SLIP */}

              <div>

                <label
                  htmlFor="bankSlip"
                  className="mb-2 block text-sm font-semibold text-[#17265B]"
                >

                  Bank Transfer Slip

                </label>

                <input
                  ref={fileInputRef}
                  id="bankSlip"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  disabled={uploading}
                  onChange={handleFileChange}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-slate-500">

                  JPG, PNG or PDF.
                  Maximum 5 MB.

                </p>

                {file && (

                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-[#3654FF]">

                    <FileText
                      size={17}
                      className="shrink-0"
                    />

                    <span className="break-all">
                      {file.name}
                    </span>

                  </div>

                )}

              </div>

              {/* SUBMIT BANK SLIP */}

              <button
                type="submit"
                disabled={
                  uploading ||
                  refreshing ||
                  !file ||
                  !amount
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 font-semibold text-white disabled:opacity-50"
              >

                {uploading ? (

                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                ) : (

                  <Upload size={18} />

                )}

                {uploading
                  ? "Uploading Slip..."
                  : "Submit Bank Slip for Admin Approval"}

              </button>

              <p className="text-center text-xs text-slate-500">

                Uploading a bank slip does not
                automatically confirm your payment.

              </p>

            </form>

          )}

          {/* ======================================== */}
          {/* FULLY PAID NOTICE */}
          {/* ======================================== */}

          {bankTransfer &&
            fullyPaid && (

              <div className="mt-5 rounded-xl border border-green-200 bg-white p-4">

                <p className="flex items-center gap-2 text-sm font-semibold text-green-700">

                  <CheckCircle2 size={18} />

                  No further payment is required.

                </p>

                <p className="mt-2 text-xs text-slate-500">

                  Bank slip uploading has been
                  disabled because your order
                  is fully paid.

                </p>

              </div>

            )}

          {/* ======================================== */}
          {/* PAYMENT HISTORY */}
          {/* ======================================== */}

          {receipts.length > 0 && (

            <div className="mt-6">

              <h4 className="font-bold text-[#17265B]">
                Payment History
              </h4>

              <div className="mt-3 space-y-3">

                {receipts.map((receipt, index) => {

                  const bankReceipt =
                    isBankReceipt(receipt);

                  const approved =
                    bankReceipt &&
                    isApprovedBankReceipt(receipt);

                  const rejected =
                    bankReceipt &&
                    normalizeStatus(receipt.status) ===
                      "REJECTED";

                  const statusDetails =
                    bankReceipt
                      ? getBankStatusDetails(
                          receipt.status
                        )
                      : null;

                  return (

                    <div
                      key={
                        receipt.id ??
                        receipt.receiptId ??
                        index
                      }
                      className="rounded-xl border border-slate-200 p-4"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <p className="text-sm font-semibold text-[#17265B]">

                            {String(
                              receipt.method ||
                              receipt.paymentMethod ||
                              ""
                            ).replace(/_/g, " ")}

                          </p>

                          <p className="mt-1 text-xs text-slate-500">

                            Receipt #{receipt.id ??
                              receipt.receiptId ??
                              "—"}

                          </p>

                          <p className="mt-1 text-xs text-slate-500">

                            Status:{" "}

                            {receipt.status}

                          </p>

                        </div>

                        <div className="text-right">

                          {bankReceipt && (

                            <p className="text-xs text-slate-500">
                              Receipt Amount
                            </p>

                          )}

                          <strong className="text-[#3654FF]">

                            {money(receipt.amount)}

                          </strong>

                        </div>

                      </div>

                      {/* BANK APPROVAL STATUS */}

                      {bankReceipt &&
                        statusDetails && (

                          <span
                            className={
                              "mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold " +
                              statusDetails.className
                            }
                          >

                            {statusDetails.label}

                          </span>

                        )}

                      {/* APPROVED AMOUNT */}

                      {approved &&
                        receipt.verifiedAmount != null && (

                          <div className="mt-3 rounded-lg bg-green-50 p-3">

                            <div className="flex flex-wrap justify-between gap-2 text-sm text-green-700">

                              <span>
                                Verified Amount
                              </span>

                              <strong>

                                {money(
                                  receipt.verifiedAmount
                                )}

                              </strong>

                            </div>

                          </div>

                        )}

                      {/* APPROVAL DATE */}

                      {approved &&
                        (
                          receipt.verifiedAt ||
                          receipt.approvedAt
                        ) && (

                          <p className="mt-3 text-xs text-slate-500">

                            Approved At:{" "}

                            {formatPaymentDate(
                              receipt.verifiedAt ??
                              receipt.approvedAt
                            )}

                          </p>

                        )}

                      {/* REJECTION REASON */}

                      {rejected &&
                        (
                          receipt.rejectionReason ||
                          receipt.rejectReason
                        ) && (

                          <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">

                            <strong>
                              Rejection Reason:
                            </strong>{" "}

                            {receipt.rejectionReason ||
                              receipt.rejectReason}

                          </div>

                        )}

                    </div>

                  );

                })}

              </div>

            </div>

          )}

        </>

      )}

      {/* ============================================ */}
      {/* ERROR MESSAGE */}
      {/* ============================================ */}

      {error && (

        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >

          <AlertCircle
            size={18}
            className="shrink-0"
          />

          {error}

        </p>

      )}

      {/* ============================================ */}
      {/* SUCCESS MESSAGE */}
      {/* ============================================ */}

      {success && (

        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >

          <CheckCircle2
            size={18}
            className="shrink-0"
          />

          {success}

        </p>

      )}

    </div>
  );
}
