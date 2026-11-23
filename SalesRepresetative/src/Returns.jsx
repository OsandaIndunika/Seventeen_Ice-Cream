import React, {useState} from "react";
import {useNavigate} from 'react-router-dom';
import './Returns.css';
import './Navigation.css';
import {
    FaSignOutAlt,
    FaReply,
    FaCalendarAlt,
    FaStore,
    FaBox,
    FaPlus,
    FaTrash,
    FaTimes,
    FaCheck,
    FaSearch,
    FaChevronDown,
    FaHome,
    FaCube,
    FaMapMarkedAlt,
    FaFileInvoiceDollar,
    FaChartLine
} from 'react-icons/fa';

function Returns() {
    const [activeTab, setActiveTab] = useState('Returns');
    const navigate = useNavigate();
    const [userName] = useState('Sales Manager');
    const [returnReason, setReturnReason] = useState('Damaged packaging');
    const [receivingNote, setReceivingNote] = useState('Sales damaged in transit; set aside quality review.');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [returnItems, setReturnItems] = useState([
        { id: 1, product: 'Classic Vanilla', pack: 'Tub 500ml', quantity: '6' },
        { id: 2, product: 'Strawberry Swirl', pack: 'Tub-500ml', quantity: '4' }
    ]);

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

    const handleAddProduct = () => {
        const newItem = {
            id: Date.now(), 
            product: '',
            pack: '',
            quantity: '1'
        };
        setReturnItems([...returnItems, newItem]);
    };

    const handleDeleteProduct = async (id, productName) => {
        if (!window.confirm(`Are you sure you want to remove ${productName || 'this product'}?`)) return;

        try {
            setReturnItems(returnItems.filter(item => item.id !== id));
        } catch (error) {
            console.error("Failed to delete item from backend", error);
            alert("Could not delete item. Please try again.");
        }
    };

    const handleItemChange = (id, field, value) => {
        setReturnItems(returnItems.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleClearEntry = () => {
        setReturnItems([]);
        setReturnReason('');
        setReceivingNote('');
    };

    const handleRecordReturn = async () => {
        if (returnItems.length === 0) {
            alert("Please add at least one product return.");
            return;
        }

        setIsSubmitting(true);
        
        const returnPayload = {
            shopName: "Sunset Provisions",
            location: "24 Lake Road, Nugegoda",
            date: "15 Oct, 2026",
            reason: returnReason,
            note: receivingNote,
            items: returnItems
        };

        try {
            const response = await fetch('https://api.yourdomain.com/returns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(returnPayload)
            });

            if (!response.ok) throw new Error('Failed to record return');

            alert("Return recorded successfully!");
            handleClearEntry(); 
        } catch (error) {
            console.error("Error recording return:", error);
            alert("Failed to submit return to server. Please try again.");
        } finally {
            setIsSubmitting(false);
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
                    onClick={() => navigate('/billing')}>
                        <FaFileInvoiceDollar className="nav-icon"/>
                        <span>POS & Billing</span>
                    </button>
        
                    <button className={`nav-item ${activeTab === 'Daily Reports' ? 'active' : ''}`}
                    onClick={() => navigate('/dailyReports')}>
                        <FaChartLine className="nav-icon"/>
                        <span>Daily Reports</span>
                    </button>
        
                    <button className={`nav-item ${activeTab === 'Returns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Returns')}>
                        <FaReply className="nav-icon"/>
                        <span>Returns</span>
                        {activeTab === 'Returns' && <span className="active-dot"></span>}
                    </button>
                </nav>

                <div className="logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</div>
            </aside>

            <div className="main-wrapper">
                <header className="top-header">
                    <div className="header-left">
                        <div className="status-indicator">
                            <span className="indicator-icon"><FaReply /></span>
                        </div>
                        <div>
                            <div className="route-code">Product Returns</div>
                            <div className="route-subtext">HEAD OFFICE . SALES OPERATIONS</div>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-name">{userName}</div>
                            <div className="user-role">SALES & RETURNS</div>
                        </div>
                        <span className="user-avatar-dot">{getUserInitials(userName)}</span>
                    </div>
                </header>

                <div className="workspace">
                    <div className="workspace-header">
                        <h1 className="page-title">Product Returns</h1>
                        <div className="date-badge">
                            <FaCalendarAlt />15 Oct, 2026
                        </div>
                    </div>
                    <p className="workspace-desc">Receive products from shops and keep every return accounted for</p>
                
                    <section className="metrics-container">
                        <div className="metric-card">
                            <div className="metric-value-row">
                                <span className="metric-label">RECORDED RETURNS</span>
                                <FaReply />
                            </div>

                            <div className="metric-value-row">
                                <span className="metric-num">05</span>
                                <span className="metric-sub">15 Oct, 2026</span>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-value-row">
                                <span className="metric-label">PACKS RETURNED</span>
                                <FaCube />
                            </div>

                            <div className="metric-value-row">
                                <span className="metric-num">40</span>
                                <span className="metric-sub">14 Oct, 2026</span>
                            </div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-value-row">
                                <span className="metric-label">SHOPS WITH RETURNS</span>
                                <FaHome />
                            </div>

                            <div className="metric-value-row">
                                <span className="metric-num">04</span>
                                <span className="metric-sub">Across 4 locations</span>
                            </div>
                        </div>
                    </section>

                    <section className="card-section">
                        <div className="section-header-flex">
                            <h3 className="section-title">Record a Return</h3>
                            <button className="unresolved-badge">Unsaved entry</button>
                        </div>
                        <p className="form-sub-text">
                            Enter the shop details and products recieved. All fields are required unless marked optional.
                        </p>

                        <div className="form-grid-row">
                            <div className="input-group">
                                <label className="input-label">SHOP NAME</label>
                                <div className="input-with-icon">
                                    <FaStore className="field-icon" />
                                    <input type="text" value="Sunset Provisions" readOnly className="form-input" />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">SHOP LOCATION</label>
                                <div className="input-with-icon">
                                    <FaMapMarkedAlt className="field-icon" />
                                    <input type="text" value="24 Lake Road, Nugegoda" readOnly className="form-input" />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">RETURN DATE</label>
                                <div className="input-with-icon">
                                    <FaCalendarAlt className="field-icon" />
                                    <input type="text" value="15 Oct, 2026" readOnly className="form-input" />
                                </div>
                            </div>
                        </div>

                        <hr />

                        <div className="return-products">
                            <div className="product-table">
                                <div className="products-table-header">
                                    <span className="col-product">RETURNED PRODUCT</span>
                                    <span className="col-pack">BATCH & PACK SIZE</span>
                                    <span className="col-qty">QUANTITY</span>
                                    <span className="col-actions">ACTION</span>
                                </div>

                                {returnItems.map((item) => (
                                    <div className="product-row" key={item.id}>
                                        <div className="col-product item-flex">
                                            <FaBox className="item-icon"/>
                                            <input 
                                                type="text" 
                                                value={item.product} 
                                                onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                                                placeholder="Product name"
                                                className="table-input" 
                                            />
                                        </div>
                                        <div className="col-pack">
                                            <input 
                                                type="text" 
                                                value={item.pack} 
                                                onChange={(e) => handleItemChange(item.id, 'pack', e.target.value)}
                                                placeholder="Pack size"
                                                className="table-input" 
                                            />
                                        </div>
                                        <div className="col-qty">
                                            <input 
                                                type="text" 
                                                value={item.quantity} 
                                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                                className="table-input text-center" 
                                            />
                                        </div>
                                        <div className="col-actions btn-group">
                                            <button 
                                                className="icon-btn action-delete" 
                                                onClick={() => handleDeleteProduct(item.id, item.product)}
                                                title="Delete item"
                                            >
                                                <FaTrash size={11} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="table-footer">
                                    <button className="add-product-btn" onClick={handleAddProduct}>
                                        <FaPlus /> Add Product
                                    </button>

                                    <div className="description">
                                        Quantity = Number of individual packs
                                    </div>
                                </div>
                            </div>

                            <div className="return-details">
                                <div className="metric-value-row">
                                    <span className="metric-label">THIS RETURN</span>
                                </div>

                                <div className="metric-value-row">
                                    <span className="metric-num">{returnItems.length * 5}</span>
                                    <span className="metric-sub">tubs . 5L total</span>
                                </div>
                                <br />
                                <p>{returnItems.length} products from Sunset Provisions Not included in recorded totals yet.</p>
                            </div>
                        </div>

                        <div className="bottom-form-row">
                            <div className="reason-col">
                                <label className="input-label">RETURN REASON</label>
                                <input 
                                    type="text" 
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    className="form-input" 
                                />
                            </div>

                            <div className="note-col">
                                <label className="input-label">RECIEVING NOTE (OPTIONAL)</label>
                                <input 
                                    type="text" 
                                    value={receivingNote} 
                                    onChange={(e) => setReceivingNote(e.target.value)}
                                    className="form-input" 
                                />
                            </div>
                        </div>

                        <div className="footer-btn">
                            <div className="form-footer-note">
                                <span className="info-bullet"></span> Recorded under Sunset Provisions. Products will be restocked to inventory automatically
                            </div>

                            <div className="action-buttons-col">
                                <button className="btn-clear" onClick={handleClearEntry}><FaTimes />Clear entry</button>
                                <button className="btn-record" onClick={handleRecordReturn}><FaCheck />{isSubmitting ? 'Recording...' : 'Record Return'}</button>
                            </div>
                        </div>

                    </section>

                    <section className="card-section">
                        <div className="section-header-flex">
                            <h3 className="section-title">
                                Return History <span className="history-count-badge">5 returns</span>
                            </h3>
                        </div>

                        <div className="filter-row">
                            <div className="search-box">
                                <FaSearch className="search-icon" />
                                <input type="text" placeholder="Search shop, location or return reference" className="search-input" />
                            </div>
                            <div className="filter-item date-filter">
                                <FaCalendarAlt className="filter-icon" /> 15-Oct-2026-...
                            </div>
                            <div className="filter-item status-filter">
                                <span>All statuses</span>
                                <FaChevronDown className="dropdown-icon" />
                            </div>
                        </div>

                        <div className="history-table-header">
                            <span className="col-ref">RETURN REF.</span>
                            <span className="col-shop">SHOP / LOCATION</span>
                            <span className="col-details">PRODUCT / PACK SIZE</span>
                            <span className="col-hist-qty">QUANTITY</span>
                            <span className="col-date">RETURN DATE</span>
                            <span className="col-status">STATUS</span>
                        </div>

                        {[
                            {id: 'RET-0105', shop: 'Meadow Mini Mart', loc: '18 Park Lane, Colombo 05', prod: 'Classic Vanilla (500ml)\nStrawberry Swirl (500ml)', 
                                qty: '8 Tubs\n4 Tubs', date: '15 Oct, 2026', status: 'Awaiting review', statusClass: 'status-pending'},
                            {id: 'RET-0104', shop: 'Harbour Stores', loc: '24 Lake Road, Nugegoda', prod: 'Chocolate Bliss (100ml)', 
                                qty: '8 cups', date: '15 Oct, 2026', status: 'Awaiting review', statusClass: 'status-pending'},
                            {id: 'RET-0103', shop: 'Hilltop Grocers', loc: '42 Hill Street, Kandy', prod: 'Mint Chocolate (1l))', 
                                qty: '8 tubs', date: '15 Oct, 2026', status: 'Reviewed', statusClass: 'status-reviewed'},
                            {id: 'RET-0102', shop: 'Orchard Corner', loc: '8 Orchard Lane, Nugegoda', prod: 'Mango Sorbet (100ml)\nClassic Vanilla (500ml)', 
                                qty: '8 cups\n2 tubs', date: '15 Oct, 2026', status: 'Reviewed', statusClass: 'status-reviewed'},
                            {id: 'RET-0101', shop: 'Meadow Mini Mart', loc: '18 Park Lane, Colombo 05', prod: 'Strawberry Swirl (500ml)', 
                                qty: '4 tubs', date: '15 Oct, 2026', status: 'Reviewed', statusClass: 'status-reviewed'}
                        ].map((row, index) => (
                            <div key={index} className="history-row">
                                <span className="col-ref ref-id">{row.id}</span>
                                <div className="col-shop">
                                    <div className="shop-name">{row.shop}</div>
                                    <div className="shop-location">{row.loc}</div>
                                </div>
                                <div className="col-details prod-text">{row.prod}</div>
                                <span className="col-hist-qty">{row.qty}</span>
                                <span className="col-date">{row.date}</span>
                                <div className="col-status">
                                    <span className={`status-pill ${row.statusClass}`}>{row.status}</span>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default Returns;