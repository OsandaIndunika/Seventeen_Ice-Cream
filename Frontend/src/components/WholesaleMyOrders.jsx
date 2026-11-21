
import React, { useCallback, useEffect, useState } from "react";
import {
  Package,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock3,
  AlertCircle,
} from "lucide-react";

const API = "http://localhost:8080/api/wholesale/orders/my";

function getToken() {
  try {
    const auth = JSON.parse(
      sessionStorage.getItem("seventeen_auth") || "null"
    );
    return auth?.token || auth?.accessToken || null;
  } catch {
    return null;
  }
}

function normalizeOrders(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.content)) return data.content;
  throw new Error("Unexpected order history response.");
}

function displayStatus(value) {
  const status = String(value || "WAITING").toUpperCase();

  if (status === "ASSIGNED") return "PROCESSING";
  if (status === "IN_TRANSIT") return "ON_THE_WAY";

  return status;
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `Rs. ${amount.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";
}

export default function WholesaleMyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (signal) => {
    const jwt = getToken();

    if (!jwt) {
      setError("Please log in to view your orders.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/json",
        },
        signal,
      });

      const text = await response.text();
      let data;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("Invalid JSON returned by backend.");
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          `Order history request failed: ${response.status}`
        );
      }

      const result = normalizeOrders(data);

      if (!signal?.aborted) {
        setOrders(result);
        setError("");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadOrders(controller.signal);

    return () => controller.abort();
  }, [loadOrders]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#17265B]">
            My Orders
          </h2>
          <p className="text-sm text-gray-500">
            Your wholesale order history
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            loadOrders();
          }}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-[#3654FF]"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl bg-red-50 p-4 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="rounded-xl bg-white p-8 text-center">
          Loading your orders...
        </p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-gray-50 p-10 text-center">
          <Package
            size={35}
            className="mx-auto mb-3 text-gray-400"
          />
          <p>No orders found for this account.</p>
        </div>
      ) : (
        orders.map((order) => {
          const id = order.orderId ?? order.id;
          const status = displayStatus(
            order.deliveryStatus ?? order.status
          );
          const items = order.items || [];

          return (
            <div
              key={id}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#17265B]">
                    Order #{id}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString()
                      : "Date unavailable"}
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock3 size={17} />
                  Order placed
                </div>

                <div className="flex items-center gap-2">
                  <Truck size={17} />
                  {order.vehicleNumber || "Vehicle not assigned"}
                </div>

                {status === "DELIVERED" && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 size={17} />
                    Delivered
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">Product</th>
                        <th className="p-3 text-left">Qty</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id ?? index} className="border-t">
                          <td className="p-3">
                            {item.productName || item.productId || "Product"}
                            {item.flavour || item.selectedFlavour
                              ? ` - ${item.flavour || item.selectedFlavour}`
                              : ""}
                          </td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3 text-right">
                            {formatMoney(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 flex justify-between border-t pt-4">
                <span className="font-semibold">Order Total</span>
                <strong className="text-[#3654FF]">
                  {formatMoney(
                    order.finalTotal ??
                    order.totalAmount ??
                    order.total
                  )}
                </strong>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
