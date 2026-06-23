import type { OrchidApi } from './types'

declare global {
  interface Window {
    orchid: OrchidApi
  }
}

export {}
