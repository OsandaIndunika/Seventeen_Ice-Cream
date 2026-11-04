
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

export default function Checkout() {
  return (
    <main className="min-h-screen bg-[#FFF9F3] px-6 py-16">
      <div className="mx-auto max-w-4xl">

        <div className="mb-10 text-center">
          <ShoppingBag
            size={48}
            className="mx-auto mb-5 text-[#3654FF]"
          />

          <h1 className="font-serif text-4xl font-bold text-[#17265B]">
            Checkout
          </h1>

          <p className="mt-4 text-gray-600">
            Complete your details to prepare your ice cream order.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-semibold text-[#17265B]">
            Customer Information
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Checkout is not connected to the backend yet.");
            }}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block font-medium"
              >
                Full Name
              </label>

              <input
                id="fullName"
                type="text"
                required
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block font-medium"
              >
                Phone Number
              </label>

              <input
                id="phone"
                type="tel"
                required
                placeholder="Enter your phone number"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block font-medium"
              >
                Delivery Address
              </label>

              <textarea
                id="address"
                required
                rows={4}
                placeholder="Enter your delivery address"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-[#3654FF] py-3 font-semibold text-white transition hover:bg-[#233BC8]"
            >
              Continue Checkout
            </button>
          </form>

          <Link
            to="/cart"
            className="mt-6 block text-center font-medium text-[#3654FF]"
          >
            Back to Cart
          </Link>
        </div>
      </div>
    </main>
  );
}
