import { NextResponse } from "next/server"

import { extractSessdata } from "@/lib/cookie"

export function originDenied(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return null
  const host = request.headers.get("host")
  try {
    if (host && new URL(origin).host === host) return null
  } catch {
    return NextResponse.json({ error: "来源无法识别。" }, { status: 403 })
  }
  return NextResponse.json({ error: "只接受从这个页面发出的请求。" }, { status: 403 })
}

export async function readBody(request: Request) {
  try {
    const body = (await request.json()) as unknown
    if (body && typeof body === "object") return body as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

export function sessdataFrom(body: Record<string, unknown>) {
  const sessdata = extractSessdata(body.sessdata)
  if (!sessdata) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "没有读到可用的 SESSDATA。只粘贴这一项的值就行。" },
        { status: 400 }
      ),
    }
  }
  return { ok: true as const, sessdata }
}

export function parseMid(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number <= 0) return null
  return number
}

export function parsePace(value: unknown) {
  const number = typeof value === "number" ? value : 200
  if (!Number.isFinite(number)) return 200
  return Math.min(800, Math.max(100, Math.round(number)))
}
