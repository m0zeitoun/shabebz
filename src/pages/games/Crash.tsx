import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TrendingUp, TrendingDown } from 'lucide-react';

type GameState = 'idle' | 'running' | 'cashed_out' | 'crashed';

export default function Crash() {
  const { profile, refreshProfile } = useAuth();
  const [bet, setBet] = useState('');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [multiplier, setMultiplier] = useState(1.0);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<GameState>('idle');
  const multiplierRef = useRef(1.0);

  const balance = profile?.balance ?? 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // Biased crash point: likely to crash low, but occasionally goes high
  const generateCrashPoint = () => {
    const r = Math.random();
    return parseFloat(Math.max(1.1, 1 / (1 - r * 0.95)).toFixed(2));
  };

  const startGame = async () => {
    if (!profile) return;
    const amount = parseFloat(bet);
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid bet amount');
    if (amount > balance) return setError('Insufficient balance');

    setError('');

    // Fetch fresh balance and deduct bet upfront
    const { data: fresh } = await supabase
      .from('users')
      .select('balance')
      .eq('id', profile.id)
      .single();
    if (!fresh) return;

    await supabase.from('users').update({ balance: fresh.balance - amount }).eq('id', profile.id);
    await refreshProfile();

    const crashPoint = generateCrashPoint();
    multiplierRef.current = 1.0;
    setMultiplier(1.0);
    setCashedAt(null);
    stateRef.current = 'running';
    setGameState('running');

    intervalRef.current = setInterval(() => {
      const next = parseFloat((multiplierRef.current + 0.01).toFixed(2));
      multiplierRef.current = next;
      setMultiplier(next);

      if (next >= crashPoint) {
        clearInterval(intervalRef.current!);
        if (stateRef.current === 'running') {
          stateRef.current = 'crashed';
          setGameState('crashed');
        }
      }
    }, 80);
  };

  const cashOut = async () => {
    if (stateRef.current !== 'running' || !profile) return;
    clearInterval(intervalRef.current!);

    const currentMultiplier = multiplierRef.current;
    const amount = parseFloat(bet);
    const winnings = Math.floor(amount * currentMultiplier);

    stateRef.current = 'cashed_out';
    setCashedAt(currentMultiplier);
    setGameState('cashed_out');

    const { data: fresh } = await supabase
      .from('users')
      .select('balance')
      .eq('id', profile.id)
      .single();
    if (fresh) {
      await supabase.from('users').update({ balance: fresh.balance + winnings }).eq('id', profile.id);
    }
    await refreshProfile();
  };

  const reset = () => {
    stateRef.current = 'idle';
    setGameState('idle');
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setCashedAt(null);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isRunning = gameState === 'running';
  const isCrashed = gameState === 'crashed';
  const isCashedOut = gameState === 'cashed_out';

  const multiplierColor = isCrashed
    ? 'text-loss'
    : isCashedOut
    ? 'text-gain'
    : multiplier < 2
    ? 'text-gain'
    : multiplier < 5
    ? 'text-gold'
    : 'text-loss';

  const betAmount = parseFloat(bet || '0');

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div
        className={`card p-8 text-center space-y-5 transition-colors duration-500 ${
          isCrashed ? 'border-loss/20 bg-loss/5' : isCashedOut ? 'border-gain/20 bg-gain/5' : ''
        }`}
      >
        {/* Multiplier */}
        <div>
          <div
            className={`font-display font-bold transition-all duration-100 ${
              isRunning ? 'text-7xl' : 'text-6xl'
            } ${multiplierColor}`}
          >
            {multiplier.toFixed(2)}×
          </div>

          {isCrashed && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <TrendingDown className="w-5 h-5 text-loss" />
              <span className="text-loss font-bold text-lg">CRASHED!</span>
            </div>
          )}

          {isCashedOut && cashedAt !== null && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <TrendingUp className="w-5 h-5 text-gain" />
              <span className="text-gain font-bold text-lg">
                Cashed out at {cashedAt.toFixed(2)}× · +{fmt(Math.floor(betAmount * cashedAt))}
              </span>
            </div>
          )}

          {gameState === 'idle' && (
            <p className="text-white/30 text-sm mt-2">
              Bet and hit start. Cash out before it crashes!
            </p>
          )}
        </div>

        {/* Cash Out — only while running */}
        {isRunning && (
          <button onClick={cashOut} className="btn-gold w-full py-5 text-xl font-bold">
            Cash Out · {fmt(Math.floor(betAmount * multiplier))}
          </button>
        )}

        {/* Bet input — idle only */}
        {gameState === 'idle' && (
          <div className="space-y-3">
            <div>
              <input
                type="number"
                value={bet}
                onChange={e => setBet(e.target.value)}
                placeholder="Bet amount"
                min={1}
                max={balance}
                className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gain/40 text-center font-mono text-lg"
              />
              <div className="flex gap-2 mt-2">
                {[0.25, 0.5, 0.75, 1].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setBet(Math.floor(balance * pct).toString())}
                    className="flex-1 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
                  >
                    {pct === 1 ? 'Max' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-loss text-sm">{error}</p>}
            <button onClick={startGame} disabled={!bet} className="btn-primary w-full py-4 text-lg">
              Start Game
            </button>
          </div>
        )}

        {/* Play Again — after round ends */}
        {(isCrashed || isCashedOut) && (
          <button onClick={reset} className="btn-primary w-full py-3">
            Play Again
          </button>
        )}

        <p className="text-white/30 text-xs">Balance: {fmt(profile?.balance ?? 0)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Min crash', value: '1.10×' },
          { label: 'Max win', value: '∞' },
          { label: 'Tick speed', value: '80ms' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-white/30 text-xs mb-1">{label}</p>
            <p className="font-mono text-white text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
