import React from 'react'
import './SideBar.css'
import { NavLink } from 'react-router-dom'

function SidebarElements(props) {
    return (
         <NavLink
            to={props.path}
            end={props.path === "/"}
            className={({ isActive }) =>
                isActive ? 'sidebar-button active' : 'sidebar-button'
            }
        >
            {props.children}
            <span>{props.name}</span>
        </NavLink>
    )
}

export default SidebarElements