import { createWipClient } from '@wip/client'

export const wipClient = createWipClient({
  baseUrl: '/wip',
  auth: { type: 'none' }, // proxy handles auth
})
