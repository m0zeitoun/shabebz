# Shabebz — Setup Guide

## 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) → New Project → fill in details.

## 2. Run the Database Setup

In your Supabase dashboard → **SQL Editor** → paste and run the contents of `supabase-setup.sql`.

## 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your values from Supabase → Settings → API:
- `VITE_SUPABASE_URL` = your Project URL
- `VITE_SUPABASE_ANON_KEY` = your `anon` public key

## 4. Install & Run

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`

## 5. Create Your First Admin

1. Sign up through the app
2. In Supabase SQL Editor, run:
   ```sql
   update public.users set is_admin = true where email = 'your@email.com';
   ```
3. Sign out and back in — you'll see the **Admin** tab

## 6. Add Stocks

Go to **Admin → Stocks → New Stock** and create your friend group's stocks!

## Seed Data (Quick Start)

To add example stocks, run in SQL Editor:

```sql
insert into public.stocks (name, ticker, current_price, initial_price, max_shares) values
  ('Ali Yaghi Enterprises', 'ALYG', 25.00, 25.00, 500),
  ('Hassan Holdings',       'HSHD', 15.50, 15.50, 800),
  ('Omar Tech Corp',        'OMTC', 42.00, 42.00, 300),
  ('Khalid Capital',        'KHCP',  8.75,  8.75, 1000),
  ('Shabebz Index Fund',    'SHBZ', 100.00, 100.00, 200);

-- Log initial prices in history
insert into public.price_history (stock_id, price)
select id, current_price from public.stocks;
```

## Deploy to Vercel

```bash
npm run build
# Then drag the dist/ folder to vercel.com, or use the Vercel CLI
vercel --prod
```

Set your environment variables in Vercel → Project Settings → Environment Variables.
