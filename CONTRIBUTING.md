# 参与贡献

## 本地开发

需要 Node.js 22（20.19 及以上也可以）。

```bash
npm ci
npm run dev
```

浏览器打开 http://127.0.0.1:43127 。没有 Cookie 时，可以先点「先看示例」。

提交前跑一遍：

```bash
npm test
npm run lint
npm run build
```

`npm run typecheck` 需要先跑过一次 `npm run dev` 或 `npm run build`，因为 Next.js 会生成类型文件。

## 提交时注意

- 不要提交 `SESSDATA`、`.env`、关注名单导出，或含登录态的截图。
- 取关必须由使用的人在 B 站自己确认。不要加自动取关。
- 改筛选规则时，补上或更新 `lib/judge.test.ts`。
