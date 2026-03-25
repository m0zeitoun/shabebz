import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Stock, PriceHistory } from '../../types';
import Sparkline from '../../components/Sparkline';
import { Plus, TrendingUp, TrendingDown, X, AlertCircle } from 'lucide-react';

interface CreateForm {
  name: string;
  ticker: string;
  initial_price: string;
  max_shares: string;
}

interface AdjustModal {
  stock: Stock;
  value: number;
}

export default function ManageStocks() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [histories, setHistories] = useState<Record<string, PriceHistory[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [adjustModal, setAdjustModal] = useState<AdjustModal | null>(null);
  const [form, setForm] = useState<CreateForm>({ name: '', ticker: '', initial_price: '', max_shares: '' });
  const [formError, setFormError] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStocks = useCallback(async () => {
    const { data } = await supabase.from('stocks').select('*').order('created_at', { ascending: false });
    if (data) setStocks(data);

    if (data && data.length > 0) {
      const { data: hist } = await supabase
        .from('price_history')
        .select('*')
        .in('stock_id', data.map((s: Stock) => s.id))
        .order('timestamp', { ascending: true });
      if (hist) {
        const map: Record<string, PriceHistory[]> = {};
        hist.forEach((h: PriceHistory) => {
          if (!map[h.stock_id]) map[h.stock_id] = [];
          map[h.stock_id].push(h);
        });
        setHistories(map);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStocks().finally(() => setLoading(false));
  }, [fetchStocks]);

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const price = parseFloat(form.initial_price);
    const maxShares = parseInt(form.max_shares);

    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.ticker.trim()) { setFormError('Ticker is required'); return; }
    if (form.ticker.length > 6) { setFormError('Ticker max 6 chars'); return; }
    if (isNaN(price) || price <= 0) { setFormError('Enter a valid price'); return; }
    if (isNaN(maxShares) || maxShares <= 0) { setFormError('Enter valid max shares'); return; }

    setSaving(true);
    const { data, error } = await supabase.from('stocks').insert({
      name: form.name.trim(),
      ticker: form.ticker.toUpperCase().trim(),
      current_price: price,
      initial_price: price,
      max_shares: maxShares,
      issued_shares: 0,
    }).select().single();

    if (error) { setFormError(error.message); setSaving(false); return; }

    // Log initial price
    if (data) {
      await supabase.from('price_history').insert({ stock_id: data.id, price });
    }

    setSaving(false);
    setForm({ name: '', ticker: '', initial_price: '', max_shares: '' });
    setShowCreate(false);
    fetchStocks();
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    setAdjustError('');
    const { stock, value } = adjustModal;
    const pct = value / 100;
    const newPrice = Math.max(0.01, stock.current_price * (1 + pct));

    setSaving(true);
    const { error } = await supabase
      .from('stocks')
      .update({ current_price: parseFloat(newPrice.toFixed(4)), updated_at: new Date().toISOString() })
      .eq('id', stock.id);

    if (error) { setAdjustError(error.message); setSaving(false); return; }

    // Log price history
    await supabase.from('price_history').insert({ stock_id: stock.id, price: newPrice });

    setSaving(false);
    setAdjustModal(null);
    fetchStocks();
  };

  const handleDelete = async (stock: Stock) => {
    if (!confirm(`Delete "${stock.name}"? This cannot be undone.`)) return;
    await supabase.from('price_history').delete().eq('stock_id', stock.id);
    await supabase.from('transactions').delete().eq('stock_id', stock.id);
    await supabase.from('user_stocks').delete().eq('stock_id', stock.id);
    await supabase.from('stocks').delete().eq('id', stock.id);
    fetchStocks();
  };

  if (loading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm">{stocks.length} stocks in market</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setFormError(''); }} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New Stock
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-5 border-gain/20 animate-slide-up">
          <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-gain" /> Create New Stock
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1">Stock Name</label>
              <input className="input" placeholder="Ali Yaghi Stock" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Ticker Symbol</label>
              <input className="input uppercase" placeholder="ALYG" maxLength={6} value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label block mb-1">Initial Price (USD)</label>
              <input className="input" type="number" placeholder="10.00" min="0.01" step="0.01" value={form.initial_price} onChange={e => setForm(f => ({ ...f, initial_price: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Max Shares</label>
              <input className="input" type="number" placeholder="1000" min="1" value={form.max_shares} onChange={e => setForm(f => ({ ...f, max_shares: e.target.value }))} />
            </div>

            {formError && (
              <div className="col-span-full flex items-center gap-2 bg-loss/10 border border-loss/20 rounded-xl px-4 py-2.5 text-loss text-sm">
                <AlertCircle className="w-4 h-4" /> {formError}
              </div>
            )}

            <div className="col-span-full flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? 'Creating...' : 'Create Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stocks List */}
      {stocks.length === 0 ? (
        <div className="card p-12 text-center">
          <TrendingUp className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No stocks yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stocks.map(stock => {
            const pctChange = ((stock.current_price - stock.initial_price) / stock.initial_price * 100);
            const isGain = pctChange >= 0;
            const history = histories[stock.id] ?? [];

            return (
              <div key={stock.id} className="card p-4 hover:border-white/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-sm flex-shrink-0 ${isGain ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-loss/10 text-loss border border-loss/20'}`}>
                    {stock.ticker.slice(0, 4)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-display font-semibold text-white">{stock.name}</p>
                        <p className="text-white/40 text-xs font-mono">{stock.ticker} · {stock.issued_shares}/{stock.max_shares} shares issued</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-start gap-3">
                        <Sparkline history={history} positive={isGain} width={60} height={28} />
                        <div>
                          <p className="font-mono font-bold text-white">{fmt(stock.current_price)}</p>
                          <p className={`text-xs font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
                            {isGain ? '+' : ''}{pctChange.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap mt-3">
                      <button
                        onClick={() => setAdjustModal({ stock, value: 5 })}
                        className="btn-ghost text-xs py-1.5 px-3"
                      >
                        Adjust Price
                      </button>
                      <button
                        onClick={() => handleDelete(stock)}
                        className="text-xs py-1.5 px-3 rounded-xl border border-loss/20 text-loss/60 hover:text-loss hover:border-loss/40 hover:bg-loss/5 transition-all inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Adjust Price Modal */}
      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-white">Adjust Price</h2>
              <button onClick={() => setAdjustModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-navy-900 rounded-xl p-4 mb-5">
              <p className="text-white/40 text-xs mb-1">{adjustModal.stock.name} · {adjustModal.stock.ticker}</p>
              <p className="font-mono font-bold text-white text-xl">{fmt(adjustModal.stock.current_price)}</p>
              <p className="text-white/30 text-xs">Current Price</p>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="label text-sm">Adjustment %</label>
                <div className={`font-display font-bold text-lg ${adjustModal.value >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {adjustModal.value >= 0 ? '+' : ''}{adjustModal.value}%
                </div>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={adjustModal.value}
                onChange={e => setAdjustModal(m => m ? { ...m, value: parseInt(e.target.value) } : null)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>-50%</span>
                <span>0%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[-10, -5, +5, +10].map(v => (
                <button
                  key={v}
                  onClick={() => setAdjustModal(m => m ? { ...m, value: v } : null)}
                  className={`text-xs py-1.5 rounded-lg border transition-all ${v < 0 ? 'border-loss/20 text-loss hover:bg-loss/10' : 'border-gain/20 text-gain hover:bg-gain/10'} ${adjustModal.value === v ? (v < 0 ? 'bg-loss/10' : 'bg-gain/10') : ''}`}
                >
                  {v > 0 ? '+' : ''}{v}%
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="flex justify-between items-center bg-navy-900 rounded-xl px-4 py-3 mb-4">
              <span className="text-white/40 text-sm">New Price</span>
              <span className="font-mono font-bold text-white">
                {fmt(Math.max(0.01, adjustModal.stock.current_price * (1 + adjustModal.value / 100)))}
              </span>
            </div>

            {adjustError && (
              <div className="flex items-center gap-2 bg-loss/10 border border-loss/20 rounded-xl px-4 py-2.5 text-loss text-sm mb-4">
                <AlertCircle className="w-4 h-4" /> {adjustError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setAdjustModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleAdjust}
                disabled={saving || adjustModal.value === 0}
                className={`flex-1 font-display font-bold py-2.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 ${adjustModal.value >= 0 ? 'btn-primary' : 'btn-danger'}`}
              >
                {adjustModal.value >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {saving ? 'Updating...' : 'Apply Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
