import React, {useState} from "react";
import './DailyReports.css';
import './Navigation.css';
import {
    FaSignOutAlt,
    FaCircle,
    FaFileInvoiceDollar,
    FaChartLine,
    FaReply
} from 'react-icons/fa';

function DailyReports () {
    const [activeTab, setActiveTab] = useState('Daily Reports');

    //Sample Data
    const salesByDate = [
        {date: '2026-08-12', amount: 482, width: '85%'},
        {date: '2026-08-13', amount: 412, width: '70%'},
        {date: '2026-08-14', amount: 535, width: '95%'},
        {date: '2026-08-15', amount: 395, width: '65%'},
        {date: '2026-08-16', amount: 283, width: '45%'},
        {date: '2026-08-17', amount: 412, width: '70%'},
        {date: '2026-08-18', amount: 351, width: '55%'}
    ];

    const bills = [
        {id: 'Bill #4020', time: '10:30 AM', items: 'Double Scoop (Strawberry), Cone', payment: 'Cash', amount: '$24.50'},
        {id: 'Bill #4019', time: '10:12 AM', items: 'Mint Chocolate Tub (L)', payment: 'Card', amount: '$10.00'},
        {id: 'Bill #4018', time: '09:50 AM', items: 'Single Scoop x3', payment: 'Cash', amount: '$13.50'},
        {id: 'Bill #4017', time: '09:45 AM', items: 'Classic Vanilla Tub (L)', payment: 'Cash', amount: '$9.00'},
        {id: 'Bill #4016', time: '09:20 AM', items: 'Strawberry Tub (1L), Cone', payment: 'Card', amount: '$11.50'}
    ];

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="brand">
                    <img src="src/assets/logo.PNG" alt="logo" />
                </div>

                <nav className="nav-menu">
                    <button className={`nav-item ${activeTab === 'Billing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Billing')}>
                        <FaFileInvoiceDollar className="nav-icon"/>
                        <span>Billing</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'Daily Reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Daily Reports')}>
                        <FaChartLine className="nav-icon"/>
                        <span>Daily Reports</span>
                        {activeTab === 'Daily Reports' && <span className="active-dot"></span>}
                    </button>

                    <button className={`nav-item ${activeTab === 'Returns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Returns')}>
                        <FaReply className="nav-icon"/>
                        <span>Returns</span>
                    </button>
                </nav>

                <div className="logout-btn"><FaSignOutAlt /> Logout</div>
            </aside>

            <main className="main-wrapper">
                <header className="top-header">
                    <div className="header-left">
                        <div className="status-indicator">
                            <span className="indicator-icon"><FaCircle /></span>
                        </div>
                        <div>
                            <div className="route-code">Downtown Outlet</div>
                            <div className="route-subtext">OPEN . SHIFT MORNING</div>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-name">Sarah Jenkins</div>
                            <div className="user-role">OUTLET MANAGER</div>
                        </div>
                        <span className="user-avatar-dot">SJ</span>
                    </div>
                </header>

                <div className="content-body">
                    <section className="data-grid">
                        <div className="data-card">
                            <span className="data-label">TODAY'S SALES</span>
                            <h3 className="data-value">$482.50</h3>
                            <span className="data-sub highlight">12% vs yesterday</span>
                        </div>
                        <div className="data-card">
                            <span className="data-label">ORDERS</span>
                            <h3 className="data-value">42</h3>
                            <span className="data-sub">Since 8:00 AM</span>
                        </div>
                        <div className="data-card">
                            <span className="data-label">TOTAL SALES</span>
                            <h3 className="data-value">$1,112.49</h3>
                            <span className="data-sub"></span>
                        </div>
                        <div className="data-card">
                            <span className="data-label">TOP SELLER</span>
                            <h3 className="data-value">Strawberry Swirl</h3>
                            <span className="data-sub">18 Sold today</span>
                        </div>
                    </section>

                    <div className="analytics-section">
                        <div className="card sales-by-date-card">
                            <h4>Sales by Date</h4>
                            <div className="bar-chart">
                                {salesByDate.map((item, index) => (
                                    <div className="bar-row" key={index}>
                                        <span className="bar-date">{item.date}</span>
                                        <div className="bar-track">
                                            <div className={`bar-fill ${index === 2 ? 'heighlight-bar' : ''}`} style={{width: item.width}}></div>
                                        </div>
                                        <span className="bar-amount">${item.amount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card payment-methods-card">
                            <h4>Payment Methods</h4>
                            <div className="payment-breakdown">
                                <div className="payment-item">
                                    <div className="payment-info">
                                        <span className="dot cash"></span>
                                        <div className="cash">
                                            <span>Cash</span>
                                            <p>64% of sales</p>
                                        </div>
                                    </div>
                                    <span className="payment-val">$310.00</span>
                                </div>
                                <p className="payment-subtext">Cash to hand over: $310.00</p>
                            </div>
                        </div>
                    </div>

                    <section className="card todays-bill-card">
                        <div className="card-header-flex">
                            <h4>Todays's Bills</h4>
                            <button className="text-btn">Previous Bills</button>
                        </div>
                        <div className="table-responsive">
                            <table className="bills-table">
                                <thead>
                                    <tr>
                                        <th>BILL</th>
                                        <th>TIME</th>
                                        <th>ITEMS</th>
                                        <th>PAYMENT</th>
                                        <th>AMOUNT</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {bills.map((bill, index) => (
                                        <tr key={index}>
                                            <td className="bill-id"><div className="pointer"></div>{bill.id}</td>
                                            <td>{bill.time}</td>
                                            <td>{bill.items}</td>
                                            <td>
                                                <span className="badge">
                                                    {bill.payment}
                                                </span>
                                            </td>
                                            <td className="amount-cell">{bill.amount}</td>
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

export default DailyReports;