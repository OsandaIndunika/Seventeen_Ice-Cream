
import {
    useCallback,
    useEffect,
    useRef,
    useState,
  } from "react";
  
  import {
    FileCheck2,
    UploadCloud,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock3,
    CalendarDays,
    Landmark,
    ReceiptText,
    ShieldCheck,
    CreditCard,
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
  
  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  
  function money(value) {
    return (
      "LKR " +
      Number(value ?? 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  
  function normalizeStatus(status) {
    return String(
      status || "NOT_SUBMITTED"
    )
      .trim()
      .toUpperCase();
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
  // AUTHENTICATED API REQUEST
  //
  // For FormData requests, do NOT manually set
  // Content-Type. The browser automatically adds
  // the multipart boundary.
  // ==========================================
  
  async function apiRequest(path, options = {}) {
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Please log in again."
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
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
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
  // PAYMENT STATUS BADGE
  // ==========================================
  
  function PaymentStatus({ status }) {
    const normalized =
      normalizeStatus(status);
  
    const statuses = {
      NOT_SUBMITTED: {
        label: "Cheque Not Submitted",
        color:
          "bg-slate-100 text-slate-700",
      },
  
      PENDING_REVIEW: {
        label: "Awaiting Admin Approval",
        color:
          "bg-amber-100 text-amber-800",
      },
  
      APPROVED: {
        label: "Awaiting Bank Clearance",
        color:
          "bg-blue-100 text-blue-800",
      },
  
      CONFIRMED: {
        label: "Cheque Cleared",
        color:
          "bg-green-100 text-green-800",
      },
  
      REJECTED: {
        label: "Cheque Rejected",
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
          "rounded-full px-3 py-1 " +
          "text-xs font-bold " +
          current.color
        }
      >
        {current.label}
      </span>
    );
  }
  
  // ==========================================
  // PAYMENT DETAIL ROW
  // ==========================================
  
  function DetailRow({
    label,
    value,
    valueClass = "",
  }) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <span className="text-slate-500">
          {label}
        </span>
  
        <strong
          className={
            "break-words text-right text-slate-800 " +
            valueClass
          }
        >
          {value || "Not available"}
        </strong>
      </div>
    );
  }
  
  // ==========================================
  // MAIN DIRECT CHEQUE PAYMENT COMPONENT
  // ==========================================
  
  export default function DirectChequePayment({
    bill,
    onSubmitted,
    onPaymentStatusChanged,
  }) {
    // ========================================
    // INVOICE INFORMATION
    // ========================================
  
    const billId = Number(
      bill?.id ?? bill?.billId
    );
  
    const paymentMethod = String(
      bill?.paymentMethod ?? ""
    ).toUpperCase();
  
    // ========================================
    // STATE
    // ========================================
  
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
  
    const [chequeNumber, setChequeNumber] =
      useState("");
  
    const [issuingBank, setIssuingBank] =
      useState("");
  
    const [chequeDate, setChequeDate] =
      useState("");
  
    const [file, setFile] =
      useState(null);
  
    const [error, setError] =
      useState("");
  
    const [success, setSuccess] =
      useState("");
  
    // ========================================
    // REFERENCES
    // ========================================
  
    const receiptKeyRef = useRef(
      crypto.randomUUID()
    );
  
    const fileInputRef = useRef(null);
  
    const requestVersionRef = useRef(0);
  
    const submittingRef = useRef(false);
  
    // ========================================
    // AMOUNTS
    //
    // Backend is the authoritative source.
    // ========================================
  
    const fullAmount = Number(
      paymentInfo?.totalAmount ??
      bill?.totalAmount ??
      0
    );
  
    const validAmount =
      Number.isFinite(fullAmount) &&
      fullAmount > 0;
  
    const confirmedPaid = Number(
      paymentInfo?.confirmedPaid ?? 0
    );
  
    const remainingBalance = Number(
      paymentInfo?.remainingBalance ??
      bill?.remainingBalance ??
      fullAmount
    );
  
    // ========================================
    // PAYMENT RECORDS
    // ========================================
  
    const records = Array.isArray(
      paymentInfo?.payments
    )
      ? paymentInfo.payments
      : [];
  
    const chequeRecords = records
      .filter(
        (payment) =>
          String(
            payment.method ??
            payment.paymentMethod ??
            ""
          ).toUpperCase() === "CHEQUE"
      )
      .sort(
        (a, b) =>
          Number(b.id ?? 0) -
          Number(a.id ?? 0)
      );
  
    const activePayment = chequeRecords.find(
      (payment) =>
        [
          "PENDING_REVIEW",
          "APPROVED",
          "CONFIRMED",
        ].includes(
          normalizeStatus(
            payment.status
          )
        )
    );
  
    const latestPayment =
      chequeRecords[0] ?? null;
  
    const status = normalizeStatus(
      activePayment?.status ||
      latestPayment?.status ||
      "NOT_SUBMITTED"
    );
  
    const isPaid =
      !!paymentInfo &&
      validAmount &&
      remainingBalance <= 0;
  
    const isUnderReview =
      status === "PENDING_REVIEW";
  
    const isApproved =
      status === "APPROVED";
  
    const isConfirmed =
      status === "CONFIRMED" ||
      isPaid;
  
    const canSubmit =
      !loading &&
      !refreshing &&
      !submitting &&
      !!bankDetails &&
      !!paymentInfo &&
      validAmount &&
      confirmedPaid === 0 &&
      !activePayment &&
      !isConfirmed;
  
    // ========================================
    // LOAD COMPANY DETAILS + CHEQUE STATUS
    // ========================================
  
    const refreshPayment = useCallback(
      async (showSpinner = true) => {
        if (
          !Number.isSafeInteger(billId) ||
          billId <= 0
        ) {
          setError(
            "Invalid sales invoice ID."
          );
  
          setLoading(false);
          return;
        }
  
        const version =
          ++requestVersionRef.current;
  
        if (showSpinner) {
          setRefreshing(true);
        }
  
        try {
          const [
            details,
            summary,
          ] = await Promise.all([
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
            typeof summary !== "object" ||
            Array.isArray(details) ||
            Array.isArray(summary)
          ) {
            throw new Error(
              "Invalid cheque payment information."
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
              err?.message ||
              "Unable to load cheque information."
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
  
    // ========================================
    // INITIAL LOAD AND RESET FOR NEW INVOICE
    // ========================================
  
    useEffect(() => {
      setLoading(true);
  
      setBankDetails(null);
      setPaymentInfo(null);
  
      setChequeNumber("");
      setIssuingBank("");
      setChequeDate("");
      setFile(null);
  
      setError("");
      setSuccess("");
  
      receiptKeyRef.current =
        crypto.randomUUID();
  
      refreshPayment(false);
  
      return () => {
        requestVersionRef.current += 1;
      };
    }, [refreshPayment]);
  
    // ========================================
    // AUTO REFRESH EVERY 15 SECONDS
    // ========================================
  
    useEffect(() => {
      const interval = window.setInterval(
        () => {
          if (
            document.visibilityState ===
              "visible" &&
            !submittingRef.current
          ) {
            refreshPayment(false);
          }
        },
        15000
      );
  
      return () => {
        window.clearInterval(interval);
      };
    }, [refreshPayment]);
  
    // ========================================
    // FORM FIELD CHANGES
    //
    // New input means a new submission intent.
    // Receipt key changes with edited details.
    // ========================================
  
    function updateChequeNumber(value) {
      setChequeNumber(value);
      receiptKeyRef.current =
        crypto.randomUUID();
      setSuccess("");
    }
  
    function updateIssuingBank(value) {
      setIssuingBank(value);
      receiptKeyRef.current =
        crypto.randomUUID();
      setSuccess("");
    }
  
    function updateChequeDate(value) {
      setChequeDate(value);
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
    // SUBMIT CHEQUE TO ADMIN
    // ========================================
  
    async function submitCheque(event) {
      event.preventDefault();
  
      if (
        submittingRef.current ||
        !canSubmit
      ) {
        return;
      }
  
      setError("");
      setSuccess("");
  
      // --------------------------------------
      // VALIDATE INVOICE
      // --------------------------------------
  
      if (paymentMethod !== "CHEQUE") {
        setError(
          "This is not a cheque payment invoice."
        );
        return;
      }
  
      if (
        !Number.isSafeInteger(billId) ||
        billId <= 0
      ) {
        setError(
          "Invalid invoice ID."
        );
        return;
      }
  
      if (!validAmount) {
        setError(
          "Invalid invoice amount."
        );
        return;
      }
  
      // --------------------------------------
      // VALIDATE CHEQUE NUMBER
      // --------------------------------------
  
      const number =
        chequeNumber.trim();
  
      if (
        !number ||
        number.length > 100
      ) {
        setError(
          "Enter a valid cheque number."
        );
        return;
      }
  
      // --------------------------------------
      // VALIDATE ISSUING BANK
      // --------------------------------------
  
      const bank =
        issuingBank.trim();
  
      if (
        !bank ||
        bank.length > 150
      ) {
        setError(
          "Enter the cheque issuing bank."
        );
        return;
      }
  
      // --------------------------------------
      // VALIDATE CHEQUE DATE
      // --------------------------------------
  
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          chequeDate
        ) ||
        Number.isNaN(
          new Date(
            `${chequeDate}T00:00:00`
          ).getTime()
        )
      ) {
        setError(
          "Select a valid cheque date."
        );
        return;
      }
  
      // --------------------------------------
      // VALIDATE PHOTO / PDF
      // --------------------------------------
  
      if (
        !file ||
        file.size === 0 ||
        file.size > MAX_FILE_SIZE
      ) {
        setError(
          "Choose a cheque photo or PDF under 5 MB."
        );
        return;
      }
  
      if (
        !ALLOWED_TYPES.includes(
          file.type
        )
      ) {
        setError(
          "Only JPG, PNG or PDF files are allowed."
        );
        return;
      }
  
      // --------------------------------------
      // CONFIRM ACTUAL PHYSICAL CHEQUE
      // --------------------------------------
  
      const confirmed = window.confirm(
        `Confirm that you physically received ` +
        `a cheque for ${money(fullAmount)} ` +
        `against invoice INV-${billId} ` +
        `and want to submit its photograph ` +
        `for Admin review?`
      );
  
      if (!confirmed) {
        return;
      }
  
      // --------------------------------------
      // PREPARE MULTIPART FORM
      // --------------------------------------
  
      const receiptKey =
        receiptKeyRef.current;
  
      const formData =
        new FormData();
  
      formData.append(
        "receiptKey",
        receiptKey
      );
  
      // Full invoice amount only.
      // Backend must enforce this independently.
  
      formData.append(
        "amount",
        fullAmount.toFixed(2)
      );
  
      formData.append(
        "chequeNumber",
        number
      );
  
      formData.append(
        "issuingBank",
        bank
      );
  
      formData.append(
        "chequeDate",
        chequeDate
      );
  
      formData.append(
        "file",
        file
      );
  
      // --------------------------------------
      // SUBMIT TO SPRING BOOT
      // --------------------------------------
  
      submittingRef.current = true;
      setSubmitting(true);
  
      try {
        await apiRequest(
          `/api/sales/bills/${billId}/cheque`,
          {
            method: "POST",
            body: formData,
          }
        );
  
        setSuccess(
          "Cheque photograph submitted to Admin. " +
          "The cheque must be approved and cleared " +
          "by the bank before the invoice is paid."
        );
  
        setChequeNumber("");
        setIssuingBank("");
        setChequeDate("");
        setFile(null);
  
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
  
        receiptKeyRef.current =
          crypto.randomUUID();
  
        await refreshPayment(false);
  
        // Notify parent without treating a refresh
        // callback failure as a failed payment upload.
  
        if (
          typeof onSubmitted ===
          "function"
        ) {
          try {
            await onSubmitted(bill);
          } catch (callbackError) {
            console.warn(
              "Cheque submitted, but parent refresh failed:",
              callbackError
            );
          }
        }
  
        if (
          typeof onPaymentStatusChanged ===
          "function"
        ) {
          try {
            await onPaymentStatusChanged(
              bill
            );
          } catch (callbackError) {
            console.warn(
              "Payment status callback failed:",
              callbackError
            );
          }
        }
  
      } catch (err) {
        setError(
          (
            err?.message ||
            "Unable to submit cheque."
          ) +
          " If the request may have succeeded, " +
          "refresh the payment status before retrying."
        );
  
        // Keep receiptKeyRef unchanged on an
        // uncertain submission outcome.
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  
    // ========================================
    // RENDER GUARD
    // ========================================
  
    if (
      !bill ||
      paymentMethod !== "CHEQUE"
    ) {
      return null;
    }
  
    return (
      <section className="mt-6 rounded-2xl border border-[#CBD5FF] bg-[#FFF9F3] p-5 shadow-sm sm:p-6">
  
        {/* ================================== */}
        {/* HEADER */}
        {/* ================================== */}
  
        <div className="flex flex-wrap items-start justify-between gap-3">
  
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-[#17265B]">
              <FileCheck2
                size={23}
                className="text-[#3654FF]"
              />
  
              Cheque Payment
            </h3>
  
            <p className="mt-2 text-sm text-slate-600">
              Collect the physical cheque from
              the shop owner and submit its
              photograph for Admin verification.
            </p>
          </div>
  
          <button
            type="button"
            onClick={() =>
              refreshPayment(true)
            }
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
  
        {/* ================================== */}
        {/* ERROR AND SUCCESS */}
        {/* ================================== */}
  
        {loading && (
          <p className="mt-5 text-sm text-slate-600">
            Loading cheque payment details...
          </p>
        )}
  
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />
              <p>{error}</p>
            </div>
          </div>
        )}
  
        {success && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
              />
              <p>{success}</p>
            </div>
          </div>
        )}
  
        {/* ================================== */}
        {/* COMPANY CHEQUE DETAILS */}
        {/* ================================== */}
  
        <div className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5">
  
          <h4 className="flex items-center gap-2 font-bold text-[#17265B]">
            <Landmark
              size={18}
              className="text-[#3654FF]"
            />
            Cheque Payment Instructions
          </h4>
  
          {bankDetails ? (
            <div className="mt-4 space-y-3">
  
              <div className="rounded-xl bg-[#EEF1FF] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3654FF]">
                  Make Cheque Payable To
                </p>
  
                <p className="mt-2 text-xl font-bold text-[#17265B]">
                  {bankDetails.chequePayeeName ||
                    bankDetails.accountName ||
                    "Company payee name unavailable"}
                </p>
              </div>
  
              <DetailRow
                label="Company Account Name"
                value={
                  bankDetails.accountName
                }
              />
  
              <DetailRow
                label="Bank Name"
                value={
                  bankDetails.bankName
                }
              />
  
              <DetailRow
                label="Bank Branch"
                value={
                  bankDetails.branch
                }
              />
  
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              Company cheque details are unavailable.
              Please refresh before accepting
              a cheque from the shop owner.
            </p>
          )}
  
          <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
  
            <div>
              <p className="text-xs text-slate-500">
                Invoice Reference
              </p>
  
              <p className="mt-2 font-bold text-[#17265B]">
                INV-{billId}
              </p>
            </div>
  
            <div>
              <p className="text-xs text-slate-500">
                Required Cheque Amount
              </p>
  
              <p className="mt-2 text-2xl font-bold text-[#3654FF]">
                {money(fullAmount)}
              </p>
            </div>
  
          </div>
  
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-[#17265B]">
            The shop owner must provide
            <strong> one cheque for the entire invoice amount.</strong>
            {" "}
            Partial cheque payments are not accepted.
          </div>
  
        </div>
  
        {/* ================================== */}
        {/* CURRENT CHEQUE PAYMENT STATUS */}
        {/* ================================== */}
  
        {paymentInfo && (
          <div className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5">
  
            <div className="flex flex-wrap items-center justify-between gap-3">
  
              <h4 className="flex items-center gap-2 font-bold text-[#17265B]">
                <ReceiptText size={18} />
                Cheque Verification Status
              </h4>
  
              <PaymentStatus
                status={status}
              />
  
            </div>
  
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
  
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Invoice Total
                </p>
  
                <p className="mt-2 font-bold">
                  {money(fullAmount)}
                </p>
              </div>
  
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-xs text-green-700">
                  Confirmed Paid
                </p>
  
                <p className="mt-2 font-bold text-green-700">
                  {money(confirmedPaid)}
                </p>
              </div>
  
              <div className="rounded-xl bg-rose-50 p-4">
                <p className="text-xs text-rose-700">
                  Remaining Balance
                </p>
  
                <p className="mt-2 font-bold text-rose-700">
                  {money(remainingBalance)}
                </p>
              </div>
  
            </div>
  
            {latestPayment && (
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
  
                <p className="mb-3 text-sm font-bold text-[#17265B]">
                  Submitted Cheque Details
                </p>
  
                <div className="space-y-3">
  
                  <DetailRow
                    label="Cheque Number"
                    value={
                      latestPayment.chequeNumber
                    }
                  />
  
                  <DetailRow
                    label="Issuing Bank"
                    value={
                      latestPayment.issuingBank
                    }
                  />
  
                  <DetailRow
                    label="Cheque Date"
                    value={
                      latestPayment.chequeDate
                    }
                  />
  
                  <DetailRow
                    label="Cheque Amount"
                    value={
                      money(
                        latestPayment.amount ??
                        fullAmount
                      )
                    }
                  />
  
                </div>
  
              </div>
            )}
  
            {/* PENDING ADMIN APPROVAL */}
  
            {isUnderReview && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                <Clock3
                  size={20}
                  className="shrink-0"
                />
  
                <p>
                  The cheque photograph has been
                  submitted successfully.
                  Admin must review the cheque
                  details before it can proceed
                  to bank clearance.
                </p>
              </div>
            )}
  
            {/* ADMIN APPROVED */}
  
            {isApproved && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                <ShieldCheck
                  size={20}
                  className="shrink-0"
                />
  
                <p>
                  Admin has approved the cheque.
                  However, the payment is
                  <strong> not yet confirmed.</strong>
                  {" "}
                  It will only be counted as paid
                  after the bank clears the cheque.
                </p>
              </div>
            )}
  
            {/* BANK CLEARED */}
  
            {isConfirmed && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800">
                <CheckCircle2
                  size={20}
                  className="shrink-0"
                />
  
                <p>
                  The cheque has cleared successfully.
                  The confirmed payment is now
                  recorded against this invoice.
                </p>
              </div>
            )}
  
            {/* REJECTED */}
  
            {status === "REJECTED" && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle
                  size={20}
                  className="shrink-0"
                />
  
                <div>
                  <p className="font-bold">
                    Cheque Rejected
                  </p>
  
                  <p className="mt-2">
                    {latestPayment?.rejectionReason ||
                      "Admin rejected the cheque. " +
                      "Please contact Admin and submit " +
                      "corrected details if required."}
                  </p>
                </div>
              </div>
            )}
  
          </div>
        )}
  
        {/* ================================== */}
        {/* CHEQUE SUBMISSION FORM */}
        {/* ================================== */}
  
        {canSubmit && (
          <form
            onSubmit={submitCheque}
            className="mt-5 rounded-xl border border-[#DDE3FF] bg-white p-5"
          >
  
            <h4 className="flex items-center gap-2 text-lg font-bold text-[#17265B]">
              <FileCheck2 size={19} />
              Submit Cheque to Admin
            </h4>
  
            <p className="mt-2 text-sm text-slate-600">
              Enter the details exactly as shown
              on the physical cheque and upload
              a clear photograph.
            </p>
  
            {/* FULL AMOUNT */}
  
            <div className="mt-5">
              <label className="block text-sm font-semibold">
                Cheque Amount (LKR)
              </label>
  
              <div className="relative mt-2">
                <CreditCard
                  size={18}
                  className="absolute left-4 top-3.5 text-slate-400"
                />
  
                <input
                  type="text"
                  readOnly
                  value={
                    validAmount
                      ? fullAmount.toFixed(2)
                      : ""
                  }
                  className={
                    inputClass +
                    " cursor-not-allowed bg-slate-100 pl-11"
                  }
                />
              </div>
  
              <p className="mt-2 text-xs text-slate-500">
                Automatically set to the full
                invoice amount. Cannot be edited.
              </p>
            </div>
  
            {/* CHEQUE NUMBER */}
  
            <div className="mt-4">
              <label
                htmlFor={`cheque-number-${billId}`}
                className="block text-sm font-semibold"
              >
                Cheque Number
              </label>
  
              <input
                id={`cheque-number-${billId}`}
                type="text"
                required
                maxLength={100}
                value={chequeNumber}
                onChange={(event) =>
                  updateChequeNumber(
                    event.target.value
                  )
                }
                placeholder="Enter cheque number"
                className={inputClass + " mt-2"}
              />
            </div>
  
            {/* ISSUING BANK */}
  
            <div className="mt-4">
              <label
                htmlFor={`issuing-bank-${billId}`}
                className="block text-sm font-semibold"
              >
                Cheque Issuing Bank
              </label>
  
              <div className="relative mt-2">
                <Landmark
                  size={18}
                  className="absolute left-4 top-3.5 text-slate-400"
                />
  
                <input
                  id={`issuing-bank-${billId}`}
                  type="text"
                  required
                  maxLength={150}
                  value={issuingBank}
                  onChange={(event) =>
                    updateIssuingBank(
                      event.target.value
                    )
                  }
                  placeholder="Enter issuing bank"
                  className={inputClass + " pl-11"}
                />
              </div>
            </div>
  
            {/* CHEQUE DATE */}
  
            <div className="mt-4">
              <label
                htmlFor={`cheque-date-${billId}`}
                className="block text-sm font-semibold"
              >
                Cheque Date
              </label>
  
              <div className="relative mt-2">
                <CalendarDays
                  size={18}
                  className="absolute left-4 top-3.5 text-slate-400"
                />
  
                <input
                  id={`cheque-date-${billId}`}
                  type="date"
                  required
                  value={chequeDate}
                  onChange={(event) =>
                    updateChequeDate(
                      event.target.value
                    )
                  }
                  className={inputClass + " pl-11"}
                />
              </div>
            </div>
  
            {/* CHEQUE PHOTO */}
  
            <div className="mt-5">
              <label
                htmlFor={`cheque-file-${billId}`}
                className="block text-sm font-semibold"
              >
                Cheque Photograph or PDF
              </label>
  
              <input
                ref={fileInputRef}
                id={`cheque-file-${billId}`}
                type="file"
                required
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) =>
                  updateFile(
                    event.target.files?.[0] ||
                    null
                  )
                }
                className={inputClass + " mt-2"}
              />
  
              <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                <UploadCloud
                  size={16}
                  className="shrink-0"
                />
  
                <p>
                  JPG, PNG or PDF format.
                  Maximum file size: 5 MB.
                  Upload a clear image of the
                  cheque front.
                </p>
              </div>
            </div>
  
            {/* SUBMIT */}
  
            <button
              type="submit"
              disabled={
                submitting ||
                !file ||
                !chequeNumber.trim() ||
                !issuingBank.trim() ||
                !chequeDate
              }
              className={
                buttonClass +
                " mt-6 w-full"
              }
            >
              <UploadCloud size={18} />
  
              {submitting
                ? "Submitting Cheque..."
                : "Submit Cheque for Admin Approval"}
            </button>
  
            <p className="mt-3 text-xs text-slate-500">
              Submitting the cheque does not
              mark this invoice as paid.
              Payment is confirmed only after
              successful bank clearance.
            </p>
  
          </form>
        )}
  
        {/* ================================== */}
        {/* INFORMATION WHEN SUBMISSION BLOCKED */}
        {/* ================================== */}
  
        {!loading &&
          paymentInfo &&
          !canSubmit &&
          !activePayment &&
          !isConfirmed && (
            <p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
              A new cheque cannot be submitted
              until the current payment
              information is resolved.
            </p>
          )}
  
      </section>
    );
  }
  