
import { useCallback, useEffect, useState } from "react";

import {
  wholesalePaymentApi,
} from "../../services/salesPaymentApi";

const money = (value) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(Number(value || 0));

export default function WholesaleCustomerPayments({
  orderId,
}) {
  const [summary, setSummary] = useState(null);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [receiptKey, setReceiptKey] = useState(
    () => crypto.randomUUID()
  );

  const load = useCallback(async () => {
    try {
      const result =
        await wholesalePaymentApi.summary(orderId);

      setSummary(result);
    } catch (err) {
      setError(err.message);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadSlip() {
    setBusy(true);
    setError("");

    try {
      await wholesalePaymentApi.uploadBankSlip(
        orderId,
        Number(amount),
        file,
        receiptKey
      );

      setAmount("");
      setFile(null);
      setReceiptKey(crypto.randomUUID());

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const checkoutMethod = String(
    summary?.checkoutMethod || ""
  ).toLowerCase();

  // If your backend summary returns only totals,
  // return checkoutMethod and plannedCash as well.
  return (
    <section className="rounded-xl border bg-white p-5">

      <h3 className="text-lg font-bold">
        Order #{orderId} — Payments
      </h3>

      {summary && (
        <>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Order Total:{" "}
              {money(summary.orderTotal)}
            </p>

            <p>
              Confirmed Paid:{" "}
              {money(summary.confirmedPaid)}
            </p>

            <p className="font-bold">
              Remaining Balance:{" "}
              {money(summary.remainingBalance)}
            </p>
          </div>

          {checkoutMethod === "bank" && (
            <div className="mt-5 space-y-3">
              <h4 className="font-semibold">
                Upload Bank Transfer Slip
              </h4>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                placeholder="Transferred amount"
                className="w-full rounded-lg border p-3"
              />

              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) =>
                  setFile(e.target.files?.[0] || null)
                }
              />

              <button
                type="button"
                disabled={
                  busy ||
                  !file ||
                  Number(amount) <= 0
                }
                onClick={uploadSlip}
                className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50"
              >
                Upload Bank Receipt
              </button>
            </div>
          )}

          <h4 className="mt-6 font-bold">
            Payment History
          </h4>

          {(summary.receipts || []).map(
            (receipt) => (
              <div
                key={receipt.id}
                className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"
              >
                <p>
                  {receipt.method} —{" "}
                  {money(receipt.amount)}
                </p>

                <p className="text-xs text-slate-500">
                  {receipt.status}
                </p>
              </div>
            )
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
