"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { resolveStorageFileUrl } from "@/lib/storageFiles"

const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props} />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef(({ className, src, ...props }, ref) => {
  const [resolvedSrc, setResolvedSrc] = React.useState("")

  React.useEffect(() => {
    let active = true

    if (!src) {
      setResolvedSrc("")
      return () => {
        active = false
      }
    }

    if (
      typeof src === "string"
      && (/^(data:|blob:|https?:\/\/)/i.test(src) || src.startsWith("/"))
    ) {
      setResolvedSrc(src)
      return () => {
        active = false
      }
    }

    ;(async () => {
      try {
        const nextSrc = await resolveStorageFileUrl(src)
        if (active) {
          setResolvedSrc(nextSrc || "")
        }
      } catch {
        if (active) {
          setResolvedSrc("")
        }
      }
    })()

    return () => {
      active = false
    }
  }, [src])

  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      src={resolvedSrc || undefined}
      {...props} />
  )
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props} />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
