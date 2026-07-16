import path from 'path';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;
if (!rawPort) throw new Error('PORT environment variable is required.');
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, '..') }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) => m.devBanner()),
        ]
      : []),
  ],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:            path.resolve(import.meta.dirname, 'index.html'),
        login:           path.resolve(import.meta.dirname, 'login.html'),
        signup:          path.resolve(import.meta.dirname, 'signup.html'),
        'forgot-password': path.resolve(import.meta.dirname, 'forgot-password.html'),
        product:         path.resolve(import.meta.dirname, 'product.html'),
        cart:            path.resolve(import.meta.dirname, 'cart.html'),
        checkout:        path.resolve(import.meta.dirname, 'checkout.html'),
        wishlist:        path.resolve(import.meta.dirname, 'wishlist.html'),
        orders:          path.resolve(import.meta.dirname, 'orders.html'),
        profile:         path.resolve(import.meta.dirname, 'profile.html'),
        admin:           path.resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: { strict: false },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
