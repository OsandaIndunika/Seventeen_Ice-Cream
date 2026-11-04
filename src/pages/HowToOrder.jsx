
import { Link } from "react-router-dom";
import {
  IceCreamCone,
  ShoppingCart,
  ClipboardCheck,
  ArrowRight,
  PackageCheck,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Explore Our Flavours",
    description:
      "Browse our ice cream collection and find the flavours you love.",
    icon: IceCreamCone,
  },
  {
    number: "02",
    title: "Add to Cart",
    description:
      "Select your favourite products and choose the quantities you need.",
    icon: ShoppingCart,
  },
  {
    number: "03",
    title: "Review Your Order",
    description:
      "Check your selected products and quantities before checkout.",
    icon: ClipboardCheck,
  },
  {
    number: "04",
    title: "Complete Checkout",
    description:
      "Enter your contact and delivery details to submit your order.",
    icon: PackageCheck,
  },
];

export default function HowToOrder() {
  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">
      {/* HERO */}
      <section className="bg-[#EAF0FF] px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
          Sathutu Sina Dairies
        </p>

        <h1 className="mt-4 font-serif text-5xl font-bold md:text-6xl">
          How to Order
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-gray-600">
          Ordering your favourite ice cream is simple.
          Follow these steps to prepare your order.
        </p>
      </section>

      {/* ORDERING STEPS */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="rounded-3xl bg-white p-8 shadow-sm"
              >
                <div className="mb-6 flex items-center justify-between">
                  <Icon
                    size={36}
                    className="text-[#3654FF]"
                  />

                  <span className="font-serif text-4xl text-[#DCE6FF]">
                    {step.number}
                  </span>
                </div>

                <h2 className="font-serif text-2xl font-bold">
                  {step.title}
                </h2>

                <p className="mt-4 leading-7 text-gray-600">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* WHOLESALE */}
      <section className="bg-[#EAF0FF] px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-serif text-4xl font-bold">
            Ordering for Your Business?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-gray-600">
            We also provide information about bulk ordering
            for shops, restaurants, and other businesses.
          </p>

          <Link
            to="/wholesale"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white hover:bg-[#233BC8]"
          >
            Explore Wholesale
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-serif text-4xl font-bold">
          Ready for Something Sweet?
        </h2>

        <p className="mt-5 text-gray-600">
          Explore our ice cream collection and choose your favourites.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white hover:bg-[#233BC8]"
        >
          Browse Flavours
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
