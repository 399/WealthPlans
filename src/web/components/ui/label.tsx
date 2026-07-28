import type * as React from "react";
import { cn } from "@/web/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the consumer supplies the nested control or htmlFor.
    <label
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm font-medium", className)}
      {...props}
    />
  );
}
