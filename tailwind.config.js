/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          800: "#1E293B",
          900: "#0F172A",
        },
        emerald: {
          50: "#ECFDF5",
          500: "#10B981",
          600: "#22C55E",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
        },
      },
    },
  },
  plugins: [],
};
