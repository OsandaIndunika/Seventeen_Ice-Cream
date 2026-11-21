import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReceiptText,
  Wallet,
  Package,
  ArrowRightLeft,
  RefreshCw,
  ChartNoAxesCombined,
} from "lucide-react";

// This component uses the SAME outlet POS endpoints and auth storage as before.
const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#3654FF]";
const buttonClass =
  "rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";

function money(value) {
  return (
    "LKR " +
    Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function getToken() {
  try {
    const auth = JSON.parse(
      sessionStorage.getItem("seventeen_auth") || "null"
    );
    return (
      auth?.token ||
      auth?.accessToken ||
      auth?.jwt ||
      auth?.user?.token ||
      null
    );
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("Please sign in again as Outlet Manager.");
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/outlet/pos${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot connect to the Spring Boot server.");
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (response.status === 401) {
    throw new Error("Your login session has expired. Please sign in again.");
  }
  if (response.status === 403) {
    throw new Error("Your account cannot access Outlet Manager POS.");
  }
  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );
  }
  return data;
}

export default function OutletManagerOperations() {
  const [tab, setTab] = useState("Billing");
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedStockId, setSelectedStockId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cart, setCart] = useState([]);
  const [transferStockId, setTransferStockId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const receiptKeyRef = useRef(crypto.randomUUID());
  const pendingSaleRef = useRef(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [productData, inventoryData, reportData] = await Promise.all([
        api("/products"),
        api("/inventory"),
        api("/daily-report"),
      ]);
      if (!Array.isArray(productData) || !Array.isArray(inventoryData)) {
        throw new Error("Invalid inventory response from the backend.");
      }
      setProducts(productData);
      setInventory(inventoryData);
      setReport(reportData);
      setError("");
      return true;
    } catch (err) {
      setError(err.message || "Unable to load outlet data.");
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedProduct = products.find(
    (product) => String(product.stockId) === selectedStockId
  );
  const freezer1 = inventory.filter((item) => item.freezerCode === "FREEZER_1");
  const freezer2 = inventory.filter((item) => item.freezerCode === "FREEZER_2");
  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total + Number(item.unitPrice) * Number(item.quantity),
        0
      ),
    [cart]
  );

  function addToCart(event) {
    event.preventDefault();
    setError("");
    if (pendingSaleRef.current) {
      setError("Check the previous bill before modifying the order.");
      return;
    }
    if (!selectedProduct) {
      setError("Select a product from Defreezer 1.");
      return;
    }
    const count = Number(quantity);
    const existing = cart.find(
      (item) => String(item.stockId) === String(selectedProduct.stockId)
    );
    const alreadyAdded = Number(existing?.quantity || 0);
    if (
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      alreadyAdded + count > Number(selectedProduct.availableQuantity)
    ) {
      setError("Quantity exceeds the available Defreezer 1 stock.");
      return;
    }
    setCart((current) => {
      if (existing) {
        return current.map((item) =>
          String(item.stockId) === String(selectedProduct.stockId)
            ? { ...item, quantity: item.quantity + count }
            : item
        );
      }
      return [
        ...current,
        {
          stockId: selectedProduct.stockId,
          productName: selectedProduct.productName,
          flavour: selectedProduct.flavour,
          quantity: count,
          unitPrice: Number(selectedProduct.unitPrice),
        },
      ];
    });
    setQuantity("1");
  }

  async function completeSale() {
    if (savingRef.current || cart.length === 0) return;
    const payload = {
      receiptKey: receiptKeyRef.current,
      // CASH IS THE ONLY ALLOWED OUTLET PAYMENT METHOD.
      paymentMethod: "CASH",
      items: cart.map((item) => ({
        stockId: item.stockId,
        quantity: item.quantity,
      })),
    };
    const serialized = JSON.stringify(payload);
    if (pendingSaleRef.current && pendingSaleRef.current !== serialized) {
      setError("The previous checkout has an uncertain result. Check Recent Sales first.");
      return;
    }
    if (!window.confirm(`Complete CASH retail sale for ${money(cartTotal)}?`)) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    pendingSaleRef.current = serialized;
    try {
      const result = await api("/sales", {
        method: "POST",
        body: serialized,
      });
      setMessage(
        `Cash bill #${result.saleId} saved. ${money(result.totalAmount)} collected. Defreezer 1 stock deducted.`
      );
      setCart([]);
      setSelectedStockId("");
      setQuantity("1");
      pendingSaleRef.current = null;
      receiptKeyRef.current = crypto.randomUUID();
      await load();
    } catch (err) {
      setError(`${err.message} Check Recent Sales before retrying.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function transferStock(event) {
    event.preventDefault();
    if (savingRef.current) return;
    const count = Number(transferQuantity);
    const stock = freezer2.find(
      (item) => String(item.stockId) === String(transferStockId)
    );
    if (
      !stock ||
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      count > Number(stock.quantity)
    ) {
      setError("Enter a valid Defreezer 2 stock quantity.");
      return;
    }
    if (
      !window.confirm(
        `Transfer ${count} units of ${stock.productName} (${stock.flavour}) from Defreezer 2 to Defreezer 1?`
      )
    ) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await api("/transfers", {
        method: "POST",
        body: JSON.stringify({
          sourceStockId: Number(transferStockId),
          quantity: count,
        }),
      });
      setMessage("Stock transferred to Defreezer 1.");
      setTransferStockId("");
      setTransferQuantity("1");
      await load();
    } catch (err) {
      setError(`${err.message} Check stock balances before retrying.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function stockTable(rows) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Flavour</th>
              <th className="p-4 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stockId} className="border-t border-slate-100">
                <td className="p-4 font-semibold">
                  {row.productName}{row.size ? ` (${row.size})` : ""}
                </td>
                <td className="p-4">{row.flavour}</td>
                <td className="p-4 text-right font-bold">{row.quantity}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-slate-500">
                  No inventory recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="space-y-6 text-[#17265B]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outlet Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Retail billing, Defreezer stock and daily cash
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={saving || refreshing}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Today's Retail Sales", value: money(report?.todaySales), Icon: ReceiptText },
          { label: "Today's Cash", value: money(report?.todayCash), Icon: Wallet },
          { label: "Total Bills Today", value: report?.totalBills ?? 0, Icon: ChartNoAxesCombined },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Icon size={18} />{label}
            </div>
            <p className="mt-3 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {["Billing", "Inventory", "Daily Reports"].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={
              "rounded-xl px-5 py-3 text-sm font-bold " +
              (tab === name ? "bg-[#3654FF] text-white" : "bg-white text-[#17265B]")
            }
          >
            {name}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}
      {loading && <p className="text-sm text-slate-500">Loading outlet information...</p>}

      {tab === "Billing" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={addToCart} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Retail POS & Billing</h2>
            <p className="text-sm text-slate-500">
              Only Defreezer 1 stock can be sold. Retail prices come from PostgreSQL.
            </p>
            <label className="block text-sm font-semibold" htmlFor="retail-product">Select Product</label>
            <select
              id="retail-product"
              value={selectedStockId}
              onChange={(event) => setSelectedStockId(event.target.value)}
              className={inputClass}
              required
              disabled={saving || !!pendingSaleRef.current}
            >
              <option value="">Select product</option>
              {products.map((item) => (
                <option key={item.stockId} value={item.stockId}>
                  {item.productName} - {item.flavour} — {item.availableQuantity} available
                </option>
              ))}
            </select>
            <label className="block text-sm font-semibold" htmlFor="retail-quantity">Quantity</label>
            <input
              id="retail-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={inputClass}
              required
              disabled={saving || !!pendingSaleRef.current}
            />
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              Retail Unit Price: <strong>{money(selectedProduct?.unitPrice)}</strong>
            </div>
            <button
              type="submit"
              disabled={saving || !!pendingSaleRef.current}
              className={`${buttonClass} w-full`}
            >
              Add to Current Order
            </button>
          </form>

          <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Current Order</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-slate-500">No products added yet.</p>
            ) : (
              cart.map((item) => (
                <div key={item.stockId} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{item.productName} - {item.flavour}</p>
                    <p className="text-slate-500">{item.quantity} × {money(item.unitPrice)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={saving || !!pendingSaleRef.current}
                    onClick={() =>
                      setCart((previous) => previous.filter((x) => x.stockId !== item.stockId))
                    }
                    className="text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
            <div className="flex justify-between rounded-xl bg-blue-50 p-4 font-bold">
              <span>Total Amount</span>
              <span>{money(cartTotal)}</span>
            </div>

            {/* CASH IS THE ONLY PAYMENT METHOD. */}
            <p className="text-sm font-semibold">Payment Method</p>
            <div className="rounded-xl border border-green-400 bg-green-100 px-4 py-3 text-center text-sm font-bold text-green-800">
              CASH
            </div>
            <p className="text-xs text-slate-500">
              Outlet retail payments are accepted in cash only.
            </p>

            <button
              type="button"
              disabled={saving || cart.length === 0}
              onClick={completeSale}
              className={`${buttonClass} w-full`}
            >
              {saving ? "Processing..." : "Complete Cash Sale"}
            </button>
            <button
              type="button"
              disabled={saving || !!pendingSaleRef.current}
              onClick={() => setCart([])}
              className="w-full rounded-xl border border-red-200 p-3 text-sm font-semibold text-red-600"
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}

      {tab === "Inventory" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2"><Package size={20} /><h2 className="text-xl font-bold">Defreezer 1 — Selling Stock</h2></div>
            {stockTable(freezer1)}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2"><Package size={20} /><h2 className="text-xl font-bold">Defreezer 2 — Backroom Stock</h2></div>
            {stockTable(freezer2)}
            <form onSubmit={transferStock} className="mt-6 space-y-4 border-t border-slate-200 pt-5">
              <h3 className="flex items-center gap-2 font-bold"><ArrowRightLeft size={18} />Transfer to Defreezer 1</h3>
              <select
                value={transferStockId}
                onChange={(event) => setTransferStockId(event.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Defreezer 2 product</option>
                {freezer2.filter((item) => Number(item.quantity) > 0).map((item) => (
                  <option key={item.stockId} value={item.stockId}>
                    {item.productName} - {item.flavour} — {item.quantity} available
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={transferQuantity}
                onChange={(event) => setTransferQuantity(event.target.value)}
                className={inputClass}
                required
              />
              <button type="submit" disabled={saving} className={buttonClass}>Transfer Stock</button>
            </form>
          </div>
        </div>
      )}

      {tab === "Daily Reports" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Daily Retail Sales Report</h2>
          <p className="mt-2 text-sm text-slate-500">Reporting date: {report?.date || "Not available"}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Cash Collected", report?.todayCash],
              ["Total Retail Sales", report?.todaySales],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold">{money(value)}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-8 font-bold">Recent Retail Bills</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead><tr className="bg-slate-100"><th className="p-3">Bill</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th></tr></thead>
              <tbody>
                {(report?.recentSales || []).map((sale) => (
                  <tr key={sale.saleId} className="border-t border-slate-200">
                    <td className="p-3">#{sale.saleId}</td>
                    <td className="p-3">{sale.paymentMethod}</td>
                    <td className="p-3">{sale.paymentStatus}</td>
                    <td className="p-3 text-right">{money(sale.totalAmount)}</td>
                  </tr>
                ))}
                {!report?.recentSales?.length && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-500">No retail sales recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
