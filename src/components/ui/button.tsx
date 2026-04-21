import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] active:brightness-95",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-[hsl(var(--primary)/0.92)] text-primary-foreground shadow-[0_1px_0_0_hsl(0_0%_100%/0.15)_inset,0_1px_2px_0_hsl(var(--primary)/0.25)] hover:brightness-[1.03] active:shadow-[0_1px_2px_0_hsl(var(--primary)/0.2)_inset]",
        destructive:
          "bg-gradient-to-b from-destructive to-[hsl(var(--destructive)/0.92)] text-destructive-foreground shadow-[0_1px_0_0_hsl(0_0%_100%/0.12)_inset,0_1px_2px_0_hsl(var(--destructive)/0.25)] hover:brightness-[1.03]",
        outline:
          "border border-input bg-background shadow-[0_1px_0_0_hsl(var(--border)/0.4)] hover:bg-accent hover:text-accent-foreground hover:border-border",
        secondary:
          "bg-gradient-to-b from-secondary to-[hsl(var(--secondary)/0.85)] text-secondary-foreground shadow-[0_1px_0_0_hsl(0_0%_100%/0.5)_inset,0_1px_1px_0_hsl(220_25%_12%/0.04)] hover:brightness-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
