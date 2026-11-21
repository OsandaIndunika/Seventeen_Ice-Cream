
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8080";

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      try {
        const auth = JSON.parse(
          sessionStorage.getItem("seventeen_auth") ||
            "null"
        );

        const token =
          auth?.token || auth?.accessToken;

        if (!token) {
          throw new Error("Please log in to view orders.");
        }

        const response = await fetch(
          `${API_BASE}/api/wholesale/orders/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load orders (${response.status})`
          );
        }

        const data = await response.json();

        // Expected response: an array of order DTOs.
        // Adapt this if your backend returns a Page object.
        if (!Array.isArray(data)) {
          throw new Error(
            "Unexpected order history response."
          );
        }

        setOrders(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => controller.abort();
  }, []);

  if (loading) {
    return <p className="p-8">Loading your orders...</p>;
  }

  if (error) {
    return (
      <p className="p-8 text-red-600" role="alert">
        {error}
      </p>
    );
  }

  return (
    <main className="space-y-5 p-6">
      <h1 className="text-3xl font-bold text-[#17265B]">
        My Orders
      </h1>

      {orders.length === 0 ? (
        <p>You have not placed any orders yet.</p>
      ) : (
        orders.map((order) => (
          <article
            key={order.orderId}
            className="rounded-2xl border bg-white p-6"
          >
            <div className="flex justify-between gap-4">
              <h2 className="font-bold">
                Order #{order.orderId}
              </h2>

              <span className="font-semibold text-blue-600">
                {order.orderStatus || "PENDING"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {order.shopName || "Wholesale Order"}
            </p>

            <div className="mt-4 space-y-3">
              {(order.items || []).map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between border-b pb-3 text-sm"
                >
                  <span>
                    {item.productName ||
                      item.name ||
                      item.productId}
                    {" – "}
                    {item.selectedFlavour || "Original"}
                  </span>

                  <span>Qty: {item.quantity}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 font-bold text-[#3654FF]">
              Total: Rs.{" "}
              {Number(
                order.totalAmount ?? order.total ?? 0
              ).toFixed(2)}
            </p>
          </article>
        ))
      )}
    </main>
  );
}
