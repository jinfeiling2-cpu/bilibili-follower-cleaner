import { NextResponse } from "next/server"

import { BiliError, consumeRisks, fetchMe, setPace } from "@/lib/bilibili"
import { originDenied, parsePace, readBody, sessdataFrom } from "@/lib/guard"

export async function POST(request: Request) {
  const denied = originDenied(request)
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return NextResponse.json({ error: "请求格式不对。" }, { status: 400 })

  try {
    const auth = sessdataFrom(body)
    if (!auth.ok) return auth.response
    setPace(parsePace(body.paceMs))
    const me = await fetchMe(auth.sessdata)
    consumeRisks()
    return NextResponse.json(me)
  } catch (error) {
    if (error instanceof BiliError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: "识别账号失败。" }, { status: 502 })
  }
}
