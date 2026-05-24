// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[112px] w-full rounded-[calc(var(--radius)-2px)] border border-input bg-card/90 px-3.5 py-3 text-base text-foreground shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/90 hover:border-[hsl(var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
