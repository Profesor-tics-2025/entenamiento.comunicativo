import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Train from './pages/Train';
import Report from './pages/Report';
import Progress from './pages/Progress';
import Exercises from './pages/Exercises';
import Profile from './pages/Profile';
import './App.css';

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <Navbar />
      {children}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout><Dashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/train" element={
            <ProtectedRoute>
              <Train />
            </ProtectedRoute>
          } />
          <Route path="/report/:sessionId" element={
            <ProtectedRoute>
              <AppLayout><Report /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/progress" element={
            <ProtectedRoute>
              <AppLayout><Progress /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/exercises" element={
            <ProtectedRoute>
              <AppLayout><Exercises /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <AppLayout><Profile /></AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
