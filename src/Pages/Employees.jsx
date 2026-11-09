import React from 'react'
import './Employees.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'

function Employees() {
  return (
    <div className="employees-page">
      {/* SideBar*/}
      <SideBar />

      <main className='main-content'>
        {/* Header */}
        <Header headername="Employees" />
      </main>
    </div>
  )
}

export default Employees