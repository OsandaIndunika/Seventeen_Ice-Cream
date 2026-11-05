import React, {useState} from "react";
import './Returns.css';
import './Navigation.css';
import {
    FaSignOutAlt,
    FaCircle,
} from 'react-icons/fa';

function Returns() {
    const [activeTab, setActiveTab] = useState('Returns');

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="brand">
                    <span className="frosty">Frosty</span><span className="delights">Delights</span>
                </div>
        
                <nav className="nav-menu">
                    <button className={`nav-item ${activeTab === 'Billing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Billing')}>
                        POS & Billing 
                        {activeTab === 'Billing' && <span className="active-dot"></span>}
                    </button>
        
                    <button className={`nav-item ${activeTab === 'Daily Reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Daily Reports')}>
                        Daily Reports
                    </button>
        
                    <button className={`nav-item ${activeTab === 'Returns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Returns')}>
                        Returns
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
                            <div className="route-code">Product Returns</div>
                            <div className="route-subtext">HEAD OFFICE . SALES OPERATIONS</div>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="user-info">
                            <div className="user-name">Sales Manager</div>
                            <div className="user-role">SALES & RETURNS</div>
                        </div>
                        <span className="user-avatar-dot">SM</span>
                    </div>
                </header>
            </div>
        </div>
    );
}

export default Returns;