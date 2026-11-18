import "server-only";
import { z } from "zod";
import { STAFF_ROLES } from "@/lib/auth-schema";
import { STAFF_ACTIONS } from "@/lib/booking-status";
import { isDateKey } from "@/lib/time";
import { rupeesSchema } from "./http";

/** Request bodies for admin routes (AGENTS.md §9: zod at every trust boundary). */

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullish().transform((v) => v || null);
const uploadPath = (kind: string) =>
  z.string().regex(new RegExp(`^/uploads/${kind}/[0-9a-f-]{36}\\.webp$`), "Upload the image first.");
/** A new upload of `kind`, or an image bundled in public/ (/site/…, /placeholders/…) kept as it is. */
const imageRef = (kind: string) =>
  z
    .union([uploadPath(kind), z.string().regex(/^\/(placeholders|site)\/[a-z0-9-]+\.(svg|webp|jpe?g|png)$/, "Upload the image first.")])
    .nullish()
    .transform((v) => v ?? null);
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const dateKey = z.string().refine(isDateKey, "Enter a valid date");

export const moveSchema = z.object({ direction: z.enum(["up", "down"]) });

export const staffCreateSchema = z.object({
  name: text(60).min(2, "Enter a name"),
  specialties: optionalText(120),
  bio: optionalText(600),
});
export const staffUpdateSchema = z.object({
  name: text(60).min(2, "Enter a name").optional(),
  specialties: optionalText(120).optional(),
  bio: optionalText(600).optional(),
  photoPath: uploadPath("staff").nullable().optional(),
  active: z.boolean().optional(),
});
export const skillsSchema = z.object({ serviceIds: z.array(z.uuid()).max(200) });
export const shiftsSchema = z.object({
  shifts: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: time, end: time })).max(21),
  force: z.boolean().default(false),
});
export const leaveSchema = z.object({
  startDate: dateKey,
  endDate: dateKey,
  startTime: time.optional(),
  endTime: time.optional(),
  reason: optionalText(200),
  force: z.boolean().default(false),
});
export const leaveDecisionSchema = z.object({
  approve: z.boolean(),
  note: optionalText(200),
  force: z.boolean().default(false),
});

/* Staff portal (technicians) */
export const staffLeaveRequestSchema = leaveSchema.omit({ force: true });
export const staffActionSchema = z.object({ action: z.enum(STAFF_ACTIONS) });

const optionalRupees = z.union([z.literal(""), z.null(), rupeesSchema]).transform((v) => (v === "" || v === null ? null : v));
export const serviceSchema = z.object({
  categoryId: z.uuid("Choose a category"),
  name: text(80).min(2, "Enter a name"),
  description: optionalText(300),
  price: rupeesSchema,
  priceIsFrom: z.boolean(),
  durationMin: z.number().int().min(5, "At least 5 minutes").max(600).multipleOf(5, "Use 5-minute steps"),
  bookingAmountOverride: optionalRupees,
  active: z.boolean(),
  staffIds: z.array(z.uuid()).max(100),
  imagePath: imageRef("services"),
});
export const categorySchema = z.object({ name: text(40).min(2, "Enter a name") });
export const categoryUpdateSchema = z.object({
  name: text(40).min(2, "Enter a name").optional(),
  // Category photos are uploaded as kind "services" (owner-only, like the rest of the menu).
  imagePath: imageRef("services").optional(),
});

export const settingsSchema = z.object({
  bookingAmountType: z.enum(["fixed", "percent"]),
  bookingAmountFixed: rupeesSchema,
  bookingAmountPercent: z.number().int().min(0).max(100),
  cancelWindowHours: z.number().int().min(0).max(168),
  slotIntervalMin: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  bookingWindowDays: z.number().int().min(1).max(180),
  leadTimeMin: z.number().int().min(0).max(1440),
  holdMinutes: z.number().int().min(5).max(60),
  showCustomerPhoneToStaff: z.boolean(),
});
export const hoursSchema = z.object({
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), open: z.boolean(), opensAt: time, closesAt: time }))
    .length(7)
    .refine((days) => new Set(days.map((d) => d.weekday)).size === 7, "Give each weekday once"),
});

export const closureSchema = z.object({ date: dateKey, reason: optionalText(120), force: z.boolean().default(false) });

const portfolioImage = z.object({ path: uploadPath("portfolio"), width: z.number().int().positive(), height: z.number().int().positive() });
export const portfolioSchema = z.object({
  /** On edit: a newly uploaded photo replacing the current one (e.g. a sample picture). */
  image: portfolioImage.optional(),
  alt: text(160).min(3, "Describe the photo for screen readers and Google"),
  caption: optionalText(80),
  categoryId: z.uuid().nullish().transform((v) => v ?? null),
  featured: z.boolean(),
  active: z.boolean(),
});
export const portfolioCreateSchema = portfolioSchema.extend({ image: portfolioImage });

export const instagramSchema = z.object({
  url: text(300).min(1, "Paste the post or reel link"),
  caption: optionalText(120),
  placement: z.enum(["hero", "portfolio", "reviews"]),
  thumbnailPath: uploadPath("instagram").nullish().transform((v) => v ?? null),
  videoPath: z
    .string()
    .regex(/^\/uploads\/instagram\/[0-9a-f-]{36}\.(mp4|webm)$/, "Upload the video first.")
    .nullish()
    .transform((v) => v ?? null),
  active: z.boolean(),
});

export const testimonialSchema = z.object({
  name: text(60).min(2, "Enter a name"),
  quote: text(500).min(5, "Enter the review"),
  rating: z.number().int().min(1).max(5),
  serviceLabel: optionalText(60),
  visible: z.boolean(),
});

const password = z.string().min(10, "At least 10 characters").max(128);
export const teamCreateSchema = z.object({
  name: text(60).min(2, "Enter a name"),
  email: z.email("Enter a valid email").max(254),
  role: z.enum(STAFF_ROLES),
  password,
  staffId: z.uuid().nullish(),
});
export const teamUpdateSchema = z.object({
  name: text(60).min(2).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  active: z.boolean().optional(),
  staffId: z.uuid().nullable().optional(),
});
export const passwordSchema = z.object({ password });
