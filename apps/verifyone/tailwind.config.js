/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Astryx (meta/astryx) neutral theme — LIGHT values resolved from
      // vendor/design-system/astryx-neutral-theme.css (@astryxdesign/theme-neutral
      // 0.7.12, MIT — Meta). "neutral[N]" = steps of its neutral gray ramp.
      // Deviations (documented in README): fonts stay Plus Jakarta/IBM Plex, and
      // accent uses the theme's blue ramp (--color-info) instead of the verbatim
      // monochrome neutral accent.
      colors: {
        ground:              '#f1f1f1',  // neutral[95] — background-body canvas
        ink:                 '#000000',  // neutral[0]  — text-primary
        'ink-secondary':     '#474747',  // neutral[30] — text-secondary
        'ground-muted':      '#e2e2e2',  // neutral[90] — background-gray
        rule:                '#d4d4d4',  // neutral[85] — border-emphasized
        accent:              '#0074e2',  // astryx --color-info light
        'accent-hover':      '#0067ce',  // astryx --color-text-info light
        field:               '#111111',  // neutral[5]  — on-light
        'on-field':          '#ffffff',  // astryx --color-on-dark
        'on-field-secondary':'#9e9e9e',  // neutral[65] — dark text-secondary
        panel:               '#ffffff',  // background-card
        'on-accent':         '#ffffff',  // astryx --color-on-info
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans:    ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
