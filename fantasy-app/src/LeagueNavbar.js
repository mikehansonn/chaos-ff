import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from './api';
import { useAuth } from './AuthContext';

const tokenUtil = {
  getToken: () => localStorage.getItem('token'),
};

function LeagueNavbar() {
    const [leagueData, setLeagueData] = useState(null);
    const [userTeam, setUserTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchLeagueData = async () => {
            setLoading(true);
            if (!isLoggedIn) {
                setLeagueData(null);
                setUserTeam(null);
                setLoading(false);
                return;
            }

            const token = tokenUtil.getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            const searchParams = new URLSearchParams(location.search);
            const leagueId = searchParams.get('leagueid');

            if (!leagueId) {
                setLoading(false);
                return;
            }

            try {
                const [leagueResponse, userResponse] = await Promise.all([
                    api.get(`/leagues/${leagueId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    api.get('/users/me/', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                setLeagueData(leagueResponse.data);

                const userTeamId = leagueResponse.data.teams.find(teamId => 
                    userResponse.data.teams.includes(teamId)
                );

                if (userTeamId) {
                    const teamResponse = await api.get(`/teams/${userTeamId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setUserTeam(teamResponse.data);
                }
            } catch (error) {
                console.error('Error fetching league data:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/user/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLeagueData();

        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);

        return () => clearTimeout(timer);
    }, [isLoggedIn, location, navigate]);

    const isActive = (path) => {
        if (path === '/league/team') {
            return location.pathname.endsWith('/league/team') ? 'bg-[#d6f3ff] border border-opacity-10 border-[#b6d3df]' : '';
        }
        return location.pathname.includes(path) ? 'bg-[#d6f3ff] border border-opacity-10 border-[#b6d3df]' : '';
    };

    const navbarClass = `fixed top-0 left-0 bg-[#f3f3f3] h-screen w-52 flex items-start justify-end z-51 border-r border-opacity-10 border-[#4c5c68] overflow-y-auto transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : '-translate-x-full'
    }`;
    const linkClass = (path) => `h-20 w-5/6 flex flex-col justify-center items-center hover:bg-[#e5e5e5] rounded-3xl ${isActive(path)}`;
    const navItemClass = "flex flex-col justify-center items-center";
    
    return (
        <nav className={navbarClass}>
            <ul className='w-1/2 pt-4 flex flex-col list-none justify-right items-center space-y-2'>
                {leagueData && userTeam && (
                    <>
                        <Link to={`/league/team?leagueid=${leagueData._id}&teamid=${userTeam._id}`} className={linkClass('/league/team')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">group</span><h1>My Team</h1></li>
                        </Link>
                        <Link to={`/league/home?leagueid=${leagueData._id}`} className={linkClass('/league/home')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">trophy</span><h1>League</h1></li>
                        </Link>
                        <Link to={`/league/players?leagueid=${leagueData._id}`} className={linkClass('/league/players')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">view_list</span><h1>Waivers</h1></li>
                        </Link>
                        <Link to={`/league/scoreboard?leagueid=${leagueData._id}`} className={linkClass('/league/scoreboard')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">scoreboard</span><h1>Scoreboard</h1></li>
                        </Link>
                        <Link to={`/league/standings?leagueid=${leagueData._id}`} className={linkClass('/league/standings')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">social_leaderboard</span><h1>Standings</h1></li>
                        </Link>
                        <Link to={`/league/teams?leagueid=${leagueData._id}`} className={linkClass('/league/teams')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">groups_3</span><h1>Teams</h1></li>
                        </Link>
                        <Link to={`/league/settings?leagueid=${leagueData._id}`} className={linkClass('/league/settings')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">settings</span><h1>Settings</h1></li>
                        </Link>
                        <Link to={`/league/draft?leagueid=${leagueData._id}&draftid=${leagueData.draft}&teamid=${userTeam._id}`} className={linkClass('/league/draft')}>
                            <li className={navItemClass}><span className="material-symbols-outlined">contract_edit</span><h1>Draft</h1></li>
                        </Link>
                    </>
                )}
            </ul>
            
        </nav>
    );
}

export default LeagueNavbar;