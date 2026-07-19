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
        'primaria-texto': 'var(--cor-primaria-texto)',
        fundo: 'var(--fundo-pagina)',
        'fundo-card': 'var(--superficie-1)',
        'texto': 'var(--texto-principal)',
        'texto-secundario': 'var(--texto-secundario)',
      },
      fontFamily: {
        sans: ['var(--fonte-interface)', 'sans-serif'],
        mono: ['var(--fonte-numeros)', 'monospace'],
      }
    },
  },
  plugins: [],
}
