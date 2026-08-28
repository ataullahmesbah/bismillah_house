"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { booleanSchema, formDataToObject, optionalText, requiredText, slugSchema, urlSchema } from "@/lib/validation/common";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

/** CMS: pages, FAQ, homepage sections, navigation and testimonials. */

/* ------------------------------- Pages ------------------------------------ */

const pageSchema = z.object({
  slug: slugSchema,
  title: requiredText("Title", 200),
  excerpt: optionalText(400),
  content: requiredText("Content", 100000),
  type: z.enum(["POLICY", "HELP", "GENERIC"]).default("GENERIC"),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  noIndex: booleanSchema.default(false),
  isPublished: booleanSchema.default(true),
  position: z.coerce.number().int().min(0).max(999).default(0),
});

export async function savePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = pageSchema.parse(formDataToObject(formData));
    const slug = slugify(input.slug);

    const clash = await prisma.page.findFirst({
      where: { slug, NOT: id ? { id } : undefined },
      select: { id: true },
    });
    if (clash) throw errors.validation("That page URL is already used.", { slug: "Slug already in use." });

    const data = { ...input, slug };
    const page = id ? await prisma.page.update({ where: { id }, data }) : await prisma.page.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "page",
      entityId: page.id,
      summary: `${id ? "Updated" : "Created"} page “${page.title}” (/${page.slug})`,
    });

    revalidatePath(`/${page.slug}`);
    revalidatePath("/dashboard/content/pages");
    revalidatePath("/help");
    return actionSuccess(id ? "Page updated." : "Page created.", "/dashboard/content/pages");
  } catch (error) {
    return actionFailure(error, "savePage");
  }
}

export async function deletePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    const id = String(formData.get("id") ?? "");
    const page = await prisma.page.delete({ where: { id }, select: { slug: true, title: true } });
    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.CONTENT_CHANGED,
      entityType: "page",
      entityId: id,
      summary: `Deleted page “${page.title}”`,
      severity: "WARNING",
    });
    revalidatePath("/dashboard/content/pages");
    revalidatePath(`/${page.slug}`);
    return actionSuccess("Page deleted.");
  } catch (error) {
    return actionFailure(error, "deletePage");
  }
}

/* -------------------------------- FAQ ------------------------------------- */

const faqSchema = z.object({
  question: requiredText("Question", 300),
  answer: requiredText("Answer", 8000),
  category: requiredText("Category", 60),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanSchema.default(true),
});

export async function saveFaqAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = faqSchema.parse(formDataToObject(formData));

    const faq = id ? await prisma.faq.update({ where: { id }, data: input }) : await prisma.faq.create({ data: input });

    await recordAudit({
      actor: user, action: AUDIT_ACTIONS.CONTENT_CHANGED, entityType: "faq", entityId: faq.id,
      summary: `${id ? "Updated" : "Created"} FAQ entry`,
    });

    revalidatePath("/faq");
    revalidatePath("/dashboard/content/faq");
    return actionSuccess(id ? "FAQ updated." : "FAQ added.");
  } catch (error) {
    return actionFailure(error, "saveFaq");
  }
}

export async function deleteFaqAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    await prisma.faq.delete({ where: { id: String(formData.get("id") ?? "") } });
    revalidatePath("/faq");
    revalidatePath("/dashboard/content/faq");
    return actionSuccess("FAQ removed.");
  } catch (error) {
    return actionFailure(error, "deleteFaq");
  }
}

/* -------------------------- Homepage sections ------------------------------ */

const homeSectionSchema = z.object({
  key: requiredText("Key", 60),
  type: z.enum([
    "HERO", "CATEGORY_GRID", "FEATURED_PRODUCTS", "FLASH_SALE", "TOP_SELLING",
    "NEW_ARRIVALS", "BANNER", "TESTIMONIALS", "TRUST_BADGES", "RICH_TEXT",
  ]),
  title: optionalText(200),
  subtitle: optionalText(300),
  limit: z.coerce.number().int().min(2).max(48).default(8),
  html: optionalText(20000),
  position: z.coerce.number().int().min(0).max(99).default(0),
  isActive: booleanSchema.default(true),
});

export async function saveHomeSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = homeSectionSchema.parse(formDataToObject(formData));

    const data = {
      key: slugify(input.key),
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      config: { limit: input.limit, ...(input.html ? { html: input.html } : {}) },
      position: input.position,
      isActive: input.isActive,
    };

    const section = id
      ? await prisma.homeSection.update({ where: { id }, data })
      : await prisma.homeSection.create({ data });

    await recordAudit({
      actor: user, action: AUDIT_ACTIONS.CONTENT_CHANGED, entityType: "home_section", entityId: section.id,
      summary: `${id ? "Updated" : "Added"} homepage section “${section.key}”`,
    });

    revalidatePath("/");
    revalidatePath("/dashboard/content/home");
    return actionSuccess(id ? "Section updated." : "Section added.");
  } catch (error) {
    return actionFailure(error, "saveHomeSection");
  }
}

export async function deleteHomeSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    await prisma.homeSection.delete({ where: { id: String(formData.get("id") ?? "") } });
    revalidatePath("/");
    revalidatePath("/dashboard/content/home");
    return actionSuccess("Section removed.");
  } catch (error) {
    return actionFailure(error, "deleteHomeSection");
  }
}

/* ----------------------------- Navigation ---------------------------------- */

const navItemSchema = z.object({
  menuKey: requiredText("Menu", 40),
  parentId: z.union([z.string(), z.literal("")]).transform((v) => v || null).nullable(),
  label: requiredText("Label", 80),
  type: z.enum(["INTERNAL", "EXTERNAL", "CATEGORY", "PAGE"]).default("INTERNAL"),
  url: z.union([urlSchema, z.literal("")]).transform((v) => v || null).nullable(),
  categoryId: z.union([z.string(), z.literal("")]).transform((v) => v || null).nullable(),
  pageId: z.union([z.string(), z.literal("")]).transform((v) => v || null).nullable(),
  description: optionalText(200),
  badgeText: optionalText(20),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanSchema.default(true),
  openInNewTab: booleanSchema.default(false),
  isMegaColumn: booleanSchema.default(false),
});

export async function saveNavigationItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.NAVIGATION_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = navItemSchema.parse(formDataToObject(formData));

    const menu = await prisma.navigationMenu.upsert({
      where: { key: input.menuKey },
      create: { key: input.menuKey, title: input.menuKey },
      update: {},
      select: { id: true },
    });

    if (input.type === "INTERNAL" && !input.url) {
      throw errors.validation("Enter the internal path for this link.", { url: "Path required." });
    }
    if (input.type === "EXTERNAL" && !input.url) {
      throw errors.validation("Enter the external URL for this link.", { url: "URL required." });
    }
    if (input.type === "CATEGORY" && !input.categoryId) {
      throw errors.validation("Choose a category.", { categoryId: "Category required." });
    }
    if (input.type === "PAGE" && !input.pageId) {
      throw errors.validation("Choose a page.", { pageId: "Page required." });
    }
    if (id && input.parentId === id) {
      throw errors.validation("A menu item cannot be its own parent.");
    }

    const data = {
      menuId: menu.id,
      parentId: input.parentId,
      label: input.label,
      type: input.type,
      url: input.url,
      categoryId: input.categoryId,
      pageId: input.pageId,
      description: input.description,
      badgeText: input.badgeText,
      position: input.position,
      isActive: input.isActive,
      openInNewTab: input.openInNewTab,
      isMegaColumn: input.isMegaColumn,
    };

    const item = id
      ? await prisma.navigationItem.update({ where: { id }, data })
      : await prisma.navigationItem.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.NAVIGATION_CHANGED,
      entityType: "navigation_item",
      entityId: item.id,
      summary: `${id ? "Updated" : "Added"} “${item.label}” in ${input.menuKey}`,
    });

    revalidatePath("/", "layout");
    revalidatePath("/dashboard/content/navigation");
    return actionSuccess(id ? "Menu item updated." : "Menu item added.");
  } catch (error) {
    return actionFailure(error, "saveNavigationItem");
  }
}

export async function deleteNavigationItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.NAVIGATION_MANAGE);
    const id = String(formData.get("id") ?? "");
    const item = await prisma.navigationItem.delete({ where: { id }, select: { label: true } });
    await recordAudit({
      actor: user, action: AUDIT_ACTIONS.NAVIGATION_CHANGED, entityType: "navigation_item", entityId: id,
      summary: `Removed “${item.label}” from navigation`,
    });
    revalidatePath("/", "layout");
    revalidatePath("/dashboard/content/navigation");
    return actionSuccess("Menu item removed.");
  } catch (error) {
    return actionFailure(error, "deleteNavigationItem");
  }
}

/* ---------------------------- Testimonials --------------------------------- */

const testimonialSchema = z.object({
  name: requiredText("Name", 120),
  role: optionalText(120),
  avatarUrl: optionalText(2048),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  body: requiredText("Testimonial", 1000),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isActive: booleanSchema.default(true),
});

export async function saveTestimonialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    const id = String(formData.get("id") ?? "");
    const input = testimonialSchema.parse(formDataToObject(formData));

    const testimonial = id
      ? await prisma.testimonial.update({ where: { id }, data: input })
      : await prisma.testimonial.create({ data: input });

    await recordAudit({
      actor: user, action: AUDIT_ACTIONS.CONTENT_CHANGED, entityType: "testimonial", entityId: testimonial.id,
      summary: `${id ? "Updated" : "Added"} testimonial from ${testimonial.name}`,
    });

    revalidatePath("/");
    revalidatePath("/dashboard/content/testimonials");
    return actionSuccess(id ? "Testimonial updated." : "Testimonial added.");
  } catch (error) {
    return actionFailure(error, "saveTestimonial");
  }
}

export async function deleteTestimonialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission(PERMISSIONS.CONTENT_MANAGE);
    await prisma.testimonial.delete({ where: { id: String(formData.get("id") ?? "") } });
    revalidatePath("/");
    revalidatePath("/dashboard/content/testimonials");
    return actionSuccess("Testimonial removed.");
  } catch (error) {
    return actionFailure(error, "deleteTestimonial");
  }
}
