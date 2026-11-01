import { NextResponse } from "next/server"

import { consumeRisks, inspectMid, setPace } from "@/lib/bilibili"
import { extractSessdata } from "@/lib/cookie"
import { originDenied, parseMid, parsePace, readBody } from "@/lib/guard"

export async function POST(request: Request) {
  const denied = originDenied(request)
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return NextResponse.json({ error: "请求格式不对。" }, { status: 400 })

  const rawMids = Array.isArray(body.mids) ? body.mids : []
  if (rawMids.length === 0 || rawMids.length > 8) {
    return NextResponse.json({ error: "一次最多体检 8 个账号。" }, { status: 400 })
  }
  const mids: number[] = []
  for (const item of rawMids) {
    const mid = parseMid(item)
    if (mid == null) return NextResponse.json({ error: "名单里有无效 UID。" }, { status: 400 })
    mids.push(mid)
  }

  const sample = typeof body.sampleSize === "number" ? body.sampleSize : 5
  const sampleSize = Math.min(8, Math.max(0, Math.round(sample)))
  const sessdata = extractSessdata(body.sessdata) ?? undefined
  setPace(parsePace(body.paceMs))

  const results = []
  for (const mid of mids) {
    results.push(await inspectMid(mid, sampleSize, sessdata))
  }
  const risks = consumeRisks()
  return NextResponse.json({ results, riskDelayMs: risks > 0 ? 2500 : 0 })
}
