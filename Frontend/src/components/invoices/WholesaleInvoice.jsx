
import React from "react";

// ==========================================
// CURRENCY FORMATTING
// ==========================================

function money(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `Rs. ${number.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ==========================================
// NUMBER VALIDATION
// ==========================================

function validNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ==========================================
// PAYMENT METHOD LABELS
// ==========================================

function paymentLabel(method) {
  const labels = {
    cash: "Cash on Delivery",
    bank: "Bank Transfer",
    bank_transfer: "Bank Transfer",
    cheque: "Cheque",
    credit: "Credit",
    confirm: "Confirm with Wholesale Team",
  };

  return (
    labels[String(method || "").toLowerCase()] ||
    method ||
    "Not specified"
  );
}

// ==========================================
// FORMAT ORDER DATE
// ==========================================

function formatDate(value) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Colombo",
  });
}

// ==========================================
// NORMALIZE ORDER ITEMS
// ==========================================

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const quantity =
      validNumber(item.quantity) ?? 0;

    const subtotal =
      validNumber(
        item.subtotal ??
        item.lineTotal ??
        item.line_total
      );

    const unitPrice =
      validNumber(
        item.unitPrice ??
        item.unit_price ??
        item.price
      ) ??
      (
        subtotal !== null && quantity > 0
          ? subtotal / quantity
          : null
      );

    const lineTotal =
      subtotal ??
      (
        unitPrice !== null
          ? quantity * unitPrice
          : null
      );

    return {
      id: item.id ?? index,

      productName:
        item.productName ||
        item.name ||
        item.productId ||
        item.product_id ||
        "Ice Cream Product",

      flavour:
        item.flavour ||
        item.selectedFlavour ||
        "",

      size: item.size || "",

      quantity,
      unitPrice,
      lineTotal,
    };
  });
}

// ==========================================
// WHOLESALE INVOICE COMPONENT
// ==========================================

export default function WholesaleInvoice({
  order,
}) {
  if (!order) return null;

  const orderId =
    order.orderId ??
    order.id ??
    "—";

  const items = normalizeItems(
    order.items
  );

  const calculatedSubtotal =
    items.length > 0 &&
    items.every(
      (item) => item.lineTotal !== null
    )
      ? items.reduce(
          (sum, item) =>
            sum + item.lineTotal,
          0
        )
      : null;

  const subtotal =
    validNumber(
      order.productSubtotal ??
      order.subtotal
    ) ??
    calculatedSubtotal;

  const deliveryCharge =
    validNumber(
      order.deliveryCharge ??
      order.shippingFee
    );

  const tax =
    validNumber(
      order.taxAmount ??
      order.tax
    );

  const total =
    validNumber(
      order.finalTotal ??
      order.orderTotal ??
      order.totalAmount
    );

  const paymentStatus = String(
    order.paymentStatus || "PENDING"
  ).toUpperCase();

  const orderStatus = String(
    order.orderStatus ||
    order.deliveryStatus ||
    order.status ||
    "PENDING"
  ).toUpperCase();

  const method = String(
    order.paymentMethod || ""
  ).toLowerCase();

  const plannedCash =
    validNumber(
      order.creditCashAmount ??
      order.plannedCash
    );

  const requestedCredit =
    method === "credit" &&
    total !== null &&
    plannedCash !== null
      ? Math.max(
          0,
          total - plannedCash
        )
      : null;

  const shopName =
    order.shopName ||
    "Wholesale Customer";

  const address =
    order.address ||
    order.deliveryAddress ||
    "Address not available";

  const phone =
    order.phone ||
    order.contactNumber ||
    null;

  const orderDate = formatDate(
    order.createdAt ||
    order.orderedAt ||
    order.orderDate
  );

  return (
    <section
      id="invoice-print-area"
      className="
        mx-auto w-full max-w-[210mm]
        bg-white p-8 text-[12px]
        text-slate-800 shadow-lg

        print:mt-0
        print:w-full
        print:max-w-none
        print:p-0
        print:shadow-none
        print:text-black
      "
    >
      {/* ==================================
          COMPANY HEADER
      ================================== */}

      <header
        className="
          mb-7 flex items-start
          justify-between gap-6
          border-b-2 border-blue-900
          pb-5
          print:break-inside-avoid
        "
      >
        <div>
          <h1 className="text-2xl font-extrabold text-blue-900">
            Sathutu Sina Dairies
          </h1>

          <p className="mt-2 text-sm font-medium text-slate-600">
            Ice Cream & Dairy Products
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Sri Lanka
          </p>

          <p className="mt-3 text-[11px] font-semibold text-blue-700">
            Happiness in Every Scoop!
          </p>
        </div>

        <div className="text-right">
          <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
            Wholesale Bill
          </h2>

          <p className="mt-3 text-xs">
            <strong>Order No:</strong>{" "}
            #{orderId}
          </p>

          <p className="mt-2 text-xs">
            <strong>Date:</strong>{" "}
            {orderDate}
          </p>

          <p className="mt-2 text-xs">
            <strong>Status:</strong>{" "}
            {paymentStatus}
          </p>
        </div>
      </header>

      {/* ==================================
          CUSTOMER INFORMATION
      ================================== */}

      <div
        className="
          mb-8 grid grid-cols-2 gap-8
          print:break-inside-avoid
        "
      >
        {/* BILL TO */}

        <div>
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Bill To
          </h3>

          <p className="font-bold text-slate-900">
            {shopName}
          </p>

          <p className="mt-2 whitespace-pre-line leading-6 text-slate-600">
            {address}
          </p>

          {phone && (
            <p className="mt-2 text-slate-600">
              Phone: {phone}
            </p>
          )}
        </div>

        {/* ORDER DETAILS */}

        <div>
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Order Information
          </h3>

          <p className="text-slate-700">
            <strong>Order Status:</strong>{" "}
            {orderStatus.replaceAll("_", " ")}
          </p>

          <p className="mt-2 text-slate-700">
            <strong>Payment Method:</strong>{" "}
            {paymentLabel(method)}
          </p>

          <p className="mt-2 text-slate-700">
            <strong>Payment Status:</strong>{" "}
            {paymentStatus.replaceAll("_", " ")}
          </p>
        </div>
      </div>

      {/* ==================================
          PRODUCT TABLE
      ================================== */}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-slate-100 print:table-header-group">
            <tr className="border-b-2 border-slate-300">
              <th className="w-10 p-3 text-left font-bold">
                No.
              </th>

              <th className="p-3 text-left font-bold">
                Product Description
              </th>

              <th className="p-3 text-right font-bold">
                Qty
              </th>

              <th className="p-3 text-right font-bold">
                Unit Price
              </th>

              <th className="p-3 text-right font-bold">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-5 text-center text-slate-500"
                >
                  No product details available.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={`${item.id}-${index}`}
                  className="
                    border-b border-slate-200
                    print:break-inside-avoid
                  "
                >
                  <td className="p-3 align-top">
                    {index + 1}
                  </td>

                  <td className="p-3 align-top">
                    <p className="font-semibold text-slate-900">
                      {item.productName}
                    </p>

                    {item.flavour && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Flavour: {item.flavour}
                      </p>
                    )}

                    {item.size && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Size: {item.size}
                      </p>
                    )}
                  </td>

                  <td className="p-3 text-right align-top">
                    {item.quantity}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right align-top">
                    {money(item.unitPrice)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right align-top font-semibold">
                    {money(item.lineTotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ==================================
          BILL TOTALS
      ================================== */}

      <div
        className="
          mt-7 ml-auto w-full
          max-w-[320px]
          print:break-inside-avoid
        "
      >
        <div className="flex justify-between gap-4 py-2">
          <span className="text-slate-600">
            Product Subtotal
          </span>

          <strong>
            {money(subtotal)}
          </strong>
        </div>

        <div className="flex justify-between gap-4 py-2">
          <span className="text-slate-600">
            Delivery Charge
          </span>

          <strong>
            {money(deliveryCharge)}
          </strong>
        </div>

        <div className="flex justify-between gap-4 py-2">
          <span className="text-slate-600">
            Taxes / Adjustments
          </span>

          <strong>
            {money(tax)}
          </strong>
        </div>

        <div
          className="
            mt-3 flex justify-between gap-4
            border-t-2 border-blue-900
            py-4 text-lg font-extrabold
            text-blue-900
          "
        >
          <span>Total Amount</span>

          <span>
            {money(total)}
          </span>
        </div>
      </div>

      {/* ==================================
          CREDIT DETAILS
      ================================== */}

      {method === "credit" && (
        <div
          className="
            mt-5 rounded-lg
            border border-blue-100
            bg-blue-50 p-4
            print:break-inside-avoid
          "
        >
          <p className="font-bold text-blue-900">
            Credit Payment Details
          </p>

          <div className="mt-3 flex justify-between gap-4">
            <span>Planned Cash</span>

            <strong>
              {money(plannedCash)}
            </strong>
          </div>

          <div className="mt-2 flex justify-between gap-4">
            <span>Requested Credit</span>

            <strong>
              {money(requestedCredit)}
            </strong>
          </div>

          <p className="mt-3 text-[11px] text-slate-600">
            Planned cash is not confirmed as paid
            until actual collection is recorded.
          </p>
        </div>
      )}

      {/* ==================================
          PAYMENT NOTICE
      ================================== */}

      <div
        className="
          mt-8 rounded-lg
          border border-slate-200
          bg-slate-50 p-4
          print:break-inside-avoid
        "
      >
        {paymentStatus === "PAID" ? (
          <p className="font-medium text-emerald-700">
            Payment status: PAID.
            Please refer to confirmed company
            payment records for payment details.
          </p>
        ) : (
          <p className="font-medium text-amber-800">
            Payment has not been fully confirmed.
            This wholesale bill is not proof
            of payment.
          </p>
        )}
      </div>

      {/* ==================================
          COMPANY FOOTER
      ================================== */}

      <footer
        className="
          mt-12 border-t
          border-slate-300 pt-5
          text-center leading-relaxed
          print:break-inside-avoid
        "
      >
        <p className="font-bold text-blue-900">
          Thank you for choosing Sathutu Sina Dairies!
        </p>

        <p className="mt-1 text-slate-600">
          Happiness in Every Scoop!
        </p>

        <p className="mt-3 text-[10px] text-slate-400">
          Computer-generated wholesale bill.
        </p>
      </footer>
    </section>
  );
}
