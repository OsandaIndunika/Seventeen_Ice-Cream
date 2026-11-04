
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { products } from "../data/products";

export default function Shop() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const productList = Array.isArray(products) ? products : [];

  const categories = [
    "All",
    ...new Set(
      productList.map((product) => product.category)
        .filter(Boolean)
    ),
  ];

  const filteredProducts = productList.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* HEADER */}
      <section className="bg-[#EAF0FF] px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
          Sathutu Sina Dairies
        </p>

        <h1 className="mt-4 font-serif text-5xl font-bold">
          Explore Our Flavours
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-gray-600">
          Discover our delicious ice cream collection
          and find your favourite flavours.
        </p>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-7xl px-6 py-16">

        {/* SEARCH */}
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <Search size={20} className="text-gray-400" />

          <input
            type="text"
            placeholder="Search ice cream flavours..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none"
          />
        </div>

        {/* CATEGORIES */}
        <div className="mb-10 flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-6 py-2 font-medium transition ${
                selectedCategory === category
                  ? "bg-[#3654FF] text-white"
                  : "bg-white text-[#17265B] hover:bg-[#EAF0FF]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        {filteredProducts.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-lg"
              >
                <Link to={`/products/${product.id}`}>
                  <div className="h-64 overflow-hidden bg-[#EAF0FF]">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  </div>
                </Link>

                <div className="p-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#3654FF]">
                    {product.category}
                  </p>

                  <h2 className="font-serif text-xl font-bold">
                    {product.name}
                  </h2>

                  <p className="mt-3 text-lg font-semibold text-[#3654FF]">
                    Rs. {product.price}
                  </p>

                  <Link
                    to={`/products/${product.id}`}
                    className="mt-5 inline-flex items-center gap-2 font-semibold text-[#3654FF] hover:underline"
                  >
                    View Product
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <h2 className="text-2xl font-semibold">
              No products found
            </h2>

            <p className="mt-3 text-gray-500">
              Try another search or category.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
