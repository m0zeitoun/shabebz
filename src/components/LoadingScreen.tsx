export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-2 border-gain/20 rounded-full mx-auto" />
          <div className="w-16 h-16 border-2 border-transparent border-t-gain rounded-full animate-spin absolute inset-0 mx-auto" />
        </div>
        <p className="gradient-text font-display font-bold text-2xl">SHABEBZ</p>
        <p className="text-white/30 text-sm mt-1 font-mono">Loading market data...</p>
      </div>
    </div>
  );
}
