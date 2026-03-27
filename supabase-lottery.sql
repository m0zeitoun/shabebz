-- =====================================================
-- SHABEBZ LOTTO - Add these tables to your Supabase
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Lottery rounds (one active round at a time)
create table if not exists public.lottery_rounds (
  id uuid default uuid_generate_v4() primary key,
  status text check (status in ('open', 'drawn')) not null default 'open',
  winning_numbers integer[] default null,
  drawn_at timestamptz default null,
  created_at timestamptz not null default now()
);

-- Player tickets
create table if not exists public.lottery_tickets (
  id uuid default uuid_generate_v4() primary key,
  round_id uuid references public.lottery_rounds(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  numbers integer[] not null,
  matches integer default 0,
  prize numeric(12,4) default 0,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_lottery_tickets_round_id on public.lottery_tickets(round_id);
create index if not exists idx_lottery_tickets_user_id on public.lottery_tickets(user_id);

-- RLS
alter table public.lottery_rounds enable row level security;
alter table public.lottery_tickets enable row level security;

-- Rounds: anyone authenticated can view
create policy "Lottery rounds viewable by all"
  on public.lottery_rounds for select
  to authenticated using (true);

-- Rounds: only admins can insert/update
create policy "Lottery rounds manageable by admins"
  on public.lottery_rounds for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- Tickets: users can see all tickets (for results transparency)
create policy "Lottery tickets viewable by all"
  on public.lottery_tickets for select
  to authenticated using (true);

-- Tickets: users can insert their own
create policy "Users can buy lottery tickets"
  on public.lottery_tickets for insert
  to authenticated
  with check (user_id = auth.uid());

-- Tickets: admins can update (to set matches/prize on draw)
create policy "Admins can update tickets"
  on public.lottery_tickets for update
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- Realtime
alter publication supabase_realtime add table public.lottery_rounds;
alter publication supabase_realtime add table public.lottery_tickets;

-- Create the first open round
insert into public.lottery_rounds (status) values ('open');

-- =====================================================
-- DONE! Now run the app and go to /lotto
-- =====================================================
