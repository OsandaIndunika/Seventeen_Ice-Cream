import React from 'react'
import './SideBar.css'
import { House, IceCreamCone, CircleDollarSign, Store, Truck, UserGroup, Boxes } from 'lucide-react'
import SidebarElements from './SidebarElements'

function SideBar(props) {
    return (
        <>
            <div className='sidebar'>
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
            </div>
        </>
    )
}

export default SideBar