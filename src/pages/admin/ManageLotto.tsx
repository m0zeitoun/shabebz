import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, Play, Plus, Trophy, Users } from 'lucide-react';

interface LotteryRound {
  id: string;
  status: 'open' | 'drawn';
  winning_numbers: number[] | null;
  drawn_at: string | null;
  created_at: string;
}

interface TicketWithUser {
  id: string;
  user_id: string;
  numbers: number[];
  matches: number;
  prize: number;
  created_at: string;
  user: { username: string } | null;
}

const PRIZES: Record<number, number> = { 3: 150, 4: 400, 5: 1000, 6: 2000 };

export default function ManageLotto() {
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchRound = useCallback(async () => {
    const { data } = await supabase
      .from('lottery_rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setRound(data);
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!round) return;
    const { data } = await supabase
      .from('lottery_tickets')
      .select('*, user:users(username)')
      .eq('round_id', round.id)
      .order('created_at', { ascending: false });
    if (data) setTickets(data as TicketWithUser[]);
  }, [round]);

  useEffect(() => {
    setLoading(true);
    fetchRound().finally(() => setLoading(false));
  }, [fetchRound]);

  useEffect(() => {
    if (round) fetchTickets();
  }, [round, fetchTickets]);

  const drawResults = async () => {
    if (!round) return;
    setDrawing(true);

    try {
      // Generate 6 unique random numbers 1-42
      const winning: number[] = [];
      while (winning.length < 6) {
        const n = Math.floor(Math.random() * 42) + 1;
        if (!winning.includes(n)) winning.push(n);
      }
      winning.sort((a, b) => a - b);

      // Update round
      await supabase
        .from('lottery_rounds')
        .update({ status: 'drawn', winning_numbers: winning, drawn_at: new Date().toISOString() })
        .eq('id', round.id);

      // Calculate and pay out winners
      const { data: allTickets } = await supabase
        .from('lottery_tickets')
        .select('*')
        .eq('round_id', round.id);

      if (allTickets) {
        for (const ticket of allTickets) {
          const matches = (ticket.numbers as number[]).filter(n => winning.includes(n)).length;
          const prize = PRIZES[matches] ?? 0;

          // Update ticket
          await supabase
            .from('lottery_tickets')
            .update({ matches, prize })
            .eq('id', ticket.id);

          // Pay winner
          if (prize > 0) {
            const { data: user } = await supabase
              .from('users')
              .select('balance')
              .eq('id', ticket.user_id)
              .single();
            if (user) {
              await supabase
                .from('users')
                .update({ balance: user.balance + prize })
                .eq('id', ticket.user_id);
            }
          }
        }
      }

      await fetchRound();
      await fetchTickets();
    } finally {
      setDrawing(false);
    }
  };

  const newRound = async () => {
    setCreating(true);
    await supabase.from('lottery_rounds').insert({ status: 'open' });
    await fetchRound();
    setCreating(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const totalTickets = tickets.length;
  const totalPot = totalTickets * 50;
  const winners = tickets.filter(t => (t.prize ?? 0) > 0);
  const totalPaidOut = tickets.reduce((s, t) => s + (t.prize ?? 0), 0);

  if (loading) return <div className="shimmer h-48 rounded-2xl" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current Round Status */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
              <Ticket className="w-5 h-5 text-gold" />
              Current Round
            </h2>
            <p className="text-white/30 text-xs mt-0.5">
              Started {round ? new Date(round.created_at).toLocaleString() : '—'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${round?.status === 'open' ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-white/5 text-white/40 border border-white/10'}`}>
            {round?.status === 'open' ? 'OPEN' : 'DRAWN'}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Tickets Sold', value: totalTickets, icon: Ticket },
            { label: 'Pot Size', value: fmt(totalPot), icon: Trophy },
            { label: 'Winners', value: winners.length, icon: Users },
            { label: 'Paid Out', value: fmt(totalPaidOut), icon: Trophy },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-navy-900 rounded-xl p-3">
              <p className="text-white/30 text-xs mb-1">{label}</p>
              <p className="font-display font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Winning Numbers */}
        {round?.status === 'drawn' && round.winning_numbers && (
          <div className="mb-5">
            <p className="text-white/40 text-xs mb-2">Winning Numbers</p>
            <div className="flex gap-2">
              {round.winning_numbers.map(n => (
                <div key={n} className="w-10 h-10 rounded-full rank-gold flex items-center justify-center font-display font-bold text-navy-900">
                  {n}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {round?.status === 'open' && (
            <>
              <button
                onClick={drawResults}
                disabled={drawing || totalTickets === 0}
                className="btn-gold py-3 px-8 text-base"
              >
                <Play className="w-5 h-5" />
                {drawing ? 'Drawing...' : `Draw Results Now (${totalTickets} tickets)`}
              </button>
              {totalTickets === 0 && (
                <p className="text-white/30 text-sm self-center">Waiting for players to buy tickets</p>
              )}
            </>
          )}
          {round?.status === 'drawn' && (
            <button onClick={newRound} disabled={creating} className="btn-primary py-3 px-8 text-base">
              <Plus className="w-5 h-5" />
              {creating ? 'Creating...' : 'Start New Round'}
            </button>
          )}
          {!round && (
            <button onClick={newRound} disabled={creating} className="btn-primary py-3 px-8 text-base">
              <Plus className="w-5 h-5" />
              {creating ? 'Creating...' : 'Start First Round'}
            </button>
          )}
        </div>
      </div>

      {/* All Tickets */}
      <div>
        <h2 className="font-display font-semibold text-white mb-3">
          All Tickets ({totalTickets})
        </h2>
        {tickets.length === 0 ? (
          <div className="card p-10 text-center">
            <Ticket className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No tickets purchased yet</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Player</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase">Numbers</th>
                  <th className="text-center px-4 py-3 text-xs text-white/40 font-medium uppercase">Matches</th>
                  <th className="text-right px-4 py-3 text-xs text-white/40 font-medium uppercase">Prize</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const isWinner = (ticket.prize ?? 0) > 0;
                  return (
                    <tr key={ticket.id} className={`border-b border-white/5 transition-colors ${isWinner ? 'bg-gold/5' : 'hover:bg-white/2'}`}>
                      <td className="px-4 py-3 font-medium text-white/80 text-sm">
                        {Array.isArray(ticket.user) ? ticket.user[0]?.username : ticket.user?.username ?? '?'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {(ticket.numbers as number[]).map(n => {
                            const isMatch = round?.winning_numbers?.includes(n);
                            return (
                              <span key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                round?.status === 'drawn'
                                  ? isMatch ? 'rank-gold text-navy-900' : 'bg-white/5 text-white/30'
                                  : 'bg-white/10 text-white/60'
                              }`}>
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {round?.status === 'drawn' ? (
                          <span className={`text-sm font-bold ${isWinner ? 'text-gold' : 'text-white/30'}`}>
                            {ticket.matches ?? 0}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isWinner ? (
                          <span className="gain-badge">{fmt(ticket.prize)}</span>
                        ) : round?.status === 'drawn' ? (
                          <span className="text-white/20 text-sm">—</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
