/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/panel/**/*.{ts,tsx,html}',
    './src/popup/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Consolas"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
