import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const colors = z
  .array(
    z.union([
      z.string().trim().min(1).max(30),
      z.object({ name: z.string().trim().min(1).max(30), image_url: z.url().nullable(), back_image_url: z.url().nullable().optional() }),
    ])
  )
  .max(30);
const sizes = z.array(z.string().trim().min(1).max(10)).min(1).max(20);

export const productSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  base_image_url: z.url().optional().nullable(),
  available_colors: colors,
  available_sizes: sizes,
  price: z.number().min(0).max(100000),
  stock: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export const productUpdateSchema = productSchema.partial();

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "in_production", "shipped"]),
});

export const customizationSchema = z.object({
  name: z.string().trim().max(20).optional(),
  number: z.number().int().min(1).max(99).optional(),
  has_logo: z.boolean().optional(),
  color: z.string().trim().max(30).optional(),
  font: z.string().trim().max(40).optional(),
});

export const checkoutSchema = z.object({
  organization_slug: z.string().trim().min(1).max(100),
  customer_name: z.string().trim().min(2).max(120),
  customer_email: z.email(),
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        quantity: z.number().int().min(1).max(100),
        size: z.string().trim().min(1).max(10),
        customization_data: customizationSchema.default({}),
        // PNG em data URL exportado do canvas (limite ~3 MB de base64)
        customization_image: z
          .string()
          .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
          .max(4_000_000)
          .optional(),
      })
    )
    .min(1)
    .max(50),
});
