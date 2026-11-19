
import React, { useEffect, useState } from "react";
import "./Production.css";

import SideBar from "../Components/SideBar/SideBar";
import Header from "../Components/Header/Header";

// ====================================
// PRODUCT CATALOGUE
// ====================================

const productTypes = [
  { name: "Ice Cream Bag", sizes: ["4 Litres"] },
  { name: "Ice Cream Cup", sizes: ["80ml"] },
  {
    name: "Ice Cream Tub",
    sizes: ["500ml", "1 Litre", "2 Litres"]
  },
  { name: "Ice Packet", sizes: [] },
  { name: "Popsicle", sizes: [] }
];

const flavours = [
  "Chocolate",
  "Fruit & Nut",
  "Vanilla"
];

// ====================================
// DUMMY BATCH DATA
// ====================================

const dummyBatches = [
  {
    batchNumber: "DEMO-20261119-003",
    manufacturingDate: "2026-11-19",
    products: [
      {
        flavour: "Chocolate",
        productType: "Ice Cream Tub",
        size: "500ml",
        quantity: 200,
        expiryDate: "2026-12-19"
      },
      {
        flavour: "Vanilla",
        productType: "Ice Cream Cup",
        size: "80ml",
        quantity: 150,
        expiryDate: "2026-12-10"
      },
      {
        flavour: "Fruit & Nut",
        productType: "Popsicle",
        size: "",
        quantity: 100,
        expiryDate: "2026-12-15"
      }
    ]
  },
  {
    batchNumber: "DEMO-20261118-002",
    manufacturingDate: "2026-11-18",
    products: [
      {
        flavour: "Vanilla",
        productType: "Ice Cream Bag",
        size: "4 Litres",
        quantity: 80,
        expiryDate: "2026-12-18"
      },
      {
        flavour: "Chocolate",
        productType: "Ice Packet",
        size: "",
        quantity: 300,
        expiryDate: "2026-12-08"
      },
      {
        flavour: "Fruit & Nut",
        productType: "Ice Cream Tub",
        size: "1 Litre",
        quantity: 120,
        expiryDate: "2026-12-18"
      }
    ]
  },
  {
    batchNumber: "DEMO-20261117-001",
    manufacturingDate: "2026-11-17",
    products: [
      {
        flavour: "Chocolate",
        productType: "Ice Cream Tub",
        size: "2 Litres",
        quantity: 100,
        expiryDate: "2026-12-17"
      },
      {
        flavour: "Fruit & Nut",
        productType: "Ice Cream Cup",
        size: "80ml",
        quantity: 180,
        expiryDate: "2026-12-12"
      }
    ]
  }
];

const STORAGE_KEY = "sicms-production-demo-v2";

// ====================================
// HELPERS
// ====================================

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getLocalDateFromISO(isoString) {
  return formatDate(new Date(isoString));
}

function loadProductionEntries() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const entries = saved ? JSON.parse(saved) : [];

    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

// ====================================
// PRODUCTION COMPONENT
// ====================================

function Production() {

  // Form states
  const [coolroom, setCoolroom] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [flavour, setFlavour] = useState("");
  const [productType, setProductType] = useState("");
  const [productSize, setProductSize] = useState("");
  const [quantity, setQuantity] = useState("");

  // Production records
  const [productionEntries, setProductionEntries] =
    useState(loadProductionEntries);

  // Filters
  const [filterFlavour, setFilterFlavour] = useState("");
  const [filterProductType, setFilterProductType] =
    useState("");

  // Latest batches first
  const batches = [...dummyBatches].sort(
    (a, b) =>
      b.manufacturingDate.localeCompare(
        a.manufacturingDate
      )
  );

  // Save records in session storage
  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(productionEntries)
    );
  }, [productionEntries]);

  // ====================================
  // SELECTED BATCH
  // ====================================

  const selectedBatch = batches.find(
    (batch) => batch.batchNumber === batchNumber
  );

  const batchProducts = selectedBatch?.products || [];

  // Does selected product require a size?
  const requiresSize =
    productType !== "Ice Packet" &&
    productType !== "Popsicle";

  // Available flavours in selected batch
  const availableFlavours = flavours.filter(
    (item) =>
      batchProducts.some(
        (product) => product.flavour === item
      )
  );

  // Available product types for flavour
  const availableProductTypes = productTypes.filter(
    (type) =>
      batchProducts.some(
        (product) =>
          product.flavour === flavour &&
          product.productType === type.name
      )
  );

  // Available sizes for selected product
  const selectedProductType = productTypes.find(
    (type) => type.name === productType
  );

  const availableSizes =
    selectedProductType?.sizes.filter(
      (size) =>
        batchProducts.some(
          (product) =>
            product.flavour === flavour &&
            product.productType === productType &&
            product.size === size
        )
    ) || [];

  // Automatically identify the batch product
  const selectedBatchProduct = batchProducts.find(
    (product) =>
      product.flavour === flavour &&
      product.productType === productType &&
      (
        !requiresSize ||
        product.size === productSize
      )
  );

  // ====================================
  // DATE CALCULATIONS
  // ====================================

  const today = new Date();
  const todayString = formatDate(today);

  const expiryLimit = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 7
  );

  const expiryLimitString = formatDate(expiryLimit);

  // ====================================
  // SUMMARY CALCULATIONS
  // ====================================

  const producedToday = productionEntries
    .filter(
      (entry) =>
        getLocalDateFromISO(entry.createdAt) ===
        todayString
    )
    .reduce(
      (total, entry) => total + entry.quantity,
      0
    );

  const availableStock = productionEntries.reduce(
    (total, entry) => total + entry.quantity,
    0
  );

  const expiringSoon = productionEntries
    .filter(
      (entry) =>
        entry.expiryDate >= todayString &&
        entry.expiryDate <= expiryLimitString
    )
    .reduce(
      (total, entry) => total + entry.quantity,
      0
    );

  const todaysProduction = productionEntries.filter(
    (entry) =>
      getLocalDateFromISO(entry.createdAt) ===
      todayString
  );

  // ====================================
  // ADD PRODUCTION ENTRY
  // ====================================

  const handleAddEntry = () => {

    if (
      !coolroom ||
      !batchNumber ||
      !flavour ||
      !productType ||
      (requiresSize && !productSize) ||
      quantity.trim() === ""
    ) {
      alert("Please fill all required fields.");
      return;
    }

    const enteredQuantity = Number(quantity);

    if (
      !Number.isInteger(enteredQuantity) ||
      enteredQuantity <= 0
    ) {
      alert("Please enter a valid quantity.");
      return;
    }

    if (!selectedBatchProduct) {
      alert(
        "Selected product was not found in this batch."
      );
      return;
    }

    // Calculate quantity already recorded
    const alreadyRecorded = productionEntries
      .filter(
        (entry) =>
          entry.batchNumber === batchNumber &&
          entry.flavour === flavour &&
          entry.productType === productType &&
          entry.productSize ===
            (requiresSize ? productSize : "")
      )
      .reduce(
        (total, entry) => total + entry.quantity,
        0
      );

    const remainingQuantity =
      selectedBatchProduct.quantity -
      alreadyRecorded;

    if (enteredQuantity > remainingQuantity) {
      alert(
        `Only ${remainingQuantity} units are available in this batch.`
      );
      return;
    }

    const newEntry = {
      id: crypto.randomUUID(),
      coolroom,
      batchNumber,
      flavour,
      productType,
      productSize: requiresSize ? productSize : "",
      quantity: enteredQuantity,

      // Dates tracked internally
      manufacturingDate:
        selectedBatch.manufacturingDate,

      expiryDate:
        selectedBatchProduct.expiryDate,

      createdAt: new Date().toISOString()
    };

    setProductionEntries((previous) => [
      ...previous,
      newEntry
    ]);

    // Keep batch and cool room selected
    setFlavour("");
    setProductType("");
    setProductSize("");
    setQuantity("");
  };

  // ====================================
  // CLEAR TODAY'S PRODUCTION
  // ====================================

  const handleClearAll = () => {
    setProductionEntries((previous) =>
      previous.filter(
        (entry) =>
          getLocalDateFromISO(entry.createdAt) !==
          formatDate(new Date())
      )
    );
  };

  // ====================================
  // JSX
  // ====================================

  return (
    <div className="app-container">

      <SideBar />

      <div className="main-content">

        <Header
          headername="Production"
          description="Monitor ice cream production and manage cool room storage."
        />

        {/* SUMMARY CARDS */}

        <div className="production-summary-container">

          <div className="production-summary-card">
            <h4>Produced Today</h4>
            <h2>{producedToday.toLocaleString()}</h2>
            <p>Units recorded today</p>
          </div>

          <div className="production-summary-card">
            <h4>Available Stock</h4>
            <h2>{availableStock.toLocaleString()}</h2>
            <p>Across all cool rooms</p>
          </div>

          <div className="production-summary-card">
            <h4>Expiring Soon</h4>
            <h2>{expiringSoon.toLocaleString()}</h2>
            <p>Units expiring within 7 days</p>
          </div>

        </div>

        <div className="dashboard-body">

          {/* LEFT SIDE */}

          <div className="production-section">

            {/* FILTERS */}

            <div className="production-filters">

              <select
                value={filterFlavour}
                onChange={(e) =>
                  setFilterFlavour(e.target.value)
                }
              >
                <option value="">All Flavours</option>

                {flavours.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={filterProductType}
                onChange={(e) =>
                  setFilterProductType(e.target.value)
                }
              >
                <option value="">
                  All Product Types
                </option>

                {productTypes.map((type) => (
                  <option
                    key={type.name}
                    value={type.name}
                  >
                    {type.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="production-clear-filter"
                onClick={() => {
                  setFilterFlavour("");
                  setFilterProductType("");
                }}
              >
                Clear Filters
              </button>

            </div>

            {/* COOL ROOM CARDS */}

            {[
              "coolroom-1",
              "coolroom-2",
              "coolroom-3"
            ].map((room, index) => {

              const roomEntries =
                productionEntries.filter(
                  (entry) =>
                    entry.coolroom === room &&
                    (
                      !filterFlavour ||
                      entry.flavour === filterFlavour
                    ) &&
                    (
                      !filterProductType ||
                      entry.productType ===
                        filterProductType
                    )
                );

              const totalQuantity =
                roomEntries.reduce(
                  (total, entry) =>
                    total + entry.quantity,
                  0
                );

              return (
                <div
                  className="production-card"
                  key={room}
                >

                  <div className="production-card-header">
                    <h3>
                      Production for Cool Room {index + 1}
                    </h3>

                    <span>
                      Total: {totalQuantity}
                    </span>
                  </div>

                  {roomEntries.length === 0 ? (

                    <p>
                      No production recorded yet.
                    </p>

                  ) : (

                    <div className="production-table-wrapper">

                      <table className="production-table">

                        <thead>
                          <tr>
                            <th>Flavour</th>
                            <th>Product Type</th>
                            <th>Size</th>
                            <th>Batch Number</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>

                        <tbody>

                          {roomEntries.map((entry) => (
                            <tr key={entry.id}>

                              <td>
                                {entry.flavour}
                              </td>

                              <td>
                                {entry.productType}
                              </td>

                              <td>
                                {entry.productSize || "—"}
                              </td>

                              <td>
                                {entry.batchNumber}
                              </td>

                              <td>
                                {entry.quantity}
                              </td>

                            </tr>
                          ))}

                        </tbody>

                      </table>

                    </div>

                  )}

                </div>
              );
            })}

          </div>

          {/* RIGHT SIDE */}

          <div className="record-section">

            <h3>Record Production</h3>

            <br />

            {/* COOL ROOM */}

            <p>Select Coolroom</p>

            <select
              className="coolroom-select"
              value={coolroom}
              onChange={(e) =>
                setCoolroom(e.target.value)
              }
            >
              <option value="">
                Select Cool Room
              </option>

              <option value="coolroom-1">
                Cool-room 1
              </option>

              <option value="coolroom-2">
                Cool-room 2
              </option>

              <option value="coolroom-3">
                Cool-room 3
              </option>
            </select>

            {/* BATCH NUMBER */}

            <div className="production-form-field">

              <label>Batch Number</label>

              <select
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value);
                  setFlavour("");
                  setProductType("");
                  setProductSize("");
                  setQuantity("");
                }}
              >
                <option value="">
                  Select Batch Number
                </option>

                {batches.map((batch) => (
                  <option
                    key={batch.batchNumber}
                    value={batch.batchNumber}
                  >
                    {batch.batchNumber}
                  </option>
                ))}

              </select>

            </div>

            <br />

            <div className="production-form-grid">

              {/* FLAVOUR */}

              <div className="production-form-field">

                <label>Flavour</label>

                <select
                  value={flavour}
                  disabled={!batchNumber}
                  onChange={(e) => {
                    setFlavour(e.target.value);
                    setProductType("");
                    setProductSize("");
                  }}
                >
                  <option value="">
                    Select Flavour
                  </option>

                  {availableFlavours.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}

                </select>

              </div>

              {/* PRODUCT TYPE */}

              <div className="production-form-field">

                <label>Product Type</label>

                <select
                  value={productType}
                  disabled={!flavour}
                  onChange={(e) => {
                    setProductType(e.target.value);
                    setProductSize("");
                  }}
                >
                  <option value="">
                    Select Product Type
                  </option>

                  {availableProductTypes.map((type) => (
                    <option
                      key={type.name}
                      value={type.name}
                    >
                      {type.name}
                    </option>
                  ))}

                </select>

              </div>

              {/* PRODUCT SIZE - ONLY IF REQUIRED */}

              {productType !== "Ice Packet" &&
               productType !== "Popsicle" && (

                <div className="production-form-field">

                  <label>Product Size</label>

                  <select
                    value={productSize}
                    disabled={!productType}
                    onChange={(e) =>
                      setProductSize(e.target.value)
                    }
                  >
                    <option value="">
                      Select Size
                    </option>

                    {availableSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}

                  </select>

                </div>

              )}

              {/* QUANTITY */}

              <div className="production-form-field">

                <label>Quantity</label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value)
                  }
                />

              </div>

            </div>

            {/* ADD ENTRY */}

            <button
              type="button"
              className="add-entry-btn"
              onClick={handleAddEntry}
            >
              + Add Entry
            </button>

            <hr
              style={{
                border: "1px solid #e6edf7",
                margin: "20px 0"
              }}
            />

            {/* TODAY'S PRODUCTION */}

            <div className="production-list-header">

              <h4>Today's Production</h4>

              <button
                type="button"
                className="clear-btn"
                onClick={handleClearAll}
              >
                Clear All
              </button>

            </div>

            <ul>

              {todaysProduction.length === 0 ? (

                <p>
                  No production recorded yet.
                </p>

              ) : (

                todaysProduction.map((entry) => (

                  <li key={entry.id}>

                    <strong>
                      {entry.flavour}
                    </strong>

                    {" - "}
                    {entry.productType}

                    {" - "}
                    {entry.productSize || "Standard"}

                    {" - "}
                    {entry.quantity} Units

                    {" - "}
                    {entry.batchNumber}

                  </li>

                ))

              )}

            </ul>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Production;
