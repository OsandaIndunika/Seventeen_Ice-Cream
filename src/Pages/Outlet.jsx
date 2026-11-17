import React, { useEffect, useMemo, useState } from "react";
import SideBar from "../Components/SideBar/SideBar";
import Header from "../Components/Header/Header";
import "./Outlet.css";

const STORAGE_KEY = "sicms-outlets-ui-v1";
const LOW_STOCK_LIMIT = 50;

const PRODUCTS = [
    { id: "van-bag-100", flavour: "Vanilla", type: "Ice Cream Bag", size: 100 },
    { id: "van-bag-200", flavour: "Vanilla", type: "Ice Cream Bag", size: 200 },
    { id: "cho-bag-100", flavour: "Chocolate", type: "Ice Cream Bag", size: 100 },
    { id: "cho-bag-200", flavour: "Chocolate", type: "Ice Cream Bag", size: 200 },
    { id: "str-tub-500", flavour: "Strawberry", type: "Ice Cream Tub", size: 500 },
    { id: "man-tub-1000", flavour: "Mango", type: "Ice Cream Tub", size: 1000 },
    { id: "van-pop", flavour: "Vanilla", type: "Popsicle", size: null },
    { id: "cho-packet", flavour: "Chocolate", type: "Ice Packet", size: null },
];
const INITIAL_OUTLETS = [
    {
        id: "outlet-01",
        name: "Outlet 01",
        address: "Galle Road, Kalutara",
        stock: {
            "van-bag-100": 48, "van-bag-200": 72, "cho-bag-100": 36,
            "cho-bag-200": 64, "str-tub-500": 18, "man-tub-1000": 26,
            "van-pop": 120, "cho-packet": 86,
        },
    },
    {
        id: "outlet-02",
        name: "Outlet 02",
        address: "Colombo Road, Panadura",
        stock: {
            "van-bag-100": 90, "van-bag-200": 65, "cho-bag-100": 44,
            "cho-bag-200": 85, "str-tub-500": 56, "man-tub-1000": 31,
            "van-pop": 150, "cho-packet": 95,
        },
    },
];
function readSavedData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && Array.isArray(saved.outlets) && Array.isArray(saved.requests)) {
            return saved;
        }
    } catch {
        // Ignore malformed browser storage and use demo data.
    }
    return { outlets: INITIAL_OUTLETS, requests: [] };
}

function formatProduct(product) {
    return `${product.flavour} ${product.type}${product.size ? ` (${product.size} ml)` : ""}`;
}
function Outlets() {
    const [data, setData] = useState(readSavedData);
    const [selectedOutletId, setSelectedOutletId] = useState("outlet-01");
    const [filterFlavour, setFilterFlavour] = useState("all");
    const [filterType, setFilterType] = useState("all");
    const [selectedFlavour, setSelectedFlavour] = useState("");
    const [selectedType, setSelectedType] = useState("");
    const [selectedSize, setSelectedSize] = useState("");
    const [quantity, setQuantity] = useState("");
    const [requestItems, setRequestItems] = useState([]);
    const [message, setMessage] = useState("");

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // The UI still works if storage is unavailable.
        }
    }, [data]);

    const selectedOutlet = data.outlets.find((outlet) => outlet.id === selectedOutletId);
    const outletRequests = data.requests.filter((request) => request.outletId === selectedOutletId);
    const flavours = [...new Set(PRODUCTS.map((product) => product.flavour))];
    const productTypes = [...new Set(PRODUCTS.map((product) => product.type))];

    const availableTypes = [
        ...new Set(
            PRODUCTS
                .filter((product) => product.flavour === selectedFlavour)
                .map((product) => product.type)
        )
    ];

    const availableSizes = [
        ...new Set(
            PRODUCTS
                .filter(
                    (product) =>
                        product.flavour === selectedFlavour &&
                        product.type === selectedType &&
                        product.size !== null
                )
                .map((product) => product.size)
        )
    ];

    const showSize =
        selectedType === "Ice Cream Bag" ||
        selectedType === "Ice Cream Tub";



    const totalStock = Object.values(selectedOutlet.stock).reduce(
        (sum, quantity) => sum + quantity,
        0
    );


    const lowStockProducts = PRODUCTS.filter(
        (product) =>
            (selectedOutlet.stock[product.id] ?? 0) < LOW_STOCK_LIMIT
    );

    const lowStockCount = lowStockProducts.length;


    const pendingCount = outletRequests.filter(
        (request) => request.status === "Pending"
    ).length;


    const visibleProducts = useMemo(
        () => PRODUCTS.filter((product) =>
            (filterFlavour === "all" || product.flavour === filterFlavour) &&
            (filterType === "all" || product.type === filterType)
        ),
        [filterFlavour, filterType]
    );

    const requestTotal = requestItems.reduce((sum, item) => sum + item.quantity, 0);


    const selectOutlet = (id) => {
        setSelectedOutletId(id);

        // Clear request items
        setRequestItems([]);

        // Reset product selections
        setSelectedFlavour("");
        setSelectedType("");
        setSelectedSize("");

        // Reset quantity and feedback
        setQuantity("");
        setMessage("");
    };



    const handleLowStockRequest = (product) => {
        setSelectedFlavour(product.flavour);
        setSelectedType(product.type);
        setSelectedSize(
            product.size !== null ? String(product.size) : ""
        );

        setQuantity("");
        setMessage("");

        // Scroll to the quantity input
        const quantityInput = document.getElementById("outlets-quantity");

        if (quantityInput) {
            quantityInput.focus({ preventScroll: true });

            quantityInput.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    };




    const addItem = () => {
        const amount = Number(quantity);

        // Find the product using selected flavour, type and size
        const selectedProduct = PRODUCTS.find((product) =>
            product.flavour === selectedFlavour &&
            product.type === selectedType &&
            (
                !showSize ||
                product.size === Number(selectedSize)
            )
        );

        // Validate product and quantity
        if (
            !selectedProduct ||
            !Number.isSafeInteger(amount) ||
            amount <= 0
        ) {
            setMessage("Please select a valid product and quantity.");
            return;
        }

        // Add product to request list
        setRequestItems((previous) => {
            const existing = previous.find(
                (item) => item.productId === selectedProduct.id
            );

            return existing
                ? previous.map((item) =>
                    item.productId === selectedProduct.id
                        ? {
                            ...item,
                            quantity: item.quantity + amount
                        }
                        : item
                )
                : [
                    ...previous,
                    {
                        productId: selectedProduct.id,
                        quantity: amount
                    }
                ];
        });

        // Clear form after adding
        setSelectedFlavour("");
        setSelectedType("");
        setSelectedSize("");
        setQuantity("");
        setMessage("");
    };


    const submitRequest = () => {
        if (requestItems.length === 0) {
            setMessage("Add at least one product before sending the request.");
            return;
        }
        const request = {
            id: crypto.randomUUID(),
            outletId: selectedOutletId,
            items: requestItems.map((item) => ({ ...item })),
            status: "Pending",
            createdAt: new Date().toISOString(),
        };
        setData((previous) => ({ ...previous, requests: [request, ...previous.requests] }));
        setRequestItems([]);
        setMessage("Delivery request saved locally as Pending.");
    };
    const updateRequest = (requestId, nextStatus) => {
        setData((previous) => {
            const request = previous.requests.find((item) => item.id === requestId);
            if (!request || request.status !== "Pending") return previous;
            const outlets = nextStatus === "Delivered"
                ? previous.outlets.map((outlet) => {
                    if (outlet.id !== request.outletId) return outlet;
                    const stock = { ...outlet.stock };
                    request.items.forEach((item) => {
                        stock[item.productId] = (stock[item.productId] ?? 0) + item.quantity;
                    });
                    return { ...outlet, stock };
                })
                : previous.outlets;
            return {
                outlets,
                requests: previous.requests.map((item) => item.id === requestId
                    ? { ...item, status: nextStatus }
                    : item),
            };
        });
        setMessage(nextStatus === "Delivered"
            ? "Delivery marked as completed. Freezer stock updated."
            : "Delivery request cancelled.");
    };

    return (
        <div className="outlets-page">
            <SideBar />
            <main className="main-content">
                <Header headername="Outlets" />
                <div className="outlets-dashboard">
                    <section className="outlets-summary" aria-label="Outlet overview">
                        <div className="outlets-summary-card">
                            <span>Total Outlets</span><strong>{data.outlets.length}</strong>
                            <small>Active outlet locations</small>
                        </div>
                        <div className="outlets-summary-card">
                            <span>Available Stock</span><strong>{totalStock.toLocaleString()}</strong>
                            <small>Units in {selectedOutlet.name}</small>
                        </div>
                        <div className="outlets-summary-card outlets-summary-warning">
                            <span>Low Stock Items</span><strong>{lowStockCount}</strong>
                            <small>Product variants below {LOW_STOCK_LIMIT} units</small>
                        </div>
                        <div className="outlets-summary-card">
                            <span>Pending Deliveries</span><strong>{pendingCount}</strong>
                            <small>Requests for {selectedOutlet.name}</small>
                        </div>
                    </section>
                    <div className="outlets-workspace">
                        <aside className="outlets-list-card">
                            <h2>Outlets</h2>
                            <p>Select an outlet to view its freezer inventory.</p>
                            <div className="outlets-list">
                                {data.outlets.map((outlet) => {
                                    const stockTotal = Object.values(outlet.stock).reduce((a, b) => a + b, 0);
                                    return (
                                        <button
                                            type="button"
                                            key={outlet.id}
                                            className={`outlets-location ${selectedOutletId === outlet.id ? "is-selected" : ""}`}
                                            onClick={() => selectOutlet(outlet.id)}
                                        >
                                            <span className="outlets-location-name">{outlet.name}</span>
                                            <span className="outlets-location-address">{outlet.address}</span>
                                            <span className="outlets-location-bottom"><span className="outlets-active-dot">Active</span><span>{stockTotal} units</span></span>
                                        </button>
                                    );
                                })}
                            </div>
                        </aside>
                        <div className="outlets-detail">
                            <div className="outlets-detail-heading">
                                <div><h2>{selectedOutlet.name}</h2><p>{selectedOutlet.address}</p></div>
                                <span className="outlets-active-pill">Active</span>
                            </div>

                            <div className="outlets-detail-grid">

                                <section className="outlets-panel outlets-stock-panel">
                                    <div className="outlets-panel-heading"><h3>Freezer Stock</h3><p>Current ice cream stock at {selectedOutlet.name}.</p></div>
                                    <div className="outlets-stock-filters">
                                        <select aria-label="Filter by flavour" value={filterFlavour} onChange={(e) => setFilterFlavour(e.target.value)}>
                                            <option value="all">All Flavours</option>
                                            {flavours.map((flavour) => <option key={flavour} value={flavour}>{flavour}</option>)}
                                        </select>
                                        <select aria-label="Filter by product type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                            <option value="all">All Product Types</option>
                                            {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                        <button type="button" onClick={() => { setFilterFlavour("all"); setFilterType("all"); }}>Clear Filters</button>
                                    </div>
                                    <div className="outlets-table-scroll">
                                        <table className="outlets-table">
                                            <thead><tr><th>Flavour</th><th>Product Type</th><th>Size</th><th>Available Qty</th><th>Status</th></tr></thead>
                                            <tbody>
                                                {visibleProducts.map((product) => {
                                                    const count = selectedOutlet.stock[product.id] ?? 0;
                                                    return (
                                                        <tr key={product.id}>
                                                            <td>{product.flavour}</td><td>{product.type}</td>
                                                            <td>{product.size ? `${product.size} ml` : "—"}</td>
                                                            <td>{count}</td>
                                                            <td><span className={`outlets-stock-status ${count < LOW_STOCK_LIMIT ? "is-low" : "is-normal"}`}>{count === 0 ? "Out of Stock" : count < LOW_STOCK_LIMIT ? "Low" : "Normal"}</span></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section
                                    id="outlets-request-section"
                                    className="outlets-panel outlets-request-panel"
                                >

                                    <div className="outlets-panel-heading"><h3>Request Delivery</h3><p>Prepare a restock request for {selectedOutlet.name}.</p></div>
                                    <div className="outlets-request-form">

                                        {/* Flavour */}
                                        <label htmlFor="outlets-flavour">Flavour</label>

                                        <select
                                            id="outlets-flavour"
                                            value={selectedFlavour}
                                            onChange={(e) => {
                                                setSelectedFlavour(e.target.value);
                                                setSelectedType("");
                                                setSelectedSize("");
                                            }}
                                        >
                                            <option value="">Select Flavour</option>

                                            {flavours.map((flavour) => (
                                                <option key={flavour} value={flavour}>
                                                    {flavour}
                                                </option>
                                            ))}
                                        </select>


                                        {/* Product Type */}
                                        <label htmlFor="outlets-type">Product Type</label>

                                        <select
                                            id="outlets-type"
                                            value={selectedType}
                                            onChange={(e) => {
                                                setSelectedType(e.target.value);
                                                setSelectedSize("");
                                            }}
                                            disabled={!selectedFlavour}
                                        >
                                            <option value="">Select Product Type</option>

                                            {availableTypes.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>


                                        {/* Product Size */}
                                        {showSize && (
                                            <>
                                                <label htmlFor="outlets-size">Size</label>

                                                <select
                                                    id="outlets-size"
                                                    value={selectedSize}
                                                    onChange={(e) => setSelectedSize(e.target.value)}
                                                >
                                                    <option value="">Select Size</option>

                                                    {availableSizes.map((size) => (
                                                        <option key={size} value={size}>
                                                            {size} ml
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}

                                        <label htmlFor="outlets-quantity">Quantity</label>
                                        <input id="outlets-quantity" type="number" min="1" step="1" placeholder="Enter quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                                        <button className="outlets-add-item" type="button" onClick={addItem}>Add to Request</button>
                                    </div>

                                    <div className="outlets-request-cart">
                                        <div className="outlets-request-cart-title"><strong>Request Items</strong><span>{requestTotal} units</span></div>
                                        {requestItems.length === 0 ? <p className="outlets-muted">No products added yet.</p> : (
                                            <ul>
                                                {requestItems.map((item) => {
                                                    const product = PRODUCTS.find((entry) => entry.id === item.productId);
                                                    return <li key={item.productId}><span>{formatProduct(product)} <b>× {item.quantity}</b></span><button type="button" onClick={() => setRequestItems((previous) => previous.filter((entry) => entry.productId !== item.productId))}>Remove</button></li>;
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    <button className="outlets-submit" type="button" onClick={submitRequest} disabled={requestItems.length === 0}>Send to Delivery</button>
                                    {message && <p className="outlets-feedback" role="status">{message}</p>}
                                </section>

                            </div>


                        </div>
                    </div>

                    {/* Low Stock Products */}
                    <section className="outlets-panel outlets-low-stock-panel">

                        <div className="outlets-panel-heading">
                            <h3>Low Stock Products</h3>
                            <p>
                                Products below {LOW_STOCK_LIMIT} units
                                in {selectedOutlet.name}.
                            </p>
                        </div>

                        <div className="outlets-table-scroll">
                            <table className="outlets-table">
                                <thead>
                                    <tr>
                                        <th>Flavour</th>
                                        <th>Product Type</th>
                                        <th>Size</th>
                                        <th>Available Qty</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {lowStockProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="outlets-empty">
                                                No low stock products in this outlet.
                                            </td>
                                        </tr>
                                    ) : (
                                        lowStockProducts.map((product) => {
                                            const count =
                                                selectedOutlet.stock[product.id] ?? 0;

                                            return (
                                                <tr key={product.id}>
                                                    <td>{product.flavour}</td>
                                                    <td>{product.type}</td>
                                                    <td>
                                                        {product.size
                                                            ? `${product.size} ml`
                                                            : "—"}
                                                    </td>
                                                    <td>{count}</td>
                                                    <td>
                                                        <span
                                                            className="outlets-stock-status is-low"
                                                        >
                                                            {count === 0
                                                                ? "Out of Stock"
                                                                : "Low"}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="outlets-low-request-btn"
                                                            onClick={() => handleLowStockRequest(product)}
                                                        >
                                                            Request
                                                        </button>
                                                    </td>

                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </section>

                    <section className="outlets-panel outlets-history-panel">
                        <div className="outlets-panel-heading"><h3>Recent Delivery Requests</h3><p>Requests for {selectedOutlet.name}.</p></div>
                        <div className="outlets-table-scroll">
                            <table className="outlets-table">
                                <thead><tr><th>Request No.</th><th>Date</th><th>Items</th><th>Quantity</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {outletRequests.length === 0 ? (
                                        <tr><td className="outlets-empty" colSpan="6">No delivery requests recorded yet.</td></tr>
                                    ) : outletRequests.map((request) => (
                                        <tr key={request.id}>
                                            <td>DEL-{request.id.slice(0, 8).toUpperCase()}</td>
                                            <td>{new Date(request.createdAt).toLocaleDateString("en-GB")}</td>
                                            <td className="outlets-items-cell">{request.items.map((item) => {
                                                const product = PRODUCTS.find((entry) => entry.id === item.productId);
                                                return `${formatProduct(product)} × ${item.quantity}`;
                                            }).join(", ")}</td>
                                            <td>{request.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                            <td><span className={`outlets-request-status status-${request.status.toLowerCase()}`}>{request.status}</span></td>
                                            <td>{request.status === "Pending" ? <div className="outlets-actions"><button type="button" onClick={() => updateRequest(request.id, "Delivered")}>Mark Delivered</button><button type="button" className="outlets-cancel" onClick={() => updateRequest(request.id, "Cancelled")}>Cancel</button></div> : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default Outlets;