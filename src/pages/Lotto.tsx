import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ticket, Shuffle, X, Trophy, Clock, CheckCircle, Star } from 'lucide-react';

interface LotteryRound {
  id: string;
  status: 'open' | 'drawn';
  winning_numbers: number[] | null;
  drawn_at: string | null;
  created_at: string;
}

interface LotteryTicket {
  id: string;
  round_id: string;
  user_id: string;
  numbers: number[];
  matches: number;
  prize: number;
  created_at: string;
  user?: { username: string };
}

const TICKET_COST = 20;
const PRIZES: Record<number, number> = { 3: 150, 4: 400, 5: 1000, 6: 2000 };

export default function Lotto() {
  const { profile, refreshProfile } = useAuth();
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [myTickets, setMyTickets] = useState<LotteryTicket[]>([]);
  const [allTickets, setAllTickets] = useState<LotteryTicket[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRound = useCallback(async () => {
    const { data } = await supabase
      .from('lottery_rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setRound(data);
  }, []);

  const fetchMyTickets = useCallback(async () => {
    if (!profile || !round) return;
    const { data } = await supabase
      .from('lottery_tickets')
      .select('*')
      .eq('round_id', round.id)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setMyTickets(data);
  }, [profile, round]);

  const fetchAllTickets = useCallback(async () => {
    if (!round) return;
    const { data } = await supabase
      .from('lottery_tickets')
      .select('*, user:users(username)')
      .eq('round_id', round.id)
      .order('prize', { ascending: false });
    if (data) setAllTickets(data as LotteryTicket[]);
  }, [round]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    fetchRound().finally(() => setLoading(false));
  }, [profile, fetchRound]);

  useEffect(() => {
    if (round) {
      fetchMyTickets();
      fetchAllTickets();
    }
  }, [round, fetchMyTickets, fetchAllTickets]);

  useEffect(() => {
    const sub = supabase
      .channel('lotto-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_rounds' }, fetchRound)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_tickets' }, () => { fetchMyTickets(); fetchAllTickets(); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchRound, fetchMyTickets]);

  const toggleNumber = (n: number) => {
    if (selected.includes(n)) {
      setSelected(selected.filter(x => x !== n));
    } else if (selected.length < 6) {
      setSelected([...selected, n].sort((a, b) => a - b));
    }
  };

  const randomPick = () => {
    const nums: number[] = [];
    while (nums.length < 6) {
      const n = Math.floor(Math.random() * 42) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    setSelected(nums.sort((a, b) => a - b));
  };

  const buyTicket = async () => {
    if (!profile || !round) return;
    if (selected.length !== 6) { setError('Pick exactly 6 numbers'); return; }
    if (profile.balance < TICKET_COST) { setError('Insufficient balance'); return; }

    setBuying(true);
    setError('');
    setSuccess('');

    try {
      // Deduct balance
      const { error: balErr } = await supabase
        .from('users')
        .update({ balance: profile.balance - TICKET_COST })
        .eq('id', profile.id);
      if (balErr) throw balErr;

      // Insert ticket
      const { error: ticketErr } = await supabase
        .from('lottery_tickets')
        .insert({ round_id: round.id, user_id: profile.id, numbers: selected });
      if (ticketErr) throw ticketErr;

      await refreshProfile();
      await fetchMyTickets();
      setSelected([]);
      setSuccess('Ticket purchased! Good luck!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to buy ticket');
    } finally {
      setBuying(false);
    }
  };

  const getMatchCount = (ticket: LotteryTicket) => {
    if (!round?.winning_numbers) return 0;
    return ticket.numbers.filter(n => round.winning_numbers!.includes(n)).length;
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-32 rounded-2xl" />)}
      </div>
    );
  }

  if (!round || round.status === 'drawn') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="section-header flex items-center gap-2">
            <Ticket className="w-6 h-6 text-gold" /> Lotto
          </h1>
          <p className="section-sub">Pick 6 numbers · $50 per ticket · Win up to $2,000</p>
        </div>

        {/* Show results if round was drawn */}
        {round?.status === 'drawn' && round.winning_numbers && (
          <div className="card p-6 border-gold/20 bg-gold/5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-gold" />
              <h2 className="font-display font-bold text-white">Last Draw — Winning Numbers</h2>
            </div>
            <div className="flex gap-3 flex-wrap mb-5">
              {round.winning_numbers.sort((a, b) => a - b).map(n => (
                <div key={n} className="w-12 h-12 rounded-full rank-gold flex items-center justify-center font-display font-bold text-navy-900 text-lg shadow-lg">
                  {n}
                </div>
              ))}
            </div>
            {allTickets.filter(t => (t.prize ?? 0) > 0).length > 0 && (
              <div className="space-y-2">
                <p className="text-white/40 text-sm font-medium mb-3">Winners</p>
                {allTickets.filter(t => (t.prize ?? 0) > 0).map((ticket, idx) => {
                  const username = Array.isArray(ticket.user) ? ticket.user[0]?.username : ticket.user?.username ?? '?';
                  const isMe = ticket.user_id === profile?.id;
                  const rankColors = ['rank-gold', 'rank-silver', 'rank-bronze'];
                  return (
                    <div key={ticket.id} className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-gain/10 border border-gain/20' : 'bg-white/3'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${rankColors[idx] ?? 'bg-white/10 text-white/50'}`}>{idx + 1}</div>
                      <div className="flex-1">
                        <p className="font-display font-semibold text-white text-sm">{username} {isMe && <span className="text-gain text-xs">(you)</span>}</p>
                        <p className="text-white/30 text-xs">{ticket.matches} numbers matched</p>
                      </div>
                      <p className="text-gold font-display font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ticket.prize)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="card p-12 text-center">
          <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/60 font-display font-semibold">Next round coming soon</p>
          <p className="text-white/30 text-sm mt-1">The admin will open the next round shortly</p>
        </div>
      </div>
    );
  }

  const isOpen = round.status === 'open';
  const totalWon = myTickets.reduce((s, t) => s + (t.prize ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header flex items-center gap-2">
            <Ticket className="w-6 h-6 text-gold" /> Lotto
          </h1>
          <p className="section-sub">Pick 6 numbers · $50 per ticket · Win up to $2,000</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${isOpen ? 'bg-gain/10 text-gain border border-gain/20' : 'bg-white/5 text-white/40 border border-white/10'}`}>
          {isOpen ? <><Clock className="w-3 h-3" /> OPEN</> : <><CheckCircle className="w-3 h-3" /> DRAWN</>}
        </div>
      </div>

      {/* Prize Table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(PRIZES).map(([matches, prize]) => (
          <div key={matches} className="card p-4 text-center border-gold/10">
            <p className="text-white/40 text-xs mb-1">{matches} matches</p>
            <p className="font-display font-bold text-gold text-lg">{fmt(prize)}</p>
            <p className="text-white/20 text-xs mt-1">${TICKET_COST} × {prize / TICKET_COST}x</p>
          </div>
        ))}
      </div>

      {/* Winning Numbers (if drawn) */}
      {(round.status as string) === 'drawn' && round.winning_numbers && (
        <div className="card p-6 border-gold/20 bg-gold/5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-gold" />
            <h2 className="font-display font-bold text-white">Winning Numbers</h2>
            <span className="text-white/30 text-xs ml-auto">
              {round.drawn_at ? new Date(round.drawn_at).toLocaleString() : ''}
            </span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {round.winning_numbers.sort((a, b) => a - b).map(n => (
              <div key={n} className="w-12 h-12 rounded-full rank-gold flex items-center justify-center font-display font-bold text-navy-900 text-lg shadow-lg">
                {n}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Results — shown after draw to everyone */}
      {(round.status as string) === 'drawn' && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-white text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> Round Results
            <span className="text-white/30 text-sm font-normal">— visible to all players</span>
          </h2>

          {/* Winners podium */}
          {allTickets.filter(t => (t.prize ?? 0) > 0).length === 0 ? (
            <div className="card p-6 text-center text-white/30 text-sm">No winners this round</div>
          ) : (
            <div className="space-y-2">
              {allTickets.filter(t => (t.prize ?? 0) > 0).map((ticket, idx) => {
                const username = Array.isArray(ticket.user) ? ticket.user[0]?.username : ticket.user?.username ?? '?';
                const isMe = ticket.user_id === profile?.id;
                const matchCount = ticket.matches;
                const rankColors = ['rank-gold', 'rank-silver', 'rank-bronze'];
                return (
                  <div key={ticket.id} className={`card p-4 flex items-center gap-4 ${isMe ? 'border-gain/30 bg-gain/5' : 'border-gold/10 bg-gold/3'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0 ${rankColors[idx] ?? 'bg-white/10 text-white/50'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-white flex items-center gap-2">
                        {username} {isMe && <span className="text-gain text-xs">(you)</span>}
                      </p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {ticket.numbers.map(n => {
                          const isMatch = round.winning_numbers?.includes(n);
                          return (
                            <span key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isMatch ? 'rank-gold text-navy-900' : 'bg-white/5 text-white/30'}`}>
                              {n}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gold font-display font-bold text-lg">{fmt(ticket.prize)}</p>
                      <p className="text-white/30 text-xs">{matchCount} matches</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Non-winners count */}
          {(() => {
            const noWin = allTickets.filter(t => (t.prize ?? 0) === 0).length;
            return noWin > 0 ? (
              <p className="text-white/20 text-sm text-center">{noWin} ticket{noWin !== 1 ? 's' : ''} didn't match enough numbers</p>
            ) : null;
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Number Picker */}
        {isOpen && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white">Pick Your Numbers</h2>
              <button onClick={randomPick} className="btn-ghost text-xs py-1.5 px-3">
                <Shuffle className="w-3.5 h-3.5" /> Random
              </button>
            </div>

            {/* Selected display */}
            <div className="flex gap-2 mb-4 min-h-[44px] flex-wrap">
              {selected.length === 0 ? (
                <p className="text-white/20 text-sm self-center">No numbers selected yet</p>
              ) : selected.map(n => (
                <div key={n} className="w-10 h-10 rounded-full bg-gain/20 border border-gain/40 flex items-center justify-center font-display font-bold text-gain text-sm cursor-pointer hover:bg-loss/20 hover:border-loss/40 hover:text-loss transition-all"
                  onClick={() => toggleNumber(n)}>
                  {n}
                </div>
              ))}
              {selected.length > 0 && (
                <button onClick={() => setSelected([])} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-loss transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Number Grid */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {Array.from({ length: 42 }, (_, i) => i + 1).map(n => {
                const isSelected = selected.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleNumber(n)}
                    className={`w-full aspect-square rounded-lg text-xs font-display font-bold transition-all duration-150 ${
                      isSelected
                        ? 'bg-gain text-navy-900 shadow-lg scale-110'
                        : selected.length >= 6
                        ? 'bg-white/3 text-white/20 cursor-not-allowed'
                        : 'bg-navy-900 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                    disabled={!isSelected && selected.length >= 6}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between text-xs text-white/40 mb-4">
              <span>{selected.length}/6 numbers selected</span>
              <span>Cost: <span className="text-gold font-mono">{fmt(TICKET_COST)}</span></span>
            </div>

            {error && (
              <div className="bg-loss/10 border border-loss/20 text-loss text-sm rounded-xl px-4 py-2.5 mb-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-gain/10 border border-gain/20 text-gain text-sm rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" /> {success}
              </div>
            )}

            <button
              onClick={buyTicket}
              disabled={selected.length !== 6 || buying || (profile?.balance ?? 0) < TICKET_COST}
              className="btn-gold w-full justify-center py-3 text-sm font-bold"
            >
              <Ticket className="w-4 h-4" />
              {buying ? 'Buying...' : `Buy Ticket — ${fmt(TICKET_COST)}`}
            </button>

            <p className="text-white/20 text-xs text-center mt-2">
              Balance after: <span className="font-mono">{fmt((profile?.balance ?? 0) - TICKET_COST)}</span>
            </p>
          </div>
        )}

        {/* My Tickets */}
        <div className={isOpen ? '' : 'lg:col-span-2'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-white/40" />
              My Tickets
              <span className="text-white/30 text-sm font-normal">({myTickets.length})</span>
            </h2>
            {totalWon > 0 && (
              <span className="gain-badge text-sm">Won {fmt(totalWon)}</span>
            )}
          </div>

          {myTickets.length === 0 ? (
            <div className="card p-10 text-center">
              <Ticket className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No tickets yet this round</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {myTickets.map((ticket, idx) => {
                const matchCount = round.status === 'drawn' ? getMatchCount(ticket) : null;
                const prize = matchCount !== null ? (PRIZES[matchCount] ?? 0) : null;
                const isWinner = prize !== null && prize > 0;

                return (
                  <div key={ticket.id} className={`card p-4 transition-all ${isWinner ? 'border-gold/30 bg-gold/5' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/30 text-xs">Ticket #{idx + 1}</span>
                      {matchCount !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isWinner ? 'bg-gold/20 text-gold' : matchCount > 0 ? 'bg-white/10 text-white/50' : 'bg-white/5 text-white/20'
                        }`}>
                          {matchCount} match{matchCount !== 1 ? 'es' : ''} {isWinner ? `· ${fmt(prize!)}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {ticket.numbers.map(n => {
                        const isMatch = round.winning_numbers?.includes(n);
                        return (
                          <div key={n} className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-display font-bold transition-all ${
                            round.status === 'drawn'
                              ? isMatch ? 'rank-gold text-navy-900 shadow-md' : 'bg-white/5 text-white/30'
                              : 'bg-gain/10 text-gain border border-gain/20'
                          }`}>
                            {n}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
