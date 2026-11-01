export type ReasonCode =
  | "invalid"
  | "banned"
  | "inactive"
  | "few_videos"
  | "no_videos"
  | "low_views"
  | "low_fans"

export type AccountStatus = "ok" | "missing" | "cancelled" | "banned" | "error"

export type Thresholds = {
  inactiveDays: number
  fewVideosMax: number
  lowViewsMax: number
  lowFansMax: number
  minReasons: number
  flagInvalid: boolean
  flagBanned: boolean
  flagInactive: boolean
  flagFewVideos: boolean
  flagNoVideos: boolean
  flagLowViews: boolean
  flagLowFans: boolean
  excludeOfficial: boolean
  excludeSpecial: boolean
}

export type FollowingUser = {
  mid: number
  uname: string
  face: string
  sign: string
  official: string
  officialType: number
  special: boolean
  mutual: boolean
  mtime: number
}

export type InspectResult = {
  mid: number
  status: AccountStatus
  uname?: string
  face?: string
  sign?: string
  fans: number | null
  videos: number | null
  articles: number | null
  likes: number | null
  level: number | null
  lastPub: number | null
  lastTitle: string | null
  lastPlay: number | null
  recentAvgPlay: number | null
  recentCount: number
  viewsHidden: boolean
  error?: string
  retry?: boolean
}

export type SavedUser = FollowingUser & {
  inspect: InspectResult | null
}

export type Mark = "keep" | "done"

export type Exclusion = "official" | "special" | null

export type Judgement = {
  reasons: ReasonCode[]
  score: number
  excluded: Exclusion
  suggested: boolean
}

export type Me = {
  mid: number
  uname: string
  face: string
  following: number | null
  follower: number | null
}

export type PresetId = "dead" | "zombie" | "loose"
