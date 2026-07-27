import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    define: {
        global: 'globalThis',
    },
    publicDir: false,
    build: {
        outDir: 'public/dist',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            external: (id) => id.startsWith('/images/') || id.startsWith('/fonts/'),
            input: {
                app: `${import.meta.dirname}/client/lighterpack.js`,
                share: `${import.meta.dirname}/client/share-entry.js`,
                embed: `${import.meta.dirname}/client/embed-entry.js`,
                // CSS-only entry: /privacy and any future long-form doc page
                // ships no JavaScript, so there is nothing to pair this with.
                doc: `${import.meta.dirname}/client/css/doc.scss`,
            },
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/signin': { target: 'http://localhost:3000', changeOrigin: true },
            '/register': { target: 'http://localhost:3000', changeOrigin: true },
            '/signout': { target: 'http://localhost:3000', changeOrigin: true },
            '/account': { target: 'http://localhost:3000', changeOrigin: true },
            '/saveLibrary': { target: 'http://localhost:3000', changeOrigin: true },
            '/externalId': { target: 'http://localhost:3000', changeOrigin: true },
            '/imageUpload': { target: 'http://localhost:3000', changeOrigin: true },
            '/r': { target: 'http://localhost:3000', changeOrigin: true },
            '/csv': { target: 'http://localhost:3000', changeOrigin: true },
            '/e': { target: 'http://localhost:3000', changeOrigin: true },
            '/forgot-password': { target: 'http://localhost:3000', changeOrigin: true },
            '/delete-account': { target: 'http://localhost:3000', changeOrigin: true },
            '/moderation': { target: 'http://localhost:3000', changeOrigin: true },
            '/privacy': { target: 'http://localhost:3000', changeOrigin: true },
            '/terms': { target: 'http://localhost:3000', changeOrigin: true },
            '/images': { target: 'http://localhost:3000', changeOrigin: true },
            '/fonts': { target: 'http://localhost:3000', changeOrigin: true },
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: ['import', 'legacy-js-api', 'color-functions'],
            },
        },
    },
});
