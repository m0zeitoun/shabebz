import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminSettings() {
  const [rate, setRate] = useState('');
  const [current, setCurrent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'dividend_rate')
      .single()
      .then(({ data }) => {
        if (data) {
          const pct = parseFloat(data.value) * 100;
          setCurrent(pct);
          setRate(pct.toString());
        }
      });
  }, []);

  const save = async () => {
    const pct = parseFloat(rate);
    if (isNaN(pct) || pct < 0 || pct > 100) return setMsg('Enter a valid percentage (0–100)');
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .update({ value: (pct / 100).toFixed(4) })
      .eq('key', 'dividend_rate');
    setSaving(false);
    if (error) return setMsg('Failed to save: ' + error.message);
    setCurrent(pct);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-md">
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="font-display font-bold text-white text-lg">Dividend Rate</h2>
          <p className="text-white/40 text-sm mt-1">
            % of total holdings value paid to players per hour when they claim.
          </p>
        </div>

        {current !== null && (
          <div className="bg-navy-900 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-white/40 text-sm">Current rate</span>
            <span className="font-mono font-bold text-gold text-lg">{current}% / hr</span>
          </div>
        )}

        <div>
          <label className="text-white/40 text-xs mb-2 block">New rate (%)</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="e.g. 5"
              min={0}
              max={100}
              step={0.1}
              className="flex-1 bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gain/40 font-mono text-lg"
            />
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary px-6 py-3 font-bold"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 5, 10].map(v => (
              <button
                key={v}
                onClick={() => setRate(v.toString())}
                className="flex-1 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p className={`text-sm font-semibold ${msg === 'Saved!' ? 'text-gain' : 'text-loss'}`}>
            {msg}
          </p>
        )}

        <div className="border-t border-white/5 pt-4 space-y-2 text-xs text-white/30">
          <p>Example with <span className="text-white/50">{rate || '?'}%</span> rate:</p>
          <p>• Player with $1,000 in shares → earns <span className="text-gold font-mono">${((parseFloat(rate) || 0) / 100 * 1000).toFixed(2)}/hr</span></p>
          <p>• Player with $5,000 in shares → earns <span className="text-gold font-mono">${((parseFloat(rate) || 0) / 100 * 5000).toFixed(2)}/hr</span></p>
          <p>• Player with $10,000 in shares → earns <span className="text-gold font-mono">${((parseFloat(rate) || 0) / 100 * 10000).toFixed(2)}/hr</span></p>
        </div>
      </div>
    </div>
  );
}
