import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    base: './', // Use relative paths for Electron
    plugins: [
        react(),
        nodePolyfills({
            // Enable polyfills for specific globals and modules
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            protocolImports: true,
        }),
    ],
    server: {
        port: 5173,
    },
    optimizeDeps: {
        exclude: ['rss-parser'],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // manualChunks: undefined, // Let Vite handle chunking automatically
            },
            // treeshake: true, // Default is true
        },
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
})
