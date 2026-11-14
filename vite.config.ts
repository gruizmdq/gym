/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Se muestra en Ajustes para confirmar en el iPhone que la versión nueva ya se aplicó.
function commitCorto(): string {
  const sha = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

// Versión de la rutina = hash del contenido: cualquier cambio en rutina.json es una versión nueva,
// sin depender de acordarse de subir un número.
function versionRutina(): string {
  const contenido = JSON.stringify(JSON.parse(readFileSync('rutina/rutina.json', 'utf8')))
  return createHash('sha256').update(contenido).digest('hex').slice(0, 12)
}

const fondo = '#F2F3F5'

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify(commitCorto()),
    __VERSION_RUTINA__: JSON.stringify(versionRutina()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // La versión nueva espera a que Gonza toque "Actualizar": nunca recarga a mitad de una serie.
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
        background_color: fondo,
        theme_color: fondo,
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
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
