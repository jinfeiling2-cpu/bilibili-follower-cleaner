import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isStalePage, mergeFollowings } from "./followings.ts"

describe("合并关注页", () => {
  it("跳过已经拉过的人，只追加新的", () => {
    const existing = [{ mid: 1 }, { mid: 2 }]
    const merged = mergeFollowings(existing, [{ mid: 2 }, { mid: 3 }])
    assert.deepEqual(merged.users.map((user) => user.mid), [1, 2, 3])
    assert.equal(merged.added, 1)
    assert.deepEqual(existing.map((user) => user.mid), [1, 2])
  })
})

describe("重复页", () => {
  it("重走前面几页时，整页都是已有的人不算卡住", () => {
    assert.equal(isStalePage(1, 20, 225, 0), false)
    assert.equal(isStalePage(11, 20, 225, 0), false)
  })

  it("翻过已有人数之后仍然没有新人，算卡住", () => {
    assert.equal(isStalePage(12, 20, 225, 0), true)
    assert.equal(isStalePage(12, 20, 225, 4), false)
  })
})
