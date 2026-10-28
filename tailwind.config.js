/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ground:              '#fcfcfd',
        ink:                 '#16191f',
        'ink-secondary':     '#454c58',
        'ground-muted':      '#f3f4f6',
        rule:                '#dde0e6',
        accent:              '#074ce0',
        'accent-hover':      '#0541c4',
        field:               '#16191f',
        'on-field':          '#fcfcfd',
        'on-field-secondary':'#d0d4dd',
        panel:               '#ffffff',
        'on-accent':         '#ffffff',
      },
      fontFamily: {
        display: ['"Host Grotesk"', 'sans-serif'],
        sans:    ['"Instrument Sans"', 'sans-serif'],
      },
      borderRadius: {
        panel: '12px',
      },
      transitionDuration: {
        interaction: '160ms',
      },
      transitionTimingFunction: {
        'dp-ease': 'ease-out',
      },
    },
  },
  plugins: [],
};
