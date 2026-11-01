# 安全说明

`SESSDATA` 就是 B 站登录凭证。拿到它的人可以代替你访问账号。

## 这个项目怎么处理它

- 页面默认只把它放在当前标签页的 sessionStorage。勾选「在这台浏览器记住 Cookie」之后才会写入 localStorage。
- 服务端只在当次请求里把它转给 B 站，不写入磁盘，也不写入日志。
- 请在自己的电脑上运行。不要把这个服务暴露到公网，也不要把 Cookie 发给任何人。

## 报告问题

不要在公开 issue、拉取请求、截图或日志里粘贴 `SESSDATA`、整段 Cookie。

请使用 GitHub 仓库的 **Security Advisories**（私人安全通告）提交安全问题。公开 issue 只适合不涉及凭证的缺陷。
