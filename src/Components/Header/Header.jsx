import React from 'react'
import { useState, useEffect } from 'react'
import './Header.css'
import adminImage from '../../assets/admin.jpg'

function Header(props) {
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);
    return (
        <>
            <div className='header'>
                <div className='header-left'>
                    <p>
                        {props.headername}
                    </p>
                </div>

                <div className='header-center'>
                    <p>{currentTime.toLocaleTimeString()}</p>
                </div>

                <div className='header-right'>
                    <h4>Admin</h4>
                    <img
                        src={adminImage}
                        alt="Admin Profile"
                        className="profile-image"
                    />
                </div>
            </div>
        </>
    )
}

export default Header