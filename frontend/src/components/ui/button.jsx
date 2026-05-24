import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[calc(var(--radius)-2px)] text-sm font-semibold tracking-[-0.01em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_12px_30px_hsl(var(--primary)/0.2)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_18px_36px_hsl(var(--primary)/0.24)] active:translate-y-0 active:shadow-[0_10px_24px_hsl(var(--primary)/0.16)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_12px_30px_hsl(var(--destructive)/0.18)] hover:-translate-y-px hover:bg-destructive/95 active:translate-y-0",
        outline:
          "border border-border bg-card/90 text-foreground shadow-[var(--shadow-soft)] hover:border-[hsl(var(--border-strong))] hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-soft)] hover:bg-secondary/85 active:bg-secondary",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/75",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  /** 
   * @param {React.ComponentProps<"button"> & { asChild?: boolean, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link", size?: "default" | "sm" | "lg" | "icon" }} props 
   * @param {React.ForwardedRef<HTMLButtonElement>} ref 
   */
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {children}
    </Comp>
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
