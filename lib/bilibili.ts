import { createHash } from "node:crypto"
import { fetch as undiciFetch } from "undici"

import type { FollowingUser, InspectResult, Me } from "@/lib/types"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
]

const MESSAGES: Record<number, string> = {
  [-101]: "账号未登录。SESSDATA 无效、过期，或没贴全。",
  [-111]: "登录校验失败，请重新复制 SESSDATA。",
  [-352]: "B 站风控没有通过。进度已保留，等一两分钟再点继续。",
  [-400]: "请求参数不被 B 站接受。",
  [-404]: "这个用户不存在。",
  [-412]: "请求被 B 站拦截。进度已保留，稍后再继续。",
  22115: "这个账号隐藏了关注列表。",
  22007: "翻页超过了 B 站允许的范围。",
}

type BiliJson = {
  code?: number
  message?: string
  data?: Record<string, unknown> | null
}

type Slot = {
  buvid3: string
  buvid4: string
  mixin: string
  wbiAt: number
  queue: Promise<void>
  last: number
  minGap: number
  risks: number
}

export class BiliError extends Error {
  code?: number
  status: number

  constructor(message: string, code?: number, status = 502) {
    super(message)
    this.name = "BiliError"
    this.code = code
    this.status = status
  }
}

export function mixinKey(imgKey: string, subKey: string) {
  const raw = imgKey + subKey
  let out = ""
  for (let index = 0; index < 32; index += 1) {
    out += raw[MIXIN_TAB[index]] ?? ""
  }
  return out
}

export function buildSignedQuery(
  params: Record<string, string>,
  mixin: string,
  wts = Math.floor(Date.now() / 1000)
) {
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    cleaned[key] = value.replace(/[!'()*]/g, "")
  }
  cleaned.wts = String(wts)
  const query = Object.keys(cleaned)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(cleaned[key])}`)
    .join("&")
  const rid = createHash("md5").update(query + mixin).digest("hex")
  return `${query}&w_rid=${rid}`
}

export function biliMessage(code: number | undefined, message?: string) {
  if (code != null && MESSAGES[code]) return MESSAGES[code]
  if (message && message.length > 0 && message.length < 80 && !/https?:/i.test(message)) {
    return `B 站：${message}`
  }
  return `B 站返回错误${code == null ? "" : `（${code}）`}`
}

function slot(): Slot {
  const root = globalThis as typeof globalThis & { __biliFollowSlot?: Slot }
  if (!root.__biliFollowSlot) {
    root.__biliFollowSlot = {
      buvid3: "",
      buvid4: "",
      mixin: "",
      wbiAt: 0,
      queue: Promise.resolve(),
      last: 0,
      minGap: 200,
      risks: 0,
    }
  }
  return root.__biliFollowSlot
}

export function setPace(ms: number) {
  slot().minGap = Math.min(800, Math.max(100, Math.round(ms)))
}

export function consumeRisks() {
  const state = slot()
  const risks = state.risks
  state.risks = 0
  return risks
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function paced<T>(task: () => Promise<T>) {
  const state = slot()
  const run = state.queue.then(async () => {
    const wait = state.minGap - (Date.now() - state.last)
    if (wait > 0) await sleep(wait)
    state.last = Date.now()
    return task()
  })
  state.queue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function keyFromUrl(url: string) {
  const file = url.split("/").pop() ?? ""
  return file.split(".")[0] ?? ""
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function asString(value: unknown) {
  return typeof value === "string" ? value : ""
}

async function rawGet(url: string, referer: string, sessdata?: string) {
  const state = slot()
  const cookie = [
    state.buvid3 ? `buvid3=${state.buvid3}` : "",
    state.buvid4 ? `buvid4=${state.buvid4}` : "",
    sessdata ? `SESSDATA=${sessdata}` : "",
  ]
    .filter(Boolean)
    .join("; ")

  let response: Awaited<ReturnType<typeof undiciFetch>>
  try {
    response = await undiciFetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: referer,
        "User-Agent": UA,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new BiliError("连不上 B 站，检查一下网络后再继续。")
  }

  const text = await response.text()
  let json: BiliJson
  try {
    json = JSON.parse(text) as BiliJson
  } catch {
    throw new BiliError(
      response.status === 412
        ? biliMessage(-412)
        : "B 站返回了无法识别的内容。"
    )
  }
  if (response.status === 412 && json.code == null) json.code = -412
  return json
}

function cacheWbi(json: BiliJson) {
  const data = asRecord(json.data)
  const wbi = asRecord(data?.wbi_img)
  const img = keyFromUrl(asString(wbi?.img_url))
  const sub = keyFromUrl(asString(wbi?.sub_url))
  if (img && sub) {
    const state = slot()
    state.mixin = mixinKey(img, sub)
    state.wbiAt = Date.now()
  }
}

async function ensureIdentity() {
  const state = slot()
  const fresh = state.mixin && Date.now() - state.wbiAt < 30 * 60 * 1000
  if (state.buvid3 && state.buvid4 && fresh) return

  if (!state.buvid3 || !state.buvid4) {
    const spi = await rawGet(
      "https://api.bilibili.com/x/frontend/finger/spi",
      "https://www.bilibili.com/"
    )
    const data = asRecord(spi.data)
    const buvid3 = asString(data?.b_3)
    const buvid4 = asString(data?.b_4)
    if (!buvid3 || !buvid4) {
      throw new BiliError("没有拿到 B 站的访问标识，稍后再试。")
    }
    state.buvid3 = buvid3
    state.buvid4 = buvid4
  }

  if (!fresh) {
    const nav = await rawGet(
      "https://api.bilibili.com/x/web-interface/nav",
      "https://www.bilibili.com/"
    )
    cacheWbi(nav)
    if (!slot().mixin) throw new BiliError("没有拿到 B 站签名参数，稍后再试。")
  }
}

function isRisk(json: BiliJson) {
  return json.code === -352 || json.code === -412
}

async function biliGet(
  url: string,
  referer: string,
  sessdata?: string,
  sign?: () => string
) {
  return paced(async () => {
    let last: BiliJson = {}
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await ensureIdentity()
      const finalUrl = sign ? `${url}?${sign()}` : url
      last = await rawGet(finalUrl, referer, sessdata)
      if (!isRisk(last) || attempt === 2) return last
      const state = slot()
      state.risks += 1
      state.mixin = ""
      state.wbiAt = 0
      state.buvid3 = ""
      state.buvid4 = ""
      await sleep(1200 * (attempt + 1))
    }
    return last
  })
}

export async function fetchMe(sessdata: string): Promise<Me> {
  const nav = await biliGet(
    "https://api.bilibili.com/x/web-interface/nav",
    "https://www.bilibili.com/",
    sessdata
  )
  cacheWbi(nav)
  const data = asRecord(nav.data)
  if (nav.code !== 0 || !data?.isLogin) {
    throw new BiliError(biliMessage(nav.code, nav.message), nav.code, 401)
  }
  const mid = asNumber(data.mid)
  if (mid == null) throw new BiliError("登录状态里没有 UID。", nav.code, 502)

  let following: number | null = null
  let follower: number | null = null
  try {
    const stat = await biliGet(
      "https://api.bilibili.com/x/web-interface/nav/stat",
      "https://www.bilibili.com/",
      sessdata
    )
    const statData = asRecord(stat.data)
    if (stat.code === 0 && statData) {
      following = asNumber(statData.following)
      follower = asNumber(statData.follower)
    }
  } catch {
    following = null
  }

  return {
    mid,
    uname: asString(data.uname) || `UID ${mid}`,
    face: asString(data.face),
    following,
    follower,
  }
}

export async function fetchFollowingPage(
  vmid: number,
  page: number,
  sessdata: string
) {
  const url = new URL("https://api.bilibili.com/x/relation/followings")
  url.searchParams.set("vmid", String(vmid))
  url.searchParams.set("pn", String(page))
  url.searchParams.set("ps", "50")
  const json = await biliGet(
    url.toString(),
    `https://space.bilibili.com/${vmid}/fans/follow`,
    sessdata
  )
  if (json.code !== 0) {
    const status = json.code === -101 ? 401 : json.code === 22115 ? 400 : 502
    throw new BiliError(biliMessage(json.code, json.message), json.code, status)
  }
  const data = asRecord(json.data)
  const rawList = data?.list
  if (!Array.isArray(rawList)) {
    if (page === 1) {
      throw new BiliError("关注列表是空的，或对方把列表设成了不可见。", 22115, 400)
    }
    return { total: asNumber(data?.total) ?? 0, list: [] as FollowingUser[] }
  }

  const list: FollowingUser[] = []
  for (const item of rawList) {
    const row = asRecord(item)
    const mid = asNumber(row?.mid)
    if (!row || mid == null) continue
    const official = asRecord(row.official_verify)
    const officialType = asNumber(official?.type) ?? -1
    list.push({
      mid,
      uname: asString(row.uname) || `UID ${mid}`,
      face: asString(row.face),
      sign: asString(row.sign),
      official: asString(official?.desc),
      officialType,
      special: asNumber(row.special) === 1,
      mutual: asNumber(row.attribute) === 6,
      mtime: asNumber(row.mtime) ?? 0,
    })
  }

  return { total: asNumber(data?.total) ?? list.length, list }
}

function blankInspect(mid: number, status: InspectResult["status"]): InspectResult {
  return {
    mid,
    status,
    fans: null,
    videos: null,
    articles: null,
    likes: null,
    level: null,
    lastPub: null,
    lastTitle: null,
    lastPlay: null,
    recentAvgPlay: null,
    recentCount: 0,
    viewsHidden: false,
  }
}

function usablePlay(item: Record<string, unknown>) {
  if (item.hide_click === true) return null
  if (asNumber(item.enable_vt) === 1) return null
  const play = asNumber(item.play)
  if (play == null || play < 0) return null
  return play
}

async function readVideos(mid: number, sampleSize: number, sessdata: string | undefined, result: InspectResult) {
  const json = await biliGet(
    "https://api.bilibili.com/x/space/wbi/arc/search",
    `https://space.bilibili.com/${mid}/video`,
    sessdata,
    () =>
      buildSignedQuery(
        {
          mid: String(mid),
          order: "pubdate",
          pn: "1",
          ps: String(sampleSize),
        },
        slot().mixin
      )
  )
  if (json.code !== 0) {
    result.error = biliMessage(json.code, json.message)
    return
  }
  const data = asRecord(json.data)
  const list = asRecord(data?.list)
  const vlist = Array.isArray(list?.vlist) ? list.vlist : []
  const plays: number[] = []
  let hidden = 0
  vlist.forEach((item, index) => {
    const row = asRecord(item)
    if (!row) return
    if (index === 0) {
      result.lastTitle = asString(row.title) || null
      result.lastPub = asNumber(row.created)
      result.lastPlay = usablePlay(row)
    }
    const play = usablePlay(row)
    if (play == null) hidden += 1
    else plays.push(play)
  })
  result.recentCount = vlist.length
  result.viewsHidden = vlist.length > 0 && plays.length === 0 && hidden > 0
  result.recentAvgPlay = plays.length
    ? Math.round(plays.reduce((sum, play) => sum + play, 0) / plays.length)
    : null
}

export async function inspectMid(
  mid: number,
  sampleSize: number,
  sessdata?: string
): Promise<InspectResult> {
  let json: BiliJson
  try {
    json = await biliGet(
      `https://api.bilibili.com/x/web-interface/card?mid=${mid}`,
      `https://space.bilibili.com/${mid}`,
      sessdata
    )
  } catch (error) {
    const result = blankInspect(mid, "error")
    result.error = error instanceof Error ? error.message : "名片获取失败"
    return result
  }

  if (json.code === -404) return blankInspect(mid, "missing")
  const data = asRecord(json.data)
  const card = asRecord(data?.card)
  if (json.code !== 0 || !card) {
    const result = blankInspect(mid, "error")
    result.error = biliMessage(json.code, json.message)
    return result
  }

  const name = asString(card.name) || `UID ${mid}`
  const spacesta = asNumber(card.spacesta)
  const silence = asNumber(card.silence)
  const status = name.includes("账号已注销")
    ? "cancelled"
    : spacesta === -2 || silence === 1
      ? "banned"
      : "ok"
  const level = asRecord(card.level_info)
  const result: InspectResult = {
    mid,
    status,
    uname: name,
    face: asString(card.face),
    sign: asString(card.sign),
    fans: asNumber(data?.follower) ?? asNumber(card.fans),
    videos: asNumber(data?.archive_count),
    articles: asNumber(data?.article_count),
    likes: asNumber(data?.like_num),
    level: asNumber(level?.current_level),
    lastPub: null,
    lastTitle: null,
    lastPlay: null,
    recentAvgPlay: null,
    recentCount: 0,
    viewsHidden: false,
  }

  if ((result.videos ?? 0) > 0 && sampleSize > 0 && status !== "cancelled") {
    try {
      await readVideos(mid, sampleSize, sessdata, result)
    } catch (error) {
      result.error = error instanceof Error ? error.message : "投稿列表获取失败"
    }
  }
  return result
}
