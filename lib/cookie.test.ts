import assert from "node:assert/strict"
import test from "node:test"

import { mixinKey } from "./bilibili.ts"
import { extractSessdata } from "./cookie.ts"

test("从整段 Cookie 或单独的值里取出 SESSDATA", () => {
  assert.equal(extractSessdata("a1b2c3d4e5"), "a1b2c3d4e5")
  assert.equal(extractSessdata("SESSDATA=abcDEF123%2Cxyz"), "abcDEF123%2Cxyz")
  assert.equal(
    extractSessdata("buvid3=abc; SESSDATA=token_123456; bili_jct=ffff"),
    "token_123456"
  )
  assert.equal(extractSessdata("  \"SESSDATA=quotedtoken1\"  "), "quotedtoken1")
})

test("拒绝空值、过短、以及夹带其他字段的字符串", () => {
  assert.equal(extractSessdata(""), null)
  assert.equal(extractSessdata("short"), null)
  assert.equal(extractSessdata("SESSDATA=abc; evil=1"), null)
  assert.equal(extractSessdata("name=value; another=1"), null)
  assert.equal(extractSessdata("token with spaces inside"), null)
  assert.equal(extractSessdata(12), null)
})

test("WBI 混密钥与公开测试向量一致", () => {
  assert.equal(
    mixinKey("653657f524a547ac981ded72ea172057", "6e4909c702f846728e64f6007736a338"),
    "72136226c6a73669787ee4fd02a74c27"
  )
})
