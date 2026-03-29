/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/panel/**/*.{ts,tsx,html}',
    './src/popup/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f0f1a',
          light: '#1a1a2e',
          lighter: '#16213e',
        },
        copilot: {
          purple: '#7c3aed',
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
