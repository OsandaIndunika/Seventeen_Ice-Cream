
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  IceCreamCone,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";

import { useCart } from "../context/CartContext";

// Example wholesale minimum per product/flavour.
// This is a frontend rule, not a confirmed business policy.
const WHOLESALE_MINIMUM = 5;

const formatPrice = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-LK")}`;

function getStoredAuth() {
  try {
    return JSON.parse(
      sessionStorage.getItem("seventeen_auth") || "null"
    );
  } catch {
    return null;
  }
}

// Individual cart item
function CartItem({
  item,
  updateQuantity,
  removeFromCart,
  showWholesaleMinimum,
}) {
  const lineTotal =
    Number(item.price) * Number(item.quantity);

  const remaining = Math.max(
    0,
    WHOLESALE_MINIMUM - item.quantity
  );

  return (
    <div className="grid gap-4 rounded-3xl border border-[#E5E9F5] bg-white p-4 transition hover:shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:grid-cols-[minmax(0,1fr)_120px_150px_130px_36px]">

      {/* PRODUCT INFORMATION */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EAF0FF]">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <IceCreamCone
              size={32}
              className="text-[#3654FF]"
            />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-[#17265B]">
            {item.name}
          </h3>

          {item.size && (
            <p className="mt-1 text-xs text-slate-500">
              Size: {item.size}
            </p>
          )}

          {item.selectedFlavour && (
            <p className="mt-1 text-xs font-semibold text-[#3654FF]">
              Flavour: {item.selectedFlavour}
            </p>
          )}

          {item.unit && (
            <p className="mt-1 text-xs text-slate-400">
              Unit: {item.unit}
            </p>
          )}
        </div>
      </div>

      {/* UNIT PRICE */}
      <div className="text-sm lg:text-center">
        <span className="mr-2 text-slate-400 lg:hidden">
          Unit Price:
        </span>

        <span className="font-semibold text-[#17265B]">
          {formatPrice(item.price)}
        </span>
      </div>

      {/* QUANTITY */}
      <div className="flex flex-col items-start lg:items-center">
        <div className="flex items-center rounded-full border border-[#E5E9F5] bg-white">
          <button
            type="button"
            onClick={() =>
              updateQuantity(item.id, item.quantity - 1)
            }
            aria-label={`Decrease ${item.name}`}
            className="rounded-l-full px-3 py-2 text-[#3654FF] hover:bg-[#EAF0FF]"
          >
            <Minus size={16} />
          </button>

          <span className="min-w-9 text-center text-sm font-bold text-[#17265B]">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() =>
              updateQuantity(item.id, item.quantity + 1)
            }
            aria-label={`Increase ${item.name}`}
            className="rounded-r-full px-3 py-2 text-[#3654FF] hover:bg-[#EAF0FF]"
          >
            <Plus size={16} />
          </button>
        </div>

        {showWholesaleMinimum && remaining > 0 && (
          <span className="mt-2 text-xs text-amber-600">
            Add {remaining} more
          </span>
        )}
      </div>

      {/* LINE TOTAL */}
      <div className="text-sm lg:text-right">
        <span className="mr-2 text-slate-400 lg:hidden">
          Line Total:
        </span>

        <strong className="text-base text-[#3654FF]">
          {formatPrice(lineTotal)}
        </strong>
      </div>

      {/* REMOVE */}
      <button
        type="button"
        onClick={() => removeFromCart(item.id)}
        aria-label={`Remove ${item.name}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

// Main cart page
export default function Cart() {
  const navigate = useNavigate();

  const {
    cart,
    cartCount,
    cartTotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [showClearConfirmation, setShowClearConfirmation] =
    useState(false);

  const auth = getStoredAuth();

  const role = String(
    auth?.user?.role || auth?.role || ""
  )
    .replace(/^ROLE_/, "")
    .toUpperCase();

  const isWholesale = role === "WHOLESALE";

  const belowMinimum = cart.filter(
    (item) => Number(item.quantity) < WHOLESALE_MINIMUM
  );

  const minimumsMet = belowMinimum.length === 0;

  const canCheckout =
    cart.length > 0 &&
    (!isWholesale || minimumsMet);

  const handleCheckout = () => {
    if (!canCheckout) return;

    if (!auth?.token) {
      navigate("/login", {
        state: {
          message:
            "Please sign in to continue with checkout.",
          from: "/checkout",
        },
      });
      return;
    }

    navigate("/checkout");
  };

  const handleClearCart = () => {
    clearCart();
    setShowClearConfirmation(false);
  };

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* PAGE HEADER */}
      <section className="bg-[#EAF0FF] px-6 py-16 text-center sm:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#3654FF]">
          Sathutu Sina Dairies
        </p>

        <h1 className="mt-4 font-serif text-5xl font-bold sm:text-6xl">
          My Cart
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-slate-600">
          Your favourite ice cream products, ready for review.
          Adjust quantities and continue when you are ready.
        </p>

        <p className="mt-5 text-sm font-semibold text-[#3654FF]">
          {cart.length} product/flavour combinations
          {" · "}
          {cartCount} total units
        </p>
      </section>

      {/* MAIN CART CONTENT */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">

        {cart.length === 0 ? (
          /* EMPTY CART */
          <div className="rounded-3xl border border-[#E5E9F5] bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#EAF0FF]">
              <ShoppingCart
                size={42}
                className="text-[#3654FF]"
              />
            </div>

            <h2 className="mt-8 font-serif text-3xl font-bold">
              Your Shopping Cart Is Empty
            </h2>

            <p className="mx-auto mt-4 max-w-md text-slate-500">
              You haven't selected any ice cream products yet.
              Explore our flavours and add your favourites.
            </p>

            <Link
              to="/flavours"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#3654FF] px-8 py-4 font-bold text-white transition hover:bg-blue-700"
            >
              Explore Flavours
              <ArrowRight size={19} />
            </Link>
          </div>
        ) : (
          <div className="space-y-8">

            {/* CART HEADING */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl font-bold">
                  Selected Products
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Review your products, flavours and quantities.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowClearConfirmation(true)}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={17} />
                Clear Cart
              </button>
            </div>

            {/* DESKTOP TABLE HEADINGS */}
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_130px_36px] gap-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 lg:grid">
              <span>Product / Format</span>
              <span className="text-center">Unit Price</span>
              <span className="text-center">Quantity</span>
              <span className="text-right">Line Total</span>
              <span />
            </div>

            {/* CART ITEMS */}
            <div className="space-y-4">
              {cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  showWholesaleMinimum={isWholesale}
                />
              ))}
            </div>

            {/* WHOLESALE MINIMUM MESSAGE */}
            {isWholesale && (
              <div
                className={`rounded-2xl border p-5 ${
                  minimumsMet
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                {minimumsMet ? (
                  <div className="flex items-center gap-3 text-green-700">
                    <CheckCircle2 size={22} />

                    <div>
                      <p className="font-semibold">
                        Example wholesale minimums met
                      </p>

                      <p className="mt-1 text-sm">
                        Every selected product/flavour has
                        at least {WHOLESALE_MINIMUM} units.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-amber-700">
                    <AlertCircle
                      size={22}
                      className="shrink-0"
                    />

                    <div>
                      <p className="font-semibold">
                        Wholesale Minimum Not Met
                      </p>

                      <p className="mt-1 text-sm">
                        {belowMinimum.length} product/flavour
                        combination(s) contain fewer than{" "}
                        {WHOLESALE_MINIMUM} units.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ORDER SUMMARY */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">

              {/* CONTINUE SHOPPING */}
              <div className="flex flex-col justify-between gap-6">
                <div className="rounded-2xl bg-[#EAF0FF] p-6">
                  <div className="flex items-center gap-3">
                    <Package
                      size={23}
                      className="text-[#3654FF]"
                    />

                    <h3 className="font-bold">
                      Your Ice Cream Selection
                    </h3>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    You have selected {cartCount} units
                    across {cart.length} different
                    product/flavour combinations.
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    Prices are estimates. Final pricing,
                    availability, delivery charges and
                    eligibility must be verified at checkout.
                  </p>
                </div>

                <Link
                  to="/flavours"
                  className="inline-flex items-center gap-3 font-semibold text-[#3654FF] hover:underline"
                >
                  <ArrowLeft size={19} />
                  Continue Shopping
                </Link>
              </div>

              {/* TOTAL SUMMARY */}
              <div className="h-fit rounded-3xl border border-[#E5E9F5] bg-white p-7 shadow-sm">
                <h3 className="font-serif text-2xl font-bold">
                  Order Summary
                </h3>

                <div className="mt-7 space-y-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Product / Flavour Entries
                    </span>

                    <strong>{cart.length}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Total Quantity
                    </span>

                    <strong>{cartCount} units</strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Delivery
                    </span>

                    <span>Calculated at checkout</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-5">
                    <span className="text-lg font-bold">
                      Subtotal
                    </span>

                    <strong className="text-2xl text-[#3654FF]">
                      {formatPrice(cartTotal)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={!canCheckout}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-[#3654FF] px-6 py-4 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proceed to Checkout
                  <ArrowRight size={19} />
                </button>

                <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                  Checkout will confirm the final amount
                  before an order is placed.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CLEAR CART CONFIRMATION */}
      {showClearConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-cart-title"
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"
          >
            <h3
              id="clear-cart-title"
              className="text-2xl font-bold text-[#17265B]"
            >
              Clear Shopping Cart?
            </h3>

            <p className="mt-3 text-slate-500">
              This will remove all selected ice cream
              products and flavours from your cart.
            </p>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirmation(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleClearCart}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
