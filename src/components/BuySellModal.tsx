import { useState } from 'react';
import type { Stock, UserStock } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface Props {
  stock: Stock;
  holding?: UserStock;
  mode: 'buy' | 'sell';
  onClose: () => void;
  onSuccess: () => void;
}

export default function BuySellModal({ stock, holding, mode, onClose, onSuccess }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [shares, setShares] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sharesNum = Math.max(0, parseInt(shares) || 0);
  const total = sharesNum * stock.current_price;
  const availableShares = stock.max_shares - stock.issued_shares;
  const ownedShares = holding?.shares_owned ?? 0;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const maxBuy = Math.min(
    Math.floor((profile?.balance ?? 0) / stock.current_price),
    availableShares
  );
  const maxSell = ownedShares;

  const validate = () => {
    if (sharesNum <= 0) return 'Enter a valid number of shares';
    if (mode === 'buy') {
      if (sharesNum > availableShares) return `Only ${availableShares} shares available`;
      if (total > (profile?.balance ?? 0)) return 'Insufficient funds';
    }
    if (mode === 'sell') {
      if (sharesNum > ownedShares) return `You only own ${ownedShares} shares`;
    }
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!profile) return;

    setLoading(true);
    setError('');

    try {
      if (mode === 'buy') {
        // Deduct balance
        const { error: balErr } = await supabase
          .from('users')
          .update({ balance: profile.balance - total, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (balErr) throw balErr;

        // Update issued shares
        const { error: stockErr } = await supabase
          .from('stocks')
          .update({ issued_shares: stock.issued_shares + sharesNum, updated_at: new Date().toISOString() })
          .eq('id', stock.id);
        if (stockErr) throw stockErr;

        // Update or insert user_stocks
        if (holding) {
          const newAvg = ((holding.purchase_price_avg * holding.shares_owned) + total) / (holding.shares_owned + sharesNum);
          await supabase
            .from('user_stocks')
            .update({ shares_owned: holding.shares_owned + sharesNum, purchase_price_avg: newAvg, updated_at: new Date().toISOString() })
            .eq('id', holding.id);
        } else {
          await supabase.from('user_stocks').insert({
            user_id: profile.id,
            stock_id: stock.id,
            shares_owned: sharesNum,
            purchase_price_avg: stock.current_price,
          });
        }

        // Log transaction
        await supabase.from('transactions').insert({
          user_id: profile.id,
          stock_id: stock.id,
          transaction_type: 'buy',
          shares: sharesNum,
          price_per_share: stock.current_price,
          total_amount: total,
        });

      } else {
        // Sell
        const { error: balErr } = await supabase
          .from('users')
          .update({ balance: profile.balance + total, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (balErr) throw balErr;

        await supabase
          .from('stocks')
          .update({ issued_shares: stock.issued_shares - sharesNum, updated_at: new Date().toISOString() })
          .eq('id', stock.id);

        if (holding) {
          const remaining = holding.shares_owned - sharesNum;
          if (remaining === 0) {
            await supabase.from('user_stocks').delete().eq('id', holding.id);
          } else {
            await supabase
              .from('user_stocks')
              .update({ shares_owned: remaining, updated_at: new Date().toISOString() })
              .eq('id', holding.id);
          }
        }

        await supabase.from('transactions').insert({
          user_id: profile.id,
          stock_id: stock.id,
          transaction_type: 'sell',
          shares: sharesNum,
          price_per_share: stock.current_price,
          total_amount: total,
        });
      }

      await refreshProfile();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const isBuy = mode === 'buy';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${isBuy ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-loss/10 text-loss border border-loss/20'}`}>
              {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isBuy ? 'BUY' : 'SELL'}
            </div>
            <h2 className="font-display font-bold text-xl text-white">{stock.name}</h2>
            <p className="text-white/40 text-sm font-mono uppercase">{stock.ticker}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-navy-900 rounded-xl p-3">
            <p className="label text-xs">Current Price</p>
            <p className="font-mono font-bold text-white text-lg">{fmt(stock.current_price)}</p>
          </div>
          <div className="bg-navy-900 rounded-xl p-3">
            <p className="label text-xs">{isBuy ? 'Your Balance' : 'Shares Owned'}</p>
            <p className="font-mono font-bold text-white text-lg">
              {isBuy ? fmt(profile?.balance ?? 0) : `${ownedShares} shares`}
            </p>
          </div>
        </div>

        {/* Shares Input */}
        <div className="mb-4">
          <label className="label block mb-1.5">Number of Shares</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="input"
              value={shares}
              onChange={e => { setShares(e.target.value); setError(''); }}
              min="1"
              max={isBuy ? maxBuy : maxSell}
              placeholder="0"
            />
            <button
              onClick={() => setShares(String(isBuy ? maxBuy : maxSell))}
              className="btn-ghost text-xs px-3 whitespace-nowrap"
            >
              Max
            </button>
          </div>
          <p className="text-white/30 text-xs mt-1">
            {isBuy ? `Max: ${maxBuy} shares (${availableShares} available in market)` : `Max: ${maxSell} shares`}
          </p>
        </div>

        {/* Range slider */}
        <div className="mb-5">
          <input
            type="range"
            min={0}
            max={isBuy ? maxBuy : maxSell}
            value={sharesNum}
            onChange={e => { setShares(e.target.value); setError(''); }}
            className="w-full"
          />
        </div>

        {/* Total */}
        <div className={`rounded-xl p-4 mb-4 ${isBuy ? 'bg-gain/5 border border-gain/10' : 'bg-loss/5 border border-loss/10'}`}>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Total {isBuy ? 'Cost' : 'Revenue'}</span>
            <span className={`font-mono font-bold text-xl ${isBuy ? 'text-gain' : 'text-loss'}`}>
              {fmt(total)}
            </span>
          </div>
          {isBuy && profile && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-white/40 text-xs">Balance after</span>
              <span className="font-mono text-sm text-white/60">{fmt(profile.balance - total)}</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-loss/10 border border-loss/20 rounded-xl px-4 py-2.5 mb-4 text-loss text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || sharesNum <= 0}
            className={`flex-1 font-display font-bold py-2.5 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isBuy ? 'btn-primary' : 'btn-danger'}`}
          >
            {loading ? 'Processing...' : `Confirm ${isBuy ? 'Buy' : 'Sell'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
