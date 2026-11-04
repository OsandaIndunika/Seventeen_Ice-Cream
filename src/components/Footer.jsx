
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-[#17265B] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4 lg:px-10">
        <div>
          <Link to="/">
            <img
              src="/sathutu-sina-logo.png"
              alt="Sathutu Sina Dairies"
              className="h-24 w-24 rounded-xl object-contain p-2"
            />
          </Link>

          <h2 className="mt-5 text-xl font-bold">
            Sathutu Sina Dairies
          </h2>

          <p className="mt-3 text-sm leading-7 text-blue-100">
            Bringing happiness to every family through delicious
            ice cream and delightful dairy products.
          </p>

          <div className="mt-5 flex gap-4">
            <FaInstagram size={20} />
            <FaFacebookF size={20} />
          </div>
        </div>

        <div>
          <h3 className="mb-5 font-semibold">Quick Links</h3>
          <div className="space-y-3 text-sm text-blue-100">
            <Link to="/" className="block">Home</Link>
            <Link to="/shop" className="block">Our Products</Link>
            <Link to="/about" className="block">About Us</Link>
            <Link to="/contact" className="block">Contact Us</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-5 font-semibold">Customer Services</h3>
          <div className="space-y-3 text-sm text-blue-100">
            <Link to="/wholesale" className="block">Wholesale Orders</Link>
            <Link to="/cart" className="block">Shopping Cart</Link>
            <Link to="/checkout" className="block">Checkout</Link>
            <Link to="/login" className="block">Login</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-5 font-semibold">Contact Us</h3>
          <div className="space-y-4 text-sm text-blue-100">
            <p className="flex items-center gap-3">
              <MapPin size={18} /> Sri Lanka
            </p>
            <p className="flex items-center gap-3">
              <Phone size={18} /> Contact number coming soon
            </p>
            <p className="flex items-center gap-3">
              <Mail size={18} /> Contact details coming soon
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-blue-100">
        © {new Date().getFullYear()} Sathutu Sina Dairies.
        All rights reserved.
      </div>
    </footer>
  );
}
