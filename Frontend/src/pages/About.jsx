
import { Link } from "react-router-dom";
import { ArrowRight, Heart, IceCreamCone } from "lucide-react";

export default function About() {
  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* HERO SECTION */}
      <section className="bg-[#EAF0FF] px-6 py-20 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
          Sathutu Sina Dairies
        </p>

        <h1 className="font-serif text-5xl font-bold md:text-6xl">
          Our Story
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-gray-600">
          Bringing happiness to every scoop and making
          sweet moments even more memorable.
        </p>
      </section>

      {/* ABOUT SECTION */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2">

        <div>
          <img
            src="https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1000"
            alt="Ice cream"
            className="h-[420px] w-full rounded-3xl object-cover shadow-lg"
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
            Who We Are
          </p>

          <h2 className="font-serif text-4xl font-bold">
            Little Scoops.
            <br />
            Lasting Smiles.
          </h2>

          <p className="mt-6 leading-8 text-gray-600">
            Sathutu Sina Dairies is dedicated to making
            delicious ice cream for customers, families,
            shops, and special occasions.
          </p>

          <p className="mt-4 leading-8 text-gray-600">
            Whether you're enjoying a single ice cream
            or ordering products in bulk, our goal is
            to make every experience sweeter.
          </p>

          <Link
            to="/flavours"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#3654FF] px-7 py-3 font-semibold text-white transition hover:bg-[#233BC8]"
          >
            Explore Our Flavours
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* VALUES SECTION */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center font-serif text-4xl">
            What Makes Us Special
          </h2>

          <div className="grid gap-8 md:grid-cols-3">

            <div className="rounded-2xl bg-[#FFF9F3] p-8 text-center">
              <Heart
                size={36}
                className="mx-auto mb-5 text-[#3654FF]"
              />

              <h3 className="text-xl font-bold">
                Made with Care
              </h3>

              <p className="mt-4 text-gray-600">
                We focus on creating enjoyable ice cream
                experiences for our customers.
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF9F3] p-8 text-center">
              <IceCreamCone
                size={36}
                className="mx-auto mb-5 text-[#3654FF]"
              />

              <h3 className="text-xl font-bold">
                Delicious Flavours
              </h3>

              <p className="mt-4 text-gray-600">
                Explore a selection of ice cream flavours
                for different tastes and occasions.
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF9F3] p-8 text-center">
              <Heart
                size={36}
                className="mx-auto mb-5 text-[#3654FF]"
              />

              <h3 className="text-xl font-bold">
                Happy Moments
              </h3>

              <p className="mt-4 text-gray-600">
                Bringing people together through
                delicious frozen treats.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="bg-[#DCE6FF] px-6 py-20 text-center">
        <h2 className="font-serif text-4xl font-bold">
          Taste the Happiness
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-gray-600">
          Discover our collection and find your next
          favourite ice cream flavour.
        </p>

        <Link
          to="/flavours"
          className="mt-8 inline-block rounded-full bg-[#3654FF] px-8 py-3 font-semibold text-white transition hover:bg-[#233BC8]"
        >
          Shop Ice Cream
        </Link>
      </section>

    </main>
  );
}
