
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Truck,
  ReceiptText,
  ClipboardList,
  RotateCcw,
  LogOut,
  RefreshCw,
  Package,
  MapPin,
  Wallet,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CreditCard,
  Search,
  Loader2,
  CheckCircle2,
  LockKeyhole,
  Landmark,
} from "lucide-react";

import { salesVehicleApi } from
  "../services/salesVehicleApi";

import WholesalePaymentPanel from
  "../components/payments/WholesalePaymentPanel";

import SalesBillingPanel from
  "../components/billing/SalesBillingPanel";

import DirectBankTransferPayment from
  "../components/billing/DirectBankTransferPayment";

import DirectChequePayment from
  "../components/billing/DirectChequePayment";

import { salesBillingApi } from
  "../services/salesBillingApi";

import SalesReturnsPanel from
  "../components/sales/SalesReturnsPanel";

import SalesOutletSupplyPanel from
  "../components/sales/SalesOutletSupplyPanel";

import SalesGroupedBatchInventory from
  "../components/sales/SalesGroupedBatchInventory";

// ==========================================
// TAILWIND STYLES
// ==========================================

const BATCH_INVENTORY_API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-slate-50 px-4 py-3 text-sm outline-none " +
  "focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100";

const buttonClass =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl bg-[#3654FF] px-5 py-3 text-sm " +
  "font-bold text-white hover:bg-[#2943D9] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ==========================================
// HELPERS
// ==========================================

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  if (value == null || value === "") {
    return "Not available";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(number);
}

function isTrue(value) {
  return (
    value === true ||
    value === 1 ||
    String(value ?? "").toLowerCase() === "true" ||
    String(value ?? "") === "1"
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");
}

function available(product) {
  return num(
    product.availableQuantity ??
      (
        num(product.quantity) -
        num(product.reservedQuantity)
      )
  );
}

function orderIdOf(order) {
  return order?.orderId ?? order?.id;
}

function delivered(order) {
  return String(
    order.deliveryStatus ??
      order.status ??
      ""
  ).toUpperCase() === "DELIVERED";
}

function paymentLabel(value) {
  const labels = {
    cash: "Cash",
    bank: "Bank Transfer",
    bank_transfer: "Bank Transfer",
    cheque: "Cheque",
    credit: "Credit",
    confirm: "Confirm with Wholesale Team",
  };

  return (
    labels[String(value ?? "").toLowerCase()] ||
    value ||
    "Not specified"
  );
}

function orderTotal(order) {
  const stored =
    order.orderTotal ??
    order.finalTotal ??
    order.totalAmount ??
    order.total;

  if (
    stored !== null &&
    stored !== undefined &&
    Number.isFinite(Number(stored))
  ) {
    return Number(stored);
  }

  return (order.items ?? []).reduce(
    (sum, item) =>
      sum +
      num(
        item.subtotal ??
          num(item.quantity) *
            num(item.unitPrice ?? item.unit_price)
      ),
    0
  );
}

function withTimeout(promise, ms, message) {
  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(message)),
        ms
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

// ==========================================
// SESSION NORMALIZATION
// ==========================================

function normalizeSession(data) {
  if (!data || typeof data !== "object") {
    return {
      active: false,
      vehicleId: null,
      vehicleNumber: "",
    };
  }

  const rawId =
    data.vehicleId ??
    data.vehicle_id ??
    data.vehicle?.id;

  const id = Number(rawId);

  const active =
    isTrue(data.active) &&
    rawId != null &&
    rawId !== "" &&
    Number.isSafeInteger(id) &&
    id > 0;

  return {
    ...data,
    active,
    vehicleId: active ? id : null,
    vehicleNumber:
      data.vehicleNumber ??
      data.vehicle_number ??
      data.vehicle?.vehicleNumber ??
      "",
  };
}

function normalizeVehicle(vehicle) {
  return {
    ...vehicle,

    id: Number(
      vehicle.id ??
        vehicle.vehicleId ??
        vehicle.vehicle_id
    ),

    vehicleNumber:
      vehicle.vehicleNumber ??
      vehicle.vehicle_number ??
      "Unknown Vehicle",

    status: String(
      vehicle.status ?? "UNKNOWN"
    ).toUpperCase(),

    occupied: isTrue(vehicle.occupied),

    selectedByMe: isTrue(
      vehicle.selectedByMe ??
        vehicle.selected_by_me
    ),
  };
}

function canSelectVehicle(vehicle) {
  const disabledStatuses = [
    "INACTIVE",
    "MAINTENANCE",
    "OUT_OF_SERVICE",
    "DISABLED",
  ];

  return (
    Number.isSafeInteger(vehicle.id) &&
    vehicle.id > 0 &&
    !disabledStatuses.includes(vehicle.status) &&
    (!vehicle.occupied || vehicle.selectedByMe)
  );
}

// ==========================================
// APPROVED FACTORY PRODUCTS
// ==========================================
//
// These IDs identify the products the factory
// produces. Inventory is NEVER hardcoded here.
// Every quantity comes from the backend.
//
// ==========================================

const APPROVED_PRODUCT_IDS = new Set([
  "500ml-tub",
  "1l-tub",
  "2l-tub",
  "4l-bag",
  "ice-cream-cup",
  "80ml-cup",
  "popsicle",
  "ice-packet",
]);

const ICE_CREAM_FLAVOURS = new Set([
  "vanilla",
  "chocolate",
  "fruit and nut",
]);

function isFactoryProduct(product) {
  const id = normalizeText(
    product.productId ?? product.product_id
  );

  const flavour = normalizeText(product.flavour);

  if (id === "yoghurt-drink") {
    return [
      "yoghurt",
      "plain",
      "original",
    ].includes(flavour);
  }

  return (
    APPROVED_PRODUCT_IDS.has(id) &&
    ICE_CREAM_FLAVOURS.has(flavour)
  );
}

// ==========================================
// INVENTORY NORMALIZATION
// ==========================================

function normalizeInventory(data) {
  if (!Array.isArray(data)) {
    throw new Error(
      "The inventory API must return an array."
    );
  }

  return data.map((item, index) => {
    const quantity = num(item.quantity);

    const reservedQuantity = num(
      item.reservedQuantity ??
        item.reserved_quantity
    );

    return {
      ...item,

      id:
        item.id ??
        `stock-${index}`,

      vehicleId:
        item.vehicleId ??
        item.vehicle_id,

      productId:
        item.productId ??
        item.product_id ??
        "",

      productName:
        item.productName ??
        item.product_name ??
        item.name ??
        item.productId ??
        "",

      size: item.size ?? "",
      flavour: item.flavour ?? "",

      quantity,
      reservedQuantity,

      availableQuantity: num(
        item.availableQuantity ??
          item.available_quantity ??
          (quantity - reservedQuantity)
      ),
    };
  });
}

function stockTotals(products) {
  return products.reduce(
    (total, product) => ({
      physical:
        total.physical + num(product.quantity),

      reserved:
        total.reserved +
        num(product.reservedQuantity),

      available:
        total.available + available(product),
    }),
    {
      physical: 0,
      reserved: 0,
      available: 0,
    }
  );
}

function productDisplayName(product) {
  if (
    normalizeText(product.productId) ===
    "yoghurt-drink"
  ) {
    return "Yoghurt Drink";
  }

  return [
    product.flavour,
    product.productName,
  ].filter(Boolean).join(" ");
}

function googleMapsUrl(order) {
  const lat =
    order.latitude ??
    order.deliveryLatitude;

  const lng =
    order.longitude ??
    order.deliveryLongitude;

  if (
    lat != null &&
    lng != null &&
    lat !== "" &&
    lng !== ""
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return (
        "https://www.google.com/maps/dir/?api=1" +
        "&destination=" +
        encodeURIComponent(
          `${latitude},${longitude}`
        )
      );
    }
  }

  const address =
    order.deliveryAddress ??
    order.address;

  return address
    ? "https://www.google.com/maps/dir/?api=1" +
      "&destination=" +
      encodeURIComponent(address)
    : null;
}

// ==========================================
// SUMMARY CARD
// ==========================================

function SummaryCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </article>
  );
}

// ==========================================
// INVENTORY CARD
// ==========================================

function InventoryCard({ product }) {
  const physical = num(product.quantity);
  const reserved = num(product.reservedQuantity);
  const remaining = available(product);

  const percentage =
    physical > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (remaining / physical) * 100
          )
        )
      : 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">
        {productDisplayName(product)}
        {product.size
          ? ` (${product.size})`
          : ""}
      </p>

      <p className="mt-3 text-xl font-bold">
        {remaining} Available
      </p>

      <div className="mt-4 flex justify-between gap-3 text-xs text-slate-500">
        <span>
          Physical: {physical}
        </span>

        <span>
          Reserved: {reserved}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#3654FF]"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </article>
  );
}

// ==========================================
// BANK PAYMENT STATUS (ADMIN REVIEW ONLY)
// ==========================================

function isBankPayment(value) {
  const method = String(value ?? "")
    .trim().toUpperCase().replace(/[\s-]+/g, "_");
  return method === "BANK" || method === "BANK_TRANSFER";
}

function BankPaymentStatus({ orderId }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    setSummary(null);
    setError("");
    setLoading(true);

    async function load() {
      if (cancelled || running) return;
      running = true;
      try {
        const data = await withTimeout(
          salesVehicleApi.getPaymentSummary(orderId),
          12000,
          "Loading bank payment status timed out."
        );
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Invalid payment summary response.");
        }
        if (!cancelled) {
          setSummary(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load payment status.");
        }
      } finally {
        running = false;
        if (!cancelled) setLoading(false);
      }
    }

    refreshRef.current = load;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      refreshRef.current = null;
    };
  }, [orderId]);

  const records = summary?.receipts ?? summary?.payments ?? summary?.paymentRecords;
  const receipts = Array.isArray(records)
    ? records.filter((receipt) => isBankPayment(receipt.method ?? receipt.paymentMethod))
    : [];

  function receiptStatus(receipt) {
    const status = String(receipt.status ?? "").toUpperCase();
    if (["VERIFIED", "CONFIRMED", "APPROVED"].includes(status)) {
      return { label: "Payment Approved by Admin", color: "bg-green-50 text-green-700" };
    }
    if (status === "REJECTED") {
      return { label: "Bank Slip Rejected by Admin", color: "bg-red-50 text-red-700" };
    }
    if (status === "PENDING_REVIEW") {
      return { label: "Awaiting Admin Approval", color: "bg-amber-50 text-amber-700" };
    }
    return { label: status.replaceAll("_", " ") || "Status unavailable", color: "bg-slate-100 text-slate-600" };
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold">
          <CreditCard size={17} /> Bank Transfer Payment
        </h4>
        <button type="button" onClick={() => refreshRef.current?.()}
          disabled={loading} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 disabled:opacity-50">
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Only the Admin can review bank slips and approve payments.
      </p>
      {loading && <p className="mt-3 text-sm text-slate-500">Loading payment status...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {!error && summary && (
        <>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span>Confirmed Paid</span>
              <strong className="text-green-700">{money(summary.confirmedPaid)}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>Remaining Balance</span>
              <strong>{money(summary.remainingBalance)}</strong>
            </div>
          </div>
          {receipts.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">{Array.isArray(records) ? "No bank transfer receipt has been submitted." : "Bank receipt status is unavailable."}</p>
          )}
          {receipts.map((receipt, index) => {
            const status = receiptStatus(receipt);
            return (
              <div key={receipt.id ?? receipt.receiptId ?? index}
                className="mt-3 rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{money(receipt.verifiedAmount ?? receipt.amount ?? receipt.paymentAmount)}</span>
                  <span className={"rounded-full px-3 py-1 text-xs font-bold " + status.color}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

// ==========================================
// WHOLESALE ORDER CARD
// ==========================================
//
// Uses the existing WholesalePaymentPanel.
// Wholesale payments remain independent
// from direct sales bills.
//
// ==========================================

function WholesaleOrderCard({
  order,
  onPaymentRecorded,
}) {
  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const isDelivered = delivered(order);
  const routeUrl = googleMapsUrl(order);
  const id = orderIdOf(order);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            Order #{id}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {order.shopName ||
              "Wholesale Customer"}
          </p>
        </div>

        <span
          className={
            "rounded-full px-3 py-1 text-xs font-bold " +
            (
              isDelivered
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            )
          }
        >
          {String(
            order.deliveryStatus ??
              order.status ??
              "UNKNOWN"
          ).replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-5 space-y-2 text-sm text-slate-600">
        <p>
          <strong>Phone:</strong>{" "}
          {order.phone || "Not provided"}
        </p>

        <p>
          <strong>Address:</strong>{" "}
          {order.deliveryAddress ||
            order.address ||
            "Not provided"}
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <h4 className="mb-3 text-xs font-bold uppercase text-slate-500">
          Ordered Products
        </h4>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No products returned.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={
                item.itemId ??
                item.id ??
                index
              }
              className="flex justify-between gap-4 border-b border-slate-200 py-3 text-sm last:border-0"
            >
              <div>
                <p className="font-semibold">
                  {item.productName ||
                    item.name ||
                    item.productId}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.flavour}

                  {item.size
                    ? ` (${item.size})`
                    : ""}
                </p>
              </div>

              <strong>
                × {item.quantity}
              </strong>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-between gap-4 rounded-xl bg-amber-50 p-4">
        <div>
          <p className="text-xs text-slate-500">
            Payment Method
          </p>

          <p className="mt-1 font-bold">
            {paymentLabel(order.paymentMethod)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Status:{" "}
            {order.paymentStatus || "PENDING"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">
            Order Total
          </p>

          <p className="mt-1 font-bold">
            {money(orderTotal(order))}
          </p>
        </div>
      </div>

      {isBankPayment(order.paymentMethod) ? (
        isDelivered ? (
          <BankPaymentStatus key={id} orderId={id} />
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Bank payment is reviewed by the Admin after delivery.
          </p>
        )
      ) : (
        <WholesalePaymentPanel
          key={id}
          order={{
            ...order,

            orderId: id,

            orderTotal: orderTotal(order),

            deliveryStatus:
              order.deliveryStatus ??
              order.status,
          }}
          onRecorded={onPaymentRecorded}
        />
      )}

      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600"
        >
          <MapPin size={16} />
          Open Google Maps Route
        </a>
      )}
    </article>
  );
}

// ==========================================
// SALES BILLING CREDIT BALANCES
// ==========================================
// Separate from wholesale order credit.
// Backend must expose the sales credit listing
// and later cash collection APIs.
// These are NOT aliases for wholesale payments.
// ==========================================

function SalesBillingCreditBalances({
  vehicleId,
  refreshVersion,
  onRecorded,
}) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amounts, setAmounts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const keysRef = useRef({});
  const mountedRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");

    try {
      if (typeof salesBillingApi.getCreditBalances !== "function") {
        throw new Error(
          "Sales billing credit API is not connected yet. " +
          "Add getCreditBalances() to salesBillingApi.js " +
          "and implement GET /api/sales/bills/credit-balances in Spring Boot."
        );
      }

      // Access control and vehicle scoping must be enforced
      // by Spring Boot using the authenticated sales session.
      const result = await salesBillingApi.getCreditBalances();
      if (!Array.isArray(result)) {
        throw new Error("Invalid sales credit bills response.");
      }

      const normalized = result
        .map((bill) => ({
          ...bill,
          id: bill.billId ?? bill.id,
          totalAmount: bill.billTotal ?? bill.totalAmount,
          confirmedCash: bill.confirmedPaid ?? bill.confirmedCash,
          remainingBalance: bill.remainingBalance,
        }))
        .filter((bill) => {
          const id = Number(bill.id);
          const remaining = Number(bill.remainingBalance);
          return Number.isSafeInteger(id) && id > 0 &&
            Number.isFinite(remaining) && remaining > 0 &&
            String(bill.paymentMethod ?? "CREDIT").toUpperCase() === "CREDIT" &&
            (bill.vehicleId == null || Number(bill.vehicleId) === Number(vehicleId));
        });

      if (mountedRef.current && requestId === requestRef.current) {
        setBills(normalized);
      }
    } catch (err) {
      if (mountedRef.current && requestId === requestRef.current) {
        setError(err?.message || "Unable to load sales invoice credit.");
      }
    } finally {
      if (mountedRef.current && requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [vehicleId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && busyId == null) load();
    }, 15000);
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [load, refreshVersion, busyId]);

  // IMPORTANT: receiptKey persists after uncertain network
  // results. Changing the amount creates a new collection intent.
  function editAmount(billId, value) {
    setAmounts((previous) => ({ ...previous, [billId]: value }));
    delete keysRef.current[billId];
  }

  async function collect(bill) {
    const id = Number(bill.id);
    if (busyId != null || !Number.isSafeInteger(id) || id <= 0) return;
    const text = String(amounts[id] ?? "").trim();
    const remaining = Number(bill.remainingBalance);
    const amount = Number(text);

    if (!/^\d+(\.\d{1,2})?$/.test(text) ||
        !Number.isFinite(amount) || amount <= 0 ||
        amount > remaining || amount > 9999999999.99) {
      setError("Enter a valid amount up to the outstanding invoice balance.");
      return;
    }

    if (typeof salesBillingApi.collectCreditCash !== "function") {
      setError(
        "Later cash collection API is not connected yet. " +
        "Add collectCreditCash(billId, amount, receiptKey) to salesBillingApi.js " +
        "and the corresponding Spring Boot endpoint."
      );
      return;
    }

    if (!window.confirm(
      `Confirm that ${money(amount)} physical cash was actually received for INV-${id}?`
    )) return;

    if (!keysRef.current[id]) keysRef.current[id] = crypto.randomUUID();
    setBusyId(id);
    setError("");
    try {
      await salesBillingApi.collectCreditCash(
        id, amount.toFixed(2), keysRef.current[id]
      );
      delete keysRef.current[id];
      setAmounts((previous) => ({ ...previous, [id]: "" }));
      await load();
      try { await onRecorded?.(); } catch (refreshError) {
        console.warn("Cash recorded, but dashboard refresh failed:", refreshError);
      }
    } catch (err) {
      setError(
        (err?.message || "Unable to record cash.") +
        " If the request may have succeeded, refresh the invoice before retrying."
      );
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  }

  const outstanding = bills.reduce(
    (sum, bill) => sum + Number(bill.remainingBalance), 0
  );

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold">Sales Billing Credit</h2>
          <p className="mt-2 text-sm text-slate-500">
            Unpaid balances from invoices created through the Billing tab.
            These are separate from wholesale order credit.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading || busyId != null}
          className={buttonClass}>
          <RefreshCw size={16} /> Refresh Sales Credit
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Outstanding Sales Invoice Credit</p>
        <p className="mt-3 text-3xl font-bold text-rose-600">
          {error && bills.length === 0 ? "Unavailable" :
            loading && bills.length === 0 ? "Loading..." : money(outstanding)}
        </p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {bills.map((bill) => {
          const id = bill.id;
          const remaining = Number(bill.remainingBalance);
          return (
            <article key={id} className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="font-bold">{bill.invoiceNumber || `Invoice INV-${id}`}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {bill.shopName || bill.customerName || "Customer"}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>Invoice Total</span><strong>{money(bill.totalAmount)}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Confirmed Cash</span>
                  <strong className="text-green-600">{money(bill.confirmedCash)}</strong>
                </div>
                <div className="flex justify-between gap-3 border-t pt-3">
                  <span>Remaining Credit</span>
                  <strong className="text-rose-600">{money(remaining)}</strong>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-green-200 p-4">
                <label htmlFor={`sales-credit-${id}`}
                  className="block text-sm font-semibold">
                  Later Cash Collected (LKR)
                </label>
                <input id={`sales-credit-${id}`} type="number" step="0.01" min="0.01"
                  max={remaining} className={inputClass + " mt-2"}
                  value={amounts[id] ?? ""} disabled={busyId != null}
                  onChange={(event) => editAmount(id, event.target.value)}
                  placeholder="Amount actually received" />
                <button type="button" className={buttonClass + " mt-3 w-full"}
                  disabled={busyId != null || !amounts[id]}
                  onClick={() => collect(bill)}>
                  <Wallet size={16} />
                  {busyId === id ? "Recording..." : "Record Cash Collection"}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  Cash is recorded against this invoice only after actual collection.
                </p>
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !error && bills.length === 0 && (
        <p className="mt-5 text-sm text-slate-500">
          No outstanding sales billing credit invoices found.
        </p>
      )}
    </section>
  );
}

// ==========================================
// CREDIT BALANCES
// ==========================================
//
// Existing wholesale credit workflow retained.
//
// ==========================================

function CreditBalances({
  orders,
  onRecorded,
}) {
  const creditOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          delivered(order) &&
          normalizeText(
            order.paymentMethod
          ) === "credit"
      ),
    [orders]
  );

  const [balances, setBalances] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.all(
        creditOrders.map(async (order) => {
          const summary =
            await salesVehicleApi.getPaymentSummary(
              orderIdOf(order)
            );

          return {
            ...order,
            ...summary,

            orderId: orderIdOf(order),

            shopName:
              order.shopName ??
              summary.shopName,

            orderTotal:
              summary.orderTotal ??
              orderTotal(order),
          };
        })
      );

      setBalances(results);
    } catch (err) {
      setBalances([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [creditOrders]);

  useEffect(() => {
    load();
  }, [load]);

  const outstanding = balances.reduce(
    (sum, order) =>
      sum + num(order.remainingBalance),
    0
  );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold">
            Credit Balances
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Confirmed payments and remaining balances
            for delivered wholesale credit orders.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={load}
          className={buttonClass}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Outstanding Credit
        </p>

        <p className="mt-3 text-3xl font-bold text-rose-600">
          {error
            ? "Unavailable"
            : loading
              ? "Loading..."
              : money(outstanding)}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {balances.map((order) => (
          <article
            key={order.orderId}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <h3 className="font-bold">
              Order #{order.orderId}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {order.shopName}
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>
                  Order Total
                </span>

                <strong>
                  {money(order.orderTotal)}
                </strong>
              </div>

              <div className="flex justify-between">
                <span>
                  Confirmed Paid
                </span>

                <strong className="text-green-600">
                  {money(order.confirmedPaid)}
                </strong>
              </div>

              <div className="flex justify-between border-t pt-3">
                <span>
                  Remaining
                </span>

                <strong className="text-rose-600">
                  {money(order.remainingBalance)}
                </strong>
              </div>
            </div>

            <WholesalePaymentPanel
              order={{
                ...order,
                paymentMethod: "credit",
                deliveryStatus: "DELIVERED",
              }}
              onRecorded={async () => {
                await load();
                await onRecorded?.();
              }}
            />
          </article>
        ))}
      </div>

      {!loading &&
        !error &&
        balances.length === 0 && (
          <p className="mt-5 text-sm text-slate-500">
            No delivered wholesale credit orders found.
          </p>
        )}
    </section>
  );
}

// ==========================================
// DIRECT SALES BANK TRANSFER / CHEQUE STATUS
// ==========================================
// An invoice is retrieved using its numeric ID.
// Spring Boot checks that the authenticated Sales
// Manager owns it. No payment is confirmed here.
// The two existing standalone components handle
// slip / photo uploads and their review status.
// ==========================================

function DirectSalesPayments({
  lastBillId,
  onPaymentRecorded,
}) {
  const [searchId, setSearchId] = useState(
    lastBillId ? String(lastBillId) : ""
  );
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    if (lastBillId) {
      setSearchId(String(lastBillId));
    }
  }, [lastBillId]);

  const loadBill = useCallback(async (targetId) => {
    const id = Number(targetId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Enter a valid numeric sales invoice ID.");
      return null;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    setSelectedBill(null);
    setPaymentSummary(null);

    try {
      const bill = await salesBillingApi.getBill(id);
      if (!bill || Number(bill.id) !== id) {
        throw new Error("Invalid invoice response.");
      }
      if (!["BANK_TRANSFER", "CHEQUE"].includes(
        String(bill.paymentMethod || "").toUpperCase()
      )) {
        throw new Error(
          "This invoice uses Cash or Credit. Open Credit Balances " +
          "to manage outstanding credit collections."
        );
      }
      const summary = await salesBillingApi.getBillPayments(id);
      if (requestId === requestRef.current) {
        setSelectedBill(bill);
        setPaymentSummary(summary);
      }
      return bill;
    } catch (err) {
      if (requestId === requestRef.current) {
        setError(err?.message || "Unable to load payment details.");
      }
      return null;
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedBill?.id) return;
    try {
      const [updated, summary] = await Promise.all([
        salesBillingApi.getBill(selectedBill.id),
        salesBillingApi.getBillPayments(selectedBill.id),
      ]);
      setSelectedBill(updated);
      setPaymentSummary(summary);
    } catch (err) {
      setError(err?.message || "Unable to refresh invoice status.");
    }
  }, [selectedBill?.id]);

  const records = Array.isArray(paymentSummary?.payments)
    ? paymentSummary.payments
    : [];
  const latest = records.find((record) =>
    String(record.method || "").toUpperCase() ===
    String(selectedBill?.paymentMethod || "").toUpperCase()
  );
  const paymentStatus = latest?.status || "NOT_SUBMITTED";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#17265B]">
          Direct Sales Payments
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Search a Sales Billing invoice to upload bank transfer or cheque
          evidence and see its Admin review status. Wholesale payments are
          managed separately under Wholesale Orders.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          loadBill(searchId);
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <label htmlFor="direct-sales-bill-search" className="block text-sm font-bold">
          Sales Invoice Number
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="direct-sales-bill-search"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={searchId}
            onChange={(event) => setSearchId(event.target.value)}
            placeholder="For example: 12 for INV-12"
            className={inputClass + " flex-1"}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            <Search size={16} />
            {loading ? "Loading..." : "Find Invoice"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {selectedBill && (
        <>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Invoice INV-{selectedBill.id}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedBill.customerName || "Customer"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedBill.vehicleNumber || ""}
                </p>
              </div>
              <button type="button" onClick={refreshSelected}
                className={buttonClass}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Invoice Total" value={money(selectedBill.totalAmount)} />
              <SummaryCard label="Remaining Balance" value={money(selectedBill.remainingBalance)} />
              <SummaryCard label="Proof Status" value={
                String(paymentStatus).replaceAll("_", " ")
              } />
            </div>
            <p className="mt-4 text-xs text-slate-600">
              A submitted proof does not count as payment. Admin must verify
              the bank deposit or confirm cheque clearance.
            </p>
          </article>

          {selectedBill.paymentMethod === "BANK_TRANSFER" && (
            <DirectBankTransferPayment
              key={`bank-${selectedBill.id}`}
              bill={selectedBill}
              onSubmitted={async () => {
                await refreshSelected();
                await onPaymentRecorded?.(selectedBill);
              }}
              onPaymentStatusChanged={refreshSelected}
            />
          )}

          {selectedBill.paymentMethod === "CHEQUE" && (
            <DirectChequePayment
              key={`cheque-${selectedBill.id}`}
              bill={selectedBill}
              onSubmitted={async () => {
                await refreshSelected();
                await onPaymentRecorded?.(selectedBill);
              }}
              onPaymentStatusChanged={refreshSelected}
            />
          )}
        </>
      )}
    </section>
  );
}

// ==========================================
// MAIN SALES MANAGER DASHBOARD
// ==========================================

export default function SalesManagerDashboard({
  user,
  onLogout,
}) {
  const navigate = useNavigate();

  // ========================================
  // SESSION STATE
  // ========================================

  const [initializing, setInitializing] =
    useState(true);

  const [session, setSession] =
    useState(null);

  const [sessionError, setSessionError] =
    useState("");

  const [vehicles, setVehicles] =
    useState([]);

  const [loadingVehicles, setLoadingVehicles] =
    useState(false);

  const [selectingVehicleId, setSelectingVehicleId] =
    useState(null);

  const [endingSession, setEndingSession] =
    useState(false);

  const selectingRef = useRef(false);
  const generationRef = useRef(0);

  // ========================================
  // DASHBOARD STATE
  // ========================================

  const [activeTab, setActiveTab] =
    useState("Billing");

  const [creditRefreshVersion, setCreditRefreshVersion] =
    useState(0);

  // Most recently created direct invoice, for quick payment lookup.
  const [lastDirectBillId, setLastDirectBillId] = useState(null);

  const [allStock, setAllStock] =
    useState([]);

  // Separate read-only batch inventory; aggregate stock stays intact.
  const [groupedBatchInventory, setGroupedBatchInventory] =
    useState([]);

  const [batchInventoryLoading, setBatchInventoryLoading] =
    useState(false);

  const [batchInventoryError, setBatchInventoryError] =
    useState("");

  const [orders, setOrders] =
    useState([]);

  const [inventoryLoading, setInventoryLoading] =
    useState(false);

  const [ordersLoading, setOrdersLoading] =
    useState(false);

  const [inventoryError, setInventoryError] =
    useState("");

  const [ordersError, setOrdersError] =
    useState("");

  const [cashSummary, setCashSummary] =
    useState(null);

  const [cashLoading, setCashLoading] =
    useState(false);

  const [cashError, setCashError] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [inventorySearch, setInventorySearch] =
    useState("");

  const [showExcluded, setShowExcluded] =
    useState(false);

  // ========================================
  // CURRENT VEHICLE
  // ========================================

  const vehicleId = session?.active
    ? Number(session.vehicleId)
    : null;

  const auth = useMemo(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("seventeen_auth") ||
          "null"
      );
    } catch {
      return null;
    }
  }, []);

  const managerName =
    user?.fullName ||
    auth?.user?.fullName ||
    auth?.fullName ||
    "Sales Representative";

  // ========================================
  // RESET DASHBOARD
  // ========================================

  const resetDashboard = useCallback(() => {
    generationRef.current += 1;

    setAllStock([]);
    setGroupedBatchInventory([]);
    setBatchInventoryLoading(false);
    setBatchInventoryError("");
    setOrders([]);
    setCashSummary(null);

    setInventoryError("");
    setOrdersError("");
    setCashError("");

    setInventorySearch("");
    setShowExcluded(false);

    setActiveTab("Billing");
    setCreditRefreshVersion((version) => version + 1);
    setLastDirectBillId(null);
  }, []);

  // ========================================
  // LOAD VEHICLES
  // ========================================

  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);

    try {
      const response = await withTimeout(
        salesVehicleApi.getVehicles(),
        12000,
        "Loading vehicles timed out."
      );

      if (!Array.isArray(response)) {
        throw new Error(
          "Invalid vehicle list returned."
        );
      }

      const normalized =
        response.map(normalizeVehicle);

      setVehicles(normalized);

      return normalized;
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  // ========================================
  // INITIAL SESSION CHECK
  // ========================================

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setInitializing(true);

      try {
        const response = await withTimeout(
          salesVehicleApi.currentSession(),
          12000,
          "Checking sales session timed out."
        );

        if (cancelled) return;

        const current =
          normalizeSession(response);

        setSession(current);
        setSessionError("");

        if (!current.active) {
          await loadVehicles();
        }
      } catch (err) {
        if (!cancelled) {
          setSessionError(err.message);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadVehicles]);

  // ========================================
  // RETRY SESSION
  // ========================================

  async function retrySession() {
    setInitializing(true);
    setSessionError("");

    try {
      const response = await withTimeout(
        salesVehicleApi.currentSession(),
        12000,
        "Sales session verification timed out."
      );

      const current = normalizeSession(response);

      resetDashboard();
      setSession(current);

      if (!current.active) {
        await loadVehicles();
      }
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setInitializing(false);
    }
  }

  // ========================================
  // SELECT VEHICLE
  // ========================================

  async function chooseVehicle(id) {
    if (
      selectingRef.current ||
      endingSession ||
      sessionError
    ) {
      return;
    }

    const numericId = Number(id);

    const chosen = vehicles.find(
      (item) => item.id === numericId
    );

    if (
      !chosen ||
      !canSelectVehicle(chosen)
    ) {
      setError(
        "This vehicle is unavailable."
      );
      return;
    }

    selectingRef.current = true;
    setSelectingVehicleId(numericId);

    setError("");
    setMessage("");

    try {
      await withTimeout(
        salesVehicleApi.selectVehicle(numericId),
        20000,
        "Vehicle selection timed out."
      );

      const response = await withTimeout(
        salesVehicleApi.currentSession(),
        12000,
        "Unable to confirm selected vehicle."
      );

      const current =
        normalizeSession(response);

      if (
        !current.active ||
        current.vehicleId !== numericId
      ) {
        throw new Error(
          "Spring Boot did not confirm " +
            "the selected vehicle."
        );
      }

      resetDashboard();

      setSession({
        ...current,

        vehicleNumber:
          current.vehicleNumber ||
          chosen.vehicleNumber,
      });

      setSessionError("");

      setMessage(
        `${chosen.vehicleNumber} selected successfully.`
      );
    } catch (err) {
      setError(err.message);

      // A timed-out request may still have
      // created the backend session.
      try {
        const response = await withTimeout(
          salesVehicleApi.currentSession(),
          10000,
          "Session recovery timed out."
        );

        const current =
          normalizeSession(response);

        if (current.active) {
          resetDashboard();
          setSession(current);

          setSessionError("");
          setError("");
        } else {
          setSession(current);
          setSessionError("");

          await loadVehicles();
        }
      } catch {
        setSessionError(
          "Vehicle selection status is unknown. " +
            "Check your session before retrying."
        );
      }
    } finally {
      selectingRef.current = false;
      setSelectingVehicleId(null);
    }
  }

  // ========================================
  // END VEHICLE SESSION
  // ========================================

  async function endVehicleSession() {
    if (
      endingSession ||
      selectingRef.current
    ) {
      return;
    }

    if (
      !window.confirm(
        "End your current vehicle session?"
      )
    ) {
      return;
    }

    setEndingSession(true);
    setError("");

    try {
      await withTimeout(
        salesVehicleApi.endSession(),
        20000,
        "Ending vehicle session timed out."
      );

      const current = normalizeSession(
        await withTimeout(
          salesVehicleApi.currentSession(),
          12000,
          "Unable to verify session closure."
        )
      );

      if (current.active) {
        throw new Error(
          "The session is still active."
        );
      }

      resetDashboard();
      setSession(current);

      await loadVehicles();

      setMessage(
        "Vehicle session ended successfully."
      );
    } catch (err) {
      setError(err.message);

      try {
        const current = normalizeSession(
          await withTimeout(
            salesVehicleApi.currentSession(),
            10000,
            "Unable to recover session state."
          )
        );

        resetDashboard();
        setSession(current);

        if (!current.active) {
          await loadVehicles();
        }
      } catch {
        setSessionError(
          "Unable to verify vehicle session state."
        );
      }
    } finally {
      setEndingSession(false);
    }
  }

  // ========================================
  // LOAD INVENTORY
  // ========================================

  const loadInventory = useCallback(async () => {
    if (!vehicleId) return;

    const generation = generationRef.current;

    setInventoryLoading(true);
    setInventoryError("");

    try {
      const response = await withTimeout(
        salesVehicleApi.getInventory(vehicleId),
        15000,
        "Loading lorry inventory timed out."
      );

      const normalized =
        normalizeInventory(response);

      if (
        generation !== generationRef.current
      ) {
        return;
      }

      const correctVehicle = normalized.filter(
        (product) =>
          product.vehicleId == null ||
          Number(product.vehicleId) === vehicleId
      );

      setAllStock(correctVehicle);
    } catch (err) {
      if (
        generation === generationRef.current
      ) {
        setInventoryError(err.message);
      }
    } finally {
      if (
        generation === generationRef.current
      ) {
        setInventoryLoading(false);
      }
    }
  }, [vehicleId]);

  // ========================================
  // LOAD GROUPED BATCH INVENTORY (READ ONLY)
  // ========================================

  const loadGroupedBatchInventory = useCallback(async () => {
    if (!vehicleId) return;

    const generation = generationRef.current;
    setBatchInventoryLoading(true);
    setBatchInventoryError("");

    try {
      // Read the token at request time, so session refreshes are supported.
      let savedAuth = null;
      try {
        savedAuth = JSON.parse(
          sessionStorage.getItem("seventeen_auth") || "null"
        );
      } catch {
        savedAuth = null;
      }

      const token =
        savedAuth?.token ||
        savedAuth?.accessToken ||
        savedAuth?.jwt ||
        savedAuth?.user?.token;

      if (!token) {
        throw new Error("Login token missing. Please sign in again.");
      }

      const controller = new AbortController();
      const request = fetch(
        `${BATCH_INVENTORY_API_BASE}/api/sales/vehicles/${vehicleId}/batch-inventory`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        }
      );

      let response;
      try {
        response = await withTimeout(
          request,
          15000,
          "Loading batch inventory timed out."
        );
      } catch (requestError) {
        controller.abort();
        throw requestError;
      }

      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch {
          // A non-JSON error body is handled below.
        }
        throw new Error(
          details?.message || details?.detail ||
          (response.status === 403
            ? "Select this lorry before viewing its batches."
            : `Batch inventory request failed (${response.status}).`)
        );
      }

      const result = await response.json();
      if (!Array.isArray(result)) {
        throw new Error("Batch inventory API must return an array.");
      }

      if (generation !== generationRef.current) return;

      setGroupedBatchInventory(
        result.filter(
          (item) =>
            item.vehicleId == null ||
            Number(item.vehicleId) === vehicleId
        )
      );
    } catch (err) {
      if (generation === generationRef.current) {
        setBatchInventoryError(
          err?.message || "Unable to load grouped batch inventory."
        );
      }
    } finally {
      if (generation === generationRef.current) {
        setBatchInventoryLoading(false);
      }
    }
  }, [vehicleId]);

  // Load on tab entry and refresh every 15 seconds while this tab is visible.
  useEffect(() => {
    if (activeTab !== "Lorry Inventory" || !vehicleId) return;

    loadGroupedBatchInventory();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadGroupedBatchInventory();
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [activeTab, vehicleId, loadGroupedBatchInventory]);

  // ========================================
  // LOAD ORDERS
  // ========================================

  const loadOrders = useCallback(async () => {
    if (!vehicleId) return;

    const generation = generationRef.current;

    setOrdersLoading(true);
    setOrdersError("");

    try {
      const result = await withTimeout(
        salesVehicleApi.getOrders(vehicleId),
        15000,
        "Loading wholesale orders timed out."
      );

      if (!Array.isArray(result)) {
        throw new Error(
          "Invalid wholesale orders response."
        );
      }

      if (
        generation === generationRef.current
      ) {
        setOrders(result);
      }
    } catch (err) {
      if (
        generation === generationRef.current
      ) {
        setOrdersError(err.message);
      }
    } finally {
      if (
        generation === generationRef.current
      ) {
        setOrdersLoading(false);
      }
    }
  }, [vehicleId]);

  // ========================================
  // LOAD TODAY'S CASH
  // ========================================

  const loadCash = useCallback(async () => {
    if (!vehicleId) return;

    const generation = generationRef.current;

    setCashLoading(true);
    setCashError("");

    try {
      const result = await withTimeout(
        salesVehicleApi.getTodaysCash(),
        15000,
        "Loading Today's Cash timed out."
      );

      if (
        result?.todaysCash == null ||
        !Number.isFinite(
          Number(result.todaysCash)
        )
      ) {
        throw new Error(
          "Invalid Today's Cash response."
        );
      }

      if (
        generation === generationRef.current
      ) {
        setCashSummary({
          todaysCash: Number(
            result.todaysCash
          ),

          date: result.date ?? "",

          currency:
            result.currency ?? "LKR",
        });
      }
    } catch (err) {
      if (
        generation === generationRef.current
      ) {
        setCashError(err.message);
      }
    } finally {
      if (
        generation === generationRef.current
      ) {
        setCashLoading(false);
      }
    }
  }, [vehicleId]);

  // ========================================
  // REFRESH ALL DASHBOARD DATA
  // ========================================

  const refreshDashboard = useCallback(async () => {
    if (!vehicleId) return;

    await Promise.allSettled([
      loadInventory(),
      loadOrders(),
      loadCash(),
      ...(activeTab === "Lorry Inventory"
        ? [loadGroupedBatchInventory()]
        : []),
    ]);
  }, [
    vehicleId,
    activeTab,
    loadInventory,
    loadOrders,
    loadCash,
    loadGroupedBatchInventory,
  ]);

  // ========================================
  // WHOLESALE PAYMENT CALLBACK
  // ========================================

  const handlePaymentRecorded = useCallback(async () => {
    if (!vehicleId) return;

    setMessage(
      "Payment recorded. Refreshing cash and order details."
    );

    await Promise.allSettled([
      loadCash(),
      loadOrders(),
    ]);
  }, [
    vehicleId,
    loadCash,
    loadOrders,
  ]);

  // ========================================
  // NEW: DIRECT BILL CALLBACKS
  // ========================================
  //
  // After creating a direct bill:
  //   refresh stock from PostgreSQL.
  //
  // After confirming cash:
  //   refresh today's cash and stock.
  //
  // The billing component itself handles
  // price calculations, PDF and sharing.
  //
  // ========================================

  const handleDirectBillCreated = useCallback(
    async (bill) => {
      if (!vehicleId) return;

      if (bill?.id && ["BANK_TRANSFER", "CHEQUE"].includes(bill.paymentMethod)) {
        setLastDirectBillId(bill.id);
      }

      await Promise.allSettled([
        loadInventory(),
      ]);

      setMessage(
        "Sales bill saved successfully. " +
          "Selected lorry stock has been refreshed."
      );
    },
    [
      vehicleId,
      loadInventory,
    ]
  );

  const handleDirectPaymentRecorded = useCallback(
    async (bill) => {
      if (!vehicleId) return;

      const nonCash = ["BANK_TRANSFER", "CHEQUE"].includes(
        String(bill?.paymentMethod || "").toUpperCase()
      );

      await Promise.allSettled([
        loadCash(),
        loadInventory(),
      ]);

      if (nonCash) {
        setMessage(
          "Direct-sales payment information updated. " +
          "Evidence is not treated as cash or paid until Admin verification " +
          "and, for cheques, bank clearance."
        );
      } else {
        setMessage(
          "Cash receipt recorded. " +
          "Today's Cash has been refreshed."
        );
      }
    },
    [vehicleId, loadCash, loadInventory]
  );

  // ========================================
  // DIRECT SALES CREDIT CALLBACK
  // ========================================

  const handleSalesCreditChanged = useCallback(() => {
    setCreditRefreshVersion((version) => version + 1);
  }, []);

  // ========================================
  // AUTO REFRESH
  // ========================================

  useEffect(() => {
    if (!vehicleId) return;

    let cancelled = false;
    let running = false;

    async function refresh() {
      if (cancelled || running) return;

      running = true;

      try {
        await Promise.allSettled([
          loadInventory(),
          loadOrders(),
          loadCash(),
        ]);
      } finally {
        running = false;
      }
    }

    refresh();

    const timer = window.setInterval(() => {
      if (
        !cancelled &&
        document.visibilityState === "visible"
      ) {
        refresh();
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    vehicleId,
    loadInventory,
    loadOrders,
    loadCash,
  ]);

  // ========================================
  // DERIVED INVENTORY
  // ========================================

  const products = useMemo(
    () =>
      allStock.filter(
        isFactoryProduct
      ),
    [allStock]
  );

  const excludedProducts = useMemo(
    () =>
      allStock.filter(
        (item) => !isFactoryProduct(item)
      ),
    [allStock]
  );

  const totalStock = useMemo(
    () => stockTotals(allStock),
    [allStock]
  );

  const approvedStock = useMemo(
    () => stockTotals(products),
    [products]
  );

  const excludedStock = useMemo(
    () => stockTotals(excludedProducts),
    [excludedProducts]
  );

  const filteredProducts = useMemo(() => {
    const search = inventorySearch
      .trim()
      .toLowerCase();

    if (!search) return products;

    return products.filter(
      (product) =>
        [
          product.productId,
          product.productName,
          product.flavour,
          product.size,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
    );
  }, [
    products,
    inventorySearch,
  ]);

  // Search grouped inventory by product, size, flavour or batch number.
  const filteredGroupedBatchInventory = useMemo(() => {
    const search = inventorySearch.trim().toLowerCase();
    if (!search) return groupedBatchInventory;

    return groupedBatchInventory.filter((product) =>
      [
        product.productId,
        product.productName,
        product.size,
        product.flavour,
        ...(Array.isArray(product.batches)
          ? product.batches.map((batch) => batch.batchNumber)
          : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [groupedBatchInventory, inventorySearch]);

  // ========================================
  // DERIVED ORDERS
  // ========================================

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) => !delivered(order)
      ),
    [orders]
  );

  const deliveredOrders = useMemo(
    () => orders.filter(delivered),
    [orders]
  );

  // ========================================
  // LOGOUT
  // ========================================

  function logout() {
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      sessionStorage.removeItem(
        "seventeen_auth"
      );

      navigate(
        "/login",
        { replace: true }
      );
    }
  }

  // ========================================
  // SIDEBAR TABS
  // ========================================

  const navigation = [
    {
      name: "Billing",
      icon: ReceiptText,
    },
    {
      name: "Wholesale Orders",
      icon: Truck,
    },
    {
      name: "Lorry Inventory",
      icon: Package,
    },
    {
      name: "Credit Balances",
      icon: CreditCard,
    },
    {
      name: "Direct Payments",
      icon: Landmark,
    },
    {
      name: "Daily Reports",
      icon: ClipboardList,
    },
    {
      name: "Returns",
      icon: RotateCcw,
    },
    {
      name: "Outlet Supply",
      icon: Truck,
    },
  ];

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF9F3] text-[#17265B] md:flex-row">

      {/* ================================== */}
      {/* SIDEBAR */}
      {/* ================================== */}

      <aside className="flex w-full shrink-0 flex-col border-r border-[#E7EAF8] bg-white md:min-h-screen md:w-64">

        <div className="px-6 pb-7 pt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3654FF] text-white shadow-sm">
              <span aria-hidden="true" className="text-2xl">🍦</span>
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold leading-tight text-[#17265B]">
                Seventeen <span className="text-[#3654FF]">Ice Cream</span>
              </h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6F7EA1]">
                Sales Management
              </p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 md:flex-col">
          {navigation.map(
            ({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                disabled={!session?.active}
                onClick={() => {
                  setActiveTab(name);
                  setMessage("");
                }}
                className={
                  "flex shrink-0 items-center gap-3 " +
                  "rounded-xl px-4 py-3 text-left text-sm " +
                  "md:w-full " +
                  (
                    activeTab === name
                      ? "bg-[#EEF1FF] font-bold text-[#3654FF] shadow-sm"
                      : "text-[#526181] hover:bg-[#F5F6FF] hover:text-[#3654FF]"
                  ) +
                  (
                    !session?.active
                      ? " cursor-not-allowed opacity-60"
                      : ""
                  )
                }
              >
                <Icon size={17} />

                <span className="flex-1">
                  {name}
                </span>
              </button>
            )
          )}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="mt-auto flex items-center gap-2 border-t border-[#E7EAF8] px-6 py-5 text-sm font-semibold text-[#3654FF] hover:bg-[#F5F6FF]"
        >
          <LogOut size={17} />
          Logout
        </button>
      </aside>

      {/* ================================== */}
      {/* MAIN AREA */}
      {/* ================================== */}

      <main className="min-w-0 flex-1">

        {/* HEADER */}

        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7EAF8] bg-white px-5 py-4 lg:px-8">

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#EEF1FF] p-2 text-[#3654FF]">
              <Truck size={20} />
            </div>

            <div>
              <p className="text-sm font-bold">
                {session?.active
                  ? session.vehicleNumber
                  : "Select a Vehicle"}
              </p>

              <p className="text-xs text-slate-600">
                Vehicle-based Sales Dashboard
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold">
              {managerName}
            </p>

            <p className="text-xs text-slate-600">
              Sales Representative
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">

          {/* GENERAL ERROR */}

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* GENERAL MESSAGE */}

          {message && (
            <div
              role="status"
              className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700"
            >
              {message}
            </div>
          )}

          {/* ================================== */}
          {/* INITIAL SESSION CHECK */}
          {/* ================================== */}

          {initializing ? (

            <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
              <Loader2
                size={22}
                className="animate-spin"
              />

              Checking Sales Session...
            </div>

          ) : sessionError ? (

            <section className="rounded-2xl border border-amber-200 bg-white p-7">

              <div className="flex items-center gap-3">
                <AlertTriangle className="text-amber-600" />

                <h2 className="text-xl font-bold">
                  Unable to Verify Vehicle Session
                </h2>
              </div>

              <p className="mt-4 text-sm text-red-700">
                {sessionError}
              </p>

              <button
                type="button"
                onClick={retrySession}
                className={buttonClass + " mt-5"}
              >
                <RefreshCw size={17} />
                Retry Session Check
              </button>
            </section>

          ) : !session?.active ? (

            /* ================================== */
            /* VEHICLE SELECTION */
            /* ================================== */

            <section>
              <h2 className="font-serif text-2xl font-bold">
                Select Your Delivery Vehicle
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Select the vehicle you are managing.
                Its stock, orders and cash collections
                will load from Spring Boot.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                {vehicles.map((vehicle) => {
                  const selectable =
                    canSelectVehicle(vehicle);

                  const selecting =
                    selectingVehicleId === vehicle.id;

                  return (
                    <article
                      key={vehicle.id}
                      className="rounded-2xl bg-white p-6 shadow-sm"
                    >

                      <Truck
                        size={30}
                        className="text-[#3654FF]"
                      />

                      <h3 className="mt-4 text-lg font-bold">
                        {vehicle.vehicleNumber}
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        Status: {vehicle.status}
                      </p>

                      <p className="mt-3 flex items-center gap-2 text-xs">
                        {selectable ? (
                          <>
                            <CheckCircle2
                              size={16}
                              className="text-green-600"
                            />

                            Available for selection
                          </>
                        ) : (
                          <>
                            <LockKeyhole
                              size={16}
                              className="text-amber-600"
                            />

                            Vehicle unavailable
                          </>
                        )}
                      </p>

                      <button
                        type="button"
                        disabled={
                          !selectable ||
                          selectingVehicleId !== null
                        }
                        onClick={() =>
                          chooseVehicle(vehicle.id)
                        }
                        className={
                          buttonClass +
                          " mt-5 w-full"
                        }
                      >
                        {selecting ? (
                          <>
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                            Selecting...
                          </>
                        ) : selectable ? (
                          <>
                            Select Vehicle
                            <ArrowRight size={17} />
                          </>
                        ) : (
                          "Vehicle Unavailable"
                        )}
                      </button>
                    </article>
                  );
                })}

              </div>

              <button
                type="button"
                disabled={
                  loadingVehicles ||
                  selectingVehicleId !== null
                }
                onClick={async () => {
                  try {
                    setError("");
                    await loadVehicles();
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                className={
                  buttonClass +
                  " mt-6"
                }
              >
                <RefreshCw
                  size={16}
                  className={
                    loadingVehicles
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh Vehicles
              </button>
            </section>

          ) : (

            /* ================================== */
            /* ACTIVE DASHBOARD */
            /* ================================== */

            <>

              {/* ============================== */}
              {/* CURRENT VEHICLE SESSION */}
              {/* ============================== */}

              <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">

                <div>
                  <p className="text-xs text-slate-500">
                    Selected Vehicle
                  </p>

                  <p className="mt-1 text-lg font-bold">
                    {session.vehicleNumber}
                  </p>

                  <p className="mt-1 text-xs text-green-700">
                    Active Sales Session
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={refreshDashboard}
                    disabled={inventoryLoading}
                    className={buttonClass}
                  >
                    <RefreshCw
                      size={16}
                      className={
                        inventoryLoading
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={endVehicleSession}
                    disabled={endingSession}
                    className="rounded-xl border border-[#CBD4FF] px-4 py-3 text-sm font-bold text-[#3654FF] hover:bg-[#EEF1FF] disabled:opacity-50"
                  >
                    {endingSession
                      ? "Ending..."
                      : "End Vehicle Session"}
                  </button>
                </div>
              </section>

              {/* ============================== */}
              {/* TODAY'S CASH */}
              {/* ============================== */}

              <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex items-center justify-between gap-4">

                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Today's Cash
                    </p>

                    <p className="mt-2 text-3xl font-bold text-emerald-600">
                      {cashError
                        ? "Unavailable"
                        : cashSummary
                          ? money(
                              cashSummary.todaysCash
                            )
                          : "Loading..."}
                    </p>

                    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays size={15} />

                      {cashSummary?.date ||
                        "Sri Lanka business date"}
                    </p>
                  </div>

                  <Wallet
                    size={36}
                    className="text-emerald-500"
                  />
                </div>

                {cashLoading && (
                  <p className="mt-2 text-xs text-slate-500">
                    Refreshing cash...
                  </p>
                )}

                {cashError && (
                  <p className="mt-3 text-sm text-red-600">
                    {cashError}
                  </p>
                )}

                <p className="mt-4 text-xs text-slate-400">
                  Confirmed physical cash only.
                  Pending bank transfers, unpaid credit
                  and uncleared cheques are excluded.
                </p>
              </section>

              {/* ============================== */}
              {/* UPDATED BILLING */}
              {/* ============================== */}
              {/*
                OLD draft-only billing removed.

                The imported SalesBillingPanel now:
                - Loads current vehicle products.
                - Loads Admin-approved wholesale prices.
                - Displays the fixed unit price.
                - Calculates the grand total.
                - Saves a direct sales bill.
                - Deducts physical lorry stock.
                - Supports Cash / Credit /
                  Bank Transfer / Cheque.
                - Records cash after confirmation.
                - Generates and shares invoice PDFs.

                Stock and cash are refreshed by the
                callbacks below.
              */}

              {activeTab === "Billing" && (
                <SalesBillingPanel
                  key={vehicleId}
                  onBillCreated={
                    handleDirectBillCreated
                  }
                  onPaymentRecorded={
                    handleDirectPaymentRecorded
                  }
                  onCreditBalanceChanged={
                    handleSalesCreditChanged
                  }
                  onViewCreditBalances={() => {
                    setActiveTab("Credit Balances");
                  }}
                />
              )}

              {/* ============================== */}
              {/* WHOLESALE ORDERS */}
              {/* ============================== */}

              {activeTab === "Wholesale Orders" && (
                <section>

                  <h2 className="font-serif text-2xl font-bold">
                    Wholesale Orders
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Orders assigned to{" "}
                    {session.vehicleNumber}.
                  </p>

                  {ordersLoading && (
                    <p className="mt-4 text-sm text-slate-500">
                      Updating orders...
                    </p>
                  )}

                  {ordersError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
                    >
                      {ordersError}

                      <button
                        type="button"
                        onClick={loadOrders}
                        className="ml-3 font-bold underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <h3 className="mb-4 mt-7 font-bold">
                    Active Orders ({activeOrders.length})
                  </h3>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {activeOrders.map((order) => (
                      <WholesaleOrderCard
                        key={orderIdOf(order)}
                        order={order}
                        onPaymentRecorded={
                          handlePaymentRecorded
                        }
                      />
                    ))}
                  </div>

                  {activeOrders.length === 0 && (
                    <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                      No active orders found.
                    </p>
                  )}

                  <h3 className="mb-4 mt-9 font-bold">
                    Delivered Orders ({deliveredOrders.length})
                  </h3>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {deliveredOrders.map((order) => (
                      <WholesaleOrderCard
                        key={orderIdOf(order)}
                        order={order}
                        onPaymentRecorded={
                          handlePaymentRecorded
                        }
                      />
                    ))}
                  </div>

                  {deliveredOrders.length === 0 && (
                    <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                      No delivered orders found.
                    </p>
                  )}
                </section>
              )}

              {/* ============================== */}
              {/* LORRY INVENTORY */}
              {/* ============================== */}

              {activeTab === "Lorry Inventory" && (
                <section>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-2xl font-bold">
                        Lorry Inventory
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        Actual PostgreSQL inventory for{" "}
                        <strong>
                          {session.vehicleNumber}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        loadInventory();
                        loadGroupedBatchInventory();
                      }}
                      disabled={inventoryLoading || batchInventoryLoading}
                      className={buttonClass}
                    >
                      <RefreshCw
                        size={16}
                        className={
                          inventoryLoading
                            ? "animate-spin"
                            : ""
                        }
                      />

                      Refresh Inventory
                    </button>
                  </div>

                  {inventoryLoading && (
                    <p className="mt-4 text-sm text-slate-500">
                      Loading latest vehicle stock...
                    </p>
                  )}

                  {inventoryError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                    >
                      <p>
                        {inventoryError}
                      </p>

                      <button
                        type="button"
                        onClick={loadInventory}
                        className="mt-2 font-bold underline"
                      >
                        Retry Inventory
                      </button>
                    </div>
                  )}

                  <h3 className="mt-6 font-bold">
                    All Vehicle Stock
                  </h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">

                    <SummaryCard
                      label="Physical Stock"
                      value={totalStock.physical}
                    />

                    <SummaryCard
                      label="Reserved Stock"
                      value={totalStock.reserved}
                    />

                    <SummaryCard
                      label="Available Stock"
                      value={totalStock.available}
                    />

                  </div>

                  <h3 className="mt-7 font-bold">
                    Approved Factory Products
                  </h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">

                    <SummaryCard
                      label="Approved Physical"
                      value={approvedStock.physical}
                    />

                    <SummaryCard
                      label="Approved Reserved"
                      value={approvedStock.reserved}
                    />

                    <SummaryCard
                      label="Approved Available"
                      value={approvedStock.available}
                    />

                  </div>

                  <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">

                    <p>
                      <strong>
                        {allStock.length}
                      </strong>{" "}
                      stock records returned from
                      the selected vehicle.
                    </p>

                    <p className="mt-1">
                      <strong>
                        {products.length}
                      </strong>{" "}
                      approved product records.
                    </p>

                    <p className="mt-1">
                      <strong>
                        {excludedProducts.length}
                      </strong>{" "}
                      unrecognized records.
                    </p>

                    <p className="mt-2 text-xs">
                      Product quantities come directly
                      from the Spring Boot inventory API.
                    </p>
                  </div>

                  {/* UNRECOGNIZED INVENTORY */}

                  {excludedProducts.length > 0 && (
                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">

                      <p className="font-bold text-amber-800">
                        Unrecognized Inventory
                      </p>

                      <p className="mt-2 text-sm text-amber-700">
                        These records exist in vehicle_stock
                        but do not match the approved catalog.
                        Physical units:{" "}
                        {excludedStock.physical}
                      </p>

                      <button
                        type="button"
                        className="mt-3 text-sm font-bold text-amber-800 underline"
                        onClick={() =>
                          setShowExcluded(
                            (current) => !current
                          )
                        }
                      >
                        {showExcluded
                          ? "Hide Records"
                          : "View Records"}
                      </button>

                      {showExcluded && (
                        <div className="mt-4 overflow-x-auto rounded-xl bg-white">

                          <table className="w-full min-w-[460px] text-left text-sm">

                            <thead className="bg-slate-100">
                              <tr>
                                <th className="p-3">
                                  Product ID
                                </th>

                                <th className="p-3">
                                  Flavour
                                </th>

                                <th className="p-3">
                                  Size
                                </th>

                                <th className="p-3 text-right">
                                  Quantity
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {excludedProducts.map(
                                (item) => (
                                  <tr
                                    key={item.id}
                                    className="border-t"
                                  >
                                    <td className="p-3">
                                      {item.productId}
                                    </td>

                                    <td className="p-3">
                                      {item.flavour}
                                    </td>

                                    <td className="p-3">
                                      {item.size}
                                    </td>

                                    <td className="p-3 text-right">
                                      {item.quantity}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>

                          </table>

                        </div>
                      )}
                    </div>
                  )}

                  {/* SEARCH */}

                  <div className="relative mt-7">

                    <Search
                      size={18}
                      className="absolute left-4 top-3.5 text-slate-400"
                    />

                    <input
                      value={inventorySearch}
                      onChange={(event) =>
                        setInventorySearch(
                          event.target.value
                        )
                      }
                      placeholder="Search approved products..."
                      className={
                        inputClass +
                        " pl-11"
                      }
                    />
                  </div>

                  {/* GROUPED PRODUCT CARDS WITH BATCH QUANTITIES */}

                  <div className="mt-6">
                    <SalesGroupedBatchInventory
                      vehicleNumber={session?.vehicleNumber}
                      inventory={filteredGroupedBatchInventory}
                      loading={batchInventoryLoading}
                      error={batchInventoryError}
                    />
                  </div>

                  {batchInventoryError && (
                    <button
                      type="button"
                      onClick={loadGroupedBatchInventory}
                      disabled={batchInventoryLoading}
                      className={buttonClass + " mt-4"}
                    >
                      <RefreshCw size={16} />
                      Retry Batch Inventory
                    </button>
                  )}
                </section>
              )}

              {/* ============================== */}
              {/* CREDIT BALANCES */}
              {/* ============================== */}

              {activeTab === "Credit Balances" && (
                <>
                  <SalesBillingCreditBalances
                    key={vehicleId}
                    vehicleId={vehicleId}
                    refreshVersion={creditRefreshVersion}
                    onRecorded={handleDirectPaymentRecorded}
                  />
                  <CreditBalances
                    orders={orders}
                    onRecorded={handlePaymentRecorded}
                  />
                </>
              )}

              {/* ============================== */}
              {/* DIRECT BANK TRANSFER / CHEQUE */}
              {/* ============================== */}

              {activeTab === "Direct Payments" && (
                <DirectSalesPayments
                  lastBillId={lastDirectBillId}
                  onPaymentRecorded={handleDirectPaymentRecorded}
                />
              )}

              {/* ============================== */}
              {/* DAILY REPORTS */}
              {/* ============================== */}

              {activeTab === "Daily Reports" && (
                <section className="rounded-2xl bg-white p-6 shadow-sm">

                  <h2 className="font-serif text-2xl font-bold">
                    Daily Reports
                  </h2>

                  <p className="mt-3 text-sm text-slate-500">
                    Current vehicle snapshot.
                    Historical reports require
                    a backend reporting API.
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">

                    <SummaryCard
                      label="Assigned Orders"
                      value={orders.length}
                    />

                    <SummaryCard
                      label="Delivered Orders"
                      value={deliveredOrders.length}
                    />

                    <SummaryCard
                      label="Available Units"
                      value={totalStock.available}
                    />

                  </div>

                  <div className="mt-5 rounded-xl bg-green-50 p-5">
                    <p className="font-bold">
                      Today's Confirmed Cash
                    </p>

                    <p className="mt-2 text-2xl font-bold text-green-700">
                      {cashError
                        ? "Unavailable"
                        : cashSummary
                          ? money(
                              cashSummary.todaysCash
                            )
                          : "Loading..."}
                    </p>
                  </div>
                </section>
              )}

              {/* ============================== */}
              {/* OUTLET SUPPLY: BATCHED INTERNAL STOCK TRANSFER */}
              {/* ============================== */}

              {activeTab === "Outlet Supply" && (
                <SalesOutletSupplyPanel
                  key={vehicleId}
                  vehicleNumber={session?.vehicleNumber}
                  onTransferCreated={async () => {
                    // Refresh this vehicle's existing aggregate inventory
                    // after the backend commits the dispatch.
                    await Promise.allSettled([
                      loadInventory(),
                      loadGroupedBatchInventory(),
                    ]);
                    setMessage(
                      "Outlet supply transfer note dispatched. " +
                      "The Outlet Manager must confirm stock receipt " +
                      "before Defreezer 2 is increased."
                    );
                  }}
                />
              )}

              {/* ============================== */}
              {/* RETURNS */}
              {/* ============================== */}

              {activeTab === "Returns" && (
                <SalesReturnsPanel
                  key={vehicleId}
                  vehicleNumber={session?.vehicleNumber}
                  onReturnCreated={async () => {
                    // Refresh existing lorry inventory after the
                    // backend commits the return and replacement.
                    await Promise.allSettled([
                      loadInventory(),
                      loadGroupedBatchInventory(),
                    ]);
                    setMessage(
                      "Product return and replacement recorded. " +
                      "Lorry inventory has been refreshed."
                    );
                  }}
                />
              )}

            </>
          )}

        </div>
      </main>
    </div>
  );
}
