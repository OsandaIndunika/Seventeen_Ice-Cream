import React, {useState} from "react";
import {
    FaMotorcycle,
    FaTruck,
    FaSnowflake,
    FaArrowLeft
} from 'react-icons/fa';
import './AssignVehicle.css';

function AssignVehicle({onChangeLogin, onOutletSelect}) {
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    const vehicles = [
        {
            id: 'e-bike',
            name: 'E-Bike pro',
            description: 'Fast, eco-friendly delivery for downtown areas. Capacity: 50L',
            icon: <FaMotorcycle className="vehicle-icon pink" />,
            type: 'pink'
        },
        {
            id: 'chiller-van',
            name: 'Chiller Van',
            description: 'Large capacity for suburban routes. Integrated cooling. Capacity: 250L',
            icon: <FaTruck className="vehicle-icon blue" />,
            type: 'blue'
        },
        {
            id: 'heavy-freezer',
            name: 'Heavy Freezer',
            description: 'Long-haul distribution to regional outlets. High-power freezer. Capacity: 600L',
            icon: <FaSnowflake className="vehicle-icon emerald" />,
            type: 'emerald'
        }
    ];

    return (
        <div className="assign-container">
            <div className="assign-card-wrapper">
                <span className="brand-subtitle">
                    <span className="frosty">Frosty</span><span className="delights"> Delights</span>
                </span>
                <h1 className="brand-title">
                    Assign Your Vehicle
                </h1>
                <p className="brand-description">
                    Please select the vehicle you'll be using for today's deliveries.
                </p>

                <div className="vehicle-grid">
                    {vehicles.map((vehicle) => {
                        const isSelected = selectedVehicle === vehicle.id;

                        return (
                            <div key={vehicle.id} onClick={() => setSelectedVehicle(vehicle.id)} className={`vehicle-card ${vehicle.type} ${isSelected ? 'selected' : ''}`}>
                                <div className={`corner-circle ${vehicle.type}`}></div>
                                
                                <div className={`icon-container ${vehicle.type}`}>
                                    {vehicle.icon}
                                </div>

                                <h3 className="vehicle-name">
                                    {vehicle.name}
                                </h3>
                                <p className="vehicle-desc">
                                    {vehicle.description}
                                </p>

                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedVehicle(vehicle.id);
                                    }}
                                    className={`select-btn ${vehicle.type} ${isSelected ? 'selected' : ''}`}
                                >
                                    {isSelected ? 'Selected' : 'Select Vehicle'}
                                </button>
                            </div>
                        );
                    })}
                </div>
                <div className="footer-wrapper">
                    <button className="footer-link">
                        <FaArrowLeft /> Change Login
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AssignVehicle;