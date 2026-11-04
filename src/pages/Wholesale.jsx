
import { Link } from "react-router-dom";
import { Package, Store, Truck, ClipboardList } from "lucide-react";

const benefits = [
  {
    icon: Package,
    title: "Bulk Orders",
    description: "Explore larger quantities for your business.",
  },
  {
    icon: Store,
    title: "Retail Shops",
    description: "Suitable for shops, cafes, and other businesses.",
  },
  {
    icon: Truck,
    title: "Delivery Planning",
    description: "Coordinate delivery arrangements with the factory.",
  },
  {
    icon: ClipboardList,
    title: "Order Management",
    description: "A dedicated ordering experience can simplify purchasing.",
  },
];

export default function Wholesale() {
  return (
    <main className="bg-[#fffaf3]">
      <section className="bg-[#fce7eb] px-6 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#b72e59]">
          For businesses
        </p>
        <h1 className="mt-4 font-serif text-5xl md:text-6xl">
          Sweet Deals for Bigger Orders
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-8 text-[#806b65]">
          Planning to stock your shop or arrange ice cream for a
          special occasion? Explore wholesale ordering with FrostyDelights.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 lg:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#b72e59]">
            Wholesale partnership
          </p>
          <h2 className="mt-4 font-serif text-4xl md:text-5xl">
            More scoops.
            <br />
            More possibilities.
          </h2>
          <p className="mt-6 text-sm leading-8 text-[#806b65]">
            Our wholesale section is designed for businesses that
            need larger quantities of ice cream. Explore products,
            discuss your requirements, and prepare for a dedicated
            wholesale ordering experience.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/login"
              className="rounded-full bg-[#b72e59] px-7 py-3 text-sm font-semibold text-white"
            >
              Wholesale Login
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-[#b72e59] px-7 py-3 text-sm text-[#b72e59]"
            >
              Contact Us
            </Link>
          </div>
        </div>

        <img
          src="https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=1000"
          alt="Ice cream selection"
          className="h-[400px] w-full rounded-2xl object-cover"
        />
      </section>

      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center font-serif text-4xl">
            Why Choose Wholesale?
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl bg-[#fffaf3] p-7 text-center"
              >
                <Icon size={32} className="mx-auto text-[#b72e59]" />
                <h3 className="mt-5 font-serif text-xl">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#806b65]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl rounded-2xl bg-[#fce7eb] p-10 text-center md:p-16">
          <h2 className="font-serif text-4xl">
            Interested in Becoming a Wholesale Customer?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-8 text-[#806b65]">
            Contact our team to discuss quantities, available products,
            and potential wholesale arrangements.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-block rounded-full bg-[#b72e59] px-8 py-3 text-sm font-semibold text-white"
          >
            Send an Inquiry
          </Link>
        </div>
      </section>
    </main>
  );
}
