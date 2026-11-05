import React from 'react'
import './Production.css'
import SideBar from './SideBar/SideBar'
import Header from './Header/Header'
import { useState } from 'react'

function Production() {
    const [coolroom, setCoolroom] = useState("");
    const [flavour, setFlavour] = useState("");
    const [quantity, setQuantity] = useState("");
    const [productionEntries, setProductionEntries] = useState([]);


    {/* Add a new production entry */ }
    const handleAddEntry = () => {

        if (!coolroom || !flavour || !quantity || Number(quantity) <= 0) {
            alert("Please fill all fields correctly");
            return;
        }

        const newEntry = {
            id: crypto.randomUUID(),
            coolroom: coolroom,
            flavour: flavour,
            quantity: Number(quantity),
            batch: productionEntries.filter((entry) => entry.coolroom === coolroom).length + 1,
            createdAt: new Date().toISOString()
        };

        setProductionEntries(prevEntries => [...prevEntries, newEntry]);

        setFlavour("");
        setQuantity("");
    }

    {/* Clear all production entries */ }
    const handleClearAll = () => {
        setProductionEntries([]);
    };

    return (
        <>
            <div className='app-container'>
                {/*Side bar */}
                <SideBar />

                <div className='main-content'>

                    {/*Header*/}
                    <Header headername="Production" />

                    <div className="dashboard-body">

                        {/* Cool Room Production Cards */}

                        <div className="production-section">

                            {["coolroom-1", "coolroom-2", "coolroom-3"].map((room, index) => {

                                const roomEntries = productionEntries.filter(
                                    (entry) => entry.coolroom === room
                                );

                                const totalQuantity = roomEntries.reduce(
                                    (total, entry) => total + entry.quantity, 0
                                );

                                return (
                                    <div className="production-card" key={room}>

                                        <div className="production-card-header">
                                            <h3>Production for Cool Room {index + 1}</h3>
                                            <span>Total: {totalQuantity}</span>
                                        </div>

                                        {roomEntries.length === 0 ? (
                                            <p>No production recorded yet.</p>
                                        ) : (
                                            <div className="production-table-wrapper">
                                                <table className="production-table">
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Flavour</th>
                                                            <th scope="col">Batch</th>
                                                            <th scope="col">Date and Time</th>
                                                            <th scope="col">Quantity</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {roomEntries.map((entry) => (
                                                            <tr key={entry.id}>
                                                                <td>{entry.flavour}</td>
                                                                <td>{entry.batch}</td>
                                                                <td>
                                                                    <time dateTime={entry.createdAt}>
                                                                        {new Date(entry.createdAt).toLocaleString()}
                                                                    </time>
                                                                </td>
                                                                <td>{entry.quantity}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                    </div>
                                );
                            })}

                        </div>


                        {/* Record Production Panel */}
                        <div className="record-section">
                            <h3>Record Poduction</h3>
                            <br />

                            {/* Cool Room Selection */}
                            <p>Select Coolroom</p>
                            <select className="coolroom-select" value={coolroom} onChange={(e) => setCoolroom(e.target.value)}>
                                <option value="">Select Category</option>
                                <option value="coolroom-1">Cool-room 1</option>
                                <option value="coolroom-2">Cool-room 2</option>
                                <option value="coolroom-3">Cool-room 3</option>
                            </select>


                            <div className="flavour-quantity-section">

                                {/* Flavour Selection */}
                                <div className="flavour-select-section">
                                    <label>Flavour</label><br />
                                    <select className="flavour-select" value={flavour} onChange={(e) => setFlavour(e.target.value)}>
                                        <option value="">Select Flavour</option>
                                        <option value="vanilla">Vanilla</option>
                                        <option value="chocolate">Chocolate</option>
                                        <option value="strawberry">Strawberry</option>
                                    </select>
                                </div>

                                {/* Quantity Input */}
                                <div className="quantity-input-section">
                                    <label>Quantity</label><br />
                                    <input type="number" placeholder='e.g. 50' className='quentity-input' value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                                </div>

                            </div>

                            {/* Add Entry Button */}
                            <button className='add-entry-btn' onClick={handleAddEntry}>+ Add Entry</button>
                            <hr style={{ border: '1px solid #ccc', margin: '20px 0' }} />

                            <div className="production-list-header">
                                <h4>Today's Production</h4>

                                {/* Clear All Button */}
                                <button className="clear-btn" onClick={handleClearAll}>
                                    Clear All
                                </button>
                            </div>
                            <ul>
                                {productionEntries.length === 0 ? (
                                    <p>No production recorded yet.</p>
                                ) : (
                                    productionEntries.map((entry) => (
                                        <li key={entry.id}>
                                            {entry.flavour} - {entry.quantity}
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                    </div>

                </div>


            </div>
        </>

    )
}
export default Production