
import { useMemo, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  Store,
  Truck,
  LogOut,
  Plus,
  X,
  Search,
  ShieldCheck,
  PackageCheck,
} from "lucide-react";

const initialMaterials = [
  { id: 1, name: "Fresh Milk", unit: "L", stock: 420 },
  { id: 2, name: "Sugar", unit: "kg", stock: 85 },
  { id: 3, name: "Cream", unit: "L", stock: 60 },
  { id: 4, name: "Vanilla Extract", unit: "L", stock: 3 },
  { id: 5, name: "Packaging Tubs", unit: "pcs", stock: 340 },
  { id: 6, name: "Cocoa Powder", unit: "kg", stock: 24 },
  { id: 7, name: "Strawberry Pulp", unit: "kg", stock: 48 },
  { id: 8, name: "Cones", unit: "pcs", stock: 500 },
];

const initialHistory = [
  {
    id: 1,
    date: "2026-10-20",
    batch: "PRD-2026-1020-03",
    product: "Line 02 · Chocolate",
    manager: "Admin User",
    items: [
      { name: "Fresh Milk", quantity: 60, unit: "L" },
      { name: "Sugar", quantity: 8, unit: "kg" },
      { name: "Cream", quantity: 6, unit: "L" },
      { name: "Cocoa Powder", quantity: 2, unit: "kg" },
      { name: "Packaging Tubs", quantity: 60, unit: "pcs" },
    ],
  },
  {
    id: 2,
    date: "2026-10-19",
    batch: "PRD-2026-1019-02",
    product: "Line 01 · Strawberry",
    manager: "Nisha Perera",
    items: [
      { name: "Fresh Milk", quantity: 50, unit: "L" },
      { name: "Sugar", quantity: 7, unit: "kg" },
      { name: "Cream", quantity: 5, unit: "L" },
      { name: "Strawberry Pulp", quantity: 15, unit: "kg" },
      { name: "Packaging Tubs", quantity: 50, unit: "pcs" },
    ],
  },
  {
    id: 3,
    date: "2026-10-19",
    batch: "PRD-2026-1019-01",
    product: "Line 01 · Classic Vanilla",
    manager: "Admin User",
    items: [
      { name: "Fresh Milk", quantity: 40, unit: "L" },
      { name: "Sugar", quantity: 4, unit: "kg" },
      { name: "Cream", quantity: 4, unit: "L" },
      { name: "Vanilla Extract", quantity: 0.3, unit: "L" },
      { name: "Cones", quantity: 200, unit: "pcs" },
    ],
  },
];

const startingRows = [
  { id: 1, materialId: 1, quantity: "80" },
  { id: 2, materialId: 2, quantity: "12" },
  { id: 3, materialId: 3, quantity: "10" },
  { id: 4, materialId: 4, quantity: "0.5" },
  { id: 5, materialId: 5, quantity: "80" },
];

const today = () => new Date().toLocaleDateString("en-CA");

const formatQuantity = (value) =>
  Number(Number(value).toFixed(3));

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200";

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-2xl bg-[#4C51E5] px-5 py-4 text-white">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-100">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-indigo-100">
        {description}
      </p>
    </div>
  );
}

export default function FactoryManagerDashboard({
  user,
  onLogout,
}) {
  const [activeMenu, setActiveMenu] = useState("Production Usage");

  const [materials, setMaterials] = useState(initialMaterials);
  const [history, setHistory] = useState(initialHistory);
  const [rows, setRows] = useState(startingRows);

  const [productionDate, setProductionDate] = useState(today());
  const [batch, setBatch] = useState("PRD-2026-1020-04");
  const [product, setProduct] = useState("Line 01 · Vanilla");

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const managerName = user?.fullName || "Factory Manager";

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Production Usage", icon: ClipboardList },
    { name: "Outlets", icon: Store },
    { name: "Delivery", icon: Truck },
  ];

  const materialById = useMemo(
    () => new Map(materials.map((item) => [item.id, item])),
    [materials]
  );

  const preview = useMemo(
    () =>
      rows.map((row) => {
        const material = materialById.get(Number(row.materialId));
        const quantity = Number(row.quantity) || 0;

        return {
          ...row,
          material,
          quantity,
          remaining: material
            ? formatQuantity(material.stock - quantity)
            : 0,
        };
      }),
    [rows, materialById]
  );

  const hasDuplicateMaterials =
    new Set(rows.map((row) => Number(row.materialId))).size !==
    rows.length;

  const valid =
    rows.length > 0 &&
    batch.trim().length > 0 &&
    productionDate.length > 0 &&
    product.trim().length > 0 &&
    !hasDuplicateMaterials &&
    preview.every(
      (row) =>
        row.material &&
        Number.isFinite(row.quantity) &&
        row.quantity > 0 &&
        row.remaining >= -0.000001
    );

  const managers = [...new Set(history.map((item) => item.manager))];

  const filteredHistory = history.filter((record) => {
    const searchable = [
      record.batch,
      record.product,
      record.manager,
      ...record.items.map((item) => item.name),
    ]
      .join(" ")
      .toLowerCase();

    return (
      searchable.includes(search.toLowerCase()) &&
      (monthFilter === "all" ||
        record.date.startsWith(monthFilter)) &&
      (managerFilter === "all" ||
        record.manager === managerFilter) &&
      (lineFilter === "all" ||
        record.product.includes(lineFilter))
    );
  });

  function updateRow(id, field, value) {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
    setMessage("");
  }

  function addRow() {
    const usedIds = new Set(rows.map((row) => Number(row.materialId)));
    const available = materials.find(
      (material) => !usedIds.has(material.id)
    );

    if (!available) {
      setMessageType("error");
      setMessage("All available materials are already selected.");
      return;
    }

    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        materialId: available.id,
        quantity: "",
      },
    ]);
  }

  function removeRow(id) {
    setRows((current) => current.filter((row) => row.id !== id));
    setMessage("");
  }

  function saveUsage() {
    if (!valid) {
      setMessageType("error");
      setMessage(
        "Check the batch, material selection, quantities and available stock."
      );
      return;
    }

    if (history.some((record) => record.batch === batch.trim())) {
      setMessageType("error");
      setMessage("This batch reference already has a usage record.");
      return;
    }

    // Demo only: update local inventory.
    // Replace with a Spring Boot transaction in production.
    const consumed = new Map(
      preview.map((row) => [Number(row.materialId), row.quantity])
    );

    setMaterials((current) =>
      current.map((material) => ({
        ...material,
        stock: formatQuantity(
          material.stock - (consumed.get(material.id) || 0)
        ),
      }))
    );

    const newRecord = {
      id: crypto.randomUUID(),
      date: productionDate,
      batch: batch.trim(),
      product: product.trim(),
      manager: managerName,
      items: preview.map((row) => ({
        name: row.material.name,
        quantity: row.quantity,
        unit: row.material.unit,
      })),
    };

    setHistory((current) => [newRecord, ...current]);
    setRows([]);
    setBatch("");
    setMessageType("success");
    setMessage("Usage recorded and demo stock updated successfully.");
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#1D2840] md:flex">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col bg-[#5EDADD] md:min-h-screen md:w-52">
        <div className="px-5 pb-7 pt-7">
          <h1 className="font-serif text-xl font-bold">
            Frosty<span className="text-pink-500">Delights</span>
          </h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-4 md:flex-col">
          {menuItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveMenu(name)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-xs transition md:w-full ${
                activeMenu === name
                  ? "bg-white font-bold text-pink-500 shadow-sm"
                  : "text-[#4D6980] hover:bg-white/40"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{name}</span>
              {activeMenu === name && (
                <span className="h-2 w-2 rounded-full bg-pink-400" />
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 border-t border-white/40 px-6 py-5 text-xs font-semibold text-pink-500 hover:bg-white/20"
        >
          <LogOut size={16} />
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#5EDADD] px-5 py-4 lg:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-pink-300 p-2 text-pink-700">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-xs font-bold">Production Usage</p>
              <p className="text-[9px] uppercase tracking-wider text-[#557A86]">
                Head Office · Inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold">{managerName}</p>
              <p className="text-[9px] uppercase text-slate-600">
                Manager
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-pink-300 text-xs font-bold text-pink-700">
              {managerName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {activeMenu !== "Production Usage" ? (
          <section className="p-6">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold">{activeMenu}</h2>
              <p className="mt-3 text-sm text-slate-500">
                This section is not implemented yet.
              </p>
              <button
                type="button"
                onClick={() => setActiveMenu("Production Usage")}
                className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
              >
                Back to Production Usage
              </button>
            </div>
          </section>
        ) : (
          <div className="p-4 sm:p-6 lg:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl font-bold">
                  Production Usage
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Record materials consumed on the production line
                  and keep stock up to date.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Summary */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Materials Available"
                value={String(materials.length).padStart(2, "0")}
                description="Current stock across ingredients & packaging"
              />
              <StatCard
                label="Saved Usage Records"
                value={String(history.length).padStart(2, "0")}
                description="Demo usage records already reflected in stock"
              />
              <StatCard
                label="Current Draft"
                value={`${String(rows.length).padStart(2, "0")} materials`}
                description="Pending deduction · no stock changed yet"
              />
            </div>

            {/* Main form and preview */}
            <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(270px,0.95fr)]">
              <section className="rounded-[22px] bg-[#1919DB] p-5 text-white shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl font-bold">
                    Record Production Consumption
                  </h3>
                  <span className="rounded-full bg-pink-200 px-3 py-1 text-[10px] font-bold text-pink-600">
                    Unsaved draft
                  </span>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-wider text-indigo-200">
                      Production Date
                    </label>
                    <input
                      type="date"
                      value={productionDate}
                      onChange={(e) =>
                        setProductionDate(e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-wider text-indigo-200">
                      Batch / Reference
                    </label>
                    <input
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                      placeholder="Batch reference"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-wider text-indigo-200">
                      Recorded By · Manager
                    </label>
                    <input
                      value={managerName}
                      readOnly
                      className={`${inputClass} bg-slate-100`}
                    />
                  </div>
                </div>

                <div className="mb-5">
                  <label className="mb-2 block text-[10px] uppercase tracking-wider text-indigo-200">
                    Production Line / Product
                  </label>
                  <input
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. Line 01 · Vanilla"
                    className={inputClass}
                  />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    Materials used
                  </h4>
                  <span className="text-[10px] text-indigo-200">
                    Enter quantities in the stock unit
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-indigo-200">
                        <th className="pb-3">Raw Material</th>
                        <th className="pb-3">Available</th>
                        <th className="pb-3">Quantity Used</th>
                        <th className="pb-3">After Use</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-white/15"
                        >
                          <td className="w-[45%] py-3 pr-3">
                            <select
                              value={row.materialId}
                              onChange={(e) =>
                                updateRow(
                                  row.id,
                                  "materialId",
                                  Number(e.target.value)
                                )
                              }
                              className={inputClass}
                            >
                              {materials.map((material) => (
                                <option
                                  key={material.id}
                                  value={material.id}
                                  disabled={rows.some(
                                    (other) =>
                                      other.id !== row.id &&
                                      Number(other.materialId) ===
                                        material.id
                                  )}
                                >
                                  {material.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3">
                            {row.material?.stock ?? 0}{" "}
                            {row.material?.unit}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center rounded-lg bg-white pr-2 text-slate-500">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={row.quantity}
                                onChange={(e) =>
                                  updateRow(
                                    row.id,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                className="w-16 min-w-0 flex-1 rounded-lg bg-white px-2 py-2 text-slate-800 outline-none"
                              />
                              <span className="text-[10px]">
                                {row.material?.unit}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`whitespace-nowrap py-3 pr-3 font-semibold ${
                              row.remaining < 0
                                ? "text-pink-300"
                                : "text-emerald-200"
                            }`}
                          >
                            {row.remaining} {row.material?.unit}
                          </td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              aria-label="Remove material"
                              className="rounded-lg bg-indigo-600 p-2 hover:bg-indigo-500"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-[#88DBB4] px-4 py-3 text-xs font-semibold text-slate-900 hover:bg-[#A4E7C9]"
                >
                  <Plus size={15} />
                  Add material row
                </button>

                <div className="mt-4 flex items-center gap-2 text-xs text-indigo-100">
                  <ShieldCheck size={15} />
                  {valid
                    ? "All quantities are within available stock."
                    : "Complete the draft and check stock quantities."}
                </div>
              </section>

              {/* Stock Preview */}
              <aside className="flex flex-col rounded-[22px] bg-[#1919DB] p-5 text-white shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-serif text-xl font-bold">
                    Stock Preview
                  </h3>
                  <span className="rounded-full bg-pink-200 px-3 py-1 text-[10px] font-bold text-pink-600">
                    Pending
                  </span>
                </div>

                <p className="mt-3 text-xs text-indigo-100">
                  Review remaining balances before recording this batch.
                </p>

                <div className="my-4 rounded-xl bg-[#4B50E1] p-4">
                  <p className="text-xs font-bold">
                    {batch || "No batch selected"}
                  </p>
                  <p className="mt-1 text-[11px] text-indigo-100">
                    {product}
                  </p>
                  <p className="mt-1 text-[10px] text-indigo-100">
                    {productionDate} · {managerName}
                  </p>
                </div>

                <div className="flex justify-between border-b border-white/20 pb-3 text-[10px] uppercase tracking-wider text-indigo-200">
                  <span>Available → Used</span>
                  <span>After Use</span>
                </div>

                <div className="divide-y divide-white/15">
                  {preview.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-xs font-semibold">
                          {row.material?.name}
                        </p>
                        <p className="mt-1 text-[10px] text-indigo-200">
                          {row.material?.stock} → {row.quantity}{" "}
                          {row.material?.unit}
                        </p>
                      </div>
                      <strong
                        className={`whitespace-nowrap text-sm ${
                          row.remaining < 0
                            ? "text-pink-300"
                            : "text-emerald-200"
                        }`}
                      >
                        {row.remaining} {row.material?.unit}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-5">
                  <div className="flex gap-2 rounded-lg bg-[#4B50E1] p-3 text-[11px] text-indigo-100">
                    <PackageCheck size={18} className="shrink-0" />
                    <p>
                      Recording deducts these quantities and saves a
                      usage record. Quantities above available stock
                      cannot be recorded.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={saveUsage}
                    disabled={!valid}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#88DBB4] px-3 py-4 text-xs font-bold text-indigo-950 hover:bg-[#A4E7C9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PackageCheck size={17} />
                    Record Usage & Reduce Stock
                  </button>

                  <p className="mt-3 text-center text-[10px] text-indigo-200">
                    Preview only. Current stock is unchanged until
                    recorded.
                  </p>
                </div>
              </aside>
            </div>

            {message && (
              <div
                role="status"
                className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                  messageType === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {message}
              </div>
            )}

            {/* History */}
            <section className="mt-5 rounded-[22px] bg-[#1919DB] p-5 text-white">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-xl font-bold">
                  Recent Usage History
                </h3>
                <span className="text-[11px] text-indigo-200">
                  Saved records · deductions already reflected in demo stock
                </span>
              </div>

              <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_160px_140px]">
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 text-slate-500">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search batch, material or manager"
                    className="w-full py-3 text-xs text-slate-800 outline-none"
                  />
                </div>

                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="all">All months</option>
                  {[...new Set(history.map((r) => r.date.slice(0, 7)))].map(
                    (month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={lineFilter}
                  onChange={(e) => setLineFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="all">All production lines</option>
                  <option value="Line 01">Line 01</option>
                  <option value="Line 02">Line 02</option>
                </select>

                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="all">All managers</option>
                  {managers.map((manager) => (
                    <option key={manager} value={manager}>
                      {manager}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/20 text-[10px] uppercase tracking-wider text-indigo-200">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Batch / Product</th>
                      <th className="pb-3">Materials Consumed & Quantities</th>
                      <th className="pb-3">Recorded By</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-white/15 align-top"
                      >
                        <td className="py-4 pr-3">
                          {record.date}
                        </td>
                        <td className="py-4 pr-3">
                          <p className="font-semibold">
                            {record.batch}
                          </p>
                          <p className="mt-1 text-indigo-200">
                            {record.product}
                          </p>
                        </td>
                        <td className="max-w-sm py-4 pr-3 leading-5">
                          {record.items
                            .map(
                              (item) =>
                                `${item.name} ${item.quantity} ${item.unit}`
                            )
                            .join(" · ")}
                        </td>
                        <td className="py-4 pr-3">
                          {record.manager}
                        </td>
                        <td className="py-4">
                          <span className="rounded-full bg-[#88DBB4] px-3 py-1 text-[10px] font-bold text-green-900">
                            Deducted
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredHistory.length === 0 && (
                  <p className="py-8 text-center text-xs text-indigo-200">
                    No usage records match your filters.
                  </p>
                )}
              </div>

              <p className="mt-4 text-[11px] text-indigo-200">
                Showing {filteredHistory.length} of {history.length} usage records
              </p>
            </section>

            <p className="mt-4 text-[11px] text-slate-500">
              All production deductions should be recorded against a
              batch and authenticated manager for inventory traceability.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
