import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment: the save-file core is pure logic + Web Crypto, no DOM needed.
    // Node 18+ provides globalThis.crypto.subtle, File and Blob natively.
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Real 4-9 MB saves get decrypted per suite; give slow boxes room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
