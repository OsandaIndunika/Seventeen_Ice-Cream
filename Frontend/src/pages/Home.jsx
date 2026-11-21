
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  ArrowRight,
  Heart,
  IceCreamCone,
  Plus,
  Minus,
  RefreshCw,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { products } from "../data/products";

// ==========================================
// API CONFIGURATION
// ==========================================

// This must be a PUBLIC READ-ONLY endpoint.
//
// Both this endpoint and the Sales Billing
// backend must read the SAME admin-managed
// wholesale price catalog.
//
// Example response:
// [
//   {
//     "productId": "500ml-tub",
//     "flavour": "Vanilla",
//     "unitPrice": 450,
//     "active": true
//   }
// ]
//
// A row without flavour can be used when
// all flavours share one price.
//
// Create / configure this backend endpoint
// if it does not exist yet.

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const PRICE_ENDPOINT =
  `${API_BASE}/api/public/wholesale-prices`;

const ORDER_ENDPOINT =
  `${API_BASE}/api/wholesale/orders`;

// ==========================================
// PRODUCT DEFINITIONS
// ==========================================
//
// These are display definitions ONLY.
//
// IMPORTANT:
// No wholesale price is stored here.
// Prices come from PostgreSQL through API.
//
// Product IDs must match wholesale_products.
//
// ==========================================

const WHOLESALE_PRODUCTS = [
  {
    id: "ice-cream-cup",
    name: "Ice Cream Cup",
    size: "80ml",
    unit: "cup",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800",
  },
  {
    id: "popsicle",
    name: "Popsicle",
    size: "1 piece",
    unit: "popsicle",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=800",
  },
  {
    id: "ice-packet",
    name: "Ice Packet",
    size: "1 packet",
    unit: "packet",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1501446529957-6226bd447c46?w=800",
  },
  {
    id: "yoghurt-drink",
    name: "Yoghurt Drink",
    size: "1 bottle",
    unit: "bottle",
    flavours: ["Yoghurt"],
    image:
      "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800",
  },
  {
    id: "500ml-tub",
    name: "Ice Cream Tub",
    size: "500ml",
    unit: "tub",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1560008581-09826d1de69e?w=800",
  },
  {
    id: "1l-tub",
    name: "Ice Cream Tub",
    size: "1 Litre",
    unit: "tub",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800",
  },
  {
    id: "2l-tub",
    name: "Ice Cream Tub",
    size: "2 Litres",
    unit: "tub",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=800",
  },
  {
    id: "4l-bag",
    name: "Ice Cream Bag",
    size: "4 Litres",
    unit: "bag",
    flavours: [
      "Vanilla",
      "Chocolate",
      "Fruit & Nut",
    ],
    image:
      "https://images.unsplash.com/photo-1516559828984-fb3b99548b21?w=800",
  },
];

// ==========================================
// STATIC PAGE DATA
// ==========================================

const faqs = [
  {
    question:
      "Do you offer wholesale ice cream orders?",
    answer:
      "Yes! We welcome bulk orders from shops, cafes, restaurants and event organizers.",
  },
  {
    question:
      "Can I order ice cream for special events?",
    answer:
      "Yes. Contact our team to discuss larger orders for parties and celebrations.",
  },
  {
    question:
      "How can I see your ice cream prices?",
    answer:
      "The wholesale product collection on this homepage displays the current prices provided by our company.",
  },
  {
    question:
      "Can the Sales Representative change prices?",
    answer:
      "No. Product prices are managed by authorized company administrators.",
  },
  {
    question: "How do I place an order?",
    answer:
      "Select products, flavours and quantities, enter your shop details, and submit the order using a wholesale customer account.",
  },
];

const orderingSteps = [
  {
    number: "01",
    title: "Choose your favourites",
    description:
      "Browse the collection, see current wholesale prices, and select your required flavours.",
  },
  {
    number: "02",
    title: "Review your cart",
    description:
      "Check each product quantity and its calculated total.",
  },
  {
    number: "03",
    title: "Complete checkout",
    description:
      "Enter your shop and delivery details to submit your order.",
  },
];

const occasions = [
  {
    title: "Everyday Treats",
    description:
      "Little treats for your sweetest moments.",
    image:
      "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800",
  },
  {
    title: "Office Celebrations",
    description:
      "Make workdays a little sweeter.",
    image:
      "https://images.unsplash.com/photo-1557142046-c704a3adf364?w=800",
  },
  {
    title: "Parties & Events",
    description:
      "More scoops for special occasions.",
    image:
      "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=800",
  },
];

// ==========================================
// HELPERS
// ==========================================

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Price unavailable";
  }

  return `Rs. ${number.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");
}

function normalizeFlavour(productId, flavour) {
  const normalized = normalizeText(flavour);

  if (
    productId === "yoghurt-drink" &&
    ["yoghurt", "plain", "original", "regular"].includes(
      normalized
    )
  ) {
    return "yoghurt";
  }

  return normalized || "*";
}

function priceKey(productId, flavour) {
  return (
    normalizeText(productId) +
    "::" +
    normalizeFlavour(productId, flavour)
  );
}

function normalizePriceCatalog(response) {
  const rows = Array.isArray(response)
    ? response
    : response?.products ??
      response?.prices ??
      response?.content ??
      response?.data;

  if (!Array.isArray(rows)) {
    throw new Error(
      "Wholesale price API returned an invalid response."
    );
  }

  const map = {};

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const id = String(
      row.productId ??
      row.product_id ??
      row.id ??
      ""
    ).trim();

    if (!id) continue;

    const active =
      row.active ??
      row.enabled ??
      row.isActive ??
      true;

    if (
      active === false ||
      String(active).toLowerCase() === "false"
    ) {
      continue;
    }

    const price = Number(
      row.unitPrice ??
      row.unit_price ??
      row.wholesalePrice ??
      row.wholesale_price ??
      row.price
    );

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      (
        row.unitPrice == null &&
        row.unit_price == null &&
        row.wholesalePrice == null &&
        row.wholesale_price == null &&
        row.price == null
      )
    ) {
      continue;
    }

    const flavour =
      row.flavour ??
      row.flavor ??
      row.variant ??
      "*";

    const key = priceKey(id, flavour);

    if (Object.prototype.hasOwnProperty.call(map, key)) {
      throw new Error(
        `Duplicate wholesale price found for ${id} / ${flavour}.`
      );
    }

    map[key] = price;
  }

  return map;
}

function getCatalogPrice(catalog, productId, flavour) {
  const specific = priceKey(productId, flavour);

  const general = priceKey(productId, "*");

  if (
    Object.prototype.hasOwnProperty.call(
      catalog,
      specific
    )
  ) {
    return catalog[specific];
  }

  if (
    Object.prototype.hasOwnProperty.call(
      catalog,
      general
    )
  ) {
    return catalog[general];
  }

  return null;
}

function createInitialQuantities() {
  return Object.fromEntries(
    WHOLESALE_PRODUCTS.map((product) => [
      product.id,
      Object.fromEntries(
        product.flavours.map((flavour) => [
          flavour,
          0,
        ])
      ),
    ])
  );
}

// ==========================================
// HOMEPAGE
// ==========================================

export default function Home() {
  // ========================================
  // ADMIN-MANAGED PRICES
  // ========================================

  const [priceCatalog, setPriceCatalog] =
    useState({});

  const [pricesLoading, setPricesLoading] =
    useState(true);

  const [pricesError, setPricesError] =
    useState("");

  const [pricesUpdatedAt, setPricesUpdatedAt] =
    useState(null);

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    setPricesError("");

    try {
      const response = await fetch(
        PRICE_ENDPOINT,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load wholesale prices (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      const normalized =
        normalizePriceCatalog(data);

      if (
        Object.keys(normalized).length === 0
      ) {
        throw new Error(
          "No approved wholesale prices were returned."
        );
      }

      setPriceCatalog(normalized);
      setPricesUpdatedAt(new Date());
    } catch (error) {
      setPriceCatalog({});
      setPricesError(
        error instanceof Error
          ? error.message
          : "Unable to load wholesale prices."
      );
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  // ========================================
  // ORDER QUANTITIES
  // ========================================

  const [quantities, setQuantities] =
    useState(createInitialQuantities);

  function updateQuantity(
    productId,
    flavour,
    value
  ) {
    const parsed = Number(value);

    const quantity =
      value !== "" &&
      Number.isSafeInteger(parsed) &&
      parsed >= 0
        ? parsed
        : 0;

    setQuantities((previous) => ({
      ...previous,

      [productId]: {
        ...previous[productId],
        [flavour]: quantity,
      },
    }));
  }

  function increaseQuantity(
    productId,
    flavour
  ) {
    setQuantities((previous) => ({
      ...previous,

      [productId]: {
        ...previous[productId],
        [flavour]:
          (
            Number(
              previous[productId]?.[flavour]
            ) || 0
          ) + 1,
      },
    }));
  }

  function decreaseQuantity(
    productId,
    flavour
  ) {
    setQuantities((previous) => ({
      ...previous,

      [productId]: {
        ...previous[productId],
        [flavour]: Math.max(
          0,
          (
            Number(
              previous[productId]?.[flavour]
            ) || 0
          ) - 1
        ),
      },
    }));
  }

  // ========================================
  // PRICE LOOKUP
  // ========================================

  const getPrice = useCallback(
    (productId, flavour) =>
      getCatalogPrice(
        priceCatalog,
        productId,
        flavour
      ),
    [priceCatalog]
  );

  // ========================================
  // SELECTED ITEMS
  // ========================================

  const selectedOrderItems = useMemo(() => {
    return WHOLESALE_PRODUCTS.flatMap(
      (product) =>
        product.flavours
          .filter(
            (flavour) =>
              Number(
                quantities[product.id]?.[flavour]
              ) > 0
          )
          .map((flavour) => {
            const quantity = Number(
              quantities[product.id][flavour]
            );

            const price = getPrice(
              product.id,
              flavour
            );

            return {
              productId: product.id,
              name: product.name,
              size: product.size,
              flavour,
              unitLabel:
                `Per ${product.unit}`,
              quantity,
              price,
              subtotal:
                price == null
                  ? null
                  : quantity * price,
            };
          })
    );
  }, [quantities, getPrice]);

  const totalQuantity = useMemo(
    () =>
      selectedOrderItems.reduce(
        (sum, item) =>
          sum + item.quantity,
        0
      ),
    [selectedOrderItems]
  );

  const hasMissingPrices =
    selectedOrderItems.some(
      (item) => item.price == null
    );

  const totalOrderAmount =
    hasMissingPrices
      ? null
      : selectedOrderItems.reduce(
          (sum, item) =>
            sum + item.subtotal,
          0
        );

  const canPlaceOrder =
    !pricesLoading &&
    !pricesError &&
    totalQuantity > 0 &&
    !hasMissingPrices;

  // ========================================
  // CHECKOUT STATE
  // ========================================

  const [checkout, setCheckout] = useState({
    shopName: "",
    phone: "",
    address: "",
    latitude: "",
    longitude: "",
  });

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [checkoutError, setCheckoutError] =
    useState("");

  const [checkoutSuccess, setCheckoutSuccess] =
    useState("");

  const [capturingLocation, setCapturingLocation] =
    useState(false);

  function updateCheckout(event) {
    const { name, value } = event.target;

    setCheckout((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function captureShopLocation() {
    setCheckoutError("");

    if (!navigator.geolocation) {
      setCheckoutError(
        "GPS is unavailable. Please enter your shop coordinates manually."
      );
      return;
    }

    setCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCheckout((previous) => ({
          ...previous,
          latitude: String(
            coords.latitude
          ),
          longitude: String(
            coords.longitude
          ),
        }));

        setCapturingLocation(false);
      },
      (error) => {
        setCheckoutError(
          `Unable to get location: ${error.message}`
        );

        setCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
      }
    );
  }

  // ========================================
  // PLACE WHOLESALE ORDER
  // ========================================

  async function submitWholesaleOrder(event) {
    event.preventDefault();

    setCheckoutError("");
    setCheckoutSuccess("");

    if (!canPlaceOrder) {
      setCheckoutError(
        "Select products with available wholesale prices before ordering."
      );
      return;
    }

    if (
      !checkout.shopName.trim() ||
      !checkout.phone.trim() ||
      !checkout.address.trim()
    ) {
      setCheckoutError(
        "Please enter the shop name, phone number and address."
      );
      return;
    }

    const latitude =
      Number(checkout.latitude);

    const longitude =
      Number(checkout.longitude);

    if (
      !checkout.latitude.trim() ||
      !checkout.longitude.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      setCheckoutError(
        "Enter valid shop GPS coordinates or use the location button."
      );
      return;
    }

    let auth = null;

    try {
      auth = JSON.parse(
        sessionStorage.getItem(
          "seventeen_auth"
        ) || "null"
      );
    } catch {
      auth = null;
    }

    if (!auth?.token) {
      setCheckoutError(
        "Please log in as a wholesale customer to place an order."
      );
      return;
    }

    const role = String(
      auth?.user?.role ??
      auth?.role ??
      ""
    ).toUpperCase();

    if (
      role &&
      role !== "WHOLESALE" &&
      role !== "ROLE_WHOLESALE"
    ) {
      setCheckoutError(
        "Only wholesale customer accounts can place wholesale orders."
      );
      return;
    }

    setPlacingOrder(true);

    try {
      // Recheck catalog immediately before
      // submitting the order.
      //
      // The backend MUST independently validate
      // prices again; frontend checks are only
      // for display and user experience.

      const latestResponse = await fetch(
        PRICE_ENDPOINT,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!latestResponse.ok) {
        throw new Error(
          "Unable to verify the latest wholesale prices."
        );
      }

      const latestCatalog =
        normalizePriceCatalog(
          await latestResponse.json()
        );

      setPriceCatalog(latestCatalog);

      const changed = selectedOrderItems.some(
        (item) => {
          const latestPrice =
            getCatalogPrice(
              latestCatalog,
              item.productId,
              item.flavour
            );

          return latestPrice !== item.price;
        }
      );

      if (changed) {
        throw new Error(
          "Wholesale prices were updated. Please review the new prices and submit again."
        );
      }

      const response = await fetch(
        ORDER_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${auth.token}`,
          },

          body: JSON.stringify({
            shopName:
              checkout.shopName.trim(),

            phone:
              checkout.phone.trim(),

            address:
              checkout.address.trim(),

            latitude,
            longitude,

            // No client-submitted price.
            // Server computes totals from
            // the approved database catalog.
            items:
              selectedOrderItems.map(
                ({
                  productId,
                  flavour,
                  quantity,
                }) => ({
                  productId,
                  flavour,
                  quantity,
                })
              ),
          }),
        }
      );

      const result =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          result.detail ||
          result.message ||
          (
            response.status === 401
              ? "Please log in again."
              : response.status === 403
                ? "Your account cannot place wholesale orders."
                : `Order failed (HTTP ${response.status}).`
          )
        );
      }

      const orderId =
        result.orderId ??
        result.id;

      const confirmedTotal =
        result.totalAmount ??
        result.finalTotal ??
        result.orderTotal;

      setCheckoutSuccess(
        `Order ${
          orderId == null
            ? ""
            : `#${orderId}`
        } placed successfully! ` +
        `Status: ${
          result.status ?? "PLACED"
        }. ` +
        (
          confirmedTotal != null
            ? `Confirmed total: ${money(
                confirmedTotal
              )}.`
            : "The confirmed amount is available in your order details."
        )
      );

      setQuantities(
        createInitialQuantities()
      );

    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to place order."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  // ========================================
  // SAMPLE PRODUCTS
  // ========================================

  const sampleProducts =
    Array.isArray(products)
      ? products.slice(0, 3)
      : [];

  // ========================================
  // RENDER
  // ========================================

  return (
    <main className="bg-[#FFF9F3] text-[#17265B]">

      {/* ================================= */}
      {/* HERO */}
      {/* ================================= */}

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-2 lg:px-10 lg:py-24">

        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#3654FF]">
            Sathutu Sina Dairies
          </p>

          <h1 className="font-serif text-5xl leading-[1.1] md:text-6xl lg:text-7xl">
            Good things,
            <br />
            by the scoop.
            <br />

            <span className="text-[#3654FF]">
              Great things,
              <br />
              by the batch.
            </span>
          </h1>

          <p className="mt-7 max-w-md text-sm leading-8 text-gray-600">
            From everyday sweet cravings to big
            celebrations, discover delicious ice
            cream made to bring happiness to every
            moment.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">

            <Link
              to="/flavours"
              className="rounded-full bg-[#3654FF] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#233BC8]"
            >
              Shop Ice Cream
            </Link>

            <Link
              to="/wholesale"
              className="rounded-full border border-[#3654FF] px-7 py-3 text-sm font-semibold text-[#3654FF] transition hover:bg-[#EAF0FF]"
            >
              Explore Wholesale
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-6 text-xs text-gray-500">
            <span>♡ Made with love</span>
            <span>✦ Delicious flavours</span>
            <span>♡ Sweet celebrations</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-5 -top-5 h-36 w-36 rounded-full bg-[#DCE6FF]" />

          <img
            src="https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1200"
            alt="Delicious ice cream"
            className="relative h-[450px] w-full rounded-t-full rounded-b-[40px] object-cover shadow-xl md:h-[550px]"
          />

          <div className="absolute -bottom-5 -left-5 rounded-2xl bg-white p-5 shadow-lg">
            <IceCreamCone className="mb-2 text-[#3654FF]" />
            <p className="font-serif text-lg">
              A little joy
            </p>
            <p className="text-xs text-gray-500">
              In every scoop
            </p>
          </div>
        </div>
      </section>

      {/* ================================= */}
      {/* BENEFITS */}
      {/* ================================= */}

      <section className="border-y border-blue-100 bg-[#EAF0FF] py-5">

        <div className="mx-auto grid max-w-7xl gap-5 px-6 text-center text-xs font-medium text-[#3654FF] md:grid-cols-4">
          <p>♡ Made with care</p>
          <p>✦ Delicious flavours</p>
          <p>♡ Great for every occasion</p>
          <p>✦ Wholesale available</p>
        </div>

      </section>

      {/* ================================= */}
      {/* WHOLESALE PRODUCTS */}
      {/* ================================= */}

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">

        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
              Our Wholesale Collection
            </p>

            <h2 className="font-serif text-4xl md:text-5xl">
              Something sweet for everyone.
            </h2>

            <p className="mt-3 text-sm text-gray-600">
              Select flavours and individual quantities.
              Wholesale prices are loaded directly
              from our approved company catalog.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">

            <button
              type="button"
              onClick={loadPrices}
              disabled={pricesLoading}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-[#3654FF] disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  pricesLoading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh Prices
            </button>

            <Link
              to="/flavours"
              className="flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
            >
              View All Products
              <ArrowRight size={17} />
            </Link>

          </div>
        </div>

        {/* PRICE STATUS */}

        {pricesLoading && (
          <p className="mb-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
            Loading current wholesale prices...
          </p>
        )}

        {pricesError && (
          <div
            role="alert"
            className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={20}
              className="shrink-0"
            />

            <div>
              <p className="font-semibold">
                Wholesale prices are unavailable
              </p>

              <p className="mt-1">
                {pricesError}
              </p>

              <p className="mt-1">
                Ordering is disabled until current
                prices can be verified.
              </p>
            </div>
          </div>
        )}

        {!pricesLoading &&
          !pricesError &&
          pricesUpdatedAt && (
            <div className="mb-6 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 size={16} />
              Current approved wholesale prices loaded
            </div>
          )}

        {/* PRODUCT GRID */}

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">

          {WHOLESALE_PRODUCTS.map((product) => {
            const productQuantities =
              quantities[product.id] ?? {};

            const quantity = product.flavours.reduce(
              (total, flavour) =>
                total +
                Number(
                  productQuantities[flavour] || 0
                ),
              0
            );

            const flavourPrices =
              product.flavours.map((flavour) =>
                getPrice(
                  product.id,
                  flavour
                )
              );

            const validPrices =
              flavourPrices.filter(
                (price) => price != null
              );

            const uniquePrices = [
              ...new Set(validPrices),
            ];

            const productSubtotal =
              product.flavours.reduce(
                (sum, flavour) => {
                  const price = getPrice(
                    product.id,
                    flavour
                  );

                  const qty = Number(
                    productQuantities[flavour] || 0
                  );

                  return sum +
                    (
                      price == null
                        ? 0
                        : price * qty
                    );
                },
                0
              );

            const productHasMissingPrice =
              product.flavours.some(
                (flavour) =>
                  Number(
                    productQuantities[flavour] || 0
                  ) > 0 &&
                  getPrice(
                    product.id,
                    flavour
                  ) == null
              );

            return (
              <article
                key={product.id}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >

                {/* IMAGE */}

                <div className="relative h-56 overflow-hidden bg-[#EAF0FF]">

                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />

                  <span className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#3654FF] shadow">
                    {product.size}
                  </span>

                </div>

                <div className="p-5">

                  <h3 className="text-xl font-bold">
                    {product.name}
                  </h3>

                  <p className="mt-2 text-sm font-medium text-[#3654FF]">
                    Per {product.unit}
                  </p>

                  {/* FLAVOUR SELECTION */}

                  <div className="mt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Select Flavour & Quantity
                    </p>

                    <div className="space-y-4">

                      {product.flavours.map((flavour) => {
                        const price = getPrice(
                          product.id,
                          flavour
                        );

                        const currentQuantity =
                          Number(
                            productQuantities[flavour] || 0
                          );

                        const disabled =
                          pricesLoading ||
                          Boolean(pricesError) ||
                          price == null;

                        return (
                          <div
                            key={flavour}
                            className="rounded-xl border border-blue-100 bg-[#FAFBFF] p-3"
                          >

                            <div className="mb-3 flex items-center justify-between gap-2">

                              <span className="text-sm font-semibold">
                                {flavour}
                              </span>

                              <span className="text-xs font-bold text-[#3654FF]">
                                {money(price)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">

                              <button
                                type="button"
                                disabled={
                                  disabled ||
                                  currentQuantity === 0
                                }
                                onClick={() =>
                                  decreaseQuantity(
                                    product.id,
                                    flavour
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-[#3654FF] disabled:opacity-40"
                                aria-label={`Decrease ${flavour}`}
                              >
                                <Minus size={15} />
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={disabled}
                                value={currentQuantity}
                                onChange={(event) =>
                                  updateQuantity(
                                    product.id,
                                    flavour,
                                    event.target.value
                                  )
                                }
                                className="h-9 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white text-center text-sm font-semibold outline-none focus:border-[#3654FF] disabled:opacity-50"
                                aria-label={`${flavour} quantity`}
                              />

                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  increaseQuantity(
                                    product.id,
                                    flavour
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3654FF] text-white disabled:opacity-40"
                                aria-label={`Increase ${flavour}`}
                              >
                                <Plus size={15} />
                              </button>

                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                Subtotal
                              </span>

                              <strong className="text-sm text-[#3654FF]">
                                {money(
                                  price == null
                                    ? null
                                    : price * currentQuantity
                                )}
                              </strong>
                            </div>

                          </div>
                        );
                      })}

                    </div>
                  </div>

                  {/* PRICE DISPLAY */}

                  <div className="mt-5 border-t border-blue-100 pt-4">

                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Approved Wholesale Price
                    </p>

                    <p className="mt-2 text-xl font-bold text-[#3654FF]">
                      {uniquePrices.length === 1 &&
                        validPrices.length ===
                          product.flavours.length
                        ? money(uniquePrices[0])
                        : validPrices.length === 0
                          ? "Price unavailable"
                          : uniquePrices.length > 1
                            ? "Varies by flavour"
                            : "See flavour prices"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Admin-controlled price per individual item
                    </p>

                  </div>

                  {/* PRODUCT TOTAL */}

                  <div className="mt-5 rounded-xl bg-[#EAF0FF] p-4">

                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Product Total
                      </p>

                      <span className="text-xs text-gray-500">
                        {quantity} selected
                      </span>
                    </div>

                    <p className="mt-2 text-xl font-bold text-[#3654FF]">
                      {productHasMissingPrice
                        ? "Price unavailable"
                        : money(productSubtotal)}
                    </p>

                  </div>

                </div>
              </article>
            );
          })}

        </div>

        {/* ================================= */}
        {/* ORDER SUMMARY */}
        {/* ================================= */}

        <section className="mt-12 rounded-2xl bg-white p-6 shadow-md md:p-8">

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
                Your Wholesale Order
              </p>

              <h3 className="mt-2 font-serif text-3xl">
                Order Summary
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Review selected items and approved prices.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">

              <div>
                <p className="text-xs text-gray-500">
                  Total Items
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {totalQuantity}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Estimated Total
                </p>

                <p className="mt-2 text-2xl font-bold text-[#3654FF]">
                  {money(totalOrderAmount)}
                </p>
              </div>

            </div>
          </div>

          {selectedOrderItems.length > 0 ? (
            <div className="mt-8 border-t border-blue-100 pt-6">

              <h4 className="mb-4 text-sm font-bold">
                Selected Products
              </h4>

              <div className="space-y-3">

                {selectedOrderItems.map((item) => (
                  <div
                    key={`${item.productId}-${item.flavour}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAFBFF] p-4"
                  >

                    <div>
                      <p className="text-sm font-semibold">
                        {item.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {item.size} · {item.flavour}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {item.quantity} × {money(item.price)}
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#3654FF]">
                        {money(item.subtotal)}
                      </p>
                    </div>

                  </div>
                ))}

              </div>
            </div>
          ) : (
            <p className="mt-6 border-t border-blue-100 pt-5 text-sm text-gray-500">
              No products selected yet.
            </p>
          )}

        </section>

        {/* ================================= */}
        {/* WHOLESALE CHECKOUT */}
        {/* ================================= */}

        <form
          onSubmit={submitWholesaleOrder}
          className="mt-10 rounded-2xl border border-blue-100 bg-white p-6 shadow-md md:p-8"
        >

          <h3 className="font-serif text-3xl">
            Wholesale Checkout
          </h3>

          <p className="mt-2 text-sm text-gray-600">
            Log in as a wholesale customer, enter your
            shop details and confirm your delivery
            location.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <label className="text-sm font-semibold">
              Shop Name

              <input
                name="shopName"
                required
                maxLength={150}
                value={checkout.shopName}
                onChange={updateCheckout}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
                placeholder="Shop name"
              />
            </label>

            <label className="text-sm font-semibold">
              Contact Number

              <input
                name="phone"
                type="tel"
                required
                maxLength={20}
                value={checkout.phone}
                onChange={updateCheckout}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
                placeholder="07XXXXXXXX"
              />
            </label>

            <label className="text-sm font-semibold md:col-span-2">
              Shop Delivery Address

              <textarea
                name="address"
                required
                rows={2}
                value={checkout.address}
                onChange={updateCheckout}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
                placeholder="Street, town, landmark"
              />
            </label>

            <label className="text-sm font-semibold">
              Shop Latitude

              <input
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                required
                value={checkout.latitude}
                onChange={updateCheckout}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>

            <label className="text-sm font-semibold">
              Shop Longitude

              <input
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                required
                value={checkout.longitude}
                onChange={updateCheckout}
                className="mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>

          </div>

          <button
            type="button"
            onClick={captureShopLocation}
            disabled={capturingLocation}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#3654FF] px-5 py-2 text-sm font-semibold text-[#3654FF] disabled:opacity-50"
          >
            <MapPin size={16} />

            {capturingLocation
              ? "Getting location..."
              : "Use my current location as shop location"}
          </button>

          <p className="mt-2 text-xs text-gray-500">
            Use GPS only when you are physically at
            the shop. Otherwise enter the shop's
            actual map coordinates.
          </p>

          {checkoutError && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {checkoutError}
            </p>
          )}

          {checkoutSuccess && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700"
            >
              {checkoutSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={
              placingOrder ||
              !canPlaceOrder ||
              capturingLocation
            }
            className="mt-6 rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placingOrder
              ? "Placing Order..."
              : `Place Wholesale Order · ${money(
                  totalOrderAmount
                )}`}
          </button>

        </form>

        <p className="mt-5 text-center text-xs text-gray-500">
          Prices are maintained by the company
          administrator. The final order total
          is calculated and verified by the backend.
        </p>

      </section>

      {/* ================================= */}
      {/* PROMOTIONAL SECTION */}
      {/* ================================= */}

      <section className="bg-[#DCE6FF] px-6 py-14">

        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 md:flex-row md:items-center">

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
              Something for Everyone
            </p>

            <h2 className="mt-3 font-serif text-4xl">
              Sweet moments.
              <br />
              Bigger celebrations.
            </h2>

            <p className="mt-3 max-w-lg text-sm text-gray-600">
              Ordering for a shop, team or celebration?
              Explore our bulk-order options.
            </p>
          </div>

          <Link
            to="/wholesale"
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#3654FF] shadow-sm transition hover:bg-[#FFF9F3]"
          >
            Explore Bulk Orders
          </Link>

        </div>
      </section>

      {/* ================================= */}
      {/* WHOLESALE BUSINESS SECTION */}
      {/* ================================= */}

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 lg:px-10">

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
            For Your Business
          </p>

          <h2 className="font-serif text-4xl md:text-5xl">
            A bigger order.
            <br />
            A sweeter experience.
          </h2>

          <p className="mt-6 text-sm leading-8 text-gray-600">
            From neighbourhood shops to larger events,
            our wholesale service helps businesses
            explore ordering options in one place.
          </p>

          <div className="mt-7 space-y-4 text-sm text-gray-600">
            <p>✓ Explore bulk ordering</p>
            <p>✓ Discover available flavours</p>
            <p>✓ View current wholesale prices</p>
          </div>

          <Link
            to="/wholesale"
            className="mt-8 inline-block rounded-full bg-[#3654FF] px-7 py-3 text-sm font-semibold text-white"
          >
            Learn About Wholesale
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-lg">

          <h3 className="font-serif text-2xl">
            Your Sweet Selection
          </h3>

          <p className="mt-2 text-xs text-gray-500">
            An example of our product collection.
          </p>

          <div className="mt-6 space-y-4">

            {sampleProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-4 border-b border-blue-100 pb-4"
              >

                <div className="flex items-center gap-3">

                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      {product.name}
                    </p>

                    <p className="text-xs text-gray-400">
                      Explore our collection
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={18}
                  className="text-[#3654FF]"
                />

              </div>
            ))}

            {sampleProducts.length === 0 && (
              <p className="text-sm text-gray-500">
                Products will appear here when added
                to the catalogue.
              </p>
            )}

          </div>

          <Link
            to="/flavours"
            className="mt-6 block rounded-full bg-[#3654FF] py-3 text-center text-sm font-semibold text-white"
          >
            Start Shopping
          </Link>

        </div>
      </section>

      {/* ================================= */}
      {/* HOW TO ORDER */}
      {/* ================================= */}

      <section className="bg-white px-6 py-20">

        <div className="mx-auto max-w-7xl">

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
            How It Works
          </p>

          <h2 className="mt-3 font-serif text-4xl">
            Three steps to sweeter plans.
          </h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3">

            {orderingSteps.map((step) => (
              <div
                key={step.number}
                className="border-t border-blue-200 pt-6"
              >

                <span className="font-serif text-4xl text-[#3654FF]">
                  {step.number}
                </span>

                <h3 className="mt-5 font-serif text-2xl">
                  {step.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {step.description}
                </p>

              </div>
            ))}

          </div>

          <Link
            to="/how-to-order"
            className="mt-10 inline-flex items-center gap-2 font-semibold text-[#3654FF]"
          >
            Learn How to Order
            <ArrowRight size={17} />
          </Link>

        </div>
      </section>

      {/* ================================= */}
      {/* OCCASIONS */}
      {/* ================================= */}

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">

        <h2 className="font-serif text-4xl">
          For the everyday. And the big days.
        </h2>

        <div className="mt-9 grid gap-6 md:grid-cols-3">

          {occasions.map((item) => (
            <div key={item.title}>

              <img
                src={item.image}
                alt={item.title}
                className="h-56 w-full rounded-xl object-cover"
              />

              <h3 className="mt-5 font-serif text-2xl">
                {item.title}
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                {item.description}
              </p>

            </div>
          ))}

        </div>
      </section>

      {/* ================================= */}
      {/* OUR STORY */}
      {/* ================================= */}

      <section className="bg-[#EAF0FF] px-6 py-20">

        <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2">

          <img
            src="https://images.unsplash.com/photo-1501446529957-6226bd447c46?w=1000"
            alt="Ice cream dessert"
            className="h-[400px] w-full rounded-2xl object-cover"
          />

          <div>

            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
              Our Story
            </p>

            <h2 className="mt-4 font-serif text-5xl">
              Little scoops.
              <br />
              Lasting smiles.
            </h2>

            <p className="mt-6 text-sm leading-8 text-gray-600">
              At Sathutu Sina Dairies, we believe
              ice cream brings people together.
              From everyday treats to larger
              celebrations, we want to make every
              occasion a little sweeter.
            </p>

            <Link
              to="/our-story"
              className="mt-7 inline-flex items-center gap-2 font-semibold text-[#3654FF]"
            >
              Read Our Story
              <ArrowRight size={17} />
            </Link>

          </div>
        </div>
      </section>

      {/* ================================= */}
      {/* FAQ */}
      {/* ================================= */}

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 lg:px-10">

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
            FAQs
          </p>

          <h2 className="mt-3 font-serif text-4xl">
            Before you
            <br />
            fill the freezer.
          </h2>

          <p className="mt-5 text-sm text-gray-600">
            A few helpful answers before you order.
          </p>
        </div>

        <div className="divide-y divide-blue-100">

          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group py-5"
            >
              <summary className="cursor-pointer list-none font-semibold">
                {faq.question}

                <span className="float-right text-[#3654FF]">
                  +
                </span>
              </summary>

              <p className="mt-4 text-sm leading-7 text-gray-600">
                {faq.answer}
              </p>
            </details>
          ))}

        </div>
      </section>

      {/* ================================= */}
      {/* FINAL CTA */}
      {/* ================================= */}

      <section className="bg-[#DCE6FF] px-6 py-20 text-center">

        <Heart className="mx-auto mb-5 text-[#3654FF]" />

        <h2 className="font-serif text-4xl md:text-5xl">
          Let's make it a sweet occasion.
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">
          Big plans or small cravings, there's
          always something delicious waiting for you.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-block rounded-full bg-[#3654FF] px-8 py-3 text-sm font-semibold text-white"
        >
          Shop Our Collection
        </Link>

      </section>

    </main>
  );
}
