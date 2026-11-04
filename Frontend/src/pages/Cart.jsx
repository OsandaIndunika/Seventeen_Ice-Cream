
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export default function Cart() {
  return (
    <main className="min-h-[70vh] bg-[#FFF9F3] px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <ShoppingCart
          size={56}
          className="mx-auto mb-6 text-[#3654FF]"
        />

        <h1 className="font-serif text-4xl font-bold text-[#17265B]">
          Your Shopping Cart
        </h1>

        <p className="mt-5 text-gray-600">
          Your selected ice cream products will appear here.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-block rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white transition hover:bg-[#233BC8]"
        >
          Explore Flavours
        </Link>
      </div>
    </main>
  );
}
