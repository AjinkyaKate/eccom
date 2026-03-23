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
          lighter: '#F5F3FF',
          light: '#DDD6FE',
          primary: '#5B21B6',
          dark: '#4C1D95',
          ink: '#241348',
          mist: '#FBFAFF',
        },
      },
      fontFamily: {
        primary: ['"Josefin Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 50px -28px rgba(76, 29, 149, 0.32)',
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
