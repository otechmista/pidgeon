import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function api() {
  if (!window.pidgeon) {
    throw new Error("Pidgeon IPC bridge unavailable");
  }
  return window.pidgeon;
}

export function isErr<T extends object>(
  value: T | { error: { code: string; message: string } }
): value is { error: { code: string; message: string } } {
  return value && typeof value === "object" && "error" in value;
}
