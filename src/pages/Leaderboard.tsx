import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, TrendingUp, TrendingDown, Medal, Crown, Search } from 'lucide-react';

interface LeaderEntry {
  user_id: string;
  username: string;
  balance: number;
  holdings_value: number;
  total_value: number;
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    // Get all users
    const { data: users } = await supabase.from('users').select('id, username, balance');
    if (!users) return;

    // Get all user_stocks with stock prices
    const { data: userStocks } = await supabase
      .from('user_stocks')
      .select('user_id, shares_owned, stock:stocks(current_price)');

    // Calculate totals (Supabase returns stock as array or object depending on the query)
    const holdingsMap: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userStocks ?? []).forEach((us: any) => {
      if (!holdingsMap[us.user_id]) holdingsMap[us.user_id] = 0;
      const price = Array.isArray(us.stock) ? (us.stock[0]?.current_price ?? 0) : (us.stock?.current_price ?? 0);
      holdingsMap[us.user_id] += us.shares_owned * price;
    });

    const board: LeaderEntry[] = users.map(u => ({
      user_id: u.id,
      username: u.username,
      balance: u.balance,
      holdings_value: holdingsMap[u.id] ?? 0,
      total_value: u.balance + (holdingsMap[u.id] ?? 0),
    }));

    board.sort((a, b) => b.total_value - a.total_value);
    setEntries(board);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard().finally(() => setLoading(false));

    const sub = supabase
      .channel('leaderboard-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stocks' }, fetchLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, fetchLeaderboard)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [fetchLeaderboard]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const filtered = entries.filter(e =>
    e.username.toLowerCase().includes(search.toLowerCase())
  );

  const myRank = entries.findIndex(e => e.user_id === profile?.id) + 1;
  const myEntry = entries.find(e => e.user_id === profile?.id);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return null;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-3.5 h-3.5" />;
    if (rank === 2) return <Medal className="w-3.5 h-3.5" />;
    if (rank === 3) return <Medal className="w-3.5 h-3.5" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-24 rounded-2xl" />
        {[...Array(8)].map((_, i) => <div key={i} className="shimmer h-16 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header flex items-center gap-2">
            <Trophy className="w-6 h-6 text-gold" /> Leaderboard
          </h1>
          <p className="section-sub">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className="input pl-9 w-44 sm:w-56 text-sm"
            placeholder="Find player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Your Rank */}
      {myEntry && myRank > 0 && (
        <div className="card p-4 border-gain/20 bg-gain/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gain/20 border border-gain/30 flex items-center justify-center font-display font-bold text-gain text-lg">
                #{myRank}
              </div>
              <div>
                <p className="font-display font-semibold text-white">You — {myEntry.username}</p>
                <p className="text-white/40 text-xs">Your current ranking</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-gain text-lg">{fmt(myEntry.total_value)}</p>
              <p className="text-white/30 text-xs">Total portfolio value</p>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 podium */}
      {!search && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd place */}
          <div className="card p-4 text-center pt-6 mt-4">
            <div className="w-12 h-12 rounded-full rank-silver mx-auto mb-2 flex items-center justify-center text-navy-900 font-display font-bold text-lg shadow-lg">
              2
            </div>
            <p className="font-display font-semibold text-white text-sm truncate">{entries[1]?.username}</p>
            <p className="font-mono text-white/60 text-xs mt-0.5">{fmt(entries[1]?.total_value ?? 0)}</p>
          </div>

          {/* 1st place — taller */}
          <div className="card p-4 text-center border-gold/30 bg-gold/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <Crown className="w-4 h-4 text-gold mx-auto mb-2" />
            <div className="w-14 h-14 rounded-full rank-gold mx-auto mb-2 flex items-center justify-center text-navy-900 font-display font-bold text-xl shadow-lg shadow-gold/20">
              1
            </div>
            <p className="font-display font-semibold text-white truncate">{entries[0]?.username}</p>
            <p className="font-mono text-gold text-sm mt-0.5 font-bold">{fmt(entries[0]?.total_value ?? 0)}</p>
          </div>

          {/* 3rd place */}
          <div className="card p-4 text-center pt-8 mt-8">
            <div className="w-10 h-10 rounded-full rank-bronze mx-auto mb-2 flex items-center justify-center text-white font-display font-bold shadow-lg">
              3
            </div>
            <p className="font-display font-semibold text-white text-sm truncate">{entries[2]?.username}</p>
            <p className="font-mono text-white/60 text-xs mt-0.5">{fmt(entries[2]?.total_value ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Full Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="font-display font-semibold text-white/70 text-sm">{filtered.length} Players</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide w-12">Rank</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Player</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Cash</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Holdings</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Total Value</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">vs Start</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => {
                const rank = entries.findIndex(e => e.user_id === entry.user_id) + 1;
                const badge = getRankBadge(rank);
                const icon = getRankIcon(rank);
                const vsStart = entry.total_value - 1000;
                const isMe = entry.user_id === profile?.id;

                return (
                  <tr
                    key={entry.user_id}
                    className={`border-b border-white/5 transition-colors ${isMe ? 'bg-gain/5' : 'hover:bg-white/2'}`}
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    <td className="px-4 py-3">
                      {badge ? (
                        <div className={`w-7 h-7 rounded-full ${badge} flex items-center justify-center text-navy-900 font-display font-bold text-xs shadow-sm`}>
                          {icon ?? rank}
                        </div>
                      ) : (
                        <span className="text-white/30 font-mono text-sm">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gain/60 to-cyan-400/60 flex items-center justify-center text-navy-900 font-bold text-xs flex-shrink-0">
                          {entry.username[0]?.toUpperCase()}
                        </div>
                        <span className={`font-display font-medium text-sm ${isMe ? 'text-gain' : 'text-white'}`}>
                          {entry.username} {isMe && <span className="text-white/30 text-xs">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/60 text-sm">{fmt(entry.balance)}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/60 text-sm">{fmt(entry.holdings_value)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white text-sm">{fmt(entry.total_value)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-mono flex items-center justify-end gap-1 ${vsStart >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {vsStart >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {vsStart >= 0 ? '+' : ''}{fmt(vsStart)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
