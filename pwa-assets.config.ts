import { createAppleSplashScreens, defineConfig } from '@vite-pwa/assets-generator/config'

const blue = '#2450F0'
const background = '#F2F3F5'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: blue } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: blue } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.68,
        resizeOptions: { background, fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, xhtml: false },
        png: { compressionLevel: 9, quality: 70 },
      },
      ['iPhone 17'],
    ),
  },
  images: ['public/icon.svg'],
})
