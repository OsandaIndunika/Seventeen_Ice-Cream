
import { useMemo } from "react";

import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  IceCreamCone,
  MapPin,
  Navigation,
  Package,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet,
  FileText,
} from "lucide-react";

import WholesaleInvoice
  from "../components/invoices/WholesaleInvoice";

// ==========================================
// 1. CURRENCY FORMATTING
// ==========================================

function formatPrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "To be confirmed";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "To be confirmed";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ==========================================
// 2. PAYMENT METHOD LABELS
// ==========================================

function paymentLabel(method) {
  const methods = {
    cash: "Cash on Delivery",
    bank: "Bank Transfer",
    bank_transfer: "Bank Transfer",
    cheque: "Cheque",
    credit: "Credit",
    confirm: "Confirm with Wholesale Team",
  };

  const key = String(
    method || ""
  ).toLowerCase();

  return (
    methods[key] ||
    method ||
    "Pending confirmation"
  );
}

// ==========================================
// 3. ORDER PROGRESS STEPS
// ==========================================

const progressSteps = [
  {
    key: "CONFIRMED",
    title: "Confirmed",
    description: "Order received",
    icon: Check,
  },
  {
    key: "PROCESSING",
    title: "Processing",
    description: "Preparing products",
    icon: Package,
  },
  {
    key: "SHIPPED",
    title: "Shipped",
    description: "Out for delivery",
    icon: Truck,
  },
  {
    key: "DELIVERED",
    title: "Delivered",
    description: "Products delivered",
    icon: MapPin,
  },
];

// Include status names from the
// Delivery Person management workflow.

const statusIndex = {
  PENDING: 0,
  RECEIVED: 0,
  CONFIRMED: 0,
  WAITING: 0,
  ASSIGNED: 1,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 2,
  ON_THE_WAY: 2,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

// ==========================================
// 4. SUMMARY ROW
// ==========================================

function SummaryRow({
  label,
  value,
  bold = false,
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={
          "text-right text-sm " +
          (
            bold
              ? "font-bold text-[#17265B]"
              : "font-medium text-slate-700"
          )
        }
      >
        {value}
      </span>
    </div>
  );
}

// ==========================================
// 5. NORMALIZE ORDER PRODUCTS
//
// Checkout may use:
// price, lineTotal, selectedFlavour
//
// Backend may use:
// unitPrice, subtotal, flavour
//
// Normalize the data for both the
// confirmation screen and invoice.
// ==========================================

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const quantity = Number(
      item.quantity ?? 0
    );

    const rawPrice =
      item.unitPrice ??
      item.unit_price ??
      item.price;

    const rawSubtotal =
      item.subtotal ??
      item.lineTotal ??
      item.line_total;

    const unitPrice =
      rawPrice != null
        ? Number(rawPrice)
        : (
            rawSubtotal != null &&
            quantity > 0
              ? Number(rawSubtotal) / quantity
              : null
          );

    const subtotal =
      rawSubtotal != null
        ? Number(rawSubtotal)
        : (
            unitPrice != null
              ? unitPrice * quantity
              : null
          );

    return {
      ...item,

      id: item.id ?? item.itemId ?? index,

      productId:
        item.productId ??
        item.product_id ??
        "",

      productName:
        item.productName ??
        item.name ??
        item.product_id ??
        "Ice Cream Product",

      name:
        item.name ??
        item.productName ??
        "Ice Cream Product",

      flavour:
        item.flavour ??
        item.selectedFlavour ??
        "",

      selectedFlavour:
        item.selectedFlavour ??
        item.flavour ??
        "",

      size: item.size ?? "",

      quantity,

      unitPrice:
        Number.isFinite(unitPrice)
          ? unitPrice
          : null,

      price:
        Number.isFinite(unitPrice)
          ? unitPrice
          : null,

      subtotal:
        Number.isFinite(subtotal)
          ? subtotal
          : null,

      lineTotal:
        Number.isFinite(subtotal)
          ? subtotal
          : null,
    };
  });
}

// ==========================================
// 6. PRODUCT ROW
// ==========================================

function ProductRow({ item }) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 py-5 last:border-b-0">

      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFF0F2] text-[#D44D73]">

        {item.image ? (
          <img
            src={item.image}
            alt={item.name || "Ice Cream"}
            className="h-full w-full object-cover"
          />
        ) : (
          <IceCreamCone size={25} />
        )}
      </div>

      <div className="min-w-0 flex-1">

        <h3 className="text-sm font-bold text-[#17265B]">
          {item.productName}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          {[
            item.flavour,
            item.size,
          ]
            .filter(Boolean)
            .join(" · ") ||
            "Ice Cream Product"}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          {item.quantity} ×{" "}
          {formatPrice(item.unitPrice)}
        </p>
      </div>

      <p className="shrink-0 text-sm font-bold text-[#3654FF]">
        {formatPrice(item.subtotal)}
      </p>
    </div>
  );
}

// ==========================================
// 7. ORDER PROGRESS
// ==========================================

function OrderProgress({ status }) {
  const normalized = String(
    status || "PENDING"
  ).toUpperCase();

  const currentStep =
    statusIndex[normalized] ?? 0;

  return (
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <h2 className="text-lg font-bold text-[#17265B]">
          What Happens Next
        </h2>

        <p className="text-xs text-slate-400">
          Order Progress
        </p>
      </div>

      <div className="mt-8 grid grid-cols-4 gap-2">

        {progressSteps.map((step, index) => {
          const completed =
            index <= currentStep;

          const StepIcon = step.icon;

          return (
            <div
              key={step.key}
              className="relative flex flex-col items-center text-center"
            >

              {index > 0 && (
                <div
                  className={
                    "absolute right-1/2 top-5 h-px w-full " +
                    (
                      index <= currentStep
                        ? "bg-green-500"
                        : "bg-slate-200"
                    )
                  }
                />
              )}

              <div
                className={
                  "relative z-10 flex h-10 w-10 " +
                  "items-center justify-center " +
                  "rounded-full border " +
                  (
                    completed
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-slate-200 bg-white text-slate-400"
                  )
                }
              >
                <StepIcon size={18} />
              </div>

              <p
                className={
                  "mt-3 text-xs font-bold sm:text-sm " +
                  (
                    completed
                      ? "text-green-700"
                      : "text-slate-500"
                  )
                }
              >
                {step.title}
              </p>

              <p className="mt-1 hidden text-xs text-slate-400 sm:block">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ==========================================
// 8. MAIN ORDER CONFIRMATION COMPONENT
// ==========================================

export default function OrderConfirmation() {
  const location = useLocation();
  const { orderId } = useParams();

  // ========================================
  // LOAD ORDER
  //
  // First use React Router navigation state.
  // Otherwise use the saved checkout order.
  // ========================================

  const order = useMemo(() => {
    const stateOrder =
      location.state?.order;

    if (
      stateOrder &&
      String(
        stateOrder.orderId ?? stateOrder.id
      ) === String(orderId)
    ) {
      return stateOrder;
    }

    try {
      const stored = JSON.parse(
        sessionStorage.getItem(
          "seventeen_last_order"
        ) || "null"
      );

      if (
        stored &&
        String(
          stored.orderId ?? stored.id
        ) === String(orderId)
      ) {
        return stored;
      }
    } catch (error) {
      console.error(
        "Unable to load saved wholesale order:",
        error
      );
    }

    return null;
  }, [location.state, orderId]);

  // ========================================
  // NORMALIZE PRODUCT DATA
  // ========================================

  const items = useMemo(
    () => normalizeOrderItems(order?.items),
    [order]
  );

  // ========================================
  // ORDER CALCULATIONS
  // ========================================

  const itemCount = items.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  const calculatedSubtotal =
    items.every(
      (item) =>
        item.subtotal !== null
    )
      ? items.reduce(
          (sum, item) =>
            sum + item.subtotal,
          0
        )
      : null;

  const productSubtotal =
    order?.productSubtotal != null
      ? Number(order.productSubtotal)
      : calculatedSubtotal;

  const deliveryCharge =
    order?.deliveryCharge == null
      ? null
      : Number(order.deliveryCharge);

  const tax =
    order?.taxAmount == null
      ? null
      : Number(order.taxAmount);

  const finalTotal =
    order?.finalTotal != null
      ? Number(order.finalTotal)
      : order?.orderTotal != null
        ? Number(order.orderTotal)
        : order?.totalAmount != null
          ? Number(order.totalAmount)
          : null;

  const orderStatus =
    order?.orderStatus ??
    order?.deliveryStatus ??
    order?.status ??
    "PENDING";

  const paymentStatus =
    order?.paymentStatus ??
    "PENDING";

  const method = String(
    order?.paymentMethod || ""
  ).toLowerCase();

  // ========================================
  // CREDIT PAYMENT DETAILS
  // ========================================

  const plannedCash =
    order?.creditCashAmount ??
    order?.plannedCash ??
    null;

  const requestedCredit =
    method === "credit" &&
    finalTotal != null &&
    plannedCash != null
      ? Math.max(
          0,
          finalTotal - Number(plannedCash)
        )
      : null;

  // ========================================
  // DELIVERY LOCATION
  // ========================================

  const delivery =
    order?.deliveryLocation || {};

  const latitude =
    delivery.latitude ??
    order?.deliveryLatitude ??
    order?.latitude;

  const longitude =
    delivery.longitude ??
    order?.deliveryLongitude ??
    order?.longitude;

  const validGps =
    latitude !== null &&
    latitude !== undefined &&
    latitude !== "" &&
    longitude !== null &&
    longitude !== undefined &&
    longitude !== "" &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180;

  const mapsUrl = validGps
    ? (
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
          `${latitude},${longitude}`
        )
      )
    : null;

  const address = [
    delivery.streetAddress ??
      order?.streetAddress,

    delivery.city ??
      order?.city,

    delivery.province ??
      order?.province,

    delivery.postalCode ??
      order?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const deliveryAddress =
    address ||
    order?.deliveryAddress ||
    order?.address ||
    "";

  // ========================================
  // PREPARE INVOICE DATA
  //
  // This object is passed into the
  // Tailwind-based WholesaleInvoice component.
  // ========================================

  const invoiceOrder = order
    ? {
        ...order,

        orderId:
          order.orderId ??
          order.id ??
          orderId,

        items,

        address: deliveryAddress,

        deliveryAddress,

        finalTotal,

        productSubtotal,

        paymentMethod: method,

        paymentStatus,

        deliveryStatus:
          order?.deliveryStatus ||
          orderStatus,

        creditCashAmount: plannedCash,

        createdAt:
          order.createdAt ??
          order.orderedAt ??
          order.orderDate ??
          null,
      }
    : null;

  // ========================================
  // ORDER NOT AVAILABLE
  // ========================================

  if (!order) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#FFF9F3] px-6 text-center">

        <Package
          size={50}
          className="text-[#3654FF]"
        />

        <h1 className="mt-6 text-3xl font-bold text-[#17265B]">
          Order Details Unavailable
        </h1>

        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          We could not load this wholesale order from
          the current session. Please visit your
          wholesale dashboard to review your orders.
        </p>

        <Link
          to="/wholesale/dashboard"
          className="mt-6 rounded-full bg-[#3654FF] px-7 py-3 font-semibold text-white"
        >
          Go to Wholesale Dashboard
        </Link>
      </main>
    );
  }

  // ========================================
  // PRINT ACTION
  // ========================================

  function handlePrintInvoice() {
    window.print();
  }

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <>
      {/* =====================================
          NORMAL CONFIRMATION PAGE

          Completely hidden when printing.
      ===================================== */}

      <main className="min-h-screen bg-[#FFF9F3] text-[#17265B] print:hidden">

        {/* HEADER */}

        <header className="border-b border-slate-200 bg-white">

          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">

            <Link
              to="/"
              className="flex items-center gap-3"
            >
              <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
                <IceCreamCone size={26} />
              </div>

              <div>
                <h2 className="font-bold">
                  Sathutu Sina Dairies
                </h2>

                <p className="text-xs text-slate-500">
                  Wholesale Orders
                </p>
              </div>
            </Link>

            <Link
              to="/wholesale/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF] hover:underline"
            >
              <ArrowLeft size={17} />

              Return to Orders
            </Link>
          </div>
        </header>

        {/* CONTENT */}

        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">

          {/* BREADCRUMBS */}

          <div className="mb-7 flex items-center gap-2 text-xs text-slate-400">
            <span>Cart</span>
            <span>/</span>
            <span>Checkout</span>
            <span>/</span>

            <span className="font-semibold text-[#3654FF]">
              Confirmation
            </span>
          </div>

          {/* SUCCESS MESSAGE */}

          <section className="rounded-2xl border border-green-100 bg-[#F0F8F0] p-6 sm:p-8">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div className="flex items-start gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 size={27} />
                </div>

                <div>
                  <h1 className="font-serif text-3xl font-bold text-[#365B43] sm:text-4xl">
                    Thank You. Order Received!
                  </h1>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    A little more happiness is on its way.
                    Your wholesale order has been received
                    and is awaiting team review.
                  </p>

                  <p className="mt-3 text-xs font-semibold text-green-700">
                    Order #{order.orderId ?? order.id}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-green-700">
                ORDER RECEIVED
              </span>
            </div>
          </section>

          {/* ORDER DETAILS AND SUMMARY */}

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">

            {/* LEFT COLUMN */}

            <div className="space-y-6">

              {/* ORDERED PRODUCTS */}

              <section className="rounded-2xl border border-slate-200 bg-white p-6">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <h2 className="text-lg font-bold">
                    Order Details
                  </h2>

                  <p className="text-xs text-slate-500">
                    {items.length} product entries ·{" "}
                    {itemCount} units
                  </p>
                </div>

                <div className="mt-4">
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <ProductRow
                        key={`${item.id}-${index}`}
                        item={item}
                      />
                    ))
                  ) : (
                    <p className="py-6 text-sm text-slate-500">
                      No product details available.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 size={16} />
                  Order items received for review
                </div>
              </section>

              {/* DELIVERY INFORMATION */}

              <section className="rounded-2xl border border-slate-200 bg-white p-6">

                <div className="flex items-center gap-3">

                  <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
                    <Truck size={22} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold">
                      Delivery Information
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Your selected delivery destination
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">

                  <div>
                    <p className="text-sm font-bold">
                      {order.shopName ||
                        "Wholesale Shop"}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {deliveryAddress ||
                        "Address not available"}
                    </p>
                  </div>

                  {/* GPS LOCATION */}

                  {validGps && (
                    <div className="rounded-xl bg-[#F5F7FF] p-4">

                      <p className="text-xs font-semibold">
                        GPS Delivery Coordinates
                      </p>

                      <p className="mt-2 text-sm text-slate-600">
                        Latitude: {latitude}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Longitude: {longitude}
                      </p>

                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Navigation size={17} />

                        View Delivery Location
                      </a>
                    </div>
                  )}

                  {/* INSTRUCTIONS */}

                  {(delivery.deliveryInstructions ||
                    order.deliveryInstructions) && (
                    <div>

                      <p className="text-xs font-bold text-slate-500">
                        Delivery Instructions
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {delivery.deliveryInstructions ||
                          order.deliveryInstructions}
                      </p>
                    </div>
                  )}

                  <p className="text-xs leading-5 text-slate-500">
                    Delivery availability and timing
                    will be confirmed by the
                    wholesale team.
                  </p>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}

            <div>
              <section className="rounded-2xl border border-slate-200 bg-white p-6">

                <h2 className="text-lg font-bold">
                  Order Summary
                </h2>

                <div className="mt-5 space-y-1">

                  <SummaryRow
                    label="Order Number"
                    value={`#${order.orderId ?? order.id}`}
                    bold
                  />

                  <SummaryRow
                    label="Shop"
                    value={
                      order.shopName ||
                      "Wholesale Shop"
                    }
                  />

                  <SummaryRow
                    label="Order Status"
                    value={String(orderStatus)
                      .replaceAll("_", " ")}
                  />

                  <SummaryRow
                    label="Payment Status"
                    value={String(paymentStatus)
                      .replaceAll("_", " ")}
                  />

                  <SummaryRow
                    label="Payment Method"
                    value={paymentLabel(method)}
                  />
                </div>

                {/* CREDIT DETAILS */}

                {method === "credit" && (
                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">

                    <div className="mb-3 flex items-center gap-2">
                      <Wallet
                        size={17}
                        className="text-blue-600"
                      />

                      <h3 className="text-sm font-bold">
                        Credit Payment Details
                      </h3>
                    </div>

                    <SummaryRow
                      label="Planned Cash"
                      value={formatPrice(plannedCash)}
                    />

                    <SummaryRow
                      label="Requested Credit"
                      value={formatPrice(requestedCredit)}
                      bold
                    />

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Planned cash is not recorded
                      as paid until the Sales
                      Representative confirms
                      actual cash collection.
                    </p>
                  </div>
                )}

                {/* BILL SUMMARY */}

                <div className="mt-6 border-t border-slate-200 pt-5">

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Product Subtotal
                    </span>

                    <strong className="text-xl text-[#3654FF]">
                      {formatPrice(productSubtotal)}
                    </strong>
                  </div>

                  <SummaryRow
                    label="Shipping / Delivery"
                    value={
                      deliveryCharge == null
                        ? "Pending calculation"
                        : formatPrice(deliveryCharge)
                    }
                  />

                  <SummaryRow
                    label="Taxes / Adjustments"
                    value={
                      tax == null
                        ? "Pending calculation"
                        : formatPrice(tax)
                    }
                  />

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">

                    <span className="font-bold">
                      Final Total
                    </span>

                    <span className="text-right font-bold text-[#3654FF]">
                      {formatPrice(finalTotal)}
                    </span>
                  </div>
                </div>

                {/* NOTICE */}

                <div className="mt-6 rounded-xl bg-[#FFF0F2] p-4">

                  <div className="flex items-center gap-2">
                    <FileText
                      size={16}
                      className="text-[#B74364]"
                    />

                    <p className="text-xs font-bold text-[#B74364]">
                      Wholesale Order Notice
                    </p>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#B74364]">
                    Product prices, stock availability,
                    delivery charges and payment terms
                    may require final confirmation.
                  </p>
                </div>

                <p className="mt-5 text-xs leading-5 text-slate-500">
                  Payment collection has not been
                  completed through this confirmation
                  page. Printing the bill does not
                  mark your order as paid.
                </p>

                {/* PRINT AND TRACK BUTTONS */}

                <div className="mt-7 flex flex-col gap-3">

                  <button
                    type="button"
                    onClick={handlePrintInvoice}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#3654FF] px-6 py-3 text-sm font-bold text-[#3654FF] hover:bg-blue-50"
                  >
                    <Printer size={17} />

                    Print / Save Bill as PDF
                  </button>

                  <Link
                    to="/wholesale/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3654FF] px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Track Order
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </section>
            </div>
          </div>

          {/* PROGRESS */}

          <OrderProgress status={orderStatus} />

          {/* SUPPORT FOOTER */}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 py-6">

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck
                size={18}
                className="text-[#3654FF]"
              />

              Your order details have been received.
            </div>

            <Link
              to="/flavours"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF] hover:underline"
            >
              <ShoppingBag size={17} />
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* PAGE FOOTER */}

        <footer className="border-t border-slate-200 bg-white">

          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">

            <p className="text-sm font-bold text-[#3654FF]">
              Sathutu Sina Dairies
            </p>

            <p className="text-xs text-slate-400">
              Happiness in Every Scoop!
            </p>
          </div>
        </footer>
      </main>

      {/* =====================================
          PRINT-ONLY INVOICE

          Hidden on the normal webpage.

          Visible when window.print() runs.

          This must be a SIBLING of the
          normal page, not a descendant of
          its print:hidden wrapper.
      ===================================== */}

      <div className="hidden bg-white print:block print:w-full">
        <WholesaleInvoice order={invoiceOrder} />
      </div>
    </>
  );
}
