/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#0F172A",
        },
        offwhite: "#F8FAFC",
        accent: {
          mint: "#B8F2E6",
          peach: "#FFD6BA",
          lavender: "#D9D2FF",
          sky: "#C9E4FF",
          butter: "#FFF3B0",
          coral: "#FFC2B4",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
