import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, TrendingUp, Trophy, Shuffle, AlertCircle } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) { setError(error); return; }
      } else {
        if (username.length < 2) { setError('Username must be at least 2 characters'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        const { error } = await signUp(email, password, username);
        if (error) { setError(error); return; }
      }
      navigate('/market');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-gain/5 via-transparent to-cyan-500/5" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gain/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gain/10 border border-gain/30 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-gain" />
            </div>
            <span className="font-display font-bold text-2xl gradient-text">SHABEBZ</span>
          </div>
          <p className="text-white/30 text-sm">The friend group stock market</p>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="font-display font-bold text-5xl text-white leading-tight mb-4">
              Play the<br />
              <span className="gradient-text">market.</span><br />
              Beat your<br />friends.
            </h1>
            <p className="text-white/50 text-lg leading-relaxed">
              Start with $1,000. Buy stocks. Watch your money grow (or cry). Compete for the top spot on the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, label: 'Live Prices', desc: 'Real-time updates' },
              { icon: Trophy, label: 'Leaderboard', desc: 'Compete & win' },
              { icon: Shuffle, label: 'Trade Fast', desc: 'Buy & sell instantly' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="card p-4">
                <Icon className="w-5 h-5 text-gain mb-2" />
                <p className="font-display font-semibold text-white text-sm">{label}</p>
                <p className="text-white/40 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/20 text-xs">
          © 2025 Shabebz. For entertainment purposes only.
        </p>
      </div>

      {/* Right - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 bg-gain/10 border border-gain/30 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-gain" />
            </div>
            <span className="font-display font-bold text-xl gradient-text">SHABEBZ</span>
          </div>

          <div className="card p-8 animate-slide-up">
            {/* Tabs */}
            <div className="flex bg-navy-900 rounded-xl p-1 mb-6">
              {(['login', 'signup'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setMode(tab); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold transition-all duration-200 capitalize ${mode === tab ? 'bg-gain text-navy-900' : 'text-white/50 hover:text-white'}`}
                >
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label block mb-1.5">Username</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="your_username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              )}

              <div>
                <label className="label block mb-1.5">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="label block mb-1.5">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-loss/10 border border-loss/20 rounded-xl px-4 py-2.5 text-loss text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base mt-2"
              >
                {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account & Start Trading'}
              </button>
            </form>

            {mode === 'signup' && (
              <p className="text-white/30 text-xs text-center mt-4">
                You'll start with <span className="text-gain font-mono">$1,000.00</span> to invest
              </p>
            )}
          </div>

          <p className="text-white/20 text-xs text-center mt-4">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-gain hover:underline">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
