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
        fs: { deny: [`${import.meta.dirname}/config/**`] },
    },
    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: ['import', 'legacy-js-api', 'color-functions'],
            },
        },
    },
});
