
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  IceCreamCone,
  LocateFixed,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Truck,
  CreditCard,
  Banknote,
  Landmark,
  FileText,
  AlertCircle,
  Upload,
  Info,
} from "lucide-react";

import { useCart } from "../context/CartContext";

// ======================================================
// API CONFIGURATION
// ======================================================

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const API_URL = `${API_BASE}/api/wholesale/orders`;

const WHOLESALE_MINIMUM = 5;
const AUTH_KEY = "seventeen_auth";
const LAST_ORDER_KEY = "seventeen_last_order";
const DEFAULT_FLAVOUR = "Original";

// ======================================================
// BANK ACCOUNT CONFIGURATION
// ======================================================
// Enter only the real, verified company bank details.
// This display is intentionally separate from order submission.
// For production, bank details can be loaded from an
// admin-managed, read-only backend endpoint.
// ======================================================

const COMPANY_BANK = {
  bankName: "Bank Of Ceylone",
  accountName: "Sathutu Sina Dairies",
  accountNumber: "99987653",
  branch: "Galle",
};

const BANK_CONFIGURED = Boolean(
  COMPANY_BANK.bankName.trim() &&
  COMPANY_BANK.accountName.trim() &&
  COMPANY_BANK.accountNumber.trim() &&
  COMPANY_BANK.branch.trim()
);


// ======================================================
// PAYMENT METHODS
// ======================================================
// Do not change these values without changing the backend.
// In particular, Bank Transfer uses "bank".
// ======================================================

const PAYMENT_METHODS = [
  {
    value: "cash",
    label: "Cash Payment",
    description:
      "Pay in cash upon delivery or collection. " +
      "Payment will be confirmed by our team.",
    icon: Banknote,
  },
  {
    value: "bank",
    label: "Bank Transfer",
    description:
      "Transfer the payment after delivery. " +
      "Upload your bank slip through My Orders → Payment.",
    icon: Landmark,
  },
  {
    value: "cheque",
    label: "Cheque Payment",
    description:
      "Pay by cheque. Hand over the cheque to our " +
      "Sales Representative. Payment is subject to clearance.",
    icon: FileText,
  },
  {
    value: "credit",
    label: "Credit Payment",
    description:
      "Pay a selected amount in cash and request " +
      "the remaining amount as credit, subject to " +
      "approval by our Sales Representative.",
    icon: CreditCard,
  },
];

// ======================================================
// INITIAL FORM
// ======================================================

const INITIAL_FORM = {
  shopName: "",
  email: "",
  phone: "",
  firstName: "",
  lastName: "",

  streetAddress: "",
  city: "",
  postalCode: "",

  latitude: "",
  longitude: "",
  deliveryInstructions: "",

  paymentMethod: "cash",
  creditCashAmount: "",

  sameBillingAddress: true,
  billingAddress: "",

  orderNotes: "",
  agreeToTerms: false,
};

// ======================================================
// HELPERS
// ======================================================

function formatPrice(value) {
  const number = Number(value);
  const amount = Number.isFinite(number) ? number : 0;

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readAuth() {
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

function generateRequestKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    `${Date.now()}-` +
    Math.random().toString(36).slice(2)
  );
}

function validCoordinates(latitude, longitude) {
  if (
    latitude == null ||
    longitude == null ||
    latitude === "" ||
    longitude === ""
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function buildGoogleMapsUrl(latitude, longitude) {
  if (!validCoordinates(latitude, longitude)) {
    return "";
  }

  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${latitude},${longitude}`)
  );
}

function parseCashAmount(value) {
  const raw = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  return Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function getSelectedFlavour(item) {
  const candidates = [
    item?.selectedFlavour,
    item?.selectedFlavor,
    item?.flavour,
    item?.flavor,
    item?.variant,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.name === "string" &&
      candidate.name.trim()
    ) {
      return candidate.name.trim();
    }
  }

  return DEFAULT_FLAVOUR;
}

function normalizeCartItem(item, index) {
  const rawProductId = item?.productId ?? item?.id;

  const productId =
    rawProductId == null
      ? ""
      : String(rawProductId).trim();

  const quantity = Number(item?.quantity);
  const rawPrice = item?.price ?? item?.unitPrice;

  const price =
    rawPrice == null || rawPrice === ""
      ? NaN
      : Number(rawPrice);

  return {
    ...item,
    cartIndex: index,
    productId,
    selectedFlavour: getSelectedFlavour(item),
    quantity,
    price,
    name: String(
      item?.name ??
      item?.productName ??
      "Ice Cream Product"
    ),
    image: item?.image ?? item?.imageUrl ?? "",
    size: item?.size ?? "",
  };
}

function validateCart(cartItems) {
  if (!cartItems.length) {
    return "Your shopping cart is empty.";
  }

  for (const item of cartItems) {
    if (!item.productId) {
      return (
        `${item.name} has an invalid product ID. ` +
        "Remove it and add it again."
      );
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return `${item.name} has an invalid quantity.`;
    }

    if (
      !Number.isFinite(item.price) ||
      item.price < 0
    ) {
      return `${item.name} has an invalid price.`;
    }

    if (!item.selectedFlavour?.trim()) {
      return `${item.name} has no selected flavour.`;
    }
  }

  return "";
}

// ======================================================
// REUSABLE INPUT FIELD
// ======================================================

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
  autoComplete,
  min,
  max,
  step,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-[#17265B]"
      >
        {label}
        {required && (
          <span className="text-red-500"> *</span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={
          step ??
          (type === "number" ? "any" : undefined)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
      />
    </div>
  );
}

// ======================================================
// SECTION HEADING
// ======================================================

function SectionHeading({
  number,
  title,
  description,
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF0FF] text-xs font-bold text-[#3654FF]">
        {number}
      </span>

      <div>
        <h2 className="text-lg font-bold text-[#17265B]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

// ======================================================
// ORDER ITEM
// ======================================================

function OrderItem({ item }) {
  const subtotal =
    Number.isFinite(item.price) &&
    Number.isFinite(item.quantity)
      ? item.price * item.quantity
      : 0;

  return (
    <div className="flex gap-4 border-b border-slate-200 py-5 last:border-b-0">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EAF0FF]">
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

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-[#17265B]">
          {item.name}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          {[
            item.selectedFlavour,
            item.size,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          {item.quantity} × {formatPrice(item.price)}
        </p>
      </div>

      <strong className="shrink-0 text-sm text-[#3654FF]">
        {formatPrice(subtotal)}
      </strong>
    </div>
  );
}

// ======================================================
// PRICE ROW
// ======================================================

function PriceRow({
  label,
  value,
  strong = false,
  color = "",
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          strong
            ? "font-bold"
            : "text-sm text-slate-600"
        }
      >
        {label}
      </span>

      <strong
        className={
          color ||
          (strong
            ? "text-[#3654FF]"
            : "text-[#17265B]")
        }
      >
        {formatPrice(value)}
      </strong>
    </div>
  );
}

// ======================================================
// CREDIT SUMMARY
// ======================================================

function CreditSummary({ cartTotal, cashAmount }) {
  const valid = cashAmount !== null;

  const creditBalance = valid
    ? Math.max(
        0,
        (toCents(cartTotal) -
          toCents(cashAmount)) / 100
      )
    : null;

  return (
    <div className="mt-5 space-y-3 rounded-xl bg-white p-4">
      <PriceRow
        label="Estimated Product Subtotal"
        value={cartTotal}
      />

      <div className="flex justify-between gap-4">
        <span className="text-sm text-slate-600">
          Planned Cash Payment
        </span>

        <strong className="text-green-700">
          {valid
            ? formatPrice(cashAmount)
            : "Enter a valid amount"}
        </strong>
      </div>

      <div className="flex justify-between gap-4 border-t pt-3">
        <span className="font-bold">
          Estimated Credit Balance
        </span>

        <strong className="text-lg text-[#3654FF]">
          {valid
            ? formatPrice(creditBalance)
            : "—"}
        </strong>
      </div>

      <p className="text-xs text-slate-500">
        This is an estimate based on product prices.
        Delivery charges and final credit approval
        will be confirmed by our wholesale team.
        Entering cash here does not record a payment.
      </p>
    </div>
  );
}

// ======================================================
// BANK DETAILS ROW
// ======================================================

function BankDetailRow({
  label,
  value,
  allowCopy = false,
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div>
        <p className="text-xs text-slate-500">
          {label}
        </p>

        <p className="mt-1 break-all text-sm font-semibold text-[#17265B]">
          {value || "Not configured"}
        </p>
      </div>

      {allowCopy && value && (
        <button
          type="button"
          onClick={copyValue}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-[#3654FF] hover:bg-blue-50"
        >
          {copied ? (
            <CheckCircle2 size={15} />
          ) : (
            <Copy size={15} />
          )}

          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

// ======================================================
// BANK TRANSFER DETAILS - NEW COMPONENT
// ======================================================

function BankTransferDetails() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-5 rounded-2xl border border-blue-200 bg-[#F5F7FF] p-5 sm:p-6">

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">

          <div className="rounded-xl bg-blue-100 p-3 text-[#3654FF]">
            <Landmark size={23} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#17265B]">
              Company Bank Account Details
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              View the bank information and payment instructions.
            </p>
          </div>
        </div>

        <ChevronDown
          size={22}
          className={`shrink-0 text-[#3654FF] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-5">

          {/* BANK INFORMATION */}

          <div className="rounded-xl border border-blue-100 bg-white px-4 py-2">
            <BankDetailRow
              label="Bank Name"
              value={COMPANY_BANK.bankName}
            />

            <BankDetailRow
              label="Account Holder"
              value={COMPANY_BANK.accountName}
            />

            <BankDetailRow
              label="Account Number"
              value={COMPANY_BANK.accountNumber}
              allowCopy
            />

            <BankDetailRow
              label="Branch"
              value={COMPANY_BANK.branch}
            />
          </div>

          {!BANK_CONFIGURED && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0 text-amber-700"
              />

              <p className="text-xs leading-5 text-amber-800">
                Complete bank account details have not
                yet been configured. Please obtain
                verified bank details from Sathutu Sina
                Dairies before making a transfer.
              </p>
            </div>
          )}

          {/* PAYMENT AFTER DELIVERY */}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Info
              size={20}
              className="mt-0.5 shrink-0 text-amber-700"
            />

            <div>
              <h4 className="font-bold text-amber-900">
                Important: Transfer After Delivery
              </h4>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Please make your bank transfer only
                after the ordered products have been
                delivered to your shop.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Once the delivery is completed,
                transfer the confirmed amount to the
                company bank account shown above.
              </p>
            </div>
          </div>

          {/* SLIP UPLOAD INSTRUCTIONS */}

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-white p-4">
            <Upload
              size={20}
              className="mt-0.5 shrink-0 text-[#3654FF]"
            />

            <div>
              <h4 className="font-bold text-[#17265B]">
                Upload Your Bank Transfer Slip
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                After transferring the payment,
                log in to your Wholesale Dashboard.
                Open <strong>My Orders</strong>,
                select the delivered order, and
                navigate to the{" "}
                <strong>Payment</strong> section.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upload a clear image or PDF of your
                bank transfer slip as proof of payment.
              </p>

              <p className="mt-3 text-xs font-semibold text-[#3654FF]">
                Wholesale Dashboard → My Orders → Payment
              </p>
            </div>
          </div>

          {/* PAYMENT CONFIRMATION */}

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-green-700"
            />

            <div>
              <h4 className="font-semibold text-green-800">
                Payment Verification
              </h4>

              <p className="mt-2 text-xs leading-6 text-green-800">
                Uploading a transfer slip does not
                immediately mark an order as paid.
                The company will independently verify
                the bank transfer and confirm the
                received amount.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ======================================================
// CHEQUE PAYMENT DETAILS
// ======================================================

function ChequePaymentDetails() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-5 rounded-2xl border border-blue-200 bg-[#F5F7FF] p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-[#3654FF]">
            <FileText size={23} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#17265B]">
              Cheque Payment Details
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Company payee details and instructions for writing your cheque.
            </p>
          </div>
        </div>
        <ChevronDown
          size={22}
          className={`shrink-0 text-[#3654FF] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-5">
          <div className="rounded-xl border border-blue-100 bg-white px-4 py-2">
            <BankDetailRow
              label="Payee (Write cheque in favour of)"
              value={COMPANY_BANK.accountName}
              allowCopy
            />
            <BankDetailRow
              label="Company Bank"
              value={COMPANY_BANK.bankName}
            />
            <BankDetailRow
              label="Company Account Number (Reference only)"
              value={COMPANY_BANK.accountNumber}
              allowCopy
            />
            <BankDetailRow
              label="Company Bank Branch"
              value={COMPANY_BANK.branch}
            />
          </div>

          

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-white p-4">
            <Truck size={20} className="mt-0.5 shrink-0 text-[#3654FF]" />
            <div>
              <h4 className="font-bold text-[#17265B]">
                Hand Over Cheque After Delivery
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Hand over the original signed cheque to the Sales Manager only
                after your products have been delivered to your shop.
              </p>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}

// ======================================================
// MAIN CHECKOUT
// ======================================================

export default function Checkout() {
  const navigate = useNavigate();

  const { cart, clearCart } = useCart();

  const auth = readAuth();
  const jwt = getToken(auth);

  const user = auth?.user || auth || {};

  const role = String(
    user.role || auth?.role || ""
  )
    .replace(/^ROLE_/, "")
    .toUpperCase();

  const isWholesale = role === "WHOLESALE";

  // ====================================================
  // FORM STATE
  // ====================================================

  const [form, setForm] = useState(() => {
    const fullName = String(
      user.fullName || user.name || ""
    ).trim();

    const parts = fullName
      .split(/\s+/)
      .filter(Boolean);

    return {
      ...INITIAL_FORM,
      shopName: user.shopName || "",
      email: user.email || "",
      phone: user.phone || "",
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    };
  });

  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] =
    useState("");

  const gpsRequestActive = useRef(false);
  const submissionActive = useRef(false);

  const orderRequestKey = useRef(
    generateRequestKey()
  );

  const reviewRef = useRef(null);

  // ====================================================
  // CART CALCULATIONS
  // ====================================================

  const cartItems = useMemo(
    () =>
      (Array.isArray(cart) ? cart : []).map(
        normalizeCartItem
      ),
    [cart]
  );

  const cartCount = cartItems.reduce(
    (sum, item) =>
      sum +
      (Number.isFinite(item.quantity)
        ? item.quantity
        : 0),
    0
  );

  const cartTotalCents = cartItems.reduce(
    (sum, item) => {
      if (
        !Number.isFinite(item.price) ||
        !Number.isFinite(item.quantity)
      ) {
        return sum;
      }

      return (
        sum +
        toCents(item.price * item.quantity)
      );
    },
    0
  );

  const cartTotal = cartTotalCents / 100;

  const belowMinimum = cartItems.filter(
    (item) =>
      Number.isFinite(item.quantity) &&
      item.quantity < WHOLESALE_MINIMUM
  );

  const minimumsMet = belowMinimum.length === 0;

  // ====================================================
  // PAYMENT CALCULATIONS
  // ====================================================

  const isCredit = form.paymentMethod === "credit";
  const isBankTransfer = form.paymentMethod === "bank";

  const creditCashAmount = parseCashAmount(
    form.creditCashAmount
  );

  const creditCashCents =
    creditCashAmount === null
      ? null
      : toCents(creditCashAmount);

  const creditBalance =
    isCredit && creditCashCents !== null
      ? Math.max(
          0,
          (cartTotalCents - creditCashCents) / 100
        )
      : 0;

  // ====================================================
  // GPS
  // ====================================================

  const coordinatesValid = validCoordinates(
    form.latitude,
    form.longitude
  );

  const googleMapsUrl = buildGoogleMapsUrl(
    form.latitude,
    form.longitude
  );

  // ====================================================
  // AUTHENTICATION GUARD
  // ====================================================

  useEffect(() => {
    if (!jwt) {
      navigate("/login", {
        replace: true,
        state: {
          from: "/checkout",
          message:
            "Please sign in to continue checkout.",
        },
      });
    }
  }, [jwt, navigate]);

  // ====================================================
  // WHOLESALE PROFILE PREFILL
  // ====================================================

  useEffect(() => {
    if (!jwt || !isWholesale) return;

    const controller = new AbortController();

    async function loadShopProfile() {
      try {
        const response = await fetch(
          `${API_BASE}/api/wholesale/profile`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) return;

        const profile = await response.json();

        if (controller.signal.aborted) return;

        setForm((previous) => ({
          ...previous,
          shopName:
            previous.shopName ||
            profile.shopName ||
            "",
          phone:
            previous.phone ||
            profile.phone ||
            "",
        }));
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn(
            "Shop profile prefill unavailable."
          );
        }
      }
    }

    loadShopProfile();

    return () => controller.abort();
  }, [jwt, isWholesale]);

  // ====================================================
  // HANDLE FORM CHANGES
  // ====================================================

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]:
          type === "checkbox" ? checked : value,
      };

      if (
        name === "paymentMethod" &&
        value !== "credit"
      ) {
        next.creditCashAmount = "";
      }

      return next;
    });

    setError("");
    setPlaceOrderError("");
    setReviewing(false);

    if (
      name === "latitude" ||
      name === "longitude"
    ) {
      setGpsMessage("");
    }
  }

  // ====================================================
  // GET GPS LOCATION
  // ====================================================

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setGpsMessage(
        "This browser does not support GPS."
      );
      return;
    }

    if (gpsRequestActive.current) return;

    gpsRequestActive.current = true;
    setGpsLoading(true);
    setGpsMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude.toFixed(7);

        const longitude =
          position.coords.longitude.toFixed(7);

        setForm((previous) => ({
          ...previous,
          latitude,
          longitude,
        }));

        setGpsMessage(
          "Location captured. Please verify the pin on Google Maps."
        );

        setReviewing(false);
        setError("");

        setGpsLoading(false);
        gpsRequestActive.current = false;
      },

      (geoError) => {
        let message =
          "Unable to retrieve your location.";

        if (geoError.code === 1) {
          message =
            "Location permission denied. Allow location access or enter coordinates manually.";
        } else if (geoError.code === 2) {
          message =
            "Location unavailable. Enter coordinates manually.";
        } else if (geoError.code === 3) {
          message =
            "GPS request timed out. Please try again.";
        }

        setGpsMessage(message);
        setGpsLoading(false);
        gpsRequestActive.current = false;
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  // ====================================================
  // CHECKOUT VALIDATION
  // ====================================================

  function validateCheckout() {
    const cartError = validateCart(cartItems);

    if (cartError) return cartError;

    if (isWholesale && !minimumsMet) {
      return (
        "Wholesale orders require at least " +
        `${WHOLESALE_MINIMUM} units per product/flavour.`
      );
    }

    const requiredFields = [
      "shopName",
      "email",
      "phone",
      "firstName",
      "lastName",
      "streetAddress",
      "city"
    ];

    const missing = requiredFields.some(
      (field) => !String(form[field] ?? "").trim()
    );

    if (missing) {
      return (
        "Please complete all required contact " +
        "and delivery fields."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Please enter a valid email address.";
    }

    if (!coordinatesValid) {
      return (
        "Please provide valid delivery GPS coordinates."
      );
    }

    if (
      !form.sameBillingAddress &&
      !form.billingAddress.trim()
    ) {
      return "Please enter your billing address.";
    }

    const validMethods = [
      "cash",
      "bank",
      "cheque",
      "credit",
    ];

    if (!validMethods.includes(form.paymentMethod)) {
      return "Please select a valid payment method.";
    }

    if (isCredit) {
      if (!String(form.creditCashAmount).trim()) {
        return (
          "Please enter the cash amount you plan " +
          "to pay for the credit order."
        );
      }

      if (creditCashAmount === null) {
        return (
          "Enter a valid cash amount with up to " +
          "two decimal places."
        );
      }

      if (creditCashCents >= cartTotalCents) {
        return (
          "For Credit Payment, the planned cash amount " +
          "must be less than the product subtotal. " +
          "Choose Cash Payment if paying the full amount."
        );
      }
    }

    if (!form.agreeToTerms) {
      return "Please confirm the order terms.";
    }

    return "";
  }

  // ====================================================
  // REVIEW ORDER
  // ====================================================

  function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateCheckout();

    if (validationError) {
      setError(validationError);
      setReviewing(false);
      return;
    }

    setError("");
    setPlaceOrderError("");
    setReviewing(true);

    requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  // ====================================================
  // PLACE ORDER
  // ====================================================

  async function handlePlaceOrder() {
    if (
      !reviewing ||
      submissionActive.current
    ) {
      return;
    }

    const validationError = validateCheckout();

    if (validationError) {
      setError(validationError);
      setReviewing(false);
      return;
    }

    if (!jwt) {
      navigate("/login", {
        replace: true,
        state: {
          from: "/checkout",
        },
      });
      return;
    }

    submissionActive.current = true;

    setPlacingOrder(true);
    setPlaceOrderError("");

    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      selectedFlavour:
        item.selectedFlavour || DEFAULT_FLAVOUR,
      quantity: item.quantity,
    }));

    // KEEP EXISTING BACKEND PAYLOAD

    const orderPayload = {
      requestKey: orderRequestKey.current,

      shopName: form.shopName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),

      deliveryLocation: {
        streetAddress:
          form.streetAddress.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        deliveryInstructions:
          form.deliveryInstructions.trim(),
      },

      // "bank" remains unchanged.

      paymentMethod: form.paymentMethod,

      creditCashAmount: isCredit
        ? creditCashAmount
        : null,

      sameBillingAddress:
        form.sameBillingAddress,

      billingAddress:
        form.sameBillingAddress
          ? null
          : form.billingAddress.trim(),


      orderNotes:
        form.orderNotes.trim(),

      items: orderItems,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },

        body: JSON.stringify(orderPayload),
      });

      const responseText = await response.text();

      let data = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        let message =
          data?.message ||
          data?.detail ||
          data?.error ||
          `Order submission failed (HTTP ${response.status}).`;

        if (
          data?.errors &&
          typeof data.errors === "object"
        ) {
          const fieldErrors = Object.entries(
            data.errors
          ).map(
            ([field, value]) =>
              `${field}: ${String(value)}`
          );

          if (fieldErrors.length) {
            message +=
              "\n" + fieldErrors.join("\n");
          }
        }

        if (response.status === 401) {
          message =
            "Your login session has expired. Please log in again.";
        }

        throw new Error(message);
      }

      const savedOrder = data;

      if (
        !savedOrder ||
        savedOrder.orderId == null
      ) {
        throw new Error(
          "The server did not return an order ID. " +
          "Check My Orders before retrying."
        );
      }

      const confirmationOrder = {
        ...savedOrder,

        shopName:
          savedOrder.shopName ||
          orderPayload.shopName,

        deliveryLocation:
          savedOrder.deliveryLocation ||
          orderPayload.deliveryLocation,

        paymentMethod:
          savedOrder.paymentMethod ||
          orderPayload.paymentMethod,

        creditCashAmount:
          savedOrder.creditCashAmount ??
          orderPayload.creditCashAmount,

        estimatedCreditBalance:
          isCredit ? creditBalance : null,

        creditApprovalStatus:
          savedOrder.creditApprovalStatus ||
          (isCredit ? "PENDING" : null),

        orderStatus:
          savedOrder.orderStatus || "PENDING",

        paymentStatus:
          savedOrder.paymentStatus || "PENDING",

        items:
          savedOrder.items ||
          cartItems.map((item) => ({
            ...item,
            lineTotal:
              item.price * item.quantity,
          })),
      };

      try {
        sessionStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify(confirmationOrder)
        );
      } catch {
        console.warn(
          "Unable to cache order confirmation."
        );
      }

      if (typeof clearCart === "function") {
        clearCart();
      }

      navigate(
        `/order-confirmation/${encodeURIComponent(
          savedOrder.orderId
        )}`,
        {
          replace: true,
          state: {
            order: confirmationOrder,
          },
        }
      );
    } catch (err) {
      console.error(
        "Wholesale order error:",
        err
      );

      setPlaceOrderError(
        err.message ||
        "Unable to place your order."
      );
    } finally {
      submissionActive.current = false;
      setPlacingOrder(false);
    }
  }

  // ====================================================
  // AUTH GUARD
  // ====================================================

  if (!jwt) return null;

  // ====================================================
  // EMPTY CART
  // ====================================================

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-[#FFF9F3] px-6 py-24 text-center">
        <ShoppingCart
          size={50}
          className="mx-auto text-[#3654FF]"
        />

        <h1 className="mt-6 font-serif text-4xl font-bold text-[#17265B]">
          Your Cart Is Empty
        </h1>

        <p className="mt-4 text-slate-500">
          Add your favourite ice cream products
          before checkout.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-flex rounded-full bg-[#3654FF] px-8 py-4 font-semibold text-white"
        >
          Explore Flavours
        </Link>
      </main>
    );
  }

  // ====================================================
  // CHECKOUT PAGE
  // ====================================================

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">

          <Link
            to="/"
            className="flex items-center gap-3"
          >
            <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
              <IceCreamCone size={27} />
            </div>

            <div>
              <h2 className="font-bold text-[#3654FF]">
                Sathutu Sina Dairies
              </h2>

              <p className="text-xs text-slate-500">
                Wholesale Checkout
              </p>
            </div>
          </Link>

          <Link
            to="/cart"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
          >
            <ArrowLeft size={17} />
            Return to Cart
          </Link>

        </div>
      </header>

      {/* PAGE LAYOUT */}

      <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.15fr)_minmax(350px,0.85fr)]">

        {/* LEFT SIDE */}

        <div className="px-6 py-12 lg:px-12 lg:py-16">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3654FF]">
            A little more happiness, in bulk
          </p>

          <h1 className="mt-4 font-serif text-5xl font-bold">
            Checkout
          </h1>

          <p className="mt-4 text-sm text-slate-500">
            Complete your wholesale order details.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <Link to="/cart">Cart</Link>
            <span>/</span>
            <span className="font-bold text-[#3654FF]">
              Checkout
            </span>
            <span>/</span>
            <span>Confirmation</span>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-10"
          >

            {/* SECTION 1: CONTACT */}

            <section className="border-t border-slate-200 pt-8">

              <SectionHeading
                number="01"
                title="Contact & Shop Information"
                description="We will use these details to contact your wholesale shop."
              />

              <div className="space-y-5">

                <Field
                  label="Shop / Business Name"
                  name="shopName"
                  value={form.shopName}
                  onChange={handleChange}
                  required
                  disabled={placingOrder}
                  placeholder="Your shop name"
                />

                <div className="grid gap-5 sm:grid-cols-2">

                  <Field
                    label="Email Address"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    required
                    disabled={placingOrder}
                  />

                  <Field
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="07XXXXXXXX"
                    required
                    disabled={placingOrder}
                  />

                </div>
              </div>
            </section>

            {/* SECTION 2: DELIVERY */}

            <section className="border-t border-slate-200 pt-8">

              <SectionHeading
                number="02"
                title="Delivery Address"
                description="Where should we send your wholesale order?"
              />

              <div className="space-y-5">

                <div className="grid gap-5 sm:grid-cols-2">

                  <Field
                    label="First Name"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    disabled={placingOrder}
                  />

                  <Field
                    label="Last Name"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    disabled={placingOrder}
                  />

                </div>

                <Field
                  label="Street Address"
                  name="streetAddress"
                  value={form.streetAddress}
                  onChange={handleChange}
                  required
                  disabled={placingOrder}
                />

                <div className="grid gap-5 sm:grid-cols-3">

                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                    disabled={placingOrder}
                  />


                  <Field
                    label="Postal Code"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    disabled={placingOrder}
                  />

                </div>

                {/* GPS LOCATION */}

                <div className="rounded-2xl border border-blue-200 bg-[#F5F7FF] p-5 sm:p-6">

                  <div className="flex items-start gap-3">

                    <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
                      <MapPin size={24} />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold">
                        Exact Delivery Location (GPS)
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        Share your shop location so our
                        delivery person can reach you
                        using Google Maps.
                      </p>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={
                      gpsLoading || placingOrder
                    }
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <LocateFixed size={18} />

                    {gpsLoading
                      ? "Getting Your Location..."
                      : "Use My Current Location"}
                  </button>

                  <p className="mt-3 text-xs text-slate-500">
                    Use this option only when physically
                    at your shop. Otherwise enter the
                    correct shop coordinates manually.
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">

                    <Field
                      label="Latitude"
                      name="latitude"
                      type="number"
                      value={form.latitude}
                      onChange={handleChange}
                      required
                      disabled={placingOrder}
                      step="any"
                    />

                    <Field
                      label="Longitude"
                      name="longitude"
                      type="number"
                      value={form.longitude}
                      onChange={handleChange}
                      required
                      disabled={placingOrder}
                      step="any"
                    />

                  </div>

                  {gpsMessage && (
                    <p className="mt-4 rounded-lg bg-white p-3 text-sm">
                      {gpsMessage}
                    </p>
                  )}

                  {coordinatesValid && (
                    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

                      <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                        <CheckCircle2 size={18} />
                        Valid GPS coordinates entered
                      </p>

                      <p className="mt-2 text-xs">
                        Latitude: {form.latitude}
                      </p>

                      <p className="mt-1 text-xs">
                        Longitude: {form.longitude}
                      </p>

                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
                      >
                        <ExternalLink size={17} />
                        Verify Location on Google Maps
                      </a>

                    </div>
                  )}

                </div>

                {/* DELIVERY INSTRUCTIONS */}

                <div>
                  <label
                    htmlFor="deliveryInstructions"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Delivery Instructions (Optional)
                  </label>

                  <textarea
                    id="deliveryInstructions"
                    name="deliveryInstructions"
                    value={form.deliveryInstructions}
                    onChange={handleChange}
                    rows={3}
                    disabled={placingOrder}
                    placeholder="Receiving hours, freezer access or other instructions..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>

          

              </div>
            </section>

            {/* SECTION 3: PAYMENT */}

            <section className="border-t border-slate-200 pt-8">

              <SectionHeading
                number="03"
                title="Payment"
                description="Choose cash, bank transfer, cheque or a credit payment request."
              />

              {/* PAYMENT METHOD OPTIONS */}

              <div className="space-y-3">

                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;

                  const selected =
                    form.paymentMethod === method.value;

                  return (
                    <React.Fragment key={method.value}>

                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                          selected
                            ? "border-[#3654FF] bg-[#EAF0FF]"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.value}
                          checked={selected}
                          onChange={handleChange}
                          disabled={placingOrder}
                          className="mt-1 accent-[#3654FF]"
                        />

                        <Icon
                          size={21}
                          className="mt-0.5 shrink-0 text-[#3654FF]"
                        />

                        <div>
                          <p className="text-sm font-semibold">
                            {method.label}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {method.description}
                          </p>
                        </div>
                      </label>

                      {/* NEW: BANK TRANSFER DROPDOWN */}

                      {method.value === "bank" &&
                        selected && (
                          <BankTransferDetails />
                        )}

                      {/* CHEQUE PAYMENT DROPDOWN */}

                      {method.value === "cheque" &&
                        selected && (
                          <ChequePaymentDetails />
                        )}

                    </React.Fragment>
                  );
                })}

              </div>

              {/* CREDIT PAYMENT DETAILS */}

              {isCredit && (
                <div className="mt-6 rounded-2xl border border-blue-200 bg-[#F5F7FF] p-5 sm:p-6">

                  <div className="flex items-start gap-3">

                    <div className="rounded-xl bg-blue-100 p-3 text-[#3654FF]">
                      <CreditCard size={23} />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold">
                        Credit Payment Details
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        Enter the amount you plan
                        to pay in cash. The remaining
                        amount will be requested as credit.
                      </p>
                    </div>

                  </div>

                  <div className="mt-6">
                    <Field
                      label="Cash Amount to Pay (LKR)"
                      name="creditCashAmount"
                      type="number"
                      value={form.creditCashAmount}
                      onChange={handleChange}
                      placeholder="Example: 10000"
                      required
                      min="0"
                      max={cartTotal}
                      step="0.01"
                      disabled={placingOrder}
                    />
                  </div>

                  {creditCashAmount === null &&
                    form.creditCashAmount !== "" && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle size={15} />
                        Enter a valid amount with up
                        to two decimal places.
                      </p>
                    )}

                  {creditCashCents !== null &&
                    creditCashCents >= cartTotalCents && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle size={15} />
                        The cash amount must be less
                        than the estimated subtotal
                        for a credit order.
                      </p>
                    )}

                  <CreditSummary
                    cartTotal={cartTotal}
                    cashAmount={creditCashAmount}
                  />

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">

                    <p className="flex items-start gap-2 text-xs leading-5 text-amber-800">
                      <AlertCircle
                        size={17}
                        className="shrink-0"
                      />

                      <span>
                        Credit is subject to approval
                        by our Sales Representative.
                        Cash entered at checkout is
                        only a planned payment.
                        It will count as paid only
                        after actual collection is confirmed.
                      </span>
                    </p>

                  </div>

                </div>
              )}

              {/* BILLING ADDRESS */}

              <div className="mt-7 space-y-4">

                <p className="text-sm font-semibold">
                  Billing Address
                </p>

                <label className="flex items-center gap-3 text-sm">

                  <input
                    type="checkbox"
                    name="sameBillingAddress"
                    checked={form.sameBillingAddress}
                    onChange={handleChange}
                    disabled={placingOrder}
                    className="accent-[#3654FF]"
                  />

                  Same as delivery address
                </label>

                {!form.sameBillingAddress && (
                  <div>
                    <label
                      htmlFor="billingAddress"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Billing Address *
                    </label>

                    <textarea
                      id="billingAddress"
                      name="billingAddress"
                      value={form.billingAddress}
                      onChange={handleChange}
                      rows={3}
                      required
                      disabled={placingOrder}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    />
                  </div>
                )}


                <div>
                  <label
                    htmlFor="orderNotes"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Order Notes (Optional)
                  </label>

                  <textarea
                    id="orderNotes"
                    name="orderNotes"
                    value={form.orderNotes}
                    onChange={handleChange}
                    rows={3}
                    disabled={placingOrder}
                    placeholder="Any additional requests..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  />
                </div>

              </div>
            </section>

            {/* TERMS AND CONDITIONS */}

            <section className="border-t border-slate-200 pt-7">

              <label className="flex items-start gap-3 text-sm text-slate-600">

                <input
                  type="checkbox"
                  name="agreeToTerms"
                  checked={form.agreeToTerms}
                  onChange={handleChange}
                  disabled={placingOrder}
                  className="mt-1 accent-[#3654FF]"
                />

                <span>
                  I understand that product
                  availability, wholesale pricing,
                  delivery charges and payment
                  arrangements require confirmation.
                  Any requested credit is subject
                  to approval.
                  {isBankTransfer && (
                    <>
                      {" "}I understand that bank
                      payment should be made after
                      delivery, and that I must upload
                      my bank transfer slip through
                      My Orders → Payment.
                    </>
                  )}
                </span>

              </label>

              {error && (
                <div
                  role="alert"
                  className="mt-5 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">

                <Link
                  to="/cart"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
                >
                  <ArrowLeft size={18} />
                  Return to Cart
                </Link>

                <button
                  type="submit"
                  disabled={placingOrder}
                  className="inline-flex items-center gap-3 rounded-full bg-[#3654FF] px-8 py-4 font-bold text-white disabled:opacity-60"
                >
                  {reviewing
                    ? "Review Again"
                    : "Review Order"}

                  <ArrowRight size={18} />
                </button>

              </div>

              <p className="mt-5 text-xs text-slate-400">
                Review your order before submitting.
                No payment is collected online here.
              </p>

            </section>

          </form>

          {/* ORDER REVIEW */}

          {reviewing && (
            <section
              ref={reviewRef}
              className="mt-10 scroll-mt-6 rounded-2xl border border-blue-200 bg-[#EAF0FF] p-6 sm:p-8"
            >

              <div className="flex items-center gap-3">

                <CheckCircle2
                  size={27}
                  className="text-[#3654FF]"
                />

                <div>
                  <h2 className="text-xl font-bold">
                    Review Your Order
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Final check before placing
                    your wholesale order.
                  </p>
                </div>

              </div>

              {/* CONTACT REVIEW */}

              <div className="mt-6 rounded-xl bg-white p-5">

                <h3 className="font-bold">
                  Shop & Contact Details
                </h3>

                <div className="mt-3 space-y-2 text-sm text-slate-600">

                  <p>
                    <strong>Shop:</strong>{" "}
                    {form.shopName}
                  </p>

                  <p>
                    <strong>Contact:</strong>{" "}
                    {form.firstName} {form.lastName}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {form.email}
                  </p>

                  <p>
                    <strong>Phone:</strong>{" "}
                    {form.phone}
                  </p>

                </div>
              </div>

              {/* PRODUCT REVIEW */}

              <div className="mt-5 rounded-xl bg-white p-5">

                <h3 className="font-bold">
                  Ordered Products
                </h3>

                <div className="mt-3">
                  {cartItems.map((item) => (
                    <OrderItem
                      key={item.cartIndex}
                      item={item}
                    />
                  ))}
                </div>

                <div className="mt-4 border-t pt-4">
                  <PriceRow
                    label="Estimated Product Subtotal"
                    value={cartTotal}
                    strong
                  />
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Final prices and delivery
                  charges are subject to backend
                  verification.
                </p>

              </div>

              {/* DELIVERY REVIEW */}

              <div className="mt-5 rounded-xl bg-white p-5">

                <h3 className="flex items-center gap-2 font-bold">
                  <MapPin
                    size={19}
                    className="text-[#3654FF]"
                  />
                  Delivery Location
                </h3>

                <p className="mt-3 text-sm text-slate-600">
                  {form.streetAddress},{" "}
                  {form.city},{" "}
                  {form.postalCode
                    ? `, ${form.postalCode}`
                    : ""}
                </p>

                <p className="mt-3 text-sm text-slate-600">
                  <strong>Latitude:</strong>{" "}
                  {form.latitude}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  <strong>Longitude:</strong>{" "}
                  {form.longitude}
                </p>

                {form.deliveryInstructions && (
                  <p className="mt-3 text-sm text-slate-600">
                    <strong>Instructions:</strong>{" "}
                    {form.deliveryInstructions}
                  </p>
                )}

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
                >
                  <ExternalLink size={17} />
                  Verify Delivery Pin
                </a>

              </div>

              {/* PAYMENT REVIEW */}

              <div className="mt-5 rounded-xl bg-white p-5">

                <h3 className="font-bold">
                  Payment & Billing
                </h3>

                <p className="mt-3 text-sm text-slate-600">
                  <strong>Payment Method:</strong>{" "}
                  {
                    PAYMENT_METHODS.find(
                      (method) =>
                        method.value ===
                        form.paymentMethod
                    )?.label
                  }
                </p>

                {/* BANK TRANSFER REVIEW */}

                {isBankTransfer && (
                  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

                    <div className="flex items-center gap-2">
                      <Landmark
                        size={19}
                        className="text-[#3654FF]"
                      />

                      <h4 className="font-bold">
                        Bank Transfer Instructions
                      </h4>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Transfer the confirmed amount
                      only after the products have
                      been delivered to your shop.
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      After making the transfer,
                      open your Wholesale Dashboard,
                      go to <strong>My Orders</strong>,
                      select the delivered order,
                      and upload your bank slip
                      under <strong>Payment</strong>.
                    </p>

                    <p className="mt-3 text-xs font-semibold text-[#3654FF]">
                      My Orders → Payment → Upload Slip
                    </p>

                    <p className="mt-3 text-xs text-slate-500">
                      Payment will remain pending
                      until verified by the company.
                    </p>

                  </div>
                )}

                {/* CREDIT PAYMENT REVIEW */}

                {isCredit && (
                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">

                    <h4 className="font-bold">
                      Credit Payment Summary
                    </h4>

                    <div className="mt-4 space-y-3">

                      <PriceRow
                        label="Estimated Product Subtotal"
                        value={cartTotal}
                      />

                      <PriceRow
                        label="Planned Cash Payment"
                        value={creditCashAmount}
                        color="text-green-700"
                      />

                      <PriceRow
                        label="Requested Credit Balance"
                        value={creditBalance}
                        color="text-[#3654FF]"
                        strong
                      />

                    </div>

                    <p className="mt-4 text-xs text-slate-600">
                      The requested cash payment
                      and remaining credit will
                      be saved with the order.
                      Cash is not counted as received
                      until confirmed by our team.
                    </p>

                  </div>
                )}

                <p className="mt-4 text-sm text-slate-600">
                  <strong>Billing:</strong>{" "}
                  {form.sameBillingAddress
                    ? "Same as delivery address"
                    : form.billingAddress}
                </p>


                {form.orderNotes && (
                  <p className="mt-2 text-sm text-slate-600">
                    <strong>Notes:</strong>{" "}
                    {form.orderNotes}
                  </p>
                )}

              </div>

              {/* PLACE ORDER */}

              <div className="mt-7 border-t border-blue-200 pt-7">

                <h3 className="text-lg font-bold">
                  Ready to Place Your Order?
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Confirm your product quantities,
                  flavours, shop details, delivery
                  coordinates and payment method.
                </p>

                {placeOrderError && (
                  <div
                    role="alert"
                    className="mt-5 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    {placeOrderError}

                    <p className="mt-2 text-xs">
                      If the request may have
                      reached the backend,
                      check My Orders before retrying.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">

                  <button
                    type="button"
                    disabled={placingOrder}
                    onClick={() => {
                      setReviewing(false);

                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#3654FF] px-7 py-4 font-bold text-[#3654FF] disabled:opacity-60"
                  >
                    <ArrowLeft size={18} />
                    Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placingOrder}
                    className="inline-flex flex-1 items-center justify-center gap-3 rounded-full bg-[#3654FF] px-8 py-4 font-bold text-white disabled:opacity-60"
                  >
                    {placingOrder
                      ? "Placing Your Order..."
                      : "Place Order"}

                    {!placingOrder && (
                      <ArrowRight size={20} />
                    )}
                  </button>

                </div>

                <p className="mt-4 text-center text-xs text-slate-500">
                  Your order will be submitted
                  to the wholesale team.
                  No payment is collected online.
                </p>

              </div>

            </section>
          )}

        </div>

        {/* RIGHT SIDE: ORDER SUMMARY */}

        <aside className="border-t border-slate-200 bg-[#F5F7FF] px-6 py-12 lg:border-l lg:border-t-0 lg:px-10 lg:py-16">

          <div className="lg:sticky lg:top-8">

            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#3654FF]">
              Your next freezer favourites
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">

              <h2 className="font-serif text-3xl font-bold">
                Your Order
              </h2>

              <Link
                to="/cart"
                className="text-sm font-semibold text-[#3654FF]"
              >
                Edit Cart
              </Link>

            </div>

            <p className="mt-3 text-sm text-slate-500">
              {cartItems.length} product/flavour
              entries · {cartCount} units
            </p>

            <div className="mt-6 border-t border-slate-200">
              {cartItems.map((item) => (
                <OrderItem
                  key={item.cartIndex}
                  item={item}
                />
              ))}
            </div>

            {/* WHOLESALE MINIMUM */}

            {isWholesale && (
              <div
                className={`mt-6 rounded-xl p-4 ${
                  minimumsMet
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">

                  <CheckCircle2 size={18} />

                  {minimumsMet
                    ? "Wholesale minimums met"
                    : "Wholesale minimum not met"}
                </p>

                <p className="mt-2 text-xs">
                  {minimumsMet
                    ? `Each product/flavour has at least ${WHOLESALE_MINIMUM} units.`
                    : `${belowMinimum.length} entries need more units.`}
                </p>
              </div>
            )}

            {/* PRICE SUMMARY */}

            <div className="mt-7 space-y-4 border-t border-slate-200 pt-6">

              <PriceRow
                label="Estimated Product Subtotal"
                value={cartTotal}
                strong
              />

              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500">
                  Shipping / Delivery
                </span>

                <span className="text-right text-slate-500">
                  Pending confirmation
                </span>
              </div>

              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500">
                  Taxes / Adjustments
                </span>

                <span className="text-right text-slate-500">
                  Pending confirmation
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-5">
                <span className="font-bold">
                  Final Total
                </span>

                <span className="text-sm font-bold text-[#3654FF]">
                  To be confirmed
                </span>
              </div>

            </div>

            {/* BANK TRANSFER SIDEBAR */}

            {isBankTransfer && (
              <div className="mt-6 rounded-xl border border-blue-200 bg-white p-5">

                <h3 className="flex items-center gap-2 font-bold">
                  <Landmark
                    size={19}
                    className="text-[#3654FF]"
                  />
                  Bank Transfer
                </h3>

                <p className="mt-3 text-xs leading-6 text-slate-600">
                  Pay after delivery, then upload
                  the transfer slip through
                  My Orders → Payment.
                </p>

                <p className="mt-3 text-xs font-semibold text-[#3654FF]">
                  Status: Awaiting Delivery and Payment
                </p>

              </div>
            )}

            {/* CREDIT SIDEBAR SUMMARY */}

            {isCredit && (
              <div className="mt-6 rounded-xl border border-blue-200 bg-white p-5">

                <h3 className="flex items-center gap-2 font-bold">
                  <CreditCard
                    size={19}
                    className="text-[#3654FF]"
                  />
                  Credit Request
                </h3>

                <div className="mt-4 space-y-3">

                  <PriceRow
                    label="Estimated Subtotal"
                    value={cartTotal}
                  />

                  <PriceRow
                    label="Planned Cash"
                    value={creditCashAmount || 0}
                    color="text-green-700"
                  />

                  <PriceRow
                    label="Estimated Credit"
                    value={creditBalance}
                    color="text-[#3654FF]"
                    strong
                  />

                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Credit approval and the final
                  balance will be confirmed
                  by our Sales Representative.
                </p>

              </div>
            )}

            {/* SECURITY NOTICE */}

            <div className="mt-7 rounded-xl border border-blue-100 bg-white p-5">

              <div className="flex items-center gap-2 text-[#3654FF]">
                <ShieldCheck size={20} />

                <p className="font-bold">
                  Wholesale Order Confirmation
                </p>
              </div>

              <p className="mt-3 text-xs leading-6 text-slate-600">
                Spring Boot must verify products,
                flavours, prices, order totals
                and credit amounts before
                saving the order.
              </p>

            </div>

            {/* DELIVERY COORDINATION */}

            <div className="mt-7 flex items-start gap-3">

              <MapPin
                size={20}
                className="shrink-0 text-[#3654FF]"
              />

              <div>

                <p className="text-sm font-semibold">
                  Delivery Coordination
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Your shop GPS coordinates help
                  our delivery person navigate
                  directly to your location.
                </p>

                {coordinatesValid && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
                  >
                    <ExternalLink size={16} />
                    View Delivery Pin
                  </a>
                )}

              </div>

            </div>

          </div>
        </aside>

      </div>
    </main>
  );
}
