
import {
    useCallback,
    useEffect,
    useRef,
    useState,
  } from "react";
  
  import {
    RefreshCw,
    FileText,
    CheckCircle2,
    AlertCircle,
    X,
    Search,
  } from "lucide-react";
  
  import {
    adminPaymentApi,
  } from "../services/adminPaymentApi";
  
  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  
  const money = (value) =>
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
      ? "Not available"
      : new Intl.NumberFormat("en-LK", {
          style: "currency",
          currency: "LKR",
        }).format(Number(value));
  
  const statusOf = (receipt) =>
    String(receipt?.status ?? "")
      .trim()
      .toUpperCase();
  
  const idOf = (receipt) =>
    receipt?.id ?? receipt?.receiptId;
  
  const dateText = (value) => {
    if (!value) return "—";
  
    const date = new Date(value);
  
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString("en-LK");
  };
  
  const field =
    "w-full rounded-xl border border-slate-200 " +
    "bg-white px-3 py-2.5 text-sm";
  
  // ==========================================
  // PAYMENT STATUS
  // ==========================================
  
  function Status({ receipt }) {
    const status = statusOf(receipt);
  
    const [label, color] =
      status === "CONFIRMED"
        ? [
            "Approved",
            "bg-green-100 text-green-700",
          ]
        : status === "PENDING_REVIEW"
          ? [
              "Pending Review",
              "bg-amber-100 text-amber-800",
            ]
          : status === "REJECTED"
            ? [
                "Rejected",
                "bg-red-100 text-red-700",
              ]
            : [
                status || "Unknown",
                "bg-slate-100 text-slate-600",
              ];
  
    return (
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${color}`}
      >
        {label}
      </span>
    );
  }
  
  // ==========================================
  // MAIN BANK TRANSFER PAYMENTS COMPONENT
  // ==========================================
  
  export default function BankTransferPayments() {
    const [receipts, setReceipts] =
      useState([]);
  
    const [loading, setLoading] =
      useState(true);
  
    const [error, setError] =
      useState("");
  
    const [message, setMessage] =
      useState("");
  
    const [filter, setFilter] =
      useState("ALL");
  
    const [search, setSearch] =
      useState("");
  
    const [selectedId, setSelectedId] =
      useState(null);
  
    const [amount, setAmount] =
      useState("");
  
    const [reason, setReason] =
      useState("");
  
    const [checked, setChecked] =
      useState(false);
  
    const [proof, setProof] =
      useState(null);
  
    const [proofLoading, setProofLoading] =
      useState(false);
  
    const [proofError, setProofError] =
      useState("");
  
    const [busy, setBusy] =
      useState(false);
  
    // Prevent overlapping requests.
  
    const listRequest = useRef(null);
  
    const actionLock = useRef(false);
  
    const mounted = useRef(false);
  
    const selected = receipts.find(
      (receipt) =>
        String(idOf(receipt)) ===
        String(selectedId)
    );
  
    const pending =
      statusOf(selected) === "PENDING_REVIEW";
  
    // ========================================
    // LOAD BANK TRANSFER RECEIPTS
    // ========================================
  
    const load = useCallback(async () => {
      if (listRequest.current) return;
  
      const controller =
        new AbortController();
  
      listRequest.current = controller;
  
      setLoading(true);
  
      try {
        const data =
          await adminPaymentApi.getBankTransfers(
            controller.signal
          );
  
        if (!controller.signal.aborted) {
          setReceipts(data);
  
          setError("");
        }
  
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message ||
            "Unable to load bank transfers."
          );
        }
  
      } finally {
        if (
          listRequest.current === controller
        ) {
          listRequest.current = null;
  
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }
    }, []);
  
    // ========================================
    // INITIAL LOAD AND AUTO REFRESH
    // ========================================
  
    useEffect(() => {
      mounted.current = true;
  
      load();
  
      const timer = window.setInterval(() => {
        if (
          !actionLock.current &&
          document.visibilityState === "visible"
        ) {
          load();
        }
      }, 15000);
  
      return () => {
        mounted.current = false;
  
        window.clearInterval(timer);
  
        listRequest.current?.abort();
  
        listRequest.current = null;
      };
    }, [load]);
  
    // ========================================
    // LOAD PRIVATE BANK SLIP
    // ========================================
  
    const hasProof =
      selected?.hasProof === true;
  
    useEffect(() => {
      setProof(null);
      setProofError("");
      setProofLoading(false);
  
      if (
        selectedId == null ||
        !hasProof
      ) {
        return;
      }
  
      const controller =
        new AbortController();
  
      let url;
  
      setProofLoading(true);
  
      adminPaymentApi
        .getBankSlip(
          selectedId,
          controller.signal
        )
  
        .then((blob) => {
          if (controller.signal.aborted) {
            return;
          }
  
          const type = blob.type
            .split(";")[0]
            .toLowerCase();
  
          if (
            ![
              "image/jpeg",
              "image/png",
              "application/pdf",
            ].includes(type)
          ) {
            throw new Error(
              "Unexpected bank slip file type."
            );
          }
  
          url = URL.createObjectURL(blob);
  
          setProof({
            url,
            type,
          });
        })
  
        .catch((err) => {
          if (!controller.signal.aborted) {
            setProofError(
              err.message ||
              "Unable to load bank slip."
            );
          }
        })
  
        .finally(() => {
          if (!controller.signal.aborted) {
            setProofLoading(false);
          }
        });
  
      return () => {
        controller.abort();
  
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
  
    }, [
      selectedId,
      hasProof,
    ]);
  
    // ========================================
    // OPEN RECEIPT REVIEW
    // ========================================
  
    function openReceipt(receipt) {
      if (actionLock.current) return;
  
      setSelectedId(
        idOf(receipt)
      );
  
      setAmount(
        String(
          receipt.declaredAmount ??
          receipt.amount ??
          ""
        )
      );
  
      setReason("");
  
      setChecked(false);
  
      setMessage("");
    }
  
    // ========================================
    // APPROVE OR REJECT PAYMENT
    // ========================================
  
    async function submit(action) {
      if (
        !selected ||
        !pending ||
        actionLock.current ||
        loading ||
        error
      ) {
        return;
      }
  
      if (
        action === "approve" &&
        (!checked || !proof)
      ) {
        return;
      }
  
      if (
        action === "reject" &&
        !reason.trim()
      ) {
        return;
      }
  
      const prompt =
        action === "approve"
          ? `Confirm that ${money(amount)} was ` +
            `actually credited to the company ` +
            `bank account for order ` +
            `#${selected.orderId}, and that ` +
            `this deposit has not been used ` +
            `for another receipt?`
          : `Reject bank slip #${selectedId}?`;
  
      if (!window.confirm(prompt)) {
        return;
      }
  
      actionLock.current = true;
  
      setBusy(true);
      setError("");
      setMessage("");
  
      try {
        if (action === "approve") {
          await adminPaymentApi.approveBankTransfer(
            selectedId,
            amount
          );
  
        } else {
          await adminPaymentApi.rejectBankTransfer(
            selectedId,
            reason
          );
        }
  
        if (!mounted.current) return;
  
        // Immediately hide approval actions
        // after successful backend response.
  
        setReceipts((previous) =>
          previous.map((receipt) =>
            String(idOf(receipt)) ===
            String(selectedId)
              ? {
                  ...receipt,
  
                  status:
                    action === "approve"
                      ? "CONFIRMED"
                      : "REJECTED",
  
                  verifiedAmount:
                    action === "approve"
                      ? amount
                      : null,
  
                  ...(action === "reject"
                    ? {
                        rejectionReason:
                          reason.trim(),
                      }
                    : {}),
                }
              : receipt
          )
        );
  
        setMessage(
          action === "approve"
            ? "Bank transfer approved successfully."
            : "Bank slip rejected successfully."
        );
  
        setChecked(false);
  
        await load();
  
      } catch (err) {
        if (mounted.current) {
          setError(
            err.message ||
            "Payment update failed. Refresh before retrying."
          );
        }
  
      } finally {
        actionLock.current = false;
  
        if (mounted.current) {
          setBusy(false);
        }
      }
    }
  
    // ========================================
    // FILTER AND SEARCH RECEIPTS
    // ========================================
  
    const visible = receipts.filter(
      (receipt) =>
        (
          filter === "ALL" ||
          statusOf(receipt) === filter
        ) &&
        `${idOf(receipt)} ${receipt.orderId} ${
          receipt.proofOriginalName ?? ""
        }`
          .toLowerCase()
          .includes(
            search.trim().toLowerCase()
          )
    );
  
    // ========================================
    // RENDER BANK TRANSFER MANAGEMENT
    // ========================================
  
    return (
      <section className="space-y-5">
  
        {/* HEADER */}
  
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
  
          <div>
            <h3 className="text-xl font-bold text-[#263047]">
              Wholesale Bank Transfer Payments
            </h3>
  
            <p className="mt-1 text-sm text-slate-500">
              Verify actual bank deposits
              before confirming payments.
            </p>
          </div>
  
          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="flex items-center gap-2 rounded-xl bg-[#5CDBDF] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
  
            Refresh
  
          </button>
  
        </div>
  
        {/* STATUS OVERVIEW */}
  
        <div className="grid gap-3 sm:grid-cols-3">
  
          {[
            [
              "PENDING_REVIEW",
              "Pending Review",
              "text-amber-700",
            ],
            [
              "CONFIRMED",
              "Approved",
              "text-green-700",
            ],
            [
              "REJECTED",
              "Rejected",
              "text-red-700",
            ],
          ].map(([value, label, color]) => (
  
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left"
            >
  
              <p className="text-sm text-slate-500">
                {label}
              </p>
  
              <p className={`mt-2 text-3xl font-bold ${color}`}>
                {
                  receipts.filter(
                    (receipt) =>
                      statusOf(receipt) === value
                  ).length
                }
              </p>
  
            </button>
  
          ))}
  
        </div>
  
        {/* ERROR MESSAGE */}
  
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
  
        {/* SUCCESS MESSAGE */}
  
        {message && (
          <p
            role="status"
            className="rounded-xl bg-green-50 p-4 text-sm text-green-700"
          >
            {message}
          </p>
        )}
  
        {/* BANK TRANSFER TABLE */}
  
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
  
          {/* SEARCH AND FILTER */}
  
          <div className="mb-4 flex flex-wrap gap-3">
  
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
  
              <Search size={18} />
  
              <input
                className={field}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search receipt or order ID"
                aria-label="Search receipts"
              />
  
            </div>
  
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              aria-label="Filter payment status"
            >
  
              <option value="ALL">
                All statuses
              </option>
  
              <option value="PENDING_REVIEW">
                Pending Review
              </option>
  
              <option value="CONFIRMED">
                Approved
              </option>
  
              <option value="REJECTED">
                Rejected
              </option>
  
            </select>
  
          </div>
  
          {/* TABLE */}
  
          <div className="overflow-x-auto">
  
            <table className="w-full min-w-[720px] text-left text-sm">
  
              <thead className="border-b text-slate-500">
  
                <tr>
  
                  {[
                    "Receipt",
                    "Order",
                    "Declared amount",
                    "Verified amount",
                    "Submitted",
                    "Status",
                    "Action",
                  ].map((heading) => (
  
                    <th
                      className="px-2 py-3"
                      key={heading}
                    >
                      {heading}
                    </th>
  
                  ))}
  
                </tr>
  
              </thead>
  
              <tbody>
  
                {visible.map((receipt) => (
  
                  <tr
                    key={idOf(receipt)}
                    className="border-b last:border-0"
                  >
  
                    <td className="p-2 font-semibold">
                      #{idOf(receipt)}
                    </td>
  
                    <td className="p-2">
                      #{receipt.orderId}
                    </td>
  
                    <td className="p-2">
  
                      {money(
                        receipt.declaredAmount ??
                        (
                          statusOf(receipt) !==
                          "CONFIRMED"
                            ? receipt.amount
                            : null
                        )
                      )}
  
                    </td>
  
                    <td className="p-2">
  
                      {statusOf(receipt) ===
                      "CONFIRMED"
                        ? money(
                            receipt.verifiedAmount ??
                            receipt.amount
                          )
                        : "—"}
  
                    </td>
  
                    <td className="p-2">
                      {dateText(receipt.createdAt)}
                    </td>
  
                    <td className="p-2">
                      <Status receipt={receipt} />
                    </td>
  
                    <td className="p-2">
  
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          openReceipt(receipt)
                        }
                        className="rounded-lg border border-cyan-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-50"
                      >
  
                        {statusOf(receipt) ===
                        "PENDING_REVIEW"
                          ? "Review"
                          : "View"}
  
                      </button>
  
                    </td>
  
                  </tr>
  
                ))}
  
              </tbody>
  
            </table>
  
          </div>
  
          {!visible.length && (
  
            <p className="py-8 text-center text-sm text-slate-500">
  
              {loading
                ? "Loading bank transfers..."
                : error
                  ? "Unable to load receipts."
                  : "No matching bank transfer receipts."}
  
            </p>
  
          )}
  
        </div>
  
        {/* ================================== */}
        {/* SELECTED RECEIPT DETAILS */}
        {/* ================================== */}
  
        {selected && (
  
          <div className="rounded-2xl border border-[#9BAED1] bg-white p-5 sm:p-6">
  
            {/* RECEIPT HEADER */}
  
            <div className="flex items-start justify-between gap-3">
  
              <div>
  
                <h3 className="text-lg font-bold">
                  Review Receipt #{selectedId}
                </h3>
  
                <p className="mt-1 text-sm text-slate-500">
  
                  Wholesale Order #{selected.orderId}
  
                  {" · "}
  
                  Vehicle #{selected.vehicleId ?? "—"}
  
                </p>
  
              </div>
  
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setSelectedId(null)
                }
                aria-label="Close receipt"
                className="rounded-lg border p-2"
              >
                <X size={18} />
              </button>
  
            </div>
  
            <div className="mt-4 flex flex-wrap items-center gap-4">
  
              <Status receipt={selected} />
  
              <p className="text-sm">
  
                Declared amount:{" "}
  
                <strong>
  
                  {money(
                    selected.declaredAmount ??
                    (
                      pending ||
                      statusOf(selected) === "REJECTED"
                        ? selected.amount
                        : null
                    )
                  )}
  
                </strong>
  
              </p>
  
            </div>
  
            {/* ================================== */}
            {/* BANK SLIP PREVIEW */}
            {/* ================================== */}
  
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
  
              <p className="flex items-center gap-2 font-semibold">
  
                <FileText size={18} />
  
                {selected.proofOriginalName ||
                  "Uploaded bank slip"}
  
              </p>
  
              {proofLoading && (
  
                <p className="mt-3 text-sm">
                  Loading private bank slip...
                </p>
  
              )}
  
              {proofError && (
  
                <p
                  role="alert"
                  className="mt-3 text-sm text-red-700"
                >
                  {proofError}
                </p>
  
              )}
  
              {!hasProof && (
  
                <p className="mt-3 text-sm text-slate-500">
                  No proof available.
                </p>
  
              )}
  
              {proof && (
  
                <div className="mt-4 space-y-3">
  
                  {/* IMAGE PREVIEW */}
  
                  {proof.type.startsWith("image/") ? (
  
                    <img
                      src={proof.url}
                      alt="Uploaded bank transfer slip"
                      className="mx-auto max-h-[600px] max-w-full rounded-lg object-contain"
                    />
  
                  ) : (
  
                    /* PDF PREVIEW */
  
                    <iframe
                      src={proof.url}
                      title="Uploaded bank transfer PDF"
                      className="h-[500px] w-full rounded-lg border"
                    />
  
                  )}
  
                  <a
                    href={proof.url}
                    download={`bank-slip-${selectedId}.${
                      proof.type === "application/pdf"
                        ? "pdf"
                        : proof.type === "image/png"
                          ? "png"
                          : "jpg"
                    }`}
                    className="inline-block text-sm font-bold text-blue-700 underline"
                  >
                    Download bank slip
                  </a>
  
                </div>
  
              )}
  
            </div>
  
            {/* ================================== */}
            {/* REVIEW ACTIONS */}
            {/* ================================== */}
  
            {pending ? (
  
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
  
                {/* APPROVE PAYMENT FORM */}
  
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
  
                    submit("approve");
                  }}
                  className="space-y-3 rounded-xl border border-green-200 p-4"
                >
  
                  <h4 className="flex items-center gap-2 font-bold text-green-800">
  
                    <CheckCircle2 size={18} />
  
                    Approve Payment
  
                  </h4>
  
                  <label
                    htmlFor="verifiedAmount"
                    className="block text-sm font-semibold"
                  >
                    Actual verified amount (LKR)
                  </label>
  
                  <input
                    id="verifiedAmount"
                    className={field}
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="9999999999.99"
                    required
                    value={amount}
                    disabled={busy}
                    onChange={(event) => {
                      setAmount(event.target.value);
  
                      setChecked(false);
                    }}
                  />
  
                  <label className="flex items-start gap-2 text-sm">
  
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || !proof}
                      onChange={(event) =>
                        setChecked(event.target.checked)
                      }
                    />
  
                    I checked the actual bank deposit
                    and confirmed it has not been used
                    for another payment.
  
                  </label>
  
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      loading ||
                      !!error ||
                      !checked ||
                      !proof ||
                      !amount
                    }
                    className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
  
                    {busy
                      ? "Processing..."
                      : "Approve Payment"}
  
                  </button>
  
                </form>
  
                {/* REJECT PAYMENT FORM */}
  
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
  
                    submit("reject");
                  }}
                  className="space-y-3 rounded-xl border border-red-200 p-4"
                >
  
                  <h4 className="flex items-center gap-2 font-bold text-red-800">
  
                    <AlertCircle size={18} />
  
                    Reject Payment
  
                  </h4>
  
                  <label
                    htmlFor="rejectionReason"
                    className="block text-sm font-semibold"
                  >
                    Rejection reason shown to customer
                  </label>
  
                  <textarea
                    id="rejectionReason"
                    className={field}
                    rows={4}
                    required
                    maxLength={500}
                    value={reason}
                    disabled={busy}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    placeholder="Explain why the payment could not be verified."
                  />
  
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      loading ||
                      !!error ||
                      !reason.trim()
                    }
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  >
  
                    Reject Payment
  
                  </button>
  
                </form>
  
              </div>
  
            ) : (
  
              /* ================================== */
              /* ALREADY REVIEWED PAYMENT */
              /* ================================== */
  
              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
  
                {statusOf(selected) === "CONFIRMED" && (
  
                  <>
  
                    <p>
  
                      Verified amount:{" "}
  
                      <strong>
  
                        {money(
                          selected.verifiedAmount ??
                          selected.amount
                        )}
  
                      </strong>
  
                    </p>
  
                    <p>
  
                      Confirmed at:{" "}
  
                      {dateText(
                        selected.confirmedAt
                      )}
  
                    </p>
  
                  </>
  
                )}
  
                {statusOf(selected) === "REJECTED" && (
  
                  <p>
  
                    Rejection reason:{" "}
  
                    {selected.rejectionReason ||
                      "Not provided"}
  
                  </p>
  
                )}
  
                <p className="text-slate-500">
                  This receipt is no longer
                  awaiting review.
                </p>
  
              </div>
  
            )}
  
          </div>
  
        )}
  
      </section>
    );
  }
  