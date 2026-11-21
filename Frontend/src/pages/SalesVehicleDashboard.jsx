
import {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import {
    Link,
    useNavigate,
  } from "react-router-dom";
  
  import {
    Truck,
    Package,
    ClipboardList,
    RefreshCw,
    LogOut,
    MapPin,
    Wallet,
    ArrowRight,
  } from "lucide-react";
  
  import {
    salesVehicleApi,
  } from "../services/salesVehicleApi";
  
  // ==========================================
  // HELPERS
  // ==========================================
  
  function money(value) {
    const amount = Number(value ?? 0);
  
    return `Rs. ${(
      Number.isFinite(amount) ? amount : 0
    ).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  function mapsUrl(latitude, longitude) {
    if (
      latitude == null ||
      longitude == null ||
      latitude === "" ||
      longitude === ""
    ) {
      return "";
    }
  
    const lat = Number(latitude);
    const lng = Number(longitude);
  
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return "";
    }
  
    return (
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(`${lat},${lng}`)
    );
  }
  
  function labelPayment(method) {
    const labels = {
      cash: "Cash Payment",
      bank: "Bank Transfer",
      cheque: "Cheque Payment",
      credit: "Credit Payment",
    };
  
    return (
      labels[String(method || "").toLowerCase()] ||
      method ||
      "Not specified"
    );
  }
  
  // ==========================================
  // VEHICLE SELECTOR
  // ==========================================
  
  function VehicleSelector({
    vehicles,
    loading,
    onSelect,
  }) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16">
  
        <div className="text-center">
          <Truck
            size={46}
            className="mx-auto text-[#3654FF]"
          />
  
          <h1 className="mt-5 text-3xl font-bold text-[#17265B]">
            Select Your Delivery Vehicle
          </h1>
  
          <p className="mt-3 text-sm text-slate-500">
            Select the vehicle you are operating
            for this sales session.
          </p>
        </div>
  
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
  
          {vehicles.map((vehicle) => {
            const occupied =
              vehicle.selectedBy != null;
  
            return (
              <div
                key={vehicle.id}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#3654FF]">
                  <Truck size={28} />
                </div>
  
                <h2 className="mt-5 text-xl font-bold text-[#17265B]">
                  {vehicle.vehicleNumber}
                </h2>
  
                <p className="mt-2 text-sm text-slate-500">
                  Vehicle status: {vehicle.status || "Unknown"}
                </p>
  
                <p className="mt-2 text-sm">
                  {occupied
                    ? "Vehicle already selected by a representative"
                    : "Vehicle available for selection"}
                </p>
  
                <button
                  type="button"
                  disabled={loading || occupied}
                  onClick={() => onSelect(vehicle.id)}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Select Vehicle
                  <ArrowRight size={18} />
                </button>
  
              </div>
            );
          })}
  
        </div>
  
        {vehicles.length === 0 && (
          <p className="mt-8 text-center text-slate-500">
            No delivery vehicles were found.
          </p>
        )}
      </div>
    );
  }
  
  // ==========================================
  // INVENTORY
  // ==========================================
  
  function InventoryPanel({ inventory }) {
    const totalPhysical = inventory.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );
  
    const totalReserved = inventory.reduce(
      (sum, item) =>
        sum + Number(item.reservedQuantity || 0),
      0
    );
  
    return (
      <div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
  
          <SummaryCard
            label="Physical Stock"
            value={totalPhysical}
            icon={Package}
          />
  
          <SummaryCard
            label="Reserved Units"
            value={totalReserved}
            icon={ClipboardList}
          />
  
          <SummaryCard
            label="Available Units"
            value={totalPhysical - totalReserved}
            icon={Package}
          />
  
        </div>
  
        <h2 className="mb-5 text-2xl font-bold text-[#17265B]">
          Lorry Inventory
        </h2>
  
        <div className="grid gap-4 md:grid-cols-2">
  
          {inventory.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {item.flavour} — {item.productName}
                {item.size ? ` (${item.size})` : ""}
              </p>
  
              <p className="mt-3 text-lg font-bold text-[#17265B]">
                {item.quantity} units
              </p>
  
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>
                  Reserved: {item.reservedQuantity}
                </span>
  
                <span>
                  Available: {item.availableQuantity}
                </span>
              </div>
  
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
  
                <div
                  className="h-full rounded-full bg-[#3654FF]"
                  style={{
                    width: `${
                      item.quantity > 0
                        ? Math.min(
                            100,
                            (item.availableQuantity /
                              item.quantity) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
  
              </div>
  
              <p className="mt-3 text-xs text-slate-500">
                Unit price: {money(item.unitPrice)}
              </p>
  
            </div>
          ))}
  
        </div>
  
        {inventory.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-slate-500">
            No stock has been added to this vehicle yet.
          </p>
        )}
      </div>
    );
  }
  
  // ==========================================
  // WHOLESALE ORDERS
  // ==========================================
  
  function WholesaleOrdersPanel({ orders }) {
    return (
      <div>
  
        <h2 className="mb-2 text-2xl font-bold text-[#17265B]">
          Wholesale Delivery Orders
        </h2>
  
        <p className="mb-6 text-sm text-slate-500">
          Orders claimed by the delivery person
          for your selected vehicle.
        </p>
  
        <div className="space-y-5">
  
          {orders.map((order) => {
            const paymentMethod =
              String(order.paymentMethod || "")
                .toLowerCase();
  
            const total = Number(
              order.orderTotal || 0
            );
  
            const plannedCash = Number(
              order.creditCashAmount || 0
            );
  
            const requestedCredit =
              Math.max(0, total - plannedCash);
  
            const route = mapsUrl(
              order.latitude,
              order.longitude
            );
  
            return (
              <div
                key={order.orderId}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
  
                <div className="flex flex-wrap items-center justify-between gap-3">
  
                  <div>
                    <h3 className="text-lg font-bold text-[#17265B]">
                      Order #{order.orderId}
                    </h3>
  
                    <p className="mt-1 text-sm text-slate-500">
                      {order.shopName}
                    </p>
                  </div>
  
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {order.deliveryStatus}
                  </span>
  
                </div>
  
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
  
                  <div>
                    <span className="text-slate-500">
                      Phone:
                    </span>{" "}
                    {order.phone || "Not provided"}
                  </div>
  
                  <div>
                    <span className="text-slate-500">
                      Payment:
                    </span>{" "}
                    {labelPayment(order.paymentMethod)}
                  </div>
  
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">
                      Address:
                    </span>{" "}
                    {order.address || "Not provided"}
                  </div>
  
                </div>
  
                {/* ORDER ITEMS */}
  
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
  
                  <p className="mb-3 text-sm font-bold">
                    Ordered Products
                  </p>
  
                  {(order.items || []).map((item, index) => (
                    <div
                      key={`${item.productId}-${item.flavour}-${index}`}
                      className="flex justify-between gap-3 border-b border-slate-200 py-2 text-sm last:border-b-0"
                    >
  
                      <span>
                        {item.flavour}{" "}
                        {item.productName || item.productId}
                      </span>
  
                      <strong>
                        {item.quantity} units
                      </strong>
  
                    </div>
                  ))}
  
                </div>
  
                {/* PAYMENT SUMMARY */}
  
                <div className="mt-5 space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
  
                  <div className="flex justify-between gap-3 text-sm">
                    <span>Order Total</span>
  
                    <strong>{money(total)}</strong>
                  </div>
  
                  <div className="flex justify-between gap-3 text-sm">
                    <span>Payment Method</span>
  
                    <strong>
                      {labelPayment(order.paymentMethod)}
                    </strong>
                  </div>
  
                  {paymentMethod === "credit" && (
                    <>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          Planned Cash Payment
                        </span>
  
                        <strong className="text-green-700">
                          {money(plannedCash)}
                        </strong>
                      </div>
  
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          Requested Credit Balance
                        </span>
  
                        <strong className="text-[#3654FF]">
                          {money(requestedCredit)}
                        </strong>
                      </div>
  
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          Credit Approval
                        </span>
  
                        <strong>
                          {order.creditApprovalStatus || "PENDING"}
                        </strong>
                      </div>
                    </>
                  )}
  
                  <div className="flex justify-between gap-3 text-sm">
                    <span>Payment Status</span>
  
                    <strong>
                      {order.paymentStatus || "PENDING"}
                    </strong>
                  </div>
  
                </div>
  
                <p className="mt-3 text-xs text-slate-500">
                  Planned cash is not a confirmed
                  collection. Record actual payments
                  through a separate authorized workflow.
                </p>
  
                {route && (
                  <a
                    href={route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-semibold text-white"
                  >
                    <MapPin size={17} />
                    Show Delivery Route
                  </a>
                )}
  
              </div>
            );
          })}
  
          {orders.length === 0 && (
            <div className="rounded-xl bg-white p-8 text-center text-slate-500">
              No wholesale orders are currently
              associated with this vehicle.
            </div>
          )}
  
        </div>
      </div>
    );
  }
  
  // ==========================================
  // SUMMARY CARD
  // ==========================================
  
  function SummaryCard({
    label,
    value,
    icon: Icon,
  }) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-sm">
  
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {label}
          </p>
  
          <Icon
            size={21}
            className="text-[#3654FF]"
          />
        </div>
  
        <p className="mt-3 text-2xl font-bold text-[#17265B]">
          {value}
        </p>
  
      </div>
    );
  }
  
  // ==========================================
  // MAIN DASHBOARD
  // ==========================================
  
  export default function SalesVehicleDashboard() {
    const navigate = useNavigate();
  
    const [session, setSession] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [orders, setOrders] = useState([]);
  
    const [tab, setTab] = useState("orders");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
  
    const vehicleId = session?.active
      ? session.vehicleId
      : null;
  
    // ========================================
    // AUTHENTICATION / INITIAL LOADING
    // ========================================
  
    useEffect(() => {
      let active = true;
  
      async function initialize() {
        try {
          const current =
            await salesVehicleApi.getCurrentSession();
  
          if (!active) return;
  
          if (current.active) {
            setSession(current);
          } else {
            const list =
              await salesVehicleApi.getVehicles();
  
            if (!active) return;
  
            setSession({ active: false });
            setVehicles(list);
          }
  
        } catch (err) {
          if (active) {
            setError(err.message);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
  
      initialize();
  
      return () => {
        active = false;
      };
    }, []);
  
    // ========================================
    // LOAD VEHICLE DATA
    // ========================================
  
    const refreshData = useCallback(
      async (showLoading = true) => {
        if (!vehicleId) return;
  
        if (showLoading) {
          setRefreshing(true);
        }
  
        try {
          const [stockData, orderData] =
            await Promise.all([
              salesVehicleApi.getInventory(vehicleId),
              salesVehicleApi.getOrders(vehicleId),
            ]);
  
          setInventory(stockData);
          setOrders(orderData);
          setError("");
  
        } catch (err) {
          setError(err.message);
  
        } finally {
          if (showLoading) {
            setRefreshing(false);
          }
        }
      },
      [vehicleId]
    );
  
    useEffect(() => {
      if (!vehicleId) return;
  
      refreshData();
  
      const interval = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          refreshData(false);
        }
      }, 15000);
  
      return () => window.clearInterval(interval);
    }, [vehicleId, refreshData]);
  
    // ========================================
    // SELECT VEHICLE
    // ========================================
  
    async function selectVehicle(id) {
      setBusy(true);
      setError("");
  
      try {
        const current =
          await salesVehicleApi.selectVehicle(id);
  
        setSession(current);
        setTab("orders");
  
      } catch (err) {
        setError(err.message);
  
        const latest =
          await salesVehicleApi.getVehicles()
            .catch(() => null);
  
        if (latest) {
          setVehicles(latest);
        }
  
      } finally {
        setBusy(false);
      }
    }
  
    // ========================================
    // END VEHICLE SESSION
    // ========================================
  
    async function endVehicleSession() {
      setBusy(true);
      setError("");
  
      try {
        await salesVehicleApi.endSession();
  
        setSession({ active: false });
        setInventory([]);
        setOrders([]);
  
        const list =
          await salesVehicleApi.getVehicles();
  
        setVehicles(list);
  
      } catch (err) {
        setError(err.message);
  
      } finally {
        setBusy(false);
      }
    }
  
    // ========================================
    // LOADING SCREEN
    // ========================================
  
    if (loading) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <p className="text-lg font-semibold text-[#3654FF]">
            Loading Sales Dashboard...
          </p>
        </main>
      );
    }
  
    // ========================================
    // VEHICLE SELECTION PAGE
    // ========================================
  
    if (!session?.active) {
      return (
        <main className="min-h-screen bg-[#F5F7FB]">
  
          <header className="bg-[#82DADA] px-6 py-5">
            <h1 className="text-2xl font-bold text-[#17265B]">
              FrostyDelights
            </h1>
          </header>
  
          {error && (
            <div className="mx-auto mt-5 max-w-4xl px-5">
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            </div>
          )}
  
          <VehicleSelector
            vehicles={vehicles}
            loading={busy}
            onSelect={selectVehicle}
          />
  
        </main>
      );
    }
  
    // ========================================
    // SELECTED VEHICLE DASHBOARD
    // ========================================
  
    return (
      <main className="min-h-screen bg-[#F5F7FB] text-[#17265B]">
  
        <header className="flex flex-wrap items-center justify-between gap-4 bg-[#82DADA] px-6 py-5">
  
          <div>
            <h1 className="text-2xl font-bold">
              FrostyDelights
            </h1>
  
            <p className="mt-1 text-sm">
              Sales Representative Dashboard
            </p>
          </div>
  
          <div className="flex flex-wrap items-center gap-3">
  
            <div className="rounded-xl bg-white/70 px-4 py-2">
              <p className="text-xs text-slate-500">
                Selected Vehicle
              </p>
  
              <p className="font-bold">
                {session.vehicleNumber}
              </p>
            </div>
  
            <button
              type="button"
              disabled={busy}
              onClick={endVehicleSession}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#17265B] disabled:opacity-50"
            >
              <LogOut size={17} />
              End Vehicle Session
            </button>
  
          </div>
  
        </header>
  
        <div className="mx-auto max-w-7xl px-5 py-8">
  
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
  
            <div>
              <h2 className="text-2xl font-bold">
                Vehicle Operations
              </h2>
  
              <p className="mt-1 text-sm text-slate-500">
                Inventory and wholesale orders for{" "}
                {session.vehicleNumber}
              </p>
            </div>
  
            <button
              type="button"
              onClick={() => refreshData()}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <RefreshCw size={17} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
  
          </div>
  
          {error && (
            <p
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
  
          {/* TABS */}
  
          <div className="mb-8 flex flex-wrap gap-3">
  
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold ${
                tab === "orders"
                  ? "bg-[#3654FF] text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <ClipboardList size={18} />
              Wholesale Orders ({orders.length})
            </button>
  
            <button
              type="button"
              onClick={() => setTab("inventory")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold ${
                tab === "inventory"
                  ? "bg-[#3654FF] text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <Package size={18} />
              Lorry Inventory
            </button>
  
          </div>
  
          {tab === "orders" && (
            <WholesaleOrdersPanel orders={orders} />
          )}
  
          {tab === "inventory" && (
            <InventoryPanel inventory={inventory} />
          )}
  
          <div className="mt-10 border-t border-slate-200 pt-5">
            <Link
              to="/"
              className="text-sm font-semibold text-[#3654FF]"
            >
              Return to Home
            </Link>
          </div>
  
        </div>
  
      </main>
    );
  }
  