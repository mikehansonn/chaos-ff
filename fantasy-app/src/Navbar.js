import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api';
import { useAuth } from './AuthContext';

const tokenUtil = {
  getToken: () => localStorage.getItem('token'),
  removeToken: () => localStorage.removeItem('token'),
};

function Navbar() {
    const [userTeams, setUserTeams] = useState([]);
    const [userLeagues, setUserLeagues] = useState([]);
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const { logout } = useAuth();

    useEffect(() => {
        const fetchUserData = async () => {
            if (!isLoggedIn) {
                setUserTeams([]);
                setUserLeagues([]);
                return;
            }

            const token = tokenUtil.getToken();
            if (!token) return;

            try {
                const response = await api.get('/users/me/', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchTeams(response.data.teams);
                fetchLeagues(response.data.leagues);
            } catch (error) {
                console.error('Error fetching user data:', error);
                if (error.response && error.response.status === 401) {
                    setUserTeams([]);
                    setUserLeagues([]);
                }
            }
        };

        fetchUserData();

        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);

        return () => clearTimeout(timer);
    }, [isLoggedIn]);

    const fetchTeams = async (teamIds) => {
        const token = tokenUtil.getToken();
        const teamPromises = teamIds.map(teamId =>
            api.get(`/teams/${teamId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        );

        try {
            const teamResponses = await Promise.all(teamPromises);
            const teamData = teamResponses.map(response => response.data);
            setUserTeams(teamData);
        } catch (error) {
            console.error('Error fetching team data:', error);
        }
    };

    const fetchLeagues = async (leagueIds) => {
        const token = tokenUtil.getToken();
        const leaguePromises = leagueIds.map(leagueId =>
            api.get(`/leagues/${leagueId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        );

        try {
            const leagueResponses = await Promise.all(leaguePromises);
            const leagueData = leagueResponses.map(response => response.data);
            setUserLeagues(leagueData);
        } catch (error) {
            console.error('Error fetching league data:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/user/login');
    };

    const linkClass = "h-20 w-5/6 flex flex-col justify-center items-center hover:bg-[#e5e5e5] rounded-3xl";
    const liClass = "flex flex-col justify-center items-center";
    const navbarClass = `fixed top-0 left-0 bg-[#f0f0f0] h-screen w-24 flex flex-col items-center justify-between z-50 border-r border-opacity-10 border-[#4c5c68] overflow-y-auto transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
    }`;

    return (
        <nav className={navbarClass}>
            <ul className='list-none flex flex-col justify-center items-center w-full pt-4 space-y-2'>
                <Link to='/' className={linkClass}>
                    <li className={liClass}><span className="material-symbols-outlined">home</span><h1>Home</h1></li>
                </Link>
                <Link to='/league' className={linkClass}>
                    <li className={liClass}>
                        <span className="material-symbols-outlined">rewarded_ads</span>
                        <h1>Leagues</h1>
                    </li>
                </Link>
                <Link to='/team' className={linkClass}>
                    <li className={liClass}>
                        <span className="material-symbols-outlined">groups</span>
                        <h1>Teams</h1>
                    </li>
                </Link> 
            </ul>
            <div className='w-full flex flex-col justify-center items-center pb-8'>
                {isLoggedIn ? (
                    <Link to='/user/profile' className={linkClass}>
                        <li className={liClass}><span className="material-symbols-outlined">person</span><h1>Profile</h1></li>
                    </Link>
                ) : (
                    <Link to='/user/login' className={linkClass}>
                        <li className={liClass}><span className="material-symbols-outlined">login</span><h1>Sign in</h1></li>
                    </Link>
                )}
                {isLoggedIn && (
                    <button onClick={handleLogout} className={linkClass}>
                        <span class="material-symbols-outlined"> logout </span>
                        Sign Out
                    </button>
                )}
            </div>
        </nav>
    );
}

export default Navbar;