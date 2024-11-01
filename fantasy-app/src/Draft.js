import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import { useNavigate, useLocation } from 'react-router-dom';
import LeagueNavbar from './LeagueNavbar';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  function DraftMyTeam({ teamId, refreshTrigger }) {
    const [team, setTeam] = useState(null);
    const [roster, setRoster] = useState(Array(17).fill(null));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
  
    useEffect(() => {
      const fetchTeamData = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }
  
        try {
          const teamResponse = await api.get(`/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } });
          setTeam(teamResponse.data);
  
          const playerPromises = teamResponse.data.roster.map(playerId =>
            playerId ? api.get(`/nfl-players/${playerId}`, { headers: { Authorization: `Bearer ${token}` } }) : null
          );
          const playerResponses = await Promise.all(playerPromises);
          const rosterData = playerResponses.map(response => response ? response.data : null);
  
          setRoster(rosterData);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching team data:', error);
          setError('Error fetching team data. Please try again.');
          setLoading(false);
        }
      };
  
      if (teamId) {
        fetchTeamData();
      }
    }, [teamId, refreshTrigger]);
  
    if (loading) return <div>Loading team data...</div>;
    if (error) return <div className="text-red-600">{error}</div>;
    if (!team) return <div>No team data available</div>;
  
    const getPositionForIndex = (index) => {
      for (const [position, indices] of Object.entries(POSITION_MAPPING)) {
        if (indices.includes(index)) {
          return position;
        }
      }
      return 'Unknown';
    };

    return (
      <div>
        {/* Team Roster */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Lineup</h3>
          </div>
          <div className="border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Player</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roster.map((player, index) => (
                  <React.Fragment key={index}>
                    {index === 9 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                          <div className="text-sm font-medium text-gray-900">Bench</div>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getPositionForIndex(index)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full" src={`https://via.placeholder.com/150?text=${player ? player.name.charAt(0) : 'N'}`} alt={player ? player.name : "None"} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{player ? player.name : "None"}</div>
                            <div className="text-sm text-gray-500">{player ? `${player.position} - ${player.team}` : "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{(player.projected_points ? player.projected_points : "-")}</div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
}

function DraftPlayers({ onPlayerAdded, websocket }) {
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
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [draft, setDraft] = useState(null);
  const playersPerPage = 50;
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
    if (!websocket) return;

    websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
      if (data.type === 'player_drafted') {
        // Remove drafted player from the list
        handlePlayerDrafted(data.player_id);

        const searchParams = new URLSearchParams(location.search);
        const teamIdParam = searchParams.get('teamid');
        setIsUserTurn(data.next_drafter === teamIdParam);
      }
    };
  }, [websocket, isUserTurn]);

    const handlePlayerDrafted = (playerId) => {
      setPlayers(prevPlayers => prevPlayers.filter(player => player._id !== playerId));
    };

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
  
        const playersWithAvailability = await Promise.all(playersData.map(async (player) => {
          const availabilityResponse = await api.get(`/leagues/${leagueIdParam}/players/${player._id}/available`, {
            headers: { Authorization: `Bearer ${token}` }
          });
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
  
        // Fetch draft information
        const draftResponse = await api.get(`/drafts/${leagueResponse.data.draft}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDraft(draftResponse.data);
  
        // Calculate if it's user's turn
        const currentPickIndex = draftResponse.data.current_round % 2 === 1
          ? draftResponse.data.current_pick - 1
          : leagueResponse.data.teams.length - draftResponse.data.current_pick;
        
        const currentPickTeamId = draftResponse.data.draft_order[currentPickIndex];
        setIsUserTurn(currentPickTeamId === userTeamId);
  
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

  useEffect(() => {
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

    if (!isUserTurn) {
      setDraftError("It's not your turn to draft.");
      setTimeout(() => setDraftError(''), 3000);
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

      setActionSuccess(`Player has been added.`);
      setTimeout(() => setActionSuccess(''), 3000);
      onPlayerAdded();
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
    <div className="flex flex-col h-full relative">
      <div className="sticky top-0 z-10 py-1 relative">
        <div className="flex justify-center items-center gap-2 mb-2">
          <input 
            type='text'
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
      </div>
      
      <div className="flex-grow overflow-auto">
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
                <th scope="col" className="w-1/4 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Position</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players
                .filter(player => player.isAvailable)
                .map((player) => (
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
                    <td className="px-2 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{player.name}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap border-r">
                      <div className={`inline-block rounded-full px-3 py-1 ${getPositionStyles(player.position).bg} ${getPositionStyles(player.position).text}`}>
                        <div className="text-sm font-medium">{player.position}</div>
                      </div>
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
                    <td className="px-6 py-2 whitespace-nowrap text-center">
                      {isUserTurn ? (
                        <button
                          onClick={() => handleDraftPlayer(player._id)}
                          disabled={draftingPlayer === player._id}
                          className="px-4 py-1 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {draftingPlayer === player._id ? 'Drafting...' : 'Draft Player'}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">Not your turn</span>
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

const DraftPickTracker = ({ draft, websocket }) => {
  const [teams, setTeams] = useState([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [draftedPlayers, setDraftedPlayers] = useState([]);
  const [draftState, setDraftState] = useState(draft);

  // Initialize draft state and fetch teams/players
  useEffect(() => {
    const fetchTeamsAndPlayers = async () => {
      const token = localStorage.getItem('token');
      if (!token || !draft?.draft_order) return;

      try {
        // Fetch teams in parallel
        const teamPromises = draft.draft_order.map(teamId =>
          api.get(`/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } })
        );
        const teamResponses = await Promise.all(teamPromises);
        const fetchedTeams = teamResponses.map(response => response.data);
        setTeams(fetchedTeams);

        // Fetch drafted players in parallel
        const playerPromises = draft.pick_list.map(playerId =>
          playerId ? api.get(`/nfl-players/${playerId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          }) : Promise.resolve({ data: null })
        );
        const playerResponses = await Promise.all(playerPromises);
        const fetchedPlayers = playerResponses.map(response => response.data);
        setDraftedPlayers(fetchedPlayers);
        
        // Set initial draft state
        setDraftState(draft);
        
        // Calculate and set initial currentPickIndex
        const pickIndex = (draft.current_round - 1) * fetchedTeams.length + (draft.current_pick - 1);
        setCurrentPickIndex(pickIndex);
        setStartIndex(Math.max(0, pickIndex - 4));
      } catch (error) {
        console.error('Error in fetchTeamsAndPlayers:', error);
      }
    };

    fetchTeamsAndPlayers();
  }, [draft]);

  // WebSocket handler
  useEffect(() => {
    if (!websocket) return;

    const handleWebSocketMessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_drafted') {
        const token = localStorage.getItem('token');
        try {
          // Fetch the newly drafted player
          const playerResponse = await api.get(`/nfl-players/${data.player_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Update states
          setDraftedPlayers(prev => [...prev, playerResponse.data]);
          setCurrentPickIndex(prev => prev + 1);
          setStartIndex(prev => prev + 1);
          
          // Update draft state
          setDraftState(prev => {
            const newDraft = { ...prev };
            newDraft.current_pick = (newDraft.current_pick % teams.length) + 1;
            if (newDraft.current_pick === 1) {
              newDraft.current_round += 1;
            }
            return newDraft;
          });
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      }
    };

    websocket.addEventListener('message', handleWebSocketMessage);

    return () => {
      websocket.removeEventListener('message', handleWebSocketMessage);
    };
  }, [websocket, teams.length]);

  const getPickOrder = () => {
    if (!teams.length) return [];
    const totalPicks = draftState.total_rounds * teams.length;
    let picks = [];

    for (let round = 1; round <= draftState.total_rounds; round++) {
      const roundPicks = round % 2 === 0 ? [...teams].reverse() : [...teams];
      picks = [...picks, ...roundPicks];
    }

    return picks.slice(0, totalPicks);
  };

  const handleNavigate = (direction) => {
    const visiblePicks = 9;
    const maxStartIndex = Math.max(0, getPickOrder().length - visiblePicks);
    setStartIndex(prev => 
      direction === 'left' 
        ? Math.max(0, prev - 1)
        : Math.min(maxStartIndex, prev + 1)
    );
  };

  const focusOnCurrentPick = () => {
    setStartIndex(Math.max(0, currentPickIndex - 4));
  };

  const pickOrder = getPickOrder();
  const visiblePicks = 9;

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4">
      <div className="flex justify-center items-center space-x-2">
        <button
          onClick={() => handleNavigate('left')}
          disabled={startIndex === 0}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="flex space-x-2 overflow-hidden">
          {pickOrder.slice(startIndex, startIndex + visiblePicks).map((team, index) => {
            const absoluteIndex = startIndex + index;
            const pickNumber = absoluteIndex + 1;
            const round = Math.floor(absoluteIndex / teams.length) + 1;
            const isCurrentPick = absoluteIndex === currentPickIndex;
            const draftedPlayer = draftedPlayers[absoluteIndex];

            return (
              <div
                key={`${round}-${pickNumber}`}
                className={`flex-shrink-0 w-32 p-3 rounded-lg ${
                  isCurrentPick
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : absoluteIndex < currentPickIndex
                    ? 'bg-gray-100'
                    : 'bg-gray-50'
                }`}
              >
                <div className="text-xs font-semibold">
                  PICK {pickNumber}
                </div>
                <div className="text-sm font-medium truncate">
                  {team.name}
                </div>
                {draftedPlayer && (
                  <div className="mt-1 text-xs">
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                      {draftedPlayer.position}
                    </div>
                    <div className="truncate">
                      {draftedPlayer.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => handleNavigate('right')}
          disabled={startIndex >= pickOrder.length - visiblePicks}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      
      <div className='flex justify-evenly items-center '>
        <button 
          onClick={focusOnCurrentPick}
          className="mt-3 text-sm text-blue-500 hover:text-blue-700 underline"
        >
          Go to current pick: Round {draftState.current_round}, Pick {draftState.current_pick}
        </button>
        <DraftTimer websocket={ websocket } />
      </div>
    </div>
  );
};

const DraftTimer = ({ websocket }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isDraftStarted, setIsDraftStarted] = useState(false);
  const [nextPickTime, setNextPickTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    // WebSocket handler for pick updates
    if (!websocket) return;

    const handleWebSocketMessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_drafted' && data.next_pick_time) {
        setNextPickTime(parseISO(data.next_pick_time));
        setHasSkipped(false); // Reset skip flag when new pick starts
      }
    };

    websocket.addEventListener('message', handleWebSocketMessage);

    return () => {
      websocket.removeEventListener('message', handleWebSocketMessage);
    };
  }, [websocket]);

  useEffect(() => {
    // Timer logic
    const timer = setInterval(async () => {
      const now = new Date();
      
      if (!isDraftStarted && startTime) {
        const secondsToStart = differenceInSeconds(parseISO(startTime), now);
        
        if (secondsToStart <= 0) {
          setIsDraftStarted(true);
        } else {
          const hours = Math.floor(secondsToStart / 3600);
          const minutes = Math.floor((secondsToStart % 3600) / 60);
          const seconds = secondsToStart % 60;
          setTimeLeft(`Draft starts in: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      } else if (isDraftStarted && nextPickTime) {
        const secondsLeft = differenceInSeconds(nextPickTime, now);
        
        if (secondsLeft <= 0) {
          setTimeLeft('Time expired!');
          
          // Handle auto-skip after 1 second delay if we haven't already skipped
          if (!hasSkipped) {
            setHasSkipped(true); // Set flag to prevent multiple skips
            setTimeout(async () => {}, 1000);
          }
        } else {
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          setTimeLeft(`Pick timer: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isDraftStarted, startTime, nextPickTime, hasSkipped]);

  const fetchInitialTimes = async () => {
    try {
      const token = localStorage.getItem('token');
      const searchParams = new URLSearchParams(window.location.search);
      const leagueId = searchParams.get('leagueid');
      
      const response = await fetch(`http://localhost:8000/leagues/${leagueId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const league = await response.json();
      
      const draftResponse = await fetch(`http://localhost:8000/drafts/${league.draft}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const draft = await draftResponse.json();
      
      setStartTime(draft.start_time);
      setNextPickTime(parseISO(draft.next_pick_time));
      setIsDraftStarted(new Date() >= parseISO(draft.start_time));
    } catch (error) {
      console.error('Error fetching draft times:', error);
    }
  };

  useEffect(() => {
    fetchInitialTimes();
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div className={`text-lg font-semibold ${
        !isDraftStarted 
          ? 'text-blue-600' 
          : timeLeft === 'Time expired!' 
            ? 'text-red-600' 
            : 'text-green-600'
      }`}>
        {timeLeft}
      </div>
    </div>
  );
};

function DraftHome() {
  const [containerHeight, setContainerHeight] = useState('100vh');
  const [activeTeam, setActiveTeam] = useState('');
  const [activeTab, setActiveTab] = useState('myTeam');
  const [league, setLeague] = useState(null);
  const [draft, setDraft] = useState(null);
  const [playerAdded, setPlayerAdded] = useState(false);
  const [teams, setTeams] = useState([]);
  const [userTeamId, setUserTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ws, setWs] = useState(null);
  const wsRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const updateHeight = () => {
      const viewportHeight = window.innerHeight;
      const topOffset = document.getElementById('league-draft')?.offsetTop || 0;
      const availableHeight = viewportHeight - topOffset - 32;
      setContainerHeight(`${availableHeight}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    const setupWebSocket = (leagueId) => {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const socket = new WebSocket(`ws://localhost:8000/ws/${leagueId}`);
      wsRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket Connected');
        setWs(socket);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'player_drafted') {
          handlePlayerDrafted(data);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket Disconnected');
        // Only clear the ref if this is the current socket
        if (wsRef.current === socket) {
          wsRef.current = null;
          setWs(null);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        // Cleanup on error
        if (wsRef.current === socket) {
          wsRef.current = null;
          setWs(null);
        }
      };
    };

    // Main data fetching effect
    const fetchLeagueData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const leagueId = searchParams.get('leagueid');
      const userTeam = searchParams.get('teamid');

      if (!leagueId || !userTeam) {
        setError('League ID or Team ID not provided');
        setLoading(false);
        return;
      }

      setUserTeamId(userTeam);

      try {
        const leagueResponse = await api.get(`/leagues/${leagueId}`, { headers: { Authorization: `Bearer ${token}` } });
        setLeague(leagueResponse.data);

        const teamPromises = leagueResponse.data.teams.map(teamId =>
          api.get(`/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } })
        );
        const teamResponses = await Promise.all(teamPromises);
        const teamsData = teamResponses.map(response => response.data);
        
        const draftResponse = await api.get(`/drafts/${leagueResponse.data.draft}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDraft(draftResponse.data);

        const leagueTeams = teamsData.filter(team => team._id !== userTeam);
        setTeams(leagueTeams);
        setActiveTeam(leagueTeams[0]?._id || '');
        setLoading(false);

        // Setup WebSocket after successful data fetch
        setupWebSocket(leagueId);
      } catch (error) {
        console.error('Error fetching league data:', error);
        setError('Error fetching league data. Please try again.');
        setLoading(false);
      }
    };

    fetchLeagueData();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        console.log('Cleaning up WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
      }
    };
  }, [location]);

  const handlePlayerDrafted = (data) => {
    setDraft(prevDraft => {
      const newDraft = { ...prevDraft };
      newDraft.pick_list.push(data.player_id);
      
      newDraft.current_pick++;
      if (newDraft.current_pick > teams.length) {
        newDraft.current_pick = 1;
        newDraft.current_round++;
      }
      
      return newDraft;
    });

    setPlayerAdded(prev => !prev);

    if (data.team_id === userTeamId) {
      setPlayerAdded(prev => !prev);
    } else {
      setActiveTeam(data.team_id);
      setPlayerAdded(prev => !prev);
    }
  };

  const handlePlayerAdded = () => {
    setPlayerAdded(prev => !prev);
  };

  if (loading) return <div>Loading league data...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div id="league-draft" className="w-3/4 mx-auto my-4" style={{ height: containerHeight }}>
      <LeagueNavbar />
      {draft && league && <DraftPickTracker draft={draft} websocket={ws} />}
      <div className="flex h-5/6 gap-4">
        <div className="w-3/5 overflow-hidden">
          <div className="h-full overflow-auto">
            <DraftPlayers onPlayerAdded={handlePlayerAdded} websocket={ws} />
          </div>
        </div>
        <div className="w-2/5 overflow-hidden flex flex-col">
          <div className="flex mb-4">
            <button
              className={`flex-1 py-2 px-4 ${activeTab === 'myTeam' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setActiveTab('myTeam')}
            >
              My Team
            </button>
            <button
              className={`flex-1 py-2 px-4 ${activeTab === 'leagueTeams' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setActiveTab('leagueTeams')}
            >
              Opponent Teams
            </button>
          </div>
          {activeTab === 'leagueTeams' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="mb-2">
                <select
                  value={activeTeam}
                  onChange={(e) => setActiveTeam(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {teams.map(team => (
                    <option key={team._id} value={team._id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 overflow-auto">
                <DraftMyTeam teamId={activeTeam} key={activeTeam} refreshTrigger={playerAdded} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <DraftMyTeam teamId={userTeamId} key={userTeamId} refreshTrigger={playerAdded} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DraftHome;