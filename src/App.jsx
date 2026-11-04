
import { Routes, Route, Link, useLocation } from "react-router-dom";

// ==============================
// COMPONENTS
// ==============================
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WholesaleProtectedRoute from "./components/WholesaleProtectedRoute";

// ==============================
// PUBLIC PAGES
// ==============================
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import HowToOrder from "./pages/HowToOrder";
import About from "./pages/About";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Wholesale from "./pages/Wholesale";
import Contact from "./pages/Contact";
import Login from "./pages/Login";

// ==============================
// WHOLESALE DASHBOARD
// ==============================
import WholesaleDashboard from "./pages/WholesaleDashboard";

// ==============================
// 404 PAGE
// ==============================
function NotFound() {
  return (
    <main className="flex min-h-[65vh] flex-col items-center justify-center bg-[#FFF9F3] px-6 text-center">
      <h1 className="font-serif text-7xl font-bold text-[#3654FF]">
        404
      </h1>

      <h2 className="mt-5 text-3xl font-semibold text-[#17265B]">
        Page Not Found
      </h2>

      <p className="mt-4 max-w-md text-gray-600">
        Sorry, the page you are looking for does not exist.
        Please return to the homepage.
      </p>

      <Link
        to="/"
        className="mt-8 inline-block rounded-full bg-[#3654FF] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#233BC8]"
      >
        Back to Home
      </Link>
    </main>
  );
}

// ==============================
// MAIN APPLICATION
// ==============================
export default function App() {
  const location = useLocation();

  // Dashboard pages have their own layout.
  // Hide the public Navbar and Footer.
  const isDashboard =
    location.pathname === "/wholesale/dashboard" ||
    location.pathname.startsWith("/wholesale/dashboard/");

  return (
    <div className="min-h-screen bg-[#FFF9F3]">

      {/* PUBLIC NAVBAR */}
      {!isDashboard && <Navbar />}

      {/* APPLICATION ROUTES */}
      <Routes>

        {/* ========================== */}
        {/* HOMEPAGE */}
        {/* ========================== */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* ========================== */}
        {/* NAVBAR PAGES */}
        {/* ========================== */}
        <Route
          path="/flavours"
          element={<Shop />}
        />

        <Route
          path="/how-to-order"
          element={<HowToOrder />}
        />

        <Route
          path="/our-story"
          element={<About />}
        />

        {/* ========================== */}
        {/* SHOPPING PAGES */}
        {/* ========================== */}
        <Route
          path="/shop"
          element={<Shop />}
        />

        <Route
          path="/products/:id"
          element={<ProductDetails />}
        />

        <Route
          path="/cart"
          element={<Cart />}
        />

        <Route
          path="/checkout"
          element={<Checkout />}
        />

        {/* ========================== */}
        {/* OTHER PUBLIC PAGES */}
        {/* ========================== */}
        <Route
          path="/about"
          element={<About />}
        />

        <Route
          path="/wholesale"
          element={<Wholesale />}
        />

        <Route
          path="/contact"
          element={<Contact />}
        />

        {/* ========================== */}
        {/* AUTHENTICATION */}
        {/* ========================== */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* ========================== */}
        {/* PROTECTED WHOLESALE ROUTES */}
        {/* ========================== */}
        <Route
          path="/wholesale/dashboard"
          element={
            <WholesaleProtectedRoute>
              <WholesaleDashboard />
            </WholesaleProtectedRoute>
          }
        />

        {/* ========================== */}
        {/* 404 - UNKNOWN ROUTES */}
        {/* ========================== */}
        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>

      {/* PUBLIC FOOTER */}
      {!isDashboard && <Footer />}

    </div>
  );
}
