/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./journal/*.html",
    "./journal/issues/*.html",
    "./retreats/*.html",
    "./content/**/*.html",
    "./templates/*.html"
  ],
  darkMode: ['attribute', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        clay: '#D95D39',
        'brand-black': '#1C1C1C',
        'brand-gray': '#666666',
        'brand-gold': '#C5A059',
        'brand-cream': '#FDFBF7',
        paper: '#FDFBF7',
        sage: '#4A5D4F'
      },
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
        display: ['Marcellus', 'serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      letterSpacing: { 'widest-xl': '0.25em' },
      animation: { 'marquee': 'marquee 120s linear infinite' },
      keyframes: {
        'marquee': { '0%': { transform: 'translateX(0%)' }, '100%': { transform: 'translateX(-50%)' } }
      }
    }
  },
  safelist: [
    { pattern: /^(bg|text|border)-(clay|sage|brand-black|brand-gray|brand-gold|brand-cream|paper)$/, variants: ['hover', 'focus', 'dark'] }
  ]
}
