import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors font-body",
  {
    variants: {
      variant: {
        default:
          "bg-gray-100 text-gray-700",
        secondary:
          "bg-secondary text-secondary-foreground",
        destructive:
          "bg-brand-light-red text-brand-red",
        outline: "border border-gray-300 text-foreground bg-white",
        success: "bg-brand-light-green text-brand-green",
        warning: "bg-brand-light-yellow text-brand-yellow",
        info: "bg-brand-light-blue text-brand-blue",
        cancelled: "text-brand-red",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
