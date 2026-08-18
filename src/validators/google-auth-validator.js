import { z } from "zod";

export const checkRegNoSchema = z.object({
  regNo: z.string().trim().min(1).max(50),
});

export const googleAuthSchema = z.object({
  regNo: z.string().trim().min(1).max(50),
  idToken: z.string().min(1),
});
