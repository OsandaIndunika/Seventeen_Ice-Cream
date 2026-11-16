import React from 'react'
import './RawMaterial.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { useState, useEffect, useRef } from "react";
import { Receipt, ReceiptText, Clipboard, RotateCcwClock, CircleChevronsLeft } from 'lucide-react'


function RawMaterial() {
    const [selectedBill, setSelectedBill] = useState(null);


    const [activeView, setActiveView] = useState("dashboard");

    const [billPreviewUrl, setBillPreviewUrl] = useState(null);

    useEffect(() => {
        if (!selectedBill?.file) {
            setBillPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(selectedBill.file);
        setBillPreviewUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [selectedBill]);

    const [pastBills, setPastBills] = useState([]);

    const [billSearch, setBillSearch] = useState("");

    const [selectedBillMonth, setSelectedBillMonth] = useState("all");


    const [supplierName, setSupplierName] = useState("");
    const [purchaseDate, setPurchaseDate] = useState("");
    const [billFile, setBillFile] = useState(null);
    const billFileInputRef = useRef(null);

    // to add many items when adding bill 

    const [purchaseItems, setPurchaseItems] = useState([]);

    const [currentItem, setCurrentItem] = useState({
        material: "",
        quantity: "",
        unit: "kg",
        totalAmount: ""
    });

    const [editingItemId, setEditingItemId] = useState(null);



    const [rawMaterials, setRawMaterials] = useState([
        { id: 1, name: "Fresh Milk", quantity: 420, unit: "L", capacity: 500 },
        { id: 2, name: "Sugar", quantity: 85, unit: "kg", capacity: 120 },
        { id: 3, name: "Cream", quantity: 60, unit: "L", capacity: 150 },
        { id: 4, name: "Cocoa Powder", quantity: 12, unit: "kg", capacity: 80 },
        { id: 5, name: "Strawberry Pulp", quantity: 95, unit: "kg", capacity: 150 },
        { id: 6, name: "Vanilla Extract", quantity: 3, unit: "L", capacity: 40 }
    ]);



    const handleAddMaterial = () => {
        const newMaterial = {
            id: crypto.randomUUID(),
            material: "",
            quantity: "",
            unit: "kg",
            unitPrice: ""
        };

        setPurchaseItems((prev) => [...prev, newMaterial]);
    };

    const handleRemoveMaterial = (id) => {
        setPurchaseItems((prev) =>
            prev.filter((item) => item.id !== id)
        );

        if (editingItemId === id) {
            setEditingItemId(null);

            setCurrentItem({
                material: "",
                quantity: "",
                unit: "kg",
                totalAmount: ""
            });
        }
    };





    const handleSavePurchase = () => {

        // Validate supplier name
        if (!supplierName.trim()) {
            alert("Please enter supplier name.");
            return;
        }

        // Validate purchase date
        if (!purchaseDate) {
            alert("Please select purchase date.");
            return;
        }

        // Check whether materials are added
        if (purchaseItems.length === 0) {
            alert("Please add at least one material.");
            return;
        }

        // Validate purchased materials
        const invalidItem = purchaseItems.some((item) => {

            const selectedMaterial = rawMaterials.find(
                (material) => material.name === item.material
            );

            return (
                !selectedMaterial ||
                selectedMaterial.unit !== item.unit ||
                item.quantity === "" ||
                !Number.isFinite(Number(item.quantity)) ||
                Number(item.quantity) <= 0 ||
                item.totalAmount === "" ||
                !Number.isFinite(Number(item.totalAmount)) ||
                Number(item.totalAmount) < 0
            );
        });

        if (invalidItem) {
            alert("Please check purchased material details.");
            return;
        }

        // Validate uploaded bill
        if (!billFile) {
            alert("Please upload a purchase bill.");
            return;
        }

        // Create purchase bill record
        const newBill = {
            id: `RM-${Date.now()}`,
            supplier: supplierName.trim(),
            date: purchaseDate,

            material: purchaseItems
                .map((item) => item.material)
                .join(", "),

            items: purchaseItems.map((item) => ({
                material: item.material,
                quantity: Number(item.quantity),
                unit: item.unit,
                totalAmount: Number(item.totalAmount)
            })),

            amount: totalCost.toFixed(2),
            file: billFile
        };

        // Update raw material stock
        setRawMaterials((prev) =>
            prev.map((material) => {

                const purchasedQuantity = purchaseItems
                    .filter(
                        (item) =>
                            item.material === material.name &&
                            item.unit === material.unit
                    )
                    .reduce(
                        (total, item) =>
                            total + Number(item.quantity),
                        0
                    );

                return {
                    ...material,
                    quantity: Number(
                        (material.quantity + purchasedQuantity).toFixed(3)
                    )
                };
            })
        );

        // Save bill to Past Bills
        setPastBills((prev) => [newBill, ...prev]);

        // Clear purchase form
        setSupplierName("");
        setPurchaseDate("");
        setBillFile(null);
        setPurchaseItems([]);
        setEditingItemId(null);

        setCurrentItem({
            material: "",
            quantity: "",
            unit: "kg",
            totalAmount: ""
        });

        // Clear uploaded file input
        if (billFileInputRef.current) {
            billFileInputRef.current.value = "";
        }

        alert("Purchase saved and stock updated successfully!");
    };



    const handleItemChange = (id, field, value) => {
        setPurchaseItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, [field]: value }
                    : item
            )
        );
    };


    const totalCost = purchaseItems.reduce(
        (total, item) => total + Number(item.totalAmount || 0),
        0
    );




    const handleUseMaterial = (id) => {
        const selectedMaterial = rawMaterials.find(
            (material) => material.id === id
        );

        if (!selectedMaterial) return;

        setCurrentUsage({
            material: selectedMaterial.name,
            quantity: ""
        });

        setActiveView("usage");
    };




    const handleAddNewMaterial = () => {
        const name = prompt("Enter new material name:");

        if (name === null) return;

        const materialName = name.trim();

        if (!materialName) {
            alert("Please enter a material name.");
            return;
        }

        // Check whether material already exists
        const alreadyExists = rawMaterials.some(
            (item) =>
                item.name.toLowerCase() === materialName.toLowerCase()
        );

        if (alreadyExists) {
            alert("This material already exists!");
            return;
        }

        const unit = prompt("Enter unit (kg, L, pcs):");

        if (unit === null) return;

        if (!["kg", "L", "pcs"].includes(unit.trim())) {
            alert("Please enter a valid unit: kg, L or pcs.");
            return;
        }

        const capacityInput = prompt("Enter stock capacity:");

        if (capacityInput === null) return;

        const capacity = Number(capacityInput);

        if (
            capacityInput.trim() === "" ||
            !Number.isFinite(capacity) ||
            capacity <= 0
        ) {
            alert("Please enter a valid capacity.");
            return;
        }

        const newMaterial = {
            id: crypto.randomUUID(),
            name: materialName,
            quantity: 0,
            unit: unit.trim(),
            capacity: capacity
        };

        setRawMaterials((prev) => [...prev, newMaterial]);

        alert("New material added successfully!");
    };


    const handleDownloadBill = () => {
        if (!billPreviewUrl || !selectedBill?.file) return;

        const link = document.createElement("a");
        link.href = billPreviewUrl;
        link.download = selectedBill.file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handlePrintBill = () => {
        if (!billPreviewUrl) return;

        const printWindow = window.open(billPreviewUrl, "_blank");

        if (!printWindow) {
            alert("Please allow pop-ups to print the bill.");
        }
    };


    const totalMaterials = rawMaterials.length;

    const lowStockCount = rawMaterials.filter((material) => {
        const percentage =
            (material.quantity / material.capacity) * 100;

        return percentage <= 25;
    }).length;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlySpending = pastBills
        .filter((bill) => {
            const date = new Date(bill.date);

            return (
                !Number.isNaN(date.getTime()) &&
                date.getMonth() === currentMonth &&
                date.getFullYear() === currentYear
            );
        })
        .reduce((total, bill) => total + Number(bill.amount), 0);

    const totalBills = pastBills.length;

    const handleCurrentItemChange = (field, value) => {
        setCurrentItem((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddOrUpdateMaterial = () => {
        const { material, quantity, unit, totalAmount } = currentItem;

        if (
            !material ||
            !Number.isFinite(Number(quantity)) ||
            quantity === "" ||
            Number(quantity) <= 0 ||
            totalAmount === "" ||
            !Number.isFinite(Number(totalAmount)) ||
            Number(totalAmount) < 0
        ) {
            alert("Please enter valid material details.");
            return;
        }

        const selectedMaterial = rawMaterials.find(
            (item) => item.name === material
        );

        if (!selectedMaterial || selectedMaterial.unit !== unit) {
            alert("Please select a valid material and unit.");
            return;
        }

        if (editingItemId !== null) {
            setPurchaseItems((prev) =>
                prev.map((item) =>
                    item.id === editingItemId
                        ? { ...currentItem, id: editingItemId }
                        : item
                )
            );

            setEditingItemId(null);
        } else {
            setPurchaseItems((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    ...currentItem
                }
            ]);
        }

        setCurrentItem({
            material: "",
            quantity: "",
            unit: "kg",
            totalAmount: ""
        });
    };

    const handleEditMaterial = (id) => {
        const itemToEdit = purchaseItems.find(
            (item) => item.id === id
        );

        if (!itemToEdit) return;

        setCurrentItem({
            material: itemToEdit.material,
            quantity: itemToEdit.quantity,
            unit: itemToEdit.unit,
            totalAmount: itemToEdit.totalAmount
        });

        setEditingItemId(id);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);

        setCurrentItem({
            material: "",
            quantity: "",
            unit: "kg",
            totalAmount: ""
        });
    };

    const [usageDate, setUsageDate] = useState(
        new Date().toLocaleDateString("en-CA")
    );

    const [currentUsage, setCurrentUsage] = useState({
        material: "",
        quantity: ""
    });

    const [usageItems, setUsageItems] = useState([]);

    const [usageHistory, setUsageHistory] = useState([]);

    const [usageSearch, setUsageSearch] = useState("");
    const [usageFilterDate, setUsageFilterDate] = useState("");




    const handleAddUsageMaterial = () => {
        const material = rawMaterials.find(
            (item) => item.name === currentUsage.material
        );

        const quantity = Number(currentUsage.quantity);

        if (!material) {
            alert("Please select a raw material.");
            return;
        }

        if (
            currentUsage.quantity.trim() === "" ||
            !Number.isFinite(quantity) ||
            quantity <= 0
        ) {
            alert("Please enter a valid quantity.");
            return;
        }

        const alreadyAdded = usageItems
            .filter((item) => item.materialId === material.id)
            .reduce((total, item) => total + item.quantity, 0);

        if (quantity + alreadyAdded > material.quantity) {
            alert("Insufficient stock.");
            return;
        }

        const newUsage = {
            id: crypto.randomUUID(),
            materialId: material.id,
            material: material.name,
            quantity: quantity,
            unit: material.unit
        };

        setUsageItems((prev) => [...prev, newUsage]);

        setCurrentUsage({
            material: "",
            quantity: ""
        });
    };


    const handleSaveUsage = () => {

        if (!usageDate) {
            alert("Please select a usage date.");
            return;
        }

        if (usageItems.length === 0) {
            alert("Please add at least one material.");
            return;
        }

        // Check stock availability before saving
        const insufficientMaterial = rawMaterials.find((material) => {
            const totalUsed = usageItems
                .filter((item) => item.materialId === material.id)
                .reduce((total, item) => total + item.quantity, 0);

            return totalUsed > material.quantity;
        });

        if (insufficientMaterial) {
            alert(`Insufficient stock for ${insufficientMaterial.name}.`);
            return;
        }

        // Reduce quantities from current stock
        setRawMaterials((prev) =>
            prev.map((material) => {
                const totalUsed = usageItems
                    .filter((item) => item.materialId === material.id)
                    .reduce((total, item) => total + item.quantity, 0);

                return {
                    ...material,
                    quantity: Number(
                        (material.quantity - totalUsed).toFixed(3)
                    )
                };
            })
        );

        // Save records to usage history
        const newRecords = usageItems.map((item) => ({
            id: crypto.randomUUID(),
            date: usageDate,
            materialId: item.materialId,
            material: item.material,
            quantity: item.quantity,
            unit: item.unit
        }));

        setUsageHistory((prev) => [...prev, ...newRecords]);

        // Clear form after saving
        setUsageItems([]);
        setCurrentUsage({
            material: "",
            quantity: ""
        });

        alert("Raw material usage saved successfully!");
    };


    const filteredUsageHistory = usageHistory.filter((record) => {
        const matchesMaterial = record.material
            .toLowerCase()
            .includes(usageSearch.trim().toLowerCase());

        const matchesDate =
            usageFilterDate === "" || record.date === usageFilterDate;

        return matchesMaterial && matchesDate;
    });

    const filteredBills = pastBills.filter((bill) => {
        const searchText = billSearch.trim().toLowerCase();

        // Search by Supplier Name or Bill Number
        const matchesSearch =
            String(bill.supplier ?? "")
                .toLowerCase()
                .includes(searchText) ||
            String(bill.id ?? "")
                .toLowerCase()
                .includes(searchText);

        // Filter by Month
        const matchesMonth =
            selectedBillMonth === "all" ||
            bill.date?.slice(0, 7) === selectedBillMonth;

        return matchesSearch && matchesMonth;
    });











    return (
        <div className='raw-material-page'>
            <SideBar />
            <div className='main-content'>
                <Header headername="Raw Material" />
                <div className='raw-material-dashboard'>
                    {/* Summery card section */}

                    {activeView === "dashboard" && (
                        <>
                            <section className="material-summary-container">

                                <div className="material-summary-card">
                                    <span className="material-summary-label">
                                        Material Track
                                    </span>

                                    <strong className="material-summary-value">
                                        {totalMaterials}
                                    </strong>

                                    <span className="material-summary-description">
                                        Raw materials registered
                                    </span>
                                </div>

                                <div className="material-summary-card">
                                    <span className="material-summary-label">
                                        Low Stock Alert
                                    </span>

                                    <strong className="material-summary-value">
                                        {lowStockCount}
                                    </strong>

                                    <span className="material-summary-description">
                                        Low and critical stock items
                                    </span>
                                </div>

                                <div className="material-summary-card">
                                    <span className="material-summary-label">
                                        Spend This Month
                                    </span>

                                    <strong className="material-summary-value">
                                        Rs. {monthlySpending.toLocaleString("en-LK")}
                                    </strong>

                                    <span className="material-summary-description">
                                        Current month purchases
                                    </span>
                                </div>

                                <div className="material-summary-card">
                                    <span className="material-summary-label">
                                        Bills Saved
                                    </span>

                                    <strong className="material-summary-value">
                                        {totalBills}
                                    </strong>

                                    <span className="material-summary-description">
                                        Total purchase bills
                                    </span>
                                </div>

                            </section>
                        </>
                    )}

                    <div className="raw-material-actions">

                        <button
                            type="button"
                            className="raw-action-btn"
                            onClick={() => setActiveView("purchase")}
                        >
                            <Receipt size={15} />
                            Add Purchase
                        </button>

                        <button
                            type="button"
                            className="raw-action-btn"
                            onClick={() => setActiveView("bills")}
                        >
                            <ReceiptText size={15} />
                            Past Bills
                        </button>

                        <button
                            type="button"
                            className="raw-action-btn"
                            onClick={() => setActiveView("usage")}
                        >
                            <Clipboard size={15} />
                            Record Usage
                        </button>

                        <button
                            type="button"
                            className="raw-action-btn"
                            onClick={() => setActiveView("history")}
                        >
                            <RotateCcwClock size={15} />
                            Usage History
                        </button>


                        <button
                            type="button"
                            className="raw-action-btn raw-dashboard-btn"
                            onClick={() => {
                                setActiveView("dashboard");
                                setSelectedBill(null);
                            }}
                        >
                            <CircleChevronsLeft size={15} />
                            Back to Dashboard
                        </button>


                    </div>



                    <div className="material-content-grid">
                        {activeView === "dashboard" && (
                            <section className="remaining-materials">

                                <div className="remaining-materials-header">
                                    <h3>Remaining Raw Materials</h3>
                                    <button className="add-material-btn" onClick={handleAddNewMaterial}>
                                        + New Material
                                    </button>
                                </div>

                                <div className="material-table-wrapper">
                                    <table className="material-table">
                                        <thead>
                                            <tr>
                                                <th>Material</th>
                                                <th>Remaining</th>
                                                <th>Level</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>


                                        <tbody>
                                            {rawMaterials.map((material) => {
                                                const percentage = Math.min(
                                                    (material.quantity / material.capacity) * 100,
                                                    100
                                                );

                                                const status =
                                                    percentage <= 10
                                                        ? "critical"
                                                        : percentage <= 25
                                                            ? "low"
                                                            : "good";

                                                return (
                                                    <tr key={material.id}>
                                                        <td>{material.name}</td>
                                                        <td>
                                                            {material.quantity} {material.unit}
                                                        </td>
                                                        <td>
                                                            <div className="stock-progress">
                                                                <div
                                                                    className={`stock-progress-fill ${status === "good" ? "" : status
                                                                        }`}
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={`stock-status ${status}`}>
                                                                {status === "good"
                                                                    ? "Good"
                                                                    : status === "low"
                                                                        ? "Low"
                                                                        : "Critical"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="material-add-btn"
                                                                onClick={() => handleUseMaterial(material.id)}

                                                            >
                                                                Use
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}



                        {activeView === "purchase" && (
                            <section className="add-purchase">

                                <div className="purchase-header">
                                    <h3>Add Purchase</h3>
                                </div>

                                <div className="purchase-form">

                                    {/* Supplier Name */}
                                    <div className="purchase-field">
                                        <label>Supplier Name</label>
                                        <input
                                            type="text"
                                            placeholder="Enter supplier name"
                                            value={supplierName}
                                            onChange={(e) => setSupplierName(e.target.value)}
                                        />
                                    </div>

                                    {/* Purchase Date */}
                                    <div className="purchase-field">
                                        <label>Purchase Date</label>
                                        <input
                                            type="date"
                                            value={purchaseDate}
                                            onChange={(e) => setPurchaseDate(e.target.value)}
                                        />
                                    </div>

                                    {/* Purchased Materials */}

                                    <div className="purchase-items-section">

                                        <h4>Purchased Materials</h4>

                                        {/* Material Entry Form */}
                                        <div className="purchase-item-card">

                                            <div className="purchase-item-header">
                                                <span>
                                                    {editingItemId !== null
                                                        ? "Edit Material"
                                                        : "Add Raw Material"}
                                                </span>
                                            </div>

                                            <div className="purchase-field">
                                                <label>Raw Material</label>

                                                <select
                                                    value={currentItem.material}
                                                    onChange={(e) => {
                                                        const selectedName = e.target.value;
                                                        const selectedMaterial = rawMaterials.find(
                                                            (material) => material.name === selectedName
                                                        );

                                                        setCurrentItem((prev) => ({
                                                            ...prev,
                                                            material: selectedName,
                                                            unit: selectedMaterial?.unit || "kg"
                                                        }));
                                                    }}
                                                >
                                                    <option value="" disabled>Select Material</option>

                                                    {rawMaterials.map((material) => (
                                                        <option key={material.id} value={material.name}>
                                                            {material.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="purchase-compact-row">

                                                <div className="purchase-field">
                                                    <label>Quantity</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Qty"
                                                        value={currentItem.quantity}
                                                        onChange={(e) =>
                                                            handleCurrentItemChange("quantity", e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="purchase-field">
                                                    <label>Unit</label>
                                                    <input
                                                        type="text"
                                                        value={currentItem.unit}
                                                        readOnly
                                                    />
                                                </div>

                                                <div className="purchase-field">
                                                    <label>Total Amount (Rs.)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Amount"
                                                        value={currentItem.totalAmount}
                                                        onChange={(e) =>
                                                            handleCurrentItemChange("totalAmount", e.target.value)
                                                        }
                                                    />
                                                </div>

                                            </div>


                                            <div className="purchase-form-actions">

                                                <button
                                                    type="button"
                                                    className="add-purchase-item-btn"
                                                    onClick={handleAddOrUpdateMaterial}
                                                >
                                                    {editingItemId !== null
                                                        ? "Update Material"
                                                        : "+ Add Material"}
                                                </button>

                                                {editingItemId !== null && (
                                                    <button
                                                        type="button"
                                                        className="cancel-material-edit-btn"
                                                        onClick={handleCancelEdit}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}

                                            </div>


                                        </div>

                                        {/* Added Materials List */}
                                        {purchaseItems.length > 0 && (
                                            <div className="added-materials-list">

                                                <h4>Added Materials ({purchaseItems.length})</h4>

                                                {purchaseItems.map((item) => (
                                                    <div className="added-material-row" key={item.id}>

                                                        <div className="added-material-info">
                                                            <strong>{item.material}</strong>
                                                            <span>
                                                                {item.quantity} {item.unit} · Rs.{" "}
                                                                {Number(item.totalAmount).toFixed(2)}
                                                            </span>
                                                        </div>

                                                        <div className="added-material-actions">
                                                            <button
                                                                type="button"
                                                                className="added-material-edit"
                                                                onClick={() => handleEditMaterial(item.id)}
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="added-material-remove"
                                                                onClick={() => handleRemoveMaterial(item.id)}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>

                                                    </div>
                                                ))}

                                            </div>
                                        )}

                                    </div>


                                    {/* Total Cost */}
                                    <div className="purchase-field">
                                        <label>Total Cost (Rs)</label>
                                        <input
                                            type="number"
                                            value={totalCost.toFixed(2)}
                                            readOnly
                                        />
                                    </div>

                                    {/* Bill / Receipt Upload */}
                                    <div className="purchase-field">
                                        <label>Bill / Receipt</label>

                                        <div className="purchase-receipt-box">

                                            <div className="receipt-placeholder">
                                                <span>RECEIPT</span>
                                                <div className="receipt-line"></div>
                                                <div className="receipt-line short"></div>
                                                <div className="receipt-line"></div>
                                                <div className="receipt-line short"></div>
                                            </div>

                                            <div className="receipt-upload">
                                                <p>Upload Purchase Bill</p>

                                                <input
                                                    ref={billFileInputRef}
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    className="purchase-file-input"
                                                    onChange={(e) =>
                                                        setBillFile(e.target.files[0] || null)
                                                    }
                                                />
                                            </div>

                                        </div>
                                    </div>

                                    {/* Save Purchase */}
                                    <button
                                        type="button"
                                        className="purchase-save-btn"
                                        onClick={handleSavePurchase}
                                    >
                                        Save Purchase & Update Stock
                                    </button>

                                </div>
                            </section>
                        )}

                    </div>

                    {activeView === "bills" && (
                        <div className={`material-bills-grid ${selectedBill ? "preview-open" : ""}`}>
                            <section className="past-bills">

                                <h3>Past Bills</h3>

                                <div className="past-bills-filters">

                                    <input
                                        type="text"
                                        placeholder="Search by supplier or bill number..."
                                        value={billSearch}
                                        onChange={(e) => setBillSearch(e.target.value)}
                                    />



                                    <select
                                        value={selectedBillMonth}
                                        onChange={(e) => setSelectedBillMonth(e.target.value)}
                                    >
                                        <option value="all">All Months</option>

                                        {[...new Set(
                                            pastBills
                                                .map((bill) => bill.date?.slice(0, 7))
                                                .filter(Boolean)
                                        )]
                                            .sort()
                                            .reverse()
                                            .map((month) => (
                                                <option key={month} value={month}>
                                                    {new Date(`${month}-01T00:00:00`).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            month: "long",
                                                            year: "numeric"
                                                        }
                                                    )}
                                                </option>
                                            ))}
                                    </select>

                                </div>
                                <div className="past-bills-grid">
                                    {filteredBills.length === 0 ? (
                                        <p className="no-bills-message">

                                            {pastBills.length === 0
                                                ? "No bills available."
                                                : "No bills match your search or selected month."}

                                        </p>
                                    ) : (
                                        filteredBills.map((bill) => (
                                            <div className="past-bill-card" key={bill.id}>

                                                <div className="bill-receipt-placeholder">
                                                    {bill.file ? (
                                                        bill.file.type.startsWith("image/") ? (
                                                            <img
                                                                src={URL.createObjectURL(bill.file)}
                                                                alt={`Receipt ${bill.id}`}
                                                                className="past-bill-image"
                                                            />
                                                        ) : bill.file.type === "application/pdf" ? (
                                                            <div className="past-bill-pdf">
                                                                <span>📄</span>
                                                                <p>PDF Receipt</p>
                                                            </div>
                                                        ) : (
                                                            <p>Unsupported file</p>
                                                        )
                                                    ) : (
                                                        <p>No Receipt Uploaded</p>
                                                    )}
                                                </div>


                                                <div className="past-bill-info">
                                                    <strong>{bill.id}</strong>
                                                    <span>Rs. {bill.amount}</span>
                                                </div>

                                                <p className="past-bill-supplier">
                                                    {bill.supplier}
                                                </p>

                                                <p className="past-bill-details">
                                                    {bill.material} • {bill.date}
                                                </p>

                                                <button
                                                    type="button"
                                                    className="view-bill-btn"
                                                    onClick={() => setSelectedBill(bill)}
                                                >
                                                    View Bill
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                            </section>


                            {selectedBill && (
                                <section className="bill-preview">

                                    <div className="bill-preview-header">
                                        <h3>Bill Preview</h3>

                                        <button
                                            type="button"
                                            className="bill-preview-close"
                                            onClick={() => setSelectedBill(null)}
                                        >
                                            ✕
                                        </button>
                                    </div>


                                    {/* Actual Bill Preview */}

                                    <div className="bill-preview-receipt">
                                        {billPreviewUrl ? (
                                            selectedBill.file.type.startsWith("image/") ? (
                                                <img
                                                    src={billPreviewUrl}
                                                    alt="Purchase Bill"
                                                    className="bill-preview-image"
                                                />
                                            ) : (
                                                <iframe
                                                    src={billPreviewUrl}
                                                    title="Purchase Bill PDF"
                                                    className="bill-preview-pdf"
                                                />
                                            )
                                        ) : (
                                            <p>No bill image uploaded.</p>
                                        )}
                                    </div>


                                    {/* Selected Bill Details */}
                                    <div className="bill-preview-details">

                                        <div className="bill-preview-detail-row">
                                            <span>Bill Number</span>
                                            <strong>{selectedBill.id}</strong>
                                        </div>

                                        <div className="bill-preview-detail-row">
                                            <span>Supplier</span>
                                            <strong>{selectedBill.supplier}</strong>
                                        </div>

                                        <div className="bill-preview-detail-row">
                                            <span>Purchase Date</span>
                                            <strong>{selectedBill.date}</strong>
                                        </div>

                                        <div className="bill-preview-detail-row">
                                            <span>Raw Materials</span>
                                            <strong>{selectedBill.material}</strong>
                                        </div>

                                        <div className="bill-preview-detail-row">
                                            <span>Total Amount</span>
                                            <strong>Rs. {selectedBill.amount}</strong>
                                        </div>

                                    </div>

                                    {/* Action Buttons */}
                                    <div className="bill-preview-actions">
                                        <button
                                            type="button"
                                            className="bill-download-btn"
                                            onClick={handleDownloadBill}
                                        >
                                            Download
                                        </button>

                                        <button
                                            type="button"
                                            className="bill-print-btn"
                                            onClick={handlePrintBill}
                                        >
                                            Open to Print
                                        </button>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}


                    {activeView === "usage" && (
                        <section className="raw-usage-view">

                            <h3>Record Raw Material Usage</h3>

                            <div className="usage-form">

                                {/* Usage Date */}
                                <div className="usage-field">
                                    <label>Usage Date</label>
                                    <input
                                        type="date"
                                        value={usageDate}
                                        onChange={(e) => setUsageDate(e.target.value)}
                                    />
                                </div>

                                {/* Material Selection */}
                                <div className="usage-field">
                                    <label>Raw Material</label>
                                    <select
                                        value={currentUsage.material}
                                        onChange={(e) =>
                                            setCurrentUsage((prev) => ({
                                                ...prev,
                                                material: e.target.value,
                                                quantity: ""
                                            }))
                                        }
                                    >
                                        <option value="">Select Raw Material</option>

                                        {rawMaterials.map((material) => (
                                            <option key={material.id} value={material.name}>
                                                {material.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Used Quantity */}
                                <div className="usage-field">
                                    <label>Used Quantity</label>

                                    <div className="usage-quantity-row">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="Enter used quantity"
                                            value={currentUsage.quantity}
                                            onChange={(e) =>
                                                setCurrentUsage((prev) => ({
                                                    ...prev,
                                                    quantity: e.target.value
                                                }))
                                            }
                                        />

                                        <span className="usage-unit">
                                            {rawMaterials.find(
                                                (material) => material.name === currentUsage.material
                                            )?.unit || "Unit"}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="usage-add-btn"
                                    onClick={handleAddUsageMaterial}
                                >
                                    + Add Material
                                </button>

                            </div>

                            {/* Added Usage Materials */}
                            {usageItems.length > 0 && (
                                <div className="usage-items-section">

                                    <h4>Added Materials ({usageItems.length})</h4>

                                    <div className="material-table-wrapper">
                                        <table className="material-table">
                                            <thead>
                                                <tr>
                                                    <th>Material</th>
                                                    <th>Used Quantity</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {usageItems.map((item) => (
                                                    <tr key={item.id}>
                                                        <td>{item.material}</td>

                                                        <td>
                                                            {item.quantity} {item.unit}
                                                        </td>

                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="usage-remove-btn"
                                                                onClick={() =>
                                                                    setUsageItems((prev) =>
                                                                        prev.filter((usage) => usage.id !== item.id)
                                                                    )
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            )}


                            {usageItems.length > 0 && (
                                <div className="usage-save-actions">
                                    <button
                                        type="button"
                                        className="usage-save-btn"
                                        onClick={handleSaveUsage}
                                    >
                                        Save Usage & Update Stock
                                    </button>
                                </div>
                            )}


                        </section>
                    )}


                    {/* Usage History */}

                    {activeView === "history" && (
                        <section className="raw-history-view">

                            <h3>Raw Material Usage History</h3>

                            <div className="usage-history-filters">

                                <input
                                    type="text"
                                    placeholder="Search raw material..."
                                    value={usageSearch}
                                    onChange={(e) => setUsageSearch(e.target.value)}
                                />

                                <input
                                    type="date"
                                    value={usageFilterDate}
                                    onChange={(e) => setUsageFilterDate(e.target.value)}
                                />

                                <button
                                    type="button"
                                    className="usage-clear-btn"
                                    onClick={() => {
                                        setUsageSearch("");
                                        setUsageFilterDate("");
                                    }}
                                >
                                    Clear Filters
                                </button>

                            </div>


                            <div className="material-table-wrapper">
                                <table className="material-table">

                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Raw Material</th>
                                            <th>Used Quantity</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredUsageHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="usage-empty-message">
                                                    No usage records found.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...filteredUsageHistory].reverse().map((record) => (
                                                <tr key={record.id}>
                                                    <td>{record.date}</td>
                                                    <td>{record.material}</td>
                                                    <td>
                                                        {record.quantity} {record.unit}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>

                                </table>
                            </div>

                        </section>
                    )}




                </div>
            </div>
        </div>
    )
}

export default RawMaterial