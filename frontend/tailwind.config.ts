import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#1e3a5f",
          600: "#1a3352",
          700: "#162c45",
          800: "#112437",
          900: "#0d1c2a",
        },
      },
    },
  },
  plugins: [],
};
export default config;
