import type { OrchidApi } from './index'

declare global {
  interface Window {
    orchid: OrchidApi
  }
}

export {}
