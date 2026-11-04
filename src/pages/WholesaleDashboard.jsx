
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  UserRound,
  ArrowRight,
} from "lucide-react";

export default function WholesaleDashboard() {
  const dashboardItems = [
    {
      title: "Browse Products",
      description: "Explore available ice cream products.",
      icon: Package,
      path: "/flavours",
    },
    {
      title: "My Orders",
      description: "View your wholesale orders when available.",
      icon: ShoppingBag,
      path: null,
    },
    {
      title: "Business Profile",
      description: "Manage your wholesale business details.",
      icon: UserRound,
      path: null,
    },
  ];

  return (
    <main className="min-h-screen bg-[#FFF9F3] px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-center gap-4">
          <div className="rounded-2xl bg-[#EAF0FF] p-4">
            <LayoutDashboard
              size={32}
              className="text-[#3654FF]"
            />
          </div>

          <div>
            <h1 className="font-serif text-3xl font-bold text-[#17265B]">
              Wholesale Dashboard
            </h1>

            <p className="mt-2 text-gray-600">
              Welcome to Sathutu Sina Dairies.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {dashboardItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-3xl bg-white p-7 shadow-sm"
              >
                <Icon
                  size={32}
                  className="mb-5 text-[#3654FF]"
                />

                <h2 className="text-xl font-bold text-[#17265B]">
                  {item.title}
                </h2>

                <p className="mt-3 text-gray-600">
                  {item.description}
                </p>

                {item.path ? (
                  <Link
                    to={item.path}
                    className="mt-6 inline-flex items-center gap-2 font-semibold text-[#3654FF]"
                  >
                    Open
                    <ArrowRight size={18} />
                  </Link>
                ) : (
                  <p className="mt-6 text-sm text-gray-400">
                    Coming soon
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
