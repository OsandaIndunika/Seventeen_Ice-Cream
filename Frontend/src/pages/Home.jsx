
import { Link } from "react-router-dom";
import { ArrowRight, Heart, IceCreamCone } from "lucide-react";
import { products } from "../data/products";

// ==============================
// FAQ DATA
// ==============================
const faqs = [
  {
    question: "Do you offer wholesale ice cream orders?",
    answer:
      "Yes! We welcome bulk orders from shops, cafes, restaurants, and event organizers.",
  },
  {
    question: "Can I order ice cream for special events?",
    answer:
      "Yes. Contact our team to discuss larger orders for parties and celebrations.",
  },
  {
    question: "How can I see your ice cream prices?",
    answer:
      "Visit our Flavours page to view available products and their listed prices.",
  },
  {
    question: "How do I place an order?",
    answer:
      "Choose your favourite products, add them to your cart, and continue to checkout.",
  },
];

// ==============================
// ORDERING STEPS
// ==============================
const orderingSteps = [
  {
    number: "01",
    title: "Choose your favourites",
    description:
      "Browse our collection and select the flavours you love.",
  },
  {
    number: "02",
    title: "Review your cart",
    description:
      "Choose quantities and review your shopping cart.",
  },
  {
    number: "03",
    title: "Complete checkout",
    description:
      "Enter your details and submit your order.",
  },
];

// ==============================
// OCCASIONS
// ==============================
const occasions = [
  {
    title: "Everyday Treats",
    description: "Little treats for your sweetest moments.",
    image:
      "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800",
  },
  {
    title: "Office Celebrations",
    description: "Make workdays a little sweeter.",
    image:
      "https://images.unsplash.com/photo-1557142046-c704a3adf364?w=800",
  },
  {
    title: "Parties & Events",
    description: "More scoops for special occasions.",
    image:
      "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=800",
  },
];

// ==============================
// HOMEPAGE
// ==============================
export default function Home() {
  const featuredProducts = Array.isArray(products)
    ? products.slice(0, 8)
    : [];

  const sampleProducts = featuredProducts.slice(0, 3);

  return (
    <main className="bg-[#FFF9F3] text-[#17265B]">

      {/* ========================== */}
      {/* HERO SECTION */}
      {/* ========================== */}
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
            From everyday sweet cravings to big celebrations,
            discover delicious ice cream made to bring happiness
            to every moment.
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
            <p className="font-serif text-lg">A little joy</p>
            <p className="text-xs text-gray-500">In every scoop</p>
          </div>
        </div>
      </section>

      {/* ========================== */}
      {/* BENEFITS */}
      {/* ========================== */}
      <section className="border-y border-blue-100 bg-[#EAF0FF] py-5">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 text-center text-xs font-medium text-[#3654FF] md:grid-cols-4">
          <p>♡ Made with care</p>
          <p>✦ Delicious flavours</p>
          <p>♡ Great for every occasion</p>
          <p>✦ Retail & wholesale</p>
        </div>
      </section>

      {/* ========================== */}
      {/* FEATURED PRODUCTS */}
      {/* ========================== */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#3654FF]">
              Our Favourites
            </p>

            <h2 className="font-serif text-4xl md:text-5xl">
              Pick your crowd-pleasers.
            </h2>

            <p className="mt-3 text-sm text-gray-600">
              Sweet little moments start with the perfect flavour.
            </p>
          </div>

          <Link
            to="/flavours"
            className="flex items-center gap-2 text-sm font-semibold text-[#3654FF]"
          >
            Shop all flavours <ArrowRight size={17} />
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-lg"
              >
                <Link to={`/products/${product.id}`}>
                  <div className="h-56 overflow-hidden bg-[#EAF0FF]">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                    />
                  </div>
                </Link>

                <div className="p-5">
                  {product.category && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#3654FF]">
                      {product.category}
                    </p>
                  )}

                  <h3 className="text-lg font-bold">
                    {product.name}
                  </h3>

                  <p className="mt-3 font-bold text-[#3654FF]">
                    Rs. {Number(product.price).toLocaleString()}
                  </p>

                  <Link
                    to={`/products/${product.id}`}
                    className="mt-5 inline-block rounded-full bg-[#3654FF] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#233BC8]"
                  >
                    View Product
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-8 text-center text-gray-600">
            Our ice cream collection will be available here soon.
          </p>
        )}
      </section>

      {/* ========================== */}
      {/* PROMOTIONAL SECTION */}
      {/* ========================== */}
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
              Ordering for a shop, team, or celebration?
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

      {/* ========================== */}
      {/* WHOLESALE SECTION */}
      {/* ========================== */}
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
            From neighbourhood shops to larger events, our wholesale
            service helps businesses explore ice cream ordering
            options in one place.
          </p>

          <div className="mt-7 space-y-4 text-sm text-gray-600">
            <p>✓ Explore bulk ordering</p>
            <p>✓ Discover available flavours</p>
            <p>✓ Contact us about your business needs</p>
          </div>

          <Link
            to="/wholesale"
            className="mt-8 inline-block rounded-full bg-[#3654FF] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#233BC8]"
          >
            Learn About Wholesale
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-lg">
          <h3 className="font-serif text-2xl">
            Your Sweet Selection
          </h3>

          <p className="mt-2 text-xs text-gray-500">
            An example of what your order could look like.
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
                      Sample quantity: 5
                    </p>
                  </div>
                </div>

                <span className="text-sm font-semibold">
                  Rs. {(Number(product.price) * 5).toLocaleString()}
                </span>
              </div>
            ))}

            {sampleProducts.length === 0 && (
              <p className="text-sm text-gray-500">
                Products will appear here when added to the catalogue.
              </p>
            )}
          </div>

          <Link
            to="/flavours"
            className="mt-6 block rounded-full bg-[#3654FF] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#233BC8]"
          >
            Start Shopping
          </Link>
        </div>
      </section>

      {/* ========================== */}
      {/* HOW TO ORDER */}
      {/* ========================== */}
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
            Learn How to Order <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* ========================== */}
      {/* OCCASIONS */}
      {/* ========================== */}
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

      {/* ========================== */}
      {/* OUR STORY */}
      {/* ========================== */}
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
              At Sathutu Sina Dairies, we believe ice cream
              brings people together. From everyday treats
              to larger celebrations, we want to make every
              occasion a little sweeter.
            </p>

            <Link
              to="/our-story"
              className="mt-7 inline-flex items-center gap-2 font-semibold text-[#3654FF]"
            >
              Read Our Story <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================== */}
      {/* FAQ SECTION */}
      {/* ========================== */}
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
            <details key={faq.question} className="group py-5">
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

      {/* ========================== */}
      {/* FINAL CTA */}
      {/* ========================== */}
      <section className="bg-[#DCE6FF] px-6 py-20 text-center">
        <Heart className="mx-auto mb-5 text-[#3654FF]" />

        <h2 className="font-serif text-4xl md:text-5xl">
          Let's make it a sweet occasion.
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-sm text-gray-600">
          Big plans or small cravings, there's always
          something delicious waiting for you.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-block rounded-full bg-[#3654FF] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#233BC8]"
        >
          Shop Our Collection
        </Link>
      </section>

    </main>
  );
}
