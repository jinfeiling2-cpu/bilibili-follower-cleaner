import assert from "node:assert/strict"
import test from "node:test"

import { demoUsers } from "./demo.ts"
import { judge } from "./judge.ts"
import { PRESETS } from "./presets.ts"
import type { SavedUser } from "./types.ts"

const zombie = PRESETS.zombie
const now = Date.now()

function find(name: string) {
  const user = demoUsers().find((item) => item.uname === name)
  assert.ok(user, name)
  return user
}

test("注销和消失的账号记为已失效", () => {
  const cancelled = judge(find("示例·账号已注销"), zombie, now)
  assert.ok(cancelled.reasons.includes("invalid"))
  assert.equal(cancelled.suggested, true)

  const missing = judge(find("示例·空间不见了"), zombie, now)
  assert.deepEqual(missing.reasons, ["invalid"])
})

test("封禁号同时记下封禁和低活跃", () => {
  const banned = judge(find("示例·封禁中"), zombie, now)
  assert.ok(banned.reasons.includes("banned"))
  assert.ok(banned.reasons.includes("inactive"))
  assert.ok(banned.score >= 90)
})

test("长期不更新、少稿、低播放、低粉丝各自命中", () => {
  assert.ok(judge(find("示例·三年没更新"), zombie, now).reasons.includes("inactive"))
  assert.ok(judge(find("示例·只剩一个视频"), zombie, now).reasons.includes("few_videos"))
  assert.ok(judge(find("示例·没有投稿"), zombie, now).reasons.includes("no_videos"))
  assert.ok(judge(find("示例·播放个位数"), zombie, now).reasons.includes("low_views"))
  assert.ok(judge(find("示例·粉丝很少"), zombie, now).reasons.includes("low_fans"))
})

test("没有投稿时不再重复记成投稿很少", () => {
  const empty = judge(find("示例·没有投稿"), zombie, now)
  assert.equal(empty.reasons.includes("few_videos"), false)
  assert.equal(empty.reasons.includes("no_videos"), true)
})

test("有专栏的空视频号分数低于完全没内容", () => {
  const none = judge(find("示例·没有投稿"), zombie, now)
  const column = judge(find("示例·只写专栏"), zombie, now)
  assert.ok(column.reasons.includes("no_videos"))
  assert.ok(column.score < none.score)
})

test("播放量隐藏时不当成低播放", () => {
  const hidden = judge(find("示例·播放数隐藏"), zombie, now)
  assert.equal(hidden.reasons.includes("low_views"), false)
})

test("认证和特别关注默认不进建议清单", () => {
  const official = judge(find("示例·认证机构"), zombie, now)
  assert.equal(official.excluded, "official")
  assert.equal(official.suggested, false)
  assert.ok(official.reasons.length > 0)

  const special = judge(find("示例·特别关注"), zombie, now)
  assert.equal(special.excluded, "special")
  assert.equal(special.suggested, false)
})

test("正常更新的 UP 不会被建议取关", () => {
  const active = judge(find("示例·还在更新的UP"), zombie, now)
  assert.deepEqual(active.reasons, [])
  assert.equal(active.suggested, false)
})

test("至少命中两条时，单独粉丝少不算建议", () => {
  const strict = { ...zombie, minReasons: 2 }
  const fans = judge(find("示例·粉丝很少"), strict, now)
  assert.deepEqual(fans.reasons, ["low_fans"])
  assert.equal(fans.suggested, false)
})

test("关掉某一项后不再命中", () => {
  const off = { ...zombie, flagLowFans: false, flagFewVideos: false }
  const small = judge(find("示例·粉丝很少"), off, now)
  assert.deepEqual(small.reasons, [])
})

test("还没体检、或体检失败时不给建议", () => {
  const pending: SavedUser = { ...find("示例·没有投稿"), inspect: null, uname: "还没查" }
  assert.equal(judge(pending, zombie, now).suggested, false)

  const failed: SavedUser = {
    ...find("示例·没有投稿"),
    inspect: { ...find("示例·没有投稿").inspect!, status: "error", error: "超时" },
  }
  assert.equal(judge(failed, zombie, now).suggested, false)
})

test("只看失效时忽略低粉丝", () => {
  const dead = judge(find("示例·粉丝很少"), PRESETS.dead, now)
  assert.deepEqual(dead.reasons, [])
  const gone = judge(find("示例·空间不见了"), PRESETS.dead, now)
  assert.equal(gone.suggested, true)
})
