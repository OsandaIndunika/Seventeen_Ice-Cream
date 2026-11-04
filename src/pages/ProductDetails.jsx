
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { products } from "../data/products";

export default function ProductDetails() {
  const { id } = useParams();

  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  if (!product) {
    return (
      <main className="min-h-[70vh] bg-[#FFF9F3] px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#17265B]">
          Product Not Found
        </h1>

        <Link
          to="/flavours"
          className="mt-6 inline-block text-[#3654FF]"
        >
          Back to Flavours
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9F3] px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/flavours"
          className="mb-8 inline-flex items-center gap-2 text-[#3654FF]"
        >
          <ArrowLeft size={18} />
          Back to Flavours
        </Link>

        <div className="grid gap-12 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl bg-[#EAF0FF]">
            <img
              src={product.image}
              alt={product.name}
              className="h-full max-h-[450px] w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
              {product.category}
            </p>

            <h1 className="font-serif text-4xl font-bold text-[#17265B]">
              {product.name}
            </h1>

            <p className="mt-6 text-3xl font-bold text-[#3654FF]">
              Rs. {product.price}
            </p>

            <p className="mt-6 leading-8 text-gray-600">
              {product.description ||
                "Enjoy the delicious taste of our ice cream."}
            </p>

            <button
              type="button"
              disabled
              className="mt-8 inline-flex w-fit cursor-not-allowed items-center gap-3 rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white opacity-60"
            >
              <ShoppingCart size={20} />
              Add to Cart (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
