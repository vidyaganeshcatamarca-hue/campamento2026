import type { Config } from "tailwindcss";

export default {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Vrindavan Nature UI Palette
                primary: {
                    DEFAULT: '#2D5A27', // Verde Bosque Profundo
                    light: '#3a7332',
                    dark: '#1f3f1b',
                },
                secondary: {
                    DEFAULT: '#8DAA91', // Verde Musgo Suave
                    light: '#a8c2ac',
                    dark: '#6d8a70',
                },
                accent: {
                    DEFAULT: '#E67E22', // Naranja Atardecer
                    light: '#f39c12',
                    dark: '#ca6f1e',
                },
                background: '#F9F7F2', // Hueso/Crema
                foreground: '#2C3E50', // Pizarra Oscuro
                muted: '#7F8C8D', // Gris Ceniza
                danger: '#C0392B', // Rojo Ladrillo
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '12px',
            },
        },
    },
    plugins: [],
} satisfies Config;
