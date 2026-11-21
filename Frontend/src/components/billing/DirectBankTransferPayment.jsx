
import {
    useCallback,
    useEffect,
    useRef,
    useState,
  } from "react";
  
  import {
    Landmark,
    UploadCloud,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock3,
    Copy,
    ReceiptText,
  } from "lucide-react";
  
  // ==========================================
  // CONFIGURATION
  // ==========================================
  
  const BASE_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];
  
  const inputClass =
    "w-full rounded-xl border border-slate-200 " +
    "bg-white px-4 py-3 text-sm outline-none " +
    "focus:border-[#3654FF] focus:ring-2 " +
    "focus:ring-blue-100";
  
  const buttonClass =
    "inline-flex items-center justify-center gap-2 " +
    "rounded-xl bg-[#3654FF] px-5 py-3 " +
    "font-bold text-white hover:bg-[#2942D2] " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  
  function money(value) {
    return (
      "LKR " +
      Number(value ?? 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  
  // ==========================================
  // AUTHENTICATION
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
  // API HELPER
  // ==========================================
  
  async function apiRequest(path, options = {}) {
    const token = getToken();
  
    if (!token) {
      throw new Error("Please log in again.");
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
  
            Authorization: `Bearer ${token}`,
  
            ...options.headers,
          },
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
      result = text ? JSON.parse(text) : null;
    } catch {
      result = text;
    }
  
    if (!response.ok) {
      throw new Error(
        result?.detail ||
        result?.message ||
        result?.error ||
        `Request failed: ${response.status}`
      );
    }
  
    return result;
  }
  
  // ==========================================
  // PAYMENT STATUS BADGE
  // ==========================================
  
  function PaymentStatus({ status }) {
    const normalized = String(
      status || "NOT_SUBMITTED"
    ).toUpperCase();
  
    const statuses = {
      NOT_SUBMITTED: {
        label: "Awaiting Bank Transfer",
        color: "bg-slate-100 text-slate-700",
      },
  
      PENDING_REVIEW: {
        label: "Awaiting Admin Verification",
        color: "bg-amber-100 text-amber-800",
      },
  
      APPROVED: {
        label: "Awaiting Bank Confirmation",
        color: "bg-blue-100 text-blue-800",
      },
  
      CONFIRMED: {
        label: "Payment Confirmed",
        color: "bg-green-100 text-green-800",
      },
  
      REJECTED: {
        label: "Rejected",
        color: "bg-red-100 text-red-800",
      },
    };
  
    const current =
      statuses[normalized] || {
        label: normalized.replaceAll("_", " "),
        color: "bg-slate-100 text-slate-700",
      };
  
    return (
      <span
        className={
          "rounded-full px-3 py-1 text-xs " +
          "font-bold " +
          current.color
        }
      >
        {current.label}
      </span>
    );
  }
  
  // ==========================================
  // MAIN COMPONENT
  // ==========================================
  
  export default function DirectBankTransferPayment({
    bill,
    onSubmitted,
    onPaymentStatusChanged,
  }) {
    const billId = Number(
      bill?.id ?? bill?.billId
    );
  
    const [bankDetails, setBankDetails] =
      useState(null);
  
    const [paymentInfo, setPaymentInfo] =
      useState(null);
  
    const [loading, setLoading] =
      useState(true);
  
    const [refreshing, setRefreshing] =
      useState(false);
  
    const [submitting, setSubmitting] =
      useState(false);
  
    const [transferReference, setTransferReference] =
      useState("");
  
    const [file, setFile] =
      useState(null);
  
    const [error, setError] =
      useState("");
  
    const [success, setSuccess] =
      useState("");
  
    const receiptKeyRef = useRef(
      crypto.randomUUID()
    );
  
    const fileInputRef = useRef(null);
  
    const requestVersionRef = useRef(0);
  
    const submittingRef = useRef(false);
  
    const fullAmount = Number(
      paymentInfo?.totalAmount ??
      bill?.totalAmount ??
      0
    );
  
    const validAmount =
      Number.isFinite(fullAmount) &&
      fullAmount > 0;
  
    const records = Array.isArray(
      paymentInfo?.payments
    )
      ? paymentInfo.payments
      : [];
  
    const bankRecords = records.filter(
      (payment) =>
        String(
          payment.method ?? ""
        ).toUpperCase() === "BANK_TRANSFER"
    );
  
    const activePayment = bankRecords.find(
      (payment) =>
        [
          "PENDING_REVIEW",
          "APPROVED",
          "CONFIRMED",
        ].includes(
          String(payment.status).toUpperCase()
        )
    );
  
    const latestPayment =
      bankRecords[0] ?? null;
  
    const status = String(
      activePayment?.status ||
      latestPayment?.status ||
      "NOT_SUBMITTED"
    ).toUpperCase();
  
    const confirmedPaid = Number(
      paymentInfo?.confirmedPaid ?? 0
    );
  
    const remainingBalance = Number(
      paymentInfo?.remainingBalance ??
      bill?.remainingBalance ??
      fullAmount
    );
  
    const isPaid =
      !!paymentInfo &&
      validAmount &&
      remainingBalance <= 0;
  
    const canSubmit =
      !loading &&
      !refreshing &&
      !submitting &&
      !!bankDetails &&
      !!paymentInfo &&
      validAmount &&
      confirmedPaid === 0 &&
      !activePayment &&
      !isPaid;
  
    // ========================================
    // LOAD COMPANY DETAILS AND PAYMENT STATUS
    // ========================================
  
    const refreshPayment = useCallback(
      async (showSpinner = true) => {
        if (
          !Number.isSafeInteger(billId) ||
          billId <= 0
        ) {
          setError("Invalid invoice ID.");
          setLoading(false);
          return;
        }
  
        const version =
          ++requestVersionRef.current;
  
        if (showSpinner) {
          setRefreshing(true);
        }
  
        try {
          const [details, summary] =
            await Promise.all([
              apiRequest(
                "/api/sales/bills/company-bank-details"
              ),
  
              apiRequest(
                `/api/sales/bills/${billId}/payments`
              ),
            ]);
  
          if (
            version !==
            requestVersionRef.current
          ) {
            return;
          }
  
          if (
            !details ||
            typeof details !== "object" ||
            !summary ||
            typeof summary !== "object"
          ) {
            throw new Error(
              "Invalid payment information."
            );
          }
  
          setBankDetails(details);
          setPaymentInfo(summary);
          setError("");
        } catch (err) {
          if (
            version ===
            requestVersionRef.current
          ) {
            setError(
              err.message ||
              "Unable to load bank details."
            );
          }
        } finally {
          if (
            version ===
            requestVersionRef.current
          ) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      [billId]
    );
  
    useEffect(() => {
      setLoading(true);
      setBankDetails(null);
      setPaymentInfo(null);
      setError("");
      setSuccess("");
      setFile(null);
      setTransferReference("");
      receiptKeyRef.current =
        crypto.randomUUID();
  
      refreshPayment(false);
  
      return () => {
        requestVersionRef.current += 1;
      };
    }, [refreshPayment]);
  
    // ========================================
    // AUTOMATIC STATUS REFRESH
    // ========================================
  
    useEffect(() => {
      const interval = window.setInterval(
        () => {
          if (
            document.visibilityState === "visible" &&
            !submittingRef.current
          ) {
            refreshPayment(false);
          }
        },
        15000
      );
  
      return () =>
        window.clearInterval(interval);
    }, [refreshPayment]);
  
    // ========================================
    // CHANGE REFERENCE OR FILE
    //
    // A new input represents a new submission
    // intent and receives a new receipt key.
    // ========================================
  
    function updateReference(value) {
      setTransferReference(value);
      receiptKeyRef.current =
        crypto.randomUUID();
      setSuccess("");
    }
  
    function updateFile(value) {
      setFile(value);
      receiptKeyRef.current =
        crypto.randomUUID();
      setSuccess("");
    }
  
    // ========================================
    // COPY BANK ACCOUNT NUMBER
    // ========================================
  
    async function copyAccountNumber() {
      if (!bankDetails?.accountNumber) {
        return;
      }
  
      try {
        await navigator.clipboard.writeText(
          String(bankDetails.accountNumber)
        );
  
        setSuccess(
          "Bank account number copied."
        );
      } catch {
        setError(
          "Unable to copy account number."
        );
      }
    }
  
    // ========================================
    // SUBMIT FULL BANK TRANSFER PROOF
    // ========================================
  
    async function submitBankSlip(event) {
      event.preventDefault();
  
      if (
        submittingRef.current ||
        !canSubmit
      ) {
        return;
      }
  
      if (
        String(
          bill?.paymentMethod ?? ""
        ).toUpperCase() !== "BANK_TRANSFER"
      ) {
        setError(
          "This invoice is not a bank transfer invoice."
        );
        return;
      }
  
      if (!validAmount) {
        setError(
          "Invalid full invoice amount."
        );
        return;
      }
  
      if (!transferReference.trim()) {
        setError(
          "Enter the bank transaction reference."
        );
        return;
      }
  
      if (
        transferReference.trim().length > 150
      ) {
        setError(
          "Transaction reference is too long."
        );
        return;
      }
  
      if (
        !file ||
        file.size === 0 ||
        file.size > MAX_FILE_SIZE
      ) {
        setError(
          "Choose a bank slip under 5 MB."
        );
        return;
      }
  
      if (
        !ALLOWED_TYPES.includes(file.type)
      ) {
        setError(
          "Only JPG, PNG or PDF files are allowed."
        );
        return;
      }
  
      const confirmed = window.confirm(
        `Confirm the shop owner transferred ` +
        `${money(fullAmount)} for invoice ` +
        `INV-${billId} and submit the slip ` +
        `for Admin verification?`
      );
  
      if (!confirmed) {
        return;
      }
  
      // Do not change this key when retrying
      // an uncertain network submission.
      const receiptKey =
        receiptKeyRef.current;
  
      const formData = new FormData();
  
      formData.append(
        "receiptKey",
        receiptKey
      );
  
      formData.append(
        "amount",
        fullAmount.toFixed(2)
      );
  
      formData.append(
        "transferReference",
        transferReference.trim()
      );
  
      formData.append(
        "file",
        file
      );
  
      submittingRef.current = true;
      setSubmitting(true);
      setError("");
      setSuccess("");
  
      try {
        await apiRequest(
          `/api/sales/bills/${billId}/bank-slip`,
          {
            method: "POST",
            body: formData,
          }
        );
  
        setSuccess(
          "Bank transfer slip submitted to Admin. " +
          "The payment is not confirmed until " +
          "Admin verifies the full deposit."
        );
  
        setFile(null);
        setTransferReference("");
  
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
  
        receiptKeyRef.current =
          crypto.randomUUID();
  
        await refreshPayment(false);
  
        if (
          typeof onSubmitted === "function"
        ) {
          try {
            await onSubmitted(bill);
          } catch (callbackError) {
            console.warn(
              "Submission succeeded, but dashboard " +
              "refresh failed:",
              callbackError
            );
          }
        }
  
        if (
          typeof onPaymentStatusChanged ===
          "function"
        ) {
          try {
            await onPaymentStatusChanged(bill);
          } catch (callbackError) {
            console.warn(
              "Payment status refresh failed:",
              callbackError
            );
          }
        }
      } catch (err) {
        setError(
          (err.message ||
            "Unable to submit transfer slip.") +
          " If the request may have succeeded, " +
          "refresh the payment status before retrying."
        );
  
        // Keep receiptKeyRef unchanged on failure.
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  
    // ========================================
    // RENDER
    // ========================================
  
    if (
      !bill ||
      String(
        bill.paymentMethod ?? ""
      ).toUpperCase() !== "BANK_TRANSFER"
    ) {
      return null;
    }
  
    return (
      <section className="mt-6 rounded-2xl border border-[#CBD5FF] bg-[#FFF9F3] p-5 shadow-sm sm:p-6">
  
        {/* HEADER */}
  
        <div className="flex flex-wrap items-start justify-between gap-3">
  
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-[#17265B]">
              <Landmark
                size={23}
                className="text-[#3654FF]"
              />
              Bank Transfer Payment
            </h3>
  
            <p className="mt-2 text-sm text-slate-600">
              Show these verified bank details to
              the shop owner to complete the payment.
            </p>
          </div>
  
          <button
            type="button"
            onClick={() => refreshPayment(true)}
            disabled={
              refreshing ||
              submitting
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#CBD5FF] bg-white px-4 py-2 text-sm font-bold text-[#3654FF] disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {refreshing
              ? "Refreshing..."
              : "Refresh Status"}
          </button>
  
        </div>
  
        {/* ERROR / SUCCESS */}
  
        {loading && (
          <p className="mt-5 text-sm text-slate-600">
            Loading company payment details...
          </p>
        )}
  
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={18}
              className="mb-2"
            />
            {error}
          </div>
        )}
  
        {success && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2
              size={18}
              className="mb-2"
            />
            {success}
          </div>
        )}
  
        {/* COMPANY BANK DETAILS */}
  
        <div className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5">
  
          <h4 className="font-bold text-[#17265B]">
            Company Bank Account
          </h4>
  
          {bankDetails ? (
            <div className="mt-4 space-y-3 text-sm">
  
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-500">
                  Account Name
                </span>
  
                <strong>
                  {bankDetails.accountName}
                </strong>
              </div>
  
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-500">
                  Bank Name
                </span>
  
                <strong>
                  {bankDetails.bankName}
                </strong>
              </div>
  
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-500">
                  Branch
                </span>
  
                <strong>
                  {bankDetails.branch}
                </strong>
              </div>
  
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500">
                  Account Number
                </span>
  
                <div className="flex items-center gap-2">
                  <strong className="break-all">
                    {bankDetails.accountNumber}
                  </strong>
  
                  <button
                    type="button"
                    onClick={copyAccountNumber}
                    title="Copy account number"
                    className="rounded-lg bg-blue-50 p-2 text-[#3654FF]"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
  
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              Bank details are unavailable.
              Do not request payment until the
              company's verified details load.
            </p>
          )}
  
          <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
  
            <div>
              <p className="text-xs text-slate-500">
                Payment Reference
              </p>
  
              <p className="mt-2 font-bold text-[#17265B]">
                INV-{billId}
              </p>
            </div>
  
            <div>
              <p className="text-xs text-slate-500">
                Required Full Transfer
              </p>
  
              <p className="mt-2 text-2xl font-bold text-[#3654FF]">
                {money(fullAmount)}
              </p>
            </div>
  
          </div>
  
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-[#17265B]">
            The shop owner must transfer the
            <strong> entire invoice amount </strong>
            in one payment. Partial bank transfers
            are not accepted.
          </div>
  
        </div>
  
        {/* PAYMENT STATUS */}
  
        {paymentInfo && (
          <div className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5">
  
            <div className="flex flex-wrap items-center justify-between gap-2">
  
              <h4 className="flex items-center gap-2 font-bold text-[#17265B]">
                <ReceiptText size={18} />
                Bank Transfer Status
              </h4>
  
              <PaymentStatus status={status} />
  
            </div>
  
            <div className="mt-4 space-y-3 text-sm">
  
              <div className="flex justify-between gap-3">
                <span>Invoice Total</span>
                <strong>
                  {money(fullAmount)}
                </strong>
              </div>
  
              <div className="flex justify-between gap-3">
                <span>Confirmed Paid</span>
                <strong className="text-green-700">
                  {money(confirmedPaid)}
                </strong>
              </div>
  
              <div className="flex justify-between gap-3 border-t pt-3">
                <span>Remaining Balance</span>
                <strong className="text-rose-600">
                  {money(remainingBalance)}
                </strong>
              </div>
  
            </div>
  
            {status === "REJECTED" &&
              latestPayment?.rejectionReason && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Rejection reason:{" "}
                {latestPayment.rejectionReason}
              </p>
            )}
  
            {status === "PENDING_REVIEW" && (
              <p className="mt-4 flex items-start gap-2 text-sm text-amber-800">
                <Clock3
                  size={18}
                  className="shrink-0"
                />
                The transfer slip was submitted.
                Admin must verify that the full
                payment reached the company account.
              </p>
            )}
  
            {isPaid && (
              <p className="mt-4 flex items-center gap-2 text-sm font-bold text-green-700">
                <CheckCircle2 size={18} />
                Payment has been confirmed in
                the company records.
              </p>
            )}
  
          </div>
        )}
  
        {/* TRANSFER SLIP UPLOAD */}
  
        {canSubmit && (
          <form
            onSubmit={submitBankSlip}
            className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5"
          >
  
            <h4 className="text-lg font-bold text-[#17265B]">
              Upload Bank Transfer Slip
            </h4>
  
            <p className="mt-2 text-sm text-slate-600">
              After the shop owner completes the
              full transfer, upload the receipt
              for Admin verification.
            </p>
  
            <div className="mt-5">
              <label className="block text-sm font-semibold">
                Transfer Amount (LKR)
              </label>
  
              <input
                type="text"
                readOnly
                value={fullAmount.toFixed(2)}
                className={
                  inputClass +
                  " mt-2 cursor-not-allowed bg-slate-100"
                }
              />
  
              <p className="mt-1 text-xs text-slate-500">
                Automatically set to the full invoice amount.
              </p>
            </div>
  
            <div className="mt-4">
              <label
                htmlFor={`transfer-reference-${billId}`}
                className="block text-sm font-semibold"
              >
                Bank Transaction Reference
              </label>
  
              <input
                id={`transfer-reference-${billId}`}
                type="text"
                required
                maxLength={150}
                value={transferReference}
                onChange={(event) =>
                  updateReference(event.target.value)
                }
                placeholder="Reference shown on transfer slip"
                className={inputClass + " mt-2"}
              />
            </div>
  
            <div className="mt-4">
              <label
                htmlFor={`bank-slip-${billId}`}
                className="block text-sm font-semibold"
              >
                Bank Transfer Slip
              </label>
  
              <input
                ref={fileInputRef}
                id={`bank-slip-${billId}`}
                type="file"
                required
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) =>
                  updateFile(
                    event.target.files?.[0] || null
                  )
                }
                className={inputClass + " mt-2"}
              />
  
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG or PDF. Maximum 5 MB.
              </p>
            </div>
  
            <button
              type="submit"
              disabled={
                !file ||
                submitting ||
                !transferReference.trim()
              }
              className={
                buttonClass + " mt-5 w-full"
              }
            >
              <UploadCloud size={18} />
  
              {submitting
                ? "Submitting Slip..."
                : "Submit Bank Slip to Admin"}
            </button>
  
          </form>
        )}
  
        {!loading &&
          paymentInfo &&
          !canSubmit &&
          !activePayment &&
          !isPaid && (
          <p className="mt-4 text-sm text-slate-600">
            A new bank slip cannot be submitted
            until the existing payment information
            is resolved.
          </p>
        )}
  
      </section>
    );
  }
  