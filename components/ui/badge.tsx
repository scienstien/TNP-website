import type { ComponentProps } from "react";

export function Badge({ className = "", ...props }: ComponentProps<"span">) {
  return <span data-slot="badge" className={`inline-flex items-center ${className}`} {...props} />;
}
