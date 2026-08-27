import * as React from "react";
import { cn } from "../../lib/utils";

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement>;

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("page-filters", className)} {...props} />
);
Toolbar.displayName = "Toolbar";

export { Toolbar };
