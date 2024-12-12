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
    const [draftStatus, setDraftStatus] = useState('');
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (!isLoggedIn) {
                setLeagueData(null);
                setUserTeam(null);
                return;
            }

            const token = tokenUtil.getToken();
            if (!token) {
                return;
            }

            const searchParams = new URLSearchParams(location.search);
            const leagueId = searchParams.get('leagueid');

            if (!leagueId) {
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
                    const [teamResponse, draftResponse] = await Promise.all([
                        api.get(`/teams/${userTeamId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        }),
                        api.get(`/drafts/${leagueResponse.data.draft}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                    ]);
                    setUserTeam(teamResponse.data);
                    setDraftStatus(draftResponse.data.status);
                }
            } catch (error) {
                console.error('Error fetching league data:', error);
                if (error.response && error.response.status === 401) {
                    navigate('/user/login');
                }
            } finally {
            }
        };

        fetchLeagueData();

        const timer = setTimeout(() => {
        }, 100);

        return () => clearTimeout(timer);
    }, [isLoggedIn, location, navigate]);

    const isActive = (path) => {
        if (path === '/league/team') {
            return location.pathname.endsWith('/league/team');
        }
        return location.pathname.includes(path);
    };
    
    const linkClass = (path) => `h-10 flex justify-start items-center rounded-md hover:bg-[#e5e5e5] group`;
    
    const contentClass = (path) => `transition-colors duration-200 ${
        isActive(path) ? 'text-blue-500' : 'group-hover:text-blue-500'
    }`;

    const navItemClass = "flex justify-start items-center relative text-sm gap-0.5 ml-1";

    const DraftItem = () => {
        return (
            <li className={`${navItemClass} ${draftStatus === "started" ? "text-red-600 animate-pulse" : ""}`}>
                <div className="flex items-center relative">
                    <span className={`material-symbols-outlined ${contentClass('/league/draft')}`}>contract_edit</span>
                </div>
                <h1 className={contentClass('/league/draft')}>Draft</h1>
            </li>
        );
    };
    
    return (
        <ul className='pt-4 list-none items-center space-y-2 w-10/12'>
            {leagueData && userTeam && (
                <>
                    <Link to={`/league/team?leagueid=${leagueData._id}&teamid=${userTeam._id}`} className={linkClass('/league/team')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/team')}`}>group</span>
                            <h1 className={contentClass('/league/team')}>My Team</h1>
                        </li>
                    </Link>
                    <Link to={`/league/home?leagueid=${leagueData._id}`} className={linkClass('/league/home')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/home')}`}>trophy</span>
                            <h1 className={contentClass('/league/home')}>League</h1>
                        </li>
                    </Link>
                    <Link to={`/league/players?leagueid=${leagueData._id}`} className={linkClass('/league/players')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/players')}`}>view_list</span>
                            <h1 className={contentClass('/league/players')}>Waivers</h1>
                        </li>
                    </Link>
                    <Link to={`/league/scoreboard?leagueid=${leagueData._id}`} className={linkClass('/league/scoreboard')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/scoreboard')}`}>scoreboard</span>
                            <h1 className={contentClass('/league/scoreboard')}>Scoreboard</h1>
                        </li>
                    </Link>
                    <Link to={`/league/standings?leagueid=${leagueData._id}`} className={linkClass('/league/standings')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/standings')}`}>social_leaderboard</span>
                            <h1 className={contentClass('/league/standings')}>Standings</h1>
                        </li>
                    </Link>
                    <Link to={`/league/settings?leagueid=${leagueData._id}`} className={linkClass('/league/settings')}>
                        <li className={navItemClass}>
                            <span className={`material-symbols-outlined ${contentClass('/league/settings')}`}>settings</span>
                            <h1 className={contentClass('/league/settings')}>Settings</h1>
                        </li>
                    </Link>
                    <Link to={`/league/draft?leagueid=${leagueData._id}&draftid=${leagueData.draft}&teamid=${userTeam._id}`} className={linkClass('/league/draft')}>
                        <DraftItem />
                    </Link>
                </>
            )}
        </ul>
    );
}

export default LeagueNavbar;