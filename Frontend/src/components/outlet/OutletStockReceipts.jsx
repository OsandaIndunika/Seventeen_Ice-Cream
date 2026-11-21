
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from "react";
  
  import {
    ClipboardCheck,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Package,
    Truck,
    CalendarDays,
    RotateCcw,
  } from "lucide-react";
  
  // =====================================================
  // BACKEND CONFIGURATION
  // =====================================================
  
  const API_BASE = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  // =====================================================
  // STYLES
  // =====================================================
  
  const inputClass =
    "w-full rounded-xl border border-slate-200 " +
    "bg-white px-4 py-3 text-sm outline-none " +
    "focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100";
  
  const buttonClass =
    "inline-flex items-center justify-center gap-2 " +
    "rounded-xl bg-[#3654FF] px-5 py-3 text-sm " +
    "font-bold text-white hover:bg-[#2943D9] " +
    "disabled:cursor-not-allowed disabled:opacity-50";
  
  // =====================================================
  // JWT AUTHENTICATION
  // =====================================================
  
  function getToken() {
    try {
      const auth = JSON.parse(
        sessionStorage.getItem("seventeen_auth") || "null"
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
  
  // =====================================================
  // OUTLET STOCK RECEIVING API
  // =====================================================
  
  async function outletSupplyApi(path, options = {}) {
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Your login session is missing. Please sign in again."
      );
    }
  
    const response = await fetch(
      `${API_BASE}/api/outlet/supply${path}`,
      {
        ...options,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
  
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
  
          ...options.headers,
        },
      }
    );
  
    const raw = await response.text();
  
    let data = null;
  
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
  
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Login expired. Please sign in again."
        );
      }
  
      if (response.status === 403) {
        throw new Error(
          "You do not have permission to receive stock for this outlet."
        );
      }
  
      if (response.status === 404) {
        throw new Error(
          "Outlet Stock Receiving API was not found. " +
          "Check OutletSupplyReceivingController.java."
        );
      }
  
      throw new Error(
        data?.detail ||
        data?.message ||
        data?.error ||
        `Receiving request failed (${response.status}).`
      );
    }
  
    return data;
  }
  
  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================
  
  function displayLocalDateTime(value) {
    if (!value) return "—";
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
  
    return date.toLocaleString("en-LK", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  
  function productLabel(item) {
    const name =
      item.productName ||
      item.productId ||
      "Product";
  
    const size = item.size
      ? ` (${item.size})`
      : "";
  
    const flavour = item.flavour
      ? ` – ${item.flavour}`
      : "";
  
    return `${name}${size}${flavour}`;
  }
  
  function transferIdOf(transfer) {
    return transfer?.transferId ?? transfer?.id;
  }
  
  function itemIdOf(item) {
    return item?.transferItemId ?? item?.id;
  }
  
  function formatStatus(value) {
    return String(value || "UNKNOWN")
      .replaceAll("_", " ");
  }
  
  function statusClass(value) {
    const status = String(value || "").toUpperCase();
  
    if (status === "RECEIVED") {
      return "bg-green-50 text-green-700";
    }
  
    if (status === "IN_TRANSIT") {
      return "bg-blue-50 text-blue-700";
    }
  
    if (status === "DISCREPANCY") {
      return "bg-amber-50 text-amber-700";
    }
  
    return "bg-slate-100 text-slate-700";
  }
  
  function createReceiptKey() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  
    throw new Error(
      "Secure receipt IDs are unavailable in this browser."
    );
  }
  
  // =====================================================
  // OUTLET STOCK RECEIPTS COMPONENT
  // =====================================================
  
  /**
   * Receives Stock Transfer Notes dispatched
   * by the Sales Manager.
   *
   * Backend endpoints:
   *
   * GET  /api/outlet/supply/pending
   *
   * GET  /api/outlet/supply/transfers/{transferId}
   *
   * POST /api/outlet/supply/transfers/{transferId}/receive
   *
   * The backend must:
   *
   * - Verify the Outlet Manager's JWT.
   * - Verify outlet assignment.
   * - Verify transfer status is IN_TRANSIT.
   * - Validate all received quantities.
   * - Validate production batches.
   * - Credit accepted quantities to Defreezer 2.
   * - Update aggregate and batch stock together.
   * - Prevent duplicate receipt confirmations.
   *
   * onReceived is called after a successful POST
   * so the parent dashboard can refresh inventory.
   */
  
  export default function OutletStockReceipts({
    onReceived,
  }) {
  
    // ===================================================
    // STATE
    // ===================================================
  
    const [pendingTransfers, setPendingTransfers] =
      useState([]);
  
    const [selectedTransferId, setSelectedTransferId] =
      useState("");
  
    const [transferDetails, setTransferDetails] =
      useState(null);
  
    const [receivedQuantities, setReceivedQuantities] =
      useState({});
  
    const [notes, setNotes] =
      useState("");
  
    const [loading, setLoading] =
      useState(true);
  
    const [detailsLoading, setDetailsLoading] =
      useState(false);
  
    const [submitting, setSubmitting] =
      useState(false);
  
    const [error, setError] =
      useState("");
  
    const [message, setMessage] =
      useState("");
  
    // The receipt key and exact payload are
    // retained after an uncertain POST response.
  
    const receiptKeyRef = useRef(null);
  
    const pendingPayloadRef = useRef(null);
  
    const pendingTransferIdRef = useRef(null);
  
    // Avoid applying responses from obsolete
    // transfer detail requests.
  
    const detailRequestRef = useRef(0);
  
    // ===================================================
    // LOAD PENDING TRANSFER NOTES
    // ===================================================
  
    const loadPending = useCallback(async () => {
      setLoading(true);
  
      try {
        const result = await outletSupplyApi("/pending");
  
        if (!Array.isArray(result)) {
          throw new Error(
            "Pending stock transfers API must return an array."
          );
        }
  
        setPendingTransfers(result);
  
        return result;
  
      } catch (err) {
        setError(
          err?.message ||
          "Unable to retrieve pending stock transfers."
        );
  
        throw err;
  
      } finally {
        setLoading(false);
      }
    }, []);
  
    // ===================================================
    // INITIAL LOAD
    // ===================================================
  
    useEffect(() => {
      loadPending().catch(() => {});
  
      return () => {
        detailRequestRef.current += 1;
      };
    }, [loadPending]);
  
    // ===================================================
    // SELECT STOCK TRANSFER NOTE
    // ===================================================
  
    async function selectTransfer(transferId) {
      if (
        submitting ||
        detailsLoading ||
        pendingPayloadRef.current
      ) {
        return;
      }
  
      const id = Number(transferId);
  
      if (!Number.isSafeInteger(id) || id <= 0) {
        setError("Invalid stock transfer note ID.");
        return;
      }
  
      const requestId = ++detailRequestRef.current;
  
      setSelectedTransferId(String(id));
  
      setTransferDetails(null);
      setReceivedQuantities({});
      setNotes("");
      setError("");
      setMessage("");
  
      receiptKeyRef.current = null;
      pendingPayloadRef.current = null;
      pendingTransferIdRef.current = null;
  
      setDetailsLoading(true);
  
      try {
        const result = await outletSupplyApi(
          `/transfers/${encodeURIComponent(id)}`
        );
  
        if (requestId !== detailRequestRef.current) {
          return;
        }
  
        if (
          !result ||
          !Array.isArray(result.items)
        ) {
          throw new Error(
            "The transfer details API must return " +
            "a transfer with an items array."
          );
        }
  
        if (
          String(result.status || "").toUpperCase() !==
          "IN_TRANSIT"
        ) {
          throw new Error(
            "This transfer note is not awaiting receipt."
          );
        }
  
        const returnedId = Number(
          transferIdOf(result) ?? id
        );
  
        if (returnedId !== id) {
          throw new Error(
            "The returned transfer details do not match the selected note."
          );
        }
  
        if (result.items.length === 0) {
          throw new Error(
            "This stock transfer contains no items."
          );
        }
  
        const initialQuantities = {};
        const seenIds = new Set();
  
        for (const item of result.items) {
          const itemId = Number(itemIdOf(item));
  
          const dispatchedQuantity = Number(
            item.dispatchedQuantity
          );
  
          if (
            !Number.isSafeInteger(itemId) ||
            itemId <= 0 ||
            seenIds.has(itemId) ||
            !Number.isSafeInteger(dispatchedQuantity) ||
            dispatchedQuantity <= 0
          ) {
            throw new Error(
              "Transfer note contains an invalid or duplicate item."
            );
          }
  
          seenIds.add(itemId);
  
          // Default to the dispatched quantity.
          // The Outlet Manager can correct it
          // after physically counting the stock.
  
          initialQuantities[itemId] =
            String(dispatchedQuantity);
        }
  
        setTransferDetails(result);
  
        setReceivedQuantities(initialQuantities);
  
      } catch (err) {
        if (requestId === detailRequestRef.current) {
          setError(
            err?.message ||
            "Unable to open this stock transfer note."
          );
        }
  
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailsLoading(false);
        }
      }
    }
  
    // ===================================================
    // CURRENT TRANSFER ITEMS
    // ===================================================
  
    const items = useMemo(() => {
      return Array.isArray(transferDetails?.items)
        ? transferDetails.items
        : [];
    }, [transferDetails]);
  
    // ===================================================
    // TOTAL DISPATCHED QUANTITY
    // ===================================================
  
    const dispatchedTotal = useMemo(() => {
      return items.reduce(
        (sum, item) =>
          sum + Number(item.dispatchedQuantity || 0),
        0
      );
    }, [items]);
  
    // ===================================================
    // TOTAL RECEIVED QUANTITY
    // ===================================================
  
    const receivedTotal = useMemo(() => {
      return items.reduce(
        (sum, item) => {
          const itemId = itemIdOf(item);
  
          const value = Number(
            receivedQuantities[itemId]
          );
  
          return sum + (
            Number.isFinite(value) ? value : 0
          );
        },
        0
      );
    }, [items, receivedQuantities]);
  
    const shortageTotal = Math.max(
      0,
      dispatchedTotal - receivedTotal
    );
  
    const submissionPending =
      Boolean(pendingPayloadRef.current);
  
    // ===================================================
    // MODIFY RECEIVED QUANTITY
    // ===================================================
  
    function updateReceivedQuantity(
      transferItemId,
      value
    ) {
      if (submitting || submissionPending) {
        return;
      }
  
      setReceivedQuantities(
        (previous) => ({
          ...previous,
          [transferItemId]: value,
        })
      );
  
      setError("");
      setMessage("");
    }
  
    // ===================================================
    // VALIDATE RECEIVED QUANTITIES
    // ===================================================
  
    function validateReceivedQuantities() {
      for (const item of items) {
        const itemId = itemIdOf(item);
  
        const value =
          receivedQuantities[itemId];
  
        const quantity = Number(value);
  
        const dispatchedQuantity = Number(
          item.dispatchedQuantity
        );
  
        if (
          value === undefined ||
          String(value).trim() === "" ||
          !Number.isSafeInteger(quantity) ||
          quantity < 0 ||
          quantity > dispatchedQuantity
        ) {
          throw new Error(
            "Each received quantity must be a whole " +
            "number between zero and its dispatched quantity."
          );
        }
      }
  
      if (
        shortageTotal > 0 &&
        !notes.trim()
      ) {
        throw new Error(
          "Please explain the missing or damaged " +
          "products in Receiving Notes."
        );
      }
    }
  
    // ===================================================
    // CONFIRM STOCK RECEIPT
    // ===================================================
  
    async function confirmReceipt() {
      if (
        submitting ||
        detailsLoading ||
        !transferDetails
      ) {
        return;
      }
  
      const transferId = Number(
        transferIdOf(transferDetails) ??
        selectedTransferId
      );
  
      if (
        !Number.isSafeInteger(transferId) ||
        transferId <= 0
      ) {
        setError("Invalid stock transfer note ID.");
        return;
      }
  
      // If a previous POST response is uncertain,
      // retry the exact request with the same key.
  
      const pendingPayload =
        pendingPayloadRef.current;
  
      if (pendingPayload) {
        if (
          pendingTransferIdRef.current !== transferId
        ) {
          setError(
            "An earlier receipt is still unresolved. " +
            "Do not confirm another transfer yet."
          );
          return;
        }
      } else {
        try {
          validateReceivedQuantities();
        } catch (err) {
          setError(err.message);
          return;
        }
      }
  
      const confirmed = window.confirm(
        pendingPayload
          ? (
              "Retry the previous receipt confirmation?\n\n" +
              "The exact same receipt key and request " +
              "will be used. Check the server's transfer " +
              "status if the previous result is uncertain."
            )
          : (
              `Confirm ${receivedTotal} of ${dispatchedTotal} ` +
              "dispatched units into Defreezer 2?\n\n" +
              (
                shortageTotal > 0
                  ? `${shortageTotal} units will be recorded ` +
                    "as missing or not accepted.\n\n"
                  : ""
              ) +
              "Check physical quantities, production " +
              "batch labels and product condition first."
            )
      );
  
      if (!confirmed) return;
  
      let payload = pendingPayload;
  
      if (!payload) {
        try {
          receiptKeyRef.current =
            createReceiptKey();
  
          payload = JSON.stringify({
            receiptKey: receiptKeyRef.current,
  
            items: items.map((item) => ({
              transferItemId: Number(
                itemIdOf(item)
              ),
  
              receivedQuantity: Number(
                receivedQuantities[
                  itemIdOf(item)
                ]
              ),
            })),
  
            notes: notes.trim(),
          });
  
        } catch (err) {
          setError(err.message);
          return;
        }
      }
  
      // Save immutable request data BEFORE the POST.
  
      pendingPayloadRef.current = payload;
      pendingTransferIdRef.current = transferId;
  
      setSubmitting(true);
      setError("");
      setMessage("");
  
      let result;
  
      try {
        result = await outletSupplyApi(
          `/transfers/${transferId}/receive`,
          {
            method: "POST",
            body: payload,
          }
        );
  
      } catch (err) {
        setError(
          (err?.message ||
            "Unable to confirm stock receipt.") +
          " The request may have reached Spring Boot. " +
          "Check the transfer status before retrying. " +
          "The same receipt key is retained."
        );
  
        setSubmitting(false);
        return;
      }
  
      // =================================================
      // POST SUCCEEDED
      // =================================================
  
      // Clear the pending request before refreshing.
      // A later GET failure must not be treated as
      // a failed stock-receiving operation.
  
      receiptKeyRef.current = null;
      pendingPayloadRef.current = null;
      pendingTransferIdRef.current = null;
  
      setTransferDetails(null);
      setSelectedTransferId("");
      setReceivedQuantities({});
      setNotes("");
  
      setMessage(
        `Stock transfer ${
          result?.transferNumber ||
          transferDetails.transferNumber ||
          `#${transferId}`
        } successfully confirmed. ` +
        `${receivedTotal} units accepted into Defreezer 2.`
      );
  
      // Refresh pending transfer notes.
  
      try {
        await loadPending();
  
      } catch (refreshError) {
        console.warn(
          "Receipt saved, but pending notes " +
          "could not be refreshed:",
          refreshError
        );
      }
  
      // Refresh the parent Outlet Manager
      // dashboard's inventory and report data.
  
      try {
        await onReceived?.(result);
  
      } catch (refreshError) {
        console.warn(
          "Receipt saved, but outlet inventory " +
          "refresh failed:",
          refreshError
        );
      }
  
      setSubmitting(false);
    }
  
    // ===================================================
    // REFRESH PENDING TRANSFERS
    // ===================================================
  
    async function refreshPending() {
      if (loading || submitting) return;
  
      setError("");
  
      try {
        await loadPending();
  
        setMessage(
          pendingPayloadRef.current
            ? "Pending notes refreshed. The previous " +
              "confirmation remains unresolved; check " +
              "its final status before retrying."
            : "Pending stock transfers refreshed."
        );
  
      } catch {
        // loadPending already sets the error.
      }
    }
  
    // ===================================================
    // CANCEL SELECTED TRANSFER VIEW
    // ===================================================
  
    function closeDetails() {
      if (
        submitting ||
        pendingPayloadRef.current
      ) {
        return;
      }
  
      detailRequestRef.current += 1;
  
      setTransferDetails(null);
      setSelectedTransferId("");
      setReceivedQuantities({});
      setNotes("");
      setError("");
  
      receiptKeyRef.current = null;
      pendingPayloadRef.current = null;
      pendingTransferIdRef.current = null;
    }
  
    // ===================================================
    // JSX
    // ===================================================
  
    return (
      <section className="space-y-6 text-[#17265B]">
  
        {/* ======================================
            HEADER
        ====================================== */}
  
        <div className="flex flex-wrap items-start justify-between gap-4">
  
          <div>
            <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
              <ClipboardCheck size={24} />
              Stock Receipts
            </h2>
  
            <p className="mt-2 text-sm text-slate-600">
              Receive products dispatched from
              the Sales Manager's vehicle.
              Verify production batches and
              physical quantities before
              accepting stock into Defreezer 2.
            </p>
          </div>
  
          <button
            type="button"
            onClick={refreshPending}
            disabled={loading || submitting}
            className={
              "inline-flex items-center gap-2 " +
              "rounded-xl border border-slate-200 " +
              "bg-white px-4 py-3 text-sm font-semibold " +
              "disabled:opacity-50"
            }
          >
            <RefreshCw
              size={16}
              className={
                loading ? "animate-spin" : ""
              }
            />
  
            Refresh Pending
          </button>
  
        </div>
  
        {/* ======================================
            RECEIVING INFORMATION
        ====================================== */}
  
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
  
          <div className="flex items-center gap-2 font-bold text-blue-800">
            <Package size={18} />
  
            Receiving Destination: Defreezer 2
          </div>
  
          <p className="mt-2 text-sm text-blue-700">
            Only physically received and acceptable
            products should be counted. The system
            preserves their production batch numbers.
            The receiving backend updates inventory
            after you confirm the transfer.
          </p>
  
        </div>
  
        {/* ======================================
            ERRORS
        ====================================== */}
  
        {error && (
          <div
            role="alert"
            className={
              "flex items-start gap-2 rounded-xl " +
              "border border-red-200 bg-red-50 " +
              "p-4 text-sm text-red-700"
            }
          >
            <AlertTriangle
              size={18}
              className="shrink-0"
            />
  
            <span>{error}</span>
          </div>
        )}
  
        {/* ======================================
            SUCCESS
        ====================================== */}
  
        {message && (
          <div
            role="status"
            className={
              "flex items-start gap-2 rounded-xl " +
              "border border-green-200 bg-green-50 " +
              "p-4 text-sm text-green-700"
            }
          >
            <CheckCircle2
              size={18}
              className="shrink-0"
            />
  
            <span>{message}</span>
          </div>
        )}
  
        {/* ======================================
            PENDING TRANSFER NOTES
        ====================================== */}
  
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  
          <div className="flex items-center gap-2">
  
            <Truck size={20} />
  
            <h3 className="text-lg font-bold">
              Pending Stock Transfer Notes
            </h3>
  
          </div>
  
          {loading && (
            <p className="mt-4 text-sm text-slate-500">
              Loading pending stock transfers...
            </p>
          )}
  
          {!loading &&
            pendingTransfers.length === 0 &&
            !error && (
              <p className="mt-4 text-sm text-slate-500">
                No stock transfers are awaiting receipt.
              </p>
            )}
  
          {!loading &&
            pendingTransfers.length > 0 && (
  
              <div className="mt-4 overflow-x-auto">
  
                <table className="w-full min-w-[650px] text-left text-sm">
  
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
  
                      <th className="p-3">
                        Transfer Number
                      </th>
  
                      <th className="p-3">
                        Vehicle
                      </th>
  
                      <th className="p-3">
                        Dispatched
                      </th>
  
                      <th className="p-3">
                        Status
                      </th>
  
                      <th className="p-3">
                        Action
                      </th>
  
                    </tr>
                  </thead>
  
                  <tbody>
  
                    {pendingTransfers.map(
                      (transfer) => {
                        const transferId =
                          transferIdOf(transfer);
  
                        return (
                          <tr
                            key={transferId}
                            className="border-t border-slate-100"
                          >
  
                            <td className="p-3 font-semibold">
                              {transfer.transferNumber ||
                                `#${transferId}`}
                            </td>
  
                            <td className="p-3">
                              {transfer.vehicleNumber ||
                                transfer.sourceVehicleNumber ||
                                "Sales Vehicle"}
                            </td>
  
                            <td className="p-3">
  
                              <div className="flex items-center gap-2">
  
                                <CalendarDays
                                  size={15}
                                  className="text-slate-400"
                                />
  
                                {displayLocalDateTime(
                                  transfer.dispatchedAt ||
                                  transfer.createdAt
                                )}
  
                              </div>
  
                            </td>
  
                            <td className="p-3">
  
                              <span
                                className={
                                  "rounded-full px-3 py-1 " +
                                  "text-xs font-semibold " +
                                  statusClass(
                                    transfer.status
                                  )
                                }
                              >
                                {formatStatus(
                                  transfer.status
                                )}
                              </span>
  
                            </td>
  
                            <td className="p-3">
  
                              <button
                                type="button"
                                onClick={() =>
                                  selectTransfer(
                                    transferId
                                  )
                                }
                                disabled={
                                  submitting ||
                                  detailsLoading ||
                                  submissionPending
                                }
                                className={buttonClass}
                              >
                                <ClipboardCheck size={16} />
  
                                Check & Receive
                              </button>
  
                            </td>
  
                          </tr>
                        );
                      }
                    )}
  
                  </tbody>
  
                </table>
  
              </div>
            )}
  
        </div>
  
        {/* ======================================
            LOADING SELECTED NOTE
        ====================================== */}
  
        {detailsLoading && (
          <div className="rounded-xl bg-white p-5 text-sm text-slate-500">
            Loading transfer note details...
          </div>
        )}
  
        {/* ======================================
            RECEIVING FORM
        ====================================== */}
  
        {transferDetails && (
  
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  
            {/* TRANSFER HEADER */}
  
            <div className="flex flex-wrap items-start justify-between gap-3">
  
              <div>
  
                <h3 className="text-xl font-bold">
                  Receive{" "}
                  {transferDetails.transferNumber ||
                    `#${selectedTransferId}`}
                </h3>
  
                <p className="mt-2 text-sm text-slate-500">
                  Destination: Defreezer 2
                </p>
  
                <p className="mt-1 text-sm text-slate-500">
                  Verify the actual stock against
                  each batch before confirming.
                </p>
  
              </div>
  
              <button
                type="button"
                onClick={closeDetails}
                disabled={
                  submitting ||
                  submissionPending
                }
                className={
                  "inline-flex items-center gap-2 " +
                  "rounded-xl border border-slate-200 " +
                  "px-4 py-2 text-sm font-semibold " +
                  "disabled:opacity-50"
                }
              >
                <RotateCcw size={16} />
  
                Back
              </button>
  
            </div>
  
            {/* TRANSFER ITEMS */}
  
            <div className="overflow-x-auto">
  
              <table className="w-full min-w-[780px] text-left text-sm">
  
                <thead className="bg-slate-50 text-slate-500">
  
                  <tr>
  
                    <th className="p-3">
                      Product / Size / Flavour
                    </th>
  
                    <th className="p-3">
                      Batch Number
                    </th>
  
                    <th className="p-3">
                      Expiry Date
                    </th>
  
                    <th className="p-3 text-right">
                      Dispatched
                    </th>
  
                    <th className="p-3">
                      Received
                    </th>
  
                  </tr>
  
                </thead>
  
                <tbody>
  
                  {items.map((item) => {
                    const itemId = itemIdOf(item);
  
                    return (
                      <tr
                        key={itemId}
                        className="border-t border-slate-100"
                      >
  
                        <td className="p-3 font-semibold">
                          {productLabel(item)}
                        </td>
  
                        <td className="p-3">
                          {item.batchNumber ||
                            item.batch?.batchNumber ||
                            "—"}
                        </td>
  
                        <td className="p-3">
                          {item.expiryDate ||
                            item.batch?.expiryDate ||
                            "—"}
                        </td>
  
                        <td className="p-3 text-right font-bold">
                          {item.dispatchedQuantity}
                        </td>
  
                        <td className="p-3">
  
                          <input
                            type="number"
                            min="0"
                            max={
                              item.dispatchedQuantity
                            }
                            step="1"
                            required
                            value={
                              receivedQuantities[
                                itemId
                              ] ?? ""
                            }
                            disabled={
                              submitting ||
                              submissionPending
                            }
                            onChange={(event) =>
                              updateReceivedQuantity(
                                itemId,
                                event.target.value
                              )
                            }
                            className={
                              inputClass + " max-w-28"
                            }
                          />
  
                        </td>
  
                      </tr>
                    );
                  })}
  
                </tbody>
  
              </table>
  
            </div>
  
            {/* RECEIVING SUMMARY */}
  
            <div className="grid gap-3 sm:grid-cols-3">
  
              <div className="rounded-xl bg-slate-50 p-4">
  
                <p className="text-xs text-slate-500">
                  Dispatched Units
                </p>
  
                <p className="mt-2 text-2xl font-bold">
                  {dispatchedTotal}
                </p>
  
              </div>
  
              <div className="rounded-xl bg-green-50 p-4">
  
                <p className="text-xs text-green-700">
                  Received Units
                </p>
  
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {receivedTotal}
                </p>
  
              </div>
  
              <div className="rounded-xl bg-amber-50 p-4">
  
                <p className="text-xs text-amber-700">
                  Missing / Not Accepted
                </p>
  
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {shortageTotal}
                </p>
  
              </div>
  
            </div>
  
            {/* DISCREPANCY WARNING */}
  
            {shortageTotal > 0 && (
  
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
  
                <div className="flex items-center gap-2 font-bold text-amber-800">
  
                  <AlertTriangle size={18} />
  
                  Quantity Discrepancy
                </div>
  
                <p className="mt-2 text-sm text-amber-700">
                  The received quantity is less
                  than the dispatched quantity.
  
                  Explain missing, damaged or
                  rejected goods before confirming.
  
                  Only accepted units should
                  enter Defreezer 2 stock.
                </p>
  
              </div>
            )}
  
            {/* RECEIVING NOTES */}
  
            <label className="block space-y-2 text-sm font-semibold">
  
              <span>
                Receiving Notes
                {shortageTotal > 0
                  ? " (Required for discrepancies)"
                  : " (Optional)"}
              </span>
  
              <textarea
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                disabled={
                  submitting ||
                  submissionPending
                }
                className={inputClass}
                placeholder={
                  "Physical count, missing products, " +
                  "damaged packages, batch differences, " +
                  "temperature concerns..."
                }
              />
  
            </label>
  
            {/* CONFIRM RECEIPT BUTTON */}
  
            <button
              type="button"
              onClick={confirmReceipt}
              disabled={
                submitting ||
                detailsLoading ||
                !transferDetails
              }
              className={
                buttonClass + " w-full"
              }
            >
              <ClipboardCheck size={18} />
  
              {submitting
                ? "Confirming Receipt..."
                : submissionPending
                  ? "Retry Same Receipt"
                  : "Confirm Receipt Into Defreezer 2"}
            </button>
  
            {/* UNCERTAIN RECEIPT WARNING */}
  
            {submissionPending && (
  
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
  
                <p className="text-sm font-bold text-amber-800">
                  Previous confirmation may have succeeded.
                </p>
  
                <p className="mt-2 text-sm text-amber-700">
                  Check the transfer status before
                  retrying. The same receipt key and
                  request payload will be used.
  
                  Do not create another receipt for
                  the same physical stock.
                </p>
  
              </div>
            )}
  
          </div>
        )}
  
      </section>
    );
  }
  