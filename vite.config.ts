/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Shown in Settings to confirm on the iPhone that the new version is already applied.
function shortCommit(): string {
  const sha = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

// Routine version = hash of the contents: any change to routine.json is a new version,
// without having to remember to bump a number.
function routineVersion(): string {
  const content = JSON.stringify(JSON.parse(readFileSync('routine/routine.json', 'utf8')))
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

const background = '#F2F3F5'

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify(shortCommit()),
    __ROUTINE_VERSION__: JSON.stringify(routineVersion()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The new version waits until Gonza taps "Actualizar": it never reloads in the middle of a set.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Gym',
        short_name: 'Gym',
        description: 'Registro de entrenamiento',
        lang: 'es-AR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: background,
        theme_color: background,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // The Worker's routes (remote MCP and its sign-in): if Safari has the app's service
        // worker, opening the sign-in page would show the app instead.
        navigateFallbackDenylist: [/^\/(mcp|authorize|token|register)(\/|$)/, /^\/\.well-known\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
