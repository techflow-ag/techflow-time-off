import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function formatDate(date: string | Date, locale: string = 'en'): string {
  let d: Date;
  if (typeof date === 'string') {
    // Parse date-only strings (YYYY-MM-DD) as local time to avoid timezone shift
    const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) {
      d = new Date(+parts[1], +parts[2] - 1, +parts[3]);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format a local Date as YYYY-MM-DD without UTC conversion */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
