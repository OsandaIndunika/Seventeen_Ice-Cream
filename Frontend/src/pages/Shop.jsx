
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  Search,
  ArrowRight,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Package,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { products } from "../data/products";
import { useCart } from "../context/CartContext";

// =====================================================
// API CONFIGURATION
// =====================================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

const WHOLESALE_PRICE_URL =
  `${API_URL}/api/public/wholesale-prices`;

// =====================================================
// PRICE AND FLAVOUR HELPERS
// =====================================================

function normalizeProductId(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeFlavour(productId, flavour) {
  const value = String(flavour ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  // Existing orders or product definitions may use
  // Original or Plain for yoghurt drink.
  // The database now uses Yoghurt.

  if (
    normalizeProductId(productId) === "yoghurt-drink" &&
    ["original", "plain", "yoghurt"].includes(value)
  ) {
    return "yoghurt";
  }

  return value;
}

function displayFlavour(productId, flavour) {
  if (
    normalizeProductId(productId) === "yoghurt-drink"
  ) {
    return "Yoghurt";
  }

  return String(flavour ?? "").trim();
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Price unavailable";
  }

  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getWholesalePrice(
  wholesalePrices,
  productId,
  selectedFlavour
) {
  const matchingPrice = wholesalePrices.find(
    (record) =>
      normalizeProductId(record.productId) ===
        normalizeProductId(productId) &&
      normalizeFlavour(
        record.productId,
        record.flavour
      ) ===
        normalizeFlavour(productId, selectedFlavour)
  );

  if (!matchingPrice) {
    return null;
  }

  const unitPrice = Number(matchingPrice.unitPrice);

  if (
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0
  ) {
    return null;
  }

  return unitPrice;
}

// =====================================================
// PRODUCT CARD
// =====================================================

function ShopProductCard({
  product,
  wholesalePrices,
  pricesLoading,
  pricesError,
}) {
  const { addToCart } = useCart();

  const [quantity, setQuantity] = useState(1);

  const [selectedFlavour, setSelectedFlavour] =
    useState(() => {
      if (
        normalizeProductId(product.id) ===
        "yoghurt-drink"
      ) {
        return "Yoghurt";
      }

      return product.flavours?.[0] || "";
    });

  const [added, setAdded] = useState(false);

  const productName = product.name || "Ice Cream";

  // =================================================
  // AVAILABLE FLAVOURS
  // =================================================

  const availableFlavours = useMemo(() => {
    if (
      normalizeProductId(product.id) ===
      "yoghurt-drink"
    ) {
      return ["Yoghurt"];
    }

    const originalFlavours =
      Array.isArray(product.flavours)
        ? product.flavours
        : [];

    return [
      ...new Set(
        originalFlavours
          .map((flavour) =>
            displayFlavour(product.id, flavour)
          )
          .filter(Boolean)
      ),
    ];
  }, [product.id, product.flavours]);

  // =================================================
  // SELECTED UNIT PRICE FROM DATABASE
  // =================================================

  const unitPrice = useMemo(() => {
    return getWholesalePrice(
      wholesalePrices,
      product.id,
      selectedFlavour
    );
  }, [
    wholesalePrices,
    product.id,
    selectedFlavour,
  ]);

  // =================================================
  // AUTOMATIC TOTAL
  // =================================================

  const totalPrice =
    unitPrice === null
      ? null
      : unitPrice * quantity;

  const canAddToCart =
    !pricesLoading &&
    !pricesError &&
    unitPrice !== null &&
    Number.isInteger(quantity) &&
    quantity > 0;

  // =================================================
  // QUANTITY CONTROLS
  // =================================================

  const increaseQuantity = () => {
    setQuantity((previous) => previous + 1);
    setAdded(false);
  };

  const decreaseQuantity = () => {
    setQuantity((previous) =>
      Math.max(1, previous - 1)
    );

    setAdded(false);
  };

  // =================================================
  // ADD TO CART
  // =================================================

  const handleAddToCart = () => {
    if (!canAddToCart) {
      return;
    }

    // Preserve the existing CartContext API:
    // addToCart(product, quantity)
    //
    // Override the product's static price with
    // the selected flavour price from PostgreSQL.

    const cartProduct = {
      ...product,

      // Unique cart item for product + flavour.
      id: selectedFlavour
        ? `${product.id}-${normalizeFlavour(
            product.id,
            selectedFlavour
          )}`
        : product.id,

      // Original product ID used by the backend.
      productId: product.id,

      name: `${product.name} (${product.size})${
        selectedFlavour
          ? ` - ${selectedFlavour}`
          : ""
      }`,

      selectedFlavour,

      flavour: selectedFlavour,

      // Database-authoritative unit price.
      price: unitPrice,

      unitPrice: unitPrice,
    };

    addToCart(cartProduct, quantity);

    setAdded(true);
    setQuantity(1);
  };

  // =================================================
  // PRODUCT CARD UI
  // =================================================

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">

      {/* PRODUCT IMAGE */}

      <Link
        to={`/product/${product.id}`}
        className="block"
      >
        <div className="h-56 overflow-hidden bg-[#EAF0FF]">
          {product.image ? (
            <img
              src={product.image}
              alt={productName}
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl">
              🍦
            </div>
          )}
        </div>
      </Link>

      {/* PRODUCT DETAILS */}

      <div className="flex flex-1 flex-col p-6">

        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#3654FF]">
          {product.category || product.size}
        </p>

        <h2 className="font-serif text-xl font-bold text-[#17265B]">
          {productName}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {product.size}
        </p>

        <p className="mt-3 min-h-10 text-sm text-gray-500">
          {product.description ||
            "Delicious ice cream from Sathutu Sina Dairies."}
        </p>

        {/* DATABASE UNIT PRICE */}

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xl font-bold text-[#3654FF]">
            {pricesLoading
              ? "Loading..."
              : unitPrice === null
                ? "Price unavailable"
                : formatMoney(unitPrice)}
          </p>

          <span className="text-xs text-gray-400">
            Per {product.unit || "unit"}
          </span>
        </div>

        {/* FLAVOUR SELECTION */}

        {availableFlavours.length > 0 && (
          <div className="mt-5">

            <label
              htmlFor={`flavour-${product.id}`}
              className="mb-2 block text-sm font-semibold text-[#17265B]"
            >
              Select Flavour
            </label>

            <select
              id={`flavour-${product.id}`}
              value={selectedFlavour}
              onChange={(event) => {
                setSelectedFlavour(
                  event.target.value
                );

                setAdded(false);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#3654FF]"
            >
              {availableFlavours.map((flavour) => (
                <option
                  key={flavour}
                  value={flavour}
                >
                  {flavour}
                </option>
              ))}
            </select>

          </div>
        )}

        {/* QUANTITY SELECTION */}

        <div className="mt-5 flex items-center justify-between rounded-xl bg-[#F7F8FC] p-3">

          <span className="text-sm font-semibold text-[#17265B]">
            Quantity
          </span>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
              aria-label={`Decrease ${productName} quantity`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40"
            >
              <Minus size={16} />
            </button>

            <span className="w-8 text-center font-bold">
              {quantity}
            </span>

            <button
              type="button"
              onClick={increaseQuantity}
              aria-label={`Increase ${productName} quantity`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
            >
              <Plus size={16} />
            </button>

          </div>
        </div>

        {/* AUTOMATIC TOTAL */}

        <div className="mt-4 flex items-center justify-between text-sm">

          <span className="text-gray-500">
            Total Price
          </span>

          <strong className="text-lg text-[#17265B]">
            {totalPrice === null
              ? "Unavailable"
              : formatMoney(totalPrice)}
          </strong>

        </div>

        {/* ADD TO CART */}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            added
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-[#3654FF] hover:bg-blue-700"
          }`}
        >
          {added ? (
            <>
              <CheckCircle2 size={19} />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart size={19} />
              Add to Cart
            </>
          )}
        </button>

        {/* PRODUCT DETAILS LINK */}

        <Link
          to={`/product/${product.id}`}
          className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#3654FF] hover:underline"
        >
          View Product Details
          <ArrowRight size={16} />
        </Link>

      </div>
    </div>
  );
}

// =====================================================
// MAIN SHOP PAGE
// =====================================================

export default function Shop() {

  // =================================================
  // EXISTING SEARCH AND CATEGORY STATE
  // =================================================

  const [search, setSearch] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const { cartCount, cartTotal } = useCart();

  const productList =
    Array.isArray(products) ? products : [];

  // =================================================
  // WHOLESALE PRICES FROM SPRING BOOT
  // =================================================

  const [wholesalePrices, setWholesalePrices] =
    useState([]);

  const [pricesLoading, setPricesLoading] =
    useState(true);

  const [pricesError, setPricesError] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  // =================================================
  // FETCH PRICES FROM POSTGRESQL THROUGH API
  // =================================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadWholesalePrices() {
      setPricesLoading(true);
      setPricesError("");

      try {
        const response = await fetch(
          WHOLESALE_PRICE_URL,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load wholesale prices (HTTP ${response.status}).`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid wholesale price response."
          );
        }

        if (data.length === 0) {
          throw new Error(
            "No wholesale prices are available."
          );
        }

        if (!controller.signal.aborted) {
          setWholesalePrices(data);
        }

      } catch (error) {
        if (
          error.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setWholesalePrices([]);
          setPricesError(error.message);
        }

      } finally {
        if (!controller.signal.aborted) {
          setPricesLoading(false);
        }
      }
    }

    loadWholesalePrices();

    return () => controller.abort();
  }, [refreshKey]);

  // =================================================
  // REFRESH PRICES BUTTON
  // =================================================

  const refreshWholesalePrices = () => {
    // Clear previous prices while fetching fresh ones.
    setWholesalePrices([]);
    setPricesLoading(true);
    setRefreshKey((previous) => previous + 1);
  };

  // =================================================
  // EXISTING CATEGORY FILTERS
  // =================================================

  const categories = useMemo(() => {
    const values = productList.map(
      (product) =>
        product.category || product.name
    );

    return [
      "All",
      ...new Set(values.filter(Boolean)),
    ];
  }, []);

  // =================================================
  // EXISTING SEARCH AND FILTER LOGIC
  // =================================================

  const filteredProducts = productList.filter(
    (product) => {

      const query = search
        .trim()
        .toLowerCase();

      const searchableText = [
        product.name,
        product.size,
        product.category,
        ...(product.flavours || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchableText.includes(query);

      const productCategory =
        product.category || product.name;

      const matchesCategory =
        selectedCategory === "All" ||
        productCategory === selectedCategory;

      return (
        matchesSearch &&
        matchesCategory
      );
    }
  );

  // =================================================
  // SHOP PAGE UI
  // =================================================

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* HEADER */}

      <section className="bg-[#EAF0FF] px-6 py-16 text-center">

        <p className="text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
          Sathutu Sina Dairies
        </p>

        <h1 className="mt-4 font-serif text-4xl font-bold sm:text-5xl">
          Explore Our Flavours
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-gray-600">
          Discover our delicious ice cream collection,
          choose your favourite flavours, and select
          the quantities you want.
        </p>

      </section>

      {/* MAIN PRODUCTS SECTION */}

      <section className="mx-auto max-w-7xl px-6 py-12">

        {/* CART SUMMARY */}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-4">

            <div className="rounded-xl bg-[#EAF0FF] p-3 text-[#3654FF]">
              <ShoppingCart size={24} />
            </div>

            <div>
              <p className="font-bold text-[#17265B]">
                Your Shopping Cart
              </p>

              <p className="text-sm text-gray-500">
                {cartCount} selected units
              </p>
            </div>

          </div>

          <div className="flex flex-wrap items-center gap-4">

            <p className="text-lg font-bold text-[#3654FF]">
              {formatMoney(Number(cartTotal || 0))}
            </p>

            <Link
              to="/cart"
              className="inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              View Cart
              <ArrowRight size={18} />
            </Link>

          </div>
        </div>

        {/* WHOLESALE PRICE STATUS */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

          <div className="text-sm text-gray-500">

            {pricesLoading ? (
              <span>
                Loading current wholesale prices...
              </span>
            ) : pricesError ? (
              <span className="text-red-600">
                Prices could not be verified.
              </span>
            ) : (
              <span className="text-emerald-700">
                Wholesale prices loaded from
                the approved company catalog.
              </span>
            )}

          </div>

          <button
            type="button"
            onClick={refreshWholesalePrices}
            disabled={pricesLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-[#3654FF] transition hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                pricesLoading ? "animate-spin" : ""
              }
            />

            Refresh Prices
          </button>

        </div>

        {/* PRICE ERROR */}

        {pricesError && (
          <div
            role="alert"
            className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
          >
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Wholesale prices unavailable
              </p>

              <p className="mt-1 text-sm">
                {pricesError}
              </p>

              <p className="mt-1 text-sm">
                Adding products to the cart is
                disabled until current prices
                can be verified.
              </p>
            </div>
          </div>
        )}

        {/* SEARCH BAR */}

        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">

          <Search
            size={20}
            className="text-gray-400"
          />

          <input
            type="text"
            placeholder="Search products, sizes or flavours..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="w-full bg-transparent text-[#17265B] outline-none"
          />

        </div>

        {/* CATEGORY FILTERS */}

        <div className="mb-10 flex flex-wrap gap-3">

          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setSelectedCategory(category)
              }
              className={`rounded-full px-6 py-2 text-sm font-medium transition ${
                selectedCategory === category
                  ? "bg-[#3654FF] text-white"
                  : "bg-white text-[#17265B] hover:bg-[#EAF0FF]"
              }`}
            >
              {category}
            </button>
          ))}

        </div>

        {/* PRODUCTS GRID */}

        {filteredProducts.length > 0 ? (

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {filteredProducts.map((product) => (

              <ShopProductCard
                key={product.id}
                product={product}
                wholesalePrices={wholesalePrices}
                pricesLoading={pricesLoading}
                pricesError={pricesError}
              />

            ))}

          </div>

        ) : (

          <div className="py-20 text-center">

            <Package
              size={48}
              className="mx-auto text-gray-300"
            />

            <h2 className="mt-4 text-2xl font-semibold">
              No products found
            </h2>

            <p className="mt-3 text-gray-500">
              Try another search or category.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
              }}
              className="mt-5 rounded-xl bg-[#3654FF] px-6 py-3 font-semibold text-white"
            >
              Clear Filters
            </button>

          </div>

        )}

      </section>

    </main>
  );
}
