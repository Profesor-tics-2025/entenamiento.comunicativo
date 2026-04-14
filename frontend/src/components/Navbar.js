import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Dumbbell, TrendingUp, BookOpen,
  User, LogOut, Menu, X, Radio, Shield
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { path: '/train', label: 'Entrenar', icon: Radio },
  { path: '/exercises', label: 'Ejercicios', icon: BookOpen },
  { path: '/progress', label: 'Progreso', icon: TrendingUp },
  { path: '/profile', label: 'Perfil', icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glass sticky top-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-semibold text-[#F1F5F9] text-sm tracking-tight hidden sm:block">
              Entrenamiento<span className="text-[#06B6D4]"> Comunicativo</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  location.pathname === path
                    ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
            {user.role === 'admin' && (
              <Link to="/admin" data-testid="nav-admin"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  location.pathname === '/admin'
                    ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'text-[#94A3B8] hover:text-[#F59E0B] hover:bg-white/5'
                }`}>
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            )}
          </div>

          {/* User + Logout */}
          <div className="hidden md:flex items-center gap-3">
            <span className="level-badge">Nv. {user.current_level}</span>
            <span className="text-[#94A3B8] text-sm truncate max-w-[120px]">{user.name}</span>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/5 transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-[#94A3B8]"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0A0E1A] px-4 py-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                location.pathname === path
                  ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                  : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          {user.role === 'admin' && (
            <Link to="/admin" onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                location.pathname === '/admin' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'text-[#94A3B8] hover:bg-white/5 hover:text-[#F59E0B]'
              }`}>
              <Shield className="w-4 h-4" /> Admin
            </Link>
          )}
          <div className="border-t border-white/5 pt-2 mt-2 flex items-center justify-between">
            <span className="text-[#94A3B8] text-sm">{user.name}</span>
            <button onClick={handleLogout} className="text-[#EF4444] text-sm flex items-center gap-1">
              <LogOut className="w-3 h-3" /> Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
