import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import { Route, Routes, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

const tokenUtil = {
  setToken: (token) => localStorage.setItem('token', token),
  getToken: () => localStorage.getItem('token'),
  removeToken: () => localStorage.removeItem('token'),
};

function UserProfile() {
  const [userData, setUserData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [error, setError] = useState('');
  const [copiedStates, setCopiedStates] = useState({});
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const teamsRef = useRef(null);
  const leaguesRef = useRef(null);
  const { logout } = useAuth();

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
        console.log(response);
        console.log(response.data);
        setUserData(response.data);
        fetchTeams(response.data.teams);
        fetchLeagues(response.data.leagues);
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

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const section = queryParams.get('section');
    if (section === 'team' && teamsRef.current) {
      teamsRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'league' && leaguesRef.current) {
      leaguesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location, teams, leagues]);

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
      setTeams(teamData);
    } catch (error) {
      console.error('Error fetching team data:', error);
      setError('Error fetching team data. Please try again.');
    }
  };

  const fetchLeagues = async (leagueIds) => {
    const token = tokenUtil.getToken();
    
    try {
      const leaguePromises = leagueIds.map(leagueId =>
        api.get(`/leagues/${leagueId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      
      const leagueResponses = await Promise.all(leaguePromises);
      const leagues = leagueResponses.map(response => response.data);
      
      const draftPromises = leagues.map(league =>
        api.get(`/drafts/${league.draft}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      
      const draftResponses = await Promise.all(draftPromises);
      const drafts = draftResponses.map(response => response.data.status);
      
      const leaguesWithDrafts = leagues.map((league, index) => ({
        ...league,
        draftDetails: drafts[index]
      }));
      
      setLeagues(leaguesWithDrafts);
    } catch (error) {
      console.error('Error fetching league data:', error);
      setError('Error fetching league data. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    const token = tokenUtil.getToken();
    try {
      await api.delete(`/users/${userData._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      logout();
      navigate('/user/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Error deleting account. Please try again.');
    }
  };

  const openDeleteModal = () => {
    setShowModal(true);
  };

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

  if (error) return <p className="text-red-600">{error}</p>;
  if (!userData) return <p>Loading...</p>;

  return (
    <div className="flex justify-center items-center px-4 mt-4 md:mt-none sm:px-6 md:ml-12 lg:px-8">
      <div className="relative my-12 h-fit w-full max-w-3xl bg-gray-50 rounded-2xl">
        {/* Header Banner */}
        <div className="h-40 sm:h-52 w-full bg-gradient-to-r from-blue-200 to-sky-300 rounded-t-2xl shadow-md" />
        
        {/* Profile Icon */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 sm:h-40 sm:w-40 bg-white rounded-full flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined !text-[60px] sm:!text-[80px]">sports_football</span>
        </div>

        {/* Content Section */}
        <div className="px-4 sm:px-6 lg:px-8 pb-6 pt-16 sm:pt-24 h-fit w-full rounded-b-2xl shadow-lg text-center">
          <h1 className="text-lg sm:text-xl font-bold mb-4">{userData.name}</h1>
          
          {/* User Info */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Username: </h1>
              <h1 className="text-base sm:text-lg">{userData.username}</h1>
            </div>
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-base sm:text-lg text-gray-500">Email: </h1>
              <h1 className="text-base sm:text-lg">{userData.email}</h1>
            </div>
          </div>

          {/* Leagues Section */}
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-lg sm:text-xl font-bold mt-4">Your Leagues</h1>
            {leagues.map(league => (
              <Link 
                to={`/league/home?leagueid=${league._id}`} 
                key={league.id} 
                className="h-auto flex items-center justify-between bg-white hover:bg-gray-50 p-3 m-2 w-full sm:w-4/5 shadow rounded-xl"
              >
                <div className="flex-1 min-w-48 mb-2 sm:mb-0">
                  <h1 className="text-left text-base sm:text-lg truncate max-w-[200px]">{league.name}</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-gray-500">Invite ID:</span>
                    <div className="relative">
                      <span 
                        className="text-xs sm:text-sm bg-gray-200 px-2 py-1 rounded cursor-pointer flex items-center gap-1 hover:bg-gray-300 transition-colors"
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
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {league.draftDetails === "completed" ? (
                    <div className="inline-block rounded-full px-2 sm:px-3 py-1 bg-green-100 text-green-800">
                      <div className="text-xs sm:text-sm font-medium">Drafted</div>
                    </div>
                  ) : league.draftDetails === "started" || league.draftStatus === "waiting" ? (
                    <div className="inline-block rounded-full px-2 sm:px-3 py-1 bg-red-100 text-red-800">
                      <div className="text-xs sm:text-sm font-medium">Drafting!</div>
                    </div>
                  ) : (
                    <div className="inline-block rounded-full px-2 sm:px-3 py-1 bg-yellow-100 text-yellow-800">
                      <div className="text-xs sm:text-sm font-medium">Pending</div>
                    </div>
                  )}
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Account Removal Section */}
          <div className="flex flex-col text-left justify-center mt-8">
            <h1 className="text-lg sm:text-xl font-bold mb-2">Account Removal</h1>
            <span className="text-xs sm:text-sm text-gray-500 mb-2">The action of deleting an account cannot be undone!</span>
            <button 
              onClick={openDeleteModal} 
              className="w-full sm:w-2/5 bg-gradient-to-r from-rose-400 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold py-2 px-4 sm:px-6 rounded focus:outline-none focus:shadow-outline"
            >
              Delete Account
            </button>
          </div>
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
                      Delete Account
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete your account? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3"
                  onClick={handleDeleteAccount}
                >
                  Delete
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

const UserCreate = () => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    username: false,
    email: false,
    password: false,
    name: false
  });
  const inputRefs = {
    username: useRef(null),
    email: useRef(null),
    password: useRef(null),
    name: useRef(null)
  };
  const navigate = useNavigate();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setUserData(prevState => ({
      ...prevState,
      [name]: value
    }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
    const newValidationErrors = {
      username: !userData.username.trim(),
      email: !userData.email.trim(),
      password: !userData.password.trim(),
      name: !userData.name.trim()
    };
    
    setValidationErrors(newValidationErrors);
    
    if (Object.values(newValidationErrors).some(error => error)) {
      return;
    }
    
    try {
      await api.post('/users/create/', userData);
      setSuccess(true);

      setTimeout(() => {
        navigate('/user/login');
      }, 2000);
    } catch (err) {
      setError('Error creating account. Please try again.');
      console.error('Error creating user:', err);
    }
  };

  const handleDivClick = (fieldName) => {
    if (inputRefs[fieldName].current) {
      inputRefs[fieldName].current.focus();
    }
  };

  const handleLoginClick = () => {
    navigate('/user/login');
  };

  const inputFields = [
    { name: 'username', icon: 'person', placeholder: 'Enter Username' },
    { name: 'email', icon: 'mail', placeholder: 'Enter Email' },
    { name: 'password', icon: 'lock', placeholder: 'Enter Password' },
    { name: 'name', icon: 'badge', placeholder: 'Enter Full Name' }
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-52"></div>
      <form onSubmit={handleFormSubmit} className="bg-white shadow-md rounded-xl px-4 sm:px-8 pt-6 pb-8 mb-4">
        <h1 className="h-12 text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Create Account
        </h1>
        <h2 className="text-gray-600 text-base sm:text-lg font-medium mb-6 sm:mb-8 text-center">
          Join to start playing!
        </h2>

        {inputFields.map((field) => (
          <div className="mb-4" key={field.name}>
            <div 
              className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 cursor-text ${
                validationErrors[field.name]
                  ? 'border-red-500'
                  : 'border-gray-300 focus-within:border-blue-500'
              }`}
              onClick={() => handleDivClick(field.name)}
            >
              <span className="material-symbols-outlined text-gray-500 mr-2">{field.icon}</span>
              <div className="w-full">
                <label 
                  htmlFor={field.name}
                  className="block text-sm font-semibold text-gray-500 capitalize"
                  onClick={(e) => e.stopPropagation()}
                >
                  {field.name}
                </label>
                <input
                  ref={inputRefs[field.name]}
                  type={field.name === 'password' ? 'password' : 'text'}
                  id={field.name}
                  name={field.name}
                  onChange={handleInputChange}
                  value={userData[field.name]}
                  placeholder={field.placeholder}
                  className="bg-transparent focus:outline-none w-full text-gray-700 py-1 text-sm sm:text-base"
                  maxLength={64}
                />
              </div>
              {validationErrors[field.name] && (
                <span className="material-symbols-outlined !text-red-600">error</span>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-col items-center justify-between gap-4 mt-6">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold p-3 rounded-lg shadow-lg text-sm sm:text-md flex justify-center items-center transition-all"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={handleLoginClick}
            className="text-gray-600 hover:text-gray-800 font-semibold transition-all text-sm sm:text-base"
          >
            Already have an account?
          </button>
        </div>

        {error && (
          <div className='flex mt-4 text-sm sm:text-base'>
            <span className="material-symbols-outlined !text-red-600">error</span>
            <p className="ml-1 text-red-600">There may already be an account with the same Username or Email.</p>
          </div>
        )}
        {success && <p className="text-green-600 mt-4 text-sm sm:text-base">Account created successfully!</p>}
      </form>
    </div>
  );
};

const UserLogin = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    username: false,
    password: false
  });
  const inputRefs = {
    username: useRef(null),
    password: useRef(null)
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsLoggedIn } = useAuth();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setCredentials(prevState => ({
      ...prevState,
      [name]: value
    }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  const handleGuestLogin = async () => {
    setCredentials({
      username: 'admin',
      password: 'pass'
    });
    
    try {
      const guestCredentials = {
        username: 'admin',
        password: 'pass'
      };
      
      const response = await api.post('/token', new URLSearchParams(guestCredentials));
      tokenUtil.setToken(response.data.access_token);
      setIsLoggedIn(true);
      
      const from = location.state?.from || '/user/profile';
      navigate(from);
    } catch (err) {
      setError('Guest login failed. Please try again later.');
      console.error('Guest login error:', err);
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    const newValidationErrors = {
      username: !credentials.username.trim(),
      password: !credentials.password.trim()
    };

    setValidationErrors(newValidationErrors);

    if (Object.values(newValidationErrors).some(error => error)) {
      return;
    }
    
    try {
      const response = await api.post('/token', new URLSearchParams(credentials));
      tokenUtil.setToken(response.data.access_token);
      setIsLoggedIn(true);
      
      const from = location.state?.from || '/user/profile';
      navigate(from);
    } catch (err) {
      setError('Login failed. Please check your credentials and try again.');
      console.error('Login error:', err);
    }
  };

  const handleDivClick = (fieldName) => {
    if (inputRefs[fieldName].current) {
      inputRefs[fieldName].current.focus();
    }
  };

  const handleCreateClick = () => {
    navigate('/user/create');
  };

  const inputFields = [
    { name: 'username', icon: 'person', placeholder: 'Enter Username' },
    { name: 'password', icon: 'lock', placeholder: 'Enter Password' }
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-52"></div>
      <form onSubmit={handleFormSubmit} className="bg-white shadow-md rounded-xl px-4 sm:px-8 pt-6 pb-8 mb-4">
        <h1 className="h-12 text-3xl sm:text-4xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
          Welcome Back
        </h1>
        <h2 className="text-gray-600 text-base sm:text-lg font-medium mb-6 sm:mb-8 text-center">
          Sign in to access your leagues
        </h2>

        {inputFields.map((field) => (
          <div className="mb-4" key={field.name}>
            <div 
              className={`flex items-center bg-gray-100 border rounded-xl px-2 py-1 cursor-text ${
                validationErrors[field.name]
                  ? 'border-red-500'
                  : 'border-gray-300 focus-within:border-blue-500'
              }`}
              onClick={() => handleDivClick(field.name)}
            >
              <span className="material-symbols-outlined text-gray-500 mr-2">{field.icon}</span>
              <div className="w-full">
                <label 
                  htmlFor={field.name}
                  className="block text-sm font-semibold text-gray-500 capitalize"
                  onClick={(e) => e.stopPropagation()}
                >
                  {field.name}
                </label>
                <input
                  ref={inputRefs[field.name]}
                  type={field.name === 'password' ? 'password' : 'text'}
                  id={field.name}
                  name={field.name}
                  onChange={handleInputChange}
                  value={credentials[field.name]}
                  placeholder={field.placeholder}
                  className="bg-transparent focus:outline-none w-full text-gray-700 py-1 text-sm sm:text-base"
                  maxLength={64}
                />
              </div>
              {validationErrors[field.name] && (
                <span className="material-symbols-outlined !text-red-600">error</span>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-col items-center justify-between mt-6 gap-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold p-3 rounded-lg shadow-lg text-sm sm:text-md flex justify-center items-center transition-all"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-bold p-3 rounded-lg shadow-lg text-sm sm:text-md flex justify-center items-center transition-all"
          >
            Continue as Guest
          </button>
          <button
            type="button"
            onClick={handleCreateClick}
            className="text-gray-600 hover:text-gray-800 font-semibold transition-all text-sm sm:text-base"
          >
            Need an account?
          </button>
        </div>

        {error && (
          <div className='flex mt-4 text-sm sm:text-base'>
            <span className="material-symbols-outlined !text-red-600">error</span>
            <p className="ml-1 text-red-600">{error}</p>
          </div>
        )}
        {success && <p className="text-green-600 mt-4 text-sm sm:text-base">Login successful!</p>}
      </form>
    </div>
  );
};

function User() {
  return (
    <>
      <Routes>
        <Route path="profile" element={<UserProfile />} />
        <Route path="create" element={<UserCreate />} />
        <Route path="login" element={<UserLogin />} />
      </Routes>
      <Outlet />
    </>
  );
}

export default User;