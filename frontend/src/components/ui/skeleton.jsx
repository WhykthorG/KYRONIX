import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("animate-pulse rounded-[calc(var(--radius)-4px)] bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--accent))_45%,hsl(var(--muted))_100%)] bg-[length:200%_100%]", className)}
      {...props} />)
  );
}

export { Skeleton }
