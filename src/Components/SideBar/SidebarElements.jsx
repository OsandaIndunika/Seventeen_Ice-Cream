import React from 'react'
import './SideBar.css'

function SidebarElements(props) {
    return (
        <button className='sidebar-button'>
            {props.children}
            {props.name}

        </button>
    )
}

export default SidebarElements