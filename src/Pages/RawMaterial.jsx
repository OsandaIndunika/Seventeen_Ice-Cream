import React, { useState } from "react";
import "./RawMaterial.css";

import SideBar from "../Components/SideBar/SideBar";
import Header from "../Components/Header/Header";

import SummaryCards from "../Components/RawMaterial/SummaryCards";
import MaterialActions from "../Components/RawMaterial/MaterialActions";
import MaterialTable from "../Components/RawMaterial/MaterialTable";
import AddPurchase from "../Components/RawMaterial/AddPurchase";
import PastBills from "../Components/RawMaterial/PastBills";
import BillPreview from "../Components/RawMaterial/BillPreview";
import RecordUsage from "../Components/RawMaterial/RecordUsage";
import UsageHistory from "../Components/RawMaterial/UsageHistory";



function RawMaterial() {

    const [activeView, setActiveView] = useState("dashboard");
    const [selectedBill, setSelectedBill] = useState(null);
    const [selectedUsageMaterial, setSelectedUsageMaterial] = useState("");
    const [pastBills, setPastBills] = useState([]);
    const [usageHistory, setUsageHistory] = useState([]);

    const [rawMaterials, setRawMaterials] = useState([
        { id: 1, name: "Fresh Milk", quantity: 420, unit: "L", capacity: 500 },
        { id: 2, name: "Sugar", quantity: 85, unit: "kg", capacity: 120 },
        { id: 3, name: "Cream", quantity: 60, unit: "L", capacity: 150 },
        { id: 4, name: "Cocoa Powder", quantity: 12, unit: "kg", capacity: 80 },
        { id: 5, name: "Strawberry Pulp", quantity: 95, unit: "kg", capacity: 150 },
        { id: 6, name: "Vanilla Extract", quantity: 3, unit: "L", capacity: 40 }
    ]);

    const handleUseMaterial = (id) => {
        const selectedMaterial = rawMaterials.find(
            (material) => material.id === id
        );

        if (!selectedMaterial) return;

        setSelectedUsageMaterial(selectedMaterial.name);
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


    const handleUsageSaved = (newUsage) => {
        if (!newUsage.items?.length) {
            alert("No materials selected.");
            return false;
        }

        const invalidMaterial = newUsage.items.find((item) => {
            const material = rawMaterials.find(
                (m) => m.name === item.material
            );

            const totalUsed = newUsage.items
                .filter((i) => i.material === item.material)
                .reduce((sum, i) => sum + Number(i.quantity), 0);

            return (
                !material ||
                !Number.isFinite(Number(item.quantity)) ||
                Number(item.quantity) <= 0 ||
                totalUsed > material.quantity
            );
        });

        if (invalidMaterial) {
            alert(
                `Invalid quantity or insufficient stock for ${invalidMaterial.material}.`
            );
            return false;
        }

        setRawMaterials((prev) =>
            prev.map((material) => {
                const usedQuantity = newUsage.items
                    .filter((item) => item.material === material.name)
                    .reduce(
                        (total, item) => total + Number(item.quantity),
                        0
                    );

                return {
                    ...material,
                    quantity: Number(
                        (material.quantity - usedQuantity).toFixed(3)
                    )
                };
            })
        );

        setUsageHistory((prev) => [newUsage, ...prev]);

        return true;
    };


    const handlePurchaseSaved = (newBill) => {
        setRawMaterials((prev) =>
            prev.map((material) => {
                const purchasedQuantity = newBill.items
                    .filter(
                        (item) =>
                            item.material === material.name &&
                            item.unit === material.unit
                    )
                    .reduce(
                        (total, item) => total + Number(item.quantity),
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

        setPastBills((prev) => [newBill, ...prev]);
    };

    return (
        <div className='raw-material-page'>
            <SideBar />
            <div className='main-content'>
                <Header headername="Raw Material" description="Track raw material stock, purchases and daily usage." />
                <div className='raw-material-dashboard'>
                    {/* Summery card section */}
                    {activeView === "dashboard" && (
                        <SummaryCards
                            totalMaterials={totalMaterials}
                            lowStockCount={lowStockCount}
                            monthlySpending={monthlySpending}
                            totalBills={totalBills}
                        />
                    )}

                    {/* Buttons set */}
                    <MaterialActions
                        activeView={activeView}
                        setActiveView={setActiveView}
                        setSelectedBill={setSelectedBill}
                    />



                    <div className="material-content-grid">

                        {activeView === "dashboard" && (
                            <MaterialTable
                                rawMaterials={rawMaterials}
                                handleAddNewMaterial={handleAddNewMaterial}
                                handleUseMaterial={handleUseMaterial}
                            />
                        )}


                        {activeView === "purchase" && (
                            <AddPurchase
                                rawMaterials={rawMaterials}
                                onSavePurchase={handlePurchaseSaved}
                            />
                        )}

                    </div>

                    {activeView === "bills" && (
                        <div className={`material-bills-grid ${selectedBill ? "preview-open" : ""}`}>

                            <PastBills
                                pastBills={pastBills}
                                setSelectedBill={setSelectedBill}
                            />



                            {selectedBill && (
                                <BillPreview
                                    selectedBill={selectedBill}
                                    setSelectedBill={setSelectedBill}
                                />
                            )}
                        </div>
                    )}




                    {activeView === "usage" && (
                        <RecordUsage
                            rawMaterials={rawMaterials}
                            selectedUsageMaterial={selectedUsageMaterial}
                            onSaveUsage={handleUsageSaved}
                        />
                    )}


                    {/* Usage History */}

                    {activeView === "history" && (
                        <UsageHistory usageHistory={usageHistory} />
                    )}
                </div>
            </div>
        </div>
    )
}

export default RawMaterial