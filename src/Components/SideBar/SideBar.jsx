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
                <SidebarElements name="Dashboard" >
                    <House size={15} />
                </SidebarElements>

                <SidebarElements name="Production">
                    <IceCreamCone size={15} />
                </SidebarElements>

                <SidebarElements name="Edit Prices">
                    <CircleDollarSign size={15} />
                </SidebarElements>

                <SidebarElements name="Outlet">
                    <Store size={15} />
                </SidebarElements>

                <SidebarElements name="Delivery">
                    <Truck size={15} />
                </SidebarElements>

                <SidebarElements name="Employees">
                    <UserGroup size={15} />
                </SidebarElements>

                <SidebarElements name="Raw Materials">
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