/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        urs: {
          blue:   "#003366",
          light:  "#004d99",
          orange: "#ff6f00",
          gold:   "#ffa000"
        }
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body:    ["'Source Serif 4'", "serif"]
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out",
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "bounce-in":  "bounceIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "marquee":    "marquee 20s linear infinite"
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: "translateY(24px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        bounceIn:  { from: { opacity: 0, transform: "scale(0.85)" }, to: { opacity: 1, transform: "scale(1)" } },
        pulseGlow: { "0%,100%": { boxShadow: "0 0 0 0 rgba(22,163,74,0.4)" }, "50%": { boxShadow: "0 0 0 8px rgba(22,163,74,0)" } },
        marquee:   { from: { transform: "translateX(100%)" }, to: { transform: "translateX(-100%)" } }
      }
    }
  },
  plugins: []
};
