<script lang="ts">
  import { cn } from "../lib/utils";
  import type { Snippet } from "svelte";

  type Props = {
    variant?: "default" | "ghost" | "outline" | "accent";
    size?: "sm" | "md";
    class?: string;
    disabled?: boolean;
    type?: "button" | "submit";
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  };

  let {
    variant = "default",
    size = "md",
    class: className = "",
    disabled = false,
    type = "button",
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  class={cn(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50",
    size === "sm" ? "h-8 px-2.5" : "h-9 px-3",
    variant === "default" && "bg-foreground text-background hover:opacity-90",
    variant === "accent" && "bg-accent text-accent-foreground hover:opacity-90",
    variant === "ghost" && "hover:bg-muted text-foreground",
    variant === "outline" && "border bg-card hover:bg-muted",
    className
  )}
>
  {@render children()}
</button>
