import React, {useState} from "react";
import {
    FaMotorCycle,
    FaTruck,
    FaSnowflake,
    FaArrowLeft,
    
} from 'react-icons/fa';
import './SelectOutlet.css';

const outletsData = [
        {
            id: 'downtown',
            name: 'Downtown',
            description: 'Main Street, City Center, High traffic area, Open 24/7.',
            address: '123 Main Street. Suite 100',
            hours: 'Open 24/7',
            icon: FaStore,
            colorScheme: 'pink'
        },
        {
            id: 'uptown',
            name: 'Uptown Mall',
            description: 'Located in the Food Court, Level 2. Family focused experience.',
            address: '456 Commercial Way, Level 2',
            hours: '10:00 AM - 10:00 PM',
            icon: FaBuilding,
            colorScheme: 'blue'
        }
    ];

function SelectOutlet({onChangeLogin, onOutletSelect}) {
    const [selectedId, setSelectedId] = useState(null);
    const [activeModalOutlet, setActiveModalOutlet] = useState(null);

    const handleOpenTerminal = (e, outlet) => {
        e.stopPropagation();
        setSelectedId(outlet.id);
        setActiveModalOutlet(outlet);
        if(onOutletSelect){
            onOutletSelect(outlet);
        }
    };

    return (
        <div className="outlet-page-wrapper">
            <div className="outlet-container">
                <header className="outlet-header">
                    <h1 className="brand-title">
                        <span className="brand-frosty">Frosty</span>
                        <span className="brand-delights">Delights</span>
                    </h1>
                    <h2 className="main-heading">Select Your Outlet</h2>
                    <p className="sub-heading">Please select the branch you are managing for this shift.</p>
                </header>

                <div className="outlet-grid">
                    {outletsData.map((outlet) => {
                        const isSelected = selectedId === outlet.id;
                        const isPink = outlet.colorScheme === 'pink';
                        const IconComponent = outlet.icon;

                        return (
                            <div key={outlet.id} 
                            onClick={() => setSelectedId(outlet.id)} 
                            className={`outlet-card ${isPink ? 'card-pink' : 'card-blue'}  ${isSelected ? 'selected' : ''}`}>
                                <div className={`bg-circle ${isPink ? 'circle-pink' : 'circle-blue'}`} />

                                {isSelected && (
                                    <div className={`selected-badge ${isPink ? 'badge-pink' : 'badge-blue'}`}>
                                        <FaCheck />
                                    </div>
                                )}

                                <div className={`icon-wrapper ${isPink ? 'icon-pink' : 'icon-blue'}`}>
                                    <IconComponent />
                                </div>

                                <h3 className="outlet-title">{outlet.name}</h3>
                                <p className="outlet-desc">{outlet.description}</p>

                                <button type="button" onClick={(e) => handleOpenTerminal(e, outlet)}
                                    className={`terminal-btn ${isPink ? 'btn-pink' : 'btn-blue'}`}>
                                    Open Terminal 
                                </button>
                            </div>
                        );
                    })}
                </div>

                <footer className="outlet-footer">
                    <button type="button" onClick={onChangeLogin} className="change-login-btn">
                        <FaArrowLeft />
                        <span>Change Login</span>
                    </button>
                </footer>
            </div>

            {activeModalOutlet && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="modal-close" onClick={() => setActiveModalOutlet(null)}>
                            <FaTimes />
                        </button>

                        <div className={`modal-header-icon ${activeModalOutlet.colorScheme === 'pink' ? 'icon-pink' : 'icon-blue'}`}>
                            <FaCashRegister />
                        </div>

                        <h3 className="modal-title">Opening Terminal</h3>
                        <p className="modal-subtitle">
                            Initializing POS station for <strong>{activeModalOutlet.name}</strong>
                        </p>

                        <div className="detail-row">
                            <FaMapMarkerAlt className="detail-icon" />
                            <span>{activeModalOutlet.address}</span>
                        </div>
                        <div className="detail-row">
                            <FaClock className="detail-icon" />
                            <span>Shift Hours: {activeModalOutlet.hours}</span>
                        </div>
                        <div className="detail-row">
                            <FaShieldAlt className="detail-icon" />
                            <span>System status: Ready & Online</span>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setActiveModalOutlet(null)}>
                            Cancel
                        </button>
                        <button className={`btn-confirm ${activeModalOutlet.colorScheme === 'pink' ? 'confirm-pink' : 'confirm-blue'}`}
                        onClick={() => alert(`Launching terminal for ${activeModalOutlet.name}...`)}>
                            Lunch Register
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SelectOutlet;