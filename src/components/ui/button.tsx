import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-semibold text-[14px] transition-colors cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-600 active:bg-accent-700",
        secondary:
          "border border-border bg-white text-text hover:bg-black/[.03] active:bg-black/[.06]",
        ghost: "bg-transparent text-accent-700 hover:bg-accent-100 active:bg-accent-200",
        destructive: "bg-alert text-white hover:bg-alert/90 active:bg-alert/80",
      },
      size: {
        default: "h-9 px-[14px] py-2",
        lg: "h-14 w-full px-4 text-[16px] rounded-[14px]",
        sm: "h-7 px-2.5 text-[12.5px]",
        icon: "h-9 w-9 p-0",
      },
      block: {
        true: "w-full justify-center",
        false: "",
      },
    },
    compoundVariants: [{ variant: "ghost", size: "default", class: "px-1" }],
    defaultVariants: { variant: "primary", size: "default", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, block, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
