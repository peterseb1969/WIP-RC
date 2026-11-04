import { useWipClient } from '@wip/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AttachmentBulkResult, AttachmentRequest } from '@wip/client'
import { attachmentErrorMessage } from '@/lib/attachments'

export const ATTACHMENTS_KEY = ['rc-console', 'attachments'] as const

/** Every attachment record, active and inactive. */
export function useAttachments() {
  const client = useWipClient()
  return useQuery({
    queryKey: ATTACHMENTS_KEY,
    queryFn: async () => (await client.registry.listAttachments({ page_size: 1000 })).items,
    staleTime: 30_000,
  })
}

/** The single item of a bulk write, or its refusal as an error. */
function only(res: { results: AttachmentBulkResult[] }): AttachmentBulkResult {
  const item = res.results[0]
  if (!item) throw new Error('The Registry returned no result')
  if (item.status === 'error') throw new Error(attachmentErrorMessage(item))
  return item
}

/** Create, replace or revive one attachment (a write replaces the whole record). */
export function useSaveAttachment(onDone?: (item: AttachmentBulkResult) => void) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: AttachmentRequest) => only(await client.registry.upsertAttachments([req])),
    onSuccess: item => onDone?.(item),
    onSettled: () => qc.invalidateQueries({ queryKey: ATTACHMENTS_KEY }),
  })
}

/** Deactivate one attachment; the record stays and can be revived. */
export function useDeactivateAttachment() {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => only(await client.registry.deactivateAttachments([name])),
    onSettled: () => qc.invalidateQueries({ queryKey: ATTACHMENTS_KEY }),
  })
}
