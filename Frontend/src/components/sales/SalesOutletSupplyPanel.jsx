
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ClipboardList,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import SalesOutletBatchSelector from "./SalesOutletBatchSelector";

// =====================================================
// BACKEND CONFIGURATION
// =====================================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// =====================================================
// JWT AUTHENTICATION
// =====================================================

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

// =====================================================
// OUTLET SUPPLY API HELPER
// =====================================================

async function supplyRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Login token is missing. Please sign in again."
    );
  }

  const response = await fetch(
    `${API_BASE}/api/sales/outlet-supply${path}`,
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
        "Your login token has expired. Please sign in again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Sales Manager access is required."
      );
    }

    if (response.status === 404) {
      throw new Error(
        "Outlet Supply API was not found. " +
          "Check OutletSupplyController.java " +
          "and OutletSupplyService.java."
      );
    }

    throw new Error(
      data?.detail ||
        data?.message ||
        data?.error ||
        `Outlet Supply request failed (${response.status}).`
    );
  }

  return data;
}

// =====================================================
// TAILWIND STYLES
// =====================================================

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-white px-4 py-3 text-sm outline-none " +
  "focus:border-[#3654FF] " +
  "focus:ring-2 focus:ring-blue-100";

const primaryClass =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl bg-[#3654FF] px-5 py-3 text-sm " +
  "font-bold text-white hover:bg-[#2943D9] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// =====================================================
// HELPERS
// =====================================================

function productLabel(row) {
  const name = row.productName || row.productId || "Product";
  const size = row.size ? ` (${row.size})` : "";
  const flavour = row.flavour ? ` — ${row.flavour}` : "";

  return (
    `${name}${size}${flavour} — ` +
    `${row.availableQuantity} available`
  );
}

function normalizeProduct(row) {
  return {
    ...row,

    vehicleStockId: Number(
      row.vehicleStockId
    ),

    availableQuantity: Number(
      row.availableQuantity
    ),

    productId: String(
      row.productId || ""
    ),

    productName: String(
      row.productName ||
        row.productId ||
        "Product"
    ),

    size: String(
      row.size || ""
    ),

    flavour: String(
      row.flavour || ""
    ),
  };
}

function formatDateTime(value) {
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

function formatStatus(status) {
  return String(status || "UNKNOWN")
    .replaceAll("_", " ");
}

function statusClass(status) {
  const value = String(
    status || ""
  ).toUpperCase();

  if (value === "RECEIVED") {
    return "bg-green-50 text-green-700";
  }

  if (value === "IN_TRANSIT") {
    return "bg-blue-50 text-blue-700";
  }

  if (value === "DISCREPANCY") {
    return "bg-amber-50 text-amber-700";
  }

  if (value === "CANCELLED") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

// =====================================================
// BATCH HELPERS
//
// No quality-status logic.
//
// The Sales Manager can choose production batches
// assigned to the active lorry that have stock.
//
// The backend remains responsible for validating
// expiry dates and actual stock during dispatch.
// =====================================================

function normalizeBatchNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

function batchAvailableQuantity(batch) {
  if (!batch) return 0;

  const available = Number(
    batch.availableQuantity ??
    (
      Number(batch.quantity ?? 0) -
      Number(batch.reservedQuantity ?? 0)
    )
  );

  return Number.isFinite(available)
    ? Math.max(0, available)
    : 0;
}

// =====================================================
// SALES OUTLET SUPPLY PANEL
// =====================================================

/**
 * Allows Sales Manager to dispatch products
 * from the currently selected lorry.
 *
 * Backend endpoints:
 *
 * GET /api/sales/outlet-supply/available-products
 *
 * GET /api/sales/outlet-supply/transfers
 *
 * POST /api/sales/outlet-supply/manual-transfers
 *
 * Batch selector data:
 *
 * GET /api/sales/vehicles/{vehicleId}/batch-inventory
 *
 * Each dispatch line identifies:
 *
 * - vehicleStockId
 * - batchNumber
 * - quantity
 *
 * The selected batch number comes from an
 * existing lorry batch allocation.
 *
 * Spring Boot deducts vehicle stock.
 *
 * The Outlet Manager confirms receipt before
 * Defreezer 2 is increased.
 */

export default function SalesOutletSupplyPanel({
  vehicleNumber,
  onTransferCreated,
}) {

  // ===================================================
  // STATE
  // ===================================================

  const [products, setProducts] =
    useState([]);

  const [transfers, setTransfers] =
    useState([]);

  const [
    selectedStockId,
    setSelectedStockId
  ] = useState("");

  const [
    batchNumber,
    setBatchNumber
  ] = useState("");

  // NEW:
  // Store the exact batch record returned
  // by SalesOutletBatchSelector.jsx.
  //
  // This lets us verify batch quantity before
  // adding an item to the transfer note.

  const [
    selectedBatch,
    setSelectedBatch
  ] = useState(null);

  // NEW:
  // Triggers the selector to reload current
  // lorry batch inventory after refresh.

  const [
    batchRefresh,
    setBatchRefresh
  ] = useState(0);

  const [quantity, setQuantity] =
    useState("1");

  const [notes, setNotes] =
    useState("");

  const [lines, setLines] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // Keep the original receipt key and JSON
  // when the dispatch result is uncertain.
  //
  // A retry must use the same request.

  const receiptKeyRef = useRef(null);

  const payloadRef = useRef(null);

  // ===================================================
  // LOAD AVAILABLE PRODUCTS AND TRANSFER HISTORY
  // ===================================================

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [available, history] =
        await Promise.all([
          supplyRequest("/available-products"),
          supplyRequest("/transfers"),
        ]);

      if (!Array.isArray(available)) {
        throw new Error(
          "The available-products API must return an array."
        );
      }

      if (!Array.isArray(history)) {
        throw new Error(
          "The transfer-history API must return an array."
        );
      }

      const normalized = available
        .map(normalizeProduct)
        .filter((row) =>
          Number.isSafeInteger(
            row.vehicleStockId
          ) &&
          row.vehicleStockId > 0 &&
          Number.isSafeInteger(
            row.availableQuantity
          ) &&
          row.availableQuantity >= 0
        );

      setProducts(normalized);
      setTransfers(history);

      // Reload the batch dropdown when the
      // parent refreshes the lorry inventory.

      setBatchRefresh((previous) => previous + 1);

      // Clear stale batch details after refresh.
      // A different batch must be selected again.

      setSelectedBatch(null);
      setBatchNumber("");

      return {
        products: normalized,
        transfers: history,
      };

    } finally {
      setLoading(false);
    }
  }, []);

  // ===================================================
  // INITIAL DATA LOAD
  // ===================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        await load();
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Unable to load Outlet Supply data."
          );
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [load]);

  // ===================================================
  // CURRENT SELECTED PRODUCT
  // ===================================================

  const selection = useMemo(() => {
    return products.find((row) =>
      String(row.vehicleStockId) ===
      String(selectedStockId)
    );
  }, [products, selectedStockId]);

  // ===================================================
  // SELECTED BATCH VALIDATION
  //
  // Confirm the returned batch belongs
  // to the selected product.
  // ===================================================

  const validSelectedBatch = useMemo(() => {
    if (
      !selection ||
      !selectedBatch ||
      !batchNumber
    ) {
      return null;
    }

    const selectedNumber =
      normalizeBatchNumber(batchNumber);

    const returnedNumber =
      normalizeBatchNumber(
        selectedBatch.batchNumber
      );

    const selectedBatchId = Number(
      selectedBatch.vehicleBatchStockId
    );

    const batchStockId = Number(
      selectedBatch.vehicleStockId ??
      selection.vehicleStockId
    );

    if (
      selectedNumber !== returnedNumber ||
      !Number.isSafeInteger(selectedBatchId) ||
      selectedBatchId <= 0 ||
      batchStockId !== selection.vehicleStockId
    ) {
      return null;
    }

    return selectedBatch;
  }, [
    selection,
    selectedBatch,
    batchNumber
  ]);

  // ===================================================
  // EXISTING DRAFT QUANTITY FOR SELECTED BATCH
  // ===================================================

  const alreadyAddedForBatch = useMemo(() => {
    if (
      !selection ||
      !batchNumber
    ) {
      return 0;
    }

    return lines
      .filter((line) =>
        line.vehicleStockId ===
          selection.vehicleStockId &&
        normalizeBatchNumber(line.batchNumber) ===
          normalizeBatchNumber(batchNumber)
      )
      .reduce(
        (total, line) =>
          total + Number(line.quantity),
        0
      );
  }, [
    lines,
    selection,
    batchNumber,
  ]);

  const selectedBatchRemaining =
    validSelectedBatch
      ? Math.max(
          0,
          batchAvailableQuantity(validSelectedBatch) -
            alreadyAddedForBatch
        )
      : 0;

  // ===================================================
  // TRANSFER TOTAL
  // ===================================================

  const totalUnits = useMemo(() => {
    return lines.reduce(
      (total, line) =>
        total + Number(line.quantity),
      0
    );
  }, [lines]);

  // ===================================================
  // SUBMISSION RETRY STATE
  // ===================================================

  const submissionPending =
    Boolean(payloadRef.current);

  // ===================================================
  // PRODUCT SELECTION
  //
  // NEW:
  // Clear the old batch whenever the user
  // selects a different product.
  // ===================================================

  function handleProductChange(event) {
    if (
      saving ||
      submissionPending
    ) {
      return;
    }

    setSelectedStockId(
      event.target.value
    );

    setBatchNumber("");
    setSelectedBatch(null);
    setQuantity("1");

    setError("");
  }

  // ===================================================
  // BATCH SELECTION
  //
  // SalesOutletBatchSelector returns:
  //
  // onChange(batchNumber, batchObject)
  //
  // No manual batch typing is required.
  // ===================================================

  function handleBatchChange(
    selectedNumber,
    batch
  ) {
    if (
      saving ||
      submissionPending
    ) {
      return;
    }

    setBatchNumber(
      String(selectedNumber ?? "")
    );

    setSelectedBatch(
      batch || null
    );

    setQuantity("1");
    setError("");
  }

  // ===================================================
  // ADD BATCH TO TRANSFER NOTE
  // ===================================================

  function addLine(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (saving || loading) return;

    if (payloadRef.current) {
      setError(
        "A previous dispatch is unresolved. Check transfer history " +
        "before changing this note."
      );
      return;
    }

    const count = Number(quantity);

    const batch =
      String(batchNumber ?? "").trim();

    if (
      !selection ||
      !validSelectedBatch ||
      !batch ||
      batch.length > 100 ||
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      setError(
        "Select a lorry product, choose an available " +
        "production batch and enter a positive " +
        "whole-number quantity."
      );
      return;
    }

    // ========================================
    // CHECK SELECTED BATCH QUANTITY
    // ========================================

    if (
      count > selectedBatchRemaining
    ) {
      setError(
        `Only ${selectedBatchRemaining} units ` +
        `remain available in batch ${batch}.`
      );
      return;
    }

    // ========================================
    // CHECK TOTAL PRODUCT STOCK
    // ========================================

    const alreadyAdded = lines
      .filter(
        (line) =>
          line.vehicleStockId ===
          selection.vehicleStockId
      )
      .reduce(
        (total, line) =>
          total + Number(line.quantity),
        0
      );

    if (
      count + alreadyAdded >
      selection.availableQuantity
    ) {
      setError(
        "Total quantity for this product exceeds " +
        "available lorry stock."
      );
      return;
    }

    // ========================================
    // COMBINE SAME PRODUCT + BATCH
    // ========================================

    const existing = lines.find(
      (line) =>
        line.vehicleStockId ===
          selection.vehicleStockId &&
        normalizeBatchNumber(line.batchNumber) ===
          normalizeBatchNumber(batch)
    );

    setLines(
      (previous) =>
        existing
          ? previous.map(
              (line) =>
                line.vehicleStockId ===
                  selection.vehicleStockId &&
                normalizeBatchNumber(
                  line.batchNumber
                ) ===
                  normalizeBatchNumber(batch)
                  ? {
                      ...line,
                      quantity:
                        Number(line.quantity) +
                        count,
                    }
                  : line
            )
          : [
              ...previous,
              {
                ...selection,

                batchNumber: batch,

                vehicleBatchStockId:
                  Number(
                    validSelectedBatch.vehicleBatchStockId
                  ),

                quantity: count,
              },
            ]
    );

    setQuantity("1");

    setSelectedStockId("");
    setBatchNumber("");
    setSelectedBatch(null);

    setMessage(
      `Batch ${batch} added to the transfer note.`
    );
  }

  // ===================================================
  // REMOVE LINE
  // ===================================================

  function removeLine(stockId, batch) {
    if (
      saving ||
      payloadRef.current
    ) {
      return;
    }

    setLines((previous) =>
      previous.filter(
        (line) =>
          !(
            line.vehicleStockId === stockId &&
            line.batchNumber === batch
          )
      )
    );

    setError("");
  }

  // ===================================================
  // CREATE AND DISPATCH STOCK TRANSFER
  // ===================================================

  async function dispatch() {
    if (
      saving ||
      loading ||
      lines.length === 0
    ) {
      return;
    }

    setError("");
    setMessage("");

    // If a previous response was uncertain,
    // do not regenerate receipt key or JSON.

    const pendingPayload =
      payloadRef.current;

    if (!pendingPayload) {

      const invalidLine =
        lines.find((line) => {

          const current =
            products.find(
              (product) =>
                product.vehicleStockId ===
                line.vehicleStockId
            );

          const totalForProduct =
            lines
              .filter(
                (item) =>
                  item.vehicleStockId ===
                  line.vehicleStockId
              )
              .reduce(
                (sum, item) =>
                  sum + Number(item.quantity),
                0
              );

          return (
            !current ||
            totalForProduct >
              current.availableQuantity
          );
        });

      if (invalidLine) {
        setError(
          "Lorry stock quantities have changed. " +
          "Refresh the inventory and review " +
          "the transfer note."
        );
        return;
      }
    }

    const confirmationMessage =
      pendingPayload
        ? (
            "Retry the previous dispatch request?\n\n" +
            "The same receipt key and identical " +
            "request will be used to prevent " +
            "duplicate stock deductions."
          )
        : (
            `Dispatch ${totalUnits} units from ` +
            `${vehicleNumber || "your selected vehicle"} ` +
            "to the outlet's Defreezer 2?\n\n" +
            "Confirm the selected production batch numbers. " +
            "The Outlet Manager must confirm " +
            "receipt before Defreezer 2 stock " +
            "is increased."
          );

    const confirmed =
      window.confirm(
        confirmationMessage
      );

    if (!confirmed) return;

    if (!receiptKeyRef.current) {
      receiptKeyRef.current =
        crypto.randomUUID();
    }

    const currentPayload =
      pendingPayload ||
      JSON.stringify({
        receiptKey:
          receiptKeyRef.current,

        items: lines.map(
          (line) => ({
            vehicleStockId:
              line.vehicleStockId,

            batchNumber:
              line.batchNumber,

            quantity:
              line.quantity,
          })
        ),

        notes: notes.trim(),
      });

    // Save immutable request before sending.
    // Repeated attempts use the exact same JSON.

    payloadRef.current =
      currentPayload;

    setSaving(true);

    let saved = null;

    try {
      saved =
        await supplyRequest(
          "/manual-transfers",
          {
            method: "POST",
            body: currentPayload,
          }
        );

    } catch (err) {
      setError(
        (err?.message ||
          "Unable to confirm the dispatch.") +
        " If the request reached Spring Boot, " +
        "it may already be recorded. Check " +
        "transfer history before retrying. " +
        "The same receipt key will be reused."
      );

      setSaving(false);
      return;
    }

    // ========================================
    // SUCCESSFUL TRANSFER
    //
    // Clear retry state only after success.
    // ========================================

    receiptKeyRef.current = null;
    payloadRef.current = null;

    setLines([]);
    setNotes("");
    setSelectedStockId("");
    setBatchNumber("");
    setSelectedBatch(null);
    setQuantity("1");

    setMessage(
      `Stock Transfer ${
        saved?.transferNumber ||
        saved?.id ||
        "Note"
      } dispatched successfully. ` +
      "Awaiting Outlet Manager receipt " +
      "into Defreezer 2."
    );

    try {
      await load();

    } catch (refreshError) {
      setError(
        "Transfer was saved successfully, " +
        "but refreshing inventory/history failed: " +
        (
          refreshError?.message ||
          "Unknown error"
        )
      );
    }

    try {
      await onTransferCreated?.(saved);

    } catch (refreshError) {
      console.warn(
        "Transfer saved, but Sales Manager " +
        "dashboard refresh failed:",
        refreshError
      );
    }

    setSaving(false);
  }

  // ===================================================
  // REFRESH INVENTORY AND HISTORY
  // ===================================================

  async function reconcile() {
    if (loading || saving) return;

    setError("");

    try {
      await load();

      setMessage(
        payloadRef.current
          ? (
              "Stock and history refreshed. " +
              "The previous dispatch request " +
              "is still retained. Check whether " +
              "it appears in history before retrying."
            )
          : (
              "Lorry inventory, production batches " +
              "and transfer history refreshed."
            )
      );

    } catch (err) {
      setError(
        err?.message ||
          "Unable to refresh batch inventory."
      );
    }
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <section className="space-y-6 text-[#17265B]">

      {/* ======================================
          PAGE HEADER
      ====================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">
            <Truck size={24} />
            Outlet Supply
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Dispatch products from your currently
            selected lorry to the outlet's
            Defreezer 2.
          </p>

          <p className="mt-2 text-sm font-semibold">
            Source Vehicle:{" "}
            <span className="text-[#3654FF]">
              {vehicleNumber ||
                "Active vehicle session"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={reconcile}
          disabled={loading || saving}
          className={
            "inline-flex items-center gap-2 " +
            "rounded-xl border border-slate-200 " +
            "bg-white px-4 py-3 text-sm " +
            "font-bold disabled:opacity-50"
          }
        >
          <RefreshCw
            size={16}
            className={
              loading ? "animate-spin" : ""
            }
          />

          Refresh Stock
        </button>

      </div>

      {/* ======================================
          TRANSFER INFORMATION
      ====================================== */}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

        <div className="flex items-center gap-2 font-bold text-blue-800">
          <Package size={19} />
          Internal Stock Transfer
        </div>

        <p className="mt-2 text-sm text-blue-700">
          This is not a customer bill.
          Select products from the active vehicle
          and choose their production batch numbers
          from the available lorry stock.
          Spring Boot verifies the selected batches
          and deducts dispatched quantities from
          the vehicle.
          The Outlet Manager must confirm receipt
          before stock is added to Defreezer 2.
        </p>

      </div>

      {/* ======================================
          ERROR MESSAGE
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
          SUCCESS MESSAGE
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
          ADD PRODUCT TO TRANSFER NOTE
      ====================================== */}

      <form
        onSubmit={addLine}
        className={
          "space-y-5 rounded-2xl border " +
          "border-slate-200 bg-white " +
          "p-5 shadow-sm"
        }
      >

        <h3 className="font-serif text-xl font-bold">
          Add Products to Transfer Note
        </h3>

        <div className="grid gap-4 md:grid-cols-2">

          {/* ==================================
              PRODUCT DROPDOWN
          ================================== */}

          <label className="block space-y-2 text-sm font-semibold">
            <span>Product / Size / Flavour</span>

            <select
              className={inputClass}
              value={selectedStockId}
              onChange={handleProductChange}
              required
              disabled={
                saving ||
                submissionPending ||
                loading
              }
            >
              <option value="">
                Select a product from the current lorry
              </option>

              {products
                .filter(
                  (row) =>
                    row.availableQuantity > 0
                )
                .map((row) => (
                  <option
                    key={row.vehicleStockId}
                    value={String(row.vehicleStockId)}
                  >
                    {productLabel(row)}
                  </option>
                ))}
            </select>
          </label>

          {/* ==================================
              NEW: PRODUCTION BATCH DROPDOWN

              Replaces the manual text input.

              The selector automatically loads
              batches for the chosen product.

              The selector returns:
              - batchNumber
              - selected batch object
          ================================== */}

          <div className="text-sm font-semibold">

            <SalesOutletBatchSelector
              vehicleStockId={selectedStockId}
              value={batchNumber}
              onChange={handleBatchChange}
              refreshKey={batchRefresh}
            />

          </div>

          {/* ==================================
              QUANTITY
          ================================== */}

          <label className="block space-y-2 text-sm font-semibold">
            <span>Quantity</span>

            <input
              className={inputClass}
              type="number"
              min="1"
              max={
                validSelectedBatch
                  ? selectedBatchRemaining
                  : undefined
              }
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value
                )
              }
              required
              disabled={
                saving ||
                submissionPending
              }
            />
          </label>

        </div>

        {/* ==================================
            SELECTED PRODUCT DETAILS
        ================================== */}

        {selection && (
          <div className="rounded-xl bg-slate-50 p-4 text-sm">

            <p>
              <strong>Product:</strong>{" "}
              {selection.productName}
              {selection.size
                ? ` (${selection.size})`
                : ""}
            </p>

            <p className="mt-2">
              <strong>Flavour:</strong>{" "}
              {selection.flavour || "—"}
            </p>

            <p className="mt-2">
              <strong>Available in Lorry:</strong>{" "}
              {selection.availableQuantity}
            </p>

            {validSelectedBatch ? (
              <>
                <p className="mt-2">
                  <strong>Selected Batch:</strong>{" "}
                  {validSelectedBatch.batchNumber}
                </p>

                <p className="mt-2">
                  <strong>
                    Available to Add from Batch:
                  </strong>{" "}
                  <span className="font-bold text-green-700">
                    {selectedBatchRemaining}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-slate-600">
                Choose a production batch from
                the dropdown above.
              </p>
            )}

          </div>
        )}

        {/* ==================================
            NO AVAILABLE PRODUCTS
        ================================== */}

        {!loading && products.length === 0 && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
            No products are currently available
            from the active sales vehicle.
            Check the selected vehicle session
            and vehicle_stock quantities.
          </p>
        )}

        {/* ==================================
            ADD TO NOTE
        ================================== */}

        <button
          type="submit"
          disabled={
            loading ||
            saving ||
            submissionPending ||
            !selection ||
            !validSelectedBatch ||
            selectedBatchRemaining <= 0
          }
          className={primaryClass}
        >
          <Plus size={17} />
          Add to Note
        </button>

      </form>

      {/* ======================================
          TRANSFER NOTE ITEMS
      ====================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <h3 className="font-serif text-xl font-bold">
          Transfer Note Items
        </h3>

        {lines.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No products have been added.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">

            <table className="w-full min-w-[650px] text-left text-sm">

              <thead>
                <tr className="border-b bg-slate-50 text-slate-500">

                  <th className="p-3">
                    Product / Size / Flavour
                  </th>

                  <th className="p-3">
                    Production Batch Number
                  </th>

                  <th className="p-3 text-right">
                    Quantity
                  </th>

                  <th className="p-3">
                    Action
                  </th>

                </tr>
              </thead>

              <tbody>

                {lines.map((line) => (
                  <tr
                    key={
                      `${line.vehicleStockId}:${line.batchNumber}`
                    }
                    className="border-b border-slate-100"
                  >

                    <td className="p-3 font-semibold">
                      {line.productName}

                      {line.size
                        ? ` (${line.size})`
                        : ""}

                      {" — "}
                      {line.flavour}
                    </td>

                    <td className="p-3">
                      {line.batchNumber}
                    </td>

                    <td className="p-3 text-right font-bold">
                      {line.quantity}
                    </td>

                    <td className="p-3 text-right">

                      <button
                        type="button"
                        title="Remove batch"
                        disabled={
                          saving ||
                          submissionPending
                        }
                        onClick={() =>
                          removeLine(
                            line.vehicleStockId,
                            line.batchNumber
                          )
                        }
                        className={
                          "text-red-600 " +
                          "disabled:opacity-50"
                        }
                      >
                        <Trash2 size={17} />
                      </button>

                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}

        {/* TOTAL QUANTITY */}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

          <span className="font-semibold">
            Total Units
          </span>

          <span className="text-2xl font-bold text-[#3654FF]">
            {totalUnits}
          </span>

        </div>

        {/* OPTIONAL NOTES */}

        <label className="mt-5 block space-y-2 text-sm font-semibold">

          <span>Delivery Notes (Optional)</span>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            disabled={
              saving ||
              submissionPending
            }
            rows={3}
            maxLength={1000}
            className={inputClass}
            placeholder={
              "Seal number, cold-chain notes, " +
              "delivery instructions..."
            }
          />

        </label>

        {/* DISPATCH BUTTON */}

        <button
          type="button"
          onClick={dispatch}
          disabled={
            saving ||
            loading ||
            lines.length === 0
          }
          className={
            primaryClass +
            " mt-5 w-full"
          }
        >
          <ClipboardList size={18} />

          {saving
            ? "Saving Transfer..."
            : submissionPending
              ? "Retry Previous Dispatch"
              : "Create & Dispatch Stock Transfer Note"}
        </button>

        {/* UNCERTAIN DISPATCH WARNING */}

        {submissionPending && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

            <p className="text-sm font-semibold text-amber-800">
              Previous dispatch result is uncertain.
            </p>

            <p className="mt-2 text-xs text-amber-700">
              Review the transfer history before
              retrying. A retry uses the exact
              same request key and payload.
              Do not create a second note for
              the same physical products.
            </p>

          </div>
        )}

      </div>

      {/* ======================================
          TRANSFER HISTORY
      ====================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <h3 className="font-serif text-xl font-bold">
            Recent Outlet Supply Notes
          </h3>

          <button
            type="button"
            onClick={reconcile}
            disabled={loading || saving}
            className={
              "inline-flex items-center gap-2 " +
              "rounded-xl border border-slate-200 " +
              "px-4 py-2 text-sm font-semibold " +
              "disabled:opacity-50"
            }
          >
            <RefreshCw size={15} />
            Refresh History
          </button>

        </div>

        {loading && (
          <p className="mt-4 text-sm text-slate-500">
            Loading transfer history...
          </p>
        )}

        {!loading &&
          transfers.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No outlet supply notes have
              been recorded for this vehicle.
            </p>
          )}

        <div className="mt-4 overflow-x-auto">

          <table className="w-full min-w-[600px] text-left text-sm">

            <thead>
              <tr className="border-b bg-slate-50 text-slate-500">

                <th className="p-3">
                  Transfer Number
                </th>

                <th className="p-3">
                  Created Date
                </th>

                <th className="p-3">
                  Status
                </th>

                <th className="p-3 text-right">
                  Total Units
                </th>

              </tr>
            </thead>

            <tbody>

              {transfers.map((transfer) => {

                const total =
                  transfer.totalUnits ??
                  (
                    Array.isArray(transfer.items)
                      ? transfer.items.reduce(
                          (sum, item) =>
                            sum +
                            Number(
                              item.dispatchedQuantity ||
                              0
                            ),
                          0
                        )
                      : "—"
                  );

                return (
                  <tr
                    key={
                      transfer.id ||
                      transfer.transferNumber
                    }
                    className="border-b border-slate-100"
                  >

                    <td className="p-3 font-semibold">
                      {transfer.transferNumber ||
                        `#${transfer.id}`}
                    </td>

                    <td className="p-3">
                      {formatDateTime(
                        transfer.createdAt
                      )}
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

                    <td className="p-3 text-right font-semibold">
                      {total}
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>

      </div>

    </section>
  );
}
