
import { useState } from "react";
import { ShoppingCart, Plus, Minus, CheckCircle2 } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function ProductCard({ product }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const { addToCart } = useCart();

  const productName =
    product.name ?? product.productName ?? "Ice Cream";

  const productPrice = Number(product.price ?? 0);

  const productImage =
    product.image ?? product.imageUrl ?? "";

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(price);

  const increaseQuantity = () => {
    setQuantity((previous) => previous + 1);
    setAdded(false);
  };

  const decreaseQuantity = () => {
    setQuantity((previous) => Math.max(1, previous - 1));
    setAdded(false);
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);

    setAdded(true);

    // Reset quantity for the next selection.
    setQuantity(1);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">

      {/* Product image */}
      <div className="flex h-56 items-center justify-center overflow-hidden bg-[#FFF9F3]">
        {productImage ? (
          <img
            src={productImage}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-7xl">🍦</span>
        )}
      </div>

      {/* Product details */}
      <div className="flex flex-1 flex-col p-5">

        <h3 className="text-xl font-bold text-[#17265B]">
          {productName}
        </h3>

        <p className="mt-2 min-h-12 text-sm text-slate-500">
          {product.description ||
            "Delicious ice cream made with quality ingredients."}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xl font-bold text-[#3654FF]">
            {formatPrice(productPrice)}
          </span>

          <span className="text-xs text-slate-400">
            Per unit
          </span>
        </div>

        {/* Quantity selector */}
        <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-3">

          <span className="text-sm font-semibold text-slate-700">
            Quantity
          </span>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              aria-label={`Decrease ${productName} quantity`}
            >
              <Minus size={16} />
            </button>

            <span className="w-8 text-center font-bold text-slate-800">
              {quantity}
            </span>

            <button
              type="button"
              onClick={increaseQuantity}
              className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100"
              aria-label={`Increase ${productName} quantity`}
            >
              <Plus size={16} />
            </button>

          </div>
        </div>

        {/* Selected quantity total */}
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-slate-500">
            Total
          </span>

          <strong className="text-[#17265B]">
            {formatPrice(productPrice * quantity)}
          </strong>
        </div>

        {/* Add to cart */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={product.id == null && product.productId == null}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
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

      </div>
    </div>
  );
}
