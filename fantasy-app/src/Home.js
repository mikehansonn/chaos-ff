import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen w-full flex flex-col items-center md:pl-12">
      <h1 className="mt-4 mb-3 text-3xl sm:text-4xl md:text-5xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 px-4">
        Welcome to Chaos Fantasy!
      </h1>
      <p className="text-lg sm:text-xl text-gray-600 text-center mb-6 sm:mb-8 max-w-3xl px-4">
        Your ultimate fantasy sports experience. Create, compete, and conquer!
      </p>

      {/* Quick Navigation - Responsive grid and card layouts */}
      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-6">
        {/* Create League */}
        <div className="flex flex-col items-center p-4 sm:p-6 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg transition-transform hover:scale-105">
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🏆</div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Create a League</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 text-center">
            Start your journey as a commissioner. Customize rules, invite friends, and compete!
          </p>
          <Link to="/league/create" className="w-full max-w-xs">
            <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 sm:py-3 rounded-lg shadow-lg text-sm sm:text-base">
              Get Started
            </button>
          </Link>
        </div>

        {/* Join League */}
        <div className="flex flex-col items-center p-4 sm:p-6 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg transition-transform hover:scale-105">
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🤝</div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Join a League</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 text-center">
            Got an invite? Jump into the action with your team and claim victory!
          </p>
          <Link to="/league/join" className="w-full max-w-xs">
            <button className="w-full bg-gradient-to-r from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700 text-white font-bold py-2 sm:py-3 rounded-lg shadow-lg text-sm sm:text-base">
              Join Now
            </button>
          </Link>
        </div>

        {/* View Leagues */}
        <div className="flex flex-col items-center p-4 sm:p-6 bg-white/80 backdrop-blur-lg rounded-lg shadow-lg transition-transform hover:scale-105 md:col-span-2 lg:col-span-1 md:max-w-md lg:max-w-none mx-auto w-full">
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📅</div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">My Leagues</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 text-center">
            Manage your leagues, check matchups, and track your teams.
          </p>
          <Link to="/league" className="w-full max-w-xs">
            <button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 sm:py-3 rounded-lg shadow-lg text-sm sm:text-base">
              View Leagues
            </button>
          </Link>
        </div>
      </div>

      {/* Authentication Prompt - Responsive spacing and button sizes */}
      {!isLoggedIn && (
        <div className="mt-8 sm:mt-12 p-4 sm:p-6 bg-white/90 backdrop-blur-lg rounded-lg shadow-lg text-center max-w-2xl mx-4">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-700">
            New here or returning?
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            To get started, sign in to your account or create a new one.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link to="/user/login" className="w-full sm:w-auto">
              <button className="w-full sm:w-44 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg text-sm sm:text-base">
                Sign In
              </button>
            </Link>
            <Link to="/user/create" className="w-full sm:w-auto">
              <button className="w-full sm:w-44 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg text-sm sm:text-base">
                Create Account
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Footer - Responsive spacing */}
      <footer className="mt-8 sm:mt-12 text-center text-gray-500 text-xs sm:text-sm pb-4">
        © {new Date().getFullYear()} Chaos Fantasy. All rights reserved.
      </footer>
    </div>
  );
}

export default Home;