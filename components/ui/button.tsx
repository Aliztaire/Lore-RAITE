import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The box never changes on hover; only the text (and icon) colour does.
        default:
          'border border-primary bg-transparent text-primary hover:text-highlight-strong',
        destructive:
          'border border-primary bg-transparent text-primary hover:text-destructive focus-visible:ring-destructive/20',
        outline:
          'border border-input bg-transparent text-foreground hover:text-highlight-strong',
        secondary:
          'bg-secondary text-secondary-foreground hover:text-highlight-strong',
        ghost:
          'hover:text-highlight-strong',
        link: 'text-primary underline underline-offset-4 decoration-border hover:text-highlight-strong hover:decoration-current',
      },
      size: {
        default: 'h-9 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-8 rounded-full gap-2 px-4 has-[>svg]:px-3',
        lg: 'h-10 rounded-full px-6 has-[>svg]:px-5',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
