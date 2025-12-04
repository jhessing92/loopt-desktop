/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme colors matching Loopt mobile
        'loopt-bg': '#0f172a',
        'loopt-surface': '#1e293b',
        'loopt-surface-hover': '#334155',
        'loopt-border': '#334155',
        'loopt-text': '#f8fafc',
        'loopt-text-muted': '#94a3b8',
        'loopt-accent': '#3b82f6',
        'loopt-accent-hover': '#2563eb',
        'loopt-success': '#10b981',
        'loopt-warning': '#f59e0b',
        'loopt-error': '#ef4444',
        'loopt-pending': '#8b5cf6',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
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
