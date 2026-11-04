
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, ShoppingBag, UserRound } from "lucide-react";
import { useCart } from "../context/CartContext";

const links = [
  { name: "Flavours", path: "/flavours" },
  { name: "How to Order", path: "/how-to-order" },
  { name: "Our Story", path: "/our-story" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { cartCount } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">

      {/* Announcement Bar */}
      <div className="bg-[#3654FF] py-2 text-center text-xs font-medium text-white">
        Welcome to Sathutu Sina Dairies — Happiness in Every Scoop!
      </div>

      {/* Main Navbar */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-10">

        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <img
            src="/sathutu-sina-logo.png"
            alt="Sathutu Sina Dairies"
            className="h-16 w-16 object-contain md:h-20 md:w-20"
          />

          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-[#3654FF]">
              Sathutu Sina
            </h1>
            <p className="text-xs font-semibold tracking-[0.25em] text-gray-500">
              DAIRIES
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors duration-200
                hover:text-[#3654FF] ${
                  isActive
                    ? "text-[#3654FF] font-semibold"
                    : "text-gray-700"
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>

        {/* Login, Cart and Mobile Menu */}
        <div className="flex items-center gap-5">

          <Link
            to="/login"
            aria-label="Login"
            className="hover:scale-110 transition-transform"
          >
            <UserRound size={22} className="text-[#3654FF]" />
          </Link>

          <Link
            to="/cart"
            className="relative hover:scale-110 transition-transform"
            aria-label="Shopping cart"
          >
            <ShoppingBag size={23} className="text-[#3654FF]" />

            {cartCount > 0 && (
              <span className="absolute -right-3 -top-3 rounded-full bg-[#3654FF] px-1.5 py-0.5 text-[10px] text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="md:hidden text-[#3654FF]"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X size={25} /> : <Menu size={25} />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {open && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          {links.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-[#3654FF]"
                    : "text-gray-700 hover:bg-blue-50 hover:text-[#3654FF]"
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
