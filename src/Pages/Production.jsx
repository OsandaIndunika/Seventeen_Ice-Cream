import React from 'react'
import './Production.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { useState } from 'react'

function Production() {
    const [coolroom, setCoolroom] = useState("");
    const [flavour, setFlavour] = useState("");
    const [quantity, setQuantity] = useState("");
    const [productionEntries, setProductionEntries] = useState([]);
    const [todaysProduction, setTodaysProduction] = useState([]);
    const [productType, setProductType] = useState("");
    const [productSize, setProductSize] = useState("");
    const [filterFlavour, setFilterFlavour] = useState("");
    const [filterProductType, setFilterProductType] = useState("");
    const [manufacturingDate, setManufacturingDate] = useState("");
    const [expiryDate, setExpiryDate] = useState("");



    {/* Add a new production entry */ }

    const handleAddEntry = () => {

        if (
            !coolroom ||
            !flavour ||
            !productType ||
            !manufacturingDate ||
            !expiryDate ||
            quantity.trim() === "" ||
            !Number.isInteger(Number(quantity)) ||
            Number(quantity) <= 0
        ) {
            alert("Please fill all fields correctly.");
            return;
        }
        const today = new Date();
        const todayString =
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        if (manufacturingDate > todayString) {
            alert("Manufacturing date cannot be in the future.");
            return;
        }

        if (expiryDate <= manufacturingDate) {
            alert("Expiry date must be after manufacturing date.");
            return;
        }

        const newEntry = {
            id: crypto.randomUUID(),
            coolroom,
            flavour,
            manufacturingDate,
            expiryDate,
            productType,
            productSize: productSize ? Number(productSize) : null,
            quantity: Number(quantity),
            batch:
                productionEntries.filter(
                    (entry) => entry.coolroom === coolroom
                ).length + 1,
            createdAt: new Date().toISOString()
        };

        setProductionEntries((prev) => [...prev, newEntry]);
        setTodaysProduction((prev) => [...prev, newEntry]);

        setFlavour("");
        setProductType("");
        setProductSize("");
        setQuantity("");
        setManufacturingDate("");
        setExpiryDate("");
    };


    {/* Clear today's production list */ }
    const handleClearAll = () => {
        setTodaysProduction([]);
    };


    /* Production Summary Calculations */

    const today = new Date();

    const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    const expiryLimit = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7
    );

    const expiryLimitString = [
        expiryLimit.getFullYear(),
        String(expiryLimit.getMonth() + 1).padStart(2, "0"),
        String(expiryLimit.getDate()).padStart(2, "0")
    ].join("-");

    // 1. Total units produced today
    const producedToday = productionEntries
        .filter((entry) => entry.manufacturingDate === todayString)
        .reduce((total, entry) => total + entry.quantity, 0);

    // 2. Available stock across all cool rooms
    const availableStock = productionEntries.reduce(
        (total, entry) => total + entry.quantity,
        0
    );

    // 3. Units expiring within the next 7 days
    const expiringSoon = productionEntries
        .filter((entry) =>
            entry.expiryDate >= todayString &&
            entry.expiryDate <= expiryLimitString
        )
        .reduce((total, entry) => total + entry.quantity, 0);


    const productTypes = [
        {
            name: "Ice Cream Bag",
            sizes: [50, 100, 150, 200]
        },
        {
            name: "Popsicle",
            sizes: [60, 80, 100]
        },
        {
            name: "Ice Packet",
            sizes: [50, 80, 100]
        },
        {
            name: "Ice Cream Tub",
            sizes: [250, 500, 1000, 2000]
        }
    ];

    const selectedProduct = productTypes.find(
        (product) => product.name === productType
    );


    return (
        <>
            <div className='app-container'>
                {/*Side bar */}
                <SideBar />

                <div className='main-content'>

                    {/*Header*/}
                    <Header headername="Production" />

                    {/* Production Summary Cards */}

                    <div className="production-summary-container">

                        {/* Produced Today */}
                        <div className="production-summary-card">
                            <h4>Produced Today</h4>
                            <h2>{producedToday.toLocaleString()}</h2>
                            <p>Units produced today</p>
                        </div>

                        {/* Available Stock */}
                        <div className="production-summary-card">
                            <h4>Available Stock</h4>
                            <h2>{availableStock.toLocaleString()}</h2>
                            <p>Across all cool rooms</p>
                        </div>

                        {/* Expiring Soon */}
                        <div className="production-summary-card">
                            <h4>Expiring Soon</h4>
                            <h2>{expiringSoon.toLocaleString()}</h2>
                            <p>Units expiring within 7 days</p>
                        </div>

                    </div>



                    <div className="dashboard-body">

                        {/* Cool Room Production Cards */}

                        <div className="production-section">
                            {/* Production Filters */}
                            <div className="production-filters">

                                <select
                                    value={filterFlavour}
                                    onChange={(e) => setFilterFlavour(e.target.value)}
                                >
                                    <option value="">All Flavours</option>
                                    <option value="vanilla">Vanilla</option>
                                    <option value="chocolate">Chocolate</option>
                                    <option value="strawberry">Strawberry</option>
                                    <option value="mango">Mango</option>
                                </select>

                                <select
                                    value={filterProductType}
                                    onChange={(e) => setFilterProductType(e.target.value)}
                                >
                                    <option value="">All Product Types</option>

                                    {productTypes.map((product) => (
                                        <option key={product.name} value={product.name}>
                                            {product.name}
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


                            {["coolroom-1", "coolroom-2", "coolroom-3"].map((room, index) => {

                                const roomEntries = productionEntries.filter((entry) => {
                                    return (
                                        entry.coolroom === room &&
                                        (filterFlavour === "" || entry.flavour === filterFlavour) &&
                                        (filterProductType === "" ||
                                            entry.productType === filterProductType)
                                    );
                                });

                                const totalQuantity = roomEntries.reduce(
                                    (total, entry) => total + entry.quantity, 0
                                );

                                return (
                                    <div className="production-card" key={room}>

                                        <div className="production-card-header">
                                            <h3>Production for Cool Room {index + 1}</h3>
                                            <span>Total: {totalQuantity}</span>
                                        </div>

                                        {roomEntries.length === 0 ? (
                                            <p>No production recorded yet.</p>
                                        ) : (
                                            <div className="production-table-wrapper">
                                                <table className="production-table">

                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Flavour</th>
                                                            <th scope="col">Product Type</th>
                                                            <th scope="col">Size</th>
                                                            <th scope="col">Batch</th>
                                                            <th scope="col">Quantity</th>
                                                            <th scope="col">MFG Date</th>
                                                            <th scope="col">EXP Date</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {roomEntries.map((entry) => (
                                                            <tr key={entry.id}>
                                                                <td>{entry.flavour}</td>
                                                                <td>{entry.productType}</td>
                                                                <td>
                                                                    {entry.productSize ? `${entry.productSize} ml` : "—"}
                                                                </td>
                                                                <td>{entry.batch}</td>
                                                                <td>{entry.quantity}</td>
                                                                <td>{entry.manufacturingDate}</td>
                                                                <td>{entry.expiryDate}</td>
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


                        {/* Record Production Panel */}
                        <div className="record-section">
                            <h3>Record Poduction</h3>
                            <br />

                            {/* Cool Room Selection */}
                            <p>Select Coolroom</p>
                            <select className="coolroom-select" value={coolroom} onChange={(e) => setCoolroom(e.target.value)}>
                                <option value="">Select Category</option>
                                <option value="coolroom-1">Cool-room 1</option>
                                <option value="coolroom-2">Cool-room 2</option>
                                <option value="coolroom-3">Cool-room 3</option>
                            </select>



                            <div className="production-form-grid">

                                {/* Flavour */}
                                <div className="production-form-field">
                                    <label>Flavour</label>

                                    <select
                                        value={flavour}
                                        onChange={(e) => setFlavour(e.target.value)}
                                    >
                                        <option value="">Select Flavour</option>
                                        <option value="vanilla">Vanilla</option>
                                        <option value="chocolate">Chocolate</option>
                                        <option value="strawberry">Strawberry</option>
                                        <option value="mango">Mango</option>
                                    </select>
                                </div>

                                {/* Product Type */}
                                <div className="production-form-field">
                                    <label>Product Type</label>

                                    <select
                                        value={productType}
                                        onChange={(e) => {
                                            setProductType(e.target.value);
                                            setProductSize("");
                                        }}
                                    >
                                        <option value="">Select Product Type</option>

                                        {productTypes.map((product) => (
                                            <option key={product.name} value={product.name}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {/* Product Size - Only for Bags and Tubs */}
                                {(productType === "Ice Cream Bag" ||
                                    productType === "Ice Cream Tub") && (

                                        <div className="production-form-field">
                                            <label>Product Size (Optional)</label>

                                            <select
                                                value={productSize}
                                                onChange={(e) => setProductSize(e.target.value)}
                                            >
                                                <option value="">Select Size</option>

                                                {selectedProduct?.sizes.map((size) => (
                                                    <option key={size} value={size}>
                                                        {size} ml
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}


                                {/* Quantity */}
                                <div className="production-form-field">
                                    <label>Quantity</label>

                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="e.g. 50"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                    />
                                </div>


                                {/* Manufacturing Date */}
                                <div className="production-form-field">
                                    <label>Manufacturing Date</label>
                                    <input
                                        type="date"
                                        value={manufacturingDate}
                                        onChange={(e) => setManufacturingDate(e.target.value)}
                                        max={new Date().toLocaleDateString("en-CA")}
                                    />
                                </div>

                                {/* Expiry Date */}
                                <div className="production-form-field">
                                    <label>Expiry Date</label>
                                    <input
                                        type="date"
                                        value={expiryDate}
                                        min={manufacturingDate || undefined}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                    />
                                </div>


                            </div>


                            {/* Add Entry Button */}
                            <button className='add-entry-btn' onClick={handleAddEntry}>+ Add Entry</button>
                            <hr style={{ border: '1px solid #ccc', margin: '20px 0' }} />

                            <div className="production-list-header">
                                <h4>Today's Production</h4>

                                {/* Clear All Button */}
                                <button className="clear-btn" onClick={handleClearAll}>
                                    Clear All
                                </button>
                            </div>
                            <ul>
                                {todaysProduction.length === 0 ? (
                                    <p>No production recorded yet.</p>
                                ) : (
                                    todaysProduction.map((entry) => (

                                        <li key={entry.id}>
                                            <strong>{entry.flavour}</strong>
                                            {" - "}
                                            {entry.productType}
                                            {" - "}
                                            {entry.productSize ? `${entry.productSize} ml` : "Standard"}
                                            {" - "}
                                            {entry.quantity} Units
                                        </li>

                                    ))
                                )}
                            </ul>
                        </div>

                    </div>

                </div>


            </div>
        </>

    )
}
export default Production