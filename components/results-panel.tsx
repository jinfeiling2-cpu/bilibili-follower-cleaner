"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Avatar } from "@/components/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { explainReason, formatAgo, formatDate, formatNumber, REASON_LABEL } from "@/lib/format"
import { judge } from "@/lib/judge"
import type { Judgement, Mark, ReasonCode, SavedUser, Thresholds } from "@/lib/types"

const PAGE_SIZE = 12

const REASONS: ReasonCode[] = [
  "invalid",
  "banned",
  "inactive",
  "no_videos",
  "few_videos",
  "low_views",
  "low_fans",
]

type TabId = "suggested" | "all" | "keep" | "done"
type SortId = "score" | "fans" | "views" | "inactive" | "videos" | "follow"

export function ResultsPanel({
  users,
  thresholds,
  marks,
  source,
  onMark,
}: {
  users: SavedUser[]
  thresholds: Thresholds
  marks: Record<number, Mark | undefined>
  source: "live" | "demo" | null
  onMark: (mid: number, mark: Mark | null) => void
}) {
  const [tab, setTab] = useState<TabId>("suggested")
  const [reason, setReason] = useState<ReasonCode | "all">("all")
  const [sort, setSort] = useState<SortId>("score")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [focus, setFocus] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const filterKey = `${query}\n${reason}\n${tab}\n${sort}\n${JSON.stringify(thresholds)}`
  const [filterMark, setFilterMark] = useState(filterKey)
  if (filterMark !== filterKey) {
    setFilterMark(filterKey)
    setPage(1)
    setFocusIndex(0)
  }

  const rows = useMemo(
    () => users.map((user) => ({ user, judgement: judge(user, thresholds) })),
    [users, thresholds]
  )

  const counts = useMemo(() => {
    const byReason = Object.fromEntries(REASONS.map((code) => [code, 0])) as Record<ReasonCode, number>
    let suggested = 0
    let keep = 0
    let done = 0
    for (const row of rows) {
      const mark = marks[row.user.mid]
      if (mark === "keep") keep += 1
      if (mark === "done") done += 1
      if (row.judgement.suggested && !mark) {
        suggested += 1
        for (const code of row.judgement.reasons) byReason[code] += 1
      }
    }
    return { suggested, keep, done, byReason, all: rows.length }
  }, [rows, marks])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = rows.filter((row) => {
      if (needle) {
        const hay = `${row.user.uname} ${row.user.mid}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (reason !== "all" && !row.judgement.reasons.includes(reason)) return false
      const mark = marks[row.user.mid]
      if (tab === "suggested") return row.judgement.suggested && !mark
      if (tab === "keep") return mark === "keep"
      if (tab === "done") return mark === "done"
      return true
    })
    return list.sort((a, b) => compareRows(a, b, sort))
  }, [rows, query, reason, tab, marks, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const focused = filtered[Math.min(focusIndex, Math.max(0, filtered.length - 1))]

  useEffect(() => {
    if (!focus) return
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return
      }
      if (event.key === "ArrowRight") setFocusIndex((index) => Math.min(filtered.length - 1, index + 1))
      if (event.key === "ArrowLeft") setFocusIndex((index) => Math.max(0, index - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [focus, filtered.length])

  function exportCsv() {
    if (filtered.length === 0) {
      toast("当前筛选没有可以导出的人")
      return
    }
    const header = ["UID", "昵称", "粉丝", "视频投稿", "专栏", "近期平均播放", "最近投稿", "命中理由", "命中分", "空间"]
    const lines = filtered.map(({ user, judgement }) => [
      user.mid,
      user.uname,
      user.inspect?.fans ?? "",
      user.inspect?.videos ?? "",
      user.inspect?.articles ?? "",
      user.inspect?.recentAvgPlay ?? "",
      user.inspect?.lastPub ? formatDate(user.inspect.lastPub) : "",
      judgement.reasons.map((code) => REASON_LABEL[code]).join("、"),
      judgement.score,
      `https://space.bilibili.com/${user.mid}`,
    ])
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "bilibili-unfollow-list.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出 ${filtered.length} 人`)
  }

  async function copyUids() {
    if (filtered.length === 0) {
      toast("当前筛选没有 UID")
      return
    }
    try {
      await navigator.clipboard.writeText(filtered.map((row) => row.user.mid).join("\n"))
      toast.success(`已复制 ${filtered.length} 个 UID`)
    } catch {
      toast.error("复制失败，浏览器没有开放剪贴板")
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" id="results">
      {source === "demo" ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          这是 14 个虚构账号，用来看清单长什么样。识别你的账号并开始体检后，会换成你的关注。
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="已拉到" value={counts.all} />
        <Stat label="建议取关" value={counts.suggested} accent />
        <Stat label="先留着" value={counts.keep} />
        <Stat label="已标记取关" value={counts.done} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={reason === "all"} onClick={() => setReason("all")}>
          全部理由
        </FilterChip>
        {REASONS.map((code) => (
          <FilterChip key={code} active={reason === code} onClick={() => setReason(code)}>
            {REASON_LABEL[code]} {counts.byReason[code]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜昵称或 UID"
          className="h-10 sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          排序
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortId)}
            className="h-10 rounded-lg border border-input bg-card px-2 text-sm text-foreground"
          >
            <option value="score">命中分从高到低</option>
            <option value="fans">粉丝从少到多</option>
            <option value="views">播放从低到高</option>
            <option value="inactive">最久没更新</option>
            <option value="videos">投稿从少到多</option>
            <option value="follow">关注时间从早到晚</option>
          </select>
        </label>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="suggested">建议取关 {counts.suggested}</TabsTrigger>
          <TabsTrigger value="all">全部 {counts.all}</TabsTrigger>
          <TabsTrigger value="keep">先留着 {counts.keep}</TabsTrigger>
          <TabsTrigger value="done">已取关 {counts.done}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={focus ? "default" : "outline"} onClick={() => setFocus((value) => !value)} disabled={filtered.length === 0}>
          {focus ? "回到列表" : "逐个处理"}
        </Button>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          导出当前筛选
        </Button>
        <Button type="button" variant="outline" onClick={copyUids} disabled={filtered.length === 0}>
          复制 UID
        </Button>
        <p className="self-center text-xs text-muted-foreground">打开主页后，在 B 站自己点「已关注」。</p>
      </div>

      {filtered.length === 0 ? (
        <Empty tab={tab} hasUsers={users.length > 0} searching={query.trim() !== ""} />
      ) : focus && focused ? (
        <FocusCard
          user={focused.user}
          judgement={focused.judgement}
          thresholds={thresholds}
          mark={marks[focused.user.mid]}
          index={Math.min(focusIndex, filtered.length - 1)}
          total={filtered.length}
          onPrev={() => setFocusIndex((index) => Math.max(0, index - 1))}
          onNext={() => setFocusIndex((index) => Math.min(filtered.length - 1, index + 1))}
          onMark={(mark) => {
            onMark(focused.user.mid, mark)
            if (mark === "done" || mark === "keep") {
              setFocusIndex((index) => Math.min(index, Math.max(0, filtered.length - 2)))
            }
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ user, judgement }) => (
            <UserCard
              key={user.mid}
              user={user}
              judgement={judgement}
              thresholds={thresholds}
              mark={marks[user.mid]}
              onMark={(mark) => onMark(user.mid, mark)}
            />
          ))}
          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button type="button" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                上一页
              </Button>
              <p className="text-sm text-muted-foreground">
                {safePage} / {pageCount} · {filtered.length} 人
              </p>
              <Button type="button" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                下一页
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{filtered.length} 人</p>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={accent ? "text-2xl font-semibold text-primary" : "text-2xl font-semibold"}>
        {value.toLocaleString("zh-CN")}
      </p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
          : "rounded-full bg-card px-3 py-1 text-xs ring-1 ring-foreground/10 hover:bg-secondary"
      }
    >
      {children}
    </button>
  )
}

function Empty({ tab, hasUsers, searching }: { tab: TabId; hasUsers: boolean; searching: boolean }) {
  let text = "贴上 SESSDATA，识别账号，然后开始体检。左边也可以先看示例。"
  if (searching) text = "没有昵称或 UID 对得上。"
  else if (!hasUsers) text = "还没有名单。开始体检后，符合条件的人会出现在这里。"
  else if (tab === "suggested") text = "这套标准下没有要取关的人。可以把天数、播放或粉丝线放宽，或把「至少命中」改成 1。"
  else if (tab === "keep") text = "还没有标成先留着的人。"
  else if (tab === "done") text = "还没有标成已取关的人。标记只记在这台浏览器，方便你对着清单处理。"
  return <div className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>
}

function UserCard({
  user,
  judgement,
  thresholds,
  mark,
  onMark,
}: {
  user: SavedUser
  judgement: Judgement
  thresholds: Thresholds
  mark: Mark | undefined
  onMark: (mark: Mark | null) => void
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-3">
        <Avatar name={user.uname} face={user.face} />
        <div className="min-w-0 flex-1">
          <UserHeading user={user} judgement={judgement} mark={mark} />
          <Metrics user={user} />
          <ReasonLine user={user} judgement={judgement} thresholds={thresholds} />
        </div>
      </div>
      <Actions user={user} mark={mark} onMark={onMark} />
    </article>
  )
}

function FocusCard({
  user,
  judgement,
  thresholds,
  mark,
  index,
  total,
  onPrev,
  onNext,
  onMark,
}: {
  user: SavedUser
  judgement: Judgement
  thresholds: Thresholds
  mark: Mark | undefined
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onMark: (mark: Mark | null) => void
}) {
  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <p className="text-xs text-muted-foreground">
        {index + 1} / {total} · 左右方向键切换
      </p>
      <div className="mt-3 flex gap-4">
        <Avatar name={user.uname} face={user.face} className="size-16 text-lg" />
        <div className="min-w-0">
          <UserHeading user={user} judgement={judgement} mark={mark} />
          {user.sign ? <p className="mt-1 text-sm text-muted-foreground">{user.sign}</p> : null}
        </div>
      </div>
      <Metrics user={user} />
      {judgement.reasons.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {judgement.reasons.map((code) => (
            <li key={code} className="rounded-lg bg-secondary/70 px-3 py-2">
              <span className="font-medium">{REASON_LABEL[code]}。</span>
              {explainReason(code, user, thresholds)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">按当前标准，这个人没有命中取关条件。</p>
      )}
      {user.inspect?.lastTitle ? (
        <p className="mt-3 text-sm">
          最近视频：{user.inspect.lastTitle}
          {user.inspect.lastPlay != null ? ` · ${formatNumber(user.inspect.lastPlay)} 播放` : ""}
        </p>
      ) : null}
      {user.inspect?.error ? <p className="mt-2 text-sm text-destructive">{user.inspect.error}</p> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Actions user={user} mark={mark} onMark={onMark} />
        <Button type="button" variant="outline" onClick={onPrev} disabled={index <= 0}>
          上一位
        </Button>
        <Button type="button" variant="outline" onClick={onNext} disabled={index >= total - 1}>
          下一位
        </Button>
      </div>
    </article>
  )
}

function UserHeading({
  user,
  judgement,
  mark,
}: {
  user: SavedUser
  judgement: Judgement
  mark: Mark | undefined
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        href={`https://space.bilibili.com/${user.mid}`}
        target="_blank"
        rel="noreferrer"
        className="truncate font-medium hover:text-primary"
      >
        {user.uname}
      </a>
      <span className="text-xs text-muted-foreground">UID {user.mid}</span>
      {judgement.suggested ? <Badge>命中 {judgement.score}</Badge> : null}
      {user.mutual ? <Badge variant="outline">互关</Badge> : null}
      {user.special ? <Badge variant="outline">特别关注</Badge> : null}
      {user.officialType >= 0 ? <Badge variant="outline">{user.official || "认证"}</Badge> : null}
      {mark === "keep" ? <Badge variant="secondary">先留着</Badge> : null}
      {mark === "done" ? <Badge variant="secondary">已取关</Badge> : null}
      {judgement.excluded === "official" ? <Badge variant="secondary">已排除</Badge> : null}
      {judgement.excluded === "special" ? <Badge variant="secondary">已排除</Badge> : null}
      {!user.inspect ? <Badge variant="outline">名片未复核</Badge> : null}
    </div>
  )
}

function Metrics({ user }: { user: SavedUser }) {
  const inspect = user.inspect
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
      <Metric label="粉丝" value={formatNumber(inspect?.fans)} />
      <Metric label="视频" value={inspect ? formatNumber(inspect.videos) : "—"} />
      <Metric
        label="近期均播"
        value={inspect?.viewsHidden ? "已隐藏" : formatNumber(inspect?.recentAvgPlay)}
      />
      <Metric label="最近投稿" value={formatAgo(inspect?.lastPub)} />
      <Metric label="你的关注" value={formatDate(user.mtime)} />
      <Metric label="等级" value={inspect?.level != null ? `Lv${inspect.level}` : "—"} />
    </dl>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}

function ReasonLine({
  user,
  judgement,
  thresholds,
}: {
  user: SavedUser
  judgement: Judgement
  thresholds: Thresholds
}) {
  if (user.inspect?.status === "error") {
    return <p className="mt-2 text-xs text-destructive">{user.inspect.error || "这一位没有查完"}</p>
  }
  if (judgement.reasons.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">{user.inspect ? "没有命中当前条件" : "还在排队体检"}</p>
  }
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {judgement.reasons.map((code) => (
          <Badge key={code} variant="destructive">
            {REASON_LABEL[code]}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{explainReason(judgement.reasons[0], user, thresholds)}</p>
    </div>
  )
}

function Actions({
  user,
  mark,
  onMark,
}: {
  user: SavedUser
  mark: Mark | undefined
  onMark: (mark: Mark | null) => void
}) {
  return (
    <div className="flex flex-row flex-wrap gap-2 sm:w-28 sm:flex-col">
      <Button
        type="button"
        variant="outline"
        className="h-8 flex-1 sm:flex-none"
        render={<a href={`https://space.bilibili.com/${user.mid}`} target="_blank" rel="noreferrer" />}
      >
        打开主页
      </Button>
      <Button
        type="button"
        variant={mark === "keep" ? "default" : "outline"}
        className="h-8 flex-1 sm:flex-none"
        onClick={() => onMark(mark === "keep" ? null : "keep")}
      >
        {mark === "keep" ? "取消保留" : "先留着"}
      </Button>
      <Button
        type="button"
        variant={mark === "done" ? "default" : "secondary"}
        className="h-8 flex-1 sm:flex-none"
        onClick={() => onMark(mark === "done" ? null : "done")}
      >
        {mark === "done" ? "撤销标记" : "已取关"}
      </Button>
    </div>
  )
}

function compareRows(
  a: { user: SavedUser; judgement: Judgement },
  b: { user: SavedUser; judgement: Judgement },
  sort: SortId
) {
  const number = (value: number | null | undefined, missing: number) => (value == null ? missing : value)
  if (sort === "fans") return number(a.user.inspect?.fans, Number.MAX_SAFE_INTEGER) - number(b.user.inspect?.fans, Number.MAX_SAFE_INTEGER)
  if (sort === "views") {
    return number(a.user.inspect?.recentAvgPlay, Number.MAX_SAFE_INTEGER) - number(b.user.inspect?.recentAvgPlay, Number.MAX_SAFE_INTEGER)
  }
  if (sort === "inactive") return number(a.user.inspect?.lastPub, Number.MAX_SAFE_INTEGER) - number(b.user.inspect?.lastPub, Number.MAX_SAFE_INTEGER)
  if (sort === "videos") return number(a.user.inspect?.videos, Number.MAX_SAFE_INTEGER) - number(b.user.inspect?.videos, Number.MAX_SAFE_INTEGER)
  if (sort === "follow") return a.user.mtime - b.user.mtime
  return b.judgement.score - a.judgement.score || a.user.mid - b.user.mid
}
