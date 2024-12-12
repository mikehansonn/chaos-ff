import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LeagueNavbar from './LeagueNavbar';
import { useAuth } from './AuthContext';
import { Menu } from 'lucide-react';

function Navbar() {
    const location = useLocation();
    const [showNavbar, setShowNavbar] = useState(true);
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const { logout } = useAuth();
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [leagueNavVisible, setLeagueNavVisible] = useState(false);
    const [shouldRenderLeagueNav, setShouldRenderLeagueNav] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);

        return () => clearTimeout(timer);
    }, [isLoggedIn]);

    useEffect(() => {
        const shouldShow = location.pathname.startsWith('/league') && 
                          location.pathname !== '/league' && 
                          location.pathname !== '/league/create' && 
                          location.pathname !== '/league/join';
        
        if (shouldShow) {
            setShouldRenderLeagueNav(true);
            setShowNavbar(true);
            setTimeout(() => {
                setLeagueNavVisible(true);
            }, 50);
        } else {
            setLeagueNavVisible(false);
            setShowNavbar(false);
            setTimeout(() => {
                setShouldRenderLeagueNav(false);
            }, 300);
        }
    }, [location]);

    const handleLogout = () => {
        logout();
        navigate('/user/login');
        setIsMobileMenuOpen(false);
    };

    const Tooltip = ({ text }) => (
        <div className="absolute top-1/2 left-full -translate-y-1/2 ml-2 bg-gray-800 text-white px-2 py-1 rounded text-sm whitespace-nowrap z-50 hidden md:block">
            {text}
        </div>
    );

    const linkClass = "relative h-10 w-5/6 flex flex-col justify-center items-center hover:bg-[#e5e5e5] rounded-3xl group";
    const liClass = "flex flex-col justify-center items-center w-full h-full";
    
    const navbarClass = `fixed top-0 left-0 bg-[#f0f0f0] h-screen flex flex-col items-center justify-between z-40 border-r border-opacity-10 border-[#4c5c68] overflow-visible transition-all duration-300 ease-in-out
        ${showNavbar ? 'w-32' : 'w-16'}
        ${isVisible ? 'md:translate-x-0' : '-translate-x-full'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:block
    `;

    const leagueNavWrapperClass = `w-full flex justify-center transition-all duration-300 ease-in-out transform ${
        leagueNavVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
    }`;

    // Updated Hamburger button with centered positioning when navbar is open
    const HamburgerButton = () => {
        const buttonPosition = isMobileMenuOpen
            ? showNavbar
                ? 'w-32'  // For expanded navbar (32px)
                : 'w-16'  // For collapsed navbar (16px)
            : 'left-4';          // Default position when closed

        return (
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`fixed z-50 p-2 rounded-md bg-gray-200 hover:bg-gray-300 block md:hidden transition-all duration-300 ${buttonPosition} ${
                    isMobileMenuOpen ? 'flex justify-center' : ''
                } top-4`}
                aria-label="Toggle menu"
            >
                <Menu size={24} />
            </button>
        );
    };

    const NavItem = ({ to, onClick, children, tooltip }) => (
        <div
            className={linkClass}
            onMouseEnter={() => setActiveTooltip(tooltip)}
            onMouseLeave={() => setActiveTooltip(null)}
        >
            {to ? (
                <Link 
                    to={to} 
                    className="w-full h-full flex items-center justify-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    {React.cloneElement(children, {
                        className: `${children.props.className} transition-colors duration-200 group-hover:text-blue-500`
                    })}
                </Link>
            ) : (
                <button onClick={(e) => {
                    onClick(e);
                    setIsMobileMenuOpen(false);
                }} className="w-full h-full flex items-center justify-center">
                    {React.isValidElement(children) 
                        ? React.cloneElement(children, {
                            className: `transition-colors duration-200 group-hover:text-blue-500`
                          })
                        : children}
                </button>
            )}
            {activeTooltip === tooltip && <Tooltip text={tooltip} />}
        </div>
    );

    const Overlay = () => (
        isMobileMenuOpen && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
            />
        )
    );

    return (
        <>
            <HamburgerButton />
            <Overlay />
            <nav className={navbarClass}>
                <div className='h-full w-full flex flex-col justify-between'>
                    <div className='divide-y-2 gap-2 w-full flex flex-col justify-center items-center'>
                        <ul className={`list-none flex flex-col justify-center items-center w-full pt-4 mb-4 space-y-2 ${
                            isMobileMenuOpen ? 'mt-12' : ''
                        }`}>
                            <NavItem to="/" tooltip="Home">
                                <li className={liClass}>
                                    <span className="material-symbols-outlined transition-colors duration-100">home</span>
                                </li>
                            </NavItem>
                            <NavItem to="/league" tooltip="Leagues">
                                <li className={liClass}>
                                    <span className="material-symbols-outlined transition-colors duration-100">rewarded_ads</span>
                                </li>
                            </NavItem>
                        </ul>
                        {shouldRenderLeagueNav && (
                            <div className={leagueNavWrapperClass}>
                                <LeagueNavbar onNavigate={() => setIsMobileMenuOpen(false)} />
                            </div>
                        )}
                    </div>
                    <div className='w-full flex flex-col justify-center items-center pb-8 space-y-2'>
                        {isLoggedIn ? (
                            <NavItem to="/user/profile" tooltip="Profile">
                                <li className={liClass}>
                                    <span className="material-symbols-outlined transition-colors duration-100">person</span>
                                </li>
                            </NavItem>
                        ) : (
                            <NavItem to="/user/login" tooltip="Login">
                                <li className={liClass}>
                                    <span className="material-symbols-outlined transition-colors duration-100">login</span>
                                </li>
                            </NavItem>
                        )}
                        {isLoggedIn && (
                            <NavItem onClick={handleLogout} tooltip="Log Out">
                                <div className='flex justify-center items-center'>
                                    <span className="material-symbols-outlined transition-colors duration-100">logout</span>
                                </div>
                            </NavItem>
                        )}
                    </div>
                </div>
            </nav>
        </>
    );
}

export default Navbar;