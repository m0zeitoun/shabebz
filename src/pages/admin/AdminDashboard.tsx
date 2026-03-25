import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, TrendingUp, DollarSign, Activity, BarChart3 } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalStocks: number;
  totalMarketCap: number;
  totalTransactions: number;
  mostTradedStock: string;
  totalVolume: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentTx, setRecentTx] = useState<{ id: string; username: string; stock_name: string; type: string; total: number; time: string }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [usersRes, stocksRes, txRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('stocks').select('id, name, current_price, issued_shares'),
        supabase.from('transactions').select('stock_id, total_amount, stock:stocks(name), user:users(username), transaction_type, timestamp').order('timestamp', { ascending: false }).limit(10),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stocks: any[] = stocksRes.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txs: any[] = txRes.data ?? [];

      // Market cap
      const marketCap = stocks.reduce((s: number, st: { current_price: number; issued_shares: number }) => s + st.current_price * st.issued_shares, 0);

      // Volume by stock
      const volMap: Record<string, { name: string; count: number }> = {};
      let totalVol = 0;
      txs.forEach((t: { stock_id: string; total_amount: number; stock: { name: string } | { name: string }[] | null }) => {
        if (!volMap[t.stock_id]) {
          const stockName = Array.isArray(t.stock) ? (t.stock[0]?.name ?? '') : (t.stock?.name ?? '');
          volMap[t.stock_id] = { name: stockName, count: 0 };
        }
        volMap[t.stock_id].count++;
        totalVol += t.total_amount;
      });
      const mostTraded = Object.values(volMap).sort((a, b) => b.count - a.count)[0];

      setStats({
        totalUsers: usersRes.count ?? 0,
        totalStocks: stocks.length,
        totalMarketCap: marketCap,
        totalTransactions: txs.length,
        mostTradedStock: mostTraded?.name ?? '—',
        totalVolume: totalVol,
      });

      setRecentTx(txs.map((t: { id: string; user: { username: string } | { username: string }[] | null; stock: { name: string } | { name: string }[] | null; transaction_type: string; total_amount: number; timestamp: string }) => ({
        id: t.id,
        username: Array.isArray(t.user) ? (t.user[0]?.username ?? '?') : (t.user?.username ?? '?'),
        stock_name: Array.isArray(t.stock) ? (t.stock[0]?.name ?? '?') : (t.stock?.name ?? '?'),
        type: t.transaction_type,
        total: t.total_amount,
        time: t.timestamp,
      })));
    };

    fetchStats().finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'Total Players', value: stats?.totalUsers, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
          { icon: TrendingUp, label: 'Listed Stocks', value: stats?.totalStocks, color: 'text-gain', bg: 'bg-gain/10', border: 'border-gain/20' },
          { icon: DollarSign, label: 'Market Cap', value: fmt(stats?.totalMarketCap ?? 0), color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
          { icon: Activity, label: 'Recent Trades', value: stats?.totalTransactions, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
          { icon: BarChart3, label: 'Trade Volume', value: fmt(stats?.totalVolume ?? 0), color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
          { icon: TrendingUp, label: 'Most Traded', value: stats?.mostTradedStock, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
        ].map(({ icon: Icon, label, value, color, bg, border }) => (
          <div key={label} className={`card p-5 border ${border} ${bg}`}>
            <div className="flex items-start justify-between mb-3">
              <p className="label text-xs">{label}</p>
              <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`font-display font-bold text-2xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="font-display font-semibold text-white mb-3">Recent Transactions</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Player</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Stock</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Type</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map(tx => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-white/80 text-sm font-medium">{tx.username}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{tx.stock_name}</td>
                  <td className="px-4 py-3">
                    <span className={`${tx.type === 'buy' ? 'gain-badge' : 'loss-badge'} uppercase`}>{tx.type}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white text-sm">{fmt(tx.total)}</td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs">{fmtDate(tx.time)}</td>
                </tr>
              ))}
              {recentTx.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
