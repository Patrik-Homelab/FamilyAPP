import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],

    theme: {
        extend: {
            colors: {
                text: '#f3f4f8',
                background: '#0b0d13',
                primary: '#e2e8f0',
                secondary: '#141824',
                accent: '#ef4444'
            },
            fontFamily: {
                poppins: ['Poppins', 'sans-serif'],
                roboto: ['Roboto', 'sans-serif']
            }
        }
    },

    plugins: [
        typography,
        plugin(function ({ addVariant }) {
            addVariant('swatch', [
                '&::-moz-color-swatch',
                '&::-webkit-color-swatch-wrapper',
                '&::-webkit-color-swatch'
            ]);
        })
    ]
} satisfies Config;
