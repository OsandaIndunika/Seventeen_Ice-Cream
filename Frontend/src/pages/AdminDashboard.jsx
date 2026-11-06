
import { useState } from "react";
import {
  LayoutDashboard,
  Factory,
  Tag,
  Store,
  Truck,
  Users,
  Package,
  LogOut,
  ChartNoAxesCombined,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Production", icon: Factory },
  { label: "Edit Prices", icon: Tag },
  { label: "Outlets", icon: Store },
  { label: "Delivery", icon: Truck },
  { label: "Employees", icon: Users },
  { label: "Raw Materials", icon: Package },
];

const flavors = [
  "Strawberry Swirl",
  "Mint Chocolate",
  "Classic Vanilla",
  "Chocolate",
  "Mango",
  "Fruit & Nut",
];

const flavorColors = {
  "Strawberry Swirl": "#FFB8CC",
  "Mint Chocolate": "#80DDB1",
  "Classic Vanilla": "#FFE79A",
  Chocolate: "#B58A77",
  Mango: "#FFCB70",
  "Fruit & Nut": "#B6A2DE",
};

const initialRecords = [
  {
    id: 1,
    coolRoom: 1,
    flavor: "Strawberry Swirl",
    batch: "FD-2026-003",
    date: "10:30 AM",
    quantity: 45,
  },
  {
    id: 2,
    coolRoom: 1,
    flavor: "Mint Chocolate",
    batch: "FD-2026-002",
    date: "09:15 AM",
    quantity: 60,
  },
  {
    id: 3,
    coolRoom: 1,
    flavor: "Classic Vanilla",
    batch: "FD-2026-001",
    date: "Yesterday",
    quantity: 120,
  },
];

function CoolRoomCard({ room, records }) {
  return (
    <section className="rounded-[22px] border border-[#9BAED1] bg-[#E7E8FA] p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold text-[#283247]">
          Production for CoolRoom{room}
        </h2>

        <button
          type="button"
          onClick={() =>
            window.alert(
              `${records.length} records shown for CoolRoom ${room}`
            )
          }
          className="text-xs font-medium text-pink-500 hover:underline"
        >
          View Full History →
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[490px] text-left text-sm">
          <thead>
            <tr className="text-[10px] tracking-wider text-[#98A6BF]">
              <th className="pb-3 font-semibold">FLAVOR</th>
              <th className="pb-3 font-semibold">BATCH</th>
              <th className="pb-3 font-semibold">DATE/TIME</th>
              <th className="pb-3 text-right font-semibold">
                QUANTITY
              </th>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="border-t border-[#B5C1D8] py-6 text-center text-slate-500"
                >
                  No production records yet.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-[#B5C1D8] text-[#35415A]"
                >
                  <td className="py-4">
                    <div className="flex items-center gap-3 font-semibold">
                      <span
                        className="h-6 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            flavorColors[record.flavor] ||
                            "#D0D8E9",
                        }}
                      />
                      {record.flavor}
                    </div>
                  </td>
                  <td className="py-4 text-xs">{record.batch}</td>
                  <td className="py-4 text-xs">{record.date}</td>
                  <td className="py-4 text-right font-bold">
                    {record.quantity} L
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState("Production");
  const [records, setRecords] = useState(initialRecords);

  const [coolRoom, setCoolRoom] = useState("3");
  const [flavor, setFlavor] = useState("Strawberry Swirl");
  const [quantity, setQuantity] = useState("");
  const [pendingEntries, setPendingEntries] = useState([]);
  const [message, setMessage] = useState("");

  const totalProduced = pendingEntries.reduce(
    (total, entry) => total + entry.quantity,
    0
  );

  function addEntry(event) {
    event.preventDefault();

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid quantity greater than zero.");
      return;
    }

    setPendingEntries((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        coolRoom: Number(coolRoom),
        flavor,
        quantity: amount,
      },
    ]);

    setQuantity("");
    setMessage("");
  }

  function removeEntry(id) {
    setPendingEntries((previous) =>
      previous.filter((entry) => entry.id !== id)
    );
  }

  function saveProduction() {
    if (pendingEntries.length === 0) {
      setMessage("Add at least one production entry.");
      return;
    }

    const newRecords = pendingEntries.map((entry, index) => ({
      ...entry,
      batch: `FD-${Date.now()}-${index + 1}`,
      date: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    setRecords((previous) => [...newRecords, ...previous]);
    setPendingEntries([]);
    setMessage("Production records saved for this session.");
  }

  const inputClasses =
    "h-11 w-full rounded-xl border border-slate-200 bg-[#F7F7FC] px-3 text-sm text-[#27344B] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200";

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F7] text-[#263047] md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col bg-[#5CDBDF] md:min-h-screen md:w-56">
        <div className="px-5 pb-6 pt-8">
          <h2 className="font-serif text-2xl font-bold">
            Frosty Delights
          </h2>
          <p className="mt-1 text-[9px] tracking-[2px] text-[#526E80]">
            FACTORY MANAGEMENT
          </p>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col">
          {menuItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMenu(label)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors md:w-full ${
                activeMenu === label
                  ? "bg-white font-semibold text-pink-500"
                  : "text-[#49657B] hover:bg-white/50"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 border-t border-white/40 px-7 py-5 text-sm font-semibold text-pink-500 hover:bg-white/20"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 bg-[#5CDBDF] px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFC5DC] text-pink-600">
              <ChartNoAxesCombined size={21} />
            </div>

            <div>
              <h1 className="text-sm font-bold">Admin Overview</h1>
              <p className="mt-1 text-[9px] tracking-widest text-[#587E8C]">
                HEAD OFFICE · ALL OUTLETS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-[#FFF4B5] px-4 py-2 text-xs">
            <Clock size={14} />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold">
                {user?.fullName || "Admin User"}
              </p>
              <p className="text-[10px]">MANAGER</p>
            </div>

            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F49DD3] font-bold text-white">
              {(user?.fullName || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{activeMenu}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeMenu === "Production"
                ? "Manage ice cream production across cool rooms."
                : `Manage ${activeMenu.toLowerCase()} operations.`}
            </p>
          </div>

          {activeMenu === "Production" ? (
            <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
              {/* Cool Rooms */}
              <div className="flex flex-col gap-6">
                {[1, 2, 3].map((room) => (
                  <CoolRoomCard
                    key={room}
                    room={room}
                    records={records.filter(
                      (record) => record.coolRoom === room
                    )}
                  />
                ))}
              </div>

              {/* Record Production */}
              <aside className="flex min-h-[680px] flex-col rounded-[25px] bg-[#8298B7] p-6">
                <h2 className="font-serif text-[22px] font-bold">
                  Record Production
                </h2>

                <p className="mb-6 mt-2 text-xs text-[#D8E2EF]">
                  Enter production details
                </p>

                <form onSubmit={addEntry}>
                  <label
                    htmlFor="coolRoom"
                    className="mb-2 block text-xs text-white/80"
                  >
                    Select CoolRoom
                  </label>

                  <select
                    id="coolRoom"
                    value={coolRoom}
                    onChange={(event) =>
                      setCoolRoom(event.target.value)
                    }
                    className={`${inputClasses} mb-5`}
                  >
                    <option value="1">CoolRoom 1</option>
                    <option value="2">CoolRoom 2</option>
                    <option value="3">CoolRoom 3</option>
                  </select>

                  <div className="mb-5 grid grid-cols-[1.3fr_1fr] gap-3">
                    <div className="min-w-0">
                      <label
                        htmlFor="flavor"
                        className="mb-2 block text-xs text-white/80"
                      >
                        Flavour
                      </label>

                      <select
                        id="flavor"
                        value={flavor}
                        onChange={(event) =>
                          setFlavor(event.target.value)
                        }
                        className={inputClasses}
                      >
                        {flavors.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor="quantity"
                        className="mb-2 block text-xs text-white/80"
                      >
                        Quantity (L)
                      </label>

                      <input
                        id="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 50"
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(event.target.value)
                        }
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#9DDCF5] text-xs font-semibold text-blue-700 transition hover:brightness-95"
                  >
                    <Plus size={17} />
                    Add Entry
                  </button>
                </form>

                <div className="my-6 h-px bg-white/40" />

                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    Today's Batches
                  </h3>

                  <button
                    type="button"
                    onClick={() => setPendingEntries([])}
                    className="text-[10px] font-semibold text-pink-400"
                  >
                    CLEAR ALL
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {pendingEntries.length === 0 ? (
                    <p className="text-xs text-white/80">
                      No new entries added yet.
                    </p>
                  ) : (
                    pendingEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className="h-6 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              flavorColors[entry.flavor] ||
                              "#D0D8E9",
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate">{entry.flavor}</p>
                          <p className="mt-1 text-[10px] text-white/70">
                            CoolRoom {entry.coolRoom}
                          </p>
                        </div>

                        <strong className="whitespace-nowrap">
                          {entry.quantity} L
                        </strong>

                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          aria-label={`Remove ${entry.flavor}`}
                          className="text-pink-200 hover:text-white"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-auto pt-8">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-[#F7F7FC] p-5">
                    <span className="text-xs text-slate-500">
                      Total Produced
                    </span>
                    <strong className="text-2xl text-pink-500">
                      {totalProduced} L
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={saveProduction}
                    className="h-12 w-full rounded-xl bg-[#87D9AD] text-xs font-semibold text-green-900 transition hover:brightness-95"
                  >
                    Save Production Log in Cool Room
                  </button>

                  {message && (
                    <p className="mt-3 text-xs text-white" role="status">
                      {message}
                    </p>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <section className="rounded-2xl bg-[#E7E8FA] p-8">
              <h3 className="text-xl font-semibold">
                {activeMenu}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                This module will be connected to its Spring Boot API.
              </p>
              <button
                type="button"
                onClick={() => setActiveMenu("Production")}
                className="mt-5 rounded-lg bg-[#5CDBDF] px-5 py-3 text-sm font-semibold"
              >
                Return to Production
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
