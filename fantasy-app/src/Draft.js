import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from './api';
import FilterDropdown from './Filter';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseISO, differenceInSeconds } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const tokenUtil = {
    getToken: () => localStorage.getItem('token'),
    removeToken: () => localStorage.removeItem('token'),
  };

const getWebSocketUrl = () => {
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
  return isLocal 
    ? 'ws://localhost:8000'
    : 'wss://chaos-ff-api-62fa41b772fd.herokuapp.com';
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
        const rosterResponse = await api.get(`/teams/roster/${teamId}`, { headers: { Authorization: `Bearer ${token}` } });

        setRoster(rosterResponse.data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading Team Data...</p>
        </div>
      </div>
    );
  }
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
                <th scope="col" className="w-20 pl-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                <th scope="col" className="w-10 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th scope="col" className="pr-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Player</th>
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
                    <td className="pl-3 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getPositionForIndex(index)}</div>
                    </td>
                    <td className="whitespace-nowrap">
                    <div className="flex">
                      {player && player.team && player.team !== "FA" ? (
                        <img 
                          src={`https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`}
                          alt={`${player.team} logo`}
                          className="w-10 h-10 object-contain opacity-90"
                        />
                      ) : player && player.team === "FA" ? (
                        <img 
                          src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png`}
                          alt="NFL logo"
                          className="w-10 h-10 object-contain opacity-90"
                        />
                      ) : null}
                    </div>
                  </td>
                    <td className="pr-6 py-4 whitespace-nowrap border-r">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{player ? player.name : "None"}</div>
                          <div className="text-sm text-gray-500">{player ? `${player.position}` : "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{(player ? player.projected_points : "-")}</div>
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
  const [clickedDrafted, setClickedDrafted] = useState(false);
  // const [draft, setDraft] = useState(null);
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

  const fetchData = useCallback(async () => {
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
        api.get(`/nfl-players-paginated/${leagueIdParam}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { 
            page: currentPage, 
            limit: playersPerPage,
            position: positionFilter || undefined,
            name: nameFilter || undefined,
            available_in_league: leagueIdParam || undefined
          }
        }),
        api.get('/users/me/', { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`/leagues/${leagueIdParam}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setTotalPages(parseInt(playersResponse.data.total_pages));
      setWeekIndex(parseInt(leagueResponse.data["week"]) - 1);

      setPlayers(playersResponse.data.players);

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
  }, [currentPage, location, navigate, positionFilter, nameFilter]);

  useEffect(() => {
    if (!websocket) return;

    websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_drafted' || data.type === 'draft_started') {
        // Remove drafted player from the list
        handlePlayerDrafted(data.player_id);

        const searchParams = new URLSearchParams(location.search);
        const teamIdParam = searchParams.get('teamid');
        setIsUserTurn(data.next_drafter === teamIdParam);
      }
    };
  }, [websocket, location.search, isUserTurn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlayerDrafted = (playerId) => {
    setPlayers(prevPlayers => prevPlayers.filter(player => player._id !== playerId));
  };

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
    setClickedDrafted(true);
    if (!userTeam || !leagueId) {
      setError('Unable to draft player. Please try again.');
      setClickedDrafted(false);
      return;
    }

    if (!isUserTurn) {
      setDraftError("It's not your turn to draft.");
      setTimeout(() => setDraftError(''), 3000);
      setClickedDrafted(false);
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
      setClickedDrafted(false);
    } catch (error) {
      console.error('Error drafting player:', error);
      if (error.response && error.response.status === 400) {
        setDraftError(error.response.data.detail || 'Unable to draft player. Your team might be full or there\'s no suitable spot.');
        setTimeout(() => setDraftError(''), 3000);
        setClickedDrafted(false);
      } else {
        setDraftError('Unable to draft player. They may not be available.');
        setTimeout(() => setDraftError(''), 3000);
        setClickedDrafted(false);
      }
    } finally {
      setDraftingPlayer(null);
      setClickedDrafted(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading Players...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="sticky top-0 z-10 pb-2">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <FilterDropdown
            positions={positions}
            nameFilter={nameFilter}
            positionFilter={positionFilter}
            statusFilter={undefined}
            onNameFilterChange={handleNameSearchChange}
            onPositionFilterChange={handlePositionFilterChange}
            onStatusFilterChange={undefined}
          />
          <button 
            onClick={() => {
              document.getElementById('team-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
              });
            }}
            className="xl:hidden w-full sm:w-auto px-2 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            My Team
            <span class="material-symbols-outlined"> arrow_drop_down </span>
          </button>
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
          <div className="mx-auto w-64 fixed top-12 left-0 right-0 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 z-50" role="alert">
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
                <th scope="col" className="hidden md:table-cell pl-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th scope="col" className="w-1/4 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                <th scope="col" className="w-8 px-2 md:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Position</th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
                <th scope="col" className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                <th scope="col" className="px-6 py-3 text-left sm:text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.length === 0 && (
                <tr>
                  <td colSpan="8" className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined">filter_list</span>
                      <span>No Players Fit these Parameters</span>
                    </div>
                  </td>
                </tr>
              )}
              {players
                .map((player) => (
                  <tr key={player._id} className="even:bg-gray-50 odd:bg-white">
                    <td className="hidden md:table-cell whitespace-nowrap">
                      <div className="flex pl-3">
                        {player && player.team && player.team !== "FA" ? (
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`}
                            alt={`${player.team} logo`}
                            className="w-10 h-10 object-contain opacity-90"
                          />
                        ) : player && player.team === "FA" ? (
                          <img 
                            src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png`}
                            alt="NFL logo"
                            className="w-10 h-10 object-contain opacity-90"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{player.name}</div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap border-r flex justify-center items-center">
                      <div className={`inline-block rounded-full px-3 py-1 ${getPositionStyles(player.position).bg} ${getPositionStyles(player.position).text}`}>
                        <div className="text-sm font-medium">{player.position}</div>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{Number(player.total_points || 0).toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{player.projected_points.toFixed(2)}</div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-700">{(player.weeks[weekIndex] ? player.weeks[weekIndex].toFixed(1) : "-")}</div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-left sm:text-center">
                      {isUserTurn ? (
                        <button
                          onClick={() => handleDraftPlayer(player._id)}
                          disabled={draftingPlayer === player._id || clickedDrafted}
                          className={`px-4 py-1 border border-transparent text-sm font-medium rounded-full text-white 
                            ${(draftingPlayer === player._id || clickedDrafted)
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 cursor-not-allowed opacity-50'  // Disabled state
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'  // Enabled state
                            }`}
                        >
                          <span>
                            {draftingPlayer === player._id ? 'Drafting...' : 'Draft'}
                          </span>
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
  const [visiblePicksCount, setVisiblePicksCount] = useState(9);

  const calculateStartIndex = useCallback((currentPick, totalPicks, pickCount = visiblePicksCount) => {
    const halfVisible = Math.floor(pickCount / 2);
    
    if (currentPick >= totalPicks - pickCount) {
      return Math.max(0, totalPicks - pickCount);
    }
    
    if (currentPick < halfVisible) {
      return 0;
    }
    
    return currentPick - halfVisible;
  }, [visiblePicksCount]);

  // Add responsive handling and maintain focus on resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let newVisibleCount;
      if (width >= 1536) {
        newVisibleCount = 9;
      }
      else if (width >= 1280) {  // xl breakpoint
        newVisibleCount = 7;
      } 
      else if (width >= 1024) {  // lg breakpoint
        newVisibleCount = 5;
      } 
      else if (width >= 768) {  // md breakpoint
        newVisibleCount = 3;
      } 
      else {  // smaller screens
        newVisibleCount = 1;
      }
      
      setVisiblePicksCount(newVisibleCount);
      
      // Recalculate start index to maintain focus on current pick
      if (teams.length > 0) {
        const totalPicks = draftState.total_rounds * teams.length;
        const newStartIndex = calculateStartIndex(currentPickIndex, totalPicks, newVisibleCount);
        setStartIndex(newStartIndex);
      }
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [teams.length, currentPickIndex, draftState.total_rounds, calculateStartIndex]);

  // Initialize draft state and fetch teams/players
  useEffect(() => {
    const fetchTeamsAndPlayers = async () => {
      const token = localStorage.getItem('token');
      if (!token || !draft?.draft_order) return;

      try {
        const teamPromises = draft.draft_order.map(teamId =>
          api.get(`/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } })
        );
        const teamResponses = await Promise.all(teamPromises);
        const fetchedTeams = teamResponses.map(response => response.data);
        setTeams(fetchedTeams);

        const playerPromises = draft.pick_list.map(playerId =>
          playerId ? api.get(`/nfl-players/${playerId}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          }) : Promise.resolve({ data: null })
        );
        const playerResponses = await Promise.all(playerPromises);
        const fetchedPlayers = playerResponses.map(response => response.data);
        setDraftedPlayers(fetchedPlayers);
        
        setDraftState(draft);
        
        const pickIndex = (draft.current_round - 1) * fetchedTeams.length + (draft.current_pick - 1);
        setCurrentPickIndex(pickIndex);
        
        const totalPicks = draft.total_rounds * fetchedTeams.length;
        const newStartIndex = calculateStartIndex(pickIndex, totalPicks);
        setStartIndex(newStartIndex);
      } catch (error) {
        console.error('Error in fetchTeamsAndPlayers:', error);
      }
    };

    fetchTeamsAndPlayers();
  }, [draft, calculateStartIndex]);

  useEffect(() => {
    if (!websocket) return;

    const handleWebSocketMessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_drafted') {
        const token = localStorage.getItem('token');
        try {
          const playerResponse = await api.get(`/nfl-players/${data.player_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setDraftedPlayers(prev => [...prev, playerResponse.data]);
          
          const newPickIndex = currentPickIndex + 1;
          setCurrentPickIndex(newPickIndex);
          
          const totalPicks = draftState.total_rounds * teams.length;
          const newStartIndex = calculateStartIndex(newPickIndex, totalPicks);
          setStartIndex(newStartIndex);
          
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
      else if(data.type === 'draft_started') {
        try {
          const newPickIndex = currentPickIndex + 2;
          setCurrentPickIndex(newPickIndex);
          
          const totalPicks = draftState.total_rounds * teams.length;
          const newStartIndex = calculateStartIndex(newPickIndex, totalPicks);
          setStartIndex(newStartIndex);
          
          setDraftState(prev => ({
            ...prev,
            current_pick: 1
          }));
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      }
    };

    websocket.addEventListener('message', handleWebSocketMessage);
    return () => websocket.removeEventListener('message', handleWebSocketMessage);
  }, [websocket, teams.length, currentPickIndex, draftState.total_rounds, visiblePicksCount, calculateStartIndex]);

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
    const pickOrder = getPickOrder();
    const totalPicks = pickOrder.length;
    
    if (direction === 'left') {
      setStartIndex(prev => Math.max(0, prev - 1));
    } else {
      const maxStartIndex = Math.max(0, totalPicks - visiblePicksCount);
      setStartIndex(prev => Math.min(maxStartIndex, prev + 1));
    }
  };

  const focusOnCurrentPick = () => {
    const totalPicks = draftState.total_rounds * teams.length;
    const newStartIndex = calculateStartIndex(currentPickIndex, totalPicks);
    setStartIndex(newStartIndex);
  };

  const pickOrder = getPickOrder();

  const visiblePicks = Array(visiblePicksCount).fill(null).map((_, index) => {
    const pickIndex = startIndex + index;
    if (pickIndex >= pickOrder.length) {
      return { empty: true };
    }
    return pickOrder[pickIndex];
  });

  function formatName(fullName) {
    if (!fullName) return "-";
    const firstSpace = fullName.indexOf(' ');
    return firstSpace === -1 ? fullName : fullName[0] + '. ' + fullName.slice(firstSpace + 1);
  }

  return (
    <div className="bg-white shadow-md p-2 mb-2">
      <div className="flex justify-center items-center space-x-2">
        <button
          onClick={() => handleNavigate('left')}
          disabled={startIndex === 0}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="pb-1 flex justify-center items-center space-x-2 overflow-hidden">
          {visiblePicks.map((team, index) => {
            const absoluteIndex = startIndex + index;
            const pickNumber = absoluteIndex + 1;
            const round = Math.floor(absoluteIndex / teams.length) + 1;
            const isCurrentPick = absoluteIndex === currentPickIndex;
            const draftedPlayer = draftedPlayers[absoluteIndex];

            if (team.empty) {
              return (
                <div
                  key={`empty-${index}`}
                  className="flex-shrink-0 h-24 w-24 md:w-28 lg:w-32 p-3 shadow rounded-lg bg-gray-50 opacity-50"
                />
              );
            }

            return (
              <div
                key={`${round}-${pickNumber}`}
                className={`flex-shrink-0 h-24 w-40 md:w-32 p-3 shadow rounded-lg ${
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
                      {draftedPlayer?.position || ""}
                    </div>
                    <div className="truncate">
                      {formatName(draftedPlayer?.name)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => handleNavigate('right')}
          disabled={startIndex >= pickOrder.length - visiblePicksCount}
          className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
      
      <div className="flex justify-evenly items-center">
        <DraftTimer websocket={websocket} />
        <button 
          onClick={focusOnCurrentPick}
          className="mt-3 text-sm text-blue-500 hover:text-blue-700 underline"
        >
          Current Pick: {draftState.current_round}.{draftState.current_pick === -1 ? 1 : draftState.current_pick}
        </button>
      </div>
    </div>
  );
};

const DraftTimer = ({ websocket }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isDraftStarted, setIsDraftStarted] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [nextPickTime, setNextPickTime] = useState(null);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    if (!websocket) return;

    const handleWebSocketMessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'player_drafted' && data.next_pick_time) {
        setIsDraftStarted(true);
        // Add 'Z' to indicate UTC and parse with timezone
        const pickTime = data.next_pick_time.endsWith('Z') 
          ? parseISO(data.next_pick_time)
          : parseISO(data.next_pick_time + 'Z');
        setNextPickTime(pickTime);
        setHasSkipped(false);
      }
      else if (data.type === 'draft_started') {
        setIsDraftStarted(true);
        if (data.next_pick_time) {
          const pickTime = data.next_pick_time.endsWith('Z') 
            ? parseISO(data.next_pick_time)
            : parseISO(data.next_pick_time + 'Z');
          setNextPickTime(pickTime);
        }
        setHasSkipped(false);
      }
      else if (data.type === 'draft_waiting') {
        setIsDraftStarted(false);
        if (data.next_pick_time) {
          const pickTime = data.next_pick_time.endsWith('Z') 
            ? parseISO(data.next_pick_time)
            : parseISO(data.next_pick_time + 'Z');
          setNextPickTime(pickTime);
        }
      }
    };

    websocket.addEventListener('message', handleWebSocketMessage);
    return () => websocket.removeEventListener('message', handleWebSocketMessage);
  }, [websocket]);

  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const leagueId = searchParams.get('leagueid');
        
        const leagueResponse = await api.get(`/leagues/${leagueId}`);
        const league = leagueResponse.data;
        
        const draftResponse = await api.get(`/drafts/${league.draft}`);
        const draft = draftResponse.data;
        
        setDraftStatus(draft.status);
        if (draft.status === 'started') {
          setIsDraftStarted(true);
          const pickTime = draft.next_pick_time.endsWith('Z') 
            ? parseISO(draft.next_pick_time)
            : parseISO(draft.next_pick_time + 'Z');
          setNextPickTime(pickTime);
        } else if (draft.status === 'waiting') {
          const startTime = draft.start_time.endsWith('Z') 
            ? parseISO(draft.start_time)
            : parseISO(draft.start_time + 'Z');
          setNextPickTime(startTime);
        }
      } catch (error) {
        console.error('Error fetching draft state:', error);
      }
    };

    fetchInitialState();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      if (!nextPickTime) {
        setTimeLeft('Start Draft in League Settings');
        return;
      }

      const secondsLeft = differenceInSeconds(nextPickTime, now);
      
      if (isDraftStarted) {
        if (secondsLeft <= 0) {
          setTimeLeft('Time expired!');
          if (!hasSkipped) {
            setHasSkipped(true);
          }
        } else {
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          setTimeLeft(`Pick timer: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      } else {
        if (secondsLeft <= 0) {
          setIsDraftStarted(true);
        } else if (draftStatus === 'scheduled') {
          setTimeLeft('Start Draft in League Settings');
        } else {
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          setTimeLeft(`Draft starts in: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isDraftStarted, nextPickTime, hasSkipped, draftStatus]);

  return (
    <div className="flex items-center justify-center">
      <div className={`text-md xl:text-lg font-semibold ${
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

const DraftResults = ({ draft, teams }) => {
  const [teamPlayers, setTeamPlayers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderedTeams, setOrderedTeams] = useState([]);

  useEffect(() => {
    const fetchDraftResults = async () => {
      const token = localStorage.getItem('token');
      if (!token || !draft?.pick_list || !teams) {
        setError('Missing required data');
        setLoading(false);
        return;
      }

      try {
        const userTeam = await api.get(`/teams/${teams[teams.length - 1]._id}`)
        teams[teams.length - 1] = userTeam.data;
        // Create a map of team IDs to team objects for quick lookup
        const teamMap = teams.reduce((acc, team) => {
          acc[team._id] = team;
          return acc;
        }, {});

        // Create ordered teams array based on draft order
        const orderedTeamsList = draft.draft_order.map(teamId => teamMap[teamId]);
        setOrderedTeams(orderedTeamsList);

        // Initialize picks by team
        const picksByTeam = {};
        draft.draft_order.forEach(teamId => {
          picksByTeam[teamId] = [];
        });

        // Fetch all draft picks in a single request
        const picksResponse = await api.get(`/drafts/picks/${draft._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const players = picksResponse.data;

        // Distribute players to teams based on draft order
        players.forEach((player, index) => {
          const roundIndex = Math.floor(index / teams.length);
          const pickIndex = index % teams.length;
          const teamIndex = roundIndex % 2 === 0 ? pickIndex : teams.length - 1 - pickIndex;
          const teamId = draft.draft_order[teamIndex];

          // Create a pick object that can handle null players
          const pickData = player ? {
            ...player,
            round: Math.floor(index / teams.length) + 1,
            pick: (index % teams.length) + 1,
            pickNumber: index + 1
          } : {
            isSkipped: true,
            round: Math.floor(index / teams.length) + 1,
            pick: (index % teams.length) + 1,
            pickNumber: index + 1
          };

          picksByTeam[teamId].push(pickData);
        });

        setTeamPlayers(picksByTeam);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching draft results:', error);
        setError('Failed to load draft results');
        setLoading(false);
      }
    };

    fetchDraftResults();
  }, [draft, teams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading draft results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <span className="material-symbols-outlined text-6xl">error</span>
          <p className="mt-4">{error}</p>
        </div>
      </div>
    );
  }

  const getPositionStyle = (position) => {
    const styles = {
      QB: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      RB: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      WR: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      TE: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
      K: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
      DEF: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
    };
    return styles[position] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  };

  function formatName(fullName) {
    const firstSpace = fullName.indexOf(' ');
    return fullName[0] + '. ' + fullName.slice(firstSpace + 1);
  }

  return (
    <div className="w-max mx-auto p-4 bg-white rounded-b shadow-lg">
      {/* Header Section */}
      <div className="text-left mb-8">
        <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Draft Results
        </h2>
        <p className="text-gray-600 mt-2">
          {teams.length} Teams • {draft.total_rounds} Rounds • {draft.pick_list.length} Total Picks
        </p>
      </div>

      {/* Draft Results Grid */}
      <div className="flex space-x-1 justify-center items-center">
        {orderedTeams.map((team) => (
          <div key={team._id} className="flex flex-col shrink-0 w-48">
            {/* Team Header */}
            <div className={`mb-2`}>
              <div className="flex items-center justify-center gap-2">
                <h3 className={`font-bold truncate`}>
                  {team.name}
                </h3>
              </div>
            </div>

            {/* Player Cards */}
            <div className="space-y-1">
              {teamPlayers[team._id]?.map((player, index) => {
                const style = getPositionStyle(player.position);
                return (
                  <div 
                    key={`${team._id}-${index}`}
                    className={`${style.bg} rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    {/* Player Info */}
                    <div className="">
                      <div className="flex justify-between items-center font-medium truncate ">
                        <div className='flex gap-1 items-center'>
                          <p>{player.name ? formatName(player.name) : "Skipped Turn"}</p>
                          {player.injury_status && (
                            <span className="text-red-600 text-xs">
                              {player.injury_status}
                            </span>
                          )}
                        </div>
                        <div className='text-gray-700'>
                          {player.round}.{player.pick}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`py-0.5 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
                          {player.position ? player.position : "-"}
                        </span>
                        <>-</>
                        <div className={`${style.text} font-medium text-xs flex items-center gap-1`}>
                          {player.team ? player.team : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
  const [showDraftResults, setShowDraftResults] = useState(false);
  const [teams, setTeams] = useState([]);
  const [userTeamId, setUserTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ws, setWs] = useState(null);
  const wsRef = useRef(null);
  const location = useLocation();

  const handlePlayerDrafted = useCallback((data) => {
    setDraft(prevDraft => {
      if (!prevDraft) return prevDraft;
      
      const newDraft = { ...prevDraft };
      
      // Only add the player if not already in the pick list
      if (!newDraft.pick_list.includes(data.player_id)) {
        newDraft.pick_list.push(data.player_id);
      }
      
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
    } 
    else {
      setActiveTeam(data.team_id);
      setPlayerAdded(prev => !prev);
    }
  }, [teams.length, userTeamId]);

  useEffect(() => {
    if (!ws) return;

    const handleWebSocketMessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'draft_ended') {
        // Fetch the most up-to-date draft data when draft ends
        try {
          const token = localStorage.getItem('token');
          const draftResponse = await api.get(`/drafts/${draft._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Update draft state with the latest data
          setDraft(draftResponse.data);
          setShowDraftResults(true);
        } catch (error) {
          console.error('Error fetching final draft data:', error);
        }
      }
    };

    ws.addEventListener('message', handleWebSocketMessage);

    return () => {
      ws.removeEventListener('message', handleWebSocketMessage);
    };
  }, [ws, draft?._id]);

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

      const wsUrl = getWebSocketUrl();
      const socket = new WebSocket(`${wsUrl}/ws/${leagueId}`);
      wsRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket Connected');
        setWs(socket);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data);
        if (data.type === 'player_drafted' || data.type === 'draft_started') {
          handlePlayerDrafted(data);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket Disconnected');
        if (wsRef.current === socket) {
          wsRef.current = null;
          setWs(null);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
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
        setShowDraftResults(draftResponse.data.status === "completed");

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
  }, [location, handlePlayerDrafted, teams.length, userTeamId]);

  useEffect(() => {
    if (!ws) return;

    const handleWebSocketMessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'draft_ended') {
        setShowDraftResults(true);
      }
    };

    ws.addEventListener('message', handleWebSocketMessage);

    return () => {
      ws.removeEventListener('message', handleWebSocketMessage);
    };
  }, [ws]);

  const handlePlayerAdded = () => {
    setPlayerAdded(prev => !prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading Draft...</p>
        </div>
      </div>
    );
  }
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div id="league-draft" className="w-auto md:ml-36 md:mr-4 mx-auto pt-4 md:pt-0" style={{ height: containerHeight }}>
      {showDraftResults ? (
        <DraftResults draft={draft} teams={[...teams, { _id: userTeamId }]} />
      ) : (
        <>
          <div className="fixed top-0 left-0 right-0 z-50 md:left-36">
            {draft && league && <DraftPickTracker draft={draft} websocket={ws} />}
          </div>
          <div className="mt-36 md:mt-40">
            <div className="flex flex-col xl:flex-row h-auto xl:h-5/6 gap-4">
              <div className="w-auto xl:w-3/5 overflow-hidden">
                <div className="max-h-[calc(81vh)] overflow-y-auto">
                <DraftPlayers onPlayerAdded={handlePlayerAdded} websocket={ws} />
              </div>
            </div>
            <div id="team-section" className="w-auto xl:w-2/5 overflow-hidden flex flex-col">
              <div className="flex mb-4">
                <button
                  className={`rounded-l-xl flex-1 py-2 px-4 ${activeTab === 'myTeam' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  onClick={() => setActiveTab('myTeam')}
                >
                  My Team
                </button>
                <button
                  className={`rounded-r-xl flex-1 py-2 px-4 ${activeTab === 'leagueTeams' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  onClick={() => setActiveTab('leagueTeams')}
                >
                  Opponent Teams
                </button>
              </div>
              {activeTab === 'leagueTeams' ? (
                <div className="flex-1 max-h-[calc(75vh)] overflow-y-auto flex flex-col">
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
                <div className="flex-1 max-h-[calc(75vh)] overflow-y-auto">
                  <DraftMyTeam teamId={userTeamId} key={userTeamId} refreshTrigger={playerAdded} />
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DraftHome;