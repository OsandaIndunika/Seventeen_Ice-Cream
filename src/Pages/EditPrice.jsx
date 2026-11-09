import React from 'react'
import './EditPrice.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { useState } from 'react'

function EditPrice() {
    const Flavours = [
        { id: 1, name: "Vanilla", price: 150 },
        { id: 2, name: "Chocolate", price: 180 },
        { id: 3, name: "Strawberry", price: 160 },
        { id: 4, name: "Mango", price: 170 },
        { id: 5, name: "Coffee", price: 200 },
        { id: 6, name: "Blueberry", price: 220 }
    ];

    const [selectedFlavour, setSelectedFlavour] = useState("");
    const selectedFlavourDetails = Flavours.find(
        (flavour) => flavour.id === Number(selectedFlavour)
    );

    const [newPrice, setNewPrice] = useState("");
    const [updatedPrices, setUpdatedPrices] = useState({});
    const [priceHistory, setPriceHistory] = useState([]);

    const handleUpdatePrice = () => {

        if (!selectedFlavour || newPrice === "" || Number(newPrice) <= 0) {
            alert("Please select a flavour and enter a valid price");
            return;
        }

        const previousPrice =
            updatedPrices[selectedFlavour] ?? selectedFlavourDetails.price;

        const newPriceValue = Number(newPrice);

        const historyEntry = {
            id: crypto.randomUUID(),
            flavour: selectedFlavourDetails.name,
            previousPrice: previousPrice,
            newPrice: newPriceValue,
            updatedAt: new Date().toLocaleString()
        };

        setPriceHistory(prevHistory => [...prevHistory, historyEntry]);

        setUpdatedPrices(prevPrices => ({
            ...prevPrices,
            [selectedFlavour]: newPriceValue
        }));

        setNewPrice("");
    };

    return (
        <div className='edit-price-page'>
            {/* SideBar*/}
            <SideBar />

            <main className='main-content'>
                {/* Header */}
                <Header headername="Edit Price" />

                {/*Fist Section */}
                <div className='price-dashboard'>
                    <section className='price-summary' aria-label='Price overview'>
                        {/* Summary - Flavour list */}
                        <div className='summary-card'>
                            <span className='summary-label'>Flavour list</span>
                            <strong className='summary-value'>{Flavours.length}</strong>
                        </div>

                        {/* Summary - Last updated date */}
                        <div className='summary-card'>
                            <span className='summary-label'>Last updated</span>
                            <strong className='last-updated'>Jun 13</strong>
                        </div>
                    </section>


                    {/* Price table and update form */}
                    <div className='price-workspace'>

                        {/* Price table */}
                        <section className='price-card price-table-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Flavour Price List</h2>
                                    <p>Review current prices and pending updates.</p>
                                </div>
                            </div>

                            <div className='price-table-wrap'>
                                <table className='price-table'>
                                    <thead>
                                        <tr>
                                            <th scope='col'>Flavour</th>
                                            <th scope='col'>Current price</th>
                                            <th scope='col'>New price</th>
                                            <th scope='col'>Update rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Flavours.map((flavour) => (
                                            <tr key={flavour.id}>
                                                <td>{flavour.name}</td>
                                                <td>{flavour.price}</td>
                                                <td>{updatedPrices[flavour.id] !== undefined ? updatedPrices[flavour.id] : '-'}</td>
                                                <td> {updatedPrices[flavour.id] !== undefined && flavour.price > 0
                                                    ? (((updatedPrices[flavour.id] - flavour.price) / flavour.price) * 100).toFixed(2) + "%"
                                                    : "-"
                                                }</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                        {/* Price update form */}
                        <section className='price-card price-update-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Price update</h2>
                                    <p>Enter the new price for a product.</p>
                                </div>
                            </div>

                            <div className='price-update-form'>
                                <div className='price-field'>
                                    <label htmlFor='product-select'>Product</label>
                                    {/* Flavour selection dropdown */}
                                    <select id="product-select" className="product-select" defaultValue="" value={selectedFlavour} onChange={(e) => setSelectedFlavour(e.target.value)}>
                                        <option value="" disabled>Select Product</option>
                                        {Flavours.map((flavour) => (
                                            <option key={flavour.id} value={flavour.id}>
                                                {flavour.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className='price-field'>
                                    <label htmlFor='current-price'>Previous price</label>
                                    <input id='current-price' type='number' className='current-price-input' min='0' step='0.01' value={selectedFlavourDetails ? selectedFlavourDetails.price : ""} readOnly />
                                </div>

                                <div className='price-field'>
                                    <label htmlFor='new-price'>New price</label>
                                    <input id='new-price' type='number' className='new-price-input' min='0' step='0.01' value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                                </div>
                                <button type='button' className='update-price-button' onClick={handleUpdatePrice}>
                                    Update price
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* History of price table */}
                    <section className='price-card price-table-card'>
                        <div className='section-heading'>
                            <div>
                                <h2>Product price history</h2>
                                <p>Review current prices and update history.</p>
                            </div>
                        </div>
                        <div className='price-table-wrap'>
                            <table className='price-table'>
                                <thead>
                                    <tr>
                                        <th scope='col'>Product</th>
                                        <th scope='col'>Previous price</th>
                                        <th scope='col'>New price</th>
                                        <th scope='col'>Update Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {priceHistory.length > 0 ? (
                                        priceHistory.map((entry) => (
                                            <tr key={entry.id}>
                                                <td>{entry.flavour}</td>
                                                <td>{entry.previousPrice}</td>
                                                <td>{entry.newPrice}</td>
                                                <td>{entry.updatedAt}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="empty-state">
                                                No price updates recorded yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    )
}

export default EditPrice
