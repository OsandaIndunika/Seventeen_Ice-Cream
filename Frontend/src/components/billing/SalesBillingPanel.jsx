
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Plus,
  Trash2,
  ReceiptText,
  Download,
  Share2,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  Wallet,
  AlertCircle,
} from "lucide-react";

import { jsPDF } from "jspdf";

import { salesBillingApi } from
  "../../services/salesBillingApi";

import { salesVehicleApi } from
  "../../services/salesVehicleApi";

import DirectBankTransferPayment from
  "./DirectBankTransferPayment";

import DirectChequePayment from
  "./DirectChequePayment";

// ==========================================
// STYLES
// ==========================================

const inputClass =
  "w-full rounded-xl border border-slate-200 " +
  "bg-slate-50 px-4 py-3 outline-none " +
  "focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100";

const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 " +
  "rounded-xl bg-[#3654FF] px-5 py-3 " +
  "font-bold text-white hover:bg-[#2942D2] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ==========================================
// HELPERS
// ==========================================

function money(value) {
  return (
    "Rs. " +
    Number(value ?? 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function productName(product) {
  return [
    product.flavour,
    product.productName,
    product.size ? `(${product.size})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function paymentMethodName(method) {
  return (
    {
      CASH: "Cash",
      CREDIT: "Credit",
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque",
    }[method] ||
    method ||
    "Unknown"
  );
}

async function notifySafely(callback, bill) {
  if (typeof callback !== "function") return;

  try {
    await callback(bill);
  } catch (error) {
    console.warn(
      "Dashboard refresh callback failed:",
      error
    );
  }
}

// ==========================================
// APPLY VERIFIED BACKEND PAYMENT SUMMARY
//
// EXISTING FUNCTIONALITY UNCHANGED
//
// Only confirmed payments are counted.
// ==========================================

function mergeVerifiedPaymentSummary(bill, summary) {
  if (!bill || !summary) {
    throw new Error(
      "Missing invoice or payment verification information."
    );
  }

  if (Number(summary.billId) !== Number(bill.id)) {
    throw new Error(
      "Payment summary does not belong to this invoice."
    );
  }

  const invoiceTotal = Number(
    summary.totalAmount ?? bill.totalAmount
  );

  const confirmedCash = Number(
    summary.confirmedCash ??
    bill.confirmedCash ??
    0
  );

  const reportedNonCash = Number(
    summary.confirmedNonCash ?? 0
  );

  if (
    ![
      invoiceTotal,
      confirmedCash,
      reportedNonCash,
    ].every(Number.isFinite) ||
    invoiceTotal <= 0 ||
    confirmedCash < 0 ||
    reportedNonCash < 0
  ) {
    throw new Error(
      "Invalid payment totals returned by Spring Boot."
    );
  }

  const records = Array.isArray(summary.payments)
    ? summary.payments
    : [];

  const confirmedProofs = records.filter((payment) => {
    const status = String(
      payment.status || ""
    ).toUpperCase();

    const method = String(
      payment.method ??
      payment.paymentMethod ??
      ""
    ).toUpperCase();

    return (
      status === "CONFIRMED" &&
      ["BANK_TRANSFER", "CHEQUE"].includes(method)
    );
  });

  const seenIds = new Set();

  const confirmedFromProofs =
    confirmedProofs.reduce((total, payment) => {
      const id =
        payment.id ?? payment.paymentId;

      if (
        id == null ||
        seenIds.has(String(id))
      ) {
        throw new Error(
          "Duplicate or missing confirmed payment proof ID."
        );
      }

      seenIds.add(String(id));

      const amount = Number(payment.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Invalid confirmed bank or cheque payment amount."
        );
      }

      return total + amount;
    }, 0);

  const confirmedNonCash = Math.max(
    reportedNonCash,
    confirmedFromProofs
  );

  const confirmedPaid =
    confirmedCash + confirmedNonCash;

  if (confirmedPaid > invoiceTotal + 0.01) {
    throw new Error(
      "Confirmed payment exceeds invoice total. Check backend records."
    );
  }

  if (
    confirmedProofs.length > 0 &&
    Math.abs(
      reportedNonCash - confirmedFromProofs
    ) > 0.01
  ) {
    console.warn(
      "Backend aggregate differs from confirmed proofs.",
      {
        billId: bill.id,
        reportedNonCash,
        confirmedFromProofs,
      }
    );
  }

  const remainingBalance = Math.max(
    0,
    invoiceTotal - confirmedPaid
  );

  const isPaid =
    confirmedPaid >= invoiceTotal - 0.005 &&
    remainingBalance <= 0.005;

  return {
    ...bill,
    totalAmount: invoiceTotal,
    confirmedCash,
    confirmedNonCash,
    confirmedPaid,
    remainingBalance,
    paymentStatus: isPaid
      ? "PAID"
      : confirmedPaid > 0
        ? "PARTIALLY_PAID"
        : "PENDING",
  };
}

// ==========================================
// BATCH HELPERS
// ==========================================

const BATCH_INVENTORY_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

function getBillingToken() {
  try {
    const data = JSON.parse(
      sessionStorage.getItem("seventeen_auth") ||
      "null"
    );

    return (
      data?.token ||
      data?.accessToken ||
      data?.jwt ||
      data?.user?.token ||
      null
    );
  } catch {
    return null;
  }
}

function savedBatchNumber(item) {
  return String(
    item?.batchNumber ??
    item?.batch_number ??
    ""
  ).trim();
}

// ==========================================
// UPDATED BATCH AVAILABILITY
//
// Only available stock is checked.
//
// No batch approval-status dependency.
//
// The backend must still verify:
// - Correct active lorry
// - Correct product and flavour
// - Existing batch stock ID
// - Sufficient available quantity
// ==========================================

function batchCanBeSold(batch) {
  const available = Number(
    batch?.availableQuantity ??
    batch?.available_quantity ??
    (
      Number(batch?.quantity ?? 0) -
      Number(
        batch?.reservedQuantity ??
        batch?.reserved_quantity ??
        0
      )
    )
  );

  return (
    batch != null &&
    String(
      batch.batchNumber ??
      batch.batch_number ??
      ""
    ).trim() !== "" &&
    Number.isFinite(available) &&
    available > 0
  );
}

// ==========================================
// REQUIRE SAVED BATCH INFORMATION
//
// EXISTING FUNCTIONALITY UNCHANGED
// ==========================================

function requirePersistedBillBatches(bill) {
  if (
    !Array.isArray(bill?.items) ||
    bill.items.length === 0 ||
    bill.items.some(
      (item) => !savedBatchNumber(item)
    )
  ) {
    throw new Error(
      "Saved invoice batch details are missing. " +
      "Update SalesBillingService and getBill to " +
      "persist and return batchNumber for every " +
      "billed line before generating the invoice PDF."
    );
  }
}

// ==========================================
// BUILD SALES INVOICE PDF
//
// EXISTING FUNCTIONALITY UNCHANGED
//
// Includes saved batch numbers.
// ==========================================

function buildInvoicePDF(bill) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 15;

  let y = 20;

  const write = (
    value,
    x,
    positionY,
    options = {}
  ) => {
    doc.text(
      String(value ?? ""),
      x,
      positionY,
      options
    );
  };

  const newPageIfNeeded = (
    neededHeight = 12
  ) => {
    if (y + neededHeight > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // ========================================
  // INVOICE HEADER
  // ========================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);

  write(
    "SATHUTU SINA DAIRIES",
    margin,
    y
  );

  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  write(
    "Ice Cream and Dairy Products",
    margin,
    y
  );

  y += 5;

  write("Sri Lanka", margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);

  write(
    "SALES INVOICE",
    pageWidth - margin,
    21,
    { align: "right" }
  );

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);

  doc.line(margin, 38, 195, 38);

  y = 48;

  // ========================================
  // INVOICE INFORMATION
  // ========================================

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const date = bill.createdAt
    ? new Date(
        bill.createdAt
      ).toLocaleString("en-GB", {
        timeZone: "Asia/Colombo",
      })
    : "";

  write(
    `Invoice No: INV-${bill.id}`,
    margin,
    y
  );

  write(
    `Date: ${date}`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  y += 8;

  doc.setFont("helvetica", "bold");

  write("BILL TO", margin, y);

  y += 6;

  doc.setFont("helvetica", "normal");

  write(
    bill.customerName || "Customer",
    margin,
    y
  );

  y += 6;

  if (bill.customerPhone) {
    write(
      `Phone: ${bill.customerPhone}`,
      margin,
      y
    );

    y += 6;
  }

  write(
    `Vehicle: ${bill.vehicleNumber || ""}`,
    margin,
    y
  );

  y += 12;

  // ========================================
  // PRODUCT TABLE
  // ========================================

  const drawTableHeader = () => {
    doc.setFillColor(232, 238, 248);

    doc.rect(
      margin,
      y - 6,
      180,
      10,
      "F"
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    write("PRODUCT", 18, y);
    write("BATCH", 115, y);
    write("QTY", 137, y);

    write(
      "PRICE",
      159,
      y,
      { align: "right" }
    );

    write(
      "AMOUNT",
      192,
      y,
      { align: "right" }
    );

    y += 9;
  };

  drawTableHeader();

  const items = Array.isArray(bill.items)
    ? bill.items
    : [];

  for (const item of items) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const description =
      `${item.productName || ""} - ` +
      `${item.flavour || ""}` +
      (
        item.size
          ? ` (${item.size})`
          : ""
      );

    const descriptionLines =
      doc.splitTextToSize(
        description,
        86
      );

    const rowHeight = Math.max(
      9,
      descriptionLines.length * 5 + 4
    );

    if (y + rowHeight > 280) {
      doc.addPage();
      y = 20;

      drawTableHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }

    doc.text(
      descriptionLines,
      18,
      y
    );

    write(
      savedBatchNumber(item),
      115,
      y
    );

    write(
      item.quantity,
      140,
      y,
      { align: "right" }
    );

    write(
      Number(
        item.unitPrice ?? 0
      ).toFixed(2),
      159,
      y,
      { align: "right" }
    );

    write(
      Number(
        item.lineTotal ??
        Number(item.unitPrice ?? 0) *
        Number(item.quantity ?? 0)
      ).toFixed(2),
      192,
      y,
      { align: "right" }
    );

    y += rowHeight;

    doc.setDrawColor(220, 226, 235);

    doc.line(
      16,
      y - 3,
      194,
      y - 3
    );
  }

  y += 9;

  // ========================================
  // INVOICE TOTAL
  // ========================================

  newPageIfNeeded(100);

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.6);

  doc.line(115, y, 195, y);

  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  write("TOTAL", 116, y);

  write(
    money(bill.totalAmount),
    194,
    y,
    { align: "right" }
  );

  y += 12;

  // ========================================
  // LATEST PAYMENT INFORMATION
  // ========================================

  const confirmedCash = Number(
    bill.confirmedCash ?? 0
  );

  const confirmedNonCash = Number(
    bill.confirmedNonCash ?? 0
  );

  const confirmedPaid = Number(
    bill.confirmedPaid ??
    (confirmedCash + confirmedNonCash)
  );

  const remainingBalance = Number(
    bill.remainingBalance ?? 0
  );

  const isPaid =
    String(
      bill.paymentStatus || ""
    ).toUpperCase() === "PAID" &&
    remainingBalance <= 0.005;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  write(
    `Payment Method: ${paymentMethodName(
      bill.paymentMethod
    )}`,
    margin,
    y
  );

  y += 7;

  write(
    `Payment Status: ${
      isPaid
        ? "PAID"
        : bill.paymentStatus || "PENDING"
    }`,
    margin,
    y
  );

  y += 7;

  write(
    `Confirmed Cash: ${money(confirmedCash)}`,
    margin,
    y
  );

  y += 7;

  write(
    `Confirmed Bank / Cheque: ${money(
      confirmedNonCash
    )}`,
    margin,
    y
  );

  y += 7;

  write(
    `Total Confirmed Paid: ${money(
      confirmedPaid
    )}`,
    margin,
    y
  );

  y += 7;

  write(
    `Outstanding: ${money(
      remainingBalance
    )}`,
    margin,
    y
  );

  y += 12;

  // ========================================
  // PAYMENT NOTE
  // ========================================

  doc.setFontSize(9);

  doc.setTextColor(100, 116, 139);

  const note = isPaid
    ? (
        "Full payment has been confirmed " +
        "in the company records."
      )
    : (
        "This invoice is not proof of payment. " +
        "Any outstanding balance remains payable."
      );

  doc.text(
    doc.splitTextToSize(note, 175),
    margin,
    y
  );

  y += 20;

  newPageIfNeeded(15);

  // ========================================
  // FOOTER
  // ========================================

  doc.setTextColor(30, 58, 138);
  doc.setFont("helvetica", "bold");

  write(
    "Thank you for choosing Sathutu Sina Dairies!",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  write(
    "Happiness in Every Scoop!",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  return doc;
}

// ==========================================
// MAIN SALES BILLING PANEL
// ==========================================

export default function SalesBillingPanel({
  onBillCreated,
  onPaymentRecorded,
  onCreditBalanceChanged,
  onViewCreditBalances,
}) {

  // ========================================
  // STATE
  // ========================================

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [customerName, setCustomerName] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [selectedStockId, setSelectedStockId] =
    useState("");

  const [batchInventory, setBatchInventory] =
    useState([]);

  const [batchLoading, setBatchLoading] =
    useState(false);

  const [batchError, setBatchError] =
    useState("");

  const [
    selectedBatchStockId,
    setSelectedBatchStockId,
  ] = useState("");

  const [batchRefresh, setBatchRefresh] =
    useState(0);

  const [quantity, setQuantity] =
    useState("1");

  const [items, setItems] =
    useState([]);

  const [paymentMethod, setPaymentMethod] =
    useState("CASH");

  const [createdBill, setCreatedBill] =
    useState(null);

  const [cashAmount, setCashAmount] =
    useState("");

  const [confirmingCash, setConfirmingCash] =
    useState(false);

  const [generatingPDF, setGeneratingPDF] =
    useState(false);

  const [refreshingBill, setRefreshingBill] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ========================================
  // IDEMPOTENCY KEYS
  // ========================================

  const billKeyRef = useRef(
    crypto.randomUUID()
  );

  const cashKeyRef = useRef(
    crypto.randomUUID()
  );

  const pdfBusyRef = useRef(false);

  // ========================================
  // LOAD AVAILABLE LORRY PRODUCTS
  // ========================================

  const loadProducts = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const result =
          await salesBillingApi.getProducts();

        if (!Array.isArray(result)) {
          throw new Error(
            "Invalid billable products response."
          );
        }

        setProducts(result);

      } catch (err) {
        setError(
          err.message ||
          "Unable to load products."
        );

      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ========================================
  // LOAD BATCH INVENTORY
  //
  // Loads all registered batches belonging
  // to the selected active lorry.
  //
  // No quality-status information required.
  // ========================================

  useEffect(() => {
    let cancelled = false;

    async function loadBatches() {
      setBatchLoading(true);
      setBatchError("");
      setBatchInventory([]);

      try {
        const session =
          await salesVehicleApi.currentSession();

        const vehicleId = Number(
          session?.vehicleId ??
          session?.vehicle_id
        );

        if (
          !session?.active ||
          !Number.isSafeInteger(vehicleId) ||
          vehicleId <= 0
        ) {
          throw new Error(
            "Select an active sales lorry " +
            "before creating a bill."
          );
        }

        const token =
          getBillingToken();

        if (!token) {
          throw new Error(
            "Login token is missing. " +
            "Please sign in again."
          );
        }

        const response = await fetch(
          `${BATCH_INVENTORY_BASE}/api/sales/vehicles/${vehicleId}/batch-inventory`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          let msg =
            `Batch inventory failed (${response.status}).`;

          try {
            const detail = await response.json();

            msg =
              detail.message ||
              detail.detail ||
              msg;
          } catch {
            // Keep the HTTP error message.
          }

          throw new Error(msg);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid batch inventory response."
          );
        }

        if (!cancelled) {
          setBatchInventory(data);
        }

      } catch (err) {
        if (!cancelled) {
          setBatchError(
            err?.message ||
            "Unable to retrieve lorry batches."
          );
        }

      } finally {
        if (!cancelled) {
          setBatchLoading(false);
        }
      }
    }

    loadBatches();

    return () => {
      cancelled = true;
    };

  }, [batchRefresh]);

  // ========================================
  // SELECTED PRODUCT
  // ========================================

  const selectedProduct = products.find(
    (product) =>
      String(product.stockId) ===
      String(selectedStockId)
  );

  // ========================================
  // SELECTED PRODUCT'S BATCHES
  //
  // Match by exact aggregate stock ID.
  // ========================================

  const selectedBatchProduct =
    batchInventory.find(
      (row) =>
        String(row.vehicleStockId) ===
        String(selectedStockId)
    );

  const productBatches = Array.isArray(
    selectedBatchProduct?.batches
  )
    ? selectedBatchProduct.batches
    : [];

  // ========================================
  // UPDATED:
  // AVAILABLE BATCHES
  //
  // Only quantities determine whether a
  // batch appears in the selectable list.
  //
  // Batches with zero stock remain visible
  // as disabled options.
  // ========================================

  const availableBatches =
    productBatches.filter(batchCanBeSold);

  const unavailableBatches =
    productBatches.filter(
      (batch) => !batchCanBeSold(batch)
    );

  const selectedBatch =
    availableBatches.find(
      (row) =>
        String(row.vehicleBatchStockId) ===
        String(selectedBatchStockId)
    );

  const selectedBatchAlreadyInBill =
    items
      .filter(
        (row) =>
          String(row.vehicleBatchStockId) ===
          String(selectedBatchStockId)
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.quantity),
        0
      );

  const selectedBatchRemaining =
    selectedBatch
      ? Math.max(
          0,
          Number(
            selectedBatch.availableQuantity
          ) -
          selectedBatchAlreadyInBill
        )
      : 0;

  // ========================================
  // CALCULATE BILL TOTAL
  // ========================================

  const grandTotal = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          Number(item.unitPrice) *
          Number(item.quantity),
        0
      ),
    [items]
  );

  // ========================================
  // CREDIT AND PAYMENT INFORMATION
  // ========================================

  const isCreditBill =
    createdBill?.paymentMethod === "CREDIT";

  const confirmedCash = Number(
    createdBill?.confirmedCash ?? 0
  );

  const confirmedNonCash = Number(
    createdBill?.confirmedNonCash ?? 0
  );

  const remainingBalance = Number(
    createdBill?.remainingBalance ?? 0
  );

  const hasOutstandingCredit =
    isCreditBill && remainingBalance > 0;

  const isCreditPaid =
    isCreditBill && remainingBalance === 0;

  // ========================================
  // ADD PRODUCT TO DRAFT
  //
  // UPDATED:
  //
  // Only available batch quantity is checked.
  //
  // Existing duplicate-batch merging and
  // aggregate lorry validation are retained.
  // ========================================

  function addItem(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const count = Number(quantity);

    if (
      !selectedProduct ||
      !selectedBatch ||
      !Number.isSafeInteger(count) ||
      count <= 0
    ) {
      setError(
        "Select a lorry product, an available " +
        "batch and a valid quantity."
      );

      return;
    }

    // ========================================
    // VERIFY BATCH AVAILABILITY
    //
    // There is no batch approval check.
    // ========================================

    if (!batchCanBeSold(selectedBatch)) {
      setError(
        "The selected batch has no available stock."
      );

      return;
    }

    if (count > selectedBatchRemaining) {
      setError(
        `Only ${selectedBatchRemaining} units ` +
        `remain available in batch ` +
        `${selectedBatch.batchNumber}.`
      );

      return;
    }

    // ========================================
    // CHECK TOTAL PRODUCT AVAILABILITY
    // ========================================

    const aggregateDraft =
      items
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
      aggregateDraft + count >
      Number(selectedProduct.availableQuantity)
    ) {
      setError(
        "Insufficient aggregate stock on " +
        "the selected lorry."
      );

      return;
    }

    // ========================================
    // ADD OR UPDATE SELECTED BATCH LINE
    // ========================================

    const batchId =
      Number(
        selectedBatch.vehicleBatchStockId
      );

    const existing = items.find(
      (item) =>
        Number(item.vehicleBatchStockId) ===
        batchId
    );

    if (existing) {
      setItems((previous) =>
        previous.map((item) =>
          Number(item.vehicleBatchStockId) ===
          batchId
            ? {
                ...item,
                quantity:
                  Number(item.quantity) + count,
              }
            : item
        )
      );

    } else {
      setItems((previous) => [
        ...previous,
        {
          stockId:
            selectedProduct.stockId,

          productId:
            selectedProduct.productId,

          productName:
            selectedProduct.productName,

          size:
            selectedProduct.size,

          flavour:
            selectedProduct.flavour,

          vehicleBatchStockId:
            batchId,

          batchNumber:
            String(selectedBatch.batchNumber),

          quantity:
            count,

          unitPrice:
            Number(selectedProduct.unitPrice),
        },
      ]);
    }

    setQuantity("1");
  }

  // ========================================
  // CREATE AND SAVE BILL
  //
  // EXISTING FUNCTIONALITY UNCHANGED
  //
  // The backend is responsible for
  // atomically deducting aggregate stock
  // and the selected batch stock.
  // ========================================

  async function createBill() {
    if (
      saving ||
      !customerName.trim() ||
      items.length === 0
    ) {
      setError(
        "Enter the customer name and add products."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    let bill;

    try {
      bill =
        await salesBillingApi.createBill({
          receiptKey:
            billKeyRef.current,

          customerName:
            customerName.trim(),

          customerPhone:
            customerPhone.trim(),

          paymentMethod,

          items: items.map((item) => ({
            productId:
              item.productId,

            flavour:
              item.flavour,

            quantity:
              item.quantity,

            vehicleBatchStockId:
              item.vehicleBatchStockId,
          })),
        });

    } catch (err) {
      setError(
        err.message ||
        "Unable to save the bill."
      );

      setSaving(false);

      return;
    }

    setCreatedBill(bill);

    // A successful bill is committed.
    // Do not retry solely because some
    // response fields are missing.

    if (
      !Array.isArray(bill?.items) ||
      bill.items.some(
        (row) => !savedBatchNumber(row)
      )
    ) {
      console.warn(
        "Saved bill response lacks batch-number snapshots. " +
        "Check SalesBillingService."
      );
    }

    billKeyRef.current =
      crypto.randomUUID();

    setSuccess(
      `Invoice INV-${bill.id} created successfully.` +
      (
        bill.paymentMethod === "CREDIT" &&
        Number(bill.remainingBalance) > 0
          ? (
              " The unpaid balance is " +
              "recorded as credit."
            )
          : ""
      )
    );

    setSaving(false);

    await notifySafely(
      onBillCreated,
      bill
    );

    if (
      bill.paymentMethod === "CREDIT"
    ) {
      await notifySafely(
        onCreditBalanceChanged,
        bill
      );
    }
  }

  // ========================================
  // RECORD ACTUAL CASH
  //
  // EXISTING FUNCTIONALITY UNCHANGED
  // ========================================

  async function receiveCash() {
    if (
      confirmingCash ||
      !createdBill ||
      !["CASH", "CREDIT"].includes(
        createdBill.paymentMethod
      )
    ) {
      return;
    }

    const amount = Number(cashAmount);

    const validPrecision =
      /^\d+(\.\d{1,2})?$/.test(
        cashAmount.trim()
      );

    if (
      !validPrecision ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount >
        Number(createdBill.remainingBalance)
    ) {
      setError(
        "Enter a valid cash amount within " +
        "the remaining balance."
      );

      return;
    }

    if (
      !window.confirm(
        `Confirm physical cash receipt of ` +
        `${money(amount)}?`
      )
    ) {
      return;
    }

    setConfirmingCash(true);
    setError("");
    setSuccess("");

    let updated;

    try {
      updated =
        await salesBillingApi.receiveCash(
          createdBill.id,
          amount.toFixed(2),
          cashKeyRef.current
        );

    } catch (err) {
      setError(
        err.message ||
        "Unable to confirm cash receipt."
      );

      setConfirmingCash(false);

      return;
    }

    setCreatedBill(updated);
    setCashAmount("");

    cashKeyRef.current =
      crypto.randomUUID();

    setSuccess(
      "Cash payment confirmed successfully." +
      (
        updated.paymentMethod === "CREDIT"
          ? (
              Number(updated.remainingBalance) > 0
                ? (
                    " Remaining credit: " +
                    money(updated.remainingBalance)
                  )
                : " The credit bill is fully paid."
            )
          : ""
      )
    );

    setConfirmingCash(false);

    await notifySafely(
      onPaymentRecorded,
      updated
    );

    if (
      updated.paymentMethod === "CREDIT"
    ) {
      await notifySafely(
        onCreditBalanceChanged,
        updated
      );
    }
  }

  // ========================================
  // GET LATEST INVOICE
  //
  // EXISTING FUNCTIONALITY UNCHANGED
  // ========================================

  const getLatestInvoice = useCallback(
    async (billId) => {
      if (
        !Number.isSafeInteger(Number(billId)) ||
        Number(billId) <= 0
      ) {
        throw new Error(
          "Invalid sales invoice ID."
        );
      }

      const updated =
        await salesBillingApi.getBill(billId);

      if (
        !updated ||
        Number(updated.id) !== Number(billId)
      ) {
        throw new Error(
          "Unable to retrieve the correct invoice."
        );
      }

      let latestBill = updated;

      if (
        ["BANK_TRANSFER", "CHEQUE"].includes(
          updated.paymentMethod
        )
      ) {
        const summary =
          await salesBillingApi.getBillPayments(
            billId
          );

        latestBill =
          mergeVerifiedPaymentSummary(
            updated,
            summary
          );
      }

      setCreatedBill((previous) => {
        if (
          !previous ||
          Number(previous.id) !== Number(billId)
        ) {
          return previous;
        }

        return latestBill;
      });

      return latestBill;
    },
    []
  );

  // ========================================
  // REFRESH CURRENT SAVED BILL
  //
  // EXISTING FUNCTIONALITY UNCHANGED
  // ========================================

  const refreshSavedBill = useCallback(
    async () => {
      const id = createdBill?.id;

      if (!id) return null;

      try {
        return await getLatestInvoice(id);

      } catch (err) {
        console.warn(
          "Unable to refresh saved invoice:",
          err
        );

        return null;
      }
    },
    [
      createdBill?.id,
      getLatestInvoice,
    ]
  );

  // ========================================
  // MANUAL INVOICE REFRESH
  // ========================================

  async function refreshInvoiceStatus() {
    if (
      !createdBill?.id ||
      refreshingBill
    ) {
      return;
    }

    setRefreshingBill(true);
    setError("");

    try {
      const updated =
        await getLatestInvoice(
          createdBill.id
        );

      setSuccess(
        `Invoice INV-${updated.id} refreshed. ` +
        `Current status: ${updated.paymentStatus}.`
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to refresh invoice status."
      );

    } finally {
      setRefreshingBill(false);
    }
  }

  // ========================================
  // PAYMENT EVIDENCE CALLBACK
  //
  // Uploading evidence never counts as
  // confirmed payment.
  // ========================================

  const handlePaymentEvidenceSubmitted =
    useCallback(
      async () => {
        await refreshSavedBill();
      },
      [refreshSavedBill]
    );

  // ========================================
  // INVOICE PDF FILENAME
  // ========================================

  function invoicePDFName(bill) {
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    return (
      `Invoice-${bill.id}-` +
      `${String(
        bill.paymentStatus || "PENDING"
      ).toUpperCase()}-${stamp}.pdf`
    );
  }

  // ========================================
  // DOWNLOAD LATEST INVOICE PDF
  // ========================================

  async function downloadPDF() {
    if (
      !createdBill ||
      pdfBusyRef.current
    ) {
      return;
    }

    pdfBusyRef.current = true;

    setGeneratingPDF(true);
    setError("");

    try {
      const latestBill =
        await getLatestInvoice(
          createdBill.id
        );

      requirePersistedBillBatches(
        latestBill
      );

      const doc =
        buildInvoicePDF(latestBill);

      doc.save(
        invoicePDFName(latestBill)
      );

      setSuccess(
        "Latest invoice PDF downloaded successfully."
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to download the latest invoice."
      );

    } finally {
      pdfBusyRef.current = false;
      setGeneratingPDF(false);
    }
  }

  // ========================================
  // SHARE LATEST INVOICE PDF
  // ========================================

  async function sharePDF() {
    if (
      !createdBill ||
      pdfBusyRef.current
    ) {
      return;
    }

    pdfBusyRef.current = true;

    setGeneratingPDF(true);
    setError("");

    try {
      const latestBill =
        await getLatestInvoice(
          createdBill.id
        );

      requirePersistedBillBatches(
        latestBill
      );

      const doc =
        buildInvoicePDF(latestBill);

      const blob =
        doc.output("blob");

      const file = new File(
        [blob],
        invoicePDFName(latestBill),
        {
          type: "application/pdf",
        }
      );

      const shareData = {
        title:
          `Invoice INV-${latestBill.id}`,

        text:
          "Your invoice from Sathutu Sina Dairies.",

        files: [file],
      };

      if (
        navigator.canShare?.(shareData) &&
        navigator.share
      ) {
        await navigator.share(
          shareData
        );

      } else {
        doc.save(
          invoicePDFName(latestBill)
        );

        setSuccess(
          "Latest invoice downloaded. " +
          "Attach it to a WhatsApp message " +
          "or email to the customer."
        );
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setError(
          err.message ||
          "Unable to share the latest invoice."
        );
      }

    } finally {
      pdfBusyRef.current = false;
      setGeneratingPDF(false);
    }
  }

  // ========================================
  // CREATE ANOTHER BILL
  //
  // EXISTING FUNCTIONALITY UNCHANGED
  // ========================================

  function startNewBill() {
    setCreatedBill(null);

    setCustomerName("");
    setCustomerPhone("");

    setSelectedStockId("");
    setSelectedBatchStockId("");

    setQuantity("1");
    setItems([]);

    setPaymentMethod("CASH");
    setCashAmount("");

    setError("");
    setSuccess("");

    billKeyRef.current =
      crypto.randomUUID();

    cashKeyRef.current =
      crypto.randomUUID();

    loadProducts();

    setBatchRefresh(
      (value) => value + 1
    );
  }

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3">

        <h2 className="font-serif text-xl font-bold text-[#17265B]">
          {createdBill
            ? `Invoice INV-${createdBill.id}`
            : "Create New Bill"}
        </h2>

        {!createdBill && (
          <button
            type="button"
            onClick={() => {
              loadProducts();

              setBatchRefresh(
                (value) => value + 1
              );
            }}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-bold text-[#3654FF]"
          >
            <RefreshCw size={16} />
            Refresh Prices
          </button>
        )}

        {createdBill && (
          <button
            type="button"
            onClick={refreshInvoiceStatus}
            disabled={
              refreshingBill ||
              generatingPDF
            }
            className="flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-[#3654FF] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                refreshingBill
                  ? "animate-spin"
                  : ""
              }
            />

            {refreshingBill
              ? "Refreshing..."
              : "Refresh Invoice"}
          </button>
        )}

      </div>

      {/* ERROR */}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* SUCCESS */}

      {success && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </p>
      )}

      {/* ================================== */}
      {/* CREATE BILL */}
      {/* ================================== */}

      {!createdBill ? (
        <>

          <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
            Product prices are loaded from the
            Admin-controlled wholesale catalog
            and cannot be edited here.
          </div>

          {/* CUSTOMER INFORMATION */}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Shop / Customer Name
              </label>

              <input
                value={customerName}
                onChange={(event) =>
                  setCustomerName(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Enter customer name"
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Customer Phone
              </label>

              <input
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="07XXXXXXXX"
                maxLength={30}
              />
            </div>

          </div>

          {/* ================================== */}
          {/* PRODUCT SELECTION */}
          {/* ================================== */}

          <form
            onSubmit={addItem}
            className="mt-6 space-y-4"
          >

            {/* PRODUCT */}

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Product From Selected Lorry
              </label>

              <select
                value={selectedStockId}
                onChange={(event) => {
                  setSelectedStockId(
                    event.target.value
                  );

                  setSelectedBatchStockId("");
                }}
                className={inputClass}
                disabled={loading}
              >
                <option value="">
                  {loading
                    ? "Loading products..."
                    : "Select a product"}
                </option>

                {products.map((product) => (
                  <option
                    key={product.stockId}
                    value={product.stockId}
                  >
                    {productName(product)}
                    {" — "}
                    {money(product.unitPrice)}
                    {" — "}
                    {product.availableQuantity} available
                  </option>
                ))}
              </select>
            </div>

            {/* ================================== */}
            {/* PRODUCTION BATCH SELECTION */}
            {/*
              UPDATED:

              - No batch approval status.
              - Any registered batch with
                available stock can be selected.
              - Zero-stock batches are disabled.
              - Batch quantities account for
                products already in the draft.
            */}
            {/* ================================== */}

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Production Batch Number
              </label>

              <select
                value={
                  selectedBatch
                    ? selectedBatchStockId
                    : ""
                }
                onChange={(event) =>
                  setSelectedBatchStockId(
                    event.target.value
                  )
                }
                className={inputClass}
                disabled={
                  !selectedProduct ||
                  batchLoading ||
                  Boolean(batchError)
                }
                required
              >
                <option value="">
                  {batchLoading
                    ? "Loading lorry batches..."
                    : "Select an available batch"}
                </option>

                {availableBatches.map((batch) => {
                  const draftedQuantity =
                    items
                      .filter(
                        (item) =>
                          String(
                            item.vehicleBatchStockId
                          ) ===
                          String(
                            batch.vehicleBatchStockId
                          )
                      )
                      .reduce(
                        (sum, item) =>
                          sum + Number(item.quantity),
                        0
                      );

                  const remaining = Math.max(
                    0,
                    Number(
                      batch.availableQuantity
                    ) - draftedQuantity
                  );

                  return (
                    <option
                      key={
                        batch.vehicleBatchStockId
                      }
                      value={
                        batch.vehicleBatchStockId
                      }
                      disabled={remaining <= 0}
                    >
                      Batch {batch.batchNumber}
                      {" — "}
                      {remaining} available
                    </option>
                  );
                })}

                {/* ZERO-STOCK BATCHES */}

                {unavailableBatches.map((batch) => (
                  <option
                    key={
                      batch.vehicleBatchStockId
                    }
                    value={
                      batch.vehicleBatchStockId
                    }
                    disabled
                  >
                    Batch {batch.batchNumber}
                    {" — "}
                    No available stock
                  </option>
                ))}

              </select>

              {/* NO AVAILABLE BATCHES */}

              {selectedProduct &&
                !batchLoading &&
                !batchError &&
                availableBatches.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    No batches with available stock
                    were found for this product.
                    Check the selected lorry inventory.
                  </p>
                )}

              {/* BATCH LOADING ERROR */}

              {batchError && (
                <p
                  role="alert"
                  className="mt-2 text-sm text-red-700"
                >
                  {batchError}
                </p>
              )}

              {/* SELECTED BATCH INFORMATION */}

              {selectedBatch && (
                <p className="mt-2 text-xs text-slate-500">
                  Batch {selectedBatch.batchNumber}:
                  {" "}
                  {selectedBatchRemaining}
                  {" "}
                  units available to add.
                </p>
              )}

            </div>

            {/* ================================== */}
            {/* PRICE, QUANTITY, LINE TOTAL */}
            {/* ================================== */}

            <div className="grid gap-4 sm:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Unit Price
                </label>

                <input
                  readOnly
                  value={
                    selectedProduct
                      ? money(
                          selectedProduct.unitPrice
                        )
                      : ""
                  }
                  placeholder="Automatically filled"
                  className={
                    inputClass +
                    " cursor-not-allowed bg-slate-100"
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  max={
                    selectedBatch
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
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Line Total
                </label>

                <input
                  readOnly
                  value={
                    selectedProduct
                      ? money(
                          Number(
                            selectedProduct.unitPrice
                          ) *
                          Number(quantity || 0)
                        )
                      : ""
                  }
                  className={
                    inputClass +
                    " cursor-not-allowed bg-slate-100"
                  }
                />
              </div>

            </div>

            {/* ADD ITEM */}

            <button
              type="submit"
              disabled={
                !selectedProduct ||
                !selectedBatch ||
                selectedBatchRemaining <= 0 ||
                batchLoading
              }
              className={primaryButtonClass}
            >
              <Plus size={18} />
              Add Product to Bill
            </button>

          </form>

          {/* ================================== */}
          {/* SELECTED PRODUCTS */}
          {/* ================================== */}

          <h3 className="mb-4 mt-8 font-bold text-[#17265B]">
            Selected Products
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">

            <table className="w-full min-w-[520px] text-left text-sm">

              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">
                    Product
                  </th>

                  <th className="p-3">
                    Batch No.
                  </th>

                  <th className="p-3 text-right">
                    Qty
                  </th>

                  <th className="p-3 text-right">
                    Price
                  </th>

                  <th className="p-3 text-right">
                    Total
                  </th>

                  <th className="p-3"></th>
                </tr>
              </thead>

              <tbody>

                {items.map((item) => (
                  <tr
                    key={
                      item.vehicleBatchStockId
                    }
                    className="border-t"
                  >
                    <td className="p-3">
                      {productName(item)}
                    </td>

                    <td className="p-3">
                      {item.batchNumber}
                    </td>

                    <td className="p-3 text-right">
                      {item.quantity}
                    </td>

                    <td className="p-3 text-right">
                      {money(item.unitPrice)}
                    </td>

                    <td className="p-3 text-right">
                      {money(
                        item.unitPrice *
                        item.quantity
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setItems(
                            (previous) =>
                              previous.filter(
                                (row) =>
                                  row.vehicleBatchStockId !==
                                  item.vehicleBatchStockId
                              )
                          )
                        }
                        className="text-red-500"
                        aria-label="Remove product"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-5 text-center text-slate-500"
                    >
                      No products added yet.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          {/* GRAND TOTAL */}

          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-5">

            <span className="font-bold">
              Grand Total
            </span>

            <span className="text-2xl font-bold text-[#3654FF]">
              {money(grandTotal)}
            </span>

          </div>

          {/* ================================== */}
          {/* PAYMENT METHOD */}
          {/* ================================== */}

          <h3 className="mb-4 mt-7 font-bold text-[#17265B]">
            Payment Method
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

            {[
              ["CASH", "Cash"],
              ["CREDIT", "Credit"],
              ["BANK_TRANSFER", "Bank Transfer"],
              ["CHEQUE", "Cheque"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPaymentMethod(value)
                }
                className={
                  "rounded-xl border-2 px-3 py-3 text-sm font-bold " +
                  (
                    paymentMethod === value
                      ? (
                          "border-[#3654FF] bg-[#EEF1FF] " +
                          "text-[#3654FF]"
                        )
                      : "border-slate-200 text-slate-600"
                  )
                }
              >
                {label}
              </button>
            ))}

          </div>

          {/* ================================== */}
          {/* CREDIT INFORMATION */}
          {/* ================================== */}

          {paymentMethod === "CREDIT" && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

              <div className="flex items-center gap-2 font-bold text-amber-900">
                <CreditCard size={18} />
                Credit Sale
              </div>

              <p className="mt-2 text-sm text-amber-800">
                The invoice will be saved even if
                the customer pays only part of
                the amount. Any unpaid balance
                remains recorded against this
                sales invoice until collected.
              </p>

              <p className="mt-2 text-xs text-amber-700">
                After saving, enter the cash
                actually received. The remaining
                balance can be collected later
                through Sales Billing Credit.
              </p>

            </div>
          )}

          {/* ================================== */}
          {/* BANK TRANSFER INFORMATION */}
          {/* ================================== */}

          {paymentMethod === "BANK_TRANSFER" && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

              The shop owner must transfer the
              <strong> entire invoice amount.</strong>
              {" "}

              After saving, the company's verified
              bank details will appear.
              {" "}

              Upload the transfer slip for Admin
              verification. Partial transfers
              are not accepted.

            </div>
          )}

          {/* ================================== */}
          {/* CHEQUE INFORMATION */}
          {/* ================================== */}

          {paymentMethod === "CHEQUE" && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

              The shop owner must issue a cheque
              for the
              <strong> entire invoice amount.</strong>
              {" "}

              Collect the original physical cheque
              and upload its photograph for Admin
              verification. Payment is confirmed
              only after bank clearance.

            </div>
          )}

          {/* ================================== */}
          {/* CREATE BILL */}
          {/* ================================== */}

          <button
            type="button"
            onClick={createBill}
            disabled={
              saving ||
              !items.length ||
              !customerName.trim()
            }
            className={
              primaryButtonClass +
              " mt-7 py-4"
            }
          >
            <ReceiptText size={18} />

            {saving
              ? "Creating Bill..."
              : "Create and Save Bill"}
          </button>

          <p className="mt-3 text-xs text-slate-500">
            Saving the bill deducts the sold
            products from the selected lorry.
            Selecting a payment method does not
            automatically confirm payment.
          </p>

        </>
      ) : (
        <>

          {/* ================================== */}
          {/* SAVED BILL DETAILS */}
          {/* ================================== */}

          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">

            <div className="flex items-center gap-3">

              <CheckCircle2 className="text-green-600" />

              <div>
                <p className="font-bold text-green-800">
                  Bill Saved
                </p>

                <p className="text-sm text-green-700">
                  Invoice INV-{createdBill.id}
                </p>
              </div>

            </div>

            <div className="mt-5 space-y-3 text-sm">

              <div className="flex flex-wrap justify-between gap-3">
                <span>Customer</span>

                <strong>
                  {createdBill.customerName}
                </strong>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <span>Payment Method</span>

                <strong>
                  {paymentMethodName(
                    createdBill.paymentMethod
                  )}
                </strong>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <span>Payment Status</span>

                <strong
                  className={
                    createdBill.paymentStatus === "PAID"
                      ? "text-green-700"
                      : "text-amber-700"
                  }
                >
                  {createdBill.paymentStatus}
                </strong>
              </div>

              <div className="flex flex-wrap justify-between gap-3 border-t pt-3">
                <span>Invoice Total</span>

                <strong>
                  {money(createdBill.totalAmount)}
                </strong>
              </div>

              <div className="flex flex-wrap justify-between gap-3">
                <span>Confirmed Cash</span>

                <strong className="text-green-700">
                  {money(confirmedCash)}
                </strong>
              </div>

              {createdBill.confirmedNonCash != null && (
                <div className="flex flex-wrap justify-between gap-3">
                  <span>
                    Confirmed Bank / Cheque
                  </span>

                  <strong className="text-green-700">
                    {money(confirmedNonCash)}
                  </strong>
                </div>
              )}

              {createdBill.confirmedPaid != null && (
                <div className="flex flex-wrap justify-between gap-3">
                  <span>Total Confirmed Paid</span>

                  <strong className="text-green-700">
                    {money(
                      createdBill.confirmedPaid
                    )}
                  </strong>
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-3">
                <span>Remaining Balance</span>

                <strong className="text-rose-600">
                  {money(remainingBalance)}
                </strong>
              </div>

            </div>

          </div>

          {/* ================================== */}
          {/* SAVED INVOICE BATCH DETAILS */}
          {/* ================================== */}

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">

            <table className="w-full min-w-[620px] text-left text-sm">

              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">
                    Product
                  </th>

                  <th className="p-3">
                    Batch No.
                  </th>

                  <th className="p-3 text-right">
                    Qty
                  </th>

                  <th className="p-3 text-right">
                    Price
                  </th>

                  <th className="p-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>

                {(
                  Array.isArray(createdBill.items)
                    ? createdBill.items
                    : []
                ).map((line, index) => (
                  <tr
                    key={
                      line.itemId ??
                      line.id ??
                      index
                    }
                    className="border-t"
                  >
                    <td className="p-3">
                      {productName(line)}
                    </td>

                    <td className="p-3">
                      {savedBatchNumber(line) ||
                        "Not returned by backend"}
                    </td>

                    <td className="p-3 text-right">
                      {line.quantity}
                    </td>

                    <td className="p-3 text-right">
                      {money(line.unitPrice)}
                    </td>

                    <td className="p-3 text-right">
                      {money(
                        line.lineTotal ??
                        Number(line.unitPrice) *
                        Number(line.quantity)
                      )}
                    </td>
                  </tr>
                ))}

              </tbody>

            </table>

            {(
              !Array.isArray(createdBill.items) ||
              createdBill.items.length === 0
            ) && (
              <p className="p-3 text-sm text-amber-700">
                Saved invoice items are not returned
                by the backend. Update the bill response.
              </p>
            )}

          </div>

          {/* ================================== */}
          {/* SALES BILLING CREDIT */}
          {/* ================================== */}

          {isCreditBill && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">

              <div className="flex items-center gap-2">

                {isCreditPaid ? (
                  <CheckCircle2
                    size={20}
                    className="text-green-600"
                  />
                ) : (
                  <CreditCard
                    size={20}
                    className="text-[#3654FF]"
                  />
                )}

                <h3 className="font-bold text-[#17265B]">
                  Sales Billing Credit Balance
                </h3>

              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <div className="rounded-xl bg-white p-4">

                  <p className="text-xs text-slate-500">
                    Confirmed Cash
                  </p>

                  <p className="mt-2 text-xl font-bold text-green-700">
                    {money(confirmedCash)}
                  </p>

                </div>

                <div className="rounded-xl bg-white p-4">

                  <p className="text-xs text-slate-500">
                    Outstanding Credit
                  </p>

                  <p className="mt-2 text-xl font-bold text-rose-600">
                    {money(remainingBalance)}
                  </p>

                </div>

              </div>

              {hasOutstandingCredit ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">

                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0"
                  />

                  <p>
                    Invoice INV-{createdBill.id}
                    {" "}
                    has an unpaid balance.
                    The Sales Manager can collect
                    this amount later and record
                    it against the same invoice.
                  </p>

                </div>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-sm font-bold text-green-700">
                  <CheckCircle2 size={18} />
                  This credit invoice is fully paid.
                </p>
              )}

              {typeof onViewCreditBalances ===
                "function" && (
                <button
                  type="button"
                  onClick={onViewCreditBalances}
                  className="mt-4 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-[#3654FF]"
                >
                  View Credit Balances
                </button>
              )}

            </div>
          )}

          {/* ================================== */}
          {/* RECORD ACTUAL CASH RECEIVED */}
          {/* ================================== */}

          {["CASH", "CREDIT"].includes(
            createdBill.paymentMethod
          ) &&
            Number(
              createdBill.remainingBalance
            ) > 0 && (

            <div className="mt-6 rounded-xl border border-green-200 p-5">

              <h3 className="flex items-center gap-2 font-bold">

                <Wallet
                  size={18}
                  className="text-green-600"
                />

                Record Actual Cash Received
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Confirm only after receiving
                physical cash from the customer.
              </p>

              <input
                type="number"
                step="0.01"
                min="0.01"
                max={
                  createdBill.remainingBalance
                }
                value={cashAmount}
                onChange={(event) =>
                  setCashAmount(
                    event.target.value
                  )
                }
                placeholder="Enter received amount"
                className={
                  inputClass +
                  " mt-4"
                }
              />

              <button
                type="button"
                onClick={receiveCash}
                disabled={
                  confirmingCash ||
                  !cashAmount
                }
                className="mt-4 w-full rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {confirmingCash
                  ? "Confirming..."
                  : "Confirm Cash Received"}
              </button>

              {isCreditBill && (
                <p className="mt-3 text-xs text-slate-500">
                  Partial cash payments reduce
                  the credit balance. The
                  remaining balance stays linked
                  to invoice INV-{createdBill.id}.
                </p>
              )}

            </div>
          )}

          {/* ================================== */}
          {/* BANK TRANSFER PAYMENT */}
          {/* ================================== */}

          {createdBill.paymentMethod ===
            "BANK_TRANSFER" && (

            <DirectBankTransferPayment
              key={`bank-${createdBill.id}`}
              bill={createdBill}
              onSubmitted={
                handlePaymentEvidenceSubmitted
              }
              onPaymentStatusChanged={
                refreshSavedBill
              }
            />

          )}

          {/* ================================== */}
          {/* CHEQUE PAYMENT */}
          {/* ================================== */}

          {createdBill.paymentMethod ===
            "CHEQUE" && (

            <DirectChequePayment
              key={`cheque-${createdBill.id}`}
              bill={createdBill}
              onSubmitted={
                handlePaymentEvidenceSubmitted
              }
              onPaymentStatusChanged={
                refreshSavedBill
              }
            />

          )}

          {/* ================================== */}
          {/* PDF ACTIONS */}
          {/* ================================== */}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">

            <button
              type="button"
              onClick={downloadPDF}
              disabled={generatingPDF}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 font-bold text-white hover:bg-[#2942D2] disabled:opacity-50"
            >
              <Download size={18} />

              {generatingPDF
                ? "Generating Latest Invoice..."
                : "Download Invoice PDF"}
            </button>

            <button
              type="button"
              onClick={sharePDF}
              disabled={generatingPDF}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#EEF1FF] px-5 py-3 font-bold text-[#17265B] hover:bg-[#DDE3FF] disabled:opacity-50"
            >
              <Share2 size={18} />

              {generatingPDF
                ? "Preparing Invoice..."
                : "Share Invoice"}
            </button>

          </div>

          {/* ================================== */}
          {/* CREATE ANOTHER BILL */}
          {/* ================================== */}

          <button
            type="button"
            onClick={startNewBill}
            disabled={generatingPDF}
            className="mt-5 w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-[#17265B] hover:bg-slate-50 disabled:opacity-50"
          >
            Create Another Bill
          </button>

        </>
      )}

    </section>
  );
}
