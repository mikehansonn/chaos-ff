import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import User from './User';
import League from './League';
import Team from './Team';
import Navbar from './Navbar';
import Home from './Home'
import { AuthProvider } from './AuthContext';

function App() {
  return (
    <AuthProvider>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@40,400,0,0" />
      <Router>
        <div className="App min-h-screen bg-[#f0f0f0] relative overflow-hidden flex">
          <div className="absolute inset-0 bg-grid-slate-200/[0.2] bg-[size:20px_20px] z-0" />
          <Navbar />
          <div className="flex-grow relative z-10 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/user/*" element={<User />} />
            <Route path="/league/*" element={<League />} />
            <Route path="/team/*" element={<Team />} />
          </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;