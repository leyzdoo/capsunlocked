import type { Config } from "tailwindcss";

// Color tokens ported directly from Compas.html's CSS custom properties
// (see Compás migration doc §5.4). Keeping the names identical so the
// custody color-coding logic (custodyColor(), whoLabel()) reads the same
// in the port as it did in the original app.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        james: "#3b6ea5", // James = blue
        ale: "#a5573b", // Alejandra = rust/brown
        mixed: "#5c6470", // both/split = slate
        fog: "#9a9a9a", // unknown = neutral grey
        paper: "#faf7f2",
        ink: "#2a2620",
      },
      fontFamily: {
        display: ["'IBM Plex Serif'", "serif"],
        sans: ["'IBM Plex Sans'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
