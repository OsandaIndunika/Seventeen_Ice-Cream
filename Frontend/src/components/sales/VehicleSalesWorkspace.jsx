
import {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import {
    Truck,
    Package,
    ClipboardList,
    RefreshCw,
    ArrowRight,
    MapPin,
    Wallet,
    LogOut,
  } from "lucide-react";
  
  import {
    salesVehicleApi,
  } from "../../services/salesVehicleApi";
  
  function price(value) {
    if (value == null || value === "") {
      return "To be confirmed";
    }
  
    const n = Number(value);
  
    if (!Number.isFinite(n)) {
      return "To be confirmed";
    }
  
    return `Rs. ${n.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  function paymentLabel(method) {
    const methods = {
      confirm: "Confirm with Wholesale Team",
      cash: "Cash",
      bank: "Bank Transfer",
      cheque: "Cheque",
      credit: "Credit",
    };
  
    return (
      methods[String(method || "").toLowerCase()] ||
      method ||
      "Not specified"
    );
  }
  
  function directionsUrl(lat, lng) {
    if (
      lat == null ||
      lng == null ||
      lat === "" ||
      lng === ""
    ) {
      return null;
    }
  
    const latitude = Number(lat);
    const longitude = Number(lng);
  
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return null;
    }
  
    return (
      "https://www.google.com/maps/dir/?api=1" +
      `&destination=${encodeURIComponent(
        `${latitude},${longitude}`
      )}`
    );
  }
  
  function PaymentDetails({ order }) {
    const credit =
      String(order.paymentMethod).toLowerCase() ===
      "credit";
  
    const finalTotal =
      order.orderTotal == null ||
      order.orderTotal === ""
        ? null
        : Number(order.orderTotal);
  
    const plannedCash =
      order.creditCashAmount == null
        ? null
        : Number(order.creditCashAmount);
  
    const estimatedCredit =
      credit &&
      finalTotal !== null &&
      Number.isFinite(finalTotal) &&
      plannedCash !== null &&
      Number.isFinite(plannedCash)
        ? Math.max(0, finalTotal - plannedCash)
        : null;
  
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <h4 className="flex items-center gap-2 font-bold">
          <Wallet size={18} />
          Payment Details
        </h4>
  
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <strong>Method:</strong>{" "}
            {paymentLabel(order.paymentMethod)}
          </p>
  
          <p>
            <strong>Order Total:</strong>{" "}
            {price(order.orderTotal)}
          </p>
  
          <p>
            <strong>Payment Status:</strong>{" "}
            {order.paymentStatus || "Unknown"}
          </p>
  
          {credit && (
            <>
              <p>
                <strong>Planned Cash:</strong>{" "}
                {price(order.creditCashAmount)}
              </p>
  
              <p>
                <strong>Requested Credit:</strong>{" "}
                {price(estimatedCredit)}
              </p>
  
              <p>
                <strong>Credit Approval:</strong>{" "}
                {order.creditApprovalStatus ||
                  "PENDING"}
              </p>
            </>
          )}
        </div>
  
        <p className="mt-3 text-xs text-slate-500">
          Planned cash is not a received payment.
          Actual collections must be recorded and
          verified separately.
        </p>
      </div>
    );
  }
  
  function Inventory({ items }) {
    const totalPhysical = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );
  
    const totalReserved = items.reduce(
      (sum, item) =>
        sum + Number(item.reservedQuantity || 0),
      0
    );
  
    return (
      <div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Physical Stock", totalPhysical],
            ["Reserved", totalReserved],
            [
              "Available",
              totalPhysical - totalReserved,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {label}
              </p>
  
              <p className="mt-2 text-2xl font-bold">
                {value} units
              </p>
            </div>
          ))}
        </div>
  
        <h2 className="mt-8 text-xl font-bold">
          Lorry Inventory
        </h2>
  
        {items.length === 0 && (
          <p className="mt-5 rounded-xl bg-white p-5 text-slate-500">
            No stock records found for this vehicle.
          </p>
        )}
  
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-bold uppercase text-slate-400">
                {item.productName}{" "}
                {item.size ? `(${item.size})` : ""}
              </p>
  
              <h3 className="mt-2 font-semibold text-[#17265B]">
                {item.flavour}
              </h3>
  
              <p className="mt-3 text-xl font-bold">
                {item.availableQuantity} available
              </p>
  
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>
                  Physical: {item.quantity}
                </span>
  
                <span>
                  Reserved: {item.reservedQuantity}
                </span>
              </div>
  
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#3654FF]"
                  style={{
                    width:
                      item.quantity > 0
                        ? `${Math.max(
                            0,
                            Math.min(
                              100,
                              100 *
                                item.availableQuantity /
                                item.quantity
                            )
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  function Orders({ orders }) {
    const active = orders.filter(
      (order) =>
        String(order.deliveryStatus).toUpperCase() !==
        "DELIVERED"
    );
  
    const completed = orders.filter(
      (order) =>
        String(order.deliveryStatus).toUpperCase() ===
        "DELIVERED"
    );
  
    function renderOrder(order) {
      const mapUrl = directionsUrl(
        order.latitude,
        order.longitude
      );
  
      return (
        <div
          key={order.orderId}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">
                Order #{order.orderId}
              </h3>
  
              <p className="mt-1 text-slate-600">
                {order.shopName}
              </p>
            </div>
  
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {order.deliveryStatus}
            </span>
          </div>
  
          <div className="mt-5 space-y-2 text-sm">
            <p>
              <strong>Phone:</strong>{" "}
              {order.phone || "Not provided"}
            </p>
  
            <p>
              <strong>Address:</strong>{" "}
              {order.address || "Not provided"}
            </p>
  
            {order.deliveryInstructions && (
              <p>
                <strong>Instructions:</strong>{" "}
                {order.deliveryInstructions}
              </p>
            )}
          </div>
  
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <h4 className="font-bold">
              Ordered Products
            </h4>
  
            <div className="mt-3 space-y-2">
              {(order.items || []).map(
                (item, index) => (
                  <div
                    key={`${item.productId}-${item.flavour}-${index}`}
                    className="flex justify-between gap-3 border-b border-slate-200 py-2 text-sm last:border-0"
                  >
                    <span>
                      {item.productName ||
                        item.productId}
                      {item.size
                        ? ` (${item.size})`
                        : ""}{" "}
                      — {item.flavour}
                    </span>
  
                    <strong>
                      {item.quantity} units
                    </strong>
                  </div>
                )
              )}
            </div>
          </div>
  
          <div className="mt-5">
            <PaymentDetails order={order} />
          </div>
  
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3654FF] px-4 py-3 text-sm font-semibold text-white"
            >
              <MapPin size={17} />
              Show Delivery Route
            </a>
          )}
        </div>
      );
    }
  
    return (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold">
            Active Wholesale Orders ({active.length})
          </h2>
  
          <div className="mt-4 space-y-4">
            {active.map(renderOrder)}
  
            {active.length === 0 && (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                No active wholesale deliveries.
              </p>
            )}
          </div>
        </section>
  
        <section>
          <h2 className="text-xl font-bold">
            Delivered Order History ({completed.length})
          </h2>
  
          <div className="mt-4 space-y-4">
            {completed.map(renderOrder)}
  
            {completed.length === 0 && (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
                No completed orders yet.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }
  
  export default function VehicleSalesWorkspace() {
    const [session, setSession] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [orders, setOrders] = useState([]);
  
    const [tab, setTab] = useState("orders");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
  
    const vehicleId = session?.active
      ? Number(session.vehicleId)
      : null;
  
    // Load any existing session after login.
    useEffect(() => {
      let mounted = true;
  
      async function initialize() {
        try {
          const current =
            await salesVehicleApi.currentSession();
  
          if (!mounted) return;
  
          setSession(current);
  
          if (!current.active) {
            const list =
              await salesVehicleApi.getVehicles();
  
            if (mounted) setVehicles(list);
          }
        } catch (err) {
          if (mounted) setError(err.message);
        } finally {
          if (mounted) setLoading(false);
        }
      }
  
      initialize();
  
      return () => {
        mounted = false;
      };
    }, []);
  
    const refresh = useCallback(async () => {
      if (!vehicleId) return;
  
      try {
        const [stock, assigned] =
          await Promise.all([
            salesVehicleApi.getInventory(vehicleId),
            salesVehicleApi.getOrders(vehicleId),
          ]);
  
        setInventory(stock);
        setOrders(assigned);
        setError("");
      } catch (err) {
        setError(err.message);
      }
    }, [vehicleId]);
  
    useEffect(() => {
      if (!vehicleId) return;
  
      refresh();
  
      const timer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          refresh();
        }
      }, 15000);
  
      return () => window.clearInterval(timer);
    }, [vehicleId, refresh]);
  
    async function selectVehicle(id) {
      if (busy) return;
  
      setBusy(true);
      setError("");
  
      try {
        const selected =
          await salesVehicleApi.selectVehicle(id);
  
        setSession(selected);
        setTab("orders");
      } catch (err) {
        setError(err.message);
  
        try {
          setVehicles(
            await salesVehicleApi.getVehicles()
          );
        } catch {
          // Keep the original error.
        }
      } finally {
        setBusy(false);
      }
    }
  
    async function endSession() {
      if (busy) return;
  
      setBusy(true);
      setError("");
  
      try {
        await salesVehicleApi.endSession();
  
        setSession({ active: false });
        setInventory([]);
        setOrders([]);
  
        setVehicles(
          await salesVehicleApi.getVehicles()
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }
  
    if (loading) {
      return (
        <p className="p-8 text-center text-[#3654FF]">
          Loading vehicle information...
        </p>
      );
    }
  
    return (
      <div className="space-y-6 text-[#17265B]">
  
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}
  
        {!session?.active ? (
          <>
            <div>
              <h2 className="text-2xl font-bold">
                Select Delivery Vehicle
              </h2>
  
              <p className="mt-2 text-sm text-slate-500">
                Select the vehicle whose stock and
                wholesale orders you will manage.
              </p>
            </div>
  
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.map((vehicle) => {
                const disabled =
                  busy ||
                  (vehicle.occupied &&
                    !vehicle.selectedByMe);
  
                return (
                  <div
                    key={vehicle.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <Truck
                      size={30}
                      className="text-[#3654FF]"
                    />
  
                    <h3 className="mt-4 text-lg font-bold">
                      {vehicle.vehicleNumber}
                    </h3>
  
                    <p className="mt-2 text-sm text-slate-500">
                      Status: {vehicle.status}
                    </p>
  
                    <p className="mt-2 text-xs text-slate-500">
                      {vehicle.selectedByMe
                        ? "Selected by your account"
                        : vehicle.occupied
                          ? "Selected by another representative"
                          : "Available"}
                    </p>
  
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        selectVehicle(vehicle.id)
                      }
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 font-bold text-white disabled:opacity-40"
                    >
                      Select Vehicle
                      <ArrowRight size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs text-slate-500">
                  Selected Vehicle
                </p>
  
                <h2 className="mt-1 text-2xl font-bold">
                  {session.vehicleNumber}
                </h2>
              </div>
  
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"
                >
                  <RefreshCw size={17} />
                  Refresh
                </button>
  
                <button
                  type="button"
                  disabled={busy}
                  onClick={endSession}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 disabled:opacity-50"
                >
                  <LogOut size={17} />
                  End Vehicle Session
                </button>
              </div>
            </div>
  
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTab("orders")}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${
                  tab === "orders"
                    ? "bg-[#3654FF] text-white"
                    : "bg-white"
                }`}
              >
                <ClipboardList size={18} />
                Wholesale Orders ({orders.length})
              </button>
  
              <button
                type="button"
                onClick={() => setTab("stock")}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${
                  tab === "stock"
                    ? "bg-[#3654FF] text-white"
                    : "bg-white"
                }`}
              >
                <Package size={18} />
                Lorry Inventory
              </button>
            </div>
  
            {tab === "orders" ? (
              <Orders orders={orders} />
            ) : (
              <Inventory items={inventory} />
            )}
          </>
        )}
      </div>
    );
  }
  