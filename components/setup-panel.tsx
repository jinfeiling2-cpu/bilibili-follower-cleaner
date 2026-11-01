"use client"

import { useState } from "react"

import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { extractSessdata } from "@/lib/cookie"
import { PRESET_LABEL } from "@/lib/presets"
import type { Me, PresetId, Thresholds } from "@/lib/types"

const PACE = [
  { ms: 360, label: "稳妥" },
  { ms: 200, label: "均衡" },
  { ms: 120, label: "较快" },
] as const

export function SetupPanel({
  sessdata,
  remember,
  me,
  uid,
  thresholds,
  preset,
  paceMs,
  checkVideos,
  phase,
  progress,
  statusLine,
  inspected,
  total,
  identifying,
  onSessdata,
  onRemember,
  onUid,
  onThresholds,
  onPreset,
  onPace,
  onCheckVideos,
  onIdentify,
  onStart,
  onPause,
  onResume,
  onRescan,
  onDemo,
  onHelp,
  onClear,
}: {
  sessdata: string
  remember: boolean
  me: Me | null
  uid: string
  thresholds: Thresholds
  preset: PresetId | "custom"
  paceMs: number
  checkVideos: boolean
  phase: "idle" | "followings" | "inspect" | "paused" | "done"
  progress: number
  statusLine: string
  inspected: number
  total: number | null
  identifying: boolean
  onSessdata: (value: string) => void
  onRemember: (value: boolean) => void
  onUid: (value: string) => void
  onThresholds: (value: Thresholds) => void
  onPreset: (id: PresetId) => void
  onPace: (ms: number) => void
  onCheckVideos: (value: boolean) => void
  onIdentify: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRescan: () => void
  onDemo: () => void
  onHelp: () => void
  onClear: () => void
}) {
  const [visible, setVisible] = useState(false)
  const running = phase === "followings" || phase === "inspect"
  const token = extractSessdata(sessdata)
  const uidNumber = Number(uid)
  const uidOk = Number.isSafeInteger(uidNumber) && uidNumber > 0
  const mismatch = me != null && me.mid > 0 && uidOk && me.mid !== uidNumber
  const estimate = total && total > 0 ? estimateMinutes(total, paceMs, checkVideos) : null

  function patch(partial: Partial<Thresholds>) {
    onThresholds({ ...thresholds, ...partial })
  }

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>你的账号</CardTitle>
        <CardDescription>
          只读取关注名单和公开的投稿、粉丝数据。不会替你点取关。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="sessdata">SESSDATA</Label>
            <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={onHelp}>
              怎么获取
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              id="sessdata"
              type={visible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="粘贴 SESSDATA 的值"
              value={sessdata}
              onChange={(event) => onSessdata(event.target.value)}
              disabled={running}
              className="h-10"
            />
            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setVisible((value) => !value)}>
              {visible ? "隐藏" : "显示"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {sessdata.trim() === ""
              ? "从已登录的浏览器里复制。它等于登录凭证，用完可以清除。"
              : token
                ? "格式可用。它只留在这台浏览器里，用来读取你的关注列表。"
                : "这串内容里没有可用的 SESSDATA。"}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={remember} onCheckedChange={onRemember} disabled={running} />
            <span>在这台浏览器记住 Cookie。公共电脑不要勾。</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onIdentify} disabled={!token || identifying || running} className="h-10">
            {identifying ? "正在识别…" : "识别我的账号"}
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={onDemo} disabled={running}>
            先看示例
          </Button>
        </div>

        {me && me.mid > 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-secondary/70 px-3 py-2">
            <Avatar name={me.uname} face={me.face} />
            <div className="min-w-0">
              <p className="truncate font-medium">{me.uname}</p>
              <p className="text-xs text-muted-foreground">
                UID {me.mid}
                {me.following != null ? ` · 关注 ${me.following.toLocaleString("zh-CN")}` : ""}
                {me.follower != null ? ` · 粉丝 ${me.follower.toLocaleString("zh-CN")}` : ""}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="uid">要体检的 UID</Label>
          <Input
            id="uid"
            inputMode="numeric"
            placeholder="识别账号后会自动填上"
            value={uid}
            onChange={(event) => onUid(event.target.value.replace(/[^\d]/g, ""))}
            disabled={running}
            className="h-10"
          />
          {mismatch ? (
            <p className="text-xs text-destructive">
              这个 UID 和 Cookie 对应的不是同一个账号。B 站只让你看全自己的关注，别人最多大约 100 个。
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">空间地址里 space.bilibili.com/ 后面的数字就是 UID。</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">筛选尺度</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PRESET_LABEL) as PresetId[]).map((id) => (
              <Button
                key={id}
                type="button"
                variant={preset === id ? "default" : "outline"}
                className="h-9"
                disabled={running}
                onClick={() => onPreset(id)}
              >
                {PRESET_LABEL[id]}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="多少天没投稿"
              suffix="天"
              value={thresholds.inactiveDays}
              min={30}
              max={3650}
              disabled={running}
              onChange={(inactiveDays) => patch({ inactiveDays })}
            />
            <NumberField
              label="投稿少于此数"
              suffix="个"
              value={thresholds.fewVideosMax}
              min={0}
              max={100}
              disabled={running}
              onChange={(fewVideosMax) => patch({ fewVideosMax })}
            />
            <NumberField
              label="平均播放低于"
              suffix="次"
              value={thresholds.lowViewsMax}
              min={0}
              max={10000000}
              disabled={running}
              onChange={(lowViewsMax) => patch({ lowViewsMax })}
            />
            <NumberField
              label="粉丝少于"
              suffix="人"
              value={thresholds.lowFansMax}
              min={0}
              max={10000000}
              disabled={running}
              onChange={(lowFansMax) => patch({ lowFansMax })}
            />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>至少命中几条才列入建议</span>
            <Input
              type="number"
              min={1}
              max={4}
              value={thresholds.minReasons}
              disabled={running}
              onChange={(event) => patch({ minReasons: clamp(Number(event.target.value), 1, 4) })}
              className="h-8 w-16"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            粉丝少单独成立就会进清单。如果太多，把「至少命中」改成 2，或把粉丝线调低。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Check label="已失效" checked={thresholds.flagInvalid} disabled={running} onChange={(flagInvalid) => patch({ flagInvalid })} />
          <Check label="已封禁" checked={thresholds.flagBanned} disabled={running} onChange={(flagBanned) => patch({ flagBanned })} />
          <Check label="长期不更新" checked={thresholds.flagInactive} disabled={running} onChange={(flagInactive) => patch({ flagInactive })} />
          <Check label="没有投稿" checked={thresholds.flagNoVideos} disabled={running} onChange={(flagNoVideos) => patch({ flagNoVideos })} />
          <Check label="投稿很少" checked={thresholds.flagFewVideos} disabled={running} onChange={(flagFewVideos) => patch({ flagFewVideos })} />
          <Check label="播放很低" checked={thresholds.flagLowViews} disabled={running} onChange={(flagLowViews) => patch({ flagLowViews })} />
          <Check label="粉丝很少" checked={thresholds.flagLowFans} disabled={running} onChange={(flagLowFans) => patch({ flagLowFans })} />
          <Check label="排除认证号" checked={thresholds.excludeOfficial} disabled={running} onChange={(excludeOfficial) => patch({ excludeOfficial })} />
          <Check label="排除特别关注" checked={thresholds.excludeSpecial} disabled={running} onChange={(excludeSpecial) => patch({ excludeSpecial })} />
          <Check label="检查近期播放" checked={checkVideos} disabled={running} onChange={onCheckVideos} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">请求速度</p>
          <div className="grid grid-cols-3 gap-2">
            {PACE.map((item) => (
              <Button
                key={item.ms}
                type="button"
                variant={paceMs === item.ms ? "default" : "outline"}
                className="h-9"
                onClick={() => onPace(item.ms)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {estimate
              ? `大约 ${estimate} 分钟。近 5000 个关注建议用稳妥或均衡，可以随时暂停。`
              : "近 5000 个关注通常要 20 到 40 分钟。关掉「检查近期播放」会更快，但看不出很久不更新和播放很低。"}
          </p>
        </div>

        {running || phase === "paused" || inspected > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{statusLine || phaseLabel(phase)}</span>
              <span>
                {phase === "followings" ? "" : "已查完 "}
                {inspected}
                {total ? ` / ${total}` : ""}
              </span>
            </div>
            <Progress value={progress} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {running ? (
            <Button type="button" variant="secondary" className="h-10" onClick={onPause}>
              暂停
            </Button>
          ) : phase === "paused" ? (
            <Button type="button" className="h-10" onClick={onResume} disabled={!token || !uidOk}>
              继续体检
            </Button>
          ) : phase === "done" && inspected > 0 ? (
            <Button type="button" className="h-10" onClick={onRescan} disabled={!token || !uidOk}>
              重新体检
            </Button>
          ) : (
            <Button type="button" className="h-10" onClick={onStart} disabled={!token || !uidOk}>
              开始体检
            </Button>
          )}
          {!running && phase === "paused" && inspected > 0 ? (
            <Button type="button" variant="outline" className="h-10" onClick={onRescan} disabled={!token || !uidOk}>
              重新体检
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClear}>
            清除本机进度和 Cookie
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
          className="h-8"
        />
        <span className="w-6 shrink-0 text-muted-foreground">{suffix}</span>
      </span>
    </label>
  )
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  )
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function phaseLabel(phase: "idle" | "followings" | "inspect" | "paused" | "done") {
  if (phase === "followings") return "正在拉取关注"
  if (phase === "inspect") return "正在体检"
  if (phase === "paused") return "已暂停"
  if (phase === "done") return "体检完成"
  return "还没开始"
}

function estimateMinutes(count: number, paceMs: number, checkVideos: boolean) {
  const calls = Math.ceil(count / 20) + count * (checkVideos ? 1.55 : 1)
  const seconds = calls * (paceMs / 1000 + 0.25)
  return Math.max(1, Math.round(seconds / 60))
}
