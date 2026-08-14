import { z } from "zod";

export const loginAdminSchema = z.object({
  regNo: z
    .string()
    .trim()
    .min(2)
    .max(50),

  password: z
    .string()
    .min(1),
});

export const registerAdminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100),

  email: z
    .string()
    .trim()
    .email()
    .toLowerCase(),

  regNo: z
    .string()
    .trim()
    .min(2)
    .max(50),

  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});
