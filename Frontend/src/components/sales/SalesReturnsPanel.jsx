
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  RotateCcw,
  Package,
  Truck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { salesBillingApi } from "../../services/salesBillingApi";

// ==========================================
// API CONFIGURATION
// ==========================================

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// ==========================================
// TAILWIND STYLES
// ==========================================

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-white px-4 py-3 text-sm outline-none " +
  "focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100";

const buttonClass =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl bg-[#3654FF] px-5 py-3 " +
  "font-bold text-white hover:bg-[#2943D9] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ==========================================
// JWT AUTHENTICATION
// ==========================================

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

// ==========================================
// RETURNS API REQUEST HELPER
// ==========================================

async function request(path, options = {}) {
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

  const text = await response.text();

  let result;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = text;
  }

  if (!response.ok) {
    const detail =
      result && typeof result === "object"
        ? (
            result.message ||
            result.detail ||
            result.error
          )
        : typeof result === "string"
          ? result
          : null;

    throw new Error(
      detail || `Request failed: ${response.status}`
    );
  }

  return result;
}

// ==========================================
// SRI LANKA CURRENT DATE
// ==========================================

function sriLankaDate() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const part = (type) =>
    parts.find((item) => item.type === type)?.value;

  return [
    part("year"),
    part("month"),
    part("day"),
  ].join("-");
}

// ==========================================
// PRODUCT LABEL
// ==========================================

function productLabel(product) {
  return [
    product?.productName,
    product?.flavour,
    product?.size
      ? `(${product.size})`
      : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

// ==========================================
// PRODUCT ID AND FLAVOUR HELPERS
// ==========================================

function sameProduct(first, second) {
  return (
    first &&
    second &&
    String(first.productId) ===
      String(second.productId) &&
    String(first.flavour || "")
      .trim()
      .toLowerCase() ===
      String(second.flavour || "")
        .trim()
        .toLowerCase()
  );
}

// ==========================================
// NORMALIZE RETURNABLE PRODUCT CATALOG
// ==========================================

function normalizeReturnableProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error(
      "Invalid returnable products response."
    );
  }

  return products.map((product, index) => ({
    ...product,
    selectionKey: String(index),
    productId: String(product.productId ?? ""),
    productName:
      product.productName || "Unknown Product",
    flavour: product.flavour || "",
    size: product.size || "",
  }));
}

// ==========================================
// NORMALIZE LORRY INVENTORY
// ==========================================

function normalizeLorryProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error(
      "Invalid lorry inventory response."
    );
  }

  return products.map((product) => ({
    ...product,
    stockId: product.stockId,
    productId: String(product.productId ?? ""),
    availableQuantity: Number(
      product.availableQuantity ?? 0
    ),
  }));
}

// ==========================================
// SALES RETURNS PANEL
// ==========================================

export default function SalesReturnsPanel({
  vehicleNumber,
  onReturnCreated,
}) {
  // ========================================
  // PRODUCT AND HISTORY STATES
  // ========================================

  const [
    returnableProducts,
    setReturnableProducts,
  ] = useState([]);

  const [
    lorryProducts,
    setLorryProducts,
  ] = useState([]);

  const [history, setHistory] = useState([]);

  // ========================================
  // SHOP DETAILS
  // ========================================

  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");

  // ========================================
  // RETURNED PRODUCT DETAILS
  // ========================================

  const [
    returnedProductKey,
    setReturnedProductKey,
  ] = useState("");

  const [batchNumber, setBatchNumber] =
    useState("");

  const [
    returnedQuantity,
    setReturnedQuantity,
  ] = useState("1");

  const [returnDate, setReturnDate] =
    useState(sriLankaDate());

  const [returnReason, setReturnReason] =
    useState("");

  const [otherReason, setOtherReason] =
    useState("");

  // ========================================
  // REPLACEMENT PRODUCT DETAILS
  // ========================================

  const [
    replacementStockId,
    setReplacementStockId,
  ] = useState("");

  // ========================================
  // LOADING AND MESSAGE STATES
  // ========================================

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ========================================
  // DUPLICATE SUBMISSION PROTECTION
  // ========================================

  const receiptKeyRef = useRef(
    crypto.randomUUID()
  );

  const savingRef = useRef(false);

  // Preserve an uncertain request on retry.
  const pendingPayloadRef = useRef(null);

  // ========================================
  // LOAD PRODUCTS AND RETURN HISTORY
  //
  // Returned products come from factory
  // catalog, not only the current lorry.
  //
  // Replacement products come from the
  // Sales Manager's already-active lorry.
  // ========================================

  const refreshData = useCallback(async () => {
    setRefreshing(true);

    try {
      const [
        catalog,
        stock,
        returns,
      ] = await Promise.all([
        request("/api/sales/returns/products"),

        salesBillingApi.getProducts(),

        request("/api/sales/returns"),
      ]);

      const normalizedCatalog =
        normalizeReturnableProducts(catalog);

      const normalizedStock =
        normalizeLorryProducts(stock);

      if (!Array.isArray(returns)) {
        throw new Error(
          "Invalid return history response."
        );
      }

      setReturnableProducts(normalizedCatalog);
      setLorryProducts(normalizedStock);
      setHistory(returns);

      setError("");

      return true;
    } catch (err) {
      setError(
        err.message ||
        "Unable to load return information."
      );

      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ========================================
  // INITIAL DATA LOAD
  // ========================================

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ========================================
  // SELECTED RETURNED PRODUCT
  // ========================================

  const selectedReturnedProduct = useMemo(
    () =>
      returnableProducts.find(
        (product) =>
          product.selectionKey === returnedProductKey
      ),
    [
      returnableProducts,
      returnedProductKey,
    ]
  );

  // ========================================
  // MATCHING REPLACEMENT PRODUCTS
  //
  // Current policy:
  // - Same product
  // - Same flavour
  // - Equal quantity
  //
  // No second vehicle selection.
  // ========================================

  const replacementOptions = useMemo(
    () =>
      lorryProducts.filter(
        (product) =>
          selectedReturnedProduct &&
          sameProduct(
            selectedReturnedProduct,
            product
          ) &&
          Number(product.availableQuantity) > 0
      ),
    [
      lorryProducts,
      selectedReturnedProduct,
    ]
  );

  // ========================================
  // SELECTED REPLACEMENT STOCK
  // ========================================

  const selectedReplacement = useMemo(
    () =>
      replacementOptions.find(
        (product) =>
          String(product.stockId) ===
          String(replacementStockId)
      ),
    [
      replacementOptions,
      replacementStockId,
    ]
  );

  // ========================================
  // QUANTITY VALIDATION
  // ========================================

  const quantityNumber = Number(returnedQuantity);

  const availableQuantity = Number(
    selectedReplacement?.availableQuantity ?? 0
  );

  const validQuantity =
    Number.isSafeInteger(quantityNumber) &&
    quantityNumber > 0 &&
    quantityNumber <= availableQuantity;

  const stockAfterReplacement =
    availableQuantity - quantityNumber;

  // ========================================
  // RETURN REASON
  // ========================================

  const actualReason =
    returnReason === "Other"
      ? otherReason.trim()
      : returnReason.trim();

  // ========================================
  // CHANGE RETURNED PRODUCT
  // ========================================

  function selectReturnedProduct(value) {
    setReturnedProductKey(value);

    // Clear old replacement when product changes.
    setReplacementStockId("");

    setSuccess("");
  }

  // ========================================
  // RESET RETURN FORM
  // ========================================

  function resetReturnForm() {
    setShopName("");
    setShopPhone("");

    setReturnedProductKey("");

    setBatchNumber("");
    setReturnedQuantity("1");

    setReturnDate(sriLankaDate());

    setReturnReason("");
    setOtherReason("");

    setReplacementStockId("");

    pendingPayloadRef.current = null;
    receiptKeyRef.current = crypto.randomUUID();
  }

  // ========================================
  // SAVE RETURN AND ISSUE REPLACEMENT
  //
  // No invoice.
  // No Admin approval.
  // No lorry ID supplied by React.
  // ========================================

  async function submitReturn(event) {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }

    setError("");
    setSuccess("");

    // ------------------------------------
    // SHOP NAME
    // ------------------------------------

    if (!shopName.trim()) {
      setError(
        "Shop or customer name is required."
      );
      return;
    }

    // ------------------------------------
    // RETURNED PRODUCT
    // ------------------------------------

    if (!selectedReturnedProduct) {
      setError(
        "Select the returned product."
      );
      return;
    }

    // ------------------------------------
    // BATCH NUMBER
    // ------------------------------------

    if (!batchNumber.trim()) {
      setError(
        "Enter the batch number printed on the returned product."
      );
      return;
    }

    // ------------------------------------
    // REPLACEMENT STOCK
    // ------------------------------------

    if (!selectedReplacement) {
      setError(
        "Select a replacement product from the active lorry."
      );
      return;
    }

    // ------------------------------------
    // PRODUCT MATCHING
    // ------------------------------------

    if (
      !sameProduct(
        selectedReturnedProduct,
        selectedReplacement
      )
    ) {
      setError(
        "Replacement must match the returned product and flavour."
      );
      return;
    }

    // ------------------------------------
    // VALIDATE QUANTITY
    // ------------------------------------

    if (!validQuantity) {
      setError(
        "Returned quantity must be a positive whole number " +
        "and cannot exceed available replacement stock."
      );
      return;
    }

    // ------------------------------------
    // RETURN DATE
    // ------------------------------------

    if (!returnDate) {
      setError(
        "Return date is required."
      );
      return;
    }

    if (returnDate > sriLankaDate()) {
      setError(
        "Return date cannot be in the future."
      );
      return;
    }

    // ------------------------------------
    // RETURN REASON
    // ------------------------------------

    if (!actualReason) {
      setError(
        "Select or enter a return reason."
      );
      return;
    }

    if (actualReason.length > 500) {
      setError(
        "Return reason cannot exceed 500 characters."
      );
      return;
    }

    // ------------------------------------
    // BUILD REQUEST
    //
    // The backend identifies the current
    // Sales Manager and selected vehicle
    // from the JWT and sales session.
    // ------------------------------------

    const payload = {
      receiptKey: receiptKeyRef.current,

      shopName: shopName.trim(),

      shopPhone: shopPhone.trim(),

      productId: String(
        selectedReturnedProduct.productId
      ),

      flavour: String(
        selectedReturnedProduct.flavour
      ),

      batchNumber: batchNumber.trim(),

      returnedQuantity: quantityNumber,

      returnDate,

      returnReason: actualReason,

      replacementStockId: Number(
        selectedReplacement.stockId
      ),

      replacementQuantity: quantityNumber,
    };

    // ------------------------------------
    // PROTECT UNCERTAIN NETWORK RETRIES
    // ------------------------------------

    const serializedPayload =
      JSON.stringify(payload);

    if (
      pendingPayloadRef.current &&
      pendingPayloadRef.current !== serializedPayload
    ) {
      setError(
        "A previous return submission has an uncertain result. " +
        "Check Return History before starting a different return."
      );
      return;
    }

    // ------------------------------------
    // CONFIRM PHYSICAL REPLACEMENT
    // ------------------------------------

    const confirmed = window.confirm(
      "Confirm Product Return & Replacement\n\n" +
      `Shop: ${shopName.trim()}\n` +
      `Returned Product: ${productLabel(
        selectedReturnedProduct
      )}\n` +
      `Batch Number: ${batchNumber.trim()}\n` +
      `Returned Quantity: ${quantityNumber}\n` +
      `Return Reason: ${actualReason}\n\n` +
      `Replacement Product: ${productLabel(
        selectedReplacement
      )}\n` +
      `Replacement Quantity: ${quantityNumber}\n` +
      `Active Lorry: ${
        vehicleNumber || "Selected sales vehicle"
      }\n\n` +
      "The replacement quantity will be deducted " +
      "immediately from available lorry stock. " +
      "Do you want to continue?"
    );

    if (!confirmed) {
      return;
    }

    savingRef.current = true;
    setSaving(true);

    pendingPayloadRef.current =
      serializedPayload;

    let saved;

    // ------------------------------------
    // SAVE THROUGH SPRING BOOT
    // ------------------------------------

    try {
      saved = await request(
        "/api/sales/returns",
        {
          method: "POST",
          body: serializedPayload,
        }
      );
    } catch (err) {
      setError(
        (err.message ||
          "Unable to save product return.") +
        " If the request may have succeeded, " +
        "refresh Return History before retrying."
      );

      savingRef.current = false;
      setSaving(false);

      // Keep the original receipt key.
      // Retrying must not deduct stock twice.

      return;
    }

    // ------------------------------------
    // SUCCESS
    //
    // Spring Boot has committed both:
    // - the return record
    // - the replacement stock deduction
    // ------------------------------------

    const returnedCount = quantityNumber;

    resetReturnForm();

    setSuccess(
      `Return #${saved?.id ?? "saved"} recorded successfully. ` +
      `${returnedCount} replacement units were issued ` +
      "and deducted from the active lorry. " +
      "No Admin approval is required."
    );

    savingRef.current = false;
    setSaving(false);

    // ------------------------------------
    // REFRESH RETURNS AND INVENTORY
    // ------------------------------------

    const refreshed = await refreshData();

    if (refreshed) {
      // Retain the success message after refresh.
      setSuccess(
        `Return #${saved?.id ?? "saved"} recorded successfully. ` +
        `${returnedCount} replacement units were deducted ` +
        "from the active lorry."
      );
    }

    // ------------------------------------
    // REFRESH MAIN DASHBOARD INVENTORY
    // ------------------------------------

    if (typeof onReturnCreated === "function") {
      try {
        await onReturnCreated(saved);
      } catch (callbackError) {
        console.warn(
          "Return saved, but dashboard refresh failed:",
          callbackError
        );
      }
    }
  }

  // ========================================
  // HANDLE MANUAL REFRESH
  // ========================================

  async function handleRefresh() {
    const loaded = await refreshData();

    if (loaded) {
      // The Sales Manager can inspect Return
      // History after an uncertain submission.
      setSuccess(
        "Return history and lorry inventory refreshed."
      );
    }
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="space-y-6">

      {/* ================================== */}
      {/* PAGE HEADER */}
      {/* ================================== */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-[#17265B]">
            <RotateCcw
              size={23}
              className="text-[#3654FF]"
            />

            Product Returns & Replacements
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Record returned products and issue replacements
            directly from your selected lorry.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || saving}
          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-[#3654FF] disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              refreshing ? "animate-spin" : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>

      </div>


      {/* ================================== */}
      {/* RETURN POLICY INFORMATION */}
      {/* ================================== */}

      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        The Sales Manager can record returns and
        issue replacement products directly.
        No original invoice or Admin approval is required.
      </div>

      {/* ================================== */}
      {/* STOCK SAFETY INFORMATION */}
      {/* ================================== */}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">

        <div className="flex items-start gap-2">
          <AlertTriangle
            size={19}
            className="shrink-0"
          />

          <p>
            Returned ice cream is recorded as
            quarantined stock and must not be added
            to saleable inventory. Replacement products
            are deducted from the current lorry.
          </p>
        </div>

      </div>

      {/* ================================== */}
      {/* ERROR MESSAGE */}
      {/* ================================== */}

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ================================== */}
      {/* SUCCESS MESSAGE */}
      {/* ================================== */}

      {success && (
        <div
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* ================================== */}
      {/* RETURN FORM */}
      {/* ================================== */}

      <form
        onSubmit={submitReturn}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >

        {/* ================================== */}
        {/* RETURNED PRODUCT DETAILS */}
        {/* ================================== */}

        <h3 className="flex items-center gap-2 text-lg font-bold text-[#17265B]">
          <Package size={20} />
          Returned Product Details
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Enter the details of the products received
          back from the shop.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">

          {/* SHOP NAME */}

          <div>
            <label
              htmlFor="return-shop-name"
              className="mb-2 block text-sm font-semibold"
            >
              Shop / Customer Name
            </label>

            <input
              id="return-shop-name"
              value={shopName}
              onChange={(event) =>
                setShopName(event.target.value)
              }
              maxLength={200}
              required
              className={inputClass}
              placeholder="Enter shop name"
              disabled={saving}
            />
          </div>

          {/* SHOP PHONE */}

          <div>
            <label
              htmlFor="return-shop-phone"
              className="mb-2 block text-sm font-semibold"
            >
              Shop Phone (Optional)
            </label>

            <input
              id="return-shop-phone"
              type="tel"
              value={shopPhone}
              onChange={(event) =>
                setShopPhone(event.target.value)
              }
              maxLength={30}
              className={inputClass}
              placeholder="07XXXXXXXX"
              disabled={saving}
            />
          </div>

          {/* RETURNED PRODUCT */}

          <div className="sm:col-span-2">

            <label
              htmlFor="returned-product"
              className="mb-2 block text-sm font-semibold"
            >
              Returned Product
            </label>

            <select
              id="returned-product"
              value={returnedProductKey}
              onChange={(event) =>
                selectReturnedProduct(
                  event.target.value
                )
              }
              required
              disabled={loading || saving}
              className={inputClass}
            >
              <option value="">
                {loading
                  ? "Loading products..."
                  : "Select returned product"}
              </option>

              {returnableProducts.map((product) => (
                <option
                  key={product.selectionKey}
                  value={product.selectionKey}
                >
                  {productLabel(product)}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-slate-500">
              Products are loaded from the factory
              catalog. The returned product does not
              need to be available on the lorry.
            </p>

          </div>

          {/* BATCH NUMBER */}

          <div>
            <label
              htmlFor="return-batch"
              className="mb-2 block text-sm font-semibold"
            >
              Original Batch Number
            </label>

            <input
              id="return-batch"
              value={batchNumber}
              onChange={(event) =>
                setBatchNumber(event.target.value)
              }
              placeholder="e.g. BATCH-026"
              className={inputClass}
              maxLength={100}
              required
              disabled={saving}
            />
          </div>

          {/* RETURNED QUANTITY */}

          <div>
            <label
              htmlFor="return-quantity"
              className="mb-2 block text-sm font-semibold"
            >
              Returned Quantity
            </label>

            <input
              id="return-quantity"
              type="number"
              min="1"
              step="1"
              value={returnedQuantity}
              onChange={(event) =>
                setReturnedQuantity(
                  event.target.value
                )
              }
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          {/* RETURN DATE */}

          <div>
            <label
              htmlFor="return-date"
              className="mb-2 block text-sm font-semibold"
            >
              Date Returned
            </label>

            <input
              id="return-date"
              type="date"
              value={returnDate}
              max={sriLankaDate()}
              onChange={(event) =>
                setReturnDate(event.target.value)
              }
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          {/* REASON */}

          <div>
            <label
              htmlFor="return-reason"
              className="mb-2 block text-sm font-semibold"
            >
              Reason for Return
            </label>

            <select
              id="return-reason"
              value={returnReason}
              onChange={(event) =>
                setReturnReason(
                  event.target.value
                )
              }
              className={inputClass}
              required
              disabled={saving}
            >
              <option value="">
                Select reason
              </option>

              <option value="Damaged packaging">
                Damaged packaging
              </option>

              <option value="Defective product">
                Defective product
              </option>

              <option value="Temperature or quality issue">
                Temperature or quality issue
              </option>

              <option value="Expired product">
                Expired product
              </option>

              <option value="Incorrect product supplied">
                Incorrect product supplied
              </option>

              <option value="Other">
                Other
              </option>
            </select>
          </div>

          {/* CUSTOM REASON */}

          {returnReason === "Other" && (
            <div className="sm:col-span-2">
              <label
                htmlFor="other-return-reason"
                className="mb-2 block text-sm font-semibold"
              >
                Specify Return Reason
              </label>

              <textarea
                id="other-return-reason"
                value={otherReason}
                onChange={(event) =>
                  setOtherReason(event.target.value)
                }
                maxLength={500}
                required
                rows={3}
                disabled={saving}
                placeholder="Explain why the product is being returned"
                className={inputClass}
              />
            </div>
          )}

        </div>

        {/* ================================== */}
        {/* REPLACEMENT PRODUCT DETAILS */}
        {/* ================================== */}

        <div className="my-6 border-t border-slate-200" />

        <h3 className="flex items-center gap-2 text-lg font-bold text-[#17265B]">
          <Truck size={20} />
          Replacement From Current Lorry
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Select the replacement stock from the lorry
          already assigned to your active sales session.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">

          {/* REPLACEMENT PRODUCT */}

          <div>
            <label
              htmlFor="replacement-product"
              className="mb-2 block text-sm font-semibold"
            >
              Replacement Product
            </label>

            <select
              id="replacement-product"
              value={replacementStockId}
              onChange={(event) =>
                setReplacementStockId(
                  event.target.value
                )
              }
              className={inputClass}
              required
              disabled={
                loading ||
                saving ||
                !selectedReturnedProduct
              }
            >
              <option value="">
                Select replacement product
              </option>

              {replacementOptions.map((product) => (
                <option
                  key={product.stockId}
                  value={product.stockId}
                >
                  {productLabel(product)}
                  {" — "}
                  {product.availableQuantity} available
                </option>
              ))}
            </select>

            {selectedReturnedProduct &&
              replacementOptions.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  No matching replacement product
                  is currently available on this lorry.
                </p>
              )}
          </div>

          {/* REPLACEMENT QUANTITY */}

          <div>
            <label
              htmlFor="replacement-quantity"
              className="mb-2 block text-sm font-semibold"
            >
              Replacement Quantity
            </label>

            <input
              id="replacement-quantity"
              readOnly
              value={returnedQuantity}
              className={
                inputClass + " bg-slate-100"
              }
            />

            <p className="mt-2 text-xs text-slate-500">
              One-for-one replacement:
              replacement quantity equals returned quantity.
            </p>
          </div>

        </div>

        {/* ================================== */}
        {/* LIVE LORRY STOCK SUMMARY */}
        {/* ================================== */}

        {selectedReplacement && (
          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm">

            <div className="flex justify-between gap-3">
              <span>
                Available Lorry Quantity
              </span>

              <strong>
                {availableQuantity}
              </strong>
            </div>

            <div className="mt-3 flex justify-between gap-3">
              <span>
                Replacement Quantity
              </span>

              <strong>
                {validQuantity
                  ? quantityNumber
                  : "Invalid"}
              </strong>
            </div>

            <div className="mt-3 flex justify-between gap-3 border-t border-blue-200 pt-3">
              <span>
                Available Quantity After Replacement
              </span>

              <strong
                className={
                  stockAfterReplacement < 0
                    ? "text-red-600"
                    : "text-green-700"
                }
              >
                {Number.isFinite(stockAfterReplacement)
                  ? stockAfterReplacement
                  : 0}
              </strong>
            </div>

          </div>
        )}

        {/* ================================== */}
        {/* SUBMIT RETURN */}
        {/* ================================== */}

        <button
          type="submit"
          disabled={
            loading ||
            refreshing ||
            saving ||
            !shopName.trim() ||
            !selectedReturnedProduct ||
            !selectedReplacement ||
            !batchNumber.trim() ||
            !validQuantity ||
            !returnDate ||
            !actualReason
          }
          className={
            buttonClass + " mt-6 w-full"
          }
        >
          <CheckCircle2 size={18} />

          {saving
            ? "Saving Return..."
            : "Save Return & Issue Replacement"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Saving this return immediately records the
          returned products and deducts replacement stock
          from the active lorry. No Admin approval is required.
        </p>

      </form>

      {/* ================================== */}
      {/* RETURN HISTORY */}
      {/* ================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <h3 className="font-bold text-[#17265B]">
          Product Return History
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Returns recorded by the Sales Manager
          for the selected lorry.
        </p>

        <div className="mt-4 overflow-x-auto">

          <table className="w-full min-w-[900px] text-left text-sm">

            <thead className="bg-slate-100">

              <tr>
                <th className="p-3">
                  Return ID
                </th>

                <th className="p-3">
                  Shop
                </th>

                <th className="p-3">
                  Product
                </th>

                <th className="p-3">
                  Batch
                </th>

                <th className="p-3">
                  Date
                </th>

                <th className="p-3">
                  Reason
                </th>

                <th className="p-3 text-right">
                  Returned
                </th>

                <th className="p-3 text-right">
                  Replaced
                </th>

                <th className="p-3">
                  Status
                </th>
              </tr>

            </thead>

            <tbody>

              {history.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-200"
                >

                  <td className="p-3 font-semibold">
                    #{item.id}
                  </td>

                  <td className="p-3">
                    {item.shopName || "N/A"}
                  </td>

                  <td className="p-3">
                    {item.productName}

                    {item.flavour
                      ? ` - ${item.flavour}`
                      : ""}
                  </td>

                  <td className="p-3">
                    {item.batchNumber || "N/A"}
                  </td>

                  <td className="p-3">
                    {item.returnDate
                      ? String(item.returnDate)
                      : "N/A"}
                  </td>

                  <td className="p-3">
                    {item.returnReason || "N/A"}
                  </td>

                  <td className="p-3 text-right">
                    {item.returnedQuantity}
                  </td>

                  <td className="p-3 text-right">
                    {item.replacementQuantity ?? "N/A"}
                  </td>

                  <td className="p-3">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                      {item.status || "REPLACED"}
                    </span>
                  </td>

                </tr>
              ))}

              {!loading &&
                history.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-6 text-center text-slate-500"
                    >
                      No product returns recorded yet.
                    </td>
                  </tr>
                )}

              {loading &&
                history.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-6 text-center text-slate-500"
                    >
                      Loading return history...
                    </td>
                  </tr>
                )}

            </tbody>

          </table>

        </div>

      </div>

    </section>
  );
}
