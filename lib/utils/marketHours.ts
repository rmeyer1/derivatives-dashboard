import { format, isWithinInterval, set, getDay } from 'date-fns';

// Define holidays (month is 0-indexed in JavaScript Date)
const HOLIDAYS = [
  // New Year's Day
  { month: 0, day: 1 },
  // Independence Day
  { month: 6, day: 4 },
  // Christmas Day
  { month: 11, day: 25 }
];

/**
 * Check if the given date is a holiday
 * @param date - Date to check
 * @returns boolean - true if it's a holiday
 */
function isHoliday(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  
  return HOLIDAYS.some(holiday => holiday.month === month && holiday.day === day);
}

/**
 * Check if the market is currently open
 * @param date - Optional date to check, defaults to current time
 * @returns boolean - true if market is open
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  // Check if it's a weekend (0 = Sunday, 6 = Saturday)
  const day = getDay(date);
  if (day === 0 || day === 6) {
    return false;
  }

  // Check if it's a holiday
  if (isHoliday(date)) {
    return false;
  }

  // Convert to EST timezone (America/New_York)
  const estDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  // Check if time is within market hours (9:30 AM - 4:00 PM EST)
  const marketOpen = set(estDate, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
  const marketClose = set(estDate, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 });

  return isWithinInterval(estDate, { start: marketOpen, end: marketClose });
}

/**
 * Calculate when the market opens next
 * @param date - Optional date to start from, defaults to current time
 * @returns Date - when the market opens next
 */
export function getNextMarketOpen(date: Date = new Date()): Date {
  let nextDate = new Date(date);
  
  // If it's a weekend or holiday, move to next business day
  while (getDay(nextDate) === 0 || getDay(nextDate) === 6 || isHoliday(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  // Set to market open time (9:30 AM EST)
  const nextMarketOpen = set(nextDate, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
  
  // If we've already passed market open today, move to next day
  if (nextMarketOpen <= date) {
    nextDate.setDate(nextDate.getDate() + 1);
    // If tomorrow is weekend or holiday, move to next business day
    while (getDay(nextDate) === 0 || getDay(nextDate) === 6 || isHoliday(nextDate)) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return set(nextDate, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
  }
  
  return nextMarketOpen;
}

/**
 * Format last updated timestamp into relative time string
 * @param timestamp - Timestamp to format
 * @returns string - Formatted time like "2s ago", "1m ago", etc.
 */
export function formatLastUpdated(timestamp: number): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}