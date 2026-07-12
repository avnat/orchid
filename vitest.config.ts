import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Standalone config for unit tests — independent of electron.vite.config.ts
// (which targets the Electron build, not a test runner). Tests default to the
// jsdom environment for renderer logic; main-process tests opt into Node with a
// `// @vitest-environment node` pragma at the top of the file.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer/src') }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only the modules unit tests are responsible for. The Electron bootstrap
      // (src/main/index.ts) and React view components are exercised by the
      // headless end-to-end render checks, not unit-covered here.
      include: [
        'src/main/fs-scan.ts',
        'src/main/version.ts',
        'src/main/shortcuts.ts',
        'src/main/crash-summary.ts',
        'src/renderer/src/themes.ts',
        'src/renderer/src/store/useStore.ts',
        'src/renderer/src/markdown/langs.ts',
        'src/renderer/src/markdown/exportDoc.ts',
        'src/renderer/src/lib/accelerator.ts',
        'src/renderer/src/lib/pathMatch.ts'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100
      }
    }
  }
})
