import type { ReasonCode, SavedUser, Thresholds } from "@/lib/types"

export const REASON_LABEL: Record<ReasonCode, string> = {
  invalid: "已失效",
  banned: "已封禁",
  inactive: "长期不更新",
  few_videos: "投稿很少",
  no_videos: "没有投稿",
  low_views: "播放很低",
  low_fans: "粉丝很少",
}

export function httpsFace(url: string) {
  if (!url) return ""
  if (url.startsWith("//")) return `https:${url}`
  return url.replace(/^http:\/\//i, "https://")
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  if (Math.abs(value) >= 10000) {
    const wan = value / 10000
    const digits = Math.abs(wan) >= 10 ? 0 : 1
    return `${wan.toFixed(digits)} 万`
  }
  return value.toLocaleString("zh-CN")
}

export function formatDate(unix: number | null | undefined) {
  if (!unix) return "—"
  const date = new Date(unix * 1000)
  if (Number.isNaN(date.getTime())) return "—"
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatAgo(unix: number | null | undefined, now = Date.now()) {
  if (!unix) return "没有近期投稿"
  const days = Math.floor((now / 1000 - unix) / 86400)
  if (days < 1) return "今天"
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years} 年 ${months} 个月前` : `${years} 年前`
}

export function explainReason(
  code: ReasonCode,
  user: SavedUser,
  thresholds: Thresholds,
  now = Date.now()
) {
  const inspect = user.inspect
  switch (code) {
    case "invalid":
      return user.uname.includes("注销") || inspect?.status === "cancelled"
        ? "账号已注销，这条关注已经失效。"
        : "空间不存在或已消失，这条关注已经失效。"
    case "banned":
      return "账号处于封禁状态。"
    case "inactive":
      return `最近一条投稿在 ${formatAgo(inspect?.lastPub, now)}（${formatDate(inspect?.lastPub)}），超过了你设的 ${thresholds.inactiveDays} 天。`
    case "few_videos":
      return `目前看得到 ${inspect?.videos ?? 0} 个视频投稿，不超过 ${thresholds.fewVideosMax} 个。`
    case "no_videos":
      return (inspect?.articles ?? 0) > 0
        ? `没有视频投稿，专栏还有 ${inspect?.articles} 篇。只发动态或专栏的人也会出现在这里。`
        : "主页里看不到视频投稿，可能没发过，或已经删掉。"
    case "low_views":
      return `最近 ${inspect?.recentCount ?? 0} 条视频平均播放 ${formatNumber(inspect?.recentAvgPlay)}，低于 ${formatNumber(thresholds.lowViewsMax)}。`
    case "low_fans":
      return `粉丝 ${formatNumber(inspect?.fans)}，低于 ${formatNumber(thresholds.lowFansMax)}。粉丝少本身不一定该取关。`
  }
}
