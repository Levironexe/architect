// BAD: god utils file — everything from email to encryption to date formatting
// BAD: imports from 3 different date libraries (moment, date-fns, dayjs)
// BAD: multiple functions doing the same thing with slightly different signatures
// BAD: unused functions that were "added for future use"

import moment from "moment";
import { format, formatDistanceToNow, differenceInDays, addDays } from "date-fns";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

dayjs.extend(relativeTime);

// ============================================
// EMAIL VALIDATION — duplicated across 5+ files
// ============================================
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// BAD: same function, different name, slightly different regex
export function validateEmailAddress(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

// BAD: yet another email validator
export function checkEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: false, error: "Email is required" };
  if (!email.includes("@")) return { valid: false, error: "Email must contain @" };
  if (!isValidEmail(email)) return { valid: false, error: "Invalid email format" };
  return { valid: true };
}

// ============================================
// DATE UTILITIES — using 3 different libraries
// ============================================

// Using moment
export function formatDate(date: string | Date): string {
  return moment(date).format("MMM D, YYYY");
}

export function formatDateTime(date: string | Date): string {
  return moment(date).format("MMM D, YYYY [at] h:mm A");
}

export function fromNow(date: string | Date): string {
  return moment(date).fromNow();
}

export function isExpired(date: string | Date): boolean {
  return moment(date).isBefore(moment());
}

// Using date-fns — same functionality
export function formatDateFns(date: Date): string {
  return format(date, "MMM d, yyyy");
}

export function timeAgo(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function daysUntil(date: Date): number {
  return differenceInDays(date, new Date());
}

export function addDaysToDate(date: Date, days: number): Date {
  return addDays(date, days);
}

// Using dayjs — same thing again
export function formatWithDayjs(date: string | Date): string {
  return dayjs(date).format("MMM D, YYYY");
}

export function relativeTimeFromNow(date: string | Date): string {
  return dayjs(date).fromNow();
}

// BAD: isToday implemented manually instead of using a library
export function isToday(date: string | Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

// BAD: isTomorrow duplicates isToday logic
export function isTomorrow(date: string | Date): boolean {
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();
}

// ============================================
// STRING UTILITIES
// ============================================
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str.split(" ").map(capitalize).join(" ");
}

// BAD: slugify duplicated from products/route.ts (3rd occurrence)
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

export function pluralize(count: number, word: string, plural?: string): string {
  if (count === 1) return `${count} ${word}`;
  return `${count} ${plural || word + "s"}`;
}

// BAD: masking email implemented inconsistently
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked = local.charAt(0) + "*".repeat(Math.max(0, local.length - 2)) + local.charAt(local.length - 1);
  return `${masked}@${domain}`;
}

export function maskPhoneNumber(phone: string): string {
  // BAD: assumes 10-digit US number, no international support
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length !== 10) return "***-***-" + cleaned.slice(-4);
  return `(${cleaned.slice(0,3)}) ***-${cleaned.slice(-4)}`;
}

// ============================================
// NUMBER / CURRENCY UTILITIES
// ============================================

// BAD: formatNumber duplicated from landing page (2nd occurrence)
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toString();
}

// BAD: should use Intl.NumberFormat instead of manual formatting
export function formatCurrency(amount: number, currency = "USD"): string {
  if (currency === "USD") {
    return "$" + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  }
  if (currency === "EUR") {
    return "€" + amount.toFixed(2);
  }
  if (currency === "GBP") {
    return "£" + amount.toFixed(2);
  }
  // BAD: default falls back to toString
  return amount.toFixed(2) + " " + currency;
}

export function formatPrice(price: number): string {
  // BAD: 3rd price formatting function doing the same thing
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function roundTo(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ============================================
// VALIDATION UTILITIES
// ============================================

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// BAD: phone validation only works for US numbers
export function isValidPhone(phone: string): boolean {
  return /^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(phone);
}

export function isValidZipCode(zip: string): boolean {
  // BAD: only validates US zip codes
  return /^\d{5}(-\d{4})?$/.test(zip);
}

// BAD: password strength checker duplicated from api/users/route.ts
export function getPasswordStrength(password: string): "weak" | "fair" | "strong" | "very-strong" {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  if (score <= 4) return "strong";
  return "very-strong";
}

export function validatePetAge(age: number): boolean {
  // BAD: magic numbers instead of named constants
  return age >= 0 && age <= 30;
}

export function validatePetWeight(weight: number): boolean {
  return weight > 0 && weight <= 1000;
}

// ============================================
// CRYPTO / SECURITY — BAD: insecure implementations
// ============================================

// BAD: hardcoded encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "petcarehub-enc-key-32chars-12345"; // 32 chars
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  // BAD: IV should be random per encryption, not derived from key
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// BAD: MD5 is cryptographically broken — should use SHA-256
export function hashString(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function generateId(): string {
  return uuidv4();
}

// ============================================
// ARRAY / OBJECT UTILITIES
// ============================================

// BAD: wrapping lodash functions that could be called directly
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return _.groupBy(arr, key) as Record<string, T[]>;
}

export function sortBy<T>(arr: T[], key: keyof T, direction: "asc" | "desc" = "asc"): T[] {
  return _.orderBy(arr, [key], [direction]) as T[];
}

export function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return _.uniqBy(arr, key);
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  // BAD: reimplementing _.chunk
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function flattenDeep<T>(arr: any[]): T[] {
  return _.flattenDeep(arr);
}

export function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  return _.pick(obj, keys as string[]);
}

export function omit<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  return _.omit(obj, keys as string[]);
}

// ============================================
// YAGNI: PDF generation utility — completely unused
// "We might need to generate PDF reports someday"
// ============================================
export async function generatePDFReport(data: any): Promise<Buffer> {
  // TODO: implement PDF generation
  // This was supposed to use pdf-lib but was never finished
  console.warn("generatePDFReport is not implemented");
  throw new Error("PDF generation not implemented");
}

// ============================================
// YAGNI: CSV export utility — never called from anywhere
// ============================================
export function exportToCSV(data: any[], filename: string): void {
  if (typeof window === "undefined") {
    throw new Error("CSV export only works in browser");
  }
  const headers = Object.keys(data[0] || {}).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v))
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// YAGNI: Image processing utilities that wrap sharp
// Only ever called from one place (server/index.ts)
// ============================================
export async function resizeImage(inputPath: string, outputPath: string, width: number, height: number): Promise<void> {
  // BAD: importing sharp dynamically to avoid issues, but still not tree-shaken
  const sharp = (await import("sharp")).default;
  await sharp(inputPath).resize(width, height, { fit: "cover" }).toFile(outputPath);
}

export async function compressImage(inputPath: string, outputPath: string, quality = 80): Promise<void> {
  const sharp = (await import("sharp")).default;
  await sharp(inputPath).jpeg({ quality }).toFile(outputPath);
}

// ============================================
// YAGNI: Notification helper — not connected to anything
// ============================================
export function formatNotificationMessage(type: string, data: any): string {
  // BAD: giant switch statement — should use a template map
  switch (type) {
    case "appointment_reminder":
      return `Reminder: ${data.petName} has an appointment tomorrow at ${formatDate(data.scheduledAt)}`;
    case "appointment_confirmed":
      return `Your appointment for ${data.petName} has been confirmed`;
    case "appointment_cancelled":
      return `Your appointment for ${data.petName} has been cancelled`;
    case "vaccination_due":
      return `${data.petName}'s ${data.vaccineName} vaccination is due on ${formatDate(data.dueDate)}`;
    case "medication_reminder":
      return `Time to give ${data.petName} their ${data.medicationName}`;
    case "weight_update":
      return `${data.petName}'s weight has been updated to ${data.weight}kg`;
    case "subscription_expiring":
      return `Your ${data.tier} subscription expires in ${data.daysLeft} days`;
    case "subscription_expired":
      return `Your ${data.tier} subscription has expired`;
    case "new_message":
      return `New message from ${data.senderName}: ${truncate(data.content, 50)}`;
    case "order_confirmed":
      return `Your order #${data.orderNumber} has been confirmed`;
    case "order_shipped":
      return `Your order #${data.orderNumber} has been shipped via ${data.carrier}`;
    case "order_delivered":
      return `Your order #${data.orderNumber} has been delivered`;
    case "welcome":
      return `Welcome to PetCare Hub, ${data.name}! Get started by adding your first pet.`;
    default:
      return "You have a new notification";
  }
}

// ============================================
// MISC UTILITIES
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// BAD: retry logic with no jitter — can cause thundering herd
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt); // linear backoff, should be exponential
      }
    }
  }
  throw lastError!;
}

export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): T {
  return _.debounce(fn, wait) as T;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, wait: number): T {
  return _.throttle(fn, wait) as T;
}

// BAD: clamp defined manually, Math.min/Math.max is enough
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// YAGNI: feature flag checker — all flags are just env vars anyway
export function isFeatureEnabled(feature: string): boolean {
  const flags: Record<string, boolean> = {
    ai_health: process.env.FEATURE_AI_HEALTH === "true",
    video_consult: process.env.FEATURE_VIDEO_CONSULT === "true",
    marketplace: process.env.FEATURE_MARKETPLACE === "true",
    social: process.env.FEATURE_SOCIAL === "true",
  };
  return flags[feature] || false;
}
