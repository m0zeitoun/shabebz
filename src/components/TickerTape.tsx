import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Stock } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function TickerTape() {
  const [stocks, setStocks] = useState<Stock[]>([]);

  useEffect(() => {
    const fetchStocks = async () => {
      const { data } = await supabase.from('stocks').select('*').order('name');
      if (data) setStocks(data);
    };
    fetchStocks();

    const sub = supabase
      .channel('ticker-stocks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, fetchStocks)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  if (stocks.length === 0) return null;

  const items = [...stocks, ...stocks]; // Duplicate for seamless loop

  const pct = (s: Stock) => ((s.current_price - s.initial_price) / s.initial_price * 100);

  return (
    <div className="border-b border-white/5 bg-navy-800/40 py-1.5 overflow-hidden">
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {items.map((s, i) => {
            const change = pct(s);
            const isGain = change >= 0;
            return (
              <span key={`${s.id}-${i}`} className="inline-flex items-center gap-1.5 px-6 text-xs">
                <span className="font-display font-bold text-white/80 uppercase">{s.ticker}</span>
                <span className="font-mono text-white/60">${s.current_price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 font-mono ${isGain ? 'text-gain' : 'text-loss'}`}>
                  {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isGain ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className="text-white/10">|</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
