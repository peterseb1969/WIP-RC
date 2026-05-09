/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // CASE-311 step 2 — palette tokens per papers/ui-guidance.md §1.
      // Coexists with Tailwind's default palette; existing raw utilities
      // (bg-blue-600, text-amber-500, etc.) keep working until step 3
      // sweeps them onto these semantic tokens.
      colors: {
        primary: {
          DEFAULT: '#2B579A',
          light:   '#5B9BD5',
          dark:    '#1E3F6F',
        },
        accent:    '#ED7D31',
        success:   '#2E8B57',
        danger:    '#DC3545',
        surface:   '#FFFFFF',
        background:'#F8FAFC',
        text: {
          DEFAULT: '#333333',
          muted:   '#999999',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
