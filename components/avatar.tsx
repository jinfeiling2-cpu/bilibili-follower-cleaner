"use client"

import { useState } from "react"

import { httpsFace } from "@/lib/format"
import { cn } from "cn"

export function Avatar({
  name,
  face,
  className,
}: {
  name: string
  face: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const letter = name.replace(/^示例·/, "").trim().slice(0, 1) || "UP"
  const src = httpsFace(face)

  if (!src || broken) {
    return (
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
          className
        )}
      >
        {letter}
      </span>
    )
  }

  return (
    // B 站头像域名不适合走 next/image 的远程白名单，加载失败时退回首字。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn("size-11 shrink-0 rounded-full object-cover", className)}
    />
  )
}
