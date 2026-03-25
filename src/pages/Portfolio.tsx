import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { UserStock, Transaction, Stock } from '../types';
import { useAuth } from '../contexts/AuthContext';
import BuySellModal from '../components/BuySellModal';
import { TrendingUp, TrendingDown, Clock, Briefcase, DollarSign, BarChart3 } from 'lucide-react';

type ModalState = { stock: Stock; mode: 'buy' | 'sell' } | null;

export default function Portfolio() {
  const { profile } = useAuth();
  const [holdings, setHoldings] = useState<(UserStock & { stock: Stock })[]>([]);
  const [transactions, setTransactions] = useState<(Transaction & { stock: Stock })[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [holdingsRes, txRes] = await Promise.all([
      supabase
        .from('user_stocks')
        .select('*, stock:stocks(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*, stock:stocks(*)')
        .eq('user_id', profile.id)
        .order('timestamp', { ascending: false })
        .limit(50),
    ]);

    if (holdingsRes.data) setHoldings(holdingsRes.data as (UserStock & { stock: Stock })[]);
    if (txRes.data) setTransactions(txRes.data as (Transaction & { stock: Stock })[]);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.shares_owned * h.stock.current_price, 0);
  const totalValue = (profile?.balance ?? 0) + holdingsValue;
  const totalPL = holdings.reduce((sum, h) => {
    return sum + h.shares_owned * (h.stock.current_price - h.purchase_price_avg);
  }, 0);

  const handleSuccess = () => fetchData();

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="section-header">Portfolio</h1>
        <p className="section-sub">Your holdings and transaction history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card col-span-2 lg:col-span-1 bg-gradient-to-br from-gain/10 to-transparent border-gain/20">
          <p className="label text-xs">Total Value</p>
          <p className="font-display font-bold text-2xl text-white">{fmt(totalValue)}</p>
          <p className="text-white/30 text-xs">Cash + Holdings</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-white/30" />
            <p className="label text-xs">Cash Balance</p>
          </div>
          <p className="font-mono font-bold text-lg text-white">{fmt(profile?.balance ?? 0)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-white/30" />
            <p className="label text-xs">Holdings</p>
          </div>
          <p className="font-mono font-bold text-lg text-white">{fmt(holdingsValue)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            {totalPL >= 0 ? <TrendingUp className="w-4 h-4 text-gain" /> : <TrendingDown className="w-4 h-4 text-loss" />}
            <p className="label text-xs">Unrealized P&L</p>
          </div>
          <p className={`font-mono font-bold text-lg ${totalPL >= 0 ? 'text-gain' : 'text-loss'}`}>
            {totalPL >= 0 ? '+' : ''}{fmt(totalPL)}
          </p>
        </div>
      </div>

      {/* Holdings */}
      <div>
        <h2 className="font-display font-semibold text-lg text-white mb-3 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-white/40" /> Holdings
          <span className="text-white/30 text-sm font-normal">({holdings.length})</span>
        </h2>

        {holdings.length === 0 ? (
          <div className="card p-10 text-center">
            <Briefcase className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 font-display font-medium">No holdings yet</p>
            <p className="text-white/25 text-sm mt-1">Head to the market to buy your first stock</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map(h => {
              const currentVal = h.shares_owned * h.stock.current_price;
              const costBasis = h.shares_owned * h.purchase_price_avg;
              const pl = currentVal - costBasis;
              const plPct = ((pl / costBasis) * 100);
              const isGain = pl >= 0;

              return (
                <div key={h.id} className="card p-4 hover:border-white/10 transition-all">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs ${isGain ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-loss/10 text-loss border border-loss/20'}`}>
                      {h.stock.ticker.slice(0, 3)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-display font-semibold text-white">{h.stock.name}</p>
                          <p className="text-white/40 text-xs font-mono uppercase">{h.stock.ticker} · {h.shares_owned} shares</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono font-bold text-white">{fmt(currentVal)}</p>
                          <p className={`text-xs font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
                            {isGain ? '+' : ''}{fmt(pl)} ({isGain ? '+' : ''}{plPct.toFixed(2)}%)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                        <div>
                          <p className="text-white/30">Current Price</p>
                          <p className="font-mono text-white/70">{fmt(h.stock.current_price)}</p>
                        </div>
                        <div>
                          <p className="text-white/30">Avg Cost</p>
                          <p className="font-mono text-white/70">{fmt(h.purchase_price_avg)}</p>
                        </div>
                        <div>
                          <p className="text-white/30">Cost Basis</p>
                          <p className="font-mono text-white/70">{fmt(costBasis)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setModal({ stock: h.stock, mode: 'buy' })}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          <TrendingUp className="w-3 h-3" /> Buy More
                        </button>
                        <button
                          onClick={() => setModal({ stock: h.stock, mode: 'sell' })}
                          className="btn-danger text-xs py-1.5 px-3"
                        >
                          <TrendingDown className="w-3 h-3" /> Sell
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="font-display font-semibold text-lg text-white mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-white/40" /> Transaction History
          <span className="text-white/30 text-sm font-normal">({transactions.length})</span>
        </h2>

        {transactions.length === 0 ? (
          <div className="card p-10 text-center">
            <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No transactions yet</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Stock</th>
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Type</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Shares</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Price</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-display font-medium text-white text-sm">{tx.stock?.name}</p>
                        <p className="text-white/40 text-xs font-mono uppercase">{tx.stock?.ticker}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${tx.transaction_type === 'buy' ? 'gain-badge' : 'loss-badge'} uppercase`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/70 text-sm">{tx.shares}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/70 text-sm">{fmt(tx.price_per_share)}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-white text-sm">{fmt(tx.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-white/40 text-xs">{fmtDate(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
