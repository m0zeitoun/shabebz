import CoinFlip from './games/CoinFlip';

export default function Games() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-header">Games</h1>
        <p className="section-sub">Play to grow your balance</p>
      </div>

      <CoinFlip />
    </div>
  );
}
