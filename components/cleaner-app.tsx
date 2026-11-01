"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast, Toaster } from "sonner"

import { ResultsPanel } from "@/components/results-panel"
import { SetupPanel } from "@/components/setup-panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { extractSessdata } from "@/lib/cookie"
import { DEMO_ME, demoUsers } from "@/lib/demo"
import { FOLLOWING_PAGE_SIZE, isStalePage, mergeFollowings } from "@/lib/followings"
import { PRESETS } from "@/lib/presets"
import type {
  FollowingUser,
  InspectResult,
  Mark,
  Me,
  PresetId,
  SavedUser,
  Thresholds,
} from "@/lib/types"

const DATA_KEY = "bili-follow-check:v1"
const COOKIE_KEY = "bili-follow-check:sessdata"

type Phase = "idle" | "followings" | "inspect" | "paused" | "done"

type Persisted = {
  version: 1
  source: "live" | "demo" | null
  uid: string
  me: Me | null
  users: SavedUser[]
  total: number | null
  nextPage: number
  followingsDone: boolean
  marks: Record<string, Mark>
  thresholds: Thresholds
  preset: PresetId | "custom"
  paceMs: number
  checkVideos: boolean
}

type FollowingsPayload = {
  total: number
  list: FollowingUser[]
  riskDelayMs?: number
}

type InspectPayload = {
  results: InspectResult[]
  riskDelayMs?: number
}

export function CleanerApp() {
  const [hydrated, setHydrated] = useState(false)
  const [sessdata, setSessdata] = useState("")
  const [remember, setRemember] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [uid, setUid] = useState("")
  const [thresholds, setThresholds] = useState<Thresholds>(PRESETS.zombie)
  const [preset, setPreset] = useState<PresetId | "custom">("zombie")
  const [paceMs, setPaceMs] = useState(200)
  const [checkVideos, setCheckVideos] = useState(true)
  const [users, setUsers] = useState<SavedUser[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [nextPage, setNextPage] = useState(1)
  const [followingsDone, setFollowingsDone] = useState(false)
  const [marks, setMarks] = useState<Record<number, Mark | undefined>>({})
  const [phase, setPhase] = useState<Phase>("idle")
  const [source, setSource] = useState<"live" | "demo" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState("")
  const [identifying, setIdentifying] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const quotaWarned = useRef(false)

  const sessRef = useRef(sessdata)
  const paceRef = useRef(paceMs)
  const checkRef = useRef(checkVideos)
  const usersRef = useRef(users)
  const sourceRef = useRef(source)
  const doneRef = useRef(followingsDone)
  const totalRef = useRef(total)
  const uidRef = useRef(uid)
  const runRef = useRef(0)
  const stopRef = useRef(false)

  useEffect(() => {
    sessRef.current = sessdata
    paceRef.current = paceMs
    checkRef.current = checkVideos
    usersRef.current = users
    sourceRef.current = source
    doneRef.current = followingsDone
    totalRef.current = total
    uidRef.current = uid
  })

  useEffect(() => {
    // 登录凭证和体检进度只存在浏览器里，服务端首屏读不到。
    /* eslint-disable react-hooks/set-state-in-effect */
    const remembered = localStorage.getItem(COOKIE_KEY)
    const sessionCookie = sessionStorage.getItem(COOKIE_KEY)
    if (remembered) {
      setSessdata(remembered)
      setRemember(true)
    } else if (sessionCookie) {
      setSessdata(sessionCookie)
    }

    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw) as Persisted
        if (data.version === 1 && Array.isArray(data.users)) {
          setSource(data.source)
          setUid(data.uid || "")
          setMe(data.me)
          setUsers(data.users)
          setTotal(data.total)
          setNextPage(data.nextPage || 1)
          setFollowingsDone(Boolean(data.followingsDone))
          setThresholds(data.thresholds || PRESETS.zombie)
          setPreset(data.preset || "custom")
          setPaceMs(data.paceMs || 200)
          setCheckVideos(data.checkVideos !== false)
          const restored: Record<number, Mark | undefined> = {}
          for (const [key, value] of Object.entries(data.marks || {})) {
            if (value === "keep" || value === "done") restored[Number(key)] = value
          }
          setMarks(restored)
          const complete =
            data.followingsDone &&
            data.users.length > 0 &&
            data.users.every((user) => user.inspect && user.inspect.status !== "error")
          setPhase(data.users.length === 0 ? "idle" : complete ? "done" : "paused")
          if (!complete && data.users.length > 0) setStatusLine("上次的进度还在，可以继续")
          if (complete) setStatusLine("上次的体检结果还在")
        }
      } catch {
        setError("上次保存在浏览器里的进度读不出来了，可以重新体检。")
      }
    }
    setHydrated(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const payload: Persisted = {
      version: 1,
      source,
      uid,
      me,
      users,
      total,
      nextPage,
      followingsDone,
      marks: Object.fromEntries(
        Object.entries(marks).flatMap(([key, value]) => (value ? [[key, value] as const] : []))
      ),
      thresholds,
      preset,
      paceMs,
      checkVideos,
    }
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(payload))
    } catch {
      if (!quotaWarned.current) {
        quotaWarned.current = true
        toast.error("浏览器存不下全部进度了。这次结果还在页面上，但刷新后可能丢失。")
      }
    }
  }, [hydrated, source, uid, me, users, total, nextPage, followingsDone, marks, thresholds, preset, paceMs, checkVideos])

  useEffect(() => {
    if (!hydrated) return
    if (remember && sessdata) localStorage.setItem(COOKIE_KEY, sessdata)
    else localStorage.removeItem(COOKIE_KEY)
    if (sessdata) sessionStorage.setItem(COOKIE_KEY, sessdata)
    else sessionStorage.removeItem(COOKIE_KEY)
  }, [hydrated, remember, sessdata])

  const checked = useMemo(
    () => users.filter((user) => user.inspect && user.inspect.status !== "error").length,
    [users]
  )
  const running = phase === "followings" || phase === "inspect"
  const showCount = followingsDone ? checked : users.length
  const showTotal = followingsDone ? users.length : total
  const followRatio = followingsDone ? 1 : showTotal ? Math.min(1, users.length / showTotal) : 0
  const inspectRatio = users.length ? checked / users.length : 0
  const progress =
    phase === "idle" && users.length === 0
      ? 0
      : Math.round(followRatio * 12 + inspectRatio * 88)

  async function identify() {
    setError(null)
    setIdentifying(true)
    try {
      const data = await postJson<Me>("/api/bilibili/me", { sessdata, paceMs })
      setMe(data)
      setUid(String(data.mid))
      toast.success(`已识别 ${data.uname}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "识别失败")
    } finally {
      setIdentifying(false)
    }
  }

  function showDemo() {
    stopRef.current = true
    runRef.current += 1
    const sample = demoUsers()
    setSource("demo")
    setUsers(sample)
    setTotal(sample.length)
    setFollowingsDone(true)
    setNextPage(1)
    setPhase("done")
    setMarks({})
    setError(null)
    setStatusLine("示例清单")
    setMe(DEMO_ME)
    toast("这是虚构账号，用来看筛选结果")
  }

  async function run(mode: "fresh" | "resume") {
    const id = ++runRef.current
    stopRef.current = false
    const alive = () => runRef.current === id && !stopRef.current
    const uidNumber = Number(uidRef.current)
    if (!extractSessdata(sessRef.current) || !Number.isSafeInteger(uidNumber) || uidNumber <= 0) {
      setError("先填好 SESSDATA，并确认 UID 是数字。")
      return
    }

    const fromDemo = sourceRef.current === "demo"
    const reset = mode === "fresh" || fromDemo
    let list = reset ? [] : [...usersRef.current]
    let page = 1
    let done = reset ? false : doneRef.current
    let knownTotal = reset ? null : totalRef.current
    if (fromDemo) setMarks({})
    setSource("live")
    setError(null)
    if (reset) {
      setUsers([])
      setFollowingsDone(false)
      setNextPage(1)
      setTotal(null)
    }

    try {
      if (!done) {
        setPhase("followings")
        let stalePages = 0
        while (alive()) {
          const got = list.length
          setStatusLine(
            knownTotal
              ? `正在拉取关注，已获得 ${got} / ${knownTotal}`
              : `正在拉取关注，已获得 ${got}`
          )
          const data = await postJson<FollowingsPayload>("/api/bilibili/followings", {
            sessdata: sessRef.current,
            vmid: uidNumber,
            page,
            paceMs: paceRef.current,
          })
          knownTotal = data.total
          setTotal(data.total)
          if (data.list.length === 0) {
            if ((knownTotal ?? 0) > list.length && list.length > 0 && list.length <= 100) {
              setError("只拿到了大约 100 个关注。B 站只让你看全自己的关注列表，请确认 Cookie 和 UID 属于同一个账号。")
            }
            done = true
            break
          }
          const merged = mergeFollowings(
            list,
            data.list.map((user) => ({ ...user, inspect: null }))
          )
          const added = merged.added
          list = merged.users
          setUsers([...list])
          if (knownTotal != null && list.length >= knownTotal) {
            done = true
            break
          }
          if (isStalePage(page, FOLLOWING_PAGE_SIZE, got, added)) stalePages += 1
          else stalePages = 0
          if (stalePages >= 2) {
            setError(
              `拉到 ${list.length} 个之后，后面的页面没有新的人。已改成每页 ${FOLLOWING_PAGE_SIZE} 个；如果人数还是远少于关注总数，请确认 Cookie 和 UID 是同一个账号。`
            )
            break
          }
          page += 1
          setNextPage(page)
          if (data.riskDelayMs) await sleep(data.riskDelayMs)
          if (!alive()) break
        }
        setFollowingsDone(done)
        if (!alive()) {
          setPhase("paused")
          setStatusLine("已暂停，进度留在这台浏览器里")
          return
        }
        if (!done) {
          setPhase("paused")
          setStatusLine(`关注名单还没拉完，已获得 ${list.length}${knownTotal ? ` / ${knownTotal}` : ""}`)
          return
        }
      }

      setPhase("inspect")
      const attempted = new Set<number>()
      let riskStreak = 0
      while (alive()) {
        const pending = list.filter(
          (user) => (!user.inspect || user.inspect.status === "error") && !attempted.has(user.mid)
        )
        if (pending.length === 0) break
        const chunk = pending.slice(0, 6)
        const saved = list.filter((user) => user.inspect && user.inspect.status !== "error").length
        setStatusLine(`正在体检 ${saved} / ${list.length}`)
        const data = await postJson<InspectPayload>("/api/bilibili/inspect", {
          sessdata: sessRef.current,
          mids: chunk.map((user) => user.mid),
          sampleSize: checkRef.current ? 5 : 0,
          paceMs: paceRef.current,
        })
        const byMid = new Map(data.results.map((item) => [item.mid, item]))
        let blocked = 0
        let succeeded = 0
        list = list.map((user) => {
          const result = byMid.get(user.mid)
          if (!result) return user
          if (result.status === "error" && result.retry) {
            blocked += 1
            return user
          }
          attempted.add(user.mid)
          if (result.status !== "error") succeeded += 1
          return {
            ...user,
            uname: result.uname || user.uname,
            face: result.face || user.face,
            sign: result.sign ?? user.sign,
            inspect: result,
          }
        })
        setUsers([...list])
        if (blocked > 0 && succeeded === 0) {
          riskStreak += 1
          if (riskStreak >= 2) {
            setPhase("paused")
            setStatusLine(`已查完 ${saved} / ${list.length}。B 站开始拦截，先停住。`)
            setError("已查完的结果都还在。等一两分钟再点继续，会从还没查完的人接着查。")
            return
          }
          setStatusLine("B 站有风控迹象，自动放慢一点")
          await sleep(Math.max(data.riskDelayMs ?? 0, 8000))
        } else {
          riskStreak = 0
          if (data.riskDelayMs) await sleep(data.riskDelayMs)
        }
      }
      if (!alive()) {
        setPhase("paused")
        setStatusLine("已暂停，进度留在这台浏览器里")
        return
      }
      const left = list.filter((user) => !user.inspect || user.inspect.status === "error").length
      if (left > 0) {
        setPhase("paused")
        setStatusLine(`还有 ${left} 个没查完，可以点继续`)
        return
      }
      setPhase("done")
      setStatusLine("体检完成")
      toast.success("体检完成，建议取关的人在右边")
    } catch (caught) {
      if (!alive()) return
      setPhase("paused")
      setStatusLine("已暂停")
      setError(caught instanceof Error ? `${caught.message} 进度已保存，可以继续。` : "体检中断了，进度已保存。")
    }
  }

  function clearAll() {
    stopRef.current = true
    runRef.current += 1
    localStorage.removeItem(DATA_KEY)
    localStorage.removeItem(COOKIE_KEY)
    sessionStorage.removeItem(COOKIE_KEY)
    setSessdata("")
    setRemember(false)
    setMe(null)
    setUid("")
    setUsers([])
    setMarks({})
    setTotal(null)
    setNextPage(1)
    setFollowingsDone(false)
    setPhase("idle")
    setSource(null)
    setError(null)
    setStatusLine("")
    setThresholds(PRESETS.zombie)
    setPreset("zombie")
    setPaceMs(200)
    setCheckVideos(true)
    setClearOpen(false)
    toast("已清除这台浏览器里的进度和 Cookie")
  }

  function markUser(mid: number, mark: Mark | null) {
    setMarks((current) => {
      const next = { ...current }
      if (mark == null) delete next[mid]
      else next[mid] = mark
      return next
    })
    if (mark === "done") toast.success("已标成取关。这只是给你自己看的记号。")
    if (mark === "keep") toast("已标成先留着，不会再出现在建议里")
  }

  return (
    <>
      <Toaster position="top-center" />
      <div className={`mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10 ${running ? "pb-24 lg:pb-10" : ""}`}>
        <header className="max-w-3xl">
          <p className="text-xs font-medium tracking-[0.18em] text-primary">BILIBILI</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">关注体检</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            从你自己的关注里，把已经失效、很久不更新、投稿极少、播放很低、粉丝很少的账号拣出来。清单只供你决定，打开主页后自己点取关。
          </p>
        </header>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <SetupPanel
            sessdata={sessdata}
            remember={remember}
            me={me}
            uid={uid}
            thresholds={thresholds}
            preset={preset}
            paceMs={paceMs}
            checkVideos={checkVideos}
            phase={source === "demo" ? "idle" : phase}
            progress={source === "demo" ? 0 : progress}
            statusLine={statusLine}
            inspected={source === "demo" ? 0 : showCount}
            total={source === "demo" ? null : showTotal}
            identifying={identifying}
            onSessdata={setSessdata}
            onRemember={setRemember}
            onUid={setUid}
            onThresholds={(value) => {
              setPreset("custom")
              setThresholds(value)
            }}
            onPreset={(id) => {
              setPreset(id)
              setThresholds(PRESETS[id])
            }}
            onPace={setPaceMs}
            onCheckVideos={setCheckVideos}
            onIdentify={() => void identify()}
            onStart={() => void run("fresh")}
            onPause={() => {
              stopRef.current = true
              setStatusLine("这一页查完就暂停")
            }}
            onResume={() => void run("resume")}
            onRescan={() => {
              if (window.confirm("会重新拉取关注和体检结果。已经标过的「先留着」和「已取关」还会留着。")) {
                void run("fresh")
              }
            }}
            onDemo={showDemo}
            onHelp={() => setHelpOpen(true)}
            onClear={() => setClearOpen(true)}
          />
          <ResultsPanel users={users} thresholds={thresholds} marks={marks} source={source} onMark={markUser} />
        </div>
      </div>

      {running ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm">{statusLine}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                stopRef.current = true
                setStatusLine("这一页查完就暂停")
              }}
            >
              暂停
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>怎么拿到 SESSDATA</DialogTitle>
            <DialogDescription>
              它等于你的登录状态。只粘贴到你自己打开的这个页面，不要发给别人，也不要贴到聊天记录里。
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
            <li>在电脑浏览器打开 bilibili.com，并登录你的账号。</li>
            <li>按 F12，打开「应用 / Application」→ Cookies → https://www.bilibili.com。</li>
            <li>找到名为 SESSDATA 的一项，复制它的值。也可以整段 Cookie 一起粘贴，页面会自己取出这一项。</li>
            <li>贴到左侧，点「识别我的账号」。确认昵称是你本人后再开始。</li>
            <li>用完点「清除本机进度和 Cookie」。公共电脑不要勾选记住。</li>
          </ol>
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清除这台浏览器里的记录？</DialogTitle>
            <DialogDescription>
              关注名单、体检结果、保留和已取关标记、以及 SESSDATA 都会删掉。B 站上的关注不会变化。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={clearAll}>
              清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("页面和本地服务失去了联系。")
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(data?.error || `请求失败（${response.status}）`)
  return data as T
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
