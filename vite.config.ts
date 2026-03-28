/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const repoName = env.GITHUB_REPOSITORY?.split('/')[1]
  const base =
    env.VITE_BASE_PATH ??
    (env.GITHUB_ACTIONS === 'true' && repoName ? `/${repoName}/` : '/')

  return {
    base,
    plugins: [react()],
    server: {
      allowedHosts: true,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
