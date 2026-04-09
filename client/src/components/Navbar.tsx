import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Radio, BookOpen, TrendingUp, User, LogOut
} from 'lucide-react';

const NAV = [
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
  if (!user) return null;

  return (
    <nav className="glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-semibold text-sm hidden sm:block">
            Entrenamiento<span className="text-[#06B6D4]"> Comunicativo</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                location.pathname === path
                  ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="level-badge">Nv. {user.current_level}</span>
          <button onClick={() => { logout(); navigate('/'); }}
            className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/5 transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
