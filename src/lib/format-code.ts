/** Languages the query-surface editor supports. */
export type CodeLanguage = 'sql' | 'json'

/**
 * Pretty-print query text. SQL uses sql-formatter's PostgreSQL dialect (loaded
 * on first use); JSON is re-serialised with two-space indents. Rejects when the
 * text cannot be parsed (invalid JSON, or SQL the formatter cannot tokenise),
 * so callers keep the text as typed.
 */
export async function formatCode(language: CodeLanguage, text: string): Promise<string> {
  if (!text.trim()) return text
  if (language === 'json') return JSON.stringify(JSON.parse(text), null, 2)
  const { format } = await import('sql-formatter')
  return format(text, { language: 'postgresql', keywordCase: 'upper', tabWidth: 2 })
}
