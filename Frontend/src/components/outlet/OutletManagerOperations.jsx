
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ReceiptText,
  Wallet,
  Package,
  ArrowRightLeft,
  RefreshCw,
  ChartNoAxesCombined,
  ClipboardCheck,
  AlertTriangle,
  Search,
  IceCreamCone,
  ShoppingCart,
} from "lucide-react";

import OutletShiftControls from "./OutletShiftControls";

// =====================================================
// BACKEND CONFIGURATION
// =====================================================

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// =====================================================
// STYLES
// =====================================================

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-white px-4 py-3 text-sm outline-none " +
  "focus:border-[#3654FF]";

const buttonClass =
  "rounded-xl bg-[#3654FF] px-5 py-3 " +
  "text-sm font-bold text-white " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// =====================================================
// NEW: LOW STOCK ALERT CONFIGURATION
//
// 0 units   : OUT OF STOCK
// 1-4 units : CRITICAL STOCK
// 5-8 units : LOW STOCK
// 9+ units  : NORMAL
//
// Only checks FREEZER_1 selling stock.
// =====================================================

const LOW_STOCK_THRESHOLD = 8;
const CRITICAL_STOCK_THRESHOLD = 4;

// =====================================================
// CONE / WAFFLE CUP FLAVOURS
//
// Must match the backend's allowed flavours.
// =====================================================

const ICE_CREAM_FLAVOURS = [
  "Vanilla",
  "Chocolate",
  "Strawberry",
];

const MIXED_FLAVOUR_OPTIONS = [
  {
    value: "Vanilla|Chocolate",
    label: "Vanilla & Chocolate",
    flavours: ["Vanilla", "Chocolate"],
  },
  {
    value: "Vanilla|Strawberry",
    label: "Vanilla & Strawberry",
    flavours: ["Vanilla", "Strawberry"],
  },
];

// =====================================================
// GENERAL HELPERS
// =====================================================

function money(value) {
  return (
    "LKR " +
    Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

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

function productLabel(product) {
  if (!product) return "";

  const name = String(
    product.productName ||
    product.productId ||
    "Product"
  );

  const size = String(product.size || "").trim();
  const flavour = String(product.flavour || "").trim();

  return [
    size ? `${name} (${size})` : name,
    flavour,
  ]
    .filter(Boolean)
    .join(" – ");
}

function displayLocalDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-LK", {
        timeZone: "Asia/Colombo",
      });
}

function receivedItemName(item) {
  const name =
    item.productName ||
    item.productId ||
    "Product";

  return (
    `${name}` +
    `${item.size ? ` (${item.size})` : ""}` +
    `${item.flavour ? ` – ${item.flavour}` : ""}`
  );
}

function batchNumberOf(item) {
  return String(
    item?.batchNumber ??
    item?.batch_number ??
    ""
  ).trim();
}

function transferItemIdOf(item) {
  return Number(
    item?.transferItemId ??
    item?.itemId ??
    item?.id
  );
}

function toQuantity(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatQuantity(value) {
  return toQuantity(value).toLocaleString("en-LK");
}

function validPositiveId(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return false;
  }

  const number = Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  );
}

// =====================================================
// BATCH ID HELPERS
//
// freezerBatchStockId:
// outlet_freezer_batch_stock.id
//
// batchId:
// product_batches.id
//
// These are different IDs.
// =====================================================

function batchIdOf(item) {
  return (
    item?.freezerBatchStockId ??
    item?.freezer_batch_stock_id ??
    item?.batchStockId ??
    item?.batch_stock_id ??
    null
  );
}

function batchAvailable(item) {
  return toQuantity(
    item?.availableQuantity ??
    item?.batchQuantity ??
    item?.quantity
  );
}

function getInventoryBatches(row) {
  return Array.isArray(row?.batches)
    ? row.batches
    : [];
}

function cartKey(item) {
  return (
    `${item.stockId}:` +
    `${item.freezerBatchStockId}`
  );
}

// =====================================================
// CONE / CUP HELPERS
// =====================================================

function servingFlavourLabel(flavours) {
  return Array.isArray(flavours)
    ? flavours.join(" & ")
    : "";
}

function servingCartKey(item) {
  return (
    `${item.servingOptionId}:` +
    `${(item.flavours || []).join("|")}`
  );
}

function servingMode(option) {
  return String(
    option?.flavourMode || ""
  ).toUpperCase();
}

function servingScoopCount(option) {
  return Number(option?.scoopCount || 0);
}

function validServingSelection(option, flavours) {
  if (!option || !Array.isArray(flavours)) {
    return false;
  }

  const mode = servingMode(option);
  const scoopCount = servingScoopCount(option);

  if (
    !Number.isSafeInteger(scoopCount) ||
    scoopCount <= 0 ||
    flavours.length !== scoopCount ||
    flavours.some(
      (flavour) =>
        !ICE_CREAM_FLAVOURS.includes(flavour)
    )
  ) {
    return false;
  }

  if (mode === "SINGLE") {
    return scoopCount === 1;
  }

  if (mode === "MIXED") {
    return (
      scoopCount === 2 &&
      MIXED_FLAVOUR_OPTIONS.some(
        (combination) =>
          combination.flavours.join("|") ===
          flavours.join("|")
      )
    );
  }

  return mode === "ANY";
}

// =====================================================
// INVENTORY SEARCH HELPERS
// =====================================================

function matchesInventorySearch(product, search) {
  const query = String(search || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return true;
  }

  const batchNumbers = getInventoryBatches(product)
    .map((batch) => batchNumberOf(batch))
    .join(" ");

  const searchableText = [
    product.productName,
    product.productId,
    product.size,
    product.flavour,
    product.freezerCode,
    batchNumbers,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function matchesAggregateSearch(product, search) {
  const query = String(search || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return true;
  }

  const searchableText = [
    product.productName,
    product.productId,
    product.size,
    product.flavour,
    product.freezerCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

// =====================================================
// NORMALIZE BATCH INVENTORY
//
// Supports flat and grouped backend responses.
//
// No quality_status or expiry_date filtering.
// =====================================================

function normalizeBatchInventory(data) {
  if (!Array.isArray(data)) {
    throw new Error(
      "Batch inventory API must return an array."
    );
  }

  const groups = new Map();

  function normalizeBatch(batch) {
    return {
      ...batch,

      freezerBatchStockId: batchIdOf(batch),

      batchId:
        batch.batchId ??
        batch.batch_id ??
        null,

      batchNumber: batchNumberOf(batch),

      quantity: toQuantity(
        batch.batchQuantity ??
        batch.quantity ??
        batch.availableQuantity
      ),

      availableQuantity: batchAvailable(batch),
    };
  }

  function addBatch(group, rawBatch) {
    const batch = normalizeBatch(rawBatch);

    const stockBatchId =
      batch.freezerBatchStockId;

    const key = validPositiveId(stockBatchId)
      ? `stock-batch:${stockBatchId}`
      : (
          validPositiveId(batch.batchId)
            ? `batch:${batch.batchId}`
            : `number:${batch.batchNumber}`
        );

    if (
      !validPositiveId(stockBatchId) &&
      !validPositiveId(batch.batchId) &&
      !batch.batchNumber
    ) {
      return;
    }

    const existingIndex =
      group.batches.findIndex(
        (item) => item._key === key
      );

    const normalized = {
      ...batch,
      _key: key,
    };

    if (existingIndex >= 0) {
      group.batches[existingIndex] = normalized;
    } else {
      group.batches.push(normalized);
    }
  }

  for (const row of data) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const freezerCode = String(
      row.freezerCode ??
      row.freezer_code ??
      ""
    ).toUpperCase();

    const stockId =
      row.stockId ??
      row.freezerStockId ??
      row.freezer_stock_id ??
      null;

    if (
      !freezerCode ||
      !validPositiveId(stockId)
    ) {
      continue;
    }

    const groupKey =
      `${freezerCode}:${stockId}`;

    const totalQuantity = toQuantity(
      row.totalQuantity ??
      row.totalStock ??
      row.quantity ??
      row.stockQuantity
    );

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        ...row,

        stockId: Number(stockId),

        freezerCode,

        freezerName:
          row.freezerName ||
          row.freezer_name ||
          freezerCode,

        productId:
          row.productId ??
          row.product_id,

        productName:
          row.productName ||
          row.product_name ||
          row.productId ||
          "Unknown Product",

        size:
          row.size ??
          row.productSize ??
          "",

        flavour:
          row.flavour || "",

        totalQuantity,

        batches: [],
      });
    }

    const group = groups.get(groupKey);

    // Flat rows repeat the aggregate quantity.
    // Do not sum it once per production batch.

    group.totalQuantity = totalQuantity;

    if (Array.isArray(row.batches)) {
      for (const batch of row.batches) {
        addBatch(group, batch);
      }
    } else if (
      batchIdOf(row) != null ||
      row.batchId != null ||
      row.batch_id != null ||
      batchNumberOf(row)
    ) {
      addBatch(group, row);
    }
  }

  return [...groups.values()].map((group) => {
    const batches = [...group.batches]
      .sort((a, b) =>
        a.batchNumber.localeCompare(
          b.batchNumber,
          "en",
          { numeric: true }
        )
      )
      .map(({ _key, ...batch }) => batch);

    const allocatedQuantity =
      batches.reduce(
        (sum, batch) =>
          sum + batch.quantity,
        0
      );

    return {
      ...group,

      batches,

      allocatedQuantity,

      unallocatedQuantity:
        group.totalQuantity -
        allocatedQuantity,
    };
  });
}

// =====================================================
// COMMON RESPONSE HANDLING
// =====================================================

async function parseResponse(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseError(data, status, fallback) {
  if (status === 401) {
    return "Login expired. Please sign in again.";
  }

  if (status === 403) {
    return (
      "You do not have permission to " +
      "perform this operation."
    );
  }

  const message =
    data?.detail ||
    data?.message ||
    data?.error ||
    (
      typeof data === "string"
        ? data
        : null
    );

  if (
    message &&
    message !== "Not Found" &&
    message !== "Internal Server Error"
  ) {
    return message;
  }

  return `${fallback} (${status}).`;
}

function makeApiError(data, status, fallback) {
  const error = new Error(
    responseError(data, status, fallback)
  );

  error.status = status;

  return error;
}

// =====================================================
// OUTLET POS API
// =====================================================

async function api(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Please log in again.");
  }

  let response;

  try {
    response = await fetch(
      `${BASE_URL}/api/outlet/pos${path}`,
      {
        ...options,

        cache: "no-store",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",

          ...(options.body
            ? {
                "Content-Type": "application/json",
              }
            : {}),

          ...options.headers,
        },
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the Spring Boot server."
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw makeApiError(
      data,
      response.status,
      "Outlet POS request failed"
    );
  }

  return data;
}

// =====================================================
// OUTLET STOCK RECEIVING API
//
// Existing functionality preserved.
// =====================================================

async function outletSupplyApi(
  path,
  options = {}
) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Please sign in again to receive outlet stock."
    );
  }

  let response;

  try {
    response = await fetch(
      `${BASE_URL}/api/outlet/supply${path}`,
      {
        ...options,

        cache: "no-store",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",

          ...(options.body
            ? {
                "Content-Type": "application/json",
              }
            : {}),

          ...options.headers,
        },
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the stock receiving API."
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    if (
      response.status === 404 &&
      (
        data?.error === "Not Found" ||
        !data?.message
      )
    ) {
      const description =
        path === "/pending"
          ? "The pending transfer endpoint was not found."
          : path.endsWith("/receive")
            ? "The transfer receiving endpoint was not found."
            : "The transfer details endpoint was not found.";

      throw new Error(
        description +
        " Check OutletSupplyReceivingController mappings " +
        "and restart Spring Boot."
      );
    }

    throw makeApiError(
      data,
      response.status,
      "Stock receiving request failed"
    );
  }

  return data;
}

// =====================================================
// STOCK RECEIPTS COMPONENT
//
// EXISTING FUNCTIONALITY PRESERVED.
// =====================================================

function OutletSupplyReceipts({ onReceived }) {
  const [pending, setPending] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [received, setReceived] = useState({});
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const confirmationRef = useRef(null);
  const submittedPayloadRef = useRef(null);

  // ===================================================
  // LOAD PENDING TRANSFERS
  // ===================================================

  const loadPending = useCallback(async () => {
    setLoading(true);

    try {
      const result =
        await outletSupplyApi("/pending");

      if (!Array.isArray(result)) {
        throw new Error(
          "Pending transfer API must return an array."
        );
      }

      setPending(result);
      setError("");

      return result;
    } catch (err) {
      setError(
        err.message ||
        "Unable to retrieve pending transfer notes."
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // ===================================================
  // SELECT TRANSFER
  // ===================================================

  async function selectTransfer(id) {
    if (
      submitting ||
      submittedPayloadRef.current
    ) {
      return;
    }

    setSelectedId(String(id));
    setDetails(null);
    setReceived({});
    setNotes("");
    setError("");
    setMessage("");
    setDetailsLoading(true);

    confirmationRef.current = null;

    try {
      const result = await outletSupplyApi(
        `/transfers/${encodeURIComponent(id)}`
      );

      if (
        !result ||
        !Array.isArray(result.items)
      ) {
        throw new Error(
          "Transfer details must contain an items array."
        );
      }

      if (
        String(result.status).toUpperCase() !==
        "IN_TRANSIT"
      ) {
        throw new Error(
          "Only IN_TRANSIT transfer notes can be received."
        );
      }

      if (result.items.length === 0) {
        throw new Error(
          "The transfer note contains no items."
        );
      }

      const initial = {};

      for (const item of result.items) {
        const itemId =
          transferItemIdOf(item);

        const dispatched =
          Number(item.dispatchedQuantity);

        if (
          !Number.isSafeInteger(itemId) ||
          itemId <= 0 ||
          !Number.isSafeInteger(dispatched) ||
          dispatched <= 0 ||
          Object.prototype.hasOwnProperty.call(
            initial,
            itemId
          )
        ) {
          throw new Error(
            "Transfer note contains an invalid " +
            "or duplicate item."
          );
        }

        initial[itemId] =
          String(dispatched);
      }

      setDetails(result);
      setReceived(initial);
    } catch (err) {
      setError(
        err.message ||
        "Unable to open transfer note."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  // ===================================================
  // RECEIPT TOTALS
  // ===================================================

  const items =
    Array.isArray(details?.items)
      ? details.items
      : [];

  const dispatchedTotal = items.reduce(
    (sum, item) =>
      sum +
      Number(item.dispatchedQuantity || 0),
    0
  );

  const receivedTotal = items.reduce(
    (sum, item) =>
      sum +
      (
        Number(
          received[transferItemIdOf(item)]
        ) || 0
      ),
    0
  );

  const hasDiscrepancy = items.some((item) => {
    const raw =
      received[transferItemIdOf(item)];

    const entered = Number(raw);

    return (
      String(raw ?? "").trim() === "" ||
      !Number.isSafeInteger(entered) ||
      entered !==
        Number(item.dispatchedQuantity)
    );
  });

  // ===================================================
  // CONFIRM STOCK RECEIPT
  // ===================================================

  async function confirmReceipt() {
    if (!details || submitting) return;

    const transferId = Number(
      details.transferId ??
      details.id ??
      selectedId
    );

    if (
      !Number.isSafeInteger(transferId) ||
      transferId <= 0
    ) {
      setError(
        "Invalid transfer note ID."
      );
      return;
    }

    if (!submittedPayloadRef.current) {
      for (const item of items) {
        const itemId =
          transferItemIdOf(item);

        const raw = received[itemId];

        const count = Number(raw);

        const dispatched =
          Number(item.dispatchedQuantity);

        if (
          String(raw ?? "").trim() === "" ||
          !Number.isSafeInteger(count) ||
          count < 0 ||
          count > dispatched
        ) {
          setError(
            "Each received quantity must be a whole " +
            "number between zero and the dispatched quantity."
          );
          return;
        }

        if (count !== dispatched) {
          setError(
            `Batch ${batchNumberOf(item) || "Unknown"} ` +
            `has ${count} received units, but ` +
            `${dispatched} were dispatched. ` +
            "The current backend only confirms full receipts."
          );

          return;
        }
      }
    }

    const confirmationMessage =
      submittedPayloadRef.current
        ? (
            "Retry the previous stock receipt?\n\n" +
            "The identical request will be sent. " +
            "Spring Boot must prevent duplicate stock increases."
          )
        : (
            `Confirm receipt of ${receivedTotal} of ` +
            `${dispatchedTotal} dispatched units ` +
            "into Defreezer 2?\n\n" +
            "Verify the product, production batches " +
            "and physical quantities first."
          );

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    if (!confirmationRef.current) {
      confirmationRef.current =
        crypto.randomUUID();
    }

    const payload =
      submittedPayloadRef.current ||
      JSON.stringify({
        receiptKey:
          confirmationRef.current,

        items: items.map((item) => ({
          transferItemId:
            transferItemIdOf(item),

          receivedQuantity:
            Number(
              received[
                transferItemIdOf(item)
              ]
            ),
        })),

        notes: notes.trim(),
      });

    submittedPayloadRef.current = payload;

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
        (err.message ||
          "Unable to confirm stock receipt.") +
        " Check transfer status before retrying. " +
        "If already saved, Spring Boot must not " +
        "credit stock twice."
      );

      setSubmitting(false);
      return;
    }

    confirmationRef.current = null;
    submittedPayloadRef.current = null;

    setDetails(null);
    setSelectedId("");
    setReceived({});
    setNotes("");

    setMessage(
      `Stock receipt ${
        result?.transferNumber ||
        details.transferNumber ||
        `#${transferId}`
      } confirmed successfully. ` +
      `${result?.totalReceivedUnits ?? receivedTotal} ` +
      "units were received into Defreezer 2."
    );

    try {
      await loadPending();
    } catch (refreshError) {
      console.warn(
        "Receipt saved but pending refresh failed:",
        refreshError
      );
    }

    try {
      await onReceived?.();
    } catch (refreshError) {
      console.warn(
        "Receipt saved but inventory refresh failed:",
        refreshError
      );
    }

    setSubmitting(false);
  }

  // ===================================================
  // STOCK RECEIPTS UI
  // ===================================================

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ClipboardCheck size={21} />
            Stock Receipts — Defreezer 2
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Verify production batches and physical quantities
            before receiving stock from the Sales Manager's vehicle.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || submitting}
          onClick={loadPending}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          Refresh Pending
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertTriangle
            size={17}
            className="shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">
          Pending Stock Transfer Notes
        </h3>

        {loading ? (
          <p className="mt-3 text-sm text-slate-500">
            Loading pending transfers...
          </p>
        ) : pending.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No transfers are awaiting receipt.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3">Transfer Note</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Dispatched</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {pending.map((row) => {
                  const id =
                    row.transferId ?? row.id;

                  return (
                    <tr
                      key={id}
                      className="border-t border-slate-100"
                    >
                      <td className="p-3 font-semibold">
                        {row.transferNumber || `#${id}`}
                      </td>

                      <td className="p-3">
                        {row.vehicleNumber ||
                          row.sourceVehicleNumber ||
                          "Sales Vehicle"}
                      </td>

                      <td className="p-3">
                        {displayLocalDateTime(
                          row.dispatchedAt ||
                          row.createdAt
                        )}
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          disabled={
                            submitting ||
                            detailsLoading ||
                            Boolean(
                              submittedPayloadRef.current
                            )
                          }
                          onClick={() =>
                            selectTransfer(id)
                          }
                          className={buttonClass}
                        >
                          Check & Receive
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailsLoading && (
        <p className="text-sm text-slate-500">
          Loading transfer details...
        </p>
      )}

      {details && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-bold">
              Receive{" "}
              {details.transferNumber ||
                `#${selectedId}`}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Destination: Defreezer 2.
              Verify each product and batch
              against the physical delivery.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3">
                    Product / Size / Flavour
                  </th>

                  <th className="p-3">
                    Production Batch
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
                  const itemId =
                    transferItemIdOf(item);

                  return (
                    <tr
                      key={itemId}
                      className="border-t border-slate-100"
                    >
                      <td className="p-3 font-semibold">
                        {receivedItemName(item)}
                      </td>

                      <td className="p-3">
                        {batchNumberOf(item) ||
                          item.batch?.batchNumber ||
                          "—"}
                      </td>

                      <td className="p-3 text-right">
                        {item.dispatchedQuantity}
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={item.dispatchedQuantity}
                          step="1"
                          required
                          value={
                            received[itemId] ?? ""
                          }
                          disabled={
                            submitting ||
                            Boolean(
                              submittedPayloadRef.current
                            )
                          }
                          onChange={(event) =>
                            setReceived((previous) => ({
                              ...previous,
                              [itemId]: event.target.value,
                            }))
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

          <div className="flex justify-between rounded-xl bg-blue-50 p-4 text-sm font-bold">
            <span>
              Received / Dispatched Units
            </span>

            <span>
              {receivedTotal} / {dispatchedTotal}
            </span>
          </div>

          {hasDiscrepancy && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Received quantities do not match
              dispatched quantities. The current
              receiving service requires a complete
              receipt. Investigate the discrepancy first.
            </p>
          )}

          <label className="block space-y-2 text-sm font-semibold">
            <span>Receiving Notes</span>

            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              disabled={
                submitting ||
                Boolean(
                  submittedPayloadRef.current
                )
              }
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Physical count, damaged packages or receiving notes..."
              className={inputClass}
            />
          </label>

          <button
            type="button"
            disabled={
              submitting ||
              detailsLoading ||
              (
                hasDiscrepancy &&
                !submittedPayloadRef.current
              )
            }
            onClick={confirmReceipt}
            className={buttonClass + " w-full"}
          >
            {submitting
              ? "Confirming Receipt..."
              : submittedPayloadRef.current
                ? "Retry Same Receipt"
                : "Confirm Receipt Into Defreezer 2"}
          </button>

          {submittedPayloadRef.current && (
            <p className="text-sm text-amber-700">
              A previous receipt response is uncertain.
              Verify its status before retrying.
              The same request is retained.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// =====================================================
// MAIN OUTLET MANAGER OPERATIONS
// =====================================================

export default function OutletManagerOperations({
  onLogout,
}) {

  // ===================================================
  // EXISTING STATE
  // ===================================================

  const [tab, setTab] = useState("Billing");

  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [batchInventory, setBatchInventory] =
    useState([]);

  const [batchLoading, setBatchLoading] =
    useState(false);

  const [batchError, setBatchError] =
    useState("");

  const [report, setReport] = useState(null);

  // ===================================================
  // INVENTORY SEARCH STATE - PRESERVED
  // ===================================================

  const [
    inventorySearch,
    setInventorySearch,
  ] = useState("");

  const [
    inventoryFreezerFilter,
    setInventoryFreezerFilter,
  ] = useState("ALL");

  // ===================================================
  // PACKAGED RETAIL BILLING STATE - PRESERVED
  // ===================================================

  const [selectedStockId, setSelectedStockId] =
    useState("");

  const [
    selectedBatchStockId,
    setSelectedBatchStockId,
  ] = useState("");

  const [quantity, setQuantity] = useState("1");

  const [cart, setCart] = useState([]);

  // ===================================================
  // CONE / WAFFLE CUP BILLING STATE - PRESERVED
  //
  // Menu prices come from Spring Boot:
  // GET /api/outlet/pos/serving-options
  // ===================================================

  const [billingCategory, setBillingCategory] =
    useState("PACKAGED");

  const [servingOptions, setServingOptions] =
    useState([]);

  const [servingLoading, setServingLoading] =
    useState(false);

  const [servingError, setServingError] =
    useState("");

  const [
    selectedServingOptionId,
    setSelectedServingOptionId,
  ] = useState("");

  const [
    servingFlavours,
    setServingFlavours,
  ] = useState([]);

  const [
    servingQuantity,
    setServingQuantity,
  ] = useState("1");

  const [servingCart, setServingCart] =
    useState([]);

  // ===================================================
  // FREEZER TRANSFER STATE - PRESERVED
  // ===================================================

  const [transferStockId, setTransferStockId] =
    useState("");

  const [
    transferBatchStockId,
    setTransferBatchStockId,
  ] = useState("");

  const [
    transferQuantity,
    setTransferQuantity,
  ] = useState("1");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ===================================================
  // IDEMPOTENCY - PRESERVED
  // ===================================================

  const receiptKeyRef =
    useRef(crypto.randomUUID());

  const pendingSaleRef =
    useRef(null);

  // ===================================================
  // LOAD BATCH INVENTORY
  // ===================================================

  const loadBatchInventory = useCallback(
    async () => {
      setBatchLoading(true);
      setBatchError("");

      try {
        const result =
          await api("/batch-inventory");

        const normalized =
          normalizeBatchInventory(result);

        setBatchInventory(normalized);

        return normalized;
      } catch (err) {
        setBatchInventory([]);

        setBatchError(
          err?.message ||
          "Unable to load production batch inventory."
        );

        return null;
      } finally {
        setBatchLoading(false);
      }
    },
    []
  );

  // ===================================================
  // LOAD CONES AND WAFFLE CUPS - PRESERVED
  // ===================================================

  const loadServingOptions = useCallback(
    async () => {
      setServingLoading(true);
      setServingError("");

      try {
        const result =
          await api("/serving-options");

        if (!Array.isArray(result)) {
          throw new Error(
            "Serving options API must return an array."
          );
        }

        setServingOptions(result);

        return result;
      } catch (err) {
        setServingError(
          err.message ||
          "Unable to load cones and waffle cups."
        );

        return null;
      } finally {
        setServingLoading(false);
      }
    },
    []
  );

  // ===================================================
  // LOAD EXISTING POS DATA
  //
  // Also refreshes:
  // - Packaged inventory
  // - Production batches
  // - Cone/cup menu
  // - Daily report
  //
  // NEW:
  // Low stock alerts automatically update
  // when inventory state is refreshed.
  // ===================================================

  const load = useCallback(async () => {
    setLoading(true);

    const batchPromise =
      loadBatchInventory();

    const servingPromise =
      loadServingOptions();

    try {
      const [
        productData,
        inventoryData,
        reportData,
      ] = await Promise.all([
        api("/products"),
        api("/inventory"),
        api("/daily-report"),
      ]);

      if (
        !Array.isArray(productData) ||
        !Array.isArray(inventoryData)
      ) {
        throw new Error(
          "Invalid POS inventory or products response."
        );
      }

      setProducts(productData);
      setInventory(inventoryData);
      setReport(reportData);
      setError("");
    } catch (err) {
      setError(
        err.message ||
        "Unable to load outlet data."
      );
    } finally {
      await Promise.all([
        batchPromise,
        servingPromise,
      ]);

      setLoading(false);
    }
  }, [
    loadBatchInventory,
    loadServingOptions,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // ===================================================
  // SELECTED PACKAGED PRODUCT
  // ===================================================

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          String(product.stockId) ===
          String(selectedStockId)
      ),
    [products, selectedStockId]
  );

  // ===================================================
  // FREEZER INVENTORY
  // ===================================================

  const freezer1 = useMemo(
    () =>
      inventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_1"
      ),
    [inventory]
  );

  const freezer2 = useMemo(
    () =>
      inventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_2"
      ),
    [inventory]
  );

  // ===================================================
  // NEW: LOW STOCK ALERT CALCULATION
  //
  // Only FREEZER_1 selling stock.
  //
  // Uses existing:
  // GET /api/outlet/pos/inventory
  //
  // Checks each product/flavour stock row.
  // Does not modify any database quantities.
  //
  // 0       = OUT OF STOCK
  // 1 - 4   = CRITICAL STOCK
  // 5 - 8   = LOW STOCK
  // 9+      = NORMAL
  // ===================================================

  const lowStockProducts = useMemo(() => {

    return freezer1
      .filter((product) => {

        const rawQuantity =
          product.quantity;

        if (
          rawQuantity === null ||
          rawQuantity === undefined ||
          String(rawQuantity).trim() === ""
        ) {
          return false;
        }

        const currentQuantity =
          Number(rawQuantity);

        return (
          Number.isFinite(currentQuantity) &&
          currentQuantity >= 0 &&
          currentQuantity <= LOW_STOCK_THRESHOLD
        );
      })
      .map((product) => {

        const remainingQuantity =
          Number(product.quantity);

        let stockStatus = "LOW STOCK";

        if (remainingQuantity === 0) {
          stockStatus = "OUT OF STOCK";
        } else if (
          remainingQuantity <=
          CRITICAL_STOCK_THRESHOLD
        ) {
          stockStatus = "CRITICAL STOCK";
        }

        return {
          ...product,

          remainingQuantity,

          stockStatus,
        };
      })
      .sort(
        (a, b) =>
          a.remainingQuantity -
          b.remainingQuantity
      );

  }, [freezer1]);

  // ===================================================
  // NEW: LOW STOCK SUMMARY COUNTS
  // ===================================================

  const lowStockCount =
    lowStockProducts.length;

  const outOfStockCount =
    lowStockProducts.filter(
      (product) =>
        product.stockStatus === "OUT OF STOCK"
    ).length;

  const criticalStockCount =
    lowStockProducts.filter(
      (product) =>
        product.stockStatus === "CRITICAL STOCK"
    ).length;

  const warningStockCount =
    lowStockProducts.filter(
      (product) =>
        product.stockStatus === "LOW STOCK"
    ).length;

  // ===================================================
  // BATCH INVENTORY BY FREEZER
  // ===================================================

  const freezer1Batches = useMemo(
    () =>
      batchInventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_1"
      ),
    [batchInventory]
  );

  const freezer2Batches = useMemo(
    () =>
      batchInventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_2"
      ),
    [batchInventory]
  );

  // ===================================================
  // INVENTORY SEARCH - PRESERVED
  // ===================================================

  const filteredInventory = useMemo(() => {
    return batchInventory.filter((product) => {
      const matchesFreezer =
        inventoryFreezerFilter === "ALL" ||
        product.freezerCode ===
          inventoryFreezerFilter;

      return (
        matchesFreezer &&
        matchesInventorySearch(
          product,
          inventorySearch
        )
      );
    });
  }, [
    batchInventory,
    inventorySearch,
    inventoryFreezerFilter,
  ]);

  const filteredFreezer1 = useMemo(
    () =>
      filteredInventory.filter(
        (product) =>
          product.freezerCode === "FREEZER_1"
      ),
    [filteredInventory]
  );

  const filteredFreezer2 = useMemo(
    () =>
      filteredInventory.filter(
        (product) =>
          product.freezerCode === "FREEZER_2"
      ),
    [filteredInventory]
  );

  const filteredAggregateInventory =
    useMemo(
      () =>
        inventory.filter((product) => {
          const matchesFreezer =
            inventoryFreezerFilter === "ALL" ||
            product.freezerCode ===
              inventoryFreezerFilter;

          return (
            matchesFreezer &&
            matchesAggregateSearch(
              product,
              inventorySearch
            )
          );
        }),
      [
        inventory,
        inventorySearch,
        inventoryFreezerFilter,
      ]
    );

  const filteredAggregateFreezer1 = useMemo(
    () =>
      filteredAggregateInventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_1"
      ),
    [filteredAggregateInventory]
  );

  const filteredAggregateFreezer2 = useMemo(
    () =>
      filteredAggregateInventory.filter(
        (row) =>
          row.freezerCode === "FREEZER_2"
      ),
    [filteredAggregateInventory]
  );

  const visibleInventoryCount = batchError
    ? filteredAggregateInventory.length
    : filteredInventory.length;

  const totalInventoryCount = batchError
    ? inventory.length
    : batchInventory.length;

  // ===================================================
  // SELECTED PACKAGED PRODUCT BATCH
  // ===================================================

  const selectedProductBatchData = useMemo(
    () =>
      freezer1Batches.find(
        (row) =>
          String(row.stockId) ===
          String(selectedStockId)
      ),
    [freezer1Batches, selectedStockId]
  );

  const selectedProductBatches = useMemo(
    () =>
      getInventoryBatches(
        selectedProductBatchData
      ).filter(
        (batch) =>
          validPositiveId(batchIdOf(batch)) &&
          batchAvailable(batch) > 0
      ),
    [selectedProductBatchData]
  );

  const selectedBatch = useMemo(
    () =>
      selectedProductBatches.find(
        (batch) =>
          String(batchIdOf(batch)) ===
          String(selectedBatchStockId)
      ),
    [
      selectedProductBatches,
      selectedBatchStockId,
    ]
  );

  const selectedBatchAlreadyAdded = useMemo(
    () =>
      cart
        .filter(
          (item) =>
            String(item.stockId) ===
              String(selectedStockId) &&
            String(item.freezerBatchStockId) ===
              String(selectedBatchStockId)
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.quantity),
          0
        ),
    [
      cart,
      selectedStockId,
      selectedBatchStockId,
    ]
  );

  const selectedBatchRemaining = Math.max(
    0,
    batchAvailable(selectedBatch) -
      selectedBatchAlreadyAdded
  );

  // ===================================================
  // SELECTED CONE / WAFFLE CUP OPTION
  // ===================================================

  const selectedServingOption = useMemo(
    () =>
      servingOptions.find(
        (option) =>
          String(option.id) ===
          String(selectedServingOptionId)
      ),
    [
      servingOptions,
      selectedServingOptionId,
    ]
  );

  const selectedServingValid =
    validServingSelection(
      selectedServingOption,
      servingFlavours
    );

  const servingLineTotal =
    Number(
      selectedServingOption?.unitPrice || 0
    ) * Number(servingQuantity || 0);

  // ===================================================
  // FREEZER 2 BATCH SELECTION - PRESERVED
  // ===================================================

  const selectedTransferProduct = useMemo(
    () =>
      freezer2.find(
        (row) =>
          String(row.stockId) ===
          String(transferStockId)
      ),
    [freezer2, transferStockId]
  );

  const selectedTransferBatchData = useMemo(
    () =>
      freezer2Batches.find(
        (row) =>
          String(row.stockId) ===
          String(transferStockId)
      ),
    [freezer2Batches, transferStockId]
  );

  const transferAvailableBatches = useMemo(
    () =>
      getInventoryBatches(
        selectedTransferBatchData
      ).filter(
        (batch) =>
          validPositiveId(batchIdOf(batch)) &&
          batchAvailable(batch) > 0
      ),
    [selectedTransferBatchData]
  );

  const selectedTransferBatch = useMemo(
    () =>
      transferAvailableBatches.find(
        (batch) =>
          String(batchIdOf(batch)) ===
          String(transferBatchStockId)
      ),
    [
      transferAvailableBatches,
      transferBatchStockId,
    ]
  );

  // ===================================================
  // COMBINED CART TOTAL - PRESERVED
  //
  // Packaged + Cones / Waffle Cups.
  // ===================================================

  const packagedCartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.unitPrice) *
          Number(item.quantity),
        0
      ),
    [cart]
  );

  const servingCartTotal = useMemo(
    () =>
      servingCart.reduce(
        (sum, item) =>
          sum +
          Number(item.unitPrice) *
          Number(item.quantity),
        0
      ),
    [servingCart]
  );

  const cartTotal =
    packagedCartTotal + servingCartTotal;

  const hasBillItems =
    cart.length > 0 ||
    servingCart.length > 0;

  // ===================================================
  // ADD PACKAGED BATCH TO CART - PRESERVED
  // ===================================================

  function addToCart(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      saving ||
      loading ||
      pendingSaleRef.current
    ) {
      return;
    }

    if (!selectedProduct) {
      setError(
        "Select a product from Defreezer 1."
      );
      return;
    }

    if (!selectedBatch) {
      setError(
        "Select an available production batch number."
      );
      return;
    }

    const count = Number(quantity);

    if (
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      setError(
        "Enter a positive whole-number quantity."
      );
      return;
    }

    const freezerBatchStockId =
      Number(batchIdOf(selectedBatch));

    if (!validPositiveId(freezerBatchStockId)) {
      setError(
        "The selected batch has no valid " +
        "freezer batch stock ID. " +
        "Check the batch-inventory API."
      );
      return;
    }

    const existing = cart.find(
      (item) =>
        String(item.stockId) ===
          String(selectedProduct.stockId) &&
        Number(item.freezerBatchStockId) ===
          freezerBatchStockId
    );

    const alreadyAdded =
      existing?.quantity || 0;

    const available =
      batchAvailable(selectedBatch);

    if (
      count + alreadyAdded >
      available
    ) {
      setError(
        `Insufficient stock in batch ` +
        `${batchNumberOf(selectedBatch)}. ` +
        `Available to add: ${selectedBatchRemaining}.`
      );
      return;
    }

    const alreadyAddedForProduct = cart
      .filter(
        (item) =>
          String(item.stockId) ===
          String(selectedProduct.stockId)
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.quantity),
        0
      );

    if (
      count + alreadyAddedForProduct >
      Number(selectedProduct.availableQuantity)
    ) {
      setError(
        "Total selected quantity exceeds " +
        "Defreezer 1 product stock."
      );
      return;
    }

    setCart((previous) => {
      if (existing) {
        return previous.map((item) =>
          String(item.stockId) ===
            String(selectedProduct.stockId) &&
          Number(item.freezerBatchStockId) ===
            freezerBatchStockId
            ? {
                ...item,
                quantity:
                  item.quantity + count,
              }
            : item
        );
      }

      return [
        ...previous,
        {
          stockId:
            Number(selectedProduct.stockId),

          productId:
            selectedProduct.productId,

          productName:
            selectedProduct.productName,

          size:
            selectedProduct.size || "",

          flavour:
            selectedProduct.flavour,

          freezerBatchStockId,

          batchId:
            selectedBatch.batchId,

          batchNumber:
            batchNumberOf(selectedBatch),

          quantity: count,

          unitPrice:
            Number(selectedProduct.unitPrice),
        },
      ];
    });

    setQuantity("1");

    setMessage(
      `Batch ${batchNumberOf(selectedBatch)} ` +
      "added to the current order."
    );
  }

  // ===================================================
  // CHANGE CONE / WAFFLE CUP SELECTION
  // ===================================================

  function selectServingOption(optionId) {
    setSelectedServingOptionId(optionId);
    setServingFlavours([]);
    setServingQuantity("1");
    setError("");
    setMessage("");
  }

  // ===================================================
  // SELECT INDIVIDUAL SCOOP FLAVOUR
  // ===================================================

  function changeScoopFlavour(index, flavour) {
    if (!selectedServingOption) {
      return;
    }

    const scoopCount =
      servingScoopCount(selectedServingOption);

    setServingFlavours((previous) =>
      Array.from(
        { length: scoopCount },
        (_, position) =>
          position === index
            ? flavour
            : previous[position] || ""
      )
    );
  }

  // ===================================================
  // ADD CONE / WAFFLE CUP TO CART - PRESERVED
  //
  // No freezer or batch stock is deducted.
  // ===================================================

  function addServingToCart(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      saving ||
      loading ||
      servingLoading ||
      pendingSaleRef.current
    ) {
      return;
    }

    if (servingError) {
      setError(
        "Unable to verify cone and waffle cup menu. " +
        "Refresh the menu before adding servings."
      );
      return;
    }

    if (!selectedServingOption) {
      setError(
        "Select a cone or waffle cup type."
      );
      return;
    }

    if (!selectedServingValid) {
      setError(
        "Select the required flavour or flavour " +
        "combination for this cone or cup."
      );
      return;
    }

    const count = Number(servingQuantity);

    if (
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      setError(
        "Enter a positive whole-number serving quantity."
      );
      return;
    }

    if (!validPositiveId(selectedServingOption.id)) {
      setError(
        "The selected serving option is invalid."
      );
      return;
    }

    const unitPrice =
      Number(selectedServingOption.unitPrice);

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      setError(
        "The selected cone or cup price is invalid."
      );
      return;
    }

    const newItem = {
      servingOptionId:
        Number(selectedServingOption.id),

      code:
        selectedServingOption.code,

      name:
        selectedServingOption.name,

      cornType:
        selectedServingOption.cornType,

      flavourMode:
        selectedServingOption.flavourMode,

      scoopCount:
        Number(selectedServingOption.scoopCount),

      flavours:
        [...servingFlavours],

      quantity: count,

      unitPrice,
    };

    const key = servingCartKey(newItem);

    const existing = servingCart.find(
      (item) =>
        servingCartKey(item) === key
    );

    if (
      existing &&
      !Number.isSafeInteger(
        Number(existing.quantity) + count
      )
    ) {
      setError(
        "Total serving quantity is too large."
      );
      return;
    }

    setServingCart((previous) => {
      if (existing) {
        return previous.map((item) =>
          servingCartKey(item) === key
            ? {
                ...item,
                quantity:
                  Number(item.quantity) + count,
              }
            : item
        );
      }

      return [
        ...previous,
        newItem,
      ];
    });

    setServingQuantity("1");
    setServingFlavours([]);

    setMessage(
      `${selectedServingOption.name} ` +
      "added to the current order."
    );
  }

  // ===================================================
  // VALIDATE PACKAGED CART BEFORE CHECKOUT
  // ===================================================

  function validatePackagedCart() {
    if (cart.length === 0) {
      return true;
    }

    if (batchLoading || batchError) {
      setError(
        "Production batch inventory is unavailable. " +
        "Refresh before completing the packaged sale."
      );
      return false;
    }

    const totalsByStock = new Map();

    for (const item of cart) {
      if (
        !validPositiveId(item.stockId) ||
        !validPositiveId(
          item.freezerBatchStockId
        ) ||
        !Number.isSafeInteger(
          Number(item.quantity)
        ) ||
        Number(item.quantity) <= 0
      ) {
        setError(
          "One of the packaged bill items has an invalid " +
          "product, batch or quantity. Remove it " +
          "and select the batch again."
        );
        return false;
      }

      const product = products.find(
        (row) =>
          String(row.stockId) ===
          String(item.stockId)
      );

      const batchGroup =
        freezer1Batches.find(
          (row) =>
            String(row.stockId) ===
            String(item.stockId)
        );

      const batch =
        getInventoryBatches(
          batchGroup
        ).find(
          (row) =>
            String(batchIdOf(row)) ===
            String(item.freezerBatchStockId)
        );

      if (!product || !batch) {
        setError(
          "A selected product batch is no longer " +
          "available. Refresh stock and review the bill."
        );
        return false;
      }

      const batchCartQuantity = cart
        .filter(
          (row) =>
            String(row.stockId) ===
              String(item.stockId) &&
            String(row.freezerBatchStockId) ===
              String(item.freezerBatchStockId)
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.quantity),
          0
        );

      if (
        batchCartQuantity >
        batchAvailable(batch)
      ) {
        setError(
          `Insufficient available units in batch ` +
          `${item.batchNumber}. ` +
          "Refresh stock and review the bill."
        );
        return false;
      }

      const key = String(item.stockId);

      totalsByStock.set(
        key,
        (
          totalsByStock.get(key) || 0
        ) + Number(item.quantity)
      );
    }

    for (const [stockId, count] of totalsByStock) {
      const product = products.find(
        (row) =>
          String(row.stockId) === stockId
      );

      if (
        !product ||
        count >
        Number(product.availableQuantity)
      ) {
        setError(
          "Available packaged product stock has changed. " +
          "Refresh inventory and review the bill."
        );
        return false;
      }
    }

    return true;
  }

  // ===================================================
  // VALIDATE SERVING CART BEFORE CHECKOUT
  // ===================================================

  function validateServingCart() {
    if (servingCart.length === 0) {
      return true;
    }

    if (servingLoading || servingError) {
      setError(
        "The cone and waffle cup menu is unavailable. " +
        "Refresh before completing the sale."
      );
      return false;
    }

    for (const item of servingCart) {
      const option = servingOptions.find(
        (row) =>
          String(row.id) ===
          String(item.servingOptionId)
      );

      if (
        !option ||
        !validPositiveId(item.servingOptionId) ||
        !Number.isSafeInteger(
          Number(item.quantity)
        ) ||
        Number(item.quantity) <= 0
      ) {
        setError(
          "A cone or waffle cup item is no longer " +
          "valid. Refresh the menu and review the bill."
        );
        return false;
      }

      if (
        !validServingSelection(
          option,
          item.flavours
        )
      ) {
        setError(
          "Invalid flavour combination for " +
          `${option.name}.`
        );
        return false;
      }

      if (
        Number(option.unitPrice) !==
        Number(item.unitPrice)
      ) {
        setError(
          `The price of ${option.name} has changed. ` +
          "Remove the old item and add it again " +
          "using the updated menu price."
        );
        return false;
      }
    }

    return true;
  }

  // ===================================================
  // COMPLETE COMBINED RETAIL SALE
  //
  // Packaged products:
  // Deduct selected production batch stock.
  //
  // Cones / cups:
  // NO FREEZER STOCK DEDUCTION.
  //
  // Low stock alerts recalculate after
  // the inventory refresh on success.
  // ===================================================

  async function completeSale() {
    if (
      saving ||
      !hasBillItems
    ) {
      return;
    }

    setError("");

    const pendingPayload =
      pendingSaleRef.current;

    if (!pendingPayload) {
      if (!validatePackagedCart()) {
        return;
      }

      if (!validateServingCart()) {
        return;
      }
    }

    const serialized =
      pendingPayload ||
      JSON.stringify({
        receiptKey:
          receiptKeyRef.current,

        paymentMethod: "CASH",

        items: cart.map((item) => ({
          stockId:
            Number(item.stockId),

          freezerBatchStockId:
            Number(item.freezerBatchStockId),

          quantity:
            Number(item.quantity),
        })),

        servingItems: servingCart.map((item) => ({
          servingOptionId:
            Number(item.servingOptionId),

          flavours:
            [...item.flavours],

          quantity:
            Number(item.quantity),
        })),
      });

    const packagedSummary = cart.map(
      (item) =>
        `${productLabel(item)}\n` +
        `Batch ${item.batchNumber}: ` +
        `${item.quantity} units`
    );

    const servingSummary = servingCart.map(
      (item) =>
        `${item.name}\n` +
        `Flavours: ${servingFlavourLabel(item.flavours)}\n` +
        `Quantity: ${item.quantity}`
    );

    const confirmText = pendingPayload
      ? (
          "Retry the previous retail sale " +
          "using the same receipt key and items?"
        )
      : (
          `Complete retail sale for ${money(cartTotal)}?\n\n` +
          [
            ...packagedSummary,
            ...servingSummary,
          ].join("\n\n") +
          "\n\nPayment Method: CASH"
        );

    if (!window.confirm(confirmText)) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    pendingSaleRef.current =
      serialized;

    let result;

    try {
      result = await api(
        "/sales",
        {
          method: "POST",
          body: serialized,
        }
      );
    } catch (err) {

      if (
        err.status === 400 ||
        err.status === 403
      ) {
        pendingSaleRef.current = null;

        setError(
          (err.message ||
            "Retail sale was rejected.") +
          " Review the selected products, batches, " +
          "serving options and flavours."
        );
      } else {
        setError(
          (err.message ||
            "Unable to save retail sale.") +
          " Check Recent Sales before retrying. " +
          "The original receipt key is retained."
        );
      }

      setSaving(false);
      return;
    }

    // Clear both carts only after success.

    setCart([]);
    setServingCart([]);

    setSelectedStockId("");
    setSelectedBatchStockId("");
    setQuantity("1");

    setSelectedServingOptionId("");
    setServingFlavours([]);
    setServingQuantity("1");

    pendingSaleRef.current = null;

    receiptKeyRef.current =
      crypto.randomUUID();

    try {
      await load();
    } catch (refreshError) {
      console.warn(
        "Retail sale saved but refresh failed:",
        refreshError
      );
    }

    setError("");

    setMessage(
      `Bill #${result?.saleId ?? "—"} saved. ` +
      `Total: ${money(result?.totalAmount ?? cartTotal)}. ` +
      `Payment status: ${result?.paymentStatus || "UNKNOWN"}. ` +
      "Packaged stock is handled by production batch. " +
      "Cone and waffle cup sales do not deduct freezer stock."
    );

    setSaving(false);
  }

  // ===================================================
  // TRANSFER SELECTED BATCH - PRESERVED
  //
  // DEFREEZER 2 -> DEFREEZER 1
  //
  // Low stock alerts update after transfer
  // when inventory is refreshed.
  // ===================================================

  async function transferStock(event) {
    event.preventDefault();

    if (saving || loading) {
      return;
    }

    setError("");
    setMessage("");

    const count =
      Number(transferQuantity);

    if (!selectedTransferProduct) {
      setError(
        "Select a product from Defreezer 2."
      );
      return;
    }

    if (!selectedTransferBatch) {
      setError(
        "Select an available production batch " +
        "from Defreezer 2."
      );
      return;
    }

    const aggregateAvailable =
      toQuantity(
        selectedTransferProduct.availableQuantity ??
        selectedTransferProduct.quantity
      );

    const available =
      batchAvailable(
        selectedTransferBatch
      );

    const sourceBatchStockId =
      Number(
        batchIdOf(
          selectedTransferBatch
        )
      );

    if (
      !validPositiveId(sourceBatchStockId) ||
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      count > available ||
      count > aggregateAvailable
    ) {
      setError(
        "Invalid quantity for the selected " +
        "production batch. " +
        `Batch available: ${available}.`
      );
      return;
    }

    const batchNumber =
      batchNumberOf(
        selectedTransferBatch
      );

    if (
      !window.confirm(
        `Transfer ${count} units of ` +
        `${productLabel(selectedTransferProduct)}\n` +
        `Batch: ${batchNumber}\n\n` +
        "From Defreezer 2 to Defreezer 1?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await api(
        "/transfers",
        {
          method: "POST",

          body: JSON.stringify({
            sourceStockId:
              Number(transferStockId),

            sourceBatchStockId,

            quantity: count,
          }),
        }
      );

      setTransferStockId("");
      setTransferBatchStockId("");
      setTransferQuantity("1");

      await load();

      setMessage(
        `${count} units of batch ${batchNumber} ` +
        "transferred to Defreezer 1."
      );
    } catch (err) {
      setError(
        (err.message ||
          "Unable to transfer stock.") +
        " Check stock and transfer records before retrying. " +
        "Do not repeat an uncertain transfer blindly."
      );
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // AGGREGATE INVENTORY FALLBACK - PRESERVED
  // ===================================================

  function stockTable(rows) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[550px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Flavour</th>
              <th className="p-4 text-right">
                Quantity
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.stockId}
                className="border-t border-slate-100"
              >
                <td className="p-4 font-semibold">
                  {row.productName}
                  {row.size
                    ? ` (${row.size})`
                    : ""}
                </td>

                <td className="p-4">
                  {row.flavour}
                </td>

                <td className="p-4 text-right font-bold">
                  {formatQuantity(row.quantity)}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="p-6 text-center text-slate-500"
                >
                  No matching inventory found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // ===================================================
  // GROUPED BATCH INVENTORY TABLE - PRESERVED
  // ===================================================

  function groupedStockTable(rows) {
    return (
      <div className="space-y-4">
        {rows.map((product) => {
          const batches =
            getInventoryBatches(product);

          const totalQuantity =
            toQuantity(
              product.totalQuantity
            );

          const allocatedQuantity =
            toQuantity(
              product.allocatedQuantity
            );

          const unallocatedQuantity =
            toQuantity(
              product.unallocatedQuantity
            );

          return (
            <div
              key={product.stockId}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#17265B]">
                    {product.productName}
                    {product.size
                      ? ` (${product.size})`
                      : ""}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {product.flavour || "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold text-blue-700">
                    Total Stock
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#3654FF]">
                    {formatQuantity(
                      totalQuantity
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[350px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-3">
                        Production Batch Number
                      </th>

                      <th className="p-3 text-right">
                        Quantity
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {batches.map((batch, index) => (
                      <tr
                        key={
                          batch.freezerBatchStockId ??
                          `${batch.batchId}-${index}`
                        }
                        className="border-t border-slate-100"
                      >
                        <td className="p-3 font-semibold text-[#17265B]">
                          Batch{" "}
                          {batchNumberOf(batch) ||
                            "Not Assigned"}
                        </td>

                        <td className="p-3 text-right font-bold text-green-700">
                          {formatQuantity(
                            batch.quantity
                          )}
                        </td>
                      </tr>
                    ))}

                    {batches.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="p-4 text-center text-sm text-slate-500"
                        >
                          No production batches have been
                          recorded for this product.
                        </td>
                      </tr>
                    )}

                    {unallocatedQuantity > 0 && (
                      <tr className="border-t border-amber-200 bg-amber-50">
                        <td className="p-3 font-semibold text-amber-800">
                          No Batch Assigned
                        </td>

                        <td className="p-3 text-right font-bold text-amber-800">
                          {formatQuantity(
                            unallocatedQuantity
                          )}
                        </td>
                      </tr>
                    )}

                    {unallocatedQuantity < 0 && (
                      <tr className="border-t border-red-200 bg-red-50">
                        <td className="p-3 font-semibold text-red-700">
                          Batch quantity exceeds aggregate stock
                        </td>

                        <td className="p-3 text-right font-bold text-red-700">
                          {formatQuantity(
                            Math.abs(
                              unallocatedQuantity
                            )
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                <span className="font-semibold text-slate-500">
                  Total Batch Quantity
                </span>

                <strong className="text-[#17265B]">
                  {formatQuantity(
                    allocatedQuantity
                  )}
                </strong>
              </div>

              {unallocatedQuantity !== 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle
                    size={16}
                    className="shrink-0"
                  />

                  <span>
                    Batch records do not match
                    total product stock.
                    Review allocations in PostgreSQL.
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            No matching products found in this freezer.
          </div>
        )}
      </div>
    );
  }

  // ===================================================
  // MAIN RENDER
  // ===================================================

  return (
    <section className="space-y-6 text-[#17265B]">

      {/* ======================================
          SHIFT CONTROLS - PRESERVED
      ====================================== */}

      <OutletShiftControls
        onLogout={onLogout}
      />

      {/* ======================================
          HEADER
      ====================================== */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Outlet Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Retail billing, Defreezer stock
            and daily cash
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {/* ======================================
          DAILY SUMMARY - PRESERVED
      ====================================== */}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Today's Retail Sales",
            value: money(report?.todaySales),
            icon: ReceiptText,
          },
          {
            label: "Today's Cash",
            value: money(report?.todayCash),
            icon: Wallet,
          },
          {
            label: "Total Bills Today",
            value: report?.totalBills ?? 0,
            icon: ChartNoAxesCombined,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icon size={18} />
              {label}
            </div>

            <p className="mt-3 text-2xl font-bold">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ======================================
          NEW: LOW STOCK ALERTS
          DEFREEZER 1 - SELLING STOCK

          Displays automatically when a
          product has 8 or fewer units left.

          0 units:
          OUT OF STOCK

          1-4 units:
          CRITICAL STOCK

          5-8 units:
          LOW STOCK
      ====================================== */}

      {!loading && lowStockCount > 0 && (

        <div className="rounded-2xl border border-amber-300 bg-white p-5 shadow-sm">

          {/* ALERT HEADER */}

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
                <AlertTriangle size={24} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#17265B]">
                  Low Stock Alerts
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Defreezer 1 — Selling Stock
                </p>
              </div>

            </div>

            <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700">
              {lowStockCount} Product
              {lowStockCount !== 1 ? "s" : ""}
              {" "}Need Attention
            </span>

          </div>

          {/* STOCK WARNING */}

          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">

            <p className="font-semibold">
              Stock Replenishment Required
            </p>

            <p className="mt-1">
              The products listed below have{" "}
              {LOW_STOCK_THRESHOLD} or fewer
              units remaining in Defreezer 1.
              Consider transferring available
              stock from Defreezer 2.
            </p>

          </div>

          {/* LOW STOCK COUNTERS */}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">

            {/* OUT OF STOCK */}

            <div className="rounded-xl bg-red-50 p-4">

              <p className="text-xs font-semibold text-red-600">
                Out of Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-red-700">
                {outOfStockCount}
              </p>

            </div>

            {/* CRITICAL STOCK */}

            <div className="rounded-xl bg-orange-50 p-4">

              <p className="text-xs font-semibold text-orange-700">
                Critical Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-orange-700">
                {criticalStockCount}
              </p>

            </div>

            {/* LOW STOCK */}

            <div className="rounded-xl bg-amber-50 p-4">

              <p className="text-xs font-semibold text-amber-700">
                Low Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-amber-700">
                {warningStockCount}
              </p>

            </div>

          </div>

          {/* LOW STOCK PRODUCT DETAILS */}

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">

            <table className="w-full min-w-[650px] text-left text-sm">

              <thead className="bg-slate-50 text-slate-500">

                <tr>
                  <th className="p-4">
                    Product
                  </th>

                  <th className="p-4">
                    Flavour
                  </th>

                  <th className="p-4 text-right">
                    Remaining Quantity
                  </th>

                  <th className="p-4">
                    Stock Status
                  </th>
                </tr>

              </thead>

              <tbody>

                {lowStockProducts.map((product) => {

                  const isOut =
                    product.stockStatus ===
                    "OUT OF STOCK";

                  const isCritical =
                    product.stockStatus ===
                    "CRITICAL STOCK";

                  const statusClass =
                    isOut
                      ? "bg-red-100 text-red-700"
                      : isCritical
                        ? "bg-orange-100 text-orange-700"
                        : "bg-amber-100 text-amber-700";

                  return (

                    <tr
                      key={product.stockId}
                      className="border-t border-slate-100"
                    >

                      {/* PRODUCT NAME AND SIZE */}

                      <td className="p-4">

                        <p className="font-bold text-[#17265B]">
                          {product.productName ||
                            product.productId}
                        </p>

                        {product.size && (
                          <p className="mt-1 text-xs text-slate-500">
                            Size: {product.size}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-slate-400">
                          Stock ID: {product.stockId}
                        </p>

                      </td>

                      {/* FLAVOUR */}

                      <td className="p-4">
                        {product.flavour || "—"}
                      </td>

                      {/* REMAINING QUANTITY */}

                      <td className="p-4 text-right">

                        <span
                          className={
                            "text-lg font-bold " +
                            (
                              isOut || isCritical
                                ? "text-red-700"
                                : "text-amber-700"
                            )
                          }
                        >
                          {formatQuantity(
                            product.remainingQuantity
                          )}
                        </span>

                        <span className="ml-1 text-xs text-slate-500">
                          units
                        </span>

                      </td>

                      {/* STOCK STATUS */}

                      <td className="p-4">

                        <span
                          className={
                            "inline-block rounded-full px-3 py-2 " +
                            "text-xs font-bold " +
                            statusClass
                          }
                        >
                          {product.stockStatus}
                        </span>

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>

          {/* ACTION BUTTON */}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">

            <p className="text-sm text-slate-500">
              Stock alerts update when the
              dashboard inventory is refreshed.
            </p>

            <button
              type="button"
              onClick={() => {
                setTab("Inventory");

                setInventorySearch("");
                setInventoryFreezerFilter("ALL");
              }}
              className={
                buttonClass +
                " flex items-center gap-2"
              }
            >
              <ArrowRightLeft size={17} />

              View Inventory & Transfer Stock
            </button>

          </div>

        </div>
      )}

      {/* ======================================
          NEW: HEALTHY STOCK MESSAGE

          Display only when Defreezer 1
          contains inventory records and
          no products are below threshold.
      ====================================== */}

      {!loading &&
        freezer1.length > 0 &&
        lowStockCount === 0 && (

          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
            All recorded products in Defreezer 1
            have more than{" "}
            {LOW_STOCK_THRESHOLD} units remaining.
          </div>

        )}

      {/* ======================================
          MAIN TABS - PRESERVED
      ====================================== */}

      <div className="flex flex-wrap gap-3">
        {[
          "Billing",
          "Inventory",
          "Stock Receipts",
          "Daily Reports",
        ].map((name) => (
          <button
            type="button"
            key={name}
            onClick={() => setTab(name)}
            className={
              "rounded-xl px-5 py-3 text-sm font-bold " +
              (
                tab === name
                  ? "bg-[#3654FF] text-white"
                  : "bg-white text-[#17265B]"
              )
            }
          >
            {name}
          </button>
        ))}
      </div>

      {/* ======================================
          GLOBAL ERROR
      ====================================== */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ======================================
          GLOBAL SUCCESS
      ====================================== */}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-500">
          Loading outlet information...
        </p>
      )}

      {/* ======================================
          BILLING TAB - PRESERVED
      ====================================== */}

      {tab === "Billing" && (
        <div className="space-y-5">

          {/* BILLING CATEGORY SELECTOR */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ShoppingCart size={21} />
              Retail POS & Billing
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Create one CASH bill containing packaged
              ice cream, cones, waffle cups, or any
              combination of these items.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setBillingCategory("PACKAGED")
                }
                className={
                  "flex items-center justify-center gap-2 " +
                  "rounded-xl border px-4 py-3 text-sm font-bold " +
                  (
                    billingCategory === "PACKAGED"
                      ? "border-[#3654FF] bg-[#3654FF] text-white"
                      : "border-slate-200 bg-white text-[#17265B]"
                  )
                }
              >
                <Package size={18} />
                Packaged Ice Cream
              </button>

              <button
                type="button"
                onClick={() =>
                  setBillingCategory("SERVING")
                }
                className={
                  "flex items-center justify-center gap-2 " +
                  "rounded-xl border px-4 py-3 text-sm font-bold " +
                  (
                    billingCategory === "SERVING"
                      ? "border-[#3654FF] bg-[#3654FF] text-white"
                      : "border-slate-200 bg-white text-[#17265B]"
                  )
                }
              >
                <IceCreamCone size={18} />
                Cones & Waffle Cups
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">

            {/* PACKAGED BILLING FORM */}

            {billingCategory === "PACKAGED" && (
              <form
                onSubmit={addToCart}
                className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
              >
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <Package size={20} />
                  Packaged Ice Cream Billing
                </h2>

                <p className="text-sm text-slate-500">
                  Only Defreezer 1 stock can be sold.
                  Select the exact production batch
                  for each packaged retail bill item.
                </p>

                {/* PRODUCT DROPDOWN */}

                <label className="block space-y-2 text-sm font-semibold">
                  <span>Select Product</span>

                  <select
                    value={selectedStockId}
                    onChange={(event) => {
                      setSelectedStockId(
                        event.target.value
                      );

                      setSelectedBatchStockId("");
                      setQuantity("1");
                    }}
                    className={inputClass}
                    required
                    disabled={
                      saving ||
                      Boolean(
                        pendingSaleRef.current
                      )
                    }
                  >
                    <option value="">
                      Select product
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.stockId}
                        value={product.stockId}
                      >
                        {productLabel(product)}
                        {" — "}
                        {product.availableQuantity}
                        {" available"}
                      </option>
                    ))}
                  </select>
                </label>

                {/* PRODUCTION BATCH DROPDOWN */}

                <label className="block space-y-2 text-sm font-semibold">
                  <span>
                    Select Production Batch Number
                  </span>

                  <select
                    value={selectedBatchStockId}
                    onChange={(event) => {
                      setSelectedBatchStockId(
                        event.target.value
                      );

                      setQuantity("1");
                    }}
                    className={inputClass}
                    required
                    disabled={
                      !selectedStockId ||
                      batchLoading ||
                      Boolean(batchError) ||
                      saving ||
                      Boolean(
                        pendingSaleRef.current
                      )
                    }
                  >
                    <option value="">
                      {selectedStockId
                        ? "Select available production batch"
                        : "Select product first"}
                    </option>

                    {selectedProductBatches.map(
                      (batch) => {
                        const batchStockId =
                          batchIdOf(batch);

                        const already = cart
                          .filter(
                            (item) =>
                              String(item.stockId) ===
                                String(selectedStockId) &&
                              String(
                                item.freezerBatchStockId
                              ) ===
                                String(batchStockId)
                          )
                          .reduce(
                            (sum, item) =>
                              sum +
                              Number(item.quantity),
                            0
                          );

                        const remaining = Math.max(
                          0,
                          batchAvailable(batch) -
                            already
                        );

                        return (
                          <option
                            key={batchStockId}
                            value={String(
                              batchStockId
                            )}
                            disabled={remaining <= 0}
                          >
                            Batch{" "}
                            {batchNumberOf(batch)}
                            {" — "}
                            {formatQuantity(remaining)}
                            {" available"}
                          </option>
                        );
                      }
                    )}
                  </select>
                </label>

                {/* SELECTED PRODUCT INFORMATION */}

                {selectedProduct && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-semibold">
                      {productLabel(selectedProduct)}
                    </p>

                    <p className="mt-2">
                      Available in Defreezer 1:{" "}
                      <strong>
                        {formatQuantity(
                          selectedProduct.availableQuantity
                        )}
                      </strong>
                    </p>

                    {selectedBatch && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p>
                          Selected Batch:{" "}
                          <strong className="text-[#3654FF]">
                            {batchNumberOf(
                              selectedBatch
                            )}
                          </strong>
                        </p>

                        <p className="mt-2">
                          Remaining in Selected Batch:{" "}
                          <strong className="text-green-700">
                            {formatQuantity(
                              selectedBatchRemaining
                            )}
                          </strong>
                        </p>
                      </div>
                    )}

                    {/* EXISTING BATCH LIST */}

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="font-semibold">
                        Available Production Batches
                      </p>

                      <div className="mt-2 space-y-2">
                        {selectedProductBatches.map(
                          (batch) => (
                            <div
                              key={batchIdOf(batch)}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <span>
                                Batch{" "}
                                {batchNumberOf(batch)}
                              </span>

                              <span className="font-bold text-green-700">
                                {formatQuantity(
                                  batchAvailable(batch)
                                )}{" "}
                                units
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {!batchLoading &&
                      !batchError &&
                      selectedProductBatches.length === 0 && (
                        <p className="mt-3 text-amber-700">
                          No selectable production batches
                          were returned for this product.
                          Verify that the batch-inventory
                          API includes freezerBatchStockId.
                        </p>
                      )}

                    {selectedProductBatchData &&
                      selectedProductBatchData.unallocatedQuantity !== 0 && (
                        <p className="mt-3 text-xs text-amber-700">
                          Batch allocation difference:{" "}
                          {formatQuantity(
                            selectedProductBatchData
                              .unallocatedQuantity
                          )}{" "}
                          units.
                        </p>
                      )}
                  </div>
                )}

                {batchError && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    Unable to load production batches:{" "}
                    {batchError}
                  </p>
                )}

                {/* QUANTITY */}

                <label className="block space-y-2 text-sm font-semibold">
                  <span>Quantity</span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={
                      selectedBatch
                        ? selectedBatchRemaining
                        : undefined
                    }
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        event.target.value
                      )
                    }
                    className={inputClass}
                    required
                    disabled={
                      saving ||
                      Boolean(
                        pendingSaleRef.current
                      )
                    }
                  />
                </label>

                {/* RETAIL PRICE */}

                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  Retail Unit Price:{" "}

                  <strong>
                    {money(
                      selectedProduct?.unitPrice
                    )}
                  </strong>
                </div>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loading ||
                    batchLoading ||
                    Boolean(batchError) ||
                    !selectedProduct ||
                    !selectedBatch ||
                    selectedBatchRemaining <= 0 ||
                    Boolean(
                      pendingSaleRef.current
                    )
                  }
                  className={
                    buttonClass + " w-full"
                  }
                >
                  Add Selected Batch to Current Order
                </button>
              </form>
            )}

            {/* CONES / WAFFLE CUPS BILLING */}

            {billingCategory === "SERVING" && (
              <form
                onSubmit={addServingToCart}
                className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
              >
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <IceCreamCone size={21} />
                  Cones & Waffle Cups
                </h2>

                <p className="text-sm text-slate-500">
                  Select the cone or waffle cup,
                  choose the flavours and enter
                  the number of servings.
                  These sales do not deduct freezer stock.
                </p>

                {/* MENU LOADING / ERROR */}

                {servingLoading && (
                  <p className="flex items-center gap-2 text-sm text-blue-700">
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                    Loading cone and waffle cup menu...
                  </p>
                )}

                {servingError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    <p>
                      Unable to load serving options:{" "}
                      {servingError}
                    </p>

                    <button
                      type="button"
                      onClick={loadServingOptions}
                      disabled={servingLoading}
                      className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 font-semibold"
                    >
                      Retry Menu Loading
                    </button>
                  </div>
                )}

                {/* CONE / WAFFLE CUP TYPE */}

                <label className="block space-y-2 text-sm font-semibold">
                  <span>
                    Select Cone / Waffle Cup Type
                  </span>

                  <select
                    value={selectedServingOptionId}
                    onChange={(event) =>
                      selectServingOption(
                        event.target.value
                      )
                    }
                    className={inputClass}
                    required
                    disabled={
                      saving ||
                      servingLoading ||
                      Boolean(servingError) ||
                      Boolean(
                        pendingSaleRef.current
                      )
                    }
                  >
                    <option value="">
                      Select cone or waffle cup
                    </option>

                    {servingOptions.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.name}
                        {" — "}
                        {money(option.unitPrice)}
                      </option>
                    ))}
                  </select>
                </label>

                {/* SINGLE FLAVOUR SELECTION */}

                {selectedServingOption &&
                  servingMode(
                    selectedServingOption
                  ) === "SINGLE" && (
                    <label className="block space-y-2 text-sm font-semibold">
                      <span>Select Flavour</span>

                      <select
                        value={
                          servingFlavours[0] || ""
                        }
                        onChange={(event) =>
                          setServingFlavours(
                            event.target.value
                              ? [event.target.value]
                              : []
                          )
                        }
                        className={inputClass}
                        required
                        disabled={
                          saving ||
                          Boolean(
                            pendingSaleRef.current
                          )
                        }
                      >
                        <option value="">
                          Select flavour
                        </option>

                        {ICE_CREAM_FLAVOURS.map(
                          (flavour) => (
                            <option
                              key={flavour}
                              value={flavour}
                            >
                              {flavour}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  )}

                {/* MIXED FLAVOUR SELECTION */}

                {selectedServingOption &&
                  servingMode(
                    selectedServingOption
                  ) === "MIXED" && (
                    <label className="block space-y-2 text-sm font-semibold">
                      <span>
                        Select Mixed Flavour Combination
                      </span>

                      <select
                        value={
                          servingFlavours.join("|")
                        }
                        onChange={(event) => {
                          setServingFlavours(
                            event.target.value
                              ? event.target.value.split("|")
                              : []
                          );
                        }}
                        className={inputClass}
                        required
                        disabled={
                          saving ||
                          Boolean(
                            pendingSaleRef.current
                          )
                        }
                      >
                        <option value="">
                          Select flavour combination
                        </option>

                        {MIXED_FLAVOUR_OPTIONS.map(
                          (combination) => (
                            <option
                              key={combination.value}
                              value={combination.value}
                            >
                              {combination.label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  )}

                {/* WAFFLE CUP SCOOP FLAVOURS */}

                {selectedServingOption &&
                  servingMode(
                    selectedServingOption
                  ) === "ANY" &&
                  Array.from(
                    {
                      length:
                        servingScoopCount(
                          selectedServingOption
                        ),
                    },
                    (_, index) => (
                      <label
                        key={index}
                        className="block space-y-2 text-sm font-semibold"
                      >
                        <span>
                          Scoop {index + 1} Flavour
                        </span>

                        <select
                          value={
                            servingFlavours[index] || ""
                          }
                          onChange={(event) =>
                            changeScoopFlavour(
                              index,
                              event.target.value
                            )
                          }
                          className={inputClass}
                          required
                          disabled={
                            saving ||
                            Boolean(
                              pendingSaleRef.current
                            )
                          }
                        >
                          <option value="">
                            Select Scoop {index + 1} Flavour
                          </option>

                          {ICE_CREAM_FLAVOURS.map(
                            (flavour) => (
                              <option
                                key={flavour}
                                value={flavour}
                              >
                                {flavour}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    )
                  )}

                {/* SELECTED SERVING DETAILS */}

                {selectedServingOption && (
                  <div className="space-y-3 rounded-xl bg-blue-50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold">
                        Selected Item
                      </span>

                      <strong className="text-[#3654FF]">
                        {selectedServingOption.name}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span>
                        Scoop / Flavour Portion Count
                      </span>

                      <strong>
                        {servingScoopCount(
                          selectedServingOption
                        )}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span>Unit Price</span>

                      <strong>
                        {money(
                          selectedServingOption.unitPrice
                        )}
                      </strong>
                    </div>

                    {selectedServingValid && (
                      <div className="border-t border-blue-100 pt-3">
                        <p className="font-semibold">
                          Selected Flavours
                        </p>

                        <p className="mt-1 text-[#3654FF]">
                          {servingFlavourLabel(
                            servingFlavours
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* SERVING QUANTITY */}

                <label className="block space-y-2 text-sm font-semibold">
                  <span>Number of Servings</span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={servingQuantity}
                    onChange={(event) =>
                      setServingQuantity(
                        event.target.value
                      )
                    }
                    className={inputClass}
                    required
                    disabled={
                      saving ||
                      Boolean(
                        pendingSaleRef.current
                      )
                    }
                  />
                </label>

                {/* SERVING LINE TOTAL */}

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm">
                  <span className="font-semibold">
                    Serving Line Total
                  </span>

                  <strong className="text-lg text-[#3654FF]">
                    {money(
                      Number.isFinite(servingLineTotal) &&
                      servingLineTotal > 0
                        ? servingLineTotal
                        : 0
                    )}
                  </strong>
                </div>

                {/* ADD SERVING TO CART */}

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loading ||
                    servingLoading ||
                    Boolean(servingError) ||
                    !selectedServingOption ||
                    !selectedServingValid ||
                    !Number.isSafeInteger(
                      Number(servingQuantity)
                    ) ||
                    Number(servingQuantity) <= 0 ||
                    Boolean(
                      pendingSaleRef.current
                    )
                  }
                  className={
                    buttonClass + " w-full"
                  }
                >
                  Add Cone / Waffle Cup to Current Order
                </button>
              </form>
            )}

            {/* COMBINED CURRENT ORDER */}

            <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ShoppingCart size={21} />
                Current Order
              </h2>

              {!hasBillItems && (
                <p className="text-sm text-slate-500">
                  No products added yet.
                </p>
              )}

              {/* PACKAGED CART ITEMS */}

              {cart.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold text-slate-500">
                    Packaged Ice Cream
                  </h3>

                  {cart.map((item) => (
                    <div
                      key={cartKey(item)}
                      className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {productLabel(item)}
                        </p>

                        <p className="mt-1 font-semibold text-[#3654FF]">
                          Production Batch:{" "}
                          {item.batchNumber}
                        </p>

                        <p className="mt-1 text-slate-500">
                          {item.quantity}
                          {" × "}
                          {money(item.unitPrice)}
                        </p>

                        <p className="mt-1 font-bold">
                          {money(
                            Number(item.quantity) *
                            Number(item.unitPrice)
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          saving ||
                          Boolean(
                            pendingSaleRef.current
                          )
                        }
                        onClick={() =>
                          setCart((previous) =>
                            previous.filter(
                              (row) =>
                                cartKey(row) !==
                                cartKey(item)
                            )
                          )
                        }
                        className="text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* CONE / CUP CART ITEMS */}

              {servingCart.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold text-slate-500">
                    Cones & Waffle Cups
                  </h3>

                  {servingCart.map((item) => (
                    <div
                      key={servingCartKey(item)}
                      className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {item.name}
                        </p>

                        <p className="mt-1 font-semibold text-[#3654FF]">
                          {servingFlavourLabel(
                            item.flavours
                          )}
                        </p>

                        <p className="mt-1 text-slate-500">
                          Scoops / Portions:{" "}
                          {item.scoopCount}
                        </p>

                        <p className="mt-1 text-slate-500">
                          {item.quantity}
                          {" × "}
                          {money(item.unitPrice)}
                        </p>

                        <p className="mt-1 font-bold">
                          {money(
                            Number(item.quantity) *
                            Number(item.unitPrice)
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          No freezer stock deduction
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          saving ||
                          Boolean(
                            pendingSaleRef.current
                          )
                        }
                        onClick={() =>
                          setServingCart((previous) =>
                            previous.filter(
                              (row) =>
                                servingCartKey(row) !==
                                servingCartKey(item)
                            )
                          )
                        }
                        className="text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* COMBINED BILL SUBTOTALS */}

              {hasBillItems && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between">
                    <span>Packaged Ice Cream</span>

                    <strong>
                      {money(packagedCartTotal)}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Cones & Waffle Cups</span>

                    <strong>
                      {money(servingCartTotal)}
                    </strong>
                  </div>
                </div>
              )}

              {/* GRAND TOTAL */}

              <div className="flex justify-between rounded-xl bg-blue-50 p-4 font-bold">
                <span>Total Amount</span>

                <span>
                  {money(cartTotal)}
                </span>
              </div>

              {/* PAYMENT METHOD */}

              <p className="text-sm font-semibold">
                Payment Method
              </p>

              <div className="rounded-xl border border-green-400 bg-green-100 px-4 py-3 text-center text-sm font-bold text-green-800">
                CASH
              </div>

              {/* COMPLETE SALE */}

              <button
                type="button"
                disabled={
                  saving ||
                  !hasBillItems ||
                  (
                    !pendingSaleRef.current &&
                    (
                      (cart.length > 0 &&
                        (batchLoading || Boolean(batchError))) ||
                      (servingCart.length > 0 &&
                        (servingLoading || Boolean(servingError)))
                    )
                  )
                }
                onClick={completeSale}
                className={
                  buttonClass + " w-full"
                }
              >
                {saving
                  ? "Processing..."
                  : pendingSaleRef.current
                    ? "Retry Previous Retail Sale"
                    : "Complete Retail Sale"}
              </button>

              {/* CANCEL COMBINED ORDER */}

              <button
                type="button"
                disabled={
                  saving ||
                  Boolean(
                    pendingSaleRef.current
                  )
                }
                onClick={() => {
                  setCart([]);
                  setServingCart([]);
                  setMessage("");
                  setError("");
                }}
                className="w-full rounded-xl border border-red-200 p-3 text-sm font-semibold text-red-600"
              >
                Cancel Order
              </button>

              {pendingSaleRef.current && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  A previous sale response is uncertain.
                  Check Recent Retail Bills before retrying.
                  The original receipt key and items are retained.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================
          INVENTORY TAB - PRESERVED
      ====================================== */}

      {tab === "Inventory" && (
        <div className="space-y-6">

          {/* INVENTORY SEARCH */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Search size={20} />
              Search Freezer Inventory
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Find products by name, size, flavour,
              product ID or production batch number.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">

              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={inventorySearch}
                  onChange={(event) =>
                    setInventorySearch(
                      event.target.value
                    )
                  }
                  placeholder="Search product, flavour, size or Batch 055..."
                  className={
                    inputClass + " pl-11"
                  }
                  aria-label="Search freezer inventory"
                />
              </div>

              <select
                value={inventoryFreezerFilter}
                onChange={(event) =>
                  setInventoryFreezerFilter(
                    event.target.value
                  )
                }
                className={inputClass}
                aria-label="Filter inventory by freezer"
              >
                <option value="ALL">
                  Both Freezers
                </option>

                <option value="FREEZER_1">
                  Defreezer 1
                </option>

                <option value="FREEZER_2">
                  Defreezer 2
                </option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p
                className="text-sm text-slate-500"
                aria-live="polite"
              >
                Showing{" "}
                <strong className="text-[#17265B]">
                  {visibleInventoryCount}
                </strong>
                {" "}of{" "}
                <strong className="text-[#17265B]">
                  {totalInventoryCount}
                </strong>
                {" "}products
              </p>

              <button
                type="button"
                onClick={() => {
                  setInventorySearch("");
                  setInventoryFreezerFilter("ALL");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-[#3654FF]"
              >
                Clear Search
              </button>
            </div>

            {visibleInventoryCount === 0 &&
              !loading &&
              !batchLoading && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No products match your search.
                  Try another product name,
                  flavour, size or batch number.
                </div>
              )}
          </div>

          {/* BATCH INVENTORY LOADING */}

          {batchLoading && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
              <RefreshCw
                size={17}
                className="animate-spin"
              />

              Loading batch inventory...
            </div>
          )}

          {/* BATCH API ERROR */}

          {batchError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              <AlertTriangle
                size={18}
                className="shrink-0"
              />

              <span>
                Batch inventory could not be loaded:{" "}
                {batchError}
                {" "}
                Existing aggregate stock is shown below.
                Batch-number searching requires
                the batch inventory API.
              </span>
            </div>
          )}

          {/* DEFREEZER 1 */}

          {inventoryFreezerFilter !== "FREEZER_2" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Package size={20} />

                <h2 className="text-xl font-bold">
                  Defreezer 1 — Selling Stock
                </h2>
              </div>

              {batchError ? (
                stockTable(
                  filteredAggregateFreezer1
                )
              ) : (
                groupedStockTable(
                  filteredFreezer1
                )
              )}
            </div>
          )}

          {/* DEFREEZER 2 */}

          {inventoryFreezerFilter !== "FREEZER_1" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Package size={20} />

                <h2 className="text-xl font-bold">
                  Defreezer 2 — Backroom Stock
                </h2>
              </div>

              {batchError ? (
                stockTable(
                  filteredAggregateFreezer2
                )
              ) : (
                groupedStockTable(
                  filteredFreezer2
                )
              )}
            </div>
          )}

          {/* INTERNAL FREEZER TRANSFER */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <form
              onSubmit={transferStock}
              className="space-y-4"
            >
              <h3 className="flex items-center gap-2 font-bold">
                <ArrowRightLeft size={18} />
                Transfer to Defreezer 1
              </h3>

              {/* SOURCE PRODUCT */}

              <label className="block space-y-2 text-sm font-semibold">
                <span>
                  Select Defreezer 2 Product
                </span>

                <select
                  value={transferStockId}
                  onChange={(event) => {
                    setTransferStockId(
                      event.target.value
                    );

                    setTransferBatchStockId("");
                    setTransferQuantity("1");
                  }}
                  className={inputClass}
                  required
                  disabled={saving}
                >
                  <option value="">
                    Select Defreezer 2 product
                  </option>

                  {freezer2
                    .filter(
                      (item) =>
                        toQuantity(
                          item.availableQuantity ??
                          item.quantity
                        ) > 0
                    )
                    .map((item) => (
                      <option
                        key={item.stockId}
                        value={item.stockId}
                      >
                        {productLabel(item)}
                        {" — "}
                        {formatQuantity(
                          item.availableQuantity ??
                          item.quantity
                        )}
                        {" available"}
                      </option>
                    ))}
                </select>
              </label>

              {/* SOURCE PRODUCTION BATCH */}

              <label className="block space-y-2 text-sm font-semibold">
                <span>
                  Select Production Batch Number
                </span>

                <select
                  value={transferBatchStockId}
                  onChange={(event) => {
                    setTransferBatchStockId(
                      event.target.value
                    );

                    setTransferQuantity("1");
                  }}
                  className={inputClass}
                  required
                  disabled={
                    !transferStockId ||
                    saving ||
                    batchLoading ||
                    Boolean(batchError)
                  }
                >
                  <option value="">
                    {transferStockId
                      ? "Select production batch"
                      : "Select product first"}
                  </option>

                  {transferAvailableBatches.map(
                    (batch) => (
                      <option
                        key={
                          batchIdOf(batch)
                        }
                        value={String(
                          batchIdOf(batch)
                        )}
                      >
                        Batch{" "}
                        {batchNumberOf(batch)}
                        {" — "}
                        {formatQuantity(
                          batchAvailable(batch)
                        )}
                        {" available"}
                      </option>
                    )
                  )}
                </select>
              </label>

              {/* SELECTED TRANSFER BATCH */}

              {selectedTransferBatch && (
                <div className="rounded-xl bg-blue-50 p-4 text-sm">
                  <p>
                    Selected Batch:{" "}

                    <strong>
                      {batchNumberOf(
                        selectedTransferBatch
                      )}
                    </strong>
                  </p>

                  <p className="mt-2">
                    Available Batch Units:{" "}

                    <strong>
                      {formatQuantity(
                        batchAvailable(
                          selectedTransferBatch
                        )
                      )}
                    </strong>
                  </p>
                </div>
              )}

              {/* TRANSFER QUANTITY */}

              <label className="block space-y-2 text-sm font-semibold">
                <span>
                  Transfer Quantity
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  max={
                    selectedTransferBatch
                      ? batchAvailable(
                          selectedTransferBatch
                        )
                      : undefined
                  }
                  value={transferQuantity}
                  onChange={(event) =>
                    setTransferQuantity(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  required
                  disabled={saving}
                />
              </label>

              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  batchLoading ||
                  Boolean(batchError) ||
                  !selectedTransferProduct ||
                  !selectedTransferBatch
                }
                className={buttonClass}
              >
                {saving
                  ? "Transferring..."
                  : "Transfer Selected Batch"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================
          STOCK RECEIPTS TAB - PRESERVED
      ====================================== */}

      {tab === "Stock Receipts" && (
        <OutletSupplyReceipts
          onReceived={load}
        />
      )}

      {/* ======================================
          DAILY REPORTS TAB - PRESERVED
      ====================================== */}

      {tab === "Daily Reports" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">
            Daily Retail Sales Report
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Reporting date:{" "}
            {report?.date ||
              "Not available"}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              [
                "Cash Collected",
                report?.todayCash,
              ],
              [
                "Card Sales (Pending)",
                report?.cardSales,
              ],
              [
                "Cheque Sales (Pending)",
                report?.chequeSales,
              ],
              [
                "Total Retail Sales",
                report?.todaySales,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">
                  {label}
                </p>

                <p className="mt-2 text-xl font-bold">
                  {money(value)}
                </p>
              </div>
            ))}
          </div>

          <h3 className="mt-8 font-bold">
            Recent Retail Bills
          </h3>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-3">Bill</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {(report?.recentSales || []).map(
                  (sale) => (
                    <tr
                      key={sale.saleId}
                      className="border-t border-slate-200"
                    >
                      <td className="p-3">
                        #{sale.saleId}
                      </td>

                      <td className="p-3">
                        {sale.paymentMethod}
                      </td>

                      <td className="p-3">
                        {sale.paymentStatus}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          sale.totalAmount
                        )}
                      </td>
                    </tr>
                  )
                )}

                {!report?.recentSales?.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-slate-500"
                    >
                      No retail sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  );
}
