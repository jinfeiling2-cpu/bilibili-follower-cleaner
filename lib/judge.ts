import type {
  AccountStatus,
  Judgement,
  ReasonCode,
  SavedUser,
  Thresholds,
} from "@/lib/types"

const WEIGHT: Record<ReasonCode, number> = {
  invalid: 100,
  banned: 90,
  no_videos: 48,
  inactive: 36,
  low_views: 30,
  few_videos: 22,
  low_fans: 16,
}

function statusOf(user: SavedUser): AccountStatus | "pending" {
  if (user.inspect) return user.inspect.status
  if (user.uname.includes("账号已注销")) return "cancelled"
  return "pending"
}

export function judge(
  user: SavedUser,
  thresholds: Thresholds,
  now = Date.now()
): Judgement {
  const status = statusOf(user)
  const inspect = user.inspect
  const reasons: ReasonCode[] = []

  if (status === "pending" || status === "error") {
    return { reasons, score: 0, excluded: null, suggested: false }
  }

  if (
    thresholds.flagInvalid &&
    (status === "missing" || status === "cancelled")
  ) {
    reasons.push("invalid")
  }
  if (thresholds.flagBanned && status === "banned") {
    reasons.push("banned")
  }

  const videos = inspect?.videos
  const articles = inspect?.articles ?? 0
  if (thresholds.flagNoVideos && videos === 0) {
    reasons.push("no_videos")
  } else if (
    thresholds.flagFewVideos &&
    videos != null &&
    videos > 0 &&
    videos <= thresholds.fewVideosMax
  ) {
    reasons.push("few_videos")
  }

  const lastPub = inspect?.lastPub
  if (
    thresholds.flagInactive &&
    lastPub != null &&
    lastPub > 0 &&
    now / 1000 - lastPub > thresholds.inactiveDays * 86400
  ) {
    reasons.push("inactive")
  }

  if (
    thresholds.flagLowViews &&
    inspect &&
    !inspect.viewsHidden &&
    inspect.recentAvgPlay != null &&
    (videos ?? 0) > 0 &&
    inspect.recentAvgPlay < thresholds.lowViewsMax
  ) {
    reasons.push("low_views")
  }

  if (
    thresholds.flagLowFans &&
    inspect?.fans != null &&
    inspect.fans < thresholds.lowFansMax
  ) {
    reasons.push("low_fans")
  }

  let score = 0
  for (const reason of reasons) {
    score += WEIGHT[reason]
    if (reason === "no_videos" && articles > 0) score -= 26
  }

  const excluded = thresholds.excludeOfficial && user.officialType >= 0
    ? "official"
    : thresholds.excludeSpecial && user.special
      ? "special"
      : null

  const suggested = excluded == null && reasons.length >= thresholds.minReasons
  return { reasons, score, excluded, suggested }
}
