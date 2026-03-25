import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp, Trophy, Briefcase,
  Settings, LogOut, ChevronDown, Zap
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const formatBalance = (bal: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(bal);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-navy-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <NavLink to="/market" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gain/10 border border-gain/30 rounded-lg flex items-center justify-center group-hover:bg-gain/20 transition-colors">
              <Zap className="w-4 h-4 text-gain" />
            </div>
            <span className="font-display font-bold text-lg gradient-text">SHABEBZ</span>
          </NavLink>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/market" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <TrendingUp className="w-4 h-4" /> Market
            </NavLink>
            <NavLink to="/portfolio" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Briefcase className="w-4 h-4" /> Portfolio
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Trophy className="w-4 h-4" /> Leaderboard
            </NavLink>
            {profile?.is_admin && (
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Settings className="w-4 h-4" /> Admin
              </NavLink>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-white/40">Balance</p>
              <p className="text-sm font-mono font-semibold text-gain">{formatBalance(profile?.balance ?? 0)}</p>
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gain to-cyan-400 flex items-center justify-center">
                  <span className="text-navy-900 text-xs font-bold">
                    {profile?.username?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-white/80">{profile?.username}</span>
                <ChevronDown className="w-3 h-3 text-white/40" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 card border border-white/10 p-1 shadow-xl">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-loss hover:bg-loss/5 transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <div className="w-5 h-0.5 bg-white/60 mb-1" />
              <div className="w-5 h-0.5 bg-white/60 mb-1" />
              <div className="w-5 h-0.5 bg-white/60" />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-3 pt-2 border-t border-white/5 flex flex-col gap-1 animate-fade-in">
            <NavLink to="/market" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <TrendingUp className="w-4 h-4" /> Market
            </NavLink>
            <NavLink to="/portfolio" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Briefcase className="w-4 h-4" /> Portfolio
            </NavLink>
            <NavLink to="/leaderboard" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Trophy className="w-4 h-4" /> Leaderboard
            </NavLink>
            {profile?.is_admin && (
              <NavLink to="/admin" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Settings className="w-4 h-4" /> Admin
              </NavLink>
            )}
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between px-3">
              <span className="text-white/40 text-xs">Balance</span>
              <span className="text-gain font-mono font-semibold text-sm">{formatBalance(profile?.balance ?? 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {(menuOpen) && (
        <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />
      )}
    </nav>
  );
}
