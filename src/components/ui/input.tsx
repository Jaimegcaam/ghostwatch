"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-gw-border bg-gw-surface px-3 py-2 text-sm text-gw-fg shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gw-fg placeholder:text-gw-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-gw-bg disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
