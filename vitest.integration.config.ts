import { fileURLToPath, URL } from 'node:url'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Integration tests run against the linked Supabase project. Credentials come from the
 * gitignored .env.test.local (see .env.test.example). Run with `npm run test:db`.
 */
// Load .env.test.local into process.env so both global setup and test workers see it.
Object.assign(process.env, loadEnv('test', process.cwd(), ''))

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/support/global-setup.ts'],
    // Files run one at a time: each request to the remote project has noticeable latency,
    // and parallel fixture setup can saturate the connection and time out.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 240_000,
  },
})
