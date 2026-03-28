import { useState } from 'react';
import { Coins, Bird, Circle } from 'lucide-react';
import CoinFlip from './games/CoinFlip';
import ChickenRoad from './games/ChickenRoad';
import BlueBalls from './games/BlueBalls';

type Tab = 'coinflip' | 'chicken' | 'blueballs';

const TABS: { id: Tab; label: string; icon: typeof Coins }[] = [
  { id: 'coinflip',  label: 'Coin Flip',    icon: Coins  },
  { id: 'chicken',   label: "Yaghi's Road",  icon: Bird   },
  { id: 'blueballs', label: 'Blue Balls',    icon: Circle },
];

export default function Games() {
  const [tab, setTab] = useState<Tab>('coinflip');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-header">Games</h1>
        <p className="section-sub">Play to grow your balance</p>
      </div>

      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
              tab === id
                ? 'border-gain text-gain'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'coinflip'  && <CoinFlip />}
      {tab === 'chicken'   && <ChickenRoad />}
      {tab === 'blueballs' && <BlueBalls />}
    </div>
  );
}
