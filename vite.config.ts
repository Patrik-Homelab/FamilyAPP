import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        sveltekit(),
        SvelteKitPWA({
            srcDir: 'src',
            registerType: 'autoUpdate',
            strategies: 'generateSW',
            devOptions: {
                enabled: true
            },
            workbox: {
                globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
                importScripts: ['/webworker/push-worker.js'],
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                    {
                        // Cache uploaded images (presents, debts, shopping items, etc.)
                        urlPattern: /^https?:\/\/.*\/images\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'familyapp-images',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // SvelteKit data requests (__data.json)
                        urlPattern: ({ url }) => url.pathname.includes('__data.json'),
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'familyapp-data',
                            networkTimeoutSeconds: 3,
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // SvelteKit HTML page navigations
                        urlPattern: ({ request }) => request.mode === 'navigate',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'familyapp-pages',
                            networkTimeoutSeconds: 3,
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Fonts and icons
                        urlPattern: ({ url }) =>
                            url.origin.includes('fonts.') ||
                            url.pathname.includes('bootstrap-icons'),
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'familyapp-static',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 365
                            }
                        }
                    }
                ]
            },
            manifest: {
                name:
                    process.env.NODE_ENV === 'production'
                        ? 'Family APP'
                        : 'Family APP - DEV',
                short_name:
                    process.env.NODE_ENV === 'production'
                        ? 'Family APP'
                        : 'Family APP - DEV',
                start_url: '/',
                display: 'standalone',
                background_color: '#0e0201',
                theme_color: '#0e0201',
                lang: 'cs',
                scope: '/',
                icons: [
                    ['57x57', '/icons/apple-touch-icon-57x57.png'],
                    ['114x114', '/icons/apple-touch-icon-114x114.png'],
                    ['72x72', '/icons/apple-touch-icon-72x72.png'],
                    ['144x144', '/icons/apple-touch-icon-144x144.png'],
                    ['60x60', '/icons/apple-touch-icon-60x60.png'],
                    ['120x120', '/icons/apple-touch-icon-120x120.png'],
                    ['76x76', '/icons/apple-touch-icon-76x76.png'],
                    ['152x152', '/icons/apple-touch-icon-152x152.png'],
                    ['196x196', '/icons/favicon-196x196.png'],
                    ['96x96', '/icons/favicon-96x96.png'],
                    ['32x32', '/icons/favicon-32x32.png'],
                    ['16x16', '/icons/favicon-16x16.png'],
                    ['128x128', '/icons/favicon-128.png']
                ].map(([size, path]) => ({
                    src: path,
                    sizes: size,
                    type: 'image/png'
                }))
            }
        })
    ],
    server: {
        fs: {
            allow: ['static/webworker/']
        },
        allowedHosts: ['pc.patrick115.eu', 'familyapp.patrick115.eu']
    }
});
