export interface UserProfile {
  id: string;
  email: string;
  username: string;
  balance: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  initial_price: number;
  max_shares: number;
  issued_shares: number;
  created_at: string;
  updated_at: string;
}

export interface UserStock {
  id: string;
  user_id: string;
  stock_id: string;
  shares_owned: number;
  purchase_price_avg: number;
  created_at: string;
  updated_at: string;
  stock?: Stock;
}

export interface Transaction {
  id: string;
  user_id: string;
  stock_id: string;
  transaction_type: 'buy' | 'sell';
  shares: number;
  price_per_share: number;
  total_amount: number;
  timestamp: string;
  stock?: Stock;
  user?: UserProfile;
}

export interface PriceHistory {
  id: string;
  stock_id: string;
  price: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  balance: number;
  holdings_value: number;
  total_value: number;
  rank: number;
}
