-- =====================================================
-- SHABEBZ - Stock Market Game Database Setup
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension (usually pre-enabled in Supabase)
create extension if not exists "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  username text unique not null,
  balance numeric(12, 4) not null default 1000,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stocks table
create table if not exists public.stocks (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  ticker text unique not null,
  current_price numeric(12, 4) not null,
  initial_price numeric(12, 4) not null,
  max_shares integer not null default 1000,
  issued_shares integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User portfolio (which stocks each user owns)
create table if not exists public.user_stocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  shares_owned integer not null default 0,
  purchase_price_avg numeric(12, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, stock_id)
);

-- Transaction history
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  transaction_type text check (transaction_type in ('buy', 'sell')) not null,
  shares integer not null,
  price_per_share numeric(12, 4) not null,
  total_amount numeric(12, 4) not null,
  timestamp timestamptz not null default now()
);

-- Price history (for sparklines and tracking)
create table if not exists public.price_history (
  id uuid default uuid_generate_v4() primary key,
  stock_id uuid references public.stocks(id) on delete cascade not null,
  price numeric(12, 4) not null,
  timestamp timestamptz not null default now()
);

-- =====================================================
-- INDEXES (for performance)
-- =====================================================

create index if not exists idx_user_stocks_user_id on public.user_stocks(user_id);
create index if not exists idx_user_stocks_stock_id on public.user_stocks(stock_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_stock_id on public.transactions(stock_id);
create index if not exists idx_transactions_timestamp on public.transactions(timestamp desc);
create index if not exists idx_price_history_stock_id on public.price_history(stock_id);
create index if not exists idx_price_history_timestamp on public.price_history(timestamp);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

alter table public.users enable row level security;
alter table public.stocks enable row level security;
alter table public.user_stocks enable row level security;
alter table public.transactions enable row level security;
alter table public.price_history enable row level security;

-- Users: anyone authenticated can read all users (for leaderboard)
-- Users can only update their own row
create policy "Users are viewable by authenticated users"
  on public.users for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

-- Stocks: viewable by all, manageable by admins only
create policy "Stocks are viewable by authenticated users"
  on public.stocks for select
  to authenticated
  using (true);

create policy "Stocks are manageable by admins"
  on public.stocks for all
  to authenticated
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- User stocks: users can see their own, admins can see all
create policy "Users can view own holdings"
  on public.user_stocks for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Users can manage own holdings"
  on public.user_stocks for all
  to authenticated
  using (user_id = auth.uid());

-- Transactions: users can see their own, admins can see all
create policy "Users can view own transactions"
  on public.transactions for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

create policy "Users can insert own transactions"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Price history: viewable by all authenticated users
create policy "Price history viewable by all"
  on public.price_history for select
  to authenticated
  using (true);

create policy "Price history insertable by all authenticated"
  on public.price_history for insert
  to authenticated
  with check (true);

create policy "Price history deletable by admins"
  on public.price_history for delete
  to authenticated
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- =====================================================
-- REALTIME (enable real-time subscriptions)
-- =====================================================

-- Enable realtime for the tables we want live updates on
alter publication supabase_realtime add table public.stocks;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.user_stocks;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.price_history;

-- =====================================================
-- SEED DATA (optional - delete if you want a clean start)
-- =====================================================

-- Example: Create your first admin user
-- After signing up through the app, run this with your user's UUID:
-- update public.users set is_admin = true where id = 'your-user-uuid-here';

-- Example stocks to get started (run after setting up):
-- insert into public.stocks (name, ticker, current_price, initial_price, max_shares) values
--   ('Ali Yaghi Enterprises', 'ALYG', 25.00, 25.00, 500),
--   ('Hassan Holdings', 'HSHD', 15.50, 15.50, 800),
--   ('Omar Tech Corp', 'OMTC', 42.00, 42.00, 300),
--   ('Khalid Capital', 'KHCP', 8.75, 8.75, 1000),
--   ('Shabebz Index Fund', 'SHBZ', 100.00, 100.00, 200);

-- =====================================================
-- DONE!
-- =====================================================
-- Next steps:
-- 1. Copy your Supabase URL and anon key to .env
-- 2. Run: npm run dev
-- 3. Sign up for an account
-- 4. Make yourself admin by running in SQL editor:
--    update public.users set is_admin = true where email = 'your@email.com';
-- 5. Go to /admin to create stocks and manage users
-- =====================================================
