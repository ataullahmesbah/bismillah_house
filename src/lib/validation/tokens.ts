import { z } from "zod";

import { booleanSchema, idSchema, optionalIdSchema, optionalText, requiredText } from "./common";

/** Internal token (staff ticket) input. */

export const tokenCategorySchema = z.enum([
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "CUSTOMER",
  "DELIVERY",
  "TECHNICAL",
  "OTHER",
]);

export const tokenPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export const tokenStatusValueSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

export const createTokenSchema = z
  .object({
    subject: requiredText("Subject", 160),
    description: requiredText("Description", 4000),
    category: tokenCategorySchema.default("OTHER"),
    priority: tokenPrioritySchema.default("NORMAL"),
    relatedType: optionalText(40),
    relatedId: optionalText(60),
    assigneeIds: z.array(idSchema).default([]),
    assignEveryone: booleanSchema.default(false),
  })
  .refine((data) => data.assignEveryone || data.assigneeIds.length > 0, {
    message: "Assign this token to at least one person, or to the whole team.",
    path: ["assigneeIds"],
  });

export const tokenStatusSchema = z.object({
  tokenId: idSchema,
  status: tokenStatusValueSchema,
});

export const tokenCommentSchema = z.object({
  tokenId: idSchema,
  body: requiredText("Reply", 2000),
});

export const tokenAssignSchema = z.object({
  tokenId: idSchema,
  assigneeIds: z.array(idSchema).default([]),
  assignEveryone: booleanSchema.default(false),
});

export type CreateTokenValues = z.infer<typeof createTokenSchema>;
export { optionalIdSchema };
