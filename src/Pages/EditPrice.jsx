import React from 'react'
import './EditPrice.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'

function EditPrice() {
    return (
        <div className='edit-price-page'>
            {/* SideBar*/ }
            <SideBar />

            <main className='main-content'>
                {/* Header */ }
                <Header headername="Edit Price" />
                
                {/*Fist Section */}
                <div className='price-dashboard'>
                    <section className='price-summary' aria-label='Price overview'>
                        {/* Summary - Flavour list */ }
                        <div className='summary-card'>
                            <span className='summary-label'>Flavour list</span>
                            <strong className='summary-value'>6</strong>
                        </div>

                        {/* Summary - Last updated date */ }
                        <div className='summary-card'>
                            <span className='summary-label'>Last updated</span>
                            <strong className='last-updated'>Jun 13</strong>
                        </div>
                    </section>


                    
                    <div className='price-workspace'>
                        <section className='price-card price-table-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Product prices</h2>
                                    <p>Review current prices and pending updates.</p>
                                </div>
                            </div>
                            <div className='price-table-wrap'>
                                <table className='price-table'>
                                    <thead>
                                        <tr>
                                            <th scope='col'>Product</th>
                                            <th scope='col'>Previous price</th>
                                            <th scope='col'>New price</th>
                                            <th scope='col'>Update rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colSpan='4' className='empty-state'>
                                                No product prices to display.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

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
                                    <select id='product-select' className='product-select' defaultValue='product1'>
                                        <option value='product1'>Vanila</option>
                                        <option value='product2'>Chocolate</option>
                                        <option value='product3'>Strawberry</option>
                                    </select>
                                </div>
                                <div className='price-field'>
                                    <label htmlFor='current-price'>Previous price</label>
                                    <input id='current-price' type='number' className='current-price-input' min='0' step='0.01'  readOnly/>
                                </div>
                                <div className='price-field'>
                                    <label htmlFor='new-price'>New price</label>
                                    <input id='new-price' type='number' className='new-price-input' min='0' step='0.01' />
                                </div>
                                <button type='button' className='update-price-button'>Update price</button>
                            </div>
                        </section>
                    </div>

                    <section className='price-card price-table-card'>
                            <div className='section-heading'>
                                <div>
                                    <h2>Product prices</h2>
                                    <p>Review current prices and pending updates.</p>
                                </div>
                            </div>
                            <div className='price-table-wrap'>
                                <table className='price-table'>
                                    <thead>
                                        <tr>
                                            <th scope='col'>Product</th>
                                            <th scope='col'>Previous price</th>
                                            <th scope='col'>New price</th>
                                            <th scope='col'>Update rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colSpan='4' className='empty-state'>
                                                No product prices to display.
                                            </td>
                                        </tr>
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
