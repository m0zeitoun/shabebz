import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Stock, UserStock, PriceHistory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import BuySellModal from '../components/BuySellModal';
import Sparkline from '../components/Sparkline';
import { TrendingUp, TrendingDown, Search, RefreshCw, Gift } from 'lucide-react';

type ModalState = { stock: Stock; mode: 'buy' | 'sell' } | null;

export default function Market() {
  const { profile, refreshProfile } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [holdings, setHoldings] = useState<UserStock[]>([]);
  const [histories, setHistories] = useState<Record<string, PriceHistory[]>>({});
  const [issuedMap, setIssuedMap] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [flashMap, setFlashMap] = useState<Record<string, 'gain' | 'loss'>>({});
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

  // Fetch real issued shares from user_stocks (sum of all shares owned per stock)
  const fetchIssuedShares = useCallback(async () => {
    const { data } = await supabase.from('user_stocks').select('stock_id, shares_owned');
    if (data) {
      const map: Record<string, number> = {};
      data.forEach(row => {
        map[row.stock_id] = (map[row.stock_id] ?? 0) + row.shares_owned;
      });
      setIssuedMap(map);
    }
  }, []);

  const fetchStocks = useCallback(async () => {
    const { data } = await supabase.from('stocks').select('*').order('name');
    if (data) {
      setStocks(prev => {
        const newFlash: Record<string, 'gain' | 'loss'> = {};
        data.forEach(s => {
          const old = prev.find(p => p.id === s.id);
          if (old && old.current_price !== s.current_price) {
            newFlash[s.id] = s.current_price > old.current_price ? 'gain' : 'loss';
          }
        });
        if (Object.keys(newFlash).length > 0) {
          setFlashMap(newFlash);
          setTimeout(() => setFlashMap({}), 800);
        }
        return data;
      });
    }
    await fetchIssuedShares();
  }, [fetchIssuedShares]);

  const fetchHoldings = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('user_stocks')
      .select('*')
      .eq('user_id', profile.id);
    if (data) setHoldings(data);
  }, [profile]);

  const fetchHistories = useCallback(async (stockIds: string[]) => {
    if (stockIds.length === 0) return;
    const { data } = await supabase
      .from('price_history')
      .select('*')
      .in('stock_id', stockIds)
      .order('timestamp', { ascending: true });
    if (data) {
      const map: Record<string, PriceHistory[]> = {};
      data.forEach(h => {
        if (!map[h.stock_id]) map[h.stock_id] = [];
        map[h.stock_id].push(h);
      });
      setHistories(map);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStocks();
      await fetchHoldings();
      setLoading(false);
    };
    init();
  }, [fetchStocks, fetchHoldings]);

  useEffect(() => {
    if (stocks.length > 0) {
      fetchHistories(stocks.map(s => s.id));
    }
  }, [stocks.length, fetchHistories]);

  useEffect(() => {
    const sub = supabase
      .channel('market-stocks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, fetchStocks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stocks' }, fetchIssuedShares)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchStocks, fetchIssuedShares]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const pctChange = (s: Stock) => ((s.current_price - s.initial_price) / s.initial_price * 100);

  const filtered = stocks.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.ticker.toLowerCase().includes(search.toLowerCase())
  );

  const totalMarketCap = stocks.reduce((sum, s) => sum + s.current_price * (issuedMap[s.id] ?? 0), 0);
  const gainers = stocks.filter(s => pctChange(s) > 0).length;
  const losers = stocks.filter(s => pctChange(s) < 0).length;

  const handleSuccess = () => {
    fetchStocks();
    fetchHoldings();
  };

  // Calculate pending hourly dividend (5% per hour of total holdings value)
  const calcPending = () => {
    if (!profile?.last_claimed_at) return 0;
    const hoursElapsed = (Date.now() - new Date(profile.last_claimed_at).getTime()) / 3600000;
    const holdingsValue = holdings.reduce((sum, h) => {
      const stock = stocks.find(s => s.id === h.stock_id);
      return sum + (stock ? stock.current_price * h.shares_owned : 0);
    }, 0);
    if (holdingsValue === 0) return 0;
    return Math.floor(hoursElapsed * 0.05 * holdingsValue * 100) / 100;
  };

  const pendingReward = calcPending();
  const totalHoldingsValue = holdings.reduce((sum, h) => {
    const stock = stocks.find(s => s.id === h.stock_id);
    return sum + (stock ? stock.current_price * h.shares_owned : 0);
  }, 0);
  const hasShares = totalHoldingsValue > 0;

  const claimDividend = async () => {
    if (!profile || claiming) return;

    // First time claiming — just set the clock, no reward
    if (!profile.last_claimed_at) {
      setClaiming(true);
      await supabase.from('users').update({ last_claimed_at: new Date().toISOString() }).eq('id', profile.id);
      await refreshProfile();
      setClaiming(false);
      setClaimMsg('Dividend tracking started! Come back in an hour.');
      setTimeout(() => setClaimMsg(''), 4000);
      return;
    }

    const reward = calcPending();
    if (reward <= 0) {
      setClaimMsg('Nothing to claim yet — come back in an hour!');
      setTimeout(() => setClaimMsg(''), 3000);
      return;
    }

    setClaiming(true);
    const { data: fresh } = await supabase.from('users').select('balance').eq('id', profile.id).single();
    if (fresh) {
      await supabase.from('users').update({
        balance: fresh.balance + reward,
        last_claimed_at: new Date().toISOString(),
      }).eq('id', profile.id);
    }
    await refreshProfile();
    setClaiming(false);
    setClaimMsg(`+${fmt(reward)} claimed!`);
    setTimeout(() => setClaimMsg(''), 4000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-24 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Market Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Market Cap', value: fmt(totalMarketCap), sub: 'Total value' },
          { label: 'Listed Stocks', value: stocks.length, sub: 'Available to trade' },
          { label: 'Gainers', value: gainers, sub: 'Up today', color: 'text-gain' },
          { label: 'Losers', value: losers, sub: 'Down today', color: 'text-loss' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="stat-card animate-slide-up">
            <p className="label text-xs">{label}</p>
            <p className={`font-display font-bold text-xl ${color ?? 'text-white'}`}>{value}</p>
            <p className="text-white/30 text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="section-header">Market</h1>
          <p className="section-sub">{filtered.length} stocks listed</p>
        </div>

        {/* Dividend Claim */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={claimDividend}
            disabled={claiming || !hasShares}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
              !hasShares
                ? 'bg-white/3 border-white/8 text-white/25 cursor-not-allowed'
                : pendingReward > 0
                ? 'bg-gain/10 border-gain/30 text-gain hover:bg-gain/20'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <Gift className="w-4 h-4" />
            {claiming ? 'Claiming...' : pendingReward > 0 ? `Claim ${fmt(pendingReward)}` : !profile?.last_claimed_at ? 'Start Earning' : 'Dividends'}
          </button>
          {claimMsg && <p className="text-gain text-xs font-semibold">{claimMsg}</p>}
          {hasShares && profile?.last_claimed_at && (
            <p className="text-white/25 text-xs">{fmt(totalHoldingsValue * 0.05)}/hr</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              className="input pl-9 w-48 sm:w-64 text-sm"
              placeholder="Search stocks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => { fetchStocks(); fetchHoldings(); }} className="btn-ghost p-2.5">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stocks Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <TrendingUp className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">{search ? 'No stocks match your search' : 'No stocks listed yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((stock, i) => {
            const change = pctChange(stock);
            const isGain = change >= 0;
            const holding = holdings.find(h => h.stock_id === stock.id);
            const history = histories[stock.id] ?? [];
            const flash = flashMap[stock.id];
            const realIssued = issuedMap[stock.id] ?? 0;
            const available = stock.max_shares - realIssued;

            return (
              <div
                key={stock.id}
                className={`card p-5 transition-all duration-300 hover:border-white/10 hover:-translate-y-0.5 hover:shadow-lg animate-slide-up ${flash === 'gain' ? 'flash-gain' : flash === 'loss' ? 'flash-loss' : ''}`}
                style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
              >
                {/* Stock Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-white/90 uppercase text-sm tracking-wide">{stock.ticker}</span>
                      {holding && (
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-1.5 py-0.5 rounded font-mono">
                          {holding.shares_owned}
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs">{stock.name}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg ${isGain ? 'gain-badge' : 'loss-badge'}`}>
                    {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isGain ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>

                {/* Price & Sparkline */}
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="font-mono font-bold text-2xl text-white">{fmt(stock.current_price)}</p>
                    <p className={`text-xs font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
                      {isGain ? '+' : ''}{fmt(stock.current_price - stock.initial_price)} from start
                    </p>
                  </div>
                  <Sparkline history={history} positive={isGain} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                  <div className="bg-navy-900/60 rounded-lg p-2">
                    <p className="text-white/30">Available</p>
                    <p className="font-mono text-white/70">{available.toLocaleString()}</p>
                    <p className="font-mono text-white/40 text-xs">{fmt(available * stock.current_price)}</p>
                  </div>
                  <div className="bg-navy-900/60 rounded-lg p-2">
                    <p className="text-white/30">Issued</p>
                    <p className="font-mono text-white/70">{realIssued} / {stock.max_shares.toLocaleString()}</p>
                  </div>
                  <div className="bg-navy-900/60 rounded-lg p-2">
                    <p className="text-white/30">Mkt Cap</p>
                    <p className="font-mono text-gold">{fmt(realIssued * stock.current_price)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gain to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (realIssued / stock.max_shares) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ stock, mode: 'buy' })}
                    disabled={available === 0 || (profile?.balance ?? 0) < stock.current_price}
                    className="btn-primary flex-1 justify-center text-sm py-2"
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Buy
                  </button>
                  <button
                    onClick={() => setModal({ stock, mode: 'sell' })}
                    disabled={!holding || holding.shares_owned === 0}
                    className="btn-danger flex-1 justify-center text-sm py-2"
                  >
                    <TrendingDown className="w-3.5 h-3.5" /> Sell
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <BuySellModal
          stock={modal.stock}
          holding={holdings.find(h => h.stock_id === modal.stock.id)}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
