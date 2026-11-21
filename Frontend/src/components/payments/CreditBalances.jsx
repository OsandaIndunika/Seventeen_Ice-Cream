
import { useEffect, useState } from "react";

import {
  salesPaymentApi,
} from "../../services/salesPaymentApi";

const money = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(Number(value || 0));

export default function CreditBalances({ orders }) {

  const [balances, setBalances] = useState([]);
  const [error, setError] = useState("");

  const creditOrders = orders.filter(
    (order) =>
      String(order.paymentMethod).toLowerCase() ===
        "credit" &&
      String(order.deliveryStatus).toUpperCase() ===
        "DELIVERED"
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await Promise.all(
          creditOrders.map(async (order) => {
            const summary =
              await salesPaymentApi.summary(
                order.orderId
              );

            return {
              ...order,
              ...summary,
            };
          })
        );

        if (active) {
          setBalances(result);
          setError("");
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [orders]);

  return (
    <section>
      <h2 className="text-2xl font-bold">
        Credit Balances
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Remaining amounts from delivered wholesale
        credit orders.
      </p>

      {error && (
        <p className="mt-4 text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {balances.map((item) => (
          <div
            key={item.orderId}
            className="rounded-xl border bg-white p-5"
          >
            <h3 className="font-bold">
              Order #{item.orderId}
            </h3>

            <p className="mt-1 text-sm">
              {item.shopName}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <p>
                Order Total:{" "}
                {money(item.orderTotal)}
              </p>

              <p>
                Confirmed Paid:{" "}
                {money(item.confirmedPaid)}
              </p>

              <p className="font-bold text-red-600">
                Remaining:{" "}
                {money(item.remainingBalance)}
              </p>
            </div>
          </div>
        ))}

        {balances.length === 0 && (
          <p className="text-sm text-slate-500">
            No delivered credit orders found.
          </p>
        )}
      </div>
    </section>
  );
}
