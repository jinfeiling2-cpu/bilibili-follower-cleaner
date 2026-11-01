import { NextResponse } from "next/server"

import { BiliError, consumeRisks, fetchFollowingPage, setPace } from "@/lib/bilibili"
import { originDenied, parseMid, parsePace, readBody, sessdataFrom } from "@/lib/guard"

export async function POST(request: Request) {
  const denied = originDenied(request)
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return NextResponse.json({ error: "请求格式不对。" }, { status: 400 })

  const vmid = parseMid(body.vmid)
  const page = parseMid(body.page)
  if (vmid == null || page == null || page > 400) {
    return NextResponse.json({ error: "UID 或页码不正确。" }, { status: 400 })
  }

  try {
    const auth = sessdataFrom(body)
    if (!auth.ok) return auth.response
    setPace(parsePace(body.paceMs))
    const result = await fetchFollowingPage(vmid, page, auth.sessdata)
    const risks = consumeRisks()
    return NextResponse.json({ ...result, page, riskDelayMs: risks > 0 ? 2500 : 0 })
  } catch (error) {
    if (error instanceof BiliError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: "拉取关注列表失败。" }, { status: 502 })
  }
}
