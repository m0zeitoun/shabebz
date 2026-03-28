import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const GRID_SIZE = 25;
const HOUSE_EDGE = 0.97;
const MINE_OPTIONS = [1, 2, 3, 5, 10, 15, 20];

type TileState = 'hidden' | 'gem' | 'mine';
type GameState = 'idle' | 'playing' | 'won' | 'dead';

// Combinatorics helper
const comb = (n: number, k: number): number => {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
};

// Multiplier after revealing `revealed` gems with `mines` mines in 25 tiles
const calcMultiplier = (mines: number, revealed: number): number => {
  if (revealed === 0) return 1;
  const mult = HOUSE_EDGE * (comb(GRID_SIZE, revealed) / comb(GRID_SIZE - mines, revealed));
  return Math.max(1.01, parseFloat(mult.toFixed(2)));
};

// Generate mine positions
const generateMines = (count: number): Set<number> => {
  const positions = new Set<number>();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return positions;
};

export default function Mines() {
  const { profile, refreshProfile } = useAuth();
  const [bet, setBet] = useState('');
  const [mineCount, setMineCount] = useState(3);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [tiles, setTiles] = useState<TileState[]>(Array(GRID_SIZE).fill('hidden'));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState(0);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const balance = profile?.balance ?? 0;
  const betAmount = parseFloat(bet || '0');
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const currentMultiplier = calcMultiplier(mineCount, revealed);
  const currentWin = Math.floor(betAmount * currentMultiplier);
  const isPlaying = gameState === 'playing';

  const startGame = async () => {
    if (!profile) return;
    const amount = parseFloat(bet);
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid bet');
    if (amount > balance) return setError('Insufficient balance');
    setError('');

    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (!fresh) return;
    await supabase.from('users').update({ balance: fresh.balance - amount }).eq('id', profile.id);
    await refreshProfile();

    setMinePositions(generateMines(mineCount));
    setTiles(Array(GRID_SIZE).fill('hidden'));
    setRevealed(0);
    setCashedAt(null);
    setGameState('playing');
  };

  const revealTile = async (idx: number) => {
    if (!isPlaying || tiles[idx] !== 'hidden') return;

    const isMine = minePositions.has(idx);

    if (isMine) {
      // Reveal all mines
      setTiles(prev =>
        prev.map((t, i) => (minePositions.has(i) ? 'mine' : t === 'hidden' ? 'hidden' : t))
      );
      setGameState('dead');
      return;
    }

    const newRevealed = revealed + 1;
    setRevealed(newRevealed);
    setTiles(prev => prev.map((t, i) => (i === idx ? 'gem' : t)));

    // Auto cash out if all gems revealed
    const totalGems = GRID_SIZE - mineCount;
    if (newRevealed === totalGems) {
      await doCashOut(newRevealed);
    }
  };

  const doCashOut = async (revealedCount?: number) => {
    if (!profile) return;
    const count = revealedCount ?? revealed;
    if (count === 0) return;

    const mult = calcMultiplier(mineCount, count);
    const winnings = Math.floor(betAmount * mult);

    setCashedAt(mult);
    setGameState('won');

    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (fresh) {
      await supabase.from('users').update({ balance: fresh.balance + winnings }).eq('id', profile.id);
    }
    await refreshProfile();
  };

  const reset = () => {
    setGameState('idle');
    setTiles(Array(GRID_SIZE).fill('hidden'));
    setMinePositions(new Set());
    setRevealed(0);
    setCashedAt(null);
  };

  const isDead = gameState === 'dead';
  const isWon = gameState === 'won';

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div
        className={`card overflow-hidden transition-colors duration-500 ${
          isDead ? 'border-loss/30' : isWon ? 'border-gain/30' : ''
        }`}
      >
        {/* Result banner */}
        {(isDead || isWon) && (
          <div className={`px-6 py-2.5 text-center font-display font-bold text-sm tracking-widest flex items-center justify-center gap-2 ${isDead ? 'bg-loss/10 text-loss' : 'bg-gain/10 text-gain'}`}>
            {isDead
              ? <><img src="/mine-bomb.png" alt="mine" className="w-5 h-5 object-contain" /> HIT A MINE — LOST {fmt(betAmount)}</>
              : <><img src="/gem-face.png" alt="hallel" className="w-6 h-6 object-contain rounded-full" /> CASHED OUT {cashedAt?.toFixed(2)}× — WON {fmt(Math.floor(betAmount * (cashedAt ?? 1)))}</>
            }
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Live multiplier display */}
          {isPlaying && (
            <div className="flex items-center justify-between bg-navy-900 rounded-xl px-4 py-3">
              <div>
                <p className="text-white/30 text-xs">Current multiplier</p>
                <p className="font-display font-bold text-2xl text-gold">{currentMultiplier.toFixed(2)}×</p>
              </div>
              <div className="text-right">
                <p className="text-white/30 text-xs">Profit if cashed out</p>
                <p className="font-mono font-bold text-gain text-lg">{fmt(currentWin)}</p>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-5 gap-2">
            {tiles.map((state, idx) => {
              const isHidden = state === 'hidden';
              const isGem = state === 'gem';
              const isMine = state === 'mine';

              return (
                <button
                  key={idx}
                  onClick={() => revealTile(idx)}
                  disabled={!isPlaying || !isHidden}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-150 border ${
                    isMine
                      ? 'bg-loss/20 border-loss/40 scale-95'
                      : isGem
                      ? 'bg-gain/15 border-gain/30'
                      : isPlaying
                      ? 'bg-white/4 border-white/10 hover:bg-blue-500/15 hover:border-blue-400/30 hover:scale-105 cursor-pointer active:scale-95'
                      : 'bg-white/3 border-white/6 cursor-default'
                  }`}
                >
                  {isMine ? (
                    <img src="/mine-bomb.png" alt="mine" className="w-7 h-7 object-contain" />
                  ) : isGem ? (
                    <img src="/gem-face.png" alt="gem" className="w-10 h-10 object-contain rounded-full" />
                  ) : isPlaying ? (
                    <div className="w-2 h-2 rounded-full bg-white/15" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          {gameState === 'idle' && (
            <div className="space-y-3">
              {/* Mine count */}
              <div>
                <p className="text-white/40 text-xs mb-2">Number of mines</p>
                <div className="flex gap-2 flex-wrap">
                  {MINE_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setMineCount(n)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                        mineCount === n
                          ? 'bg-loss/15 border-loss/40 text-loss'
                          : 'bg-white/4 border-white/8 text-white/40 hover:bg-white/8'
                      }`}
                    >
                      {n} 💣
                    </button>
                  ))}
                </div>
              </div>

              {/* Potential wins preview */}
              <div className="bg-navy-900 rounded-xl p-3">
                <p className="text-white/30 text-xs mb-2">Potential multipliers ({mineCount} bombs)</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 5].map(r => (
                    <div key={r} className="text-center">
                      <p className="text-white/20 text-xs">{r} Hallel{r > 1 ? 's' : ''}</p>
                      <p className="font-mono text-gold text-xs font-semibold">{calcMultiplier(mineCount, r).toFixed(2)}×</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bet */}
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
                className="btn-primary w-full py-4 text-lg font-bold"
              >
                Start Game
              </button>
            </div>
          )}

          {/* Playing controls */}
          {isPlaying && (
            <div className="space-y-2">
              <button
                onClick={() => doCashOut()}
                disabled={revealed === 0}
                className={`w-full py-3 rounded-2xl font-bold transition-all ${
                  revealed === 0
                    ? 'bg-white/3 border border-white/8 text-white/25 cursor-not-allowed'
                    : 'btn-gold'
                }`}
              >
                {revealed === 0 ? 'Reveal a Hallel to cash out' : `Cash Out · ${fmt(currentWin)}`}
              </button>
              <div className="flex justify-between text-xs text-white/30 px-1">
                <span>{revealed} Hallel{revealed !== 1 ? 's' : ''} found</span>
                <span>{mineCount} mines hidden</span>
              </div>
            </div>
          )}

          {(isDead || isWon) && (
            <button onClick={reset} className="btn-primary w-full py-3 font-bold">
              Play Again
            </button>
          )}

          <p className="text-white/30 text-xs text-center">Balance: {fmt(profile?.balance ?? 0)}</p>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Grid', value: '5 × 5' },
          { label: 'Min mines', value: '1 💣' },
          { label: 'House edge', value: '3%' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3">
            <p className="text-white/30 text-xs mb-1">{label}</p>
            <p className="font-mono text-white/70 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
