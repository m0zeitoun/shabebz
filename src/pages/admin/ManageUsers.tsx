import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { UserProfile, UserStock, Stock } from '../../types';
import { Search, Plus, Minus, Eye, X, AlertCircle, Shield, User } from 'lucide-react';

interface UserWithValue extends UserProfile {
  holdings_value: number;
  total_value: number;
}

interface BalanceModal {
  user: UserWithValue;
  amount: string;
  mode: 'add' | 'remove';
}

interface ViewModal {
  user: UserWithValue;
  holdings: (UserStock & { stock: Stock })[];
}

export default function ManageUsers() {
  const [users, setUsers] = useState<UserWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [balanceModal, setBalanceModal] = useState<BalanceModal | null>(null);
  const [viewModal, setViewModal] = useState<ViewModal | null>(null);
  const [balError, setBalError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    const [usersRes, stocksRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stocks').select('*, stock:stocks(*)'),
    ]);

    const allHoldings = (stocksRes.data ?? []) as (UserStock & { stock: Stock })[];
    const holdingsMap: Record<string, number> = {};
    allHoldings.forEach(h => {
      if (!holdingsMap[h.user_id]) holdingsMap[h.user_id] = 0;
      holdingsMap[h.user_id] += h.shares_owned * (h.stock?.current_price ?? 0);
    });

    const usrs = (usersRes.data ?? []) as UserProfile[];
    setUsers(usrs.map(u => ({
      ...u,
      holdings_value: holdingsMap[u.id] ?? 0,
      total_value: u.balance + (holdingsMap[u.id] ?? 0),
    })));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const handleViewUser = async (user: UserWithValue) => {
    const { data } = await supabase
      .from('user_stocks')
      .select('*, stock:stocks(*)')
      .eq('user_id', user.id);
    setViewModal({ user, holdings: (data ?? []) as (UserStock & { stock: Stock })[] });
  };

  const handleBalance = async () => {
    if (!balanceModal) return;
    setBalError('');
    const amount = parseFloat(balanceModal.amount);
    if (isNaN(amount) || amount <= 0) { setBalError('Enter a valid amount'); return; }

    const delta = balanceModal.mode === 'add' ? amount : -amount;
    const newBalance = balanceModal.user.balance + delta;
    if (newBalance < 0) { setBalError('Cannot go below $0'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', balanceModal.user.id);

    if (error) { setBalError(error.message); setSaving(false); return; }
    setSaving(false);
    setBalanceModal(null);
    fetchUsers();
  };

  const toggleAdmin = async (user: UserWithValue) => {
    await supabase.from('users').update({ is_admin: !user.is_admin }).eq('id', user.id);
    fetchUsers();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="shimmer h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className="input pl-9 text-sm"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="font-display font-semibold text-white/60 text-sm">{filtered.length} Players</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Player</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Cash</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Holdings</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs text-white/40 font-medium uppercase">Role</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${user.is_admin ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-gain/10 text-gain border border-gain/20'}`}>
                        {user.username[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{user.username}</p>
                        <p className="text-white/30 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white/70 text-sm">{fmt(user.balance)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white/70 text-sm">{fmt(user.holdings_value)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white text-sm">{fmt(user.total_value)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${user.is_admin ? 'bg-gold/10 text-gold border-gold/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                      {user.is_admin ? 'Admin' : 'Player'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                        title="View portfolio"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setBalanceModal({ user, amount: '', mode: 'add' }); setBalError(''); }}
                        className="p-1.5 rounded-lg text-gain/60 hover:text-gain hover:bg-gain/10 transition-all"
                        title="Add funds"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setBalanceModal({ user, amount: '', mode: 'remove' }); setBalError(''); }}
                        className="p-1.5 rounded-lg text-loss/60 hover:text-loss hover:bg-loss/10 transition-all"
                        title="Remove funds"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleAdmin(user)}
                        className="p-1.5 rounded-lg text-gold/60 hover:text-gold hover:bg-gold/10 transition-all"
                        title="Toggle admin"
                      >
                        {user.is_admin ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">No players found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance Modal */}
      {balanceModal && (
        <div className="modal-overlay" onClick={() => setBalanceModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-white">
                {balanceModal.mode === 'add' ? 'Add Funds' : 'Remove Funds'}
              </h2>
              <button onClick={() => setBalanceModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-navy-900 rounded-xl p-4 mb-4">
              <p className="text-white/40 text-xs mb-1">{balanceModal.user.username}</p>
              <p className="font-mono font-bold text-white text-xl">{fmt(balanceModal.user.balance)}</p>
              <p className="text-white/30 text-xs">Current Balance</p>
            </div>

            <div className="mb-4">
              <label className="label block mb-1.5">Amount (USD)</label>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={balanceModal.amount}
                onChange={e => setBalanceModal(m => m ? { ...m, amount: e.target.value } : null)}
                autoFocus
              />
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[50, 100, 250, 500].map(v => (
                <button
                  key={v}
                  onClick={() => setBalanceModal(m => m ? { ...m, amount: String(v) } : null)}
                  className="btn-ghost text-xs py-1.5 px-2 justify-center"
                >
                  ${v}
                </button>
              ))}
            </div>

            {balanceModal.amount && (
              <div className="flex justify-between items-center bg-navy-900 rounded-xl px-4 py-3 mb-4">
                <span className="text-white/40 text-sm">New Balance</span>
                <span className="font-mono font-bold text-white">
                  {fmt(Math.max(0, balanceModal.user.balance + (balanceModal.mode === 'add' ? 1 : -1) * (parseFloat(balanceModal.amount) || 0)))}
                </span>
              </div>
            )}

            {balError && (
              <div className="flex items-center gap-2 bg-loss/10 border border-loss/20 rounded-xl px-4 py-2.5 text-loss text-sm mb-4">
                <AlertCircle className="w-4 h-4" /> {balError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setBalanceModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleBalance}
                disabled={saving}
                className={`flex-1 ${balanceModal.mode === 'add' ? 'btn-primary' : 'btn-danger'}`}
              >
                {saving ? 'Saving...' : balanceModal.mode === 'add' ? 'Add Funds' : 'Remove Funds'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Portfolio Modal */}
      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-white">{viewModal.user.username}'s Portfolio</h2>
              <button onClick={() => setViewModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-navy-900 rounded-xl p-3">
                <p className="text-white/40 text-xs">Cash</p>
                <p className="font-mono font-bold text-white">{fmt(viewModal.user.balance)}</p>
              </div>
              <div className="bg-navy-900 rounded-xl p-3">
                <p className="text-white/40 text-xs">Total Value</p>
                <p className="font-mono font-bold text-gain">{fmt(viewModal.user.total_value)}</p>
              </div>
            </div>

            {viewModal.holdings.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No holdings</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {viewModal.holdings.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-navy-900 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-medium text-white text-sm">{h.stock?.name}</p>
                      <p className="text-white/40 text-xs font-mono">{h.shares_owned} shares · avg {fmt(h.purchase_price_avg)}</p>
                    </div>
                    <p className="font-mono font-bold text-white text-sm">
                      {fmt(h.shares_owned * (h.stock?.current_price ?? 0))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
