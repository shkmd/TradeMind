import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // TradeMind India semantic tokens
        nav: {
          DEFAULT: "#0E3B2E",
          foreground: "#F5F7F5",
          accent: "#1B5E44",
          border: "#164A38",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F4F5F4",
          border: "#E4E7E4",
        },
        success: {
          DEFAULT: "#10B981",
          foreground: "#065F46",
          muted: "#ECFDF5",
        },
        danger: {
          DEFAULT: "#EF4444",
          foreground: "#7F1D1D",
          muted: "#FEF2F2",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#78350F",
          muted: "#FFFBEB",
        },
        insight: {
          DEFAULT: "#8B5CF6",
          foreground: "#4C1D95",
          muted: "#F5F3FF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
