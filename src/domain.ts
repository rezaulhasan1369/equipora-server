import { z } from "zod";
export const categories = [
  "Construction Equipment",
  "Photography Equipment",
  "Vehicles & Transportation",
  "Agriculture Equipment",
  "Electronics",
  "Event Equipment",
] as const;
export const roles = ["customer", "owner", "admin"] as const;
export type Role = (typeof roles)[number];
export const image = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) => URL.canParse(v) && new URL(v).protocol === "https:",
    "Use an HTTPS image URL",
  );
export const equipmentSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(20).max(5000),
    category: z.enum(categories),
    location: z.string().trim().min(2).max(160),
    price: z
      .number()
      .positive()
      .max(1000000)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7,
        "Use at most two decimal places",
      ),
    rentalType: z.enum(["daily", "weekly", "monthly"]),
    quantity: z.number().int().min(1).max(10000),
    condition: z.string().trim().min(2).max(100),
    brand: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    image,
    terms: z.string().trim().min(10).max(3000),
  })
  .strict();
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    image: image.or(z.literal("")),
    phone: z.string().trim().max(30),
    address: z.string().trim().max(300),
  })
  .strict();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const bookingSchema = z
  .object({
    equipmentId: z.string().regex(/^[a-f0-9]{24}$/i),
    start: day,
    end: day,
    quantity: z.number().int().min(1).max(10000),
    phone: z.string().trim().min(6).max(30),
    address: z.string().trim().min(5).max(300),
    notes: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine(
    (v) => v.end > v.start && v.start >= new Date().toISOString().slice(0, 10),
    "Choose a future start and a later end date",
  );
export function rentalPrice(
  price: number,
  type: string,
  start: string,
  end: string,
  quantity: number,
) {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 366 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  )
    throw new Error("Invalid rental period");
  const units = Math.ceil(
    days / (type === "weekly" ? 7 : type === "monthly" ? 30 : 1),
  );
  return {
    days,
    units,
    totalCents: Math.round(price * 100) * units * quantity,
  };
}
export function escapeSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function catalogQuery(query: Record<string, unknown>) {
  const schema = z
    .object({
      search: z.string().trim().max(100).optional(),
      category: z.enum(categories).optional(),
      rentalType: z.enum(["daily", "weekly", "monthly"]).optional(),
      min: z.coerce.number().min(0).max(1000000).optional(),
      max: z.coerce.number().min(0).max(1000000).optional(),
      available: z.enum(["true", "false"]).optional(),
      sort: z.enum(["recent", "price-asc", "price-desc"]).default("recent"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(24).default(12),
      featured: z.enum(["true"]).optional(),
    })
    .strict();
  const p = schema.parse(query);
  if (p.min !== undefined && p.max !== undefined && p.min > p.max)
    throw new Error("Invalid price range");
  const filter: Record<string, unknown> = {
    status: "approved",
    deleted: { $ne: true },
  };
  if (p.search)
    filter.$or = ["name", "location", "category"].map((k) => ({
      [k]: { $regex: escapeSearch(p.search!), $options: "i" },
    }));
  if (p.category) filter.category = p.category;
  if (p.rentalType) filter.rentalType = p.rentalType;
  if (p.min !== undefined || p.max !== undefined)
    filter.price = {
      ...(p.min !== undefined ? { $gte: p.min } : {}),
      ...(p.max !== undefined ? { $lte: p.max } : {}),
    };
  if (p.available) filter.quantity = p.available === "true" ? { $gt: 0 } : 0;
  const sort: Record<string, 1 | -1> =
    p.sort === "price-asc"
      ? { price: 1, _id: 1 }
      : p.sort === "price-desc"
        ? { price: -1, _id: 1 }
        : { createdAt: -1, _id: -1 };
  return { filter, sort, page: p.page, limit: p.featured ? 6 : p.limit };
}
