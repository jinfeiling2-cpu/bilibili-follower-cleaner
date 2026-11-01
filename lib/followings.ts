export const FOLLOWING_PAGE_SIZE = 20

export function mergeFollowings<T extends { mid: number }>(existing: T[], page: T[]) {
  const seen = new Set(existing.map((user) => user.mid))
  const added: T[] = []
  for (const user of page) {
    if (seen.has(user.mid)) continue
    seen.add(user.mid)
    added.push(user)
  }
  return { users: existing.concat(added), added: added.length }
}

// 这一页的区间已经超过已保存的人数，但一个新账号都没有。
// 前面几页全是重复是正常的：继续体检时会从第 1 页重走，靠 mid 跳过已有的人。
export function isStalePage(page: number, pageSize: number, countBefore: number, added: number) {
  return added === 0 && page * pageSize > countBefore
}
