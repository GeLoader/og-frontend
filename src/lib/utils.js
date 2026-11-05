import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}


/**
 * Format a datetime string to HH:MM:SS (24-hour format)
 * @param {string|Date} datetime - ISO datetime string or Date object
 * @returns {string} Time in HH:MM:SS format
 */
export function formatTimeHHMMSS(datetime) {
  if (!datetime) return '--:--:--';

  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return '--:--:--';

  // Time entries are stored in the application timezone (Europe/Berlin).
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';

  let hours = get('hour');
  if (hours === '24') hours = '00';

  return `${hours}:${get('minute')}:${get('second')}`;
}

/**
 * Format duration in seconds to HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Duration in HH:MM:SS format
 */
export function formatDurationHHMMSS(seconds) {
  if (!seconds && seconds !== 0) return '--:--:--';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * The application treats all stored time entries as Europe/Berlin wall-clock
 * times. These helpers must be used everywhere a time entry is read for
 * display or edited, otherwise the browser timezone causes entries to shift
 * every time they are saved again.
 */
export const APP_TIME_ZONE = 'Europe/Berlin';

const appDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const getFormatterPart = (parts, type) => parts.find((part) => part.type === type)?.value;

const toDate = (datetime) => {
  if (!datetime) return null;
  const date = datetime instanceof Date ? datetime : new Date(datetime);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Format a datetime as HH:MM in the application timezone (Europe/Berlin).
 * @param {string|Date} datetime
 * @returns {string}
 */
export function formatTimeBerlin(datetime) {
  const date = toDate(datetime);
  if (!date) return '';

  const parts = appDateTimeFormatter.formatToParts(date);
  let hour = getFormatterPart(parts, 'hour') || '00';
  // Some Intl implementations return 24 for midnight even with h23.
  if (hour === '24') hour = '00';

  return `${hour}:${getFormatterPart(parts, 'minute') || '00'}`;
}

/**
 * Format a datetime as YYYY-MM-DD in the application timezone (Europe/Berlin).
 * @param {string|Date} datetime
 * @returns {string}
 */
export function formatDateBerlin(datetime) {
  const date = toDate(datetime);
  if (!date) return '';

  const parts = appDateTimeFormatter.formatToParts(date);
  return `${getFormatterPart(parts, 'year')}-${getFormatterPart(parts, 'month')}-${getFormatterPart(parts, 'day')}`;
}

/**
 * Return the calendar date (YYYY-MM-DD) an entry belongs to.
 * Time entries expose a `date` field that is stored as midnight UTC, so the
 * date part can be used directly. This avoids day shifts in negative UTC
 * offsets. Falls back to the Berlin date for other shapes.
 * @param {object|string|Date} entry
 * @returns {string}
 */
export function getEntryDateString(entry) {
  const raw = entry && typeof entry === 'object' ? entry.date : entry;

  if (typeof raw === 'string') {
    const datePart = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  return formatDateBerlin(raw);
}

/**
 * Parse an entry date into a local Date at noon, so grouping by day/week/month
 * is stable regardless of the browser timezone.
 * @param {object|string|Date} entry
 * @returns {Date}
 */
export function parseEntryDate(entry) {
  const dateStr = getEntryDateString(entry);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);

  if (!match) {
    return toDate(entry && typeof entry === 'object' ? entry.date : entry) || new Date();
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
}

/**
 * Create a Date object representing a specific wall-clock date/time in
 * Europe/Berlin (GMT+1/GMT+2).
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @returns {Date}
 */
export function createDateAsBerlinTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Candidate UTC timestamp with the requested wall-clock components.
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Iterate until the Berlin formatter returns the requested wall clock.
  let currentTime = utcDate.getTime() - 60 * 60 * 1000; // assume UTC+1 first

  for (let i = 0; i < 3; i += 1) {
    const parts = appDateTimeFormatter.formatToParts(new Date(currentTime));

    const pYear = parseInt(getFormatterPart(parts, 'year'), 10);
    const pMonth = parseInt(getFormatterPart(parts, 'month'), 10);
    const pDay = parseInt(getFormatterPart(parts, 'day'), 10);
    let pHour = parseInt(getFormatterPart(parts, 'hour'), 10);
    const pMinute = parseInt(getFormatterPart(parts, 'minute'), 10);

    if (pHour === 24) pHour = 0;

    const gotTime = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute);
    const targetTime = Date.UTC(year, month - 1, day, hour, minute);
    const diff = targetTime - gotTime;

    if (diff === 0) break;

    currentTime += diff;
  }

  return new Date(currentTime);
}