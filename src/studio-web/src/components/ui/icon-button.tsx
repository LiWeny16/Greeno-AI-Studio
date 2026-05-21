import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-black hover:bg-accent/80 active:bg-accent/70",
        ghost: "text-muted hover:bg-surface hover:text-foreground active:bg-surface/80",
        outline:
          "border border-border bg-transparent text-muted hover:bg-surface hover:text-foreground",
      },
      size: {
        sm: "h-7 w-7 [&_svg]:size-4",
        default: "h-8 w-8 [&_svg]:size-[18px]",
        lg: "h-9 w-9 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string;
  tooltip?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, tooltip, children, ...props }, ref) => {
    const button = (
      <button
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={label}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return button;
  },
);
IconButton.displayName = "IconButton";

export { IconButton, iconButtonVariants };
