/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primaria: 'var(--cor-primaria)',
        secundaria: 'var(--cor-secundaria)',
        'cor-texto': 'var(--cor-texto)',
        fundo: 'var(--cor-fundo)',
      },
      fontFamily: {
        titulo: ['var(--fonte-titulo)', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
