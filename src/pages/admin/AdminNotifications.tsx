import { useState } from 'react';
import { Bell, Zap, Ticket, Trophy, Gamepad2, Gift, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TEMPLATES = [
  { icon: Ticket, label: 'New Lotto Round', title: '🎟️ New Lotto Round is Open!', message: 'A new lottery round just opened — grab your tickets now and win up to $5,000! 🤑', color: 'text-gold' },
  { icon: Trophy, label: 'Lotto Results', title: '🏆 Lotto Results Are In!', message: "The winning numbers have been drawn — check if you're a winner! 🎉", color: 'text-gold' },
  { icon: Gamepad2, label: 'New Game', title: '🎮 New Game Available!', message: "A brand new game just dropped on Shabebz — come play and win big! 🔥", color: 'text-gain' },
  { icon: Gift, label: 'Dividends Ready', title: '💰 Your Dividends Are Waiting!', message: 'You have unclaimed dividends from your stock holdings — log in and collect! 📈', color: 'text-gain' },
  { icon: Zap, label: 'Market Alert', title: '📊 Market is Moving!', message: 'Big changes happening in the market right now — check your portfolio! 🚀', color: 'text-loss' },
  { icon: Sparkles, label: 'Custom', title: '', message: '', color: 'text-white/50' },
];

export default function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setResult(null);
  };

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      setResult({ ok: false, text: 'Please fill in title and message.' });
      return;
    }
    setSending(true);
    setResult(null);

    try {
      // Deactivate old announcements
      await supabase.from('announcements').update({ is_active: false }).eq('is_active', true);

      // Insert new announcement
      const { error: dbErr } = await supabase
        .from('announcements')
        .insert({ title, message, is_active: true });

      if (dbErr) {
        setResult({ ok: false, text: 'Failed: ' + dbErr.message });
        return;
      }

      setSentCount(prev => prev + 1);
      setResult({ ok: true, text: 'Banner sent to all users! ✅' });
      setTitle('');
      setMessage('');
    } catch {
      setResult({ ok: false, text: 'Network error — check your connection.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-gold" /> Announcements
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Send a banner to all users instantly</p>
        </div>
        {sentCount > 0 && (
          <span className="text-white/30 text-xs font-mono">{sentCount} sent this session</span>
        )}
      </div>

      {/* Quick Templates */}
      <div className="card p-5 space-y-3">
        <p className="text-white/40 text-xs uppercase tracking-widest font-mono">Quick Templates</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TEMPLATES.map(tpl => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.label}
                onClick={() => applyTemplate(tpl)}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/8 hover:border-white/15 transition-all text-left group"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${tpl.color}`} />
                <span className="text-white/60 text-xs font-medium group-hover:text-white/80 transition-colors">{tpl.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compose */}
      <div className="card p-5 space-y-4">
        <p className="text-white/40 text-xs uppercase tracking-widest font-mono">Compose</p>

        <div>
          <label className="text-white/40 text-xs mb-1.5 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 🎟️ New Lotto Round is Open!"
            maxLength={100}
            className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gain/40 text-sm"
          />
        </div>

        <div>
          <label className="text-white/40 text-xs mb-1.5 block">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="e.g. A new lottery round just opened — grab your tickets now!"
            maxLength={300}
            rows={3}
            className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gain/40 text-sm resize-none"
          />
          <p className="text-white/20 text-xs mt-1 text-right">{message.length}/300</p>
        </div>

        {(title || message) && (
          <div className="bg-navy-900 rounded-xl p-4 border border-white/8">
            <p className="text-white/30 text-xs mb-2 uppercase tracking-widest font-mono">Preview</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{title || '...'}</p>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{message || '...'}</p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${result.ok ? 'bg-gain/10 border-gain/20 text-gain' : 'bg-loss/10 border-loss/20 text-loss'}`}>
            {result.text}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !title.trim() || !message.trim()}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
            sending || !title.trim() || !message.trim()
              ? 'bg-white/5 text-white/25 cursor-not-allowed'
              : 'btn-gold'
          }`}
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              Send to All Users
            </>
          )}
        </button>
      </div>
    </div>
  );
}
