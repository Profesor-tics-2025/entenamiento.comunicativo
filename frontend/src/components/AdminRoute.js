import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/" replace />;

  if (user.role !== 'admin') return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4">
      <ShieldAlert className="w-12 h-12 text-[#EF4444]" />
      <h2 className="font-heading font-semibold text-[#F1F5F9] text-xl">Acceso restringido</h2>
      <p className="text-[#94A3B8] text-sm">Solo los administradores pueden acceder a esta sección.</p>
      <Navigate to="/dashboard" replace />
    </div>
  );

  return children;
}
