/**
 * Tests for finalAnswerFrom — how the NL agent turns a final (non-tool-use)
 * response into the user-facing answer (server/nl/query.ts).
 */
import { describe, it, expect } from 'vitest'
import { finalAnswerFrom } from '../../server/nl/query'

const text = (t: string) => ({ type: 'text', text: t, citations: null }) as never
const thinking = { type: 'thinking', thinking: '', signature: 'sig' } as never

describe('finalAnswerFrom', () => {
  it('joins the text blocks and ignores thinking blocks, wherever they sit', () => {
    expect(finalAnswerFrom({ stop_reason: 'end_turn', content: [thinking, text('There are '), text('**42** documents.')] }))
      .toBe('There are **42** documents.')
  })

  it('explains a refusal, with its category, instead of returning empty text', () => {
    const answer = finalAnswerFrom({ stop_reason: 'refusal', content: [], stop_details: { category: 'cyber' } })
    expect(answer).toMatch(/declined/)
    expect(answer).toMatch(/cyber/)
  })

  it('handles a refusal without a category', () => {
    expect(finalAnswerFrom({ stop_reason: 'refusal', content: [], stop_details: null })).toMatch(/declined to answer this question\./)
  })

  it('keeps a truncated answer and says it was cut off', () => {
    const answer = finalAnswerFrom({ stop_reason: 'max_tokens', content: [text('Partial table')] })
    expect(answer.startsWith('Partial table')).toBe(true)
    expect(answer).toMatch(/cut off/)
  })

  it('says when the conversation no longer fits the context window', () => {
    expect(finalAnswerFrom({ stop_reason: 'model_context_window_exceeded', content: [] })).toMatch(/too long/)
  })
})
