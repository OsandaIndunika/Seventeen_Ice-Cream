import React, {useState} from "react";
import './Billing.css';
import './Navigation.css'
import {
    FaMoneyBillWave,
    FaCreditCard,
    FaMoneyCheck,
    FaSignOutAlt,
    FaCircle,
    FaFileInvoiceDollar,
    FaChartLine,
    FaReply
} from 'react-icons/fa';

function Billing() {
    const [activeTab, setActiveTab] = useState('Billing');
    const [selectedItem, setSelectedItem] = useState('Strawberry Tub (1L)');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState('12.00');
    const [paymentMethod, setPaymentMethod] = useState('Cash');

    //Sample Data
    const inventoryItems = [
        {name: 'STRAWBERRY', count: '14 Tubs', progress: 60, color:'#ff7b9c'},
        {name: 'MINT CHIP', count: '08 Tubs', progress: 40, color:'#38d9a9'},
        {name: 'VANILLA', count: '22 Tubs', progress: 85, color:'#ffe066'},
        {name: 'CHOCOLATE', count: '05 Tubs', progress: 25, color:'#ff6b6b'},
        {name: 'VANILLA', count: '22 Tubs', progress: 85, color:'#ffe066'},
        {name: 'CHOCOLATE', count: '05 Tubs', progress: 25, color:'#ff6b6b'}
    ];

    const currentOrder = [
        {name: '2x Strawberry Tub', price: '$24.00'},
        {name: '1x Vanilla Tub', price: '$12.00'}
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
                        <span>POS & Billing</span>
                        {activeTab === 'Billing' && <span className="active-dot"></span>}
                    </button>

                    <button className={`nav-item ${activeTab === 'Daily Reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Daily Reports')}>
                        <FaChartLine className="nav-icon"/>
                        <span>Daily Reports</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'Returns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Returns')}>
                        <FaReply className="nav-icon"/>
                        <span>Returns</span>
                    </button>
                </nav>

                <div className="logout-btn"><FaSignOutAlt /> Logout</div>
            </aside>

            <div className="main-wrapper">
                <header className="top-header">
                    <div className="header-left">
                        <div className="status-indicator">
                            <span className="indicator-icon"><FaCircle /></span>
                        </div>
                        <div>
                            <div className="route-code">LC-0710</div>
                            <div className="route-subtext">Battaramulla Route</div>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-name">Sarah Jenkins</div>
                            <div className="user-role">DELIVERY MANAGER</div>
                        </div>
                        <span className="user-avatar-dot">SJ</span>
                    </div>
                </header>

                <main className="dashboard-content">
                    <section className="inventory-section">
                        <div className="section-header">
                            <h2>Lorry Inventory</h2>
                            <button className="quick-add-btn">Quick Add</button>
                        </div>

                        <div className="inventory-grid">
                            {inventoryItems.map((item, idx) => (
                                <div key={idx} className="inventory-card">
                                    <div className="inventory-card-label">{item.name}</div>
                                    <div className="inventory-card-count">{item.count}</div>
                                    <div className="progress-bar-bg">
                                        <div className="progress-bar-fill"
                                        style={{width: `${item.progress}%`, backgroundColor: item.color }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bill-section">
                        <h2 className="bill-title">Create New Bill</h2>

                        <div className="form-group">
                            <label>SELECT ITEM</label>
                            <select className="select-input" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
                                <option value="Strawberry Tub (1L)">Strawberry Tub (1L)</option>
                                <option value="Vanilla Tub (1L)">Vanilla Tub (1L)</option>
                                <option value="Mint Chip Tub (1L)">Mint Chip Tub (1L)</option>
                                <option value="Chocolate Tub (1L)">Chocolate Tub (1L)</option>
                            </select>
                        </div>

                        <div className="form-row">
                            <div className="form-group half-width">
                                <label>QUANTITY</label>
                                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1"/>
                            </div>

                            <div className="form-group half-width">
                                <label>UNIT PRICE</label>
                                <input type="text" value={`$ ${unitPrice}`} onChange={(e) => setUnitPrice(e.target.value.replace('$ ', ''))} />
                            </div>
                        </div>

                        <button className="add-to-bill-btn">Add to Bill</button>

                        <div className="order-summary">
                            <div className="order-header">
                                <span className="order-title">Current Order</span>
                                <span className="inv-code">Inv: #28412</span>
                            </div>

                            {currentOrder.map((orderItem, idx) => (
                                <div key={idx} className="order-item-row">
                                    <span>{orderItem.name}</span>
                                    <span className="order-item-price">{orderItem.price}</span>
                                </div>
                            ))}

                            <div className="order-total-row">
                                <span>Total Due</span>
                                <span className="total-amount">$36.00</span>
                            </div>
                        </div>

                        <button className="finalize-btn">Print & Finalize Bill</button>

                        <div className="payment-options">
                            <button className={`payment-btn cash ${paymentMethod === 'Cash' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('Cash')}>
                                <span className="icon"><FaMoneyBillWave /></span> Cash
                            </button>

                            <button className={`payment-btn credit ${paymentMethod === 'Credit' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('Credit')}>
                                <span className="icon"><FaCreditCard /></span> Credit
                            </button>

                            <button className={`payment-btn cheque ${paymentMethod === 'Cheque' ? 'active' : ''}`}
                            onClick={() => setPaymentMethod('Cheque')}>
                                <span className="icon"><FaMoneyCheck /></span> Cheque
                            </button>
                        </div>

                        <div className="shop-owner-footer">
                            . Share with Shop Owner
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default Billing;