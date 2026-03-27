import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type Side = 'heads' | 'tails';
type GameState = 'idle' | 'flipping' | 'won' | 'lost';

export default function CoinFlip() {
  const { profile, refreshProfile } = useAuth();
  const [pick, setPick] = useState<Side | null>(null);
  const [bet, setBet] = useState('');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [result, setResult] = useState<Side | null>(null);
  const [error, setError] = useState('');

  const balance = profile?.balance ?? 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const flip = async () => {
    if (!profile) return;
    const amount = parseFloat(bet);
    if (!pick) return setError('Pick heads or tails first');
    if (isNaN(amount) || amount <= 0) return setError('Enter a valid bet amount');
    if (amount > balance) return setError('Insufficient balance');

    setError('');
    setGameState('flipping');

    await new Promise(r => setTimeout(r, 1500));

    const outcome: Side = Math.random() < 0.5 ? 'heads' : 'tails';
    setResult(outcome);

    const won = outcome === pick;

    const { data: fresh } = await supabase
      .from('users')
      .select('balance')
      .eq('id', profile.id)
      .single();

    if (fresh) {
      const newBalance = won ? fresh.balance + amount : fresh.balance - amount;
      await supabase.from('users').update({ balance: newBalance }).eq('id', profile.id);
    }

    await refreshProfile();
    setGameState(won ? 'won' : 'lost');
  };

  const reset = () => {
    setGameState('idle');
    setResult(null);
    setPick(null);
    setBet('');
    setError('');
  };

  return (
    <div className="max-w-sm mx-auto space-y-3">
      <div className="card p-8 text-center space-y-6">
        {/* Coin */}
        <div
          className={`w-28 h-28 mx-auto rounded-full rank-gold flex items-center justify-center font-display font-bold text-3xl text-navy-900 shadow-xl transition-all ${
            gameState === 'flipping' ? 'animate-spin' : ''
          }`}
        >
          {result === 'heads' ? 'H' : result === 'tails' ? 'T' : '?'}
        </div>

        {gameState === 'idle' && (
          <>
            <div className="flex gap-3">
              {(['heads', 'tails'] as Side[]).map(side => (
                <button
                  key={side}
                  onClick={() => setPick(side)}
                  className={`flex-1 py-3 rounded-xl font-bold capitalize transition-all ${
                    pick === side
                      ? 'rank-gold text-navy-900'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>

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

            <button
              onClick={flip}
              disabled={!pick || !bet}
              className="btn-gold w-full py-4 text-lg"
            >
              Flip! · 2× payout
            </button>

            <p className="text-white/30 text-xs">Balance: {fmt(balance)}</p>
          </>
        )}

        {gameState === 'flipping' && (
          <p className="text-white/50 font-display text-lg animate-pulse">Flipping...</p>
        )}

        {(gameState === 'won' || gameState === 'lost') && (
          <div className="space-y-4">
            <div>
              <p
                className={`font-display font-bold text-4xl ${
                  gameState === 'won' ? 'text-gain' : 'text-loss'
                }`}
              >
                {gameState === 'won'
                  ? `+${fmt(parseFloat(bet))}`
                  : `-${fmt(parseFloat(bet))}`}
              </p>
              <p className="text-white/40 text-sm mt-1">
                It was <span className="text-white font-semibold capitalize">{result}</span>
                {' '}— you {gameState === 'won' ? 'won!' : 'lost.'}
              </p>
            </div>
            <button onClick={reset} className="btn-primary w-full py-3">
              Play Again
            </button>
            <p className="text-white/30 text-xs">Balance: {fmt(profile?.balance ?? 0)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Win chance', value: '50%' },
          { label: 'Payout', value: '2× bet' },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 flex justify-between text-sm items-center">
            <span className="text-white/40">{label}</span>
            <span className="text-gold font-mono font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
