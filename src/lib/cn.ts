import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Join class names (clsx) and resolve conflicting Tailwind utilities (tailwind-merge),
 * so a caller's `className` reliably overrides a component's defaults.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
