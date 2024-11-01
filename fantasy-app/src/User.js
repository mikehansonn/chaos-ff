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
    const leaguePromises = leagueIds.map(leagueId =>
      api.get(`/leagues/${leagueId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    try {
      const leagueResponses = await Promise.all(leaguePromises);
      const leagueData = leagueResponses.map(response => response.data);
      setLeagues(leagueData);
    } catch (error) {
      console.error('Error fetching league data:', error);
      setError('Error fetching league data. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
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
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/user/login');
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!userData) return <p>Loading...</p>;

  return (
    <div className="">
      <div className='h-24'></div>
      <div className='p-4 bg-[#EEEEEE] h-auto w-2/5 mx-auto rounded-2xl'>
        <h1 className="text-[#39393A] text-5xl font-bold mb-8">About Me</h1>
        <div ref={teamsRef} className='border border-[#39393A] border-opacity-30 divide-[#39393A] divide-opacity-30 divide-y divide-solid rounded-xl p-2 flex flex-col space-y-4 mb-8'>
          <h1 className='p-1 text-2xl pb-6'>Basic Info</h1>
          <div className='flex'>
            <p className='p-1 w-60 text-xl opacity-60'>Username: </p>
            <p className='p-1 text-2xl '>{userData.username}</p>
          </div>
          <div className='flex'>
            <p className='p-1 w-60 text-xl opacity-60'>Email:</p>
            <p className='p-1 text-2xl'>{userData.email}</p>
          </div>
          <div className='flex'>
            <p className='p-1 w-60 text-xl opacity-60'>Name:</p>
            <p className='p-1 text-2xl'>{userData.name}</p>
          </div>
        </div>
        <div ref={leaguesRef} className='border border-[#39393A] border-opacity-30 divide-[#39393A] divide-opacity-30 divide-y divide-solid rounded-xl p-2 flex flex-col space-y-4 mb-8'>
          <h1 className='p-1 text-2xl pb-6'>Teams</h1>
          {teams.map(team => (
            <div key={team.id} className='flex'>
              <p className='p-1 w-60 text-xl opacity-60'>Team:</p>
              <p className='p-1 text-2xl'>{team.name}</p>
            </div>
          ))}
        </div>
        <div className='border border-[#39393A] border-opacity-30 divide-[#39393A] divide-opacity-30 divide-y divide-solid rounded-xl flex flex-col mb-8'>
          <h1 className='p-1 text-2xl pb-6 justify-center'>Leagues</h1>
          {leagues.map(league => (
            <Link 
              to={`/league/home?leagueid=${league._id}`} 
              key={league.id} 
              className='flex items-center justify-between p-2 w-full hover:bg-gray-200 cursor-pointer group'
            >
              <div className='flex items-center'>
                <p className='p-0 w-60 text-xl opacity-60'>League:</p>
                <p className='p-0 text-2xl'>
                  {league.name}
                </p>
              </div>
              <span className='text-md opacity-0 group-hover:opacity-100 transition-opacity duration-100'>{'>'}{'>'}</span>
            </Link>
          ))}
        </div>
        <div className='flex justify-between'>
          <button onClick={handleLogout} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline">
            Logout
          </button>
          <button onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function UserCreate() {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setUserData(prevState => ({
      ...prevState,
      [name]: value
    }));
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
    try {
      await api.post('/users/create/', userData);
      setSuccess(true);
      setUserData({
        username: '',
        email: '',
        password: '',
        name: ''
      });

      navigate('/user/login');
    } catch (err) {
      setError('Error creating user. Please try again.');
      console.error('Error creating user:', err);
    }
  };

  const handleLoginClick = () => {
    navigate('/user/login');
  };

  return (
    <div className="w-1/3 mx-auto">
      <div className="h-52"></div>
        <form onSubmit={handleFormSubmit} className="bg-slate-100 shadow-md rounded-xl px-8 pt-6 pb-8 mb-4">
          <h2 className="text-3xl font-bold mb-6 text-center">Create Account</h2>
          <div className="mb-4">
            {['username', 'email', 'password', 'name'].map((field) => (
              <div className="mb-4" key={field}>
                <label htmlFor={field} className="block text-gray-700 text-sm font-bold mb-2 capitalize">{field}</label>
                <input required type={field === 'password' ? 'password' : 'text'} id={field} name={field} onChange={handleInputChange} value={userData[field]} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
              </div>
            ))}
          </div>

          <div className='flex justify-between mt-6'>
            <button type='submit' className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Create Account
            </button>
            <button type='button' onClick={handleLoginClick} className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Sign in
            </button>
          </div>
        </form>
        
        {error && <p className="text-red-600 mt-4">{error}</p>}
        {success && <p className="text-green-600 mt-4">User created successfully!</p>}
      </div>
  );
}

function UserLogin() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsLoggedIn } = useAuth();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setCredentials(prevState => ({
      ...prevState,
      [name]: value
    }));
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);
    
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

  const handleCreateClick = () => {
    navigate('/user/create');
  };

  return (
    <div className="w-1/3 mx-auto">
      <div className="h-52"></div>
        <form onSubmit={handleFormSubmit} className="bg-slate-100 shadow-md rounded-xl px-8 pt-6 pb-8 mb-4">
        <h2 className="text-3xl font-bold mb-6 text-center">Sign in</h2>
          <div className='mb-4'>
            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2 capitalize">Username</label>
            <input required type="text" id="username" name="username" onChange={handleInputChange} value={credentials.username} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
          </div>
          <div className='mb-6'>
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2 capitalize">Password</label>
            <input required type="password" id="password" name="password" onChange={handleInputChange} value={credentials.password} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
          </div>
          <div className='flex justify-between'>
            <button type='submit' className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Login
            </button>
            <button type='button' onClick={handleCreateClick} className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Create Account
            </button>
          </div>
        </form>
        
      {error && <p className="text-red-600 mt-4">{error}</p>}
      {success && <p className="text-green-600 mt-4">Login successful!</p>}
    </div>
  );
}

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