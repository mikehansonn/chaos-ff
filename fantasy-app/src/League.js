import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import { Route, Routes, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import LeagueNavbar from './LeagueNavbar';
import DraftHome from './Draft';
import { format, parseISO, addMinutes } from 'date-fns';

const tokenUtil = {
  getToken: () => localStorage.getItem('token'),
  removeToken: () => localStorage.removeItem('token'),
};

const POSITION_MAPPING = {
  "QB": [0],
  "RB": [1, 2],
  "WR": [3, 4],
  "TE": [5],
  "FLEX": [6],
  "DEF": [7],
  "K": [8],
  "BE": Array.from({ length: 8 }, (_, i) => i + 9)
};


function LeagueCreate() {
  const [leagueData, setLeagueData] = useState({
    name: '',
    comissioner: '',
    number_of_players: ''
  });
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      try {
        const response = await api.get('/users/me/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData(response.data);
        setLeagueData(prevState => ({
          ...prevState,
          comissioner: response.data._id
        }));
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Error fetching user data. Please try again.');
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };
    fetchUserData();
  }, [navigate, location]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setLeagueData(prevState => ({
      ...prevState,
      [name]: value
    }));
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
    try {
      const response = await api.post('/leagues/create/', leagueData);
      setSuccess(true);
      setLeagueData({
        name: '',
        number_of_players: '',
        commissioner: userData?._id || ''
      });
      
      const newLeagueId = response.data._id;
      navigate(`/league/home?leagueid=${newLeagueId}`);
    } catch (err) {
      setError('Error creating league. Please try again.');
      console.error('Error creating league:', err);
    }
  };

  return (
    <div className="w-1/3 mx-auto">
      <div className="h-52"></div>
        <form onSubmit={handleFormSubmit} className="bg-slate-100 shadow-md rounded-xl px-8 pt-6 pb-8 mb-4">
        <h2 className="text-3xl font-bold mb-6 text-center">Create League</h2>
          <div className="mb-4" key='name'>
            <label htmlFor='name' className="block text-gray-700 text-sm font-bold mb-2">Name</label>
            <input 
              type='name' 
              id='name' 
              name='name' 
              onChange={handleInputChange} 
              value={leagueData['name']} 
              placeholder="Enter League Name"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              required
            />
          </div>
          <div className="mb-6" key='number_of_players'>
            <label htmlFor='number_of_players' className="block text-gray-700 text-sm font-bold mb-2">Number Of Players</label>
            <input 
              type='number_of_players' 
              id='number_of_players' 
              name='number_of_players' 
              onChange={handleInputChange} 
              placeholder="Enter Number of Players"
              value={leagueData['number_of_players']} 
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button type='submit' className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Create League
            </button>
          </div>
        </form>
        
        {error && <p className="text-red-600 mt-4">{error}</p>}
        {success && <p className="text-green-600 mt-4">League created successfully!</p>}
      </div>
  );
}

function LeagueHome() {
  const [league, setLeague] = useState(null);
  const [commissioner, setCommissioner] = useState(null);
  const [userTeam, setUserTeam] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchLeagueData = async () => {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');

      if (!leagueId) {
        setError('League ID not provided');
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

        const leagueData = leagueResponse.data;
        const userData = userResponse.data;

        setCurrentUser(userData);

        // Check if the user is a member of the league
        const userTeams = userData.teams || [];
        const isUserInLeague = leagueData.teams.some(teamId => userTeams.includes(teamId));
        if (!isUserInLeague) {
          setError('You are not a member of this league');
          setLoading(false);
          return;
        }

        // Fetch team data and owner data for each team
        const teamsWithData = await Promise.all(leagueData.teams.map(async (teamId) => {
          const teamResponse = await api.get(`/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const teamData = teamResponse.data;
          
          const ownerResponse = await api.get(`/users/${teamData.owner}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          return {
            ...teamData,
            ownerData: ownerResponse.data
          };
        }));

        const commissionerResponse = await api.get(`/users/${leagueData.commissioner}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const commissionerData = commissionerResponse.data;

        const userTeam = teamsWithData.find(team => team.owner === userData._id);
        setUserTeam(userTeam);

        setLeague({ ...leagueData, teams: teamsWithData });
        setCommissioner(commissionerData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setError('Error fetching league data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login');
        }
      }
    };

    fetchLeagueData();
  }, [navigate, location]);

  const copyLeagueId = (leagueId) => {
    navigator.clipboard.writeText(leagueId).then(() => {
      setCopiedId(leagueId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  const isCommissioner = currentUser && league && currentUser._id === league.commissioner;

  return (
    <div className="w-3/4 mx-auto mt-8">
      <LeagueNavbar />
      <div className='h-16'></div>
      <div className='flex justify-center items-center gap-2'>
        <div className=' justify-center items-center w-2/5 '>
          <div className="bg-gray-100 p-4 rounded-lg mb-2 h-[300px] shadow">
            <h1 className="text-4xl font-bold mb-4">{league.name}</h1>
            <h1 className="text-base text-gray-500 mb-2">Commissioner: {commissioner ? commissioner.username : 'Loading...'}</h1>
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
            <h1 className="text-base text-gray-500 mb-2">Players: {league.teams.length}/{league.number_of_players}</h1>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
          <div className='space-y-2 bg-gray-100 shadow rounded-lg p-4 h-[100px] flex justify-between items-center'>
            <div>
              <h2 className="text-xl font-semibold mb-2">My Team:</h2>
              <p className="p-1 mt-0 text-gray-500">{userTeam ? userTeam.name : 'Loading...'}</p>
            </div>
          </div>
        </div>
      <ul className="bg-gray-100 shadow rounded-lg p-4 w-1/5 h-[408px]">
        <h2 className="text-xl font-semibold mb-2">Teams in this league:</h2>
        {league.teams.map(team => (
          <li key={team._id} className="p-1 mt-0 text-gray-500">
            <span className="m-0">{team.name}</span></li>
        ))}
      </ul>
      </div>
    </div>
  );
}

function LeagueJoin() {
  const [userData, setUserData] = useState(null);
  const [leagueId, setLeagueId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login');
        return;
      }

      try {
        const response = await api.get('/users/me/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Error fetching user data. Please try again.');
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login');
        }
      }
    };

    fetchUserData();
  }, [navigate]);
  
  const handleJoinLeague = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: '/league/join' } });
        return;
      }

      const joinData = {
        user_id: userData._id,
        league_id: leagueId,
        team_name: teamName
      };

      const response = await api.post('/leagues/join/', joinData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Assuming the API returns the updated league data
      const updatedLeague = response.data;
      navigate(`/league/home?leagueid=${updatedLeague._id}`);
    } catch (error) {
      console.error('Error joining league:', error);
      setError('Error joining league. Please check the ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-1/3 mx-auto">
      <div className="h-52"></div>
      <form onSubmit={handleJoinLeague} className="bg-slate-100 shadow-md rounded-xl px-8 pt-6 pb-8 mb-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Join a League</h1>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="leagueId">
            League ID
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="leagueId"
            type="text"
            placeholder="Enter League ID"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="teamName">
            Team Name
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="teamName"
            type="text"
            placeholder="Enter Your Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </div>
      </form>
      {error && <p className="text-red-500 text-xs italic">{error}</p>}
    </div>
  );
}

function LeaguePlayers() {
  const [players, setPlayers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [weekIndex, setWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userTeam, setUserTeam] = useState(null);
  const [leagueId, setLeagueId] = useState(null);
  const [draftingPlayer, setDraftingPlayer] = useState(null);
  const [positionFilter, setPositionFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [draftError, setDraftError] = useState('');
  const [isChangingPage, setIsChangingPage] = useState(false);
  const playersPerPage = 20;
  const location = useLocation();
  const navigate = useNavigate();
  const positions = [
    { value: '', label: 'All' },
    { value: 'QB', label: 'QB' },
    { value: 'RB', label: 'RB' },
    { value: 'WR', label: 'WR' },
    { value: 'TE', label: 'TE' },
    { value: 'K', label: 'K' },
    { value: 'DEF', label: 'DEF' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      setIsChangingPage(true);
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueIdParam = searchParams.get('leagueid');
      setLeagueId(leagueIdParam);

      try {
        const [playersResponse, userResponse, leagueResponse] = await Promise.all([
          api.get(`/nfl-players-paginated/`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
              page: currentPage, 
              limit: playersPerPage,
              position: positionFilter || undefined,
              name: nameFilter || undefined
            }
          }),
          api.get('/users/me/', { headers: { Authorization: `Bearer ${token}` } }),
          api.get(`/leagues/${leagueIdParam}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const playersData = playersResponse.data.slice(0, -1);
        setTotalPages(parseInt(playersResponse.data[playersData.length]["name"]));
        setWeekIndex(parseInt(leagueResponse.data["week"]) - 1);

        // Check availability for each player
        const playersWithAvailability = await Promise.all(playersData.map(async (player) => {
          const availabilityResponse = await api.get(`/leagues/${leagueIdParam}/players/${player._id}/available`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(player);
          return { ...player, isAvailable: availabilityResponse.data };
        }));

        setPlayers(playersWithAvailability);

        const userTeamId = leagueResponse.data.teams.find(teamId => 
          userResponse.data.teams.includes(teamId)
        );

        if (userTeamId) {
          const teamResponse = await api.get(`/teams/${userTeamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUserTeam(teamResponse.data);
        }

        setLoading(false);
        setIsChangingPage(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Error fetching data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };

    fetchData();
  }, [currentPage, location, navigate, positionFilter, nameFilter]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePositionFilterChange = (value) => {
    setPositionFilter(value);
    setCurrentPage(1);
  };

  const handleNameSearchChange = (event) => {
    setNameFilter(event.target.value);
    setCurrentPage(1);
  };

  const getPositionStyles = (position) => {
    const styles = {
      QB: { bg: 'bg-red-100', text: 'text-red-800', activeBg: 'bg-red-200', hoverBg: 'hover:bg-red-50' },
      RB: { bg: 'bg-blue-100', text: 'text-blue-800', activeBg: 'bg-blue-200', hoverBg: 'hover:bg-blue-50' },
      WR: { bg: 'bg-green-100', text: 'text-green-800', activeBg: 'bg-green-200', hoverBg: 'hover:bg-green-50' },
      TE: { bg: 'bg-yellow-100', text: 'text-yellow-800', activeBg: 'bg-yellow-200', hoverBg: 'hover:bg-yellow-50' },
      DEF: { bg: 'bg-gray-100', text: 'text-gray-800', activeBg: 'bg-gray-200', hoverBg: 'hover:bg-gray-50' },
      K: { bg: 'bg-gray-100', text: 'text-gray-800', activeBg: 'bg-gray-200', hoverBg: 'hover:bg-gray-50' }
    };

    return styles[position] || { bg: 'bg-white', text: 'text-gray-700', activeBg: 'bg-gray-100', hoverBg: 'hover:bg-gray-50' };
  };

  const handleDraftPlayer = async (playerId) => {
    if (!userTeam || !leagueId) {
      setError('Unable to draft player. Please try again.');
      return;
    }

    setDraftingPlayer(playerId);
    setDraftError('');
    const token = tokenUtil.getToken();

    try {
      await api.post(`/leagues/${leagueId}/teams/${userTeam._id}/draft`, 
        { player_id: playerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPlayers(players.map(player => 
        player._id === playerId ? { ...player, isAvailable: false } : player
      ));
      setActionSuccess(`Player has been added.`);
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (error) {
      console.error('Error drafting player:', error);
      if (error.response && error.response.status === 400) {
        setDraftError(error.response.data.detail || 'Unable to draft player. Your team might be full or there\'s no suitable spot.');
        setTimeout(() => setDraftError(''), 3000);
      } else {
        setDraftError('Unable to draft player. They may not be available.');
        setTimeout(() => setDraftError(''), 3000);
      }
    } finally {
      setDraftingPlayer(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div>
      <LeagueNavbar />
      <div className="flex justify-center items-center gap-2 mb-2">
        <input 
          type='name' 
          id='name' 
          name='name' 
          value={nameFilter} 
          onChange={handleNameSearchChange} 
          placeholder="Search..."
          className="shadow appearance-none border rounded w-1/2 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
        />
        {positions.map((position) => {
          const styles = getPositionStyles(position.value);
          return (
            <button
              key={position.value}
              onClick={() => handlePositionFilterChange(position.value)}
              className={`
                w-12 h-12 flex items-center justify-center text-sm font-medium
                border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                ${positionFilter === position.value 
                  ? styles.activeBg
                  : `${styles.bg} ${styles.hoverBg}`}
                ${styles.text}
              `}
            >
              {position.label}
            </button>
          );
        })}
      </div>

      {draftError && (
        <div className="mx-auto w-1/5 fixed top-12 left-0 right-0 bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3 z-50" role="alert">
          <div className="mx-auto flex items-center justify-between">
            <div>
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{draftError}</span>
            </div>
            <button 
              onClick={() => setDraftError('')} 
              className="text-red-700 hover:text-red-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="mx-auto w-1/5 fixed top-12 left-0 right-0 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 z-50" role="alert">
          <div className="mx-auto flex items-center justify-between">
            <div>
              <strong className="font-bold">Success: </strong>
              <span className="block sm:inline">{actionSuccess}</span>
            </div>
            <button 
              onClick={() => setActionSuccess('')} 
              className="text-green-700 hover:text-green-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="relative bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="pl-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              <th scope="col" className="px-2 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Position</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player) => (
              <tr key={player._id}>
                <td className="whitespace-nowrap">
                  <div className="flex pl-6">
                    {player && player.team && (
                      <img 
                        src={`https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`}
                        alt={`${player.team} logo`}
                        className="w-10 h-10 object-contain opacity-90"
                      />
                    )}
                  </div>
                </td>
                <td className="px-6 py-2 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {player ? player.name : "None"}
                        {player.injury_status && (
                          <span className="text-red-600 ml-1">{player.injury_status}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{player ? `${player.position} - ${player.team}` : "-"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap border-r">
                  <div className={`inline-block rounded-full px-3 py-1 ${getPositionStyles(player.position).bg} ${getPositionStyles(player.position).text}`}>
                    <div className="text-sm font-medium">{player.position}</div>
                  </div>
                </td>
                <td className="px-6 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{player?.opponent || "-"}</div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{Number(player.total_points || 0).toFixed(1)}</div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{player.projected_points.toFixed(2)}</div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{(player.weeks[weekIndex] ? player.weeks[weekIndex].toFixed(1) : "-")}</div>
                </td>
                <td className="px-6 whitespace-nowrap text-center">
                  {player.isAvailable ? (
                    <button
                      onClick={() => handleDraftPlayer(player._id)}
                      disabled={draftingPlayer === player._id}
                      className="px-4 py-1 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {draftingPlayer === player._id ? 'Adding...' : 'Add Player'}
                    </button>
                  ) : (
                    <span className="text-sm text-red-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isChangingPage && (
          <div className="absolute inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-6xl animate-spin">
                  progress_activity
              </span>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isChangingPage}
          className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isChangingPage}
          className="px-4 py-2 border rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function LeagueScoreboard() {
  const [league, setLeague] = useState(null);
  const [matchups, setMatchups] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchLeagueData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');

      if (!leagueId) {
        setError('League ID not provided');
        setLoading(false);
        return;
      }

      try {
        const leagueResponse = await api.get(`/leagues/${leagueId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeague(leagueResponse.data);
        setSelectedWeek(leagueResponse.data.week || 1);
      } catch (error) {
        handleError(error);
      }
    };

    fetchLeagueData();
  }, [navigate, location]);

  useEffect(() => {
    const fetchWeekData = async () => {
      if (!league) return;

      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        setLoading(true);
        const weekMatchupIds = league.schedule[selectedWeek - 1] || [];
        const matchupPromises = weekMatchupIds.map(matchupId =>
          api.get(`/matchup/${matchupId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
        const matchupResponses = await Promise.all(matchupPromises);
        const weekMatchups = matchupResponses.map(response => response.data);
        setMatchups(weekMatchups);

        const teamIds = new Set(weekMatchups.flatMap(m => [m.team_a, m.team_b]));
        const teamPromises = Array.from(teamIds).map(teamId =>
          api.get(`/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
        const teamResponses = await Promise.all(teamPromises);
        const teamsData = Object.fromEntries(
          teamResponses.map(response => [response.data._id, response.data])
        );
        setTeams(teamsData);
        setLoading(false);
      } catch (error) {
        handleError(error);
      }
    };

    fetchWeekData();
  }, [league, selectedWeek]);

  const handleError = (error) => {
    setLoading(false);
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      navigate('/user/login', { state: { from: location.pathname } });
    } else {
      setError('An error occurred while fetching data');
    }
  };

  const renderMatchup = (matchup) => {
    if (!matchup) return null;
    const teamA = teams[matchup.team_a];
    const teamB = teams[matchup.team_b];
    return (
      <div key={matchup._id} className="border px-4 py-4 m-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className='text-gray-500'>
            {matchup.team_a_score.toFixed(2)}
          </div>
          <div className="flex-1 text-right">
            {teamA ? `${teamA.name} (${teamA.wins}-${teamA.losses})` : 'BYE'}
          </div>
          <div className="mx-4 text-gray-500">
              vs
          </div>
          <div className="flex-1 text-left">
            {teamB ? `${teamB.name} (${teamB.wins}-${teamB.losses})` : 'BYE'}
          </div>
          <div className='text-gray-500'>
            {matchup.team_b_score.toFixed(2)}
          </div>
        </div>
        {matchup.status === 'completed' && (
          <div className="text-center mt-2">
            Winner: {matchup.winner ? teams[matchup.winner].name : 'BYE'}
          </div>
        )}
        <div className="text-center mt-2">
          <Link to={`/league/matchup?leagueid=${league._id}&matchupid=${matchup._id}`} className="text-blue-500 hover:text-blue-700">
            <span className="material-symbols-outlined">open_in_new</span>
          </Link>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="w-3/5 mx-auto mt-8">
      <LeagueNavbar />
      <div className='bg-white p-8 rounded-xl'>
        <div className='flex items-center'>
          <h1 className="text-3xl font-bold mb-8 pr-2">Scoreboard</h1>
          <h1 className='mb-6 pl-2'>{league.name}</h1>
        </div>
        <div className="mb-6">
          <select
            id="week-select"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="block w-1/4 p-2 border rounded"
          >
            {league.schedule.map((_, index) => (
              <option key={index} value={index + 1}>
                Week {index + 1}{index + 1 === league.current_week ? ' (Current)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className=" rounded-t-lg bg-gray-50 border border-gray-200 px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-500">
              Week {selectedWeek} Matchups
            </h3>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            {matchups.map(renderMatchup)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeagueMatchup() {
  const [matchup, setMatchup] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchMatchupData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const matchupId = searchParams.get('matchupid');

      if (!matchupId) {
        setError('Matchup ID not provided');
        setLoading(false);
        return;
      }

      try {
        const matchupResponse = await api.get(`/matchup/${matchupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMatchup(matchupResponse.data);

        const [teamAResponse, teamBResponse] = await Promise.all([
          api.get(`/teams/${matchupResponse.data.team_a}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          api.get(`/teams/${matchupResponse.data.team_b}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const fetchPlayerData = async (team) => {
          const playerPromises = team.roster.map(playerId =>
            playerId ? api.get(`/nfl-players/${playerId}`, { headers: { Authorization: `Bearer ${token}` } }) : null
          );
          const playerResponses = await Promise.all(playerPromises);
          return playerResponses.map(response => response ? response.data : null);
        };

        const [teamAPlayerData, teamBPlayerData] = await Promise.all([
          fetchPlayerData(teamAResponse.data),
          fetchPlayerData(teamBResponse.data)
        ]);

        setTeamA({ ...teamAResponse.data, roster: teamAPlayerData });
        setTeamB({ ...teamBResponse.data, roster: teamBPlayerData });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching matchup data:', error);
        setError('Error fetching matchup data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };

    fetchMatchupData();
  }, [navigate, location]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!matchup || !teamA || !teamB) return <div>No data available</div>;

  const getPositionForIndex = (index) => {
    for (const [position, indices] of Object.entries(POSITION_MAPPING)) {
      if (indices.includes(index)) {
        return position;
      }
    }
    return '';
  };

  const calculateTotalPoints = (team) => {
    return team.roster.reduce((total, player) => total + (player?.points || 0), 0);
  };

  const teamATotal = calculateTotalPoints(teamA);
  const teamBTotal = calculateTotalPoints(teamB);

  const renderPlayerRow = (playerA, playerB, index) => {
    const position = getPositionForIndex(index);
    
    return (
      <tr key={index}>
        <td className="w-1/4 px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {playerA ? playerA.name : 'Empty'}
        </td>
        <td className="w-1/5 px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
          {playerA ? (playerA.points || 0).toFixed(2) : '-'}
        </td>
        <td className="w-24 px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-x text-center font-bold bg-gray-50">
          {position}
        </td>
        <td className="w-1/5 px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-left">
          {playerB ? (playerB.points || 0).toFixed(2) : '-'}
        </td>
        <td className="w-1/4 px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
          {playerB ? playerB.name : 'Empty'}
        </td>
      </tr>
    );
  };

  const renderTotalRow = () => (
    <tr className="bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-md font-bold text-gray-900 text-right">
        {teamATotal.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-md text-gray-500 text-center">
        TOTAL
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-md font-bold text-gray-900 text-left">
        {teamBTotal.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
      </td>
    </tr>
  );

  return (
    <div className="w-1/2 mx-auto mt-8">
      <LeagueNavbar />
      <div className='bg-white p-8 rounded-xl'>
        <h1 className="text-3xl font-bold mb-8">Matchup Details</h1>
        
        <div className="flex justify-center items-center mb-8">
          <div className="w-1/3">
            <h2 className="text-2xl font-semibold">{teamA.name}</h2>
            <p className="text-xl">{matchup.team_a_score.toFixed(2)} pts</p>
          </div>
          <div className="text-3xl text-center font-bold w-1/3">VS</div>
          <div className="text-right w-1/3">
            <h2 className="text-2xl font-semibold">{teamB.name}</h2>
            <p className="text-xl">{matchup.team_b_score.toFixed(2)} pts</p>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <tbody className="bg-white divide-y divide-gray-200">
            {teamA.roster.slice(0, 9).map((playerA, index) => 
              renderPlayerRow(playerA, teamB.roster[index], index)
            )}
            
            {renderTotalRow()}

            {teamA.roster.slice(9).map((playerA, index) => 
              renderPlayerRow(playerA, teamB.roster[index + 9], index + 9)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeagueStandings() {
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');

      if (!leagueId) {
        setError('League ID not provided');
        setLoading(false);
        return;
      }

      try {
        const leagueResponse = await api.get(`/leagues/${leagueId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeague(leagueResponse.data);

        const teamPromises = leagueResponse.data.teams.map(teamId =>
          api.get(`/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
        const teamResponses = await Promise.all(teamPromises);
        const teamsData = teamResponses.map(response => response.data);

        // Calculate win percentage and sort teams
        const sortedTeams = teamsData
          .map(team => ({
            ...team,
            winPercentage: team.wins / (team.wins + team.losses) || 0
          }))
          .sort((a, b) => b.winPercentage - a.winPercentage);

        setTeams(sortedTeams);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Error fetching data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };

    fetchData();
  }, [navigate, location]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="w-3/5 mx-auto mt-8">
      <LeagueNavbar />
      <div className='bg-white p-8 rounded-xl'>
        <div className='flex items-center'>
          <h1 className="text-3xl font-bold mb-8 pr-2">Standings</h1>
          <h1 className='mb-6 pl-2'>{league.name}</h1>
        </div>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-200">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wins
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Losses
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Win %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teams.map((team, index) => (
                <tr key={team._id} className={index % 2 === 0 ? 'bg-[#fdfdfd]' : 'bg-[#fbfbfc]'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{team.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {team.wins}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {team.losses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(team.winPercentage).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeagueTeams() {
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const expandedContentRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');

      if (!leagueId) {
        setError('League ID not provided');
        setLoading(false);
        return;
      }

      try {
        const leagueResponse = await api.get(`/leagues/${leagueId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeague(leagueResponse.data);

        const teamPromises = leagueResponse.data.teams.map(teamId =>
          api.get(`/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
        const teamResponses = await Promise.all(teamPromises);
        const teamsData = await Promise.all(teamResponses.map(async (response) => {
          const team = response.data;
          const rosterPromises = team.roster.map(playerId =>
            api.get(`/nfl-players/${playerId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
          const rosterResponses = await Promise.all(rosterPromises);
          const roster = rosterResponses.map(r => r.data);

          // Fetch team owner information
          const ownerResponse = await api.get(`/users/${team.owner}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const ownerName = ownerResponse.data.name;

          return { ...team, roster, ownerName };
        }));

        setTeams(teamsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Error fetching data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };

    fetchData();
  }, [navigate, location]);

  const toggleTeamExpansion = (teamId) => {
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  useEffect(() => {
    if (expandedContentRef.current) {
      expandedContentRef.current.style.height = expandedTeam
        ? `${expandedContentRef.current.scrollHeight}px`
        : '0px';
    }
  }, [expandedTeam]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="w-1/2 mx-auto my-8">
      <LeagueNavbar />
      <div className='bg-white p-8 rounded-xl'>
        <div className='flex items-center'>
          <h1 className="text-3xl font-bold mb-8 pr-2">Teams</h1>
          <h1 className='mb-6 pl-2'>{league.name}</h1>
        </div>
        
        <div className="">
          {teams.map((team) => (
            <div key={team._id} className="bg-white border border-gray-300 mb-4 rounded-xl">
              <div 
                className="flex justify-between items-center p-4 cursor-pointer"
                onClick={() => toggleTeamExpansion(team._id)}
              >
                <div>
                  <h2 className="text-base font-semibold">{team.name}</h2>
                  <h2 className='text-sm font-medium text-gray-500'>W/L: {team.wins}-{team.losses}</h2>
                  <h3 className='text-sm font-medium text-gray-500'>Owner: {team.ownerName}</h3>
                </div>
                {expandedTeam === team._id ? <span className="material-symbols-outlined">remove</span> : <span className="material-symbols-outlined">add</span>}
              </div>
              
              <div 
                ref={expandedTeam === team._id ? expandedContentRef : null}
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedTeam === team._id ? 'max-h-[1000px]' : 'max-h-0'
                }`}
              >
                <div className="p-4 border-t">
                  <h3 className="font-semibold mb-2">Roster</h3>
                  <ul className="space-y-2 mb-12">
                    {team.roster.slice(0, 9).map((player) => (
                      <li key={player._id} className="flex justify-between">
                        <span>{player.name}</span>
                        <span className="text-gray-500">{player.position}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2">
                    {team.roster.slice(9).map((player) => (
                      <li key={player._id} className="flex justify-between">
                        <span>{player.name}</span>
                        <span className="text-gray-500">{player.position}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeagueMyTeam() {
  const [league, setLeague] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [teamOwner, setTeamOwner] = useState(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [roster, setRoster] = useState(Array(17).fill(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [swapError, setSwapError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');
      const teamId = searchParams.get('teamid');

      if (!leagueId || !teamId) {
        setError('League ID or Team ID not provided');
        setLoading(false);
        return;
      }

      try {
        const [leagueResponse, teamResponse, currentResponse] = await Promise.all([
          api.get(`/leagues/${leagueId}`, { headers: { Authorization: `Bearer ${token}` } }),
          api.get(`/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } }),
          api.get(`/users/me/`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        setLeague(leagueResponse.data);
        setTeam(teamResponse.data);
        setCurrentUser(currentResponse.data);
        setWeekIndex(parseInt(leagueResponse.data["week"]) - 1);

        const ownerResponse = await api.get(`/users/${teamResponse.data.owner}`, { headers: { Authorization: `Bearer ${token}` } });
        setTeamOwner(ownerResponse.data);

        const playerPromises = teamResponse.data.roster.map(playerId =>
          playerId ? api.get(`/nfl-players/${playerId}`, { headers: { Authorization: `Bearer ${token}` } }) : null
        );
        const playerResponses = await Promise.all(playerPromises);
        const rosterData = playerResponses.map(response => response ? response.data : null);

        setRoster(rosterData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Error fetching data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/user/login', { state: { from: location.pathname } });
        }
      }
    };

    fetchData();
  }, [navigate, location]);

  const getPositionForIndex = (index) => {
    for (const [position, indices] of Object.entries(POSITION_MAPPING)) {
      if (indices.includes(index)) {
        return position;
      }
    }
    return 'Unknown';
  };

  const handleRemovePlayer = async () => {
    if (!playerToRemove) return;
  
    try {
      const token = localStorage.getItem('token');
      await api.post(`/teams/${team._id}/remove_player/${playerToRemove.player._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newRoster = [...roster];
      newRoster[playerToRemove.index] = null;
      setRoster(newRoster);
      setShowModal(false);
      setPlayerToRemove(null);
      setActionSuccess(`${playerToRemove.player.name} has been removed from your team.`);
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (error) {
      console.error('Error removing player:', error);
      setError('Error removing player. Please try again.');
    }
  };

  const handleMovePlayer = async (fromIndex, toIndex) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(`/teams/${team._id}/player/move/`, {
        uid1: fromIndex,
        uid2: toIndex
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRoster(response.data.roster.map(playerId => 
        roster.find(player => player && player._id === playerId) || null
      ));
      setSelectedPlayer(null);
      setActionSuccess('Players swapped successfully!');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (error) {
      console.error('Error moving player:', error);
      if (error.response && error.response.status === 400) {
        setSwapError(error.response.data.detail || 'Invalid swap. Please try a different position.');
      } else {
        setSwapError('Error moving player. Please try again.');
      }
      setTimeout(() => setSwapError(''), 3000);
    }
  };

  const renderMoveButton = (index) => {
    if (!isEditing) return null;

    const currentPlayer = roster[index];
    const hasPlayer = currentPlayer && currentPlayer.name !== "None";

    if (selectedPlayer === null) {
      if (!hasPlayer) return null; // Don't render button if no player in this position
      return (
        <button
          onClick={() => setSelectedPlayer(index)}
          className="ml-2"
        >
          <div className='h-8 w-8 flex justify-center items-center bg-blue-300 hover:bg-blue-400 rounded-full'>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 bg-blue-500 text-white rounded-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        </button>
      );
    } else if (selectedPlayer === index) {
      return (
        <button
          onClick={() => setSelectedPlayer(null)}
          className="ml-2"
        >
          <div className='h-8 w-8 flex justify-center items-center bg-gray-300 hover:bg-gray-400 rounded-full'>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 bg-gray-500 text-white rounded-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </button>
      );
    } else {
      return (
        <button
          onClick={() => handleMovePlayer(selectedPlayer, index)}
          className="ml-2"
        >
          <div className='h-8 w-8 flex justify-center items-center bg-green-300 hover:bg-green-400 rounded-full'>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 bg-green-500 text-white rounded-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </button>
      );
    }
  };

  const renderActionButtons = (player, index) => {
    return (
      <div className="flex justify-end">
        {isEditing && player && player.name !== "None" && (
          <button
            onClick={() => openRemoveModal(player, index)}
            className="mr-2"
          >
            <div className='h-8 w-8 flex justify-center items-center bg-red-300 hover:bg-red-400 rounded-full'>
              <svg xmlns="http://www.w3.org/2000/svg" className="bg-red-500 text-white rounded-full h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
          </button>
        )}
        {renderMoveButton(index)}
      </div>
    );
  };

  const toggleEditing = () => {
    setIsEditing(!isEditing);
    setPlayerToRemove(null);
    setSelectedPlayer(null);
  }

  const openRemoveModal = (player, index) => {
    setPlayerToRemove({ player, index });
    setShowModal(true);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <LeagueNavbar />

      {/* Error Message */}
      {swapError && (
        <div className="mx-auto w-1/5 fixed top-12 left-0 right-0 bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3 z-50" role="alert">
          <div className="mx-auto flex items-center justify-between">
            <div>
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{swapError}</span>
            </div>
            <button 
              onClick={() => setSwapError('')} 
              className="text-red-700 hover:text-red-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {actionSuccess && (
        <div className="mx-auto w-1/5 fixed top-12 left-0 right-0 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 z-50" role="alert">
          <div className="mx-auto flex items-center justify-between">
            <div>
              <strong className="font-bold">Success: </strong>
              <span className="block sm:inline">{actionSuccess}</span>
            </div>
            <button 
              onClick={() => setActionSuccess('')} 
              className="text-green-700 hover:text-green-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Team Information */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-3xl leading-6 font-medium text-gray-900">{team.name}</h3>
        </div>
        <div className="h-12 flex items-center border-t border-gray-200 px-4 py-5 sm:p-0">
            <h1 className="pl-6 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{team.wins} - {team.losses}</h1>
            <h1 className="pl-8 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{league.name}</h1>
            <h1 className="pl-8 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{teamOwner.name}</h1>
        </div>
      </div>

      {/* Team Roster */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Lineup</h3>
          {currentUser._id === team.owner && (
            <button 
              onClick={toggleEditing}
              className={`px-4 py-2 rounded-xl ${
                isEditing 
                  ? 'bg-green-400 text-white hover:bg-green-500' 
                  : 'bg-[#eeeeee] text-black hover:bg-[#e5e5e5]'
              }`}
            >
              {isEditing ? <div className='flex items-center justify-center gap-1'><span className="material-symbols-outlined"> check </span><h1>Finish Editing</h1></div> : <div className='flex items-center justify-center gap-1'><span className="material-symbols-outlined"> edit </span><h1>Edit Team</h1></div>}
            </button>
          )}
        </div>
        <div className="border-t border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                <th scope="col" className="w-16 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Player</th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28 border-r">Actions</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roster.map((player, index) => (
                <React.Fragment key={index}>
                  {index === 9 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                        <div className="text-sm font-medium text-gray-900">Bench</div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getPositionForIndex(index)}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex justify-center">
                        {player && player.team && (
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`}
                            alt={`${player.team} logo`}
                            className="w-10 h-10 object-contain opacity-90"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {player ? player.name : "None"}
                            {player && player.injury_status && (
                              <span className="text-red-600 ml-1">{player.injury_status}</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{player ? `${player.position} - ${player.team}` : "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium border-r">
                      {renderActionButtons(player, index)}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{player?.opponent || "-"}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{player ? Number(player.total_points || 0).toFixed(1) : "-"}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{player ? player.projected_points.toFixed(2) : "-"}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{player?.weeks?.[weekIndex] ? player.weeks[weekIndex].toFixed(1) : "-"}</div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Drop Player
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to drop {playerToRemove?.player.name} from your team? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleRemovePlayer}
                >
                  Drop
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeagueLanding() {
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
      <div className='h-36'></div>
      <div className='flex justify-center items-center gap-14 mb-12'>
        <Link to={`/league/create`} className='h-28 w-56'>
          <div className="bg-blue-500 hover:bg-blue-700 text-white text-2xl font-bold py-2 px-4 rounded-3xl focus:outline-none focus:shadow-outline h-full w-full flex justify-center items-center">
            Create League
          </div>
        </Link>
        <p className='text-4xl text-white'>---- OR ----</p>
        <Link to={`/league/join`} className='h-28 w-56'>
          <div className="bg-slate-500 hover:bg-slate-700 text-white text-2xl font-bold py-2 px-4 rounded-3xl focus:outline-none focus:shadow-outline h-full w-full flex justify-center items-center">
            Join League
          </div>
        </Link>
      </div>

      <div className='mt-12 mb-8'>
        <h1 className='text-3xl font-bold mb-6 text-center text-white'>Your Leagues</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userLeagues.map((league) => (
            <div key={league._id} className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-2">{league.name}</h2>
              <p className="text-gray-600 mb-2">Your Team: {league.userTeam ? league.userTeam.name : 'N/A'}</p>
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
                to={`/league/home?leagueid=${league._id}`}
                className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                View League
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeagueSettings() {
  const [league, setLeague] = useState(null);
  const [userTeam, setUserTeam] = useState(null);
  const [leagueDraft, setLeagueDraft] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newDraftDate, setNewDraftDate] = useState('');
  const [newDraftTime, setNewDraftTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAction, setDeleteAction] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchLeagueData = async () => {
      const token = tokenUtil.getToken();
      if (!token) {
        navigate('/user/login', { state: { from: location.pathname } });
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');

      if (!leagueId) {
        setError('League ID not provided');
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

        const leagueData = leagueResponse.data;
        const userData = userResponse.data;

        const userTeam = leagueData.teams.find(teamId => userData.teams.includes(teamId));
        if (userTeam) {
          const teamResponse = await api.get(`/teams/${userTeam}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUserTeam(teamResponse.data);
          setNewTeamName(teamResponse.data.name);
        }

        const draftResponse = await api.get(`/drafts/${leagueData.draft}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeagueDraft(draftResponse.data);

        setLeague(leagueData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setError('Error fetching league data. Please try again.');
        setLoading(false);
        if (error.response && error.response.status === 401) {
          tokenUtil.removeToken();
          navigate('/user/login');
        }
      }
    };

    fetchLeagueData();
  }, [navigate, location]);

  const handleChangeTeamName = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = tokenUtil.getToken();

    try {
      const response = await api.post(`/teams/${userTeam._id}/name/${newTeamName}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserTeam(response.data);
      setSuccess('Team name updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating team name:', error);
      setError('Failed to update team name. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleChangeDraftDateTime = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = tokenUtil.getToken();

    const newDateTime = `${newDraftDate}T${newDraftTime}:00.000Z`;

    try {
      const response = await api.post(`/drafts/${leagueDraft._id}/update-time`, 
        { new_start_time: newDateTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLeagueDraft(response.data);
      setSuccess('Draft date and time updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating draft date and time:', error);
      setError('Failed to update draft date and time. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(false);
    setError('');
    setSuccess('');
    const token = tokenUtil.getToken();

    try {
      if (deleteAction === 'team') {
        await api.post(`/leagues/${league._id}/teams/${userTeam._id}/remove`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('You have left the league successfully.');
      } else if (deleteAction === 'league') {
        await api.post(`/leagues/${league._id}/remove`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('You have deleted the league successfully.');
      }
      setTimeout(() => navigate('/user/profile'), 2000);
    } catch (error) {
      console.error('Error deleting:', error);
      setError(`Failed to ${deleteAction === 'team' ? 'leave' : 'delete'} the league. Please try again.`);
    }
  };

  const handleDraftStart = async () => {
    setError('');
    setSuccess('');
    const token = tokenUtil.getToken();

    try {
      const response = await api.post(`/drafts/start/${leagueDraft._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeagueDraft(response.data);
      setSuccess('You have started the draft successfully.');
    } catch (error) {
      console.error('Error Starting:', error);
      setError(`Failed to start the draft. ${error.response?.data?.detail || 'Please try again.'}`);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const isCommissioner = league && userTeam && league.commissioner === userTeam.owner;

  const formatDraftDateTime = (dateTimeString) => {
    const date = parseISO(dateTimeString);
    return format(date, "MMMM d, yyyy 'at' h:mm a");
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let i = 0; i < 24 * 4; i++) {
      const time = addMinutes(new Date().setHours(0, 0, 0, 0), i * 15);
      options.push(
        <option key={i} value={format(time, 'HH:mm')}>
          {format(time, 'h:mm a')}
        </option>
      );
    }
    return options;
  };

  return (
    <div className="w-2/5 mx-auto mt-8">
      <LeagueNavbar />
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 mt-8 divide-y">
        <h2 className="text-2xl font-bold mb-4">League Settings</h2>
        
        {/* Success Message */}
        {success && (
          <div className="mx-auto w-full mb-4 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3" role="alert">
            <div className="flex items-center justify-between">
              <div>
                <strong className="font-bold">Success: </strong>
                <span className="block sm:inline">{success}</span>
              </div>
              <button 
                onClick={() => setSuccess('')} 
                className="text-green-700 hover:text-green-900 focus:outline-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-auto w-full mb-4 bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3" role="alert">
            <div className="flex items-center justify-between">
              <div>
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
              <button 
                onClick={() => setError('')} 
                className="text-red-700 hover:text-red-900 focus:outline-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleChangeTeamName} className="my-4">
          <div className="mb-4">
            <h3 className="block text-xl font-bold mt-6 mb-2" htmlFor="teamName">
              Team Name
            </h3>
            <p className="mb-2">Current Team Name: {userTeam.name}</p>
            <input
              className="w-1/4 shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="teamName"
              type="text"
              placeholder="Team Name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          </div>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white w-1/4 font-bold py-2 px-4 mb-4 rounded-full focus:outline-none focus:shadow-outline"
            type="submit"
          >
            Change Name
          </button>
        </form>
        
        {isCommissioner && (
          <div className="my-4">
            <h3 className="text-xl font-bold mt-6 mb-2">Draft Settings</h3>
            <p className="mb-2">Current Draft Date: {formatDraftDateTime(leagueDraft.start_time)}</p>
            <form onSubmit={handleChangeDraftDateTime}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="draftDate">
                  New Draft Date
                </label>
                <input
                  className="shadow appearance-none border rounded w-1/4 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="draftDate"
                  type="date"
                  value={newDraftDate}
                  onChange={(e) => setNewDraftDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="draftTime">
                  New Draft Time
                </label>
                <select
                  className="shadow appearance-none border rounded w-1/4 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="draftTime"
                  value={newDraftTime}
                  onChange={(e) => setNewDraftTime(e.target.value)}
                  required
                >
                  <option value="">Select a time</option>
                  {generateTimeOptions()}
                </select>
              </div>
              <button
                className="bg-blue-500 hover:bg-blue-700 w-1/4 text-white font-bold mb-4 py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
                type="submit"
              >
                Update Draft Date
              </button>
            </form>
            <button
                className="bg-blue-500 hover:bg-blue-700 w-1/4 text-white font-bold mb-4 py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
                type="submit"
                onClick={handleDraftStart}
              >
                Start Draft
            </button>
          </div>
        )}

        <div className="flex flex-col">
          <h3 className="block text-xl font-bold mt-6 mb-2">Draft Settings</h3>
          <p>Actions cannot be undone!</p>
          {!isCommissioner && (
            <button
              onClick={() => {
                setDeleteAction('team');
                setShowDeleteModal(true);
              }}
              className="bg-red-500 hover:bg-red-700 text-white w-1/4 font-bold py-2 px-4 mt-4 rounded-full focus:outline-none focus:shadow-outline"
            >
              Leave League
            </button>
          )}
          {isCommissioner && (
            <button
              onClick={() => {
                setDeleteAction('league');
                setShowDeleteModal(true);
              }}
              className="flex justify-center items-center w-1/4 bg-red-500 hover:bg-red-700 mt-4 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
            >
              Delete League
              <span class="material-symbols-outlined ml-2"> delete_forever </span>
            </button>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Confirm {deleteAction === 'team' ? 'Leaving League' : 'League Deletion'}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to {deleteAction === 'team' ? 'leave' : 'delete'} this league? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDelete}
                >
                  {deleteAction === 'team' ? 'Leave' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function League() {
    return (
      <>
        <Routes>
          <Route path="/" element={<LeagueLanding />} />
          <Route path="create" element={<LeagueCreate />} />
          <Route path="home" element={<LeagueHome />} />
          <Route path="join" element={<LeagueJoin />} />
          <Route path="players" element={<div className="w-3/5 mx-auto mt-8 mb-8"><LeaguePlayers /></div>} />
          <Route path="team" element={<div className='w-3/5 mx-auto mt-8 mb-8'><LeagueMyTeam /></div>} />
          <Route path="scoreboard" element={<LeagueScoreboard />} />
          <Route path="standings" element={<LeagueStandings />} />
          <Route path="teams" element={<LeagueTeams />} />
          <Route path="matchup" element={<LeagueMatchup />} />
          <Route path="settings" element={<LeagueSettings />} />
          <Route path="draft" element={<DraftHome />} />
        </Routes>
        <Outlet />
      </>
    );
  }
  
  export default League;