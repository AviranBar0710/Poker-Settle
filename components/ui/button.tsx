import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-bold ring-offset-background transition-[transform,background-color,border-color] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-primary-deep text-primary-foreground hover:brightness-105 active:brightness-95",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/25 hover:bg-destructive/15",
        outline:
          "border border-primary/35 bg-transparent text-primary hover:bg-primary/10",
        secondary:
          "bg-card-raised text-secondary-foreground border border-border hover:bg-card-raised/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] h-11 px-5 py-2",
        sm: "h-10 px-4",
        lg: "min-h-[48px] h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const computedClassName = cn(buttonVariants({ variant, size, className }))
    if (asChild && React.isValidElement(props.children)) {
      return React.cloneElement(props.children as React.ReactElement<{ className?: string; ref?: React.Ref<unknown> }>, {
        className: cn(computedClassName, (props.children as React.ReactElement).props.className),
        ref,
      })
    }
    return (
      <button
        className={computedClassName}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

