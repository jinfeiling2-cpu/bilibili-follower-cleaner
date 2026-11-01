const TOKEN = /^[A-Za-z0-9%*._+\-=]{8,512}$/

export function extractSessdata(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const text = raw
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\r?\n/g, "; ")
  if (!text) return null

  const named = text.match(/(?:^|[;\s])SESSDATA=([^;\s]+)/i)
  const token = (named ? named[1] : text).trim()
  if (!named && (text.includes(";") || text.includes(" "))) return null
  if (!TOKEN.test(token)) return null
  return token
}
