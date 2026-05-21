import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-control text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-transparent text-muted hover:bg-surface hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-accent",
        outline:
          "border border-border bg-transparent text-muted hover:bg-surface hover:text-foreground data-[state=on]:border-accent data-[state=on]:text-accent",
      },
      size: {
        sm: "h-7 px-2.5 text-compact",
        default: "h-8 px-3",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {}

const Toggle = React.forwardRef<
  React.ComponentRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };
