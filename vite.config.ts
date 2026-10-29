import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    // The mock server keeps its tables in localStorage, so tests run in a browser-like environment.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
