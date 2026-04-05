import { createWipClient } from '@wip/client'

export const wipClient = createWipClient({
  baseUrl: '/wip',
  // auth omitted — wip-proxy injects the API key server-side
})
