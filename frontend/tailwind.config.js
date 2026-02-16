/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Refined dark fintech palette
        'rh-black': '#0F1117',
        'rh-dark': '#13151B',
        'rh-card': '#1A1D27',
        'rh-card-hover': '#1F2230',
        'rh-border': '#262A36',
        'rh-border-light': '#2F3444',
        'rh-green': '#00D632',
        'rh-green-dark': '#00B82B',
        'rh-green-glow': 'rgba(0, 214, 50, 0.15)',
        'rh-red': '#FF4444',
        'rh-red-glow': 'rgba(255, 68, 68, 0.15)',
        'rh-text': '#F0F2F5',
        'rh-text-secondary': '#8B8F9E',
        'rh-text-muted': '#565B6B',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'glow-green': '0 0 20px rgba(0, 214, 50, 0.15)',
        'glow-red': '0 0 20px rgba(255, 68, 68, 0.15)',
      },
    },
  },
  plugins: [],
}
