/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        palette: {
          lighter: '#FFF4EC',
          light:   '#FDDCBC',
          primary: '#F07820',
          dark:    '#C45E10',
          ink:     '#1A0800',
          mist:    '#FFFAF6',
        },
      },
      fontFamily: {
        primary: ['"Josefin Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px -28px rgba(196, 94, 16, 0.28)',
      },
      maxWidth: {
        shell: '74rem',
      },
      height: {
        120: '30rem',
      },
      minHeight: {
        80: '20rem',
      },
    },
  },
  plugins: [],
};
