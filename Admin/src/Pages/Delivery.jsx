import React from 'react'
import './Delivery.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { RotateCcw} from "lucide-react";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState } from "react";

function Delivery() {

    const shopDistributions = [
        {
            id: 1,
            shop: "City Mart",
            productType: "Popsicle",
            flavour: "Mango",
            quantity: 100,
            vehicle: "VAN-01",
            date: "2026-11-17",
            status: "Delivered"
        },
        {
            id: 2,
            shop: "City Mart",
            productType: "Ice Cream Tub",
            flavour: "Vanilla",
            quantity: 50,
            vehicle: "VAN-01",
            date: "2026-11-17",
            status: "Pending"
        },
        {
            id: 3,
            shop: "Fresh Food",
            productType: "Ice Cream Bag",
            flavour: "Chocolate",
            quantity: 80,
            vehicle: "VAN-02",
            date: "2026-11-17",
            status: "In Transit"
        },
        {
            id: 4,
            shop: "Sun Stores",
            productType: "Ice Packet",
            flavour: "Strawberry",
            quantity: 120,
            vehicle: "TRUCK-01",
            date: "2026-11-17",
            status: "Pending"
        }
    ];


    const vehicleSales = [
        {
            id: 1,
            vehicle: "VAN-02",
            driver: "K. Bandara",
            route: "Colombo South",
            sales: 1150,
            topFlavour: "Strawberry",
            date: "2026-09-20"
        },
        {
            id: 2,
            vehicle: "VAN-01",
            driver: "M. Rathnayaka",
            route: "Colombo North",
            sales: 980,
            topFlavour: "Chocolate",
            date: "2026-09-22"
        },
        {
            id: 3,
            vehicle: "TRUCK-01",
            driver: "D. Wickrama",
            route: "Kandy Road",
            sales: 830,
            topFlavour: "Vanilla",
            date: "2026-09-24"
        },
        {
            id: 4,
            vehicle: "BIKE-01",
            driver: "P. Gunasekara",
            route: "Nugegoda",
            sales: 460,
            topFlavour: "Mango",
            date: "2026-09-26"
        }
    ];


    const weeklySales = [
        { day: "Mon", sales: 800, target: 1200 },
        { day: "Tue", sales: 1000, target: 1500 },
        { day: "Wed", sales: 900, target: 1100 },
        { day: "Thu", sales: 1300, target: 1700 },
        { day: "Fri", sales: 1600, target: 2100 },
        { day: "Sat", sales: 2100, target: 2600 },
        { day: "Sun", sales: 1900, target: 2400 }
    ];

    const [filterShop, setFilterShop] = useState("");
    const [filterProductType, setFilterProductType] = useState("");
    const [filterFlavour, setFilterFlavour] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterStatus, setFilterStatus] = useState("");





    const filteredDistributions = shopDistributions.filter((item) => {
        return (
            (filterShop === "" || item.shop === filterShop) &&
            (filterProductType === "" || item.productType === filterProductType) &&
            (filterFlavour === "" || item.flavour === filterFlavour) &&
            (filterDate === "" || item.date === filterDate) &&
            (filterStatus === "" || item.status === filterStatus)
        );
    });

    const totalDistributedQuantity = filteredDistributions.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    const handleClearFilters = () => {
        setFilterShop("");
        setFilterProductType("");
        setFilterFlavour("");
        setFilterDate("");
        setFilterStatus("");
    };
    
const today = new Date().toLocaleDateString("en-CA");

const activeVehicles = new Set(
    shopDistributions
        .filter(item => item.status === "In Transit")
        .map(item => item.vehicle)
).size;

const shopsDeliveredToday = new Set(
    shopDistributions
        .filter(item =>
            item.status === "Delivered" &&
            item.date === today
        )
        .map(item => item.shop)
).size;

// Temporary sample value until backend integration
const deliverySalesToday = 3420;






    return (
        <div className='delivery-page'>
            <SideBar />

            <main className='main-content'>
                <Header headername="Delivery" description="Manage delivery vehicles"/>

                <div className="delivery-dashboard">

                    
<section className="delivery-summary">

    <div className="delivery-summary-card">
        <span className="delivery-summary-label">
            Delivery Sales Today
        </span>

        <strong className="delivery-summary-value">
            Rs. {deliverySalesToday.toLocaleString()}
        </strong>

        <span className="delivery-summary-detail">
            Today's delivery sales
        </span>
    </div>

    <div className="delivery-summary-card">
        <span className="delivery-summary-label">
            Active Vehicles
        </span>

        <strong className="delivery-summary-value">
            {activeVehicles}
        </strong>

        <span className="delivery-summary-detail">
            Currently in transit
        </span>
    </div>

    <div className="delivery-summary-card">
        <span className="delivery-summary-label">
            Shops Delivered Today
        </span>

        <strong className="delivery-summary-value">
            {shopsDeliveredToday}
        </strong>

        <span className="delivery-summary-detail">
            Shops successfully delivered today
        </span>
    </div>

</section>



                    <section className="shop-distribution-card">

                        <div className="shop-distribution-heading">
                            <h2>Shop Distribution Details</h2>
                            <p>Ice cream products distributed to each shop.</p>
                        </div>

                        <div className="shop-distribution-filters">

                            <select
                                value={filterShop}
                                onChange={(e) => setFilterShop(e.target.value)}
                            >
                                <option value="">All Shops</option>

                                {[...new Set(shopDistributions.map(item => item.shop))]
                                    .map(shop => (
                                        <option key={shop} value={shop}>
                                            {shop}
                                        </option>
                                    ))
                                }
                            </select>

                            <select
                                value={filterProductType}
                                onChange={(e) => setFilterProductType(e.target.value)}
                            >
                                <option value="">All Product Types</option>

                                {[...new Set(shopDistributions.map(item => item.productType))]
                                    .map(type => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))
                                }
                            </select>

                            <select
                                value={filterFlavour}
                                onChange={(e) => setFilterFlavour(e.target.value)}
                            >
                                <option value="">All Flavours</option>

                                {[...new Set(shopDistributions.map(item => item.flavour))]
                                    .map(flavour => (
                                        <option key={flavour} value={flavour}>
                                            {flavour}
                                        </option>
                                    ))
                                }
                            </select>

                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="distribution-date-filter"
                            />

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Delivered">Delivered</option>
                            </select>


                            <button
                                type="button"
                                className="distribution-clear-btn"
                                onClick={handleClearFilters}
                            ><RotateCcw size={15} />
                                Clear Filters
                            </button>


                        </div>

                        <div className="distribution-results">

                            <span>
                                Showing {filteredDistributions.length} records
                            </span>

                            <strong>
                                Total Quantity: {totalDistributedQuantity}
                            </strong>

                        </div>


                        <div className="shop-distribution-table-wrap">
                            <table className="shop-distribution-table">

                                <thead>
                                    <tr>
                                        <th>Shop Name</th>
                                        <th>Product Type</th>
                                        <th>Flavour</th>
                                        <th>Quantity</th>
                                        <th>Vehicle</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                {filteredDistributions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="distribution-empty">
                                            No distribution records found.
                                        </td>
                                    </tr>
                                )}

                                <tbody>
                                    {filteredDistributions.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.shop}</td>
                                            <td>{item.productType}</td>
                                            <td>{item.flavour}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.vehicle}</td>
                                            <td>{item.date}</td>
                                            <td>
                                                <span className={
                                                    `distribution-status ${item.status === "Delivered"
                                                        ? "status-delivered"
                                                        : item.status === "In Transit"
                                                            ? "status-transit"
                                                            : "status-pending"
                                                    }`
                                                }>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>

                    </section>


                    <section className="vehicle-sales-card">

                        <div className="vehicle-sales-heading">
                            <h2>Most Selling Ice Cream by Vehicle</h2>
                            <p>View sales performance across delivery vehicles.</p>
                        </div>

                        <div className="vehicle-sales-table-wrap">
                            <table className="vehicle-sales-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Driver</th>
                                        <th>Route</th>
                                        <th>Sales</th>
                                        <th>Top Flavour</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {vehicleSales.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.vehicle}</td>
                                            <td>{item.driver}</td>
                                            <td>{item.route}</td>
                                            <td>Rs. {item.sales.toLocaleString()}</td>
                                            <td>{item.topFlavour}</td>
                                            <td>{item.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                    </section>


                    <section className="weekly-sales-card">

                        <div className="weekly-sales-heading">
                            <h2>Weekly Sales Analytics</h2>
                            <p>Daily sales performance and targets.</p>
                        </div>

                        <div className="weekly-sales-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={weeklySales}
                                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid
                                        stroke="rgba(255,255,255,0.18)"
                                        vertical={false}
                                    />

                                    <XAxis
                                        dataKey="day"
                                        stroke="#d0d1ff"
                                        tick={{ fill: "#d0d1ff", fontSize: 12 }}
                                    />

                                    <YAxis
                                        stroke="#d0d1ff"
                                        tick={{ fill: "#d0d1ff", fontSize: 12 }}
                                    />

                                    <Tooltip />

                                    <Legend />

                                    <Bar
                                        dataKey="sales"
                                        name="Sales"
                                        fill="#a8dff0"
                                        radius={[4, 4, 0, 0]}
                                        barSize={30}
                                    />

                                    <Line
                                        type="monotone"
                                        dataKey="target"
                                        name="Target"
                                        stroke="#ff9db5"
                                        strokeWidth={3}
                                        dot={{ r: 4 }}
                                    />

                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                    </section>


                </div>

            </main>
        </div>
    )
}

export default Delivery