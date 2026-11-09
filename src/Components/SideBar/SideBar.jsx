import React from 'react'
import './SideBar.css'
import { House, IceCreamCone, CircleDollarSign, Store, Truck, UserGroup, Boxes,DoorOpen } from 'lucide-react'
import SidebarElements from './SidebarElements'
import logo from '../../assets/logo.PNG'

function SideBar(props) {
    return (
        <>
            <div className='sidebar'>
                <img src={logo} alt="Seventeen Ice Cream" className="sidebar-logo" />
                <SidebarElements name="Dashboard" path="/">
                    <House size={15} />
                </SidebarElements>

                <SidebarElements name="Production" path="/production">
                    <IceCreamCone size={15} />
                </SidebarElements>

                <SidebarElements name="Edit Prices" path="/edit-prices">
                    <CircleDollarSign size={15} />
                </SidebarElements>

                <SidebarElements name="Outlet" path="/outlet">
                    <Store size={15} />
                </SidebarElements>

                <SidebarElements name="Delivery" path="/delivery">
                    <Truck size={15} />
                </SidebarElements>

                <SidebarElements name="Employees" path="/employees">
                    <UserGroup size={15} />
                </SidebarElements>

                <SidebarElements name="Raw Materials" path="/raw-materials">
                    <Boxes size={15} />
                </SidebarElements>

                {/*log out button*/}
                <button type="button" className="logout-button">
                    <DoorOpen size={15} />
                    <span>Logout</span>
                </button>
            </div>
        </>
    )
}

export default SideBar