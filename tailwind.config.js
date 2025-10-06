// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#eef9ff',
            100: '#d8f1ff',
            200: '#b8e8ff',
            300: '#85daff',
            400: '#4bc2ff',
            500: '#1ea6ff',
            600: '#0087ff',
            700: '#006ce0',
            800: '#0058b5',
            900: '#084b8e',
            950: '#082f5c',
          },
          secondary: {
            50: '#f0f9ff',
            100: '#dff2ff',
            200: '#b8e8ff',
            300: '#78d5ff',
            400: '#39bbff',
            500: '#09a0ff',
            600: '#007fd8',
            700: '#0068b4',
            800: '#005794',
            900: '#064979',
            950: '#042e4f',
          },
          accent: {
            50: '#f2fbf9',
            100: '#d5f3ed',
            200: '#aae5db',
            300: '#73d0c3',
            400: '#42b4a7',
            500: '#28a59b',
            600: '#19827c',
            700: '#166769',
            800: '#165255',
            900: '#154547',
            950: '#082c2c',
          },
        },
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['Poppins', 'sans-serif'],
        },
        boxShadow: {
          soft: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          card: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        },
      },
    },
    plugins: [],
  }