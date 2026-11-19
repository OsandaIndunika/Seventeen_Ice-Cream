import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UsersRound, Truck, Layers3, ChartNoAxesColumnIncreasing,
  Bell, AlertTriangle, Clock3, Info,
  Factory, ArrowRight, UserRoundPlus, PackagePlus, ShoppingCart,
  FileChartColumnIncreasing, IceCreamCone ,CalendarDays
} from "lucide-react";
import SideBar from "../Components/SideBar/SideBar";
import Header from "../Components/Header/Header";
import "./Dashboard.css";

// Demo values: replace with API responses when the backend is connected.
const DEMO_STATS = {
  insideEmployees: 48,
  totalEmployees: 86,
  deliveriesToday: 6,
  salesToday: 185400,
  salesChangePercent: 8.2,
};

const PRODUCT_CATALOG = [
    { id: "van-tub-500", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "cho-tub-500", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "man-tub-500", category: "icecream", name: "Mango", flavour: "Mango", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "str-tub-500", category: "icecream", name: "Strawberry", flavour: "Strawberry", type: "Ice Cream Tub", size: "500 ml", unit: "Tubs" },
    { id: "van-bag-100", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Bag", size: "100 ml", unit: "Bags" },
    { id: "van-bag-200", category: "icecream", name: "Vanilla", flavour: "Vanilla", type: "Ice Cream Bag", size: "200 ml", unit: "Bags" },
    { id: "cho-bag-100", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Bag", size: "100 ml", unit: "Bags" },
    { id: "cho-bag-200", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Cream Bag", size: "200 ml", unit: "Bags" },
    { id: "str-pop", category: "icecream", name: "Strawberry", flavour: "Strawberry", type: "Popsicle", size: "—", unit: "Pieces" },
    { id: "man-pop", category: "icecream", name: "Mango", flavour: "Mango", type: "Popsicle", size: "—", unit: "Pieces" },
    { id: "cho-packet", category: "icecream", name: "Chocolate", flavour: "Chocolate", type: "Ice Packet", size: "—", unit: "Packets" },
    // Example yogurt drinks: replace sizes/flavours with factory catalogue later.
    { id: "yd-str-180", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "180 ml", unit: "Bottles" },
    { id: "yd-str-200", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "200 ml", unit: "Bottles" },
    { id: "yd-str-500", category: "yogurt", name: "Strawberry", flavour: "Strawberry", type: "Yogurt Drink", size: "500 ml", unit: "Bottles" },
    { id: "yd-van-180", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "180 ml", unit: "Bottles" },
    { id: "yd-van-200", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "200 ml", unit: "Bottles" },
    { id: "yd-van-500", category: "yogurt", name: "Vanilla", flavour: "Vanilla", type: "Yogurt Drink", size: "500 ml", unit: "Bottles" },
];

const DEMO_ALERTS = [
  { id: 1, kind: "danger", title: "Low Raw Material Stock", detail: "Cocoa Powder is below threshold", time: "2h ago" },
  { id: 2, kind: "warning", title: "Product Expiry Warning", detail: "A production batch expires in 5 days", time: "3h ago" },
  { id: 3, kind: "info", title: "New Batch Created", detail: "A new production batch was recorded", time: "4h ago" },
];

const ROUTES = {
  employees: "/employees",
  batch: "/batch-management",
  rawMaterials: "/raw-materials",
  reports: "/reports",
};

const dateOnly = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

function readSavedBatches() {
  try {
    const raw = localStorage.getItem("sicms-batch-management-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.batches) ? parsed.batches : null;
  } catch {
    return null;
  }
}

function Dashboard() {
  const navigate = useNavigate();
  // Read current browser data whenever the dashboard is opened.
  const [savedBatches] = useState(() => readSavedBatches() ?? []);
  const today = dateOnly(new Date());
  const todaysBatchList = savedBatches.filter((batch) => {
    const date = new Date(batch.createdAt);
    return !Number.isNaN(date.getTime()) && dateOnly(date) === today;
  });
  const todaysBatches = todaysBatchList.length;

  // The current batch schema has a creation timestamp, not a per-product
  // production timestamp. Therefore these are products in batches created today.
  const todaysProducts = todaysBatchList.flatMap((batch) =>
    (batch.products || []).map((item) => {
      const product = PRODUCT_CATALOG.find((p) => p.id === item.productId);
      return {
        id: `${batch.id}-${item.id}`,
        batchNumber: batch.number,
        flavour: product?.flavour ?? "Unknown",
        type: product?.type ?? "Unknown",
        size: product?.size === "—" ? "—" : (product?.size ?? "—"),
        quantity: Number(item.quantity) || 0,
      };
    })
  );
  const todaysTotal = todaysProducts.reduce((sum, item) => sum + item.quantity, 0);
  const go = (path) => navigate(path);

  return (
    <div className="dashboard-page">
      <SideBar />
      <main className="main-content dashboard-main">
        <Header headername="Admin Dashboard"  description="overview of your ice cream factory operations."/>
        <div className="dashboard-container">        
          <div className="dashboard-summary-grid">
            <article className="dashboard-summary-card dashboard-card-blue">
              <div className="dashboard-summary-icon"><UsersRound size={25} /></div>
              <div className="dashboard-summary-copy"><h3>Employees Inside</h3><strong>{DEMO_STATS.insideEmployees}</strong><p>of {DEMO_STATS.totalEmployees} total</p></div>
              <UsersRound className="dashboard-card-watermark" size={85} />
            </article>
            <article className="dashboard-summary-card dashboard-card-purple">
              <div className="dashboard-summary-icon"><Truck size={25} /></div>
              <div className="dashboard-summary-copy"><h3>Daily Delivery</h3><strong>{DEMO_STATS.deliveriesToday}</strong><p>Vehicles on route</p></div>
              <Truck className="dashboard-card-watermark" size={85} />
            </article>
            <article className="dashboard-summary-card dashboard-card-green">
              <div className="dashboard-summary-icon"><Layers3 size={25} /></div>
              <div className="dashboard-summary-copy"><h3>Today's Batches</h3><strong>{todaysBatches}</strong><p>Production batches</p></div>
              <Layers3 className="dashboard-card-watermark" size={85} />
            </article>
            <article className="dashboard-summary-card dashboard-card-orange">
              <div className="dashboard-summary-icon"><ChartNoAxesColumnIncreasing size={25} /></div>
              <div className="dashboard-summary-copy"><h3>Sales Today</h3><strong className="dashboard-sales-value">Rs. {DEMO_STATS.salesToday.toLocaleString("en-LK")}</strong><p>↑ +{DEMO_STATS.salesChangePercent}% than yesterday</p></div>
              <ChartNoAxesColumnIncreasing className="dashboard-card-watermark" size={85} />
            </article>
          </div>

          <div className="dashboard-middle-grid">
            <section className="dashboard-panel dashboard-today-panel">
              <div className="dashboard-panel-heading">
                <h2><Factory size={22} /> Today's Production</h2>
                <button type="button" className="dashboard-text-link" onClick={() => go(ROUTES.batch)}>
                  View Batches <ArrowRight size={16} />
                </button>
              </div>
              <div className="dashboard-today-summary">
                <span>{todaysProducts.length} product entries</span>
                <strong>{todaysTotal.toLocaleString()} units</strong>
              </div>
              <div className="dashboard-table-scroll">
                <table className="dashboard-recent-table dashboard-today-table">
                  <thead><tr><th>FLAVOUR</th><th>PRODUCT TYPE</th><th>SIZE</th><th>QUANTITY</th><th>BATCH NO.</th></tr></thead>
                  <tbody>
                    {todaysProducts.length === 0 ? (
                      <tr><td colSpan={5} className="dashboard-empty">No products in batches created today.</td></tr>
                    ) : todaysProducts.map((item) => (
                      <tr key={item.id}>
                        <td>{item.flavour}</td>
                        <td>{item.type}</td>
                        <td>{item.size}</td>
                        <td>{item.quantity.toLocaleString()}</td>
                        <td>{item.batchNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-panel dashboard-alerts-panel">
              <div className="dashboard-panel-heading"><h2><Bell size={22} /> Recent Alerts</h2><span className="dashboard-alert-count">{DEMO_ALERTS.length}</span></div>
              <div className="dashboard-alert-list">
                {DEMO_ALERTS.map((alert) => (
                  <div className={`dashboard-alert dashboard-alert-${alert.kind}`} key={alert.id}>
                    <div className="dashboard-alert-icon">{alert.kind === "danger" ? <AlertTriangle size={23} /> : alert.kind === "warning" ? <Clock3 size={23} /> : <Info size={23} />}</div>
                    <div className="dashboard-alert-text"><strong>{alert.title}</strong><p>{alert.detail}</p></div>
                    <span className="dashboard-alert-time">{alert.time}</span>
                  </div>
                ))}
              </div>
              <p className="dashboard-demo-note">Example alerts · Live alert service not connected</p>
            </section>
          </div>

          <div className="dashboard-bottom-grid">
            <section className="dashboard-panel dashboard-quick-panel">
              <div className="dashboard-panel-heading"><h2><span className="dashboard-bolt">⚡</span> Quick Actions</h2></div>
              <div className="dashboard-quick-grid">
                <button type="button" className="dashboard-quick-action quick-blue" onClick={() => go(ROUTES.employees)}><UserRoundPlus size={25}/><span>Add Employee</span></button>
                <button type="button" className="dashboard-quick-action quick-purple" onClick={() => go(ROUTES.batch)}><PackagePlus size={25}/><span>Create Batch</span></button>
                <button type="button" className="dashboard-quick-action quick-green" onClick={() => go(ROUTES.rawMaterials)}><ShoppingCart size={25}/><span>Add Purchase</span></button>
                <button type="button" className="dashboard-quick-action quick-orange" onClick={() => go(ROUTES.reports)}><FileChartColumnIncreasing size={25}/><span>View Reports</span></button>
              </div>
              <div className="dashboard-dessert-decoration"><IceCreamCone size={42} /><span>Keep everything running smoothly!</span></div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
