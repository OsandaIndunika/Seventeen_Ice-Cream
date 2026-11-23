import React, {useState, useEffect} from "react";
import {useLocation, useNavigate} from 'react-router-dom';
import './Billing.css';
import './Navigation.css';
import {
    FaMoneyBillWave,
    FaCreditCard,
    FaMoneyCheck,
    FaSignOutAlt,
    FaCircle,
    FaFileInvoiceDollar,
    FaChartLine,
    FaReply,
    FaTimes,
    FaFileInvoice,
    FaPrint,
    FaCalendarAlt,
    FaUser
} from 'react-icons/fa';

function Billing() {
    const [activeTab, setActiveTab] = useState('Billing');
    const [selectedItem, setSelectedItem] = useState('Strawberry Tub (1L)');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState('12.00');
    const [currentOrder, setCurrentOrder] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const navigate = useNavigate();
    const location = useLocation();
    const [userName, setUserName] = useState('Sarah Jenkis');
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [completedBillData, setCompletedBillData] = useState(null);

    useEffect(() => {
        if (location.state?.completedBill) {
            setCompletedBillData(location.state.completedBill);
            setIsReceiptOpen(true);
            setCurrentOrder([]);
            
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const handleNavigateToPayment = (route, method) => {
        if (currentOrder.length === 0) {
            alert("Please add items to the bill before selecting a payment method.");
            return;
        }
        setPaymentMethod(method);
        navigate(route, { 
            state: { 
                billTotal: calculateTotalDue(), 
                items: currentOrder 
            } 
        });
    };

    //Sample Data
    const inventoryItems = [
        {name: 'STRAWBERRY', count: '14 Tubs', progress: 60, color:'#ff7b9c'},
        {name: 'MINT CHIP', count: '08 Tubs', progress: 40, color:'#38d9a9'},
        {name: 'VANILLA', count: '22 Tubs', progress: 85, color:'#ffe066'},
        {name: 'CHOCOLATE', count: '05 Tubs', progress: 25, color:'#ff6b6b'},
        {name: 'VANILLA', count: '22 Tubs', progress: 85, color:'#ffe066'},
        {name: 'CHOCOLATE', count: '05 Tubs', progress: 25, color:'#ff6b6b'}
    ];

    const handleAddToBill = () => {
        const parsedQty = parseInt(quantity, 10);
        const parsedPrice = parseFloat(unitPrice);

        if (!selectedItem || parsedQty <= 0 || isNaN(parsedPrice)) {
            alert("Please enter a valid quantity and unit price.");
            return;
        }

        const itemTotal = (parsedQty * parsedPrice).toFixed(2);

        const newItem = {
            id: Date.now(),
            name: `${parsedQty}x ${selectedItem}`,
            price: `$${itemTotal}`
        };

        setCurrentOrder([...currentOrder, newItem]);

        setQuantity(1);
    };

    const handleRemoveFromOrder = (id) => {
        setCurrentOrder(currentOrder.filter(item => item.id !== id));
    };

    const calculateTotalDue = () => {
        const total = currentOrder.reduce((sum, item) => {
            const numericPrice = parseFloat(item.price.replace('$', '')) || 0;
            return sum + numericPrice;
        }, 0);
        return total.toFixed(2);
    };

    const getUserInitials = (name) => {
        if (!name) return '';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleLogout = () => { 
        localStorage.removeItem('authToken'); 
        sessionStorage.clear();

        const confirmLogout = window.confirm("Are you sure you want to log out?");
        if (!confirmLogout) return;
        navigate('/');
    };


    const handleFinalizeBill = async () => {
        if (currentOrder.length === 0) {
            alert("Cannot finalize an empty bill. Please add items first.");
            return;
        }

        setIsFinalizing(true);

        const finalBillPayload = {
            invoiceNumber: "28412", 
            items: currentOrder,
            totalAmount: calculateTotalDue(),
            timestamp: new Date().toISOString()
        };

        try {
            console.log("Sending payload to backend (Simulated): ", finalBillPayload);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const ok = true;
            // const response = await fetch('https://api.yourdomain.com/bills/finalize', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify(finalBillPayload)
            // });
            // const ok = response.ok;

            if (!ok) {
                throw new Error('Failed to save bill on the server.');
            }

            const billData = {
                id: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                items: [...currentOrder],
                total: calculateTotalDue(),
                paymentMethod: paymentMethod
            };

            setCompletedBillData(billData);
            setIsReceiptOpen(true); 
            setCurrentOrder([]);

            // setTimeout(() => {
            //     window.print();
            // }, 100);

            alert("Bill finalized and recorded successfully!");

        } catch (error) {
            console.error("Error finalizing bill:", error);
            alert("Could not finalize bill. Please check your connection and try again.");
        } finally {
            setIsFinalizing(false);
        }
    };

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
                    onClick={() => navigate('/dailyReports')}>
                        <FaChartLine className="nav-icon"/>
                        <span>Daily Reports</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'Returns' ? 'active' : ''}`}
                    onClick={() => navigate('/returns')}>
                        <FaReply className="nav-icon"/>
                        <span>Returns</span>
                    </button>
                </nav>

                <div className="logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</div>
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
                            <div className="user-name">{userName}</div>
                            <div className="user-role">DELIVERY MANAGER</div>
                        </div>
                        <span className="user-avatar-dot">{getUserInitials(userName)}</span>
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

                        <button className="add-to-bill-btn" onClick={handleAddToBill}>Add to Bill</button>

                        <div className="order-summary">
                            <div className="order-header">
                                <span className="order-title">Current Order</span>
                                <span className="inv-code">Inv: #28412</span>
                            </div>

                            {currentOrder.map((orderItem) => (
                                <div key={orderItem.id} className="order-item-row">
                                    <span>{orderItem.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span className="order-item-price">{orderItem.price}</span>
                                        <button 
                                            onClick={() => handleRemoveFromOrder(orderItem.id)}
                                            className="icon-btn action-delete"
                                            title="Remove item"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="order-total-row">
                                <span>Total Due</span>
                                <span className="total-amount">${calculateTotalDue()}</span>
                            </div>
                        </div>

                        <button className="finalize-btn" onClick={handleFinalizeBill} disabled={isFinalizing}>{isFinalizing ? 'Finalizing...' : 'Print & Finalize Bill'}</button>

                        <div className="payment-options">
                            <button className={`payment-btn cash ${paymentMethod === 'Cash' ? 'active' : ''}`}
                            onClick={() => handleNavigateToPayment('/cash', 'Cash')}>
                                <span className="icon"><FaMoneyBillWave /></span> Cash
                            </button>

                            <button className={`payment-btn credit ${paymentMethod === 'Credit' ? 'active' : ''}`}
                            onClick={() => navigate('/credit', {state: {billTotal: calculateTotalDue(), items: currentOrder}})}>
                                <span className="icon"><FaCreditCard /></span> Credit
                            </button>

                            <button className={`payment-btn cheque ${paymentMethod === 'Cheque' ? 'active' : ''}`}
                            onClick={() => navigate('/cheque', {state: {billTotal: calculateTotalDue(), items: currentOrder}})}>
                                <span className="icon"><FaMoneyCheck /></span> Cheque
                            </button>
                        </div>

                        <div className="shop-owner-footer">
                            . Share with Shop Owner
                        </div>
                    </section>

                    {isReceiptOpen && completedBillData && (
                        <div className="receipt-modal-overlay">
                            <div className="receipt-modal">
                                <div className="receipt-heading">
                                    <span>Receipt</span>
                                </div>

                                <div className="receipt-details">
                                    <p>
                                        <span className="receipt-icon"><FaFileInvoice /></span>
                                        <strong>Invoice: </strong>
                                        <span>{completedBillData.id}</span>
                                    </p>

                                    <p>
                                        <span className="receipt-icon"><FaCalendarAlt /></span>
                                        <strong>Date: </strong>
                                        <span>{completedBillData.date} {completedBillData.time}</span>
                                    </p>
                                </div>

                                <div className="receipt-divider"></div>
                                <div className="receipt-items-header">
                                    <span>Item</span>
                                    <span>Amount</span>
                                </div>

                                <div className="receipt-items">
                                    {completedBillData.items.map((item, idx) => (
                                        <div className="receipt-item" key={idx}>
                                            <span>{item.name}</span>
                                            <span>{item.price}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="receipt-total">
                                    <strong>Total Paid: </strong>
                                    <span>
                                        ${Number(completedBillData.total).toFixed(2)}
                                    </span>
                                </div>
                                
                                <div className="receipt-buttons">
                                    <button className="receipt-print-btn" onClick={() => window.print()}>
                                        <span><FaPrint /></span> Print Receipt
                                    </button>
                                    <button className="receipt-close-btn" onClick={() => setIsReceiptOpen(false)}>
                                        <span><FaUser /></span> Close / Next Customer
                                    </button>
                                </div>

                                <div className="receipt-footer">
                                    <span></span>
                                    <em>Thank you for visiting!</em>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default Billing;