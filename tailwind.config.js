/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050810',
          900: '#0a0e1a',
          800: '#0f1628',
          700: '#141d38',
          600: '#1a2548',
        },
        gain: {
          DEFAULT: '#00ff88',
          dark: '#00cc6a',
          glow: 'rgba(0, 255, 136, 0.3)',
        },
        loss: {
          DEFAULT: '#ff4757',
          dark: '#cc3645',
          glow: 'rgba(255, 71, 87, 0.3)',
        },
        gold: {
          DEFAULT: '#ffd700',
          dark: '#ccac00',
          glow: 'rgba(255, 215, 0, 0.3)',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-gain': 'pulseGain 2s ease-in-out infinite',
        'pulse-loss': 'pulseLoss 2s ease-in-out infinite',
        'ticker': 'ticker 30s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        pulseGain: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 136, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.8), 0 0 40px rgba(0, 255, 136, 0.4)' },
        },
        pulseLoss: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 71, 87, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 71, 87, 0.8), 0 0 40px rgba(255, 71, 87, 0.4)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
