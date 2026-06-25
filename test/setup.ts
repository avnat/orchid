import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Keep tests isolated: clear persisted state between cases.
afterEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* node-env tests have no localStorage */
  }
})
