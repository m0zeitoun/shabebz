import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const ROWS = 8;
const TILES = 4;

type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'won' | 'dead';

interface RowData {
  tiles: boolean[]; // true = safe
  picked: number | null;
}

const DIFFICULTY = {
  easy: {
    bad: 1,
    label: 'Easy',
    color: 'text-gain',
    border: 'border-gain/40',
    bg: 'bg-gain/15',
    multipliers: [1.25, 1.60, 2.10, 2.80, 3.70, 5.00, 6.80, 9.00],
  },
  medium: {
    bad: 2,
    label: 'Medium',
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/15',
    multipliers: [1.80, 3.00, 5.00, 8.00, 13, 20, 30, 50],
  },
  hard: {
    bad: 3,
    label: 'Hard',
    color: 'text-loss',
    border: 'border-loss/40',
    bg: 'bg-loss/15',
    multipliers: [3.00, 8.00, 20, 50, 120, 300, 700, 1500],
  },
};

export default function BlueBalls() {
  const { profile, refreshProfile } = useAuth();
  const [bet, setBet] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [tower, setTower] = useState<RowData[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  const balance = profile?.balance ?? 0;
  const betAmount = parseFloat(bet || '0');
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const config = DIFFICULTY[difficulty];

  const generateTower = (diff: Difficulty): RowData[] => {
    const { bad } = DIFFICULTY[diff];
    return Array.from({ length: ROWS }, () => {
      const tiles = Array(TILES).fill(false);
      const indices = [...Array(TILES).keys()].sort(() => Math.random() - 0.5);
      indices.slice(0, TILES - bad).forEach(i => { tiles[i] = true; });
      return { tiles, picked: null };
    });
  };

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

    setTower(generateTower(difficulty));
    setCurrentRow(0);
    setCashedAt(null);
    setGameState('playing');
  };

  const pickTile = async (tileIdx: number) => {
    if (gameState !== 'playing' || tower[currentRow]?.picked !== null) return;

    const isSafe = tower[currentRow].tiles[tileIdx];

    setTower(prev =>
      prev.map((r, i) => (i === currentRow ? { ...r, picked: tileIdx } : r))
    );

    if (!isSafe) {
      setGameState('dead');
      return;
    }

    if (currentRow === ROWS - 1) {
      await doCashOut(currentRow);
      return;
    }

    setCurrentRow(prev => prev + 1);
  };

  const doCashOut = async (row: number) => {
    if (!profile) return;
    const mult = DIFFICULTY[difficulty].multipliers[row];
    const winnings = Math.floor(betAmount * mult);

    setCashedAt(mult);
    setGameState('won');

    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (fresh) {
      await supabase.from('users').update({ balance: fresh.balance + winnings }).eq('id', profile.id);
    }
    await refreshProfile();
  };

  const cashOut = () => {
    if (gameState !== 'playing' || currentRow === 0) return;
    doCashOut(currentRow - 1);
  };

  const reset = () => {
    setGameState('idle');
    setTower([]);
    setCurrentRow(0);
    setCashedAt(null);
  };

  const isDead = gameState === 'dead';
  const isWon = gameState === 'won';
  const isPlaying = gameState === 'playing';
  const canCashOut = isPlaying && currentRow > 0;

  // Render top to bottom (row 7 at top, row 0 at bottom)
  const displayOrder = [...Array(ROWS).keys()].reverse();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div
        className={`card overflow-hidden transition-colors duration-500 ${
          isDead ? 'border-loss/30' : isWon ? 'border-gain/30' : ''
        }`}
      >
        {/* Result banner */}
        {(isDead || isWon) && (
          <div
            className={`px-6 py-2.5 text-center font-display font-bold text-sm tracking-widest ${
              isDead ? 'bg-loss/10 text-loss' : 'bg-gain/10 text-gain'
            }`}
          >
            {isDead
              ? `💥 BUSTED — LOST ${fmt(betAmount)}`
              : `<img src="/egg.png" alt="egg" className="w-6 h-6 object-contain" /> CASHED OUT ${cashedAt?.toFixed(2)}× — WON ${fmt(Math.floor(betAmount * (cashedAt ?? 1)))}`}
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Difficulty picker — idle only */}
          {gameState === 'idle' && (
            <div className="flex gap-2">
              {(Object.entries(DIFFICULTY) as [Difficulty, typeof DIFFICULTY['easy']][]).map(
                ([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      difficulty === key
                        ? `${val.bg} ${val.border} ${val.color}`
                        : 'bg-white/3 border-white/8 text-white/35 hover:bg-white/6'
                    }`}
                  >
                    {val.label}
                    <div className="text-xs font-normal opacity-60 mt-0.5">
                      {val.bad} bad tile{val.bad > 1 ? 's' : ''}
                    </div>
                  </button>
                )
              )}
            </div>
          )}

          {/* Tower */}
          {(isPlaying || isDead || isWon) && (
            <div className="space-y-1">
              {displayOrder.map(rowIdx => {
                const isActive = rowIdx === currentRow && isPlaying;
                const isCompleted = rowIdx < currentRow || (isDead && rowIdx < currentRow) || (isWon);
                const rowData = tower[rowIdx];
                const multiplier = config.multipliers[rowIdx];
                const isDeadRow = isDead && rowIdx === currentRow;

                return (
                  <div
                    key={rowIdx}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-500/8 border border-blue-400/25'
                        : isDeadRow
                        ? 'bg-loss/8 border border-loss/20'
                        : isCompleted
                        ? 'bg-gain/4 border border-transparent'
                        : 'border border-transparent'
                    }`}
                  >
                    {/* Multiplier */}
                    <span
                      className={`w-11 text-right text-xs font-mono flex-shrink-0 font-semibold ${
                        isActive
                          ? 'text-blue-300'
                          : isDeadRow
                          ? 'text-loss/60'
                          : isCompleted
                          ? 'text-gain/50'
                          : 'text-white/15'
                      }`}
                    >
                      {multiplier}×
                    </span>

                    {/* Tiles */}
                    <div className="flex gap-1.5 flex-1">
                      {Array(TILES)
                        .fill(null)
                        .map((_, tileIdx) => {
                          const isPicked = rowData?.picked === tileIdx;
                          const isSafe = rowData?.tiles[tileIdx];
                          const showResult =
                            (isDeadRow || isCompleted) && isPicked;

                          return (
                            <button
                              key={tileIdx}
                              onClick={() => isActive && pickTile(tileIdx)}
                              disabled={!isActive}
                              className={`flex-1 h-10 rounded-lg flex items-center justify-center text-base transition-all duration-150 border ${
                                showResult
                                  ? isSafe
                                    ? 'bg-gain/15 border-gain/30'
                                    : 'bg-loss/20 border-loss/40 scale-105'
                                  : isActive
                                  ? 'bg-blue-500/10 border-blue-400/20 hover:bg-blue-500/25 hover:border-blue-400/50 hover:scale-105 cursor-pointer'
                                  : isCompleted
                                  ? 'bg-white/2 border-white/4'
                                  : 'bg-white/2 border-white/5'
                              }`}
                            >
                              {showResult ? (isSafe ? '<img src="/egg.png" alt="egg" className="w-6 h-6 object-contain" />' : '💥') : isActive ? '<img src="/egg.png" alt="egg" className="w-6 h-6 object-contain" />' : ''}
                            </button>
                          );
                        })}
                    </div>

                    {/* Row profit indicator */}
                    {isActive && betAmount > 0 && (
                      <span className="text-xs font-mono text-blue-300/60 w-16 text-right flex-shrink-0">
                        {fmt(Math.floor(betAmount * multiplier))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Idle: bet */}
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
                  className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-400/40 text-center font-mono text-lg"
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
                className="w-full py-4 rounded-2xl font-display font-bold text-lg bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <img src="/egg.png" alt="egg" className="w-6 h-6 object-contain" /> Start Blue Balls!
              </button>
            </div>
          )}

          {/* Playing: cash out */}
          {isPlaying && (
            <div>
              {canCashOut ? (
                <button
                  onClick={cashOut}
                  className="btn-gold w-full py-3 font-bold"
                >
                  Cash Out · {fmt(Math.floor(betAmount * config.multipliers[currentRow - 1]))}
                </button>
              ) : (
                <div className="w-full py-3 rounded-2xl text-center bg-white/3 border border-white/8 text-white/25 text-sm">
                  Pick a tile to begin climbing
                </div>
              )}
            </div>
          )}

          {/* Dead / Won */}
          {(isDead || isWon) && (
            <button onClick={reset} className="btn-primary w-full py-3 font-bold">
              Play Again
            </button>
          )}

          <p className="text-white/30 text-xs text-center">Balance: {fmt(profile?.balance ?? 0)}</p>
        </div>
      </div>

      {/* Difficulty info */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(DIFFICULTY) as [Difficulty, typeof DIFFICULTY['easy']][]).map(
          ([key, val]) => (
            <div
              key={key}
              className={`card p-3 text-center transition-all ${
                difficulty === key ? `${val.border} border` : ''
              }`}
            >
              <p className={`text-xs font-bold capitalize mb-1 ${val.color}`}>{val.label}</p>
              <p className="text-white/30 text-xs">{val.bad} bad / {TILES} tiles</p>
              <p className="text-white/20 text-xs">Max {val.multipliers[ROWS - 1]}×</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
