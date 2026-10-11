import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#F4F9F1',
        surface: '#FFFFFF',
        surface2: '#EAF3E6',
        line: '#D3E2CE',
        fg: '#12261A',
        muted: '#566B5C',
        mint: '#15803D',
        teal: '#0B7A6B',
        amber: '#8F5A06',
        rose: '#B42318',
      },
      fontFamily: {
        heading: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
