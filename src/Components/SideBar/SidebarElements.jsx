import React from 'react'

function SidebarElements(props) {
    return (
        <button className='sidebar-button'>
            {props.children}
            {props.name}

        </button>
    )
}

export default SidebarElements