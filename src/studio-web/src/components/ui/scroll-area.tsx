import * as React from "react";
import { cn } from "../../lib/cn";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = "vertical", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-auto",
          orientation === "vertical" && "overflow-x-hidden",
          orientation === "horizontal" && "overflow-y-hidden",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
