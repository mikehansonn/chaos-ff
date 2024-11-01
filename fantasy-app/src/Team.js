import React, { useState, useEffect } from 'react';
import api from './api';
import { Route, Routes, Outlet, useNavigate, Link } from 'react-router-dom';

const tokenUtil = {
    getToken: () => localStorage.getItem('token'),
    removeToken: () => localStorage.removeItem('token'),
};

function TeamLanding() {
    const [userLeagues, setUserLeagues] = useState([]);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserDataAndLeagues = async () => {
        const token = tokenUtil.getToken();
        if (!token) {
            navigate('/user/login');
            return;
        }

        try {
            // Fetch user data
            const userResponse = await api.get('/users/me/', {
            headers: { Authorization: `Bearer ${token}` }
            });

            // Fetch leagues data
            const leaguesPromises = userResponse.data.leagues.map(leagueId =>
            api.get(`/leagues/${leagueId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            );
            const leaguesResponses = await Promise.all(leaguesPromises);
            const leaguesData = leaguesResponses.map(response => response.data);

            // Fetch user's team for each league
            const leaguesWithTeams = await Promise.all(leaguesData.map(async (league) => {
            const userTeam = league.teams.find(teamId => userResponse.data.teams.includes(teamId));
            if (userTeam) {
                const teamResponse = await api.get(`/teams/${userTeam}`, {
                headers: { Authorization: `Bearer ${token}` }
                });
                return { ...league, userTeam: teamResponse.data };
            }
            return league;
            }));

            setUserLeagues(leaguesWithTeams);
        } catch (error) {
            console.error('Error fetching user data and leagues:', error);
            setError('Error fetching user data and leagues. Please try again.');
            if (error.response && error.response.status === 401) {
            navigate('/user/login');
            }
        }
        };

        fetchUserDataAndLeagues();
    }, [navigate]);

    const copyLeagueId = (leagueId) => {
        navigator.clipboard.writeText(leagueId).then(() => {
        setCopiedId(leagueId);
        setTimeout(() => setCopiedId(null), 2000);
        });
    };

    return(
        <div className="container mx-auto px-4">
        <div className='h-24'></div>
        <div className='mt-12'>
            <h1 className='text-3xl font-bold mb-6 text-center text-white'>Your Teams</h1>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userLeagues.map((league) => (
                <div key={league._id} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-2">{league.userTeam ? league.userTeam.name : 'N/A'}</h2>
                <p className="text-gray-600 mb-2">League Name: {league.name}</p>
                <div className="relative">
                    <p className="text-sm text-gray-500 mb-2">
                    League ID: 
                    <span 
                        className="ml-2 bg-gray-200 px-2 py-1 rounded cursor-pointer"
                        onMouseEnter={(e) => e.target.textContent = league._id}
                        onMouseLeave={(e) => e.target.textContent = "*******"}
                        onClick={() => copyLeagueId(league._id)}
                    >
                        *******
                    </span>
                    </p>
                    {copiedId === league._id && (
                    <span className="absolute right-0 top-0 text-green-500 text-sm">Copied!</span>
                    )}
                </div>
                <Link 
                    to={`/league/team?leagueid=${league._id}&teamid=${league.userTeam ? league.userTeam._id : 'N/A'}`}
                    className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    View Team
                </Link>
                </div>
            ))}
            </div>
        </div>
        </div>
    );
}

function Team() {
    return (
        <>
        <Routes>
            <Route path="/" element={<TeamLanding />} />
        </Routes>
        <Outlet />
        </>
    );
}

export default Team;