
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  Home,
  ShoppingCart,
  Package,
  ReceiptText,
  Store,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  LogOut,
  Menu,
  X,
  IceCreamCone,
  UserRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Truck,
} from "lucide-react";

import { useCart } from "../context/CartContext";

import WholesaleShopProfile from "../components/WholesaleShopProfile";
import WholesaleOrderPayment from
  "../components/WholesaleOrderPayment";

// =====================================================
// CONFIGURATION
// =====================================================

const MINIMUM_QUANTITY = 5;

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const AUTH_KEY = "seventeen_auth";

const money = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(Number(value) || 0);

// =====================================================
// AUTH HELPERS
// =====================================================

function getStoredAuth() {
  try {
    return JSON.parse(
      sessionStorage.getItem(AUTH_KEY) || "null"
    );
  } catch {
    return null;
  }
}

function getToken(auth) {
  return (
    auth?.token ||
    auth?.accessToken ||
    auth?.jwt ||
    auth?.user?.token ||
    null
  );
}

// =====================================================
// API HELPERS
// =====================================================

function getErrorMessage(data, status) {
  if (status === 401) {
    return "Your login session has expired. Please log in again.";
  }

  if (status === 403) {
    return "You are not authorized to access this information.";
  }

  if (status === 404) {
    return "The requested API endpoint was not found.";
  }

  return (
    data?.message ||
    data?.detail ||
    data?.error ||
    `Request failed with HTTP ${status}.`
  );
}

async function fetchJson(url, token, signal) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal,
  });

  const responseText = await response.text();

  let data = null;

  try {
    data = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    if (!response.ok) {
      throw new Error(
        `Backend returned HTTP ${response.status}.`
      );
    }

    throw new Error(
      "Invalid JSON response from Spring Boot."
    );
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, response.status)
    );
  }

  return data;
}

// =====================================================
// ORDER HELPERS
// =====================================================

function extractOrders(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data?.content)) {
    return data.content;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.data?.orders)) {
    return data.data.orders;
  }

  throw new Error(
    "Unexpected wholesale order history API response."
  );
}

function normalizeOrder(order) {
  const assignment =
    order.deliveryAssignment ||
    order.assignment ||
    {};

  return {
    ...order,

    id:
      order.orderId ??
      order.id ??
      order.wholesaleOrderId,

    date:
      order.createdAt ??
      order.created_at ??
      order.orderDate ??
      order.date ??
      null,

    status:
      order.deliveryStatus ??
      assignment.status ??
      order.orderStatus ??
      order.status ??
      "WAITING",

    vehicleNumber:
      order.vehicleNumber ??
      order.assignedVehicleNumber ??
      assignment.vehicleNumber ??
      null,

    paymentMethod:
      order.paymentMethod ??
      order.payment_method ??
      order.checkoutMethod ??
      null,

    total:
      order.finalTotal ??
      order.totalAmount ??
      order.total ??
      0,

    items:
      order.items ??
      order.orderItems ??
      [],
  };
}

function normalizeStatus(status) {
  const value = String(status || "WAITING")
    .trim()
    .toUpperCase();

  if (value === "ASSIGNED") {
    return "PROCESSING";
  }

  if (value === "IN_TRANSIT") {
    return "ON_THE_WAY";
  }

  if (value === "PENDING" || value === "PLACED") {
    return "WAITING";
  }

  return value;
}

function statusLabel(status) {
  return normalizeStatus(status).replaceAll("_", " ");
}

function statusClass(status) {
  switch (normalizeStatus(status)) {
    case "DELIVERED":
      return "bg-green-100 text-green-700";

    case "ON_THE_WAY":
      return "bg-amber-100 text-amber-700";

    case "PROCESSING":
      return "bg-blue-100 text-blue-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatDate(value) {
  if (!value) return "Date unavailable";

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

function orderTime(order) {
  if (!order.date) return 0;

  const time = new Date(order.date).getTime();

  return Number.isFinite(time) ? time : 0;
}

// =====================================================
// NAVIGATION
// =====================================================

const navigation = [
  { id: "home", label: "Home", icon: Home },
  { id: "cart", label: "My Cart", icon: ShoppingCart },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "profile", label: "Shop Profile", icon: Store },
];

// =====================================================
// SIDEBAR
// =====================================================

function DashboardSidebar({
  shopName,
  initials,
  page,
  cartCount,
  onNavigate,
  onLogout,
}) {
  return (
    <div className="flex h-full flex-col">
      {/* CUSTOMER DETAILS */}

      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#17265B] font-bold text-white">
            {initials || "SS"}
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-bold text-[#17265B]">
              {shopName}
            </h2>

            <p className="text-xs text-slate-500">
              Wholesale Workspace
            </p>
          </div>
        </div>

        <span className="mt-5 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#3654FF]">
          Wholesale Customer
        </span>
      </div>

      {/* NAVIGATION */}

      <div className="p-4">
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </p>

        <nav className="space-y-1">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                page === id
                  ? "bg-[#EAF0FF] text-[#3654FF]"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={19} />

              <span className="flex-1">
                {label}
              </span>

              {id === "cart" && cartCount > 0 && (
                <span className="rounded-full bg-[#3654FF] px-2 py-0.5 text-xs text-white">
                  {cartCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* WHOLESALE GUIDE */}

        <div className="mt-10 rounded-2xl bg-[#EAF0FF] p-4">
          <p className="text-sm font-bold text-[#17265B]">
            Need help placing a bulk order?
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            Wholesale orders require at least{" "}
            {MINIMUM_QUANTITY} units for each selected
            product and flavour.
          </p>

          <Link
            to="/how-to-order"
            className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-xs font-semibold text-[#3654FF]"
          >
            View Wholesale Guide
          </Link>
        </div>
      </div>

      {/* LOGOUT */}

      <div className="mt-auto border-t border-slate-100 p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut size={19} />
          Logout
        </button>
      </div>
    </div>
  );
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F6F7F9] p-4">
      <div>
        <p className="text-xs font-medium text-slate-500">
          {label}
        </p>

        <p className="mt-2 text-2xl font-bold text-[#17265B]">
          {value}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
        <Icon size={23} />
      </div>
    </div>
  );
}

// =====================================================
// CART PRODUCTS
// =====================================================

function ProductRows({
  cart,
  compact = false,
  updateQuantity,
  removeFromCart,
}) {
  if (!cart.length) {
    return (
      <div className="py-10 text-center">
        <ShoppingCart
          size={40}
          className="mx-auto text-slate-300"
        />

        <p className="mt-4 text-sm text-slate-500">
          Your cart is empty.
        </p>

        <Link
          to="/flavours"
          className="mt-4 inline-block font-semibold text-[#3654FF]"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cart.map((item, index) => {
        const quantity = Number(item.quantity) || 0;

        const subtotal =
          Number(item.price || 0) * quantity;

        const remaining = Math.max(
          0,
          MINIMUM_QUANTITY - quantity
        );

        const cartKey = item.cartKey ?? item.id;

        return (
          <div
            key={`${cartKey}-${index}`}
            className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-100 p-3"
          >
            {/* PRODUCT IMAGE */}

            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <IceCreamCone
                  size={25}
                  className="text-[#3654FF]"
                />
              )}
            </div>

            {/* PRODUCT DETAILS */}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#17265B]">
                {item.name}
              </p>

              {item.size && (
                <p className="mt-1 text-xs text-slate-500">
                  Size: {item.size}
                </p>
              )}

              {(item.selectedFlavour || item.flavour) && (
                <p className="mt-1 text-xs font-semibold text-[#3654FF]">
                  Flavour:{" "}
                  {item.selectedFlavour || item.flavour}
                </p>
              )}

              <p className="mt-1 text-xs text-slate-500">
                {quantity} × {money(item.price)}
              </p>

              {remaining > 0 && (
                <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle size={13} />
                  Add {remaining} more units.
                </p>
              )}

              {/* QUANTITY CONTROLS */}

              {!compact && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        cartKey,
                        quantity - 1
                      )
                    }
                    aria-label={`Decrease ${item.name}`}
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  >
                    <Minus size={15} />
                  </button>

                  <span className="w-9 text-center text-sm font-bold">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        cartKey,
                        quantity + 1
                      )
                    }
                    aria-label={`Increase ${item.name}`}
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  >
                    <Plus size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      removeFromCart(cartKey)
                    }
                    aria-label={`Remove ${item.name}`}
                    className="ml-2 rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )}
            </div>

            {/* SUBTOTAL */}

            <strong className="shrink-0 text-sm text-[#17265B]">
              {money(subtotal)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// CART SNAPSHOT
// =====================================================

function CartSnapshot({
  cart,
  cartCount,
  cartTotal,
  incompleteItems,
  onReviewCart,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#17265B]">
          Cart Snapshot
        </h3>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {cartCount} units
        </span>
      </div>

      <ProductRows cart={cart} compact />

      {incompleteItems.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-700">
            <AlertCircle size={16} />
            Minimum Quantity Warning
          </p>

          <p className="mt-2 text-xs text-amber-700">
            {incompleteItems.length} product/flavour
            combination(s) need additional units.
          </p>
        </div>
      )}

      {cart.length > 0 && (
        <div className="mt-5 flex justify-between border-t pt-4">
          <span className="text-sm text-slate-500">
            Estimated Subtotal
          </span>

          <strong className="text-[#3654FF]">
            {money(cartTotal)}
          </strong>
        </div>
      )}

      <button
        type="button"
        onClick={onReviewCart}
        className="mt-5 w-full rounded-xl bg-[#17265B] py-3 text-sm font-bold text-white hover:bg-[#243D85]"
      >
        Review Cart
      </button>
    </section>
  );
}

// =====================================================
// BANK TRANSFER APPROVAL STATUS (CUSTOMER READ-ONLY)
// =====================================================

function isBankTransfer(value) {
  return ["BANK", "BANK_TRANSFER"].includes(
    String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")
  );
}

function paymentMoney(value) {
  return value == null || value === "" || !Number.isFinite(Number(value))
    ? "Unavailable" : money(value);
}

function BankApprovalStatus({ orderId, refreshVersion, detailed = false }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let controller;

    async function load() {
      if (cancelled || running) return;
      running = true;
      setLoading(true);
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const token = getToken(getStoredAuth());
        if (!token) throw new Error("Please log in again.");
        const data = await fetchJson(
          `${API_URL}/api/wholesale/payments/orders/${encodeURIComponent(orderId)}`,
          token,
          controller.signal
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
          setError(err.name === "AbortError" ? "Payment status request timed out." : err.message || "Unable to load payment status.");
        }
      } finally {
        window.clearTimeout(timeout);
        running = false;
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [orderId, refreshVersion]);

  const records = summary?.receipts ?? summary?.payments ?? summary?.paymentRecords;
  const receipts = Array.isArray(records)
    ? records.filter((r) => isBankTransfer(r.method ?? r.paymentMethod))
    : [];
  const statusOf = (r) => String(r.status ?? "").trim().toUpperCase();
  const approved = receipts.some((r) => ["CONFIRMED", "VERIFIED", "APPROVED"].includes(statusOf(r)));
  const pending = receipts.some((r) => ["PENDING", "PENDING_REVIEW"].includes(statusOf(r)));
  const rejected = receipts.some((r) => statusOf(r) === "REJECTED");
  const fullyPaid = summary?.remainingBalance != null && summary.remainingBalance !== "" && Number(summary.remainingBalance) === 0;

  if (error) return <p role="alert" className="mt-2 text-xs text-red-600">{detailed ? error : "Payment status unavailable"}</p>;
  if (!summary) return <p className="mt-2 text-xs text-slate-500">{loading ? "Checking payment..." : "Payment status unavailable"}</p>;

  return (
    <div className={detailed ? "rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" : "mt-2 space-y-1"}>
      {detailed && <h3 className="mb-3 font-bold text-[#17265B]">Bank Transfer Approval — Order #{orderId}</h3>}
      {approved && <p className="text-xs font-bold text-green-700">Payment Approved by Admin{fullyPaid ? " — Fully Paid" : ""}</p>}
      {pending && <p className="text-xs font-semibold text-amber-700">Awaiting Admin Approval</p>}
      {rejected && <p className="text-xs font-semibold text-red-700">{approved || pending ? "A previous bank slip was rejected" : "Bank Slip Rejected by Admin"}</p>}
      {!approved && !pending && !rejected && (
        <p className="text-xs text-slate-500">{Array.isArray(records) && receipts.length === 0 ? "Awaiting bank slip upload" : "Payment not confirmed"}</p>
      )}
      {detailed && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Confirmed Paid</p><strong className="text-green-700">{paymentMoney(summary.confirmedPaid)}</strong></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Remaining Balance</p><strong>{paymentMoney(summary.remainingBalance)}</strong></div>
          </div>
          {receipts.map((receipt, index) => {
            const status = statusOf(receipt);
            return (
              <div key={receipt.id ?? receipt.receiptId ?? index} className="mt-3 border-t pt-3 text-sm">
                <p>Submitted amount: {paymentMoney(receipt.amount ?? receipt.paymentAmount)}</p>
                <p>Status: {["CONFIRMED", "VERIFIED", "APPROVED"].includes(status) ? "Approved by Admin" : status.replaceAll("_", " ") || "Unavailable"}</p>
                {receipt.verifiedAmount != null && <p>Verified amount: {paymentMoney(receipt.verifiedAmount)}</p>}
                {status === "REJECTED" && receipt.rejectionReason && <p className="text-red-700">Reason: {receipt.rejectionReason}</p>}
              </div>
            );
          })}
          <p className="mt-3 text-xs text-slate-500">Only Admin can verify bank transfers. Status refreshes automatically while this page is open.</p>
        </>
      )}
    </div>
  );
}

// =====================================================
// ORDER HISTORY
// =====================================================

function OrdersTable({
  orders,
  loading,
  error,
  preview = false,
  onViewAll,
  onRefresh,
  onOpenPayment,
  paymentRefreshVersion,
}) {
  const visibleOrders = preview
    ? orders.slice(0, 4)
    : orders;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* HEADER */}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#17265B]">
            {preview ? "Recent Orders" : "My Orders"}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Your wholesale order history
          </p>
        </div>

        <div className="flex items-center gap-3">
          {preview && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-sm font-semibold text-[#3654FF]"
            >
              View All
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#3654FF] hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh Orders
          </button>
        </div>
      </div>

      {/* API ERROR */}

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={18}
            className="shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {/* ORDERS */}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 p-12 text-slate-500">
          <RefreshCw
            size={20}
            className="animate-spin"
          />

          Loading wholesale orders...
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-10 text-center">
          <Package
            size={32}
            className="mx-auto text-slate-300"
          />

          <p className="mt-3 text-sm text-slate-500">
            {error
              ? "Unable to load orders."
              : "No wholesale orders found."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="pb-3">Order</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Vehicle</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3 pl-4">Payment</th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.map((order, index) => (
                <tr
                  key={order.id ?? index}
                  className="border-b last:border-0"
                >
                  <td className="py-4 font-semibold text-[#17265B]">
                    #{order.id ?? "—"}
                  </td>

                  <td className="py-4 text-slate-600">
                    {formatDate(order.date)}
                  </td>

                  <td className="py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                        order.status
                      )}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </td>

                  {/* ASSIGNED DELIVERY VEHICLE */}

                  <td className="py-4">
                    {order.vehicleNumber ? (
                      <span className="inline-flex items-center gap-2 font-semibold text-[#17265B]">
                        <Truck
                          size={16}
                          className="text-[#3654FF]"
                        />

                        {order.vehicleNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Not assigned
                      </span>
                    )}
                  </td>

                  <td className="py-4 text-right font-semibold text-[#3654FF]">
                    {money(order.total)}
                  </td>

                  <td className="py-4 pl-4">
                    <button
                      type="button"
                      onClick={() => onOpenPayment?.(order)}
                      className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-[#3654FF] hover:bg-blue-50"
                      aria-label={`View payment details for order ${order.id}`}
                    >
                      View Payment
                    </button>
                    {order.id != null && isBankTransfer(order.paymentMethod) &&
                      normalizeStatus(order.status) === "DELIVERED" && (
                        <BankApprovalStatus
                          key={order.id}
                          orderId={order.id}
                          refreshVersion={paymentRefreshVersion}
                        />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!preview && (
            <p className="mt-4 text-xs text-slate-500">
              {orders.length} order(s) loaded.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// =====================================================
// MAIN WHOLESALE DASHBOARD
// =====================================================

export default function WholesaleDashboard({
  user,
  onLogout,
}) {
  const navigate = useNavigate();

  const {
    cart,
    cartCount,
    cartTotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const auth = getStoredAuth();

  const currentUser =
    user ||
    auth?.user ||
    auth?.account ||
    auth ||
    {};

  // ========================================
  // DASHBOARD STATE
  // ========================================

  const [page, setPage] = useState("home");

  const [mobileMenu, setMobileMenu] =
    useState(false);

  // ========================================
  // SHOP PROFILE STATE
  // ========================================

  const [profile, setProfile] = useState(null);

  // ========================================
  // ORDER STATE
  // ========================================

  const [orders, setOrders] = useState([]);

  const [ordersLoading, setOrdersLoading] =
    useState(true);

  const [ordersError, setOrdersError] =
    useState("");

  // Only the payment panel is new; the rest of the dashboard is unchanged.
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] =
    useState(null);

  const [paymentRefreshVersion, setPaymentRefreshVersion] = useState(0);


  const selectedPaymentOrder = orders.find(
    (order) => String(order.id) === String(selectedPaymentOrderId)
  ) || null;

  const loadingOrdersRef = useRef(false);

  // This tracks whether the component is mounted.
  const mountedRef = useRef(false);

  const [invoices] = useState([]);

  // ========================================
  // COMPONENT LIFECYCLE
  // ========================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ========================================
  // LOAD CUSTOMER ORDERS
  // ========================================

  const loadOrders = useCallback(async () => {
    if (loadingOrdersRef.current) {
      return;
    }

    const token = getToken(getStoredAuth());

    if (!token) {
      setOrders([]);
      setOrdersError(
        "Authentication token missing. Please log in again."
      );
      setOrdersLoading(false);
      return;
    }

    loadingOrdersRef.current = true;

    if (mountedRef.current) {
      setOrdersLoading(true);
    }

    try {
      const data = await fetchJson(
        `${API_URL}/api/wholesale/orders/my`,
        token
      );

      const normalized = extractOrders(data)
        .map(normalizeOrder)
        .sort(
          (a, b) =>
            orderTime(b) - orderTime(a)
        );

      if (mountedRef.current) {
        setOrders(normalized);
        setOrdersError("");
      }
    } catch (error) {
      if (mountedRef.current) {
        setOrdersError(
          error.message ||
          "Unable to load wholesale orders."
        );
      }
    } finally {
      loadingOrdersRef.current = false;

      if (mountedRef.current) {
        setOrdersLoading(false);
      }
    }
  }, []);

  const handlePaymentUpdated = useCallback(async () => {
    setPaymentRefreshVersion((version) => version + 1);
    await loadOrders();
  }, [loadOrders]);

  // ========================================
  // INITIAL ORDER LOAD
  // ========================================

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ========================================
  // RELOAD ORDERS WHEN TAB OPENS
  // ========================================

  useEffect(() => {
    if (page === "orders") {
      loadOrders();
    }
  }, [page, loadOrders]);

  // ========================================
  // AUTO-REFRESH ORDERS
  // ========================================

  useEffect(() => {
    if (page !== "home" && page !== "orders") {
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadOrders();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [page, loadOrders]);

  // ========================================
  // REFRESH WHEN BROWSER TAB BECOMES VISIBLE
  // ========================================

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadOrders();
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
  }, [loadOrders]);

  // ========================================
  // LOAD SAVED SHOP PROFILE
  // ========================================

  const loadProfile = useCallback(async (signal) => {
    const token = getToken(getStoredAuth());

    if (!token) return;

    try {
      const data = await fetchJson(
        `${API_URL}/api/wholesale/profile`,
        token,
        signal
      );

      if (!signal?.aborted && mountedRef.current) {
        setProfile(data);
      }
    } catch (error) {
      if (
        error.name !== "AbortError" &&
        !signal?.aborted
      ) {
        // The editable component shows the full error
        // when the customer opens Shop Profile.
        console.warn(
          "Unable to load shop profile:",
          error.message
        );
      }
    }
  }, []);

  // Load saved shop details when the dashboard mounts.
  useEffect(() => {
    const controller = new AbortController();

    loadProfile(controller.signal);

    return () => controller.abort();
  }, [loadProfile]);

  // ========================================
  // HANDLE SUCCESSFUL PROFILE SAVE
  // ========================================

  const handleProfileSaved = useCallback(
    (savedProfile) => {
      // Update the parent immediately.
      // The sidebar changes without a page reload.
      setProfile(savedProfile);
    },
    []
  );

  // ========================================
  // CUSTOMER INFORMATION
  // ========================================

  const shopName =
    profile?.shopName ||
    currentUser?.shopName ||
    currentUser?.fullName ||
    currentUser?.name ||
    "My Wholesale Shop";

  const initials = shopName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  // ========================================
  // CART VALIDATION
  // ========================================

  const safeCart = Array.isArray(cart) ? cart : [];

  const incompleteItems = safeCart.filter(
    (item) =>
      Number(item.quantity) < MINIMUM_QUANTITY
  );

  const minimumsMet =
    incompleteItems.length === 0;

  // ========================================
  // NAVIGATION
  // ========================================

  function navigateTo(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    if (nextPage !== "orders") {
      setSelectedPaymentOrderId(null);
    }
  }

  function openOrderPayment(order) {
    setSelectedPaymentOrderId(order.id);
    setPage("orders");
    setMobileMenu(false);
  }

  // ========================================
  // CLEAR CART
  // ========================================

  function handleClearCart() {
    const confirmed = window.confirm(
      "Remove all products from your cart?"
    );

    if (confirmed) {
      clearCart();
    }
  }

  // ========================================
  // LOGOUT
  // ========================================

  function logout() {
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      sessionStorage.removeItem(AUTH_KEY);

      navigate("/login", {
        replace: true,
      });
    }
  }

  // ========================================
  // SIDEBAR PROPERTIES
  // ========================================

  const sidebarProps = {
    shopName,
    initials,
    page,
    cartCount,
    onNavigate: navigateTo,
    onLogout: logout,
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#171717]">
      <div className="flex min-h-screen">

        {/* DESKTOP SIDEBAR */}

        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <DashboardSidebar {...sidebarProps} />
        </aside>

        {/* MOBILE SIDEBAR */}

        {mobileMenu && (
          <div className="fixed inset-0 z-50 flex bg-black/40 md:hidden">
            <aside className="flex w-72 flex-col bg-white">
              <div className="flex justify-end p-3">
                <button
                  type="button"
                  onClick={() => setMobileMenu(false)}
                  aria-label="Close menu"
                >
                  <X size={22} />
                </button>
              </div>

              <DashboardSidebar {...sidebarProps} />
            </aside>

            <button
              type="button"
              aria-label="Close navigation"
              className="flex-1"
              onClick={() => setMobileMenu(false)}
            />
          </div>
        )}

        {/* MAIN CONTENT */}

        <main className="min-w-0 flex-1 p-4 sm:p-7">

          {/* HEADER */}

          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenu(true)}
                className="rounded-lg bg-white p-2 md:hidden"
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </button>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#17265B]">
                  {navigation.find(
                    (item) => item.id === page
                  )?.label || "Home"}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Monitor orders, manage selected products,
                  and review your wholesale shop.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/flavours"
                className="rounded-xl bg-[#3654FF] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                New Order
              </Link>

              <button
                type="button"
                onClick={() => navigateTo("profile")}
                aria-label="Open shop profile"
                className="flex h-11 w-11 items-center justify-center rounded-full border bg-white text-sm font-bold"
              >
                {initials || <UserRound size={20} />}
              </button>
            </div>
          </header>

          {/* ====================================
              HOME
          ==================================== */}

          {page === "home" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

              {/* LEFT COLUMN */}

              <div className="space-y-5">

                {/* HOME OVERVIEW */}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-[#17265B]">
                    Home Overview
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Welcome back, {shopName}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <StatCard
                      label="Active Cart"
                      value={`${cartCount} units`}
                      description="Selected products"
                      icon={ShoppingCart}
                    />

                    <StatCard
                      label="Cart Subtotal"
                      value={money(cartTotal)}
                      description="Estimated total"
                      icon={Package}
                    />

                    <StatCard
                      label="My Orders"
                      value={
                        ordersLoading && orders.length === 0
                          ? "..."
                          : orders.length
                      }
                      description="Previously placed orders"
                      icon={Truck}
                    />
                  </div>
                </section>

                {/* SELECTED PRODUCTS */}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#17265B]">
                        Selected Products
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Products added from the Shop page
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigateTo("cart")}
                      className="text-sm font-semibold text-[#3654FF]"
                    >
                      Manage Cart
                    </button>
                  </div>

                  <ProductRows
                    cart={safeCart}
                    compact
                  />
                </section>

                {/* RECENT ORDERS */}

                <OrdersTable
                  orders={orders}
                  loading={ordersLoading}
                  error={ordersError}
                  preview
                  onViewAll={() => navigateTo("orders")}
                  onRefresh={loadOrders}
                  onOpenPayment={openOrderPayment}
                  paymentRefreshVersion={paymentRefreshVersion}
                />
              </div>

              {/* RIGHT COLUMN */}

              <div className="space-y-5">
                <CartSnapshot
                  cart={safeCart}
                  cartCount={cartCount}
                  cartTotal={cartTotal}
                  incompleteItems={incompleteItems}
                  onReviewCart={() => navigateTo("cart")}
                />

                {/* INVOICE SUMMARY */}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#17265B]">
                      Invoices
                    </h3>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                      {invoices.length} loaded
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-slate-500">
                    Invoice records will appear here after
                    connecting your Spring Boot invoices API.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigateTo("invoices")}
                    className="mt-5 w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold hover:bg-slate-200"
                  >
                    View Invoices
                  </button>
                </section>
              </div>
            </div>
          )}

          {/* ====================================
              MY CART
          ==================================== */}

          {page === "cart" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">

              {/* CART PRODUCTS */}

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-[#17265B]">
                      Selected Ice Cream Products
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {safeCart.length} product/flavour
                      combinations
                      {" · "}
                      {cartCount} total units
                    </p>
                  </div>

                  {safeCart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={17} />
                      Clear Cart
                    </button>
                  )}
                </div>

                <ProductRows
                  cart={safeCart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                />

                <Link
                  to="/flavours"
                  className="mt-6 inline-flex items-center gap-2 font-semibold text-[#3654FF]"
                >
                  <Plus size={18} />
                  Add More Products
                </Link>
              </section>

              {/* ORDER SUMMARY */}

              <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#17265B]">
                  Order Summary
                </h3>

                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span>
                      Product/Flavour Entries
                    </span>

                    <strong>{safeCart.length}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Total Units</span>
                    <strong>{cartCount}</strong>
                  </div>

                  <div className="flex justify-between border-t pt-4 text-lg">
                    <strong>Subtotal</strong>

                    <strong className="text-[#3654FF]">
                      {money(cartTotal)}
                    </strong>
                  </div>
                </div>

                {/* WHOLESALE MINIMUM */}

                {incompleteItems.length > 0 && (
                  <div className="mt-5 rounded-xl bg-amber-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <AlertCircle size={18} />
                      Minimum Quantity Not Met
                    </p>

                    <p className="mt-2 text-xs text-amber-700">
                      {incompleteItems.length} item(s)
                      contain fewer than{" "}
                      {MINIMUM_QUANTITY} units.
                    </p>
                  </div>
                )}

                {safeCart.length > 0 && minimumsMet && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                    <CheckCircle2 size={19} />
                    Wholesale minimum satisfied.
                  </div>
                )}

                {/* CHECKOUT */}

                <button
                  type="button"
                  disabled={
                    !safeCart.length ||
                    !minimumsMet
                  }
                  onClick={() => navigate("/checkout")}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-4 py-4 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue to Checkout
                  <ArrowRight size={18} />
                </button>

                <p className="mt-3 text-xs text-slate-400">
                  Prices and stock availability are
                  verified by the backend.
                </p>
              </section>
            </div>
          )}

          {/* ====================================
              MY ORDERS
          ==================================== */}

          {page === "orders" && (
            <div className="space-y-5">
              <OrdersTable
                orders={orders}
                loading={ordersLoading}
                error={ordersError}
                onRefresh={loadOrders}
                onOpenPayment={openOrderPayment}
                  paymentRefreshVersion={paymentRefreshVersion}
              />

              {selectedPaymentOrder &&
                isBankTransfer(selectedPaymentOrder.paymentMethod) &&
                normalizeStatus(selectedPaymentOrder.status) === "DELIVERED" && (
                  <BankApprovalStatus
                    key={selectedPaymentOrder.id}
                    orderId={selectedPaymentOrder.id}
                    refreshVersion={paymentRefreshVersion}
                    detailed
                  />
              )}

              {selectedPaymentOrder && (
                <WholesaleOrderPayment
                  key={selectedPaymentOrder.id}
                  order={selectedPaymentOrder}
                  onClose={() => setSelectedPaymentOrderId(null)}
                  onUpdated={handlePaymentUpdated}
                />
              )}
            </div>
          )}

          {/* ====================================
              INVOICES
          ==================================== */}

          {page === "invoices" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-[#17265B]">
                Wholesale Invoices
              </h3>

              <p className="mt-5 text-sm text-slate-500">
                Invoice records will appear here after
                connecting your Spring Boot invoices API.
              </p>
            </section>
          )}

          {/* ====================================
              EDITABLE SHOP PROFILE
          ==================================== */}

          {page === "profile" && (
            <WholesaleShopProfile
              onProfileSaved={handleProfileSaved}
            />
          )}

        </main>
      </div>
    </div>
  );
}
