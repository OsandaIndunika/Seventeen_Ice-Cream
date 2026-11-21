
import {
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

// ==========================================
// SHARED COMPONENTS
// ==========================================

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import ProtectedRoute
  from "./components/ProtectedRoute";

// ==========================================
// PUBLIC PAGES
// ==========================================

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
import AdminDashboard from "./pages/AdminDashboard";

// ==========================================
// WHOLESALE CUSTOMER PAGES
// ==========================================

import WholesaleRegister
  from "./pages/WholesaleRegister";

import WholesaleDashboard
  from "./pages/WholesaleDashboard";

import OrderConfirmation
  from "./pages/OrderConfirmation";

// ==========================================
// ROLE-BASED DASHBOARDS
// ==========================================


import FactoryManagerDashboard
  from "./pages/FactoryManagerDashboard";

import SalesManagerDashboard
  from "./pages/SalesManagerDashboard";

import OutletManagerDashboard
  from "./pages/OutletManagerDashboard";

// Database-connected Outlet POS, inventory and daily reports
import OutletManagerOperations
  from "./components/outlet/OutletManagerOperations";

import DeliveryPersonDashboard
  from "./pages/DeliveryPersonDashboard";

import DeliveryVehicleSelection
  from "./pages/DeliveryVehicleSelection";

// ==========================================
// 404 PAGE
// ==========================================

function NotFound() {
  return (
    <main className="flex min-h-[65vh] flex-col items-center justify-center bg-[#FFF9F3] px-6 text-center print:hidden">

      <h1 className="font-serif text-7xl font-bold text-[#3654FF]">
        404
      </h1>

      <h2 className="mt-5 text-3xl font-semibold text-[#17265B]">
        Page Not Found
      </h2>

      <p className="mt-4 max-w-md text-gray-600">
        Sorry, the page you are looking for
        does not exist. Please return to
        the homepage.
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

// ==========================================
// ADMIN DASHBOARD WRAPPER
// ==========================================

function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <AdminDashboard
      user={user}
      onLogout={logout}
    />
  );
}

// ==========================================
// FACTORY MANAGER WRAPPER
// ==========================================

function FactoryManagerPage() {
  const { user, logout } = useAuth();

  return (
    <FactoryManagerDashboard
      user={user}
      onLogout={logout}
    />
  );
}

// ==========================================
// SALES REPRESENTATIVE WRAPPER
// ==========================================

function SalesManagerPage() {
  const { user, logout } = useAuth();

  return (
    <SalesManagerDashboard
      user={user}
      onLogout={logout}
    />
  );
}

// ==========================================
// OUTLET MANAGER WRAPPER
// ==========================================

function OutletManagerPage() {
  const { logout } = useAuth();

  return (
    <OutletManagerOperations
      onLogout={logout}
    />
  );
}

// ==========================================
// DELIVERY VEHICLE SELECTION WRAPPER
// ==========================================

function DeliveryVehicleSelectionPage() {
  const { logout } = useAuth();

  const handleLogout = () => {
    sessionStorage.removeItem(
      "seventeen_delivery_shift"
    );

    sessionStorage.removeItem(
      "seventeen_delivery_vehicle"
    );

    logout();
  };

  return (
    <DeliveryVehicleSelection
      onLogout={handleLogout}
    />
  );
}

// ==========================================
// DELIVERY PERSON DASHBOARD WRAPPER
// ==========================================

function DeliveryPersonPage() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    sessionStorage.removeItem(
      "seventeen_delivery_shift"
    );

    sessionStorage.removeItem(
      "seventeen_delivery_vehicle"
    );

    logout();
  };

  return (
    <DeliveryPersonDashboard
      user={user}
      onLogout={handleLogout}
    />
  );
}

// ==========================================
// DASHBOARD ROUTE DETECTION
// ==========================================

const dashboardPaths = [
  "/wholesale/dashboard",
  "/admin",
  "/factory-manager",
  "/sales/dashboard",
  "/outlet/dashboard",
  "/delivery/select-vehicle",
  "/delivery/dashboard",
];

function isDashboardRoute(pathname) {
  return dashboardPaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );
}

// ==========================================
// MAIN APPLICATION
// ==========================================

export default function App() {
  const location = useLocation();

  const isDashboard = isDashboardRoute(
    location.pathname
  );

  return (
    <div className="min-h-screen bg-[#FFF9F3] print:min-h-0 print:bg-white">

      {/* ====================================
          PUBLIC NAVBAR

          Hidden on dashboard routes.

          Always hidden when printing an
          order confirmation invoice.
      ==================================== */}

      {!isDashboard && (
        <div className="print:hidden">
          <Navbar />
        </div>
      )}

      {/* ====================================
          APPLICATION ROUTES
      ==================================== */}

      <Routes>

        {/* ================================
            PUBLIC HOME PAGE
        ================================ */}

        <Route
          path="/"
          element={<Home />}
        />

        {/* ================================
            SHOP / FLAVOURS
        ================================ */}

        <Route
          path="/flavours"
          element={<Shop />}
        />

        {/* Alternative shop route */}

        <Route
          path="/shop"
          element={<Shop />}
        />

        {/* ================================
            HOW TO ORDER
        ================================ */}

        <Route
          path="/how-to-order"
          element={<HowToOrder />}
        />

        {/* ================================
            ABOUT / OUR STORY
        ================================ */}

        <Route
          path="/our-story"
          element={<About />}
        />

        <Route
          path="/about"
          element={<About />}
        />

        {/* ================================
            PRODUCT DETAILS

            Keep both URLs for compatibility
            with previously created links.
        ================================ */}

        <Route
          path="/product/:id"
          element={<ProductDetails />}
        />

        <Route
          path="/products/:id"
          element={<ProductDetails />}
        />

        {/* ================================
            CART
        ================================ */}

        <Route
          path="/cart"
          element={<Cart />}
        />

        {/* ================================
            CHECKOUT
        ================================ */}

        <Route
          path="/checkout"
          element={<Checkout />}
        />

        {/* ================================
            WHOLESALE INFORMATION
        ================================ */}

        <Route
          path="/wholesale"
          element={<Wholesale />}
        />

        {/* ================================
            WHOLESALE REGISTRATION
        ================================ */}

        <Route
          path="/wholesale/register"
          element={<WholesaleRegister />}
        />

        {/* ================================
            CONTACT
        ================================ */}

        <Route
          path="/contact"
          element={<Contact />}
        />

        {/* ================================
            LOGIN
        ================================ */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* ================================
            WHOLESALE ORDER CONFIRMATION

            Includes Tailwind invoice print
            support through OrderConfirmation.
        ================================ */}

        <Route
          path="/order-confirmation/:orderId"
          element={<OrderConfirmation />}
        />

        {/* ================================
            WHOLESALE CUSTOMER DASHBOARD

            Retains your current route.
            See access-control note below.
        ================================ */}

        <Route
          path="/wholesale/dashboard"
          element={<WholesaleDashboard />}
        />

        {/* ================================
            ADMIN DASHBOARD
        ================================ */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
            />
          }
        >
          <Route
            path="/admin"
            element={<AdminPage />}
          />
        </Route>

        {/* ================================
            FACTORY MANAGER DASHBOARD
        ================================ */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["FACTORY_MANAGER"]}
            />
          }
        >
          <Route
            path="/factory-manager"
            element={<FactoryManagerPage />}
          />
        </Route>

        {/* ================================
            SALES MANAGER DASHBOARD

            Only one sales dashboard route.

            Requires SALES_MANAGER role.
        ================================ */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["SALES_MANAGER"]}
            />
          }
        >
          <Route
            path="/sales/dashboard"
            element={<SalesManagerPage />}
          />
        </Route>

        {/* ================================
            OUTLET MANAGER DASHBOARD
        ================================ */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["OUTLET_MANAGER"]}
            />
          }
        >
          <Route
            path="/outlet/dashboard"
            element={<OutletManagerPage />}
          />

          {/* Database-connected Outlet Manager screen.
              Keep existing dashboard route unchanged. */}
          <Route
            path="/outlet/dashboard/operations"
            element={<OutletManagerOperations />}
          />
        </Route>

        {/* ================================
            DELIVERY PERSON ROUTES

            Vehicle selection and delivery
            dashboard use the same role.
        ================================ */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["DELIVERY_PERSON"]}
            />
          }
        >
          <Route
            path="/delivery/select-vehicle"
            element={
              <DeliveryVehicleSelectionPage />
            }
          />

          <Route
            path="/delivery/dashboard"
            element={<DeliveryPersonPage />}
          />
        </Route>

        {/* ================================
            404 NOT FOUND
        ================================ */}

        <Route
          path="*"
          element={<NotFound />}
        />

      </Routes>

      {/* ====================================
          PUBLIC FOOTER

          Hidden on dashboards.

          Always hidden while printing.
      ==================================== */}

      {!isDashboard && (
        <div className="print:hidden">
          <Footer />
        </div>
      )}

    </div>
  );
}
