import React from 'react'
import './EditPrice.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { useState } from 'react'

function EditPrice() {


    const Flavours = [
        {
            id: 1,
            name: "Vanilla",
            products: [
                { id: 101, type: "Ice Cream Bag", size: 100, price: 150 },
                { id: 102, type: "Ice Cream Bag", size: 200, price: 250 },
                { id: 103, type: "Ice Cream Tub", size: 500, price: 600 },
                { id: 104, type: "Ice Cream Tub", size: 1000, price: 1100 },
                { id: 105, type: "Popsicle", size: null, price: 100 },
                { id: 106, type: "Ice Packet", size: null, price: 80 }
            ]
        },
        {
            id: 2,
            name: "Chocolate",
            products: [
                { id: 201, type: "Ice Cream Bag", size: 100, price: 180 },
                { id: 202, type: "Ice Cream Bag", size: 200, price: 280 },
                { id: 203, type: "Ice Cream Tub", size: 500, price: 650 },
                { id: 204, type: "Ice Cream Tub", size: 1000, price: 1200 },
                { id: 205, type: "Popsicle", size: null, price: 120 },
                { id: 206, type: "Ice Packet", size: null, price: 90 }
            ]
        }
    ];

    const [selectedSize, setSelectedSize] = useState("");

    const [selectedFlavour, setSelectedFlavour] = useState("");

    const [selectedProduct, setSelectedProduct] = useState("");

    const [filterFlavour, setFilterFlavour] = useState("all");
    const [filterProductType, setFilterProductType] = useState("all");


    const selectedFlavourDetails = Flavours.find(
        (flavour) => flavour.id === Number(selectedFlavour)
    );


    const selectedProductDetails = selectedFlavourDetails?.products.find(
        (product) => product.id === Number(selectedProduct)
    );


    const [newPrice, setNewPrice] = useState("");
    const [updatedPrices, setUpdatedPrices] = useState({});
    const [priceHistory, setPriceHistory] = useState([]);

    const lastUpdated =
        priceHistory.length > 0
            ? priceHistory[priceHistory.length - 1].updatedAt
            : null;




    const filteredProducts = Flavours.flatMap((flavour) =>
        flavour.products
            .filter((product) => {
                const matchesFlavour =
                    filterFlavour === "all" ||
                    flavour.id === Number(filterFlavour);

                const matchesProductType =
                    filterProductType === "all" ||
                    product.type === filterProductType;

                return matchesFlavour && matchesProductType;
            })
            .map((product) => ({
                ...product,
                flavourName: flavour.name
            }))
    );


    const handleUpdatePrice = () => {

        // Validate selected flavour and product
        if (!selectedFlavour || !selectedProductDetails) {
            alert("Please select a flavour and product type");
            return;
        }

        // Validate new price
        if (
            newPrice.trim() === "" ||
            !Number.isFinite(Number(newPrice)) ||
            Number(newPrice) <= 0
        ) {
            alert("Please enter a valid price");
            return;
        }

        const productId = selectedProductDetails.id;

        // Get latest current price
        const previousPrice =
            updatedPrices[productId] ?? selectedProductDetails.price;

        const newPriceValue = Number(newPrice);

        // Prevent updating with the same price
        if (previousPrice === newPriceValue) {
            alert("New price must be different from the current price");
            return;
        }

        // Create price history entry
        const historyEntry = {
            id: crypto.randomUUID(),
            flavour: selectedFlavourDetails.name,
            productType: selectedProductDetails.type,
            previousPrice: previousPrice,
            newPrice: newPriceValue,
            updatedAt: new Date().toISOString(),
            size: selectedProductDetails.size,
        };

        // Save price history
        setPriceHistory((prevHistory) => [
            ...prevHistory,
            historyEntry
        ]);

        // Update only selected product price
        setUpdatedPrices((prevPrices) => ({
            ...prevPrices,
            [productId]: newPriceValue
        }));

        // Clear new price input
        setNewPrice("");

        alert("Product price updated successfully!");
    };


    return (
        <div className='edit-price-page'>
            {/* SideBar*/}
            <SideBar />

            <main className='main-content'>
                {/* Header */}
                <Header headername="Edit Price" />

                <div className='price-dashboard'>
                    <section className='price-summary' aria-label='Price overview'>
                        {/* Summary - Flavour list */}
                        <div className='summary-card'>
                            <span className='summary-label'>Flavour list</span>
                            <strong className='summary-value'>{Flavours.length}</strong>
                        </div>

                        {/* Summary - Last updated date */}
                        <div className='summary-card'>
                            <span className='summary-label'>Last updated</span>

                            <strong className="last-updated">
                                {lastUpdated
                                    ? new Date(lastUpdated).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    })
                                    : "No updates yet"}
                            </strong>

                        </div>
                    </section>


                    {/* Price table and update form */}
                    <div className='price-workspace'>

                        {/* Price table */}
                        <section className='price-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Flavour Price List</h2>
                                    <p>View product prices and their latest changes.</p>
                                </div>
                            </div>

                            <div className="price-list-filters">

                                {/* Filter by Flavour */}
                                <select
                                    value={filterFlavour}
                                    onChange={(e) => setFilterFlavour(e.target.value)}
                                >
                                    <option value="all">All Flavours</option>

                                    {Flavours.map((flavour) => (
                                        <option key={flavour.id} value={flavour.id}>
                                            {flavour.name}
                                        </option>
                                    ))}
                                </select>

                                {/* Filter by Product Type */}
                                <select
                                    value={filterProductType}
                                    onChange={(e) => setFilterProductType(e.target.value)}
                                >
                                    <option value="all">All Product Types</option>

                                    {[...new Set(
                                        Flavours.flatMap((flavour) =>
                                            flavour.products.map((product) => product.type)
                                        )
                                    )].map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>

<button
    type="button"
    className="price-clear-filter-btn"
    onClick={() => {
        setFilterFlavour("all");
        setFilterProductType("all");
    }}
>
    Clear Filters
</button>


                            </div>

                            <div className='price-table-wrap flavour-price-scroll'>
                                <table className='price-table'>
                                    <thead>
                                        <tr>
                                            <th scope="col">Flavour</th>
                                            <th scope="col">Product Type</th>
                                            <th scope="col">Size</th>
                                            <th scope="col">Current Price</th>
                                            <th scope="col">New Price</th>
                                            <th scope="col">Update Rate</th>
                                        </tr>
                                    </thead>



                                    <tbody>
                                        {filteredProducts.map((product) => {

                                            const lastUpdate = [...priceHistory]
                                                .reverse()
                                                .find((entry) =>
                                                    entry.flavour === product.flavourName &&
                                                    entry.productType === product.type &&
                                                    entry.size === product.size
                                                );


                                            const currentPrice = lastUpdate
                                                ? lastUpdate.previousPrice
                                                : product.price;

                                            const displayNewPrice = lastUpdate
                                                ? lastUpdate.newPrice
                                                : null;


                                            const updateRate = lastUpdate
                                                ? (
                                                    ((lastUpdate.newPrice - lastUpdate.previousPrice) /
                                                        lastUpdate.previousPrice) * 100
                                                ).toFixed(2)
                                                : null;

                                            return (
                                                <tr key={product.id}>
                                                    <td>{product.flavourName}</td>
                                                    <td>{product.type}</td>
                                                    <td>{product.size ? `${product.size} ml` : "—"}</td>
                                                    <td>Rs. {currentPrice}</td>
                                                    <td>
                                                        {displayNewPrice !== null
                                                            ? `Rs. ${displayNewPrice}`
                                                            : "-"}
                                                    </td>
                                                    <td
                                                        className={
                                                            updateRate === null
                                                                ? ""
                                                                : Number(updateRate) > 0
                                                                    ? "price-increase"
                                                                    : Number(updateRate) < 0
                                                                        ? "price-decrease"
                                                                        : ""
                                                        }
                                                    >
                                                        {updateRate !== null
                                                            ? `${Number(updateRate) > 0 ? "+" : ""}${updateRate}%`
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>



                                </table>
                            </div>
                        </section>
                        {/* Price update form */}
                        <section className='price-card price-update-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Price update</h2>
                                    <p>Select a flavour and product type to update its price.</p>
                                </div>
                            </div>

                            <div className='price-update-form'>

                                <div className="price-field">
                                    <label htmlFor="flavour-select">Flavour</label>

                                    <select
                                        id="flavour-select"
                                        className="product-select"
                                        value={selectedFlavour}
                                        onChange={(e) => {
                                            setSelectedFlavour(e.target.value);
                                            setSelectedProduct("");
                                            setNewPrice("");
                                        }}
                                    >
                                        <option value="">Select Flavour</option>

                                        {Flavours.map((flavour) => (
                                            <option key={flavour.id} value={flavour.id}>
                                                {flavour.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>


                                <div className="price-field">
                                    <label htmlFor="product-type-select">Product Type</label>

                                    <select
                                        id="product-type-select"
                                        value={selectedProduct}
                                        onChange={(e) => {
                                            setSelectedProduct(e.target.value);
                                            setNewPrice("");
                                        }}
                                        disabled={!selectedFlavour}
                                    >
                                        <option value="">Select Product</option>

                                        {selectedFlavourDetails?.products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.type}
                                                {product.size ? ` - ${product.size} ml` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>



                                <div className='price-field'>
                                    <label htmlFor='current-price'>Previous price</label>
                                    <input id='current-price' type='number' className='current-price-input' min='0' step='0.01'
                                        value={
                                            selectedProductDetails
                                                ? updatedPrices[selectedProductDetails.id] ??
                                                selectedProductDetails.price
                                                : ""
                                        }
                                        readOnly />
                                </div>

                                <div className='price-field'>
                                    <label htmlFor='new-price'>New price</label>
                                    <input id='new-price' type='number' className='new-price-input' min='0' step='0.01' value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                                </div>
                                <button type='button' className='update-price-button' onClick={handleUpdatePrice}>
                                    Update price
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* History of price table */}
                    <section className='price-card price-table-card'>
                        <div className='section-heading'>
                            <div>
                                <h2>Product price history</h2>
                                <p>Review current prices and update history.</p>
                            </div>
                        </div>
                        <div className='price-table-wrap '>
                            <table className='price-table'>

                                <thead>
                                    <tr>
                                        <th scope="col">Flavour</th>
                                        <th scope="col">Product Type</th>
                                        <th scope="col">Size</th>
                                        <th scope="col">Previous Price</th>
                                        <th scope="col">New Price</th>
                                        <th scope="col">Update Date</th>
                                    </tr>
                                </thead>


                                <tbody>
                                    {priceHistory.length > 0 ? (
                                        [...priceHistory].reverse().map((entry) => (
                                            <tr key={entry.id}>
                                                <td>{entry.flavour}</td>
                                                <td>{entry.productType}</td>
                                                <td>{entry.size ? `${entry.size} ml` : "—"}</td>
                                                <td>Rs. {entry.previousPrice}</td>
                                                <td>Rs. {entry.newPrice}</td>

                                                <td>
                                                    {new Date(entry.updatedAt).toLocaleString("en-GB", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })}
                                                </td>

                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="empty-state">
                                                No price updates recorded yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}

export default EditPrice
