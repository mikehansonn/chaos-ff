import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import { Route, Routes, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import DraftHome from './Draft';
import FilterDropdown from './Filter';


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

const VALID_ROSTER_SLOTS = {
  "QB": [0],
  "RB": [1, 2, 6],
  "WR": [3, 4, 6],
  "TE": [5, 6],
  "FLEX": [6],
  "DEF": [7],
  "K": [8],
  "BENCH": Array.from({length: 8}, (_, i) => i + 9)
};


const LeagueCreate = () => {
  const [leagueData, setLeagueData] = useState({
    name: '',
    commissioner: '',
    number_of_players: ''
  });
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    name: false,
    nameLength: false,
    number_of_players: false
  });
  const inputRef = useRef(null);
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
          commissioner: response.data._id
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
    // Clear validation errors when user starts typing
    if (validationErrors[name] || validationErrors.nameLength) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: false,
        nameLength: false
      }));
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
    // Validation
    const newValidationErrors = {
      name: !leagueData.name.trim(),
      nameLength: leagueData.name.trim().length > 48,
      number_of_players: !leagueData.number_of_players
    };
    
    setValidationErrors(newValidationErrors);
    
    // If there are validation errors, return early
    if (Object.values(newValidationErrors).some(error => error)) {
      return;
    }
    
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
      if(err.status === 403) {
        setError('Error: You can only join 10 leagues.');
        console.error('Error: You can only join 10 leagues.', err);
      }
      else {
        setError('Error creating league. Please try again.');
        console.error('Error creating league:', err);
      }
    }
  };

  const handleDivClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handlePlayerSelect = (number) => {
    setLeagueData(prevState => ({
      ...prevState,
      number_of_players: number
    }));
    // Clear validation error when user selects a number
    if (validationErrors.number_of_players) {
      setValidationErrors(prev => ({
        ...prev,
        number_of_players: false
      }));
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-52"></div>
      <form onSubmit={handleFormSubmit} className="bg-white shadow-md rounded-xl px-4 sm:px-8 pt-6 pb-8 mb-4">
        <h1 className="h-12 text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Create a League
        </h1>
        <h2 className="text-gray-600 text-base sm:text-lg font-medium mb-6 sm:mb-8 text-center">
          Use the Invite ID on the League's home page to invite friends!
        </h2>
        
        <div className="mb-4">
          <div 
            className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 cursor-text ${
              (validationErrors.name || validationErrors.nameLength)
                ? 'border-red-500' 
                : 'border-gray-300 focus-within:border-blue-500'
            }`}
            onClick={handleDivClick}
          >
            <span className="material-symbols-outlined text-gray-500 mr-2">trophy</span>
            <div className="w-full">
              <label 
                htmlFor="name" 
                className="block text-sm font-semibold text-gray-500 w-24"
                onClick={(e) => e.stopPropagation()}
              >
                League Name
              </label>
              <input 
                ref={inputRef}
                type="text"
                id="name"
                name="name"
                onChange={handleInputChange}
                value={leagueData.name}
                placeholder="Enter League Name"
                className="bg-transparent focus:outline-none w-full text-gray-700 py-1 text-sm sm:text-base"
                maxLength={48}
              />
            </div>
            {(validationErrors.name || validationErrors.nameLength) && (
              <span className="material-symbols-outlined !text-red-600">error</span>
            )}
          </div>
          {validationErrors.nameLength && (
            <div className='flex mt-1 text-sm sm:text-base'>
              <span className="material-symbols-outlined !text-red-600">error</span>
              <p className="ml-1 text-red-600">League name must be less than 48 characters</p>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-500 mb-2">Number of Teams</label>
          <div className="grid grid-cols-5 gap-2">
            {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(number => (
              <button
                key={number}
                type="button"
                onClick={() => handlePlayerSelect(number)}
                className={`py-2 px-2 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                  leagueData.number_of_players === number
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
                }`}
              >
                {number}
              </button>
            ))}
          </div>
          {validationErrors.number_of_players && (
            <div className='flex mt-4 text-sm sm:text-base'>
              <span className="material-symbols-outlined !text-red-600">error</span>
              <p className="ml-1 text-red-600">Select a Team Count</p>
            </div>
          )}
        </div>

        <div className="flex justify-center sm:justify-start mt-4">
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold p-3 rounded-lg shadow-lg text-sm sm:text-md flex justify-center items-center transition-all"
          >
            Create League
          </button>
        </div>
        
        {error && 
          <div className='flex mt-4 text-sm sm:text-base'>
            <span className="material-symbols-outlined !text-red-600">error</span>
            <p className="ml-1 text-red-600">{error}</p>
          </div>
        }
        {success && <p className="text-green-600 mt-4 text-sm sm:text-base">League created successfully!</p>}
      </form>
    </div>
  );
};

function LeagueHome() {
  const [league, setLeague] = useState(null);
  const [commissioner, setCommissioner] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedStates, setCopiedStates] = useState({});
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

        const draftResponse = await api.get(`/drafts/${leagueData.draft}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      
        const draftStatus = draftResponse.data.status;

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

        setLeague({ ...leagueData, teams: teamsWithData, draftStatus: draftStatus });
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

  const copyToClipboard = (text, leagueId) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Set copied state for this specific league
        setCopiedStates(prev => ({ ...prev, [leagueId]: true }));
        
        // Reset after 1 second
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [leagueId]: false }));
        }, 1000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="flex justify-center items-center mt-8 md:mt-4 px-4 sm:px-6 md:pl-36 lg:px-8">
      <div className="relative my-12 h-fit w-full max-w-3xl bg-gray-50 rounded-2xl">
        <div className="h-40 sm:h-52 w-full bg-gradient-to-r from-green-200 to-emerald-300 rounded-t-2xl shadow-md" />
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 sm:h-40 sm:w-40 bg-white rounded-full flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined !text-[60px] sm:!text-[80px]">trophy</span>
        </div>
        <div className="px-4 sm:px-6 lg:px-8 pb-6 pt-16 sm:pt-24 h-fit w-full rounded-b-2xl shadow-lg text-center">
          <h1 className="text-lg sm:text-xl font-bold mb-4">{league.name}</h1>
          
          {/* League Info */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Players: </h1>
              <h1 className="text-base sm:text-lg">{league.teams.length}/{league.number_of_players}</h1>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Invite ID: </h1>
              <div className="relative">
                <span 
                  className="text-xs sm:text-sm bg-gray-200 px-2 py-1 rounded cursor-pointer flex items-center gap-1 hover:bg-gray-300 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    copyToClipboard(league._id, league._id);
                  }}
                >
                  {window.innerWidth < 640 ? `${league._id.slice(0, 7)}...` : league._id.slice(0, 25)}
                  <span className="material-symbols-outlined text-base !text-[15px]">
                    {copiedStates[league._id] ? 'check' : 'content_copy'}
                  </span>
                </span>
                {copiedStates[league._id] && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap">
                    Copied!
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Draft Status: </h1>
              <div className={`inline-block rounded-full px-2 sm:px-3 py-1 ${
                league.draftStatus === "completed" 
                  ? "bg-green-100 text-green-800"
                  : league.draftStatus === "started" || league.draftStatus === "waiting"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}>
                <div className="text-xs sm:text-sm font-medium">
                  {league.draftStatus === "completed" 
                    ? "Drafted" 
                    : league.draftStatus === "started" || league.draftStatus === "waiting"
                    ? "Drafting!"
                    : "Pending"}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Commissioner: </h1>
              <h1 className="text-base sm:text-lg">{commissioner.username}</h1>
            </div>
          </div>

          {/* Teams Section */}
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-lg sm:text-xl font-bold mt-4">Teams</h1>
            {league.teams.map(cteam => (
              <Link 
                to={`/league/team?leagueid=${league._id}&teamid=${cteam._id}`} 
                key={cteam._id} 
                className="h-auto flex items-center justify-between bg-white hover:bg-gray-50 p-3 m-2 w-full sm:w-4/5 shadow rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <h1 className="text-left text-base sm:text-lg truncate max-w">{cteam.name}</h1>
                  <h1 className="text-left text-gray-500 text-xs sm:text-sm truncate max-w">{cteam.ownerData.username}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base">{cteam.wins} - {cteam.losses}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const LeagueJoin = () => {
  const [joinData, setJoinData] = useState({
    league_id: '',
    team_name: ''
  });
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    league_id: false,
    team_name: false,
    teamNameLength: false
  });
  const inputRef = useRef(null);
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
    setJoinData(prevState => ({
      ...prevState,
      [name]: value
    }));
    // Clear validation errors when user starts typing
    if (validationErrors[name] || validationErrors.teamNameLength) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: false,
        teamNameLength: false
      }));
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
    // Validation
    const newValidationErrors = {
      league_id: !joinData.league_id.trim(),
      team_name: !joinData.team_name.trim(),
      teamNameLength: joinData.team_name.trim().length > 48
    };
    
    setValidationErrors(newValidationErrors);
    
    // If there are validation errors, return early
    if (Object.values(newValidationErrors).some(error => error)) {
      return;
    }
    
    try {
      const joinPayload = {
        user_id: userData._id,
        league_id: joinData.league_id,
        team_name: joinData.team_name
      };

      const response = await api.post('/leagues/join/', joinPayload);
      setSuccess(true);
      setJoinData({
        league_id: '',
        team_name: ''
      });
      
      navigate(`/league/home?leagueid=${response.data._id}`);
    } catch (err) {
      if(err.status === 403) {
        setError(err.response.data.detail);
        console.error('Error: You can only join 10 leagues.', err);
      }
      else {
        setError('Error joining league. Please try again.');
        console.error('Error joining league:', err);
      }
    }
  };

  const handleDivClick = (inputId) => {
    if (inputRef.current && inputRef.current.id === inputId) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-52"></div>
      <form onSubmit={handleFormSubmit} className="bg-white shadow-md rounded-xl px-4 sm:px-8 pt-6 pb-8 mb-4">
        <h1 className="h-12 text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Join a League
        </h1>
        <h2 className="text-gray-600 text-base sm:text-lg font-medium mb-6 sm:mb-8 text-center">
          Use the Invite ID from the League's home page to join!
        </h2>
        
        <div className="mb-4">
          <div 
            className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 cursor-text ${
              validationErrors.league_id 
                ? 'border-red-500' 
                : 'border-gray-300 focus-within:border-blue-500'
            }`}
            onClick={() => handleDivClick('league_id')}
          >
            <span className="material-symbols-outlined text-gray-500 mr-2">key</span>
            <div className="w-full">
              <label 
                htmlFor="league_id" 
                className="block text-sm font-semibold text-gray-500 w-24"
                onClick={(e) => e.stopPropagation()}
              >
                Invite ID
              </label>
              <input 
                ref={inputRef}
                type="text"
                id="league_id"
                name="league_id"
                onChange={handleInputChange}
                value={joinData.league_id}
                placeholder="Enter League Invite ID"
                className="bg-transparent focus:outline-none w-full text-gray-700 py-1 text-sm sm:text-base"
                maxLength={48}
              />
            </div>
            {validationErrors.league_id && (
              <span className="material-symbols-outlined !text-red-600">error</span>
            )}
          </div>
        </div>
        
        <div className="mb-4">
          <div 
            className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 cursor-text ${
              (validationErrors.team_name || validationErrors.teamNameLength)
                ? 'border-red-500' 
                : 'border-gray-300 focus-within:border-blue-500'
            }`}
            onClick={() => handleDivClick('team_name')}
          >
            <span className="material-symbols-outlined text-gray-500 mr-2">groups</span>
            <div className="w-full">
              <label 
                htmlFor="team_name" 
                className="block text-sm font-semibold text-gray-500 w-24"
                onClick={(e) => e.stopPropagation()}
              >
                Team Name
              </label>
              <input 
                type="text"
                id="team_name"
                name="team_name"
                onChange={handleInputChange}
                value={joinData.team_name}
                placeholder="Enter Your Team Name"
                className="bg-transparent focus:outline-none w-full text-gray-700 py-1 text-sm sm:text-base"
                maxLength={48}
              />
            </div>
            {(validationErrors.team_name || validationErrors.teamNameLength) && (
              <span className="material-symbols-outlined !text-red-600">error</span>
            )}
          </div>
          {validationErrors.teamNameLength && (
            <div className='flex mt-1 text-sm sm:text-base'>
              <span className="material-symbols-outlined !text-red-600">error</span>
              <p className="ml-1 text-red-600">Team name must be less than 48 characters</p>
            </div>
          )}
        </div>

        <div className="flex justify-center sm:justify-start mt-4">
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold p-3 rounded-lg shadow-lg text-sm sm:text-md flex justify-center items-center transition-all"
          >
            Join League
          </button>
        </div>
        
        {error && 
          <div className='flex mt-4 text-sm sm:text-base'>
            <span className="material-symbols-outlined !text-red-600">error</span>
            <p className="ml-1 text-red-600">{error}</p>
          </div>
        }
        {success && <p className="text-green-600 mt-4 text-sm sm:text-base">Successfully joined league!</p>}
      </form>
    </div>
  );
};

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
  const [statusFilter, setStatusFilter] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
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
          api.get(`/nfl-players-paginated/${leagueIdParam}`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
              page: currentPage, 
              limit: playersPerPage,
              position: positionFilter || undefined,
              name: nameFilter || undefined,
              available_in_league: statusFilter ? leagueIdParam : undefined || undefined
            }
          }, { headers: { Authorization: `Bearer ${token}` } }),
          api.get('/users/me/', { headers: { Authorization: `Bearer ${token}` } }),
          api.get(`/leagues/${leagueIdParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const draftResponse = await api.get(`/drafts/${leagueResponse.data.draft}`, { headers: { Authorization: `Bearer ${token}` } });
        setDraftStatus(draftResponse.data.status);

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
  }, [currentPage, location, navigate, positionFilter, nameFilter, statusFilter]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePositionFilterChange = (value) => {
    setPositionFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(!statusFilter);
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
      await api.post(`/leagues/${leagueId}/teams/${userTeam._id}/waiver`, 
        { player_id: playerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPlayers(players.map(player => 
        player._id === playerId ? { ...player, taken: true } : player
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
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading Waivers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className='w-full max-w-screen-2xl mx-auto md:pl-36 mt-16 md:mt-4 mb-4 pb-2'>
      <FilterDropdown
        positions={positions}
        nameFilter={nameFilter}
        positionFilter={positionFilter}
        statusFilter={statusFilter}
        onNameFilterChange={handleNameSearchChange}
        onPositionFilterChange={handlePositionFilterChange}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {draftError && (
        <div className="mx-auto w-96 fixed top-12 left-0 right-0 bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3 z-50" role="alert">
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
        <div className="mx-auto w-96 fixed top-12 left-0 right-0 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 z-50" role="alert">
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

      <div className="relative bg-white shadow sm:rounded-lg sticky top-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="pl-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              <th scope="col" className="px-2 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
              <th scope="col" className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Position</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
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
            {players.map((player) => (
              <tr key={player._id} className="even:bg-gray-50 odd:bg-white">
                <td className="whitespace-nowrap">
                  <div className="flex pl-2">
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
                <td className="px-2 py-2 whitespace-nowrap">
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
                <td className="w-24 px-3 py-3 whitespace-nowrap border-r">
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
                  {draftStatus !== "completed" ? (
                    <span className="text-sm text-gray-600">Wait for Draft</span> 
                  ) : !player.taken ? (
                    <button
                      onClick={() => handleDraftPlayer(player._id)}
                      disabled={draftingPlayer === player._id}
                      className="px-4 py-1 border border-transparent text-sm font-medium rounded-full text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

const WeekSelector = ({ selectedWeek, totalWeeks, currentWeek, onChange }) => {
  const handlePrevWeek = () => {
    if (selectedWeek > 1) {
      onChange(selectedWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedWeek < totalWeeks) {
      onChange(selectedWeek + 1);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handlePrevWeek}
        disabled={selectedWeek <= 1}
        className={`flex justify-center items-center p-1 rounded-full hover:bg-gray-100 transition-colors ${
          selectedWeek <= 1 ? 'text-gray-300' : 'text-gray-600'
        }`}
        aria-label="Previous week"
      >
        <span class="material-symbols-outlined"> chevron_left </span>
      </button>
      
      <div className="relative">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-900">
              Week {selectedWeek}
            </span>
            {selectedWeek === currentWeek && (
              <span className="text-xs text-blue-600 font-medium">
                Current Week
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleNextWeek}
        disabled={selectedWeek >= totalWeeks}
        className={`flex justify-center items-center p-1 rounded-full hover:bg-gray-100 transition-colors ${
          selectedWeek >= totalWeeks ? 'text-gray-300' : 'text-gray-600'
        }`}
        aria-label="Next week"
      >
        <span class="material-symbols-outlined"> chevron_right </span>
      </button>
    </div>
  );
};

function LeagueScoreboard() {
  const [league, setLeague] = useState(null);
  const [matchups, setMatchups] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();

  // Data fetching effects remain the same...
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
        var index = 19 - leagueResponse.data.schedule.length;
        var weekIndex = leagueResponse.data.week - index;
        if(weekIndex < 0) weekIndex = 0;
        setSelectedWeek(weekIndex + 1);
      } catch (error) {
        setLoading(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/user/login', { state: { from: location.pathname } });
        } else {
          setError('An error occurred while fetching data');
        }
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
        setLoading(false);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/user/login', { state: { from: location.pathname } });
        } else {
          setError('An error occurred while fetching data');
        }
      }
    };

    fetchWeekData();
  }, [league, selectedWeek, navigate, location]);

  const getTeamStyle = (matchup, teamId) => {
    if (matchup.status !== 'completed' || !matchup.winner || matchup.winner === 'BYE') {
      return 'text-gray-700';
    }
    return matchup.winner === teamId ? 'text-gray-700 font-bold' : 'text-gray-400';
  };

  const getScoreStyle = (matchup) => {
    if (matchup.status !== 'completed' || !matchup.winner || matchup.winner === 'BYE') {
      return 'text-gray-500';
    }
    return 'font-bold text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
          <p className="mt-4 text-gray-600">Loading Scoreboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-center px-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="mt-12 md:mt-4 w-full max-w-6xl mx-auto lg:pl-36 md:pl-36 px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="bg-white shadow-lg rounded-lg p-3 sm:p-4 lg:p-6">
        {/* Header Section - Enhanced responsiveness */}
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
              Scoreboard
            </h1>
            <h2 className="text-base sm:text-lg lg:text-xl text-gray-600 font-medium sm:ml-2">
              {league.name}
            </h2>
          </div>
          <div className="w-auto">
            <WeekSelector
              selectedWeek={selectedWeek}
              totalWeeks={league.schedule.length}
              currentWeek={league.current_week}
              onChange={setSelectedWeek}
            />
          </div>
        </div>

        {/* Matchups Section - Enhanced grid layout */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-600 mb-3 sm:mb-4">
            Week {selectedWeek} Matchups
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {matchups.map((matchup) => (
              <div
                key={matchup._id}
                className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-3 sm:p-4"
              >
                {/* Matchup Card Content */}
                <div className="flex items-stretch sm:items-center gap-3 sm:gap-4">
                  {/* Team A */}
                  <div className="flex-1">
                    <div className="flex justify-between flex-col items-start">
                      <p className={`${getTeamStyle(matchup, matchup.team_a)} text-sm sm:text-base font-medium truncate max-w-[100px] sm:max-w-[125px]`}>
                        {teams[matchup.team_a]?.name || 'BYE'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 sm:mt-1">
                        {teams[matchup.team_a]?.wins}W - {teams[matchup.team_a]?.losses}L
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`flex items-center justify-center ${getScoreStyle(matchup)} text-sm sm:text-base min-w-[100px]`}>
                    <span className={`${getTeamStyle(matchup, matchup.team_a)}`}>
                      {matchup.team_a_score.toFixed(2)}
                    </span>
                    <span className="mx-2">-</span>
                    <span className={`${getTeamStyle(matchup, matchup.team_b)}`}>
                      {matchup.team_b_score.toFixed(2)}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className="flex-1">
                    <div className="flex justify-between flex-col items-end">
                      <p className={`${getTeamStyle(matchup, matchup.team_b)} text-sm sm:text-base font-medium truncate max-w-[100px] sm:max-w-[125px]`}>
                        {teams[matchup.team_b]?.name || 'BYE'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 sm:mt-1">
                        {teams[matchup.team_b]?.wins}W - {teams[matchup.team_b]?.losses}L
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status and Winner Indicators */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="w-8 flex justify-center">
                    {matchup.winner === matchup.team_a && (
                      <span className="material-symbols-outlined text-gray-600">arrow_drop_up</span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex justify-center">
                    <div className={`py-1 px-3 rounded-full text-center ${
                      matchup.status === "started"
                        ? "bg-red-100 text-red-800"
                        : matchup.status === "completed"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      <span className="text-xs whitespace-nowrap">
                        {matchup.status === "started"
                          ? "Lineups Locked"
                          : matchup.status === "completed"
                          ? "Matchup Completed"
                          : "Lineups Unlocked"}
                      </span>
                    </div>
                  </div>

                  <div className="w-8 flex justify-center">
                    {matchup.winner === matchup.team_b && (
                      <span className="material-symbols-outlined text-gray-600">arrow_drop_up</span>
                    )}
                  </div>
                </div>

                {/* View Matchup Link */}
                <div className="mt-3 text-center">
                  <Link
                    to={`/league/matchup?leagueid=${league._id}&matchupid=${matchup._id}`}
                    className="inline-block py-2 px-4 text-sm text-blue-500 hover:text-blue-600 hover:underline font-medium"
                  >
                    View Matchup
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeagueMatchup() {
  const [matchup, setMatchup] = useState(null);
  const [matchupStatus, setMatchupStatus] = useState('');
  const [week, setWeek] = useState(1);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [winner, setWinner] = useState('');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
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
        setWeek(matchupResponse.data.week);
        setMatchupStatus(matchupResponse.data.status);
        if (matchupResponse.data.winner === matchupResponse.data.team_a) {
          setWinner('a');
        }
        else if (matchupResponse.data.winner === matchupResponse.data.team_b) {
          setWinner('b');
        }

        const [teamAResponse, teamBResponse, rosterData] = await Promise.all([
          api.get(`/teams/${matchupResponse.data.team_a}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          api.get(`/teams/${matchupResponse.data.team_b}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          api.get(`/matchups/rosters/${matchupId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setTeamAName(teamAResponse.data.name);
        setTeamBName(teamBResponse.data.name);

        setTeamA(rosterData.data.team_a_roster);
        setTeamB(rosterData.data.team_b_roster);
        
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

  function formatName(fullName) {
    const firstSpace = fullName.indexOf(' ');
    return fullName[0] + '. ' + fullName.slice(firstSpace + 1);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
        <p className="mt-4 text-gray-600">Loading Matchup...</p>
      </div>
    </div>
  );
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
    return team.slice(0, 9).reduce((total, player) => total + (player?.weeks[week - 1] || 0), 0);
  };

  const teamATotal = calculateTotalPoints(teamA);
  const teamBTotal = calculateTotalPoints(teamB);

  const renderPlayerRow = (playerA, playerB, index) => {
    const position = getPositionForIndex(index);
    const isAlternate = index % 2 === 1;
    
    return (
      <tr key={index} className={isAlternate ? 'bg-gray-50' : 'bg-white'}>
        <td className="w-1/4 px-2 sm:px-3 py-1 whitespace-nowrap">
          <div className="flex items-center lg:space-x-3">
            <div className="hidden lg:block flex-shrink-0 w-10 h-10">
              {playerA && playerA.team && (
                <img 
                  src={playerA.team !== "FA" 
                    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${playerA.team.toLowerCase()}.png`
                    : `https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png`
                  }
                  alt={`${playerA.team !== "FA" ? playerA.team : "NFL"} logo`}
                  className="w-10 h-10 object-contain opacity-90"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {playerA ? formatName(playerA.name) : "None"}
                  {playerA && playerA.injury_status && (
                    <span className="text-red-600 ml-1">{playerA.injury_status}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{playerA ? `${playerA.position} - ${playerA.team}` : "-"}</div>
                <div className="text-xs text-gray-500">{playerA ? `vs ${playerA.opponent}` : "-"}</div>
              </div>
            </div>
          </div>
        </td>
        <td className="w-16 sm:w-1/5 px-1.5 sm:px-6 py-1 whitespace-nowrap text-sm text-gray-500 text-right">
          {playerA ? (playerA.weeks[week - 1] || 0).toFixed(1) : '-'}
        </td>
        <td className="w-12 px-0 py-1 whitespace-nowrap text-sm text-gray-500 text-center border-x font-bold bg-gray-50">
          {position}
        </td>
        <td className="w-16 sm:w-1/5 px-1.5 sm:px-6 py-1 whitespace-nowrap text-sm text-gray-500 text-left">
          {playerB ? (playerB.weeks[week - 1] || 0).toFixed(1) : '-'}
        </td>
        <td className="w-1/4 px-2 sm:px-3 py-1 whitespace-nowrap">
          <div className="flex items-center justify-end lg:space-x-3">
            <div className="flex-1 min-w-0 text-right">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {playerB ? formatName(playerB.name) : "None"}
                  {playerB && playerB.injury_status && (
                    <span className="text-red-600 ml-1">{playerB.injury_status}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{playerB ? `${playerB.position} - ${playerB.team}` : "-"}</div>
                <div className="text-xs text-gray-500">{playerB ? `vs ${playerB.opponent}` : "-"}</div>
              </div>
            </div>
            <div className="hidden lg:block flex-shrink-0 w-10 h-10">
              {playerB && playerB.team && (
                <img 
                  src={playerB.team !== "FA" 
                    ? `https://a.espncdn.com/i/teamlogos/nfl/500/${playerB.team.toLowerCase()}.png`
                    : `https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png`
                  }
                  alt={`${playerB.team !== "FA" ? playerB.team : "NFL"} logo`}
                  className="w-10 h-10 object-contain opacity-90"
                />
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const renderTotalRow = () => (
    <tr className="bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
      </td>
      <td className="pr-6 py-4 whitespace-nowrap text-md font-bold text-gray-900 text-right">
        {teamATotal.toFixed(2)}
      </td>
      <td className="w-12 py-4 whitespace-nowrap text-xs md:text-sm text-gray-500 text-center">
        TOTAL
      </td>
      <td className="pl-6 py-4 whitespace-nowrap text-md font-bold text-gray-900 text-left">
        {teamBTotal.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
      </td>
    </tr>
  );

  return (
    <div className="mt-12 md:mt-4 w-full max-w-6xl mx-auto lg:pl-36 md:pl-36 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className='bg-white sm:p-4 sm:rounded-xl'>
        <div className="flex justify-center items-center mb-3 divide-x">
          <div className="w-1/2 flex flex-col lg:flex-row justify-between items-start lg:items-center pt-2 sm:pt-none pl-2 sm:pl-none">
            {winner === 'a' ? (
              <div className='flex items-center'>
                <div className='hidden lg:flex w-12 h-12 mr-2 justify-center items-center rounded-xl bg-green-100'>
                  <span className='material-symbols-outlined !text-[25px] text-green-800'>trophy</span>
                </div>
                <div className='max-w-[150px] sm:max-w-[225px] xl:max-w-[250px] truncate'>
                  <Link 
                    to={`/league/team?leagueid=${matchup.league}&teamid=${matchup.team_a}`}
                    className="text-md sm:text-lg md:text-2xl font-semibold text-right hover:text-blue-500"
                  >{teamAName}</Link>
                </div>
              </div> ) : (
              <div className='flex items-center'>
                <div className='hidden lg:flex w-12 h-12 mr-2 justify-center items-center rounded-xl bg-gray-100'>
                  <span className='material-symbols-outlined !text-[25px] text-gray-800'>trophy</span>
                </div>
                <div className="max-w-[150px] sm:max-w-[225px] xl:max-w-[250px] truncate">
                  <Link 
                    to={`/league/team?leagueid=${matchup.league}&teamid=${matchup.team_a}`}
                    className="text-md sm:text-lg md:text-2xl font-semibold text-right hover:text-blue-500"
                  >{teamAName}</Link>
                </div>
              </div>
            )}
            {winner === 'a' ? ( 
              <div className='w-full flex items-center justify-between lg:justify-end'>
                <p className="text-md md:text-xl text-right ">{teamATotal.toFixed(2)} pts</p>
                <span className="material-symbols-outlined text-left"> arrow_left </span>
              </div>
            ) : (
              <div>
                <p className="mr-5 text-md md:text-xl text-right text-gray-400">{teamATotal.toFixed(2)} pts</p>
              </div>
            )}
          </div>

          <div className="w-1/2 flex flex-col-reverse lg:flex-row justify-between items-end lg:items-center pt-2 sm:pt-none pr-2 sm:pr-none">
            {winner === 'b' ? ( 
              <div className='w-full flex items-center justify-between lg:justify-start'>
                <span className="material-symbols-outlined text-left"> arrow_right </span>
                <p className="text-md md:text-xl text-right ">{teamBTotal.toFixed(2)} pts</p>
              </div>
            ) : (
              <div className='flex items-center'>
                <p className="ml-5 text-md md:text-xl text-right text-gray-400">{teamBTotal.toFixed(2)} pts</p>
              </div>
            )}
            {winner === 'b' ? (
              <div className='flex items-center'>
                <div className='max-w-[150px] sm:max-w-[225px] xl:max-w-[250px] truncate'>
                <Link 
                    to={`/league/team?leagueid=${matchup.league}&teamid=${matchup.team_b}`}
                    className="text-md sm:text-lg md:text-2xl font-semibold text-right hover:text-blue-500"
                  >{teamBName}</Link>
                </div>
                <div className='hidden lg:flex w-12 h-12 ml-2 justify-center items-center rounded-xl bg-green-100'>
                  <span className='material-symbols-outlined !text-[25px] text-green-800'>trophy</span>
                </div>
              </div> ) : (
              <div className='flex items-center'>
                <div className='max-w-[150px] sm:max-w-[225px] xl:max-w-[250px] truncate'>
                <Link 
                    to={`/league/team?leagueid=${matchup.league}&teamid=${matchup.team_b}`}
                    className="text-md sm:text-lg md:text-2xl font-semibold text-right hover:text-blue-500"
                  >{teamBName}</Link>
                </div>
                <div className='hidden lg:flex w-12 h-12 ml-2 justify-center items-center rounded-xl bg-gray-100'>
                  <span className='material-symbols-outlined !text-[25px] text-gray-800'>trophy</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='mb-3'>
          {matchupStatus === "started" ? (
            <div className="h-8 flex justify-center items-center">
              <div className='flex justify-center items-center h-full w-36 bg-red-100 rounded-2xl'>
                <span className="material-symbols-outlined text-red-800 text-xs"> lock </span>
                <p className='text-xs text-red-800 font-bold'>Lineups Locked</p>
              </div>
            </div>
          ) : matchupStatus === "completed" ? (
            <div className="h-8 flex justify-center items-center">
              <div className='flex justify-center items-center h-full w-36 bg-gray-100 rounded-2xl'>
                <p className='text-xs text-gray-800 font-bold'>Matchup Completed</p>
              </div>
            </div>
          ) : (
            <div className="h-8 flex justify-center items-center">
              <div className='flex justify-center items-center h-full w-36 bg-green-100 rounded-2xl'>
                <span className="material-symbols-outlined text-green-800 text-xs"> lock_open </span>
                <p className='text-xs text-green-800 font-bold'>Lineups Unlocked</p>
              </div>
            </div>
          )}
        </div>

        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <tbody className="bg-white divide-y divide-gray-200">
            {teamA.slice(0, 9).map((playerA, index) => 
              renderPlayerRow(playerA, teamB[index], index)
            )}
            
            {renderTotalRow()}

            {teamA.slice(9).map((playerA, index) => 
              renderPlayerRow(playerA, teamB[index + 9], index + 9)
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
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-4">
          <span className="material-symbols-outlined text-4xl md:text-6xl animate-spin text-blue-500">
            progress_activity
          </span>
          <p className="mt-4 text-gray-600">Loading Standings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4 text-center">{error}</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto md:pl-36 mt-16 md:mt-4">
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
            Standings
          </h1>
          <h2 className="text-lg sm:text-xl text-gray-600 font-medium">
            {league.name}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="text-center w-16 sm:w-20 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    W
                  </th>
                  <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    L
                  </th>
                  <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win%
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teams.map((team, index) => (
                  <tr key={team._id} className={index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'}>
                    <td className="text-center py-2 text-sm text-gray-500 border-r">
                      <span>{index + 1}</span>
                    </td>
                    <td className="truncate max-w-[200px] sm:max-w-[300px] px-2 sm:px-6 py-2 whitespace-nowrap">
                      <Link 
                        to={`/league/team?leagueid=${league._id}&teamid=${team._id}`}
                        className="text-sm font-medium text-blue-500 hover:text-blue-700"
                      >
                        {team.name}
                      </Link>
                    </td>
                    <td className="px-2 sm:px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {team.wins}
                    </td>
                    <td className="px-2 sm:px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {team.losses}
                    </td>
                    <td className="px-2 sm:px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {(team.winPercentage).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const [currentMatchup, setCurrentMatchup] = useState(null);
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

        // Fetch current matchup
        var index = 19 - leagueResponse.data.schedule.length;
        var weekIndex = leagueResponse.data.week - index;
        const currentWeekMatchups = leagueResponse.data.schedule[weekIndex] || [];
        const matchupPromises = currentWeekMatchups.map(matchupId =>
          api.get(`/matchup/${matchupId}`, { headers: { Authorization: `Bearer ${token}` } })
        );
        const matchupResponses = await Promise.all(matchupPromises);
        const teamMatchup = matchupResponses.find(response => {
          const matchup = response.data;
          return matchup.team_a === teamId || matchup.team_b === teamId;
        });
        if (teamMatchup) {
          setCurrentMatchup(teamMatchup.data);
        }

        const ownerResponse = await api.get(`/users/${teamResponse.data.owner}`, { headers: { Authorization: `Bearer ${token}` } });
        setTeamOwner(ownerResponse.data);

        const rosterResponse = await api.get(`/teams/roster/${teamId}`, { headers: { Authorization: `Bearer ${token}` } });

        setRoster(rosterResponse.data);
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

  const isValidMove = (fromIndex, toIndex) => {
    const sourcePlayer = roster[fromIndex];
    const targetPlayer = roster[toIndex];
    
    if (!sourcePlayer) return false;
    
    const sourcePosition = sourcePlayer.position;
    const validSlots = [];
    
    // Add all valid positions for the source player
    if (VALID_ROSTER_SLOTS[sourcePosition]) {
      validSlots.push(...VALID_ROSTER_SLOTS[sourcePosition]);
    }
    // Add bench slots as valid positions
    validSlots.push(...VALID_ROSTER_SLOTS["BENCH"]);
    
    // Check if target position is valid for source player
    if (!validSlots.includes(toIndex)) {
      return false;
    }
    
    // If target slot has a player, check if source slot is valid for target player
    if (targetPlayer) {
      const targetValidSlots = [];
      if (VALID_ROSTER_SLOTS[targetPlayer.position]) {
        targetValidSlots.push(...VALID_ROSTER_SLOTS[targetPlayer.position]);
      }
      targetValidSlots.push(...VALID_ROSTER_SLOTS["BENCH"]);
      
      if (!targetValidSlots.includes(fromIndex)) {
        return false;
      }
    }
    
    return true;
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
          <div className='h-8 w-8 flex justify-center items-center hover:bg-blue-200 rounded-full'>
            <span className="material-symbols-outlined !text-blue-400"> swap_horiz </span>
          </div>
        </button>
      );
    } else if (selectedPlayer === index) {
      return (
        <button
          onClick={() => setSelectedPlayer(null)}
          className="ml-2"
        >
          <div className='h-8 w-8 flex justify-center items-center hover:bg-gray-200 rounded-full'>
            <span className="material-symbols-outlined !text-gray-400"> close </span>
          </div>
        </button>
      );
    } else {
      // Only show the green checkmark if the move is valid
      const isValid = isValidMove(selectedPlayer, index);
      if (!isValid) return <div className='ml-2 h-8 w-8'></div>;

      return (
        <button
          onClick={() => handleMovePlayer(selectedPlayer, index)}
          className="ml-2"
        >
          <div className='h-8 w-8 flex justify-center items-center hover:bg-green-200 rounded-full'>
            <span className="material-symbols-outlined !text-green-400"> done_outline </span>
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
            <div className='h-8 w-8 flex justify-center items-center hover:bg-red-200 rounded-full'>
              <span class="material-symbols-outlined !text-red-400"> delete </span>
            </div>
          </button>
        )}
        {renderMoveButton(index)}
      </div>
    );
  };

  const calculateStartersPoints = () => {
    return roster
      .slice(0, 9)
      .reduce((sum, player) => {
        const points = player?.weeks?.[weekIndex] || 0;
        return sum + points;
      }, 0)
      .toFixed(1);
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

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
        <p className="mt-4 text-gray-600">Loading Team...</p>
      </div>
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="w-full md:ml-36 md:w-11/12 md:w-4/5 mt-16 md:mt-4 mb-8">
      {/* Error Message */}
      {swapError && (
        <div className="fixed top-12 left-0 right-0 mx-4 md:mx-auto md:w-96 bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3 z-50" role="alert">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{swapError}</span>
            </div>
            <button 
              onClick={() => setSwapError('')} 
              className="ml-4 text-red-700 hover:text-red-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {actionSuccess && (
        <div className="fixed top-12 left-0 right-0 mx-4 md:mx-auto md:w-96 bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 z-50" role="alert">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <strong className="font-bold">Success: </strong>
              <span className="block sm:inline">{actionSuccess}</span>
            </div>
            <button 
              onClick={() => setActionSuccess('')} 
              className="ml-4 text-green-700 hover:text-green-900 focus:outline-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Team Information */}
      <div className="bg-white shadow sm:rounded-lg mb-4">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="truncate max-w text-xl md:text-3xl leading-6 font-medium text-gray-900">{team.name}</h3>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
            <h1 className="text-sm text-gray-900">{team.wins} - {team.losses}</h1>
            <h1 className="text-sm text-gray-900">{league.name}</h1>
            <h1 className="text-sm text-gray-900">{teamOwner.name}</h1>
          </div>
          <div className="mt-2 md:mt-0">
            {currentMatchup ? (
              <Link 
                to={`/league/matchup?leagueid=${league._id}&matchupid=${currentMatchup._id}`}
                className="text-blue-500 hover:text-blue-700 underline"
              >
                View Your Week {weekIndex + 1} Matchup
              </Link>
            ) : (
              <span className="text-gray-500">No Matchup This Week</span>
            )}
          </div>
        </div>
      </div>

      {/* Team Roster */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Lineup</h3>
          {currentUser._id === team.owner && (
            <button 
              onClick={toggleEditing}
              className={`px-4 py-2 rounded-xl w-full sm:w-auto ${
                isEditing 
                  ? 'bg-green-400 text-white hover:bg-green-500' 
                  : 'bg-gray-100 text-black hover:bg-gray-200'
              }`}
            >
              {isEditing ? (
                <div className='flex items-center justify-center gap-1'>
                  <span className="material-symbols-outlined">check</span>
                  <span>Finish Editing</span>
                </div>
              ) : (
                <div className='flex items-center justify-center gap-1'>
                  <span className="material-symbols-outlined">edit</span>
                  <span>Edit Team</span>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Responsive Table */}
        <div className="border-t border-gray-200 overflow-x-auto">
          <div className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                  <th scope="col" className="hidden md:table-cell w-16 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                  <th scope="col" className={`${isEditing ? 'table-cell' : 'hidden sm:table-cell'} px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28 border-r`}>Actions</th>
                  <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
                  <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proj</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roster.map((player, index) => (
                  <React.Fragment key={index}>
                    {index === 9 && (
                      <>
                        <tr className="sm:hidden">
                          <td colSpan={`${isEditing ? "4" : "3"}`} className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">Bench</div>
                          </td>
                          <td colSpan="1" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">{calculateStartersPoints()}</div>
                          </td>
                        </tr>
                        <tr className="hidden md:hidden sm:table-row">
                          <td colSpan="4" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">Bench</div>
                          </td>
                          <td colSpan="1" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">{calculateStartersPoints()}</div>
                          </td>
                        </tr>
                        <tr tr className="hidden lg:hidden md:table-row">
                          <td colSpan="6" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">Bench</div>
                          </td>
                          <td colSpan="1" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">{calculateStartersPoints()}</div>
                          </td>
                        </tr>
                        <tr tr className="hidden lg:table-row">
                          <td colSpan="7" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">Bench</div>
                          </td>
                          <td colSpan="1" className="px-6 py-4 whitespace-nowrap bg-gray-100">
                            <div className="text-sm font-medium text-gray-900">{calculateStartersPoints()}</div>
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getPositionForIndex(index)}</div>
                      </td>
                      <td className="hidden md:table-cell whitespace-nowrap">
                        <div className="flex justify-center">
                          {player && player.team && player.team !== "FA" ? (
                            <img 
                              src={`https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`}
                              alt={`${player.team} logo`}
                              className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-90"
                            />
                          ) : player && player.team === "FA" ? (
                            <img 
                              src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png`}
                              alt="NFL logo"
                              className="w-8 h-8 md:w-10 md:h-10 object-contain opacity-90"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {player ? player.name : "None"}
                              {player && player.injury_status && (
                                <span className="text-red-600 ml-1">{player.injury_status}</span>
                              )}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">{player ? `${player.position} - ${player.team}` : "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`${isEditing ? 'table-cell' : 'hidden sm:table-cell'}  px-3 py-2 whitespace-nowrap text-sm font-medium border-r`}>
                        {renderActionButtons(player, index)}
                      </td>
                      <td className="hidden md:table-cell px-6 py-2 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{player?.opponent || "-"}</div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-2 whitespace-nowrap">
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
      </div>

      {/* Modal - Making it responsive */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
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
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3"
                  onClick={handleRemovePlayer}
                >
                  Drop
                </button>
                <button
                  type="button"
                  className="mt-3 w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3"
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
  const [username, setUserName] = useState('');
  const [error, setError] = useState('');
  const [copiedStates, setCopiedStates] = useState({});
  const navigate = useNavigate();

  const fetchMatchupForLeague = async (league, userTeamId, token) => {
    try {
      // Calculate the current week's index in the schedule
      var index = 19 - league.schedule.length;
      var scheduleIndex = league.week - index;
      if (scheduleIndex < 0 || !league.schedule[scheduleIndex]) {
        return null;
      }

      // Get the current week's matchups
      const currentWeekMatchups = league.schedule[scheduleIndex];
      
      // Fetch all matchups for the current week
      const matchupPromises = currentWeekMatchups.map(matchupId =>
        api.get(`/matchup/${matchupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      
      const matchupResponses = await Promise.all(matchupPromises);

      // Find the matchup containing the user's team
      const userMatchup = matchupResponses.find(response => {
        const matchup = response.data;
        return matchup.team_a === userTeamId || matchup.team_b === userTeamId;
      });

      if (!userMatchup) {
        return null;
      }

      // Fetch both teams' information
      const [teamAResponse, teamBResponse] = await Promise.all([
        api.get(`/teams/${userMatchup.data.team_a}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        api.get(`/teams/${userMatchup.data.team_b}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      return {
        matchupId: userMatchup.data._id,
        teamA: {
          id: teamAResponse.data._id,
          name: teamAResponse.data.name,
          score: userMatchup.data.team_a_score
        },
        teamB: {
          id: teamBResponse.data._id,
          name: teamBResponse.data.name,
          score: userMatchup.data.team_b_score
        }
      };
    } catch (error) {
      console.error('Error fetching matchup:', error);
      return null;
    }
  };

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

        // Fetch user's team and matchup for each league
        const leaguesWithTeamsAndMatchups = await Promise.all(leaguesData.map(async (league) => {
          const userTeam = league.teams.find(teamId => userResponse.data.teams.includes(teamId));
          if (userTeam) {
            const teamResponse = await api.get(`/teams/${userTeam}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const matchup = await fetchMatchupForLeague(league, userTeam, token);
            const draftResponse = await api.get(`/drafts/${league.draft}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            return { ...league, userTeam: teamResponse.data, currentMatchup: matchup , draftStatus: draftResponse.data.status};
          }
          return league;
        }));

        setUserLeagues(leaguesWithTeamsAndMatchups);
        setUserName(userResponse.data.username);
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

  const copyToClipboard = (text, leagueId) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedStates(prev => ({ ...prev, [leagueId]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [leagueId]: false }));
        }, 1000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  const getTrophyColor = (teams) => {
    const styles = {
      2: { bg: 'bg-red-100', text: 'text-red-800' },
      4: { bg: 'bg-orange-100', text: 'text-orange-800' },
      6: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      8: { bg: 'bg-green-100', text: 'text-green-800' },
      10: { bg: 'bg-teal-100', text: 'text-teal-800' },
      12: { bg: 'bg-sky-100', text: 'text-sky-800' },
      14: { bg: 'bg-blue-100', text: 'text-blue-800' },
      16: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      18: { bg: 'bg-violet-100', text: 'text-violet-800' },
      20: { bg: 'bg-purple-100', text: 'text-purple-800' },
    };
    return styles[teams] || { bg: 'bg-pink-100', text: 'text-pink-800' };
  };

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <h1 className="my-4 text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Welcome {username}!
        </h1>

        {/* Create/Join League Section */}
        <div className="mb-8 flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
          {/* Create League Card */}
          <div className="w-full sm:w-auto flex flex-col items-center p-6 sm:p-8 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg transition-transform hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <div className="text-4xl sm:text-5xl mb-4">🏆</div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Create League</h1>
              <p className="text-gray-600">Up to 20 Players</p>
              <p className="text-gray-600">Customize Your League</p>
            </div>
            <Link to="/league/create" className="w-full sm:w-52 mt-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg text-lg flex justify-center items-center transition-all">
                Create League
              </div>
            </Link>
          </div>

          {/* Divider - visible only on larger screens */}
          <div className="hidden sm:block w-[1px] h-60 bg-gradient-to-b from-gray-300 to-transparent" />

          {/* Join League Card */}
          <div className="w-full sm:w-auto flex flex-col items-center p-6 sm:p-8 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg transition-transform hover:scale-105">
            <div className="flex flex-col items-center text-center">
              <div className="text-4xl sm:text-5xl mb-4">🤝</div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Join League</h1>
              <p className="text-gray-600">Ask a friend for Invite ID</p>
              <p className="text-gray-600">Jump into the Action!</p>
            </div>
            <Link to="/league/join" className="w-full sm:w-52 mt-6">
              <div className="bg-gradient-to-r from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700 text-white font-bold py-3 rounded-lg shadow-lg text-lg flex justify-center items-center transition-all">
                Join League
              </div>
            </Link>
          </div>
        </div>

        {/* Leagues Section */}
        <div className="w-full md:pl-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 mb-2">
            You are in {userLeagues.length} leagues
          </h1>
          <h2 className="text-gray-600 text-lg sm:text-xl font-medium mb-8 text-center">
            You can join or create up to 10!
          </h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          
          {/* Leagues Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userLeagues.map((league) => (
              <Link 
                to={`/league/home?leagueid=${league._id}`}
                key={league._id} 
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
              >
                {/* League Header */}
                <div className="flex justify-left items-center mb-1">
                  <div className={`w-12 h-12 mr-2 flex justify-center items-center rounded-xl ${getTrophyColor(league.number_of_players).bg}`}>
                    <span className={`material-symbols-outlined !text-[25px] ${getTrophyColor(league.number_of_players).text}`}>trophy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-left text-xl font-semibold truncate">{league.name}</h1>
                    <p className="text-gray-500 truncate">Your Team: {league.userTeam ? league.userTeam.name : 'N/A'}</p>
                  </div>
                </div>

                {/* Matchup Section */}
                <div className="my-2 p-2 bg-gray-50 rounded-lg divide-y">
                  <p className="text-sm font-medium text-gray-600">Week {league.week} Matchup:</p>
                  <div className="pt-1">
                    {league.currentMatchup ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm truncate flex-1 ${league.currentMatchup.teamA.id === league.userTeam._id ? 'text-blue-400' : ''}`}>
                            {league.currentMatchup.teamA.name}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">{league.currentMatchup.teamA.score.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm truncate flex-1 ${league.currentMatchup.teamB.id === league.userTeam._id ? 'text-blue-400' : ''}`}>
                            {league.currentMatchup.teamB.name}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">{league.currentMatchup.teamB.score.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No matches here this week!</div>
                    )}
                  </div>
                </div>

                {/* League Info */}
                <p className="text-gray-500 mb-2">Players: {league.teams.length}/{league.number_of_players}</p>
                
                {/* Draft Status */}
                <div className="flex items-center gap-2 mb-1">
                  {league.draftStatus === "completed" ? (
                    <div className="inline-block rounded-full px-3 py-1 bg-green-100 text-green-800">
                      <div className="text-sm font-medium">Drafted</div>
                    </div>
                  ) : league.draftStatus === "started" || league.draftStatus === "waiting" ? (
                    <div className="inline-block rounded-full px-3 py-1 bg-red-100 text-red-800">
                      <div className="text-sm font-medium">Drafting!</div>
                    </div>
                  ) : (
                    <div className="inline-block rounded-full px-3 py-1 bg-yellow-100 text-yellow-800">
                      <div className="text-sm font-medium">Pending</div>
                    </div>
                  )}
                </div>

                {/* Invite ID Section */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-md text-gray-500">Invite ID:</span>
                  <div className="relative">
                    <span 
                      className="text-sm bg-gray-200 px-2 py-1 rounded cursor-pointer flex items-center gap-1 hover:bg-gray-300 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        copyToClipboard(league._id, league._id);
                      }}
                    >
                      {league._id.slice(0, 7)}...
                      <span className="material-symbols-outlined text-base !text-[15px]">
                        {copiedStates[league._id] ? 'check' : 'content_copy'}
                      </span>
                    </span>
                    {copiedStates[league._id] && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap">
                        Copied!
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="mx-auto w-full h-[1px] bg-gray-200 mt-4" />
                {league.currentMatchup ? (
                  <div className="flex justify-evenly items-center">
                    <Link to={`/league/team?leagueid=${league._id}&teamid=${league.userTeam._id}`} className="text-sm text-blue-500 mt-1 hover:text-blue-600">
                      My Team
                    </Link>
                    <div className="w-[1px] h-4 bg-gray-200 mt-1" />
                    <Link to={`/league/matchup?leagueid=${league._id}&matchupid=${league.currentMatchup.matchupId}`} className="text-sm text-blue-500 mt-1 hover:text-blue-600">
                      Matchup
                    </Link>
                  </div>
                ) : (
                  <div className="flex justify-center items-center">
                    <Link to={`/league/team?leagueid=${league._id}&teamid=${league.userTeam._id}`} className="text-sm text-blue-500 mt-1 hover:text-blue-600">
                      My Team
                    </Link>
                  </div>
                )}
              </Link>
            ))}
          </div>
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAction, setDeleteAction] = useState('');
  const [validationError, setValidationError] = useState(false);
  const teamNameInputRef = useRef(null);
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

  const handleTeamNameChange = (e) => {
    setNewTeamName(e.target.value);
    if (validationError) {
      setValidationError(false);
    }
  };

  const handleChangeTeamName = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newTeamName.trim()) {
      setValidationError(true);
      return;
    }

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

  const handleDivClick = () => {
    if (teamNameInputRef.current) {
      teamNameInputRef.current.focus();
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
      const response = await api.post(`/drafts/wait/${leagueDraft._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeagueDraft(response.data);
      setSuccess('You have started the draft process successfully.');
    } catch (error) {
      console.error('Error Starting:', error);
      setError(`Failed to start the draft. ${error.response?.data?.detail || 'Please try again.'}`);
    }
  };

  const isCommissioner = league && userTeam && league.commissioner === userTeam.owner;

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <span className="material-symbols-outlined text-6xl animate-spin text-blue-500">progress_activity</span>
        <p className="mt-4 text-gray-600">Loading Settings...</p>
      </div>
    </div>
  );
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="max-w-2xl my-16 md:my-4 mx-auto md:pl-24">
      <div className="bg-white shadow-md rounded-xl px-8 pt-6 pb-8 mb-4 divide-y">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
            League Settings
          </h1>
          <h2 className="text-gray-600 text-md sm:text-lg font-medium text-center truncate max-w">
            {league.name}
          </h2>
        </div>

        {/* Success Message */}
        {success && (
          <div className="flex items-center bg-green-100 rounded-xl border border-green-400 text-green-700 px-4 py-3 mb-4">
            <span className="material-symbols-outlined mr-2">check_circle</span>
            <p>{success}</p>
            <button onClick={() => setSuccess('')} className="ml-auto">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center bg-red-100 rounded-xl border border-red-400 text-red-700 px-4 py-3 mb-4">
            <span className="material-symbols-outlined mr-2">error</span>
            <p>{error}</p>
            <button onClick={() => setError('')} className="ml-auto">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Team Name Section */}
        <form onSubmit={handleChangeTeamName} className="mb-8">
          <h3 className="text-gray-600 text-lg font-medium mb-4">Team Name</h3>
          <div 
            className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 mb-4 cursor-text ${
              validationError 
                ? 'border-red-500' 
                : 'border-gray-300 focus-within:border-blue-500'
            }`}
            onClick={handleDivClick}
          >
            <span className="material-symbols-outlined text-gray-500 mr-2 flex-shrink-0">sports_football</span>
            <div className="w-full min-w-0"> {/* min-w-0 prevents flex child from expanding */}
              <label className="block text-sm font-semibold text-gray-500 truncate">
                Current Name: {userTeam.name}
              </label>
              <input
                ref={teamNameInputRef}
                type="text"
                value={newTeamName}
                onChange={handleTeamNameChange}
                placeholder="Enter new team name"
                className="bg-transparent focus:outline-none w-full text-gray-700 py-1 truncate"
                maxLength={48}
              />
            </div>
            {validationError && (
              <span className="material-symbols-outlined !text-red-600 flex-shrink-0">error</span>
            )}
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all"
          >
            Update Team Name
          </button>
        </form>

        {/* Draft Settings Section */}
        {isCommissioner && leagueDraft.status === "scheduled" && (
          <div className="mb-8">
            <h3 className="text-gray-600 text-lg font-medium mb-4">Draft Settings</h3>
            <p className="text-sm text-gray-600 mb-2">
              Starts a 5 minute Draft Countdown!
            </p>
            <form className="space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDraftStart}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all"
                >
                  Start Draft
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Danger Zone */}
        <div className="border-t pt-6">
          <h3 className="text-gray-600 text-lg font-medium mb-2">League Deletion</h3>
          <p className="text-sm text-gray-500 mb-4">The action of deleting a league cannot be undone!</p>
          {!isCommissioner ? (
            <button
              onClick={() => {
                setDeleteAction('team');
                setShowDeleteModal(true);
              }}
              className="flex items-center justify-center w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all"
            >
              <span className="material-symbols-outlined mr-2">logout</span>
              Leave League
            </button>
          ) : (
            <button
              onClick={() => {
                setDeleteAction('league');
                setShowDeleteModal(true);
              }}
              className="flex items-center justify-center w-full bg-gradient-to-r from-rose-400 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all"
            >
              <span className="material-symbols-outlined mr-2">delete_forever</span>
              Delete League
            </button>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">
              Confirm {deleteAction === 'team' ? 'Leaving League' : 'League Deletion'}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to {deleteAction === 'team' ? 'leave' : 'delete'} this league? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all"
              >
                {deleteAction === 'team' ? 'Leave League' : 'Delete League'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function League() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LeagueLanding />} />
        <Route path="create" element={<LeagueCreate />} />
        <Route path="home" element={<LeagueHome />} />
        <Route path="join" element={<LeagueJoin />} />
        <Route path="players" element={<LeaguePlayers />} />
        <Route path="team" element={<LeagueMyTeam />} />
        <Route path="scoreboard" element={<LeagueScoreboard />} />
        <Route path="standings" element={<LeagueStandings />} />
        <Route path="matchup" element={<LeagueMatchup />} />
        <Route path="settings" element={<LeagueSettings />} />
        <Route path="draft" element={<DraftHome />} />
      </Routes>
      <Outlet />
    </>
  );
}
  
  export default League;