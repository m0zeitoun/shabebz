import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const LANES = 9;
const CAR_CHANCE = 0.667;
const MIN_LANES_BEFORE_CASHOUT = 1;
const MULTIPLIERS = [1.15, 1.5, 2.5, 3.3, 5, 7.5, 11, 17, 25];

type LaneState = 'hidden' | 'safe' | 'car';
type GameState = 'idle' | 'playing' | 'won' | 'dead';

export default function ChickenRoad() {
  const { profile, refreshProfile } = useAuth();
  const [bet, setBet] = useState('');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [position, setPosition] = useState(-1);
  const [road, setRoad] = useState<boolean[]>([]);
  const [laneStates, setLaneStates] = useState<LaneState[]>(Array(LANES).fill('hidden'));
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const balance = profile?.balance ?? 0;
  const betAmount = parseFloat(bet || '0');
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const generateRoad = (): boolean[] => {
    const r = Array.from({ length: LANES }, () => Math.random() < CAR_CHANCE);
    if (!r.some(Boolean)) r[Math.floor(Math.random() * LANES)] = true;
    return r;
  };

  const startGame = async () => {
    if (!profile) return;
    const amount = parseFloat(bet);
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid bet amount');
    if (amount > balance) return setError('Insufficient balance');
    setError('');

    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (!fresh) return;
    await supabase.from('users').update({ balance: fresh.balance - amount }).eq('id', profile.id);
    await refreshProfile();

    setRoad(generateRoad());
    setPosition(-1);
    setLaneStates(Array(LANES).fill('hidden'));
    setCashedAt(null);
    setGameState('playing');
  };

  const cross = async () => {
    if (gameState !== 'playing' || isAnimating) return;
    const nextPos = position + 1;
    if (nextPos >= LANES) return;

    setIsAnimating(true);
    await new Promise(r => setTimeout(r, 450));

    const hasCar = road[nextPos];
    setPosition(nextPos);
    setLaneStates(prev => {
      const next = [...prev];
      next[nextPos] = hasCar ? 'car' : 'safe';
      return next;
    });

    if (hasCar) {
      setGameState('dead');
      setIsAnimating(false);
      return;
    }

    if (nextPos === LANES - 1) {
      await docashOut(nextPos);
      return;
    }

    setIsAnimating(false);
  };

  const docashOut = async (pos: number) => {
    if (!profile) return;
    const amount = parseFloat(bet);
    const mult = MULTIPLIERS[pos];
    const winnings = Math.floor(amount * mult);

    setCashedAt(mult);
    setGameState('won');

    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (fresh) {
      await supabase.from('users').update({ balance: fresh.balance + winnings }).eq('id', profile.id);
    }
    await refreshProfile();
    setIsAnimating(false);
  };

  const cashOut = () => {
    if (gameState !== 'playing' || position < 0 || isAnimating) return;
    docashOut(position);
  };

  const reset = () => {
    setGameState('idle');
    setPosition(-1);
    setRoad([]);
    setLaneStates(Array(LANES).fill('hidden'));
    setCashedAt(null);
    setIsAnimating(false);
  };

  const isDead = gameState === 'dead';
  const isWon = gameState === 'won';
  const isPlaying = gameState === 'playing';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Main card */}
      <div
        className={`card overflow-hidden transition-colors duration-500 ${
          isDead ? 'border-loss/30' : isWon ? 'border-gain/30' : ''
        }`}
      >
        {/* Result banner */}
        {(isDead || isWon) && (
          <div
            className={`px-6 py-3 text-center font-display font-bold text-sm tracking-widest ${
              isDead ? 'bg-loss/10 text-loss' : 'bg-gain/10 text-gain'
            }`}
          >
            {isDead ? '💥 GOT HIT — LOST ' + fmt(betAmount) : `✅ CASHED OUT AT ${cashedAt?.toFixed(2)}× — WON ${fmt(Math.floor(betAmount * (cashedAt ?? 1)))}`}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Road */}
          <div className="relative">
            {/* Road label */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/30 text-xs font-mono uppercase tracking-widest">Road</span>
              {isPlaying && position >= 0 && (
                <span className="text-gold font-mono text-xs font-semibold">
                  {MULTIPLIERS[position].toFixed(2)}× · {fmt(Math.floor(betAmount * MULTIPLIERS[position]))}
                </span>
              )}
            </div>

            {/* Scrollable road */}
            <div className="flex items-end gap-2 overflow-x-auto pb-1">
              {/* Chicken */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div
                  className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-lg ${
                    isDead
                      ? 'border-loss/60 grayscale opacity-50'
                      : isWon
                      ? 'border-gain/60 shadow-gain/20'
                      : isAnimating
                      ? 'border-gold scale-110 shadow-gold/30'
                      : 'border-gold/40'
                  }`}
                >
                  <img
                    src="/chicken.jpg"
                    alt="you"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <span className="text-white/25 text-xs">you</span>
              </div>

              {/* Arrow */}
              <div
                className={`flex-shrink-0 text-white/20 text-base pb-5 transition-all duration-300 ${
                  isAnimating ? 'text-gold translate-x-1' : ''
                }`}
              >
                →
              </div>

              {/* Lanes */}
              {Array.from({ length: LANES }, (_, i) => {
                const state = laneStates[i];
                const mult = MULTIPLIERS[i];
                const isCurrent = position === i;
                const isNext = position + 1 === i && isPlaying;

                return (
                  <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 border ${
                        state === 'car'
                          ? 'bg-loss/15 border-loss/40 scale-110'
                          : state === 'safe'
                          ? 'bg-gain/10 border-gain/25'
                          : isCurrent
                          ? 'bg-gold/15 border-gold/40 scale-105'
                          : isNext && !isAnimating
                          ? 'bg-white/5 border-white/20 shadow-sm'
                          : 'bg-white/2 border-white/6'
                      }`}
                    >
                      {state === 'car' ? '🚗' : state === 'safe' ? '✅' : isNext ? '❓' : '🌫️'}
                    </div>
                    <span className={`text-xs font-mono font-semibold transition-colors ${
                      isCurrent ? 'text-gold' : state === 'safe' ? 'text-gain/50' : isNext ? 'text-white/50' : 'text-white/20'
                    }`}>
                      {mult}×
                    </span>
                  </div>
                );
              })}

              {/* Trophy */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border transition-all ${
                    isWon
                      ? 'bg-gold/20 border-gold/50 scale-110'
                      : 'bg-white/2 border-white/6'
                  }`}
                >
                  🏆
                </div>
                <span className="text-white/20 text-xs font-mono">25×</span>
              </div>
            </div>
          </div>

          {/* Controls */}
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
              {error && <p className="text-loss text-sm text-center">{error}</p>}
              <button
                onClick={startGame}
                disabled={!bet || betAmount <= 0}
                className="btn-gold w-full py-4 text-lg font-bold"
              >
                🐔 Start Yaghi's Road!
              </button>
              <p className="text-white/30 text-xs text-center">Balance: {fmt(balance)}</p>
            </div>
          )}

          {isPlaying && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={cross}
                  disabled={isAnimating}
                  className={`flex-1 py-4 rounded-2xl font-display font-bold text-lg transition-all ${
                    isAnimating
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'btn-gold'
                  }`}
                >
                  {isAnimating ? '🏃 Crossing...' : position === -1 ? '🐔 Cross!' : '→ Next Lane'}
                </button>
                {position >= 0 && !isAnimating && (
                  position >= MIN_LANES_BEFORE_CASHOUT ? (
                    <button
                      onClick={cashOut}
                      className="flex-1 py-4 rounded-2xl font-bold text-sm bg-gain/10 border border-gain/20 text-gain hover:bg-gain/20 transition-all"
                    >
                      Cash Out
                      <br />
                      <span className="font-mono text-base">
                        {fmt(Math.floor(betAmount * MULTIPLIERS[position]))}
                      </span>
                    </button>
                  ) : (
                    <div className="flex-1 py-4 rounded-2xl text-center bg-white/3 border border-white/8 text-white/25 text-sm">
                      Cash Out unlocks
                      <br />
                      <span className="font-mono text-xs">after lane {MIN_LANES_BEFORE_CASHOUT}</span>
                    </div>
                  )
                )}
              </div>
              <p className="text-white/30 text-xs text-center">Balance: {fmt(profile?.balance ?? 0)}</p>
            </div>
          )}

          {(isDead || isWon) && (
            <div className="space-y-3">
              <button onClick={reset} className="btn-primary w-full py-3 font-bold">
                Play Again
              </button>
              <p className="text-white/30 text-xs text-center">Balance: {fmt(profile?.balance ?? 0)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Multiplier table */}
      <div className="grid grid-cols-4 gap-2">
        {MULTIPLIERS.map((m, i) => (
          <div
            key={i}
            className={`card p-3 text-center transition-all ${
              position === i && isPlaying ? 'border-gold/40 bg-gold/5' : ''
            }`}
          >
            <p className="text-white/30 text-xs">Lane {i + 1}</p>
            <p className="font-mono font-bold text-gold">{m}×</p>
            <p className="text-white/25 text-xs font-mono">
              {betAmount > 0 ? fmt(Math.floor(betAmount * m)) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Risk info */}
      <div className="card p-4 flex items-center justify-between text-sm">
        <span className="text-white/30">Car chance per lane</span>
        <span className="font-mono text-white/60">~33%</span>
      </div>
    </div>
  );
}
