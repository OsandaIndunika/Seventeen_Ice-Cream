import React from 'react'
import './Production.css'
import SideBar from './SideBar/SideBar'
import Header from './Header/Header'
import { useState } from 'react'

function Production() {
    const [coolroom, setCoolroom] = useState("");
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
                            <div className="production-card">
                                Production for Cool Room 1
                            </div>

                            <div className="production-card">
                                Production for Cool Room 2
                            </div>

                            <div className="production-card">
                                Production for Cool Room 3
                            </div>
                        </div>

                        {/* Record Production Panel */}
                        <div className="record-section">
                            <h3>Record Poduction</h3>
                            <br />
                            <p>Select Coolroom</p>
                            <select className="coolroom-select" value={coolroom} onChange={(e) => setCoolroom(e.target.value)}>
                                <option value="">Select Category</option>
                                <option value="coolroom1">Cool-room 1</option>
                                <option value="coolroom2">Cool-room 2</option>
                                <option value="coolroom3">Cool-room 3</option>
                            </select>
                            <br />
                            Flavour
                        </div>

                    </div>

                </div>


            </div>
        </>

    )
}

export default Production