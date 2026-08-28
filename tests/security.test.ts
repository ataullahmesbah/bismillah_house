import { describe, expect, it } from "vitest";

import { canAssignRole, canManageUser, requiresStatusNote } from "@/lib/auth/rbac";
import { ORDER_STATUS_TRANSITIONS, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, isStaffRole } from "@/lib/constants";
import { isSafeUrl, maskEmail, maskPhone, safeRedirectPath } from "@/lib/utils";
import { redact } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { Role } from "@/generated/prisma/enums";

function user(role: Role, id = "u1"): SessionUser {
  return { id, name: "Test", email: "t@example.com", phone: null, role, status: "ACTIVE", avatarUrl: null };
}

/* -------------------------------------------------------------------------- */
/* Super Admin protection (PRD §20 / §41)                                      */
/* -------------------------------------------------------------------------- */

describe("chain of command", () => {
  it("lets an owner manage everyone, including another owner", () => {
    // A shop with two owners needs one able to revoke the other's access when
    // they leave. The "last remaining owner" guard is enforced in the action,
    // where the rows can be counted.
    expect(canManageUser(user("SUPER_ADMIN"), "SUPER_ADMIN", "other")).toBe(true);
    expect(canManageUser(user("SUPER_ADMIN"), "ADMIN", "other")).toBe(true);
    expect(canManageUser(user("SUPER_ADMIN"), "MODERATOR", "other")).toBe(true);
    expect(canManageUser(user("SUPER_ADMIN"), "CUSTOMER", "other")).toBe(true);
  });

  it("keeps an owner out of reach of everyone below them", () => {
    expect(canManageUser(user("ADMIN"), "SUPER_ADMIN", "other")).toBe(false);
    expect(canManageUser(user("MODERATOR"), "SUPER_ADMIN", "other")).toBe(false);
  });

  it("stops an admin acting sideways on another admin", () => {
    expect(canManageUser(user("ADMIN"), "ADMIN", "other")).toBe(false);
  });

  it("lets an owner hire a co-owner", () => {
    // Without this the only way to add a second owner is editing the database
    // by hand, which is worse than doing it in an audited screen.
    expect(canAssignRole(user("SUPER_ADMIN"), "SUPER_ADMIN")).toBe(true);
    expect(canAssignRole(user("SUPER_ADMIN"), "ADMIN")).toBe(true);
    expect(canAssignRole(user("SUPER_ADMIN"), "MODERATOR")).toBe(true);
    // Demoting a staff member back to a plain customer is a role change too.
    expect(canAssignRole(user("SUPER_ADMIN"), "CUSTOMER")).toBe(true);
  });

  it("lets nobody but the owner hand out roles", () => {
    // Suspending someone and promoting someone are different powers: an admin
    // has the first, only the owner has the second.
    expect(canAssignRole(user("ADMIN"), "SUPER_ADMIN")).toBe(false);
    expect(canAssignRole(user("ADMIN"), "ADMIN")).toBe(false);
    expect(canAssignRole(user("ADMIN"), "MODERATOR")).toBe(false);
    expect(canAssignRole(user("MODERATOR"), "MODERATOR")).toBe(false);
    expect(canAssignRole(user("MODERATOR"), "CUSTOMER")).toBe(false);
  });

  it("stops a user changing their own privileges", () => {
    // Otherwise the weakest account on the team is one submission from owning
    // the shop.
    expect(canManageUser(user("SUPER_ADMIN", "me"), "SUPER_ADMIN", "me")).toBe(false);
    expect(canManageUser(user("ADMIN", "me"), "ADMIN", "me")).toBe(false);
    expect(canManageUser(user("MODERATOR", "me"), "MODERATOR", "me")).toBe(false);
  });

  it("requires a moderator to explain a status change, but not an owner", () => {
    expect(requiresStatusNote(user("MODERATOR"))).toBe(true);
    expect(requiresStatusNote(user("ADMIN"))).toBe(false);
    expect(requiresStatusNote(user("SUPER_ADMIN"))).toBe(false);
  });

  it("lets an admin manage ordinary staff and customers", () => {
    expect(canManageUser(user("ADMIN"), "MODERATOR", "other")).toBe(true);
    expect(canManageUser(user("ADMIN"), "CUSTOMER", "other")).toBe(true);
    expect(canManageUser(user("MODERATOR"), "CUSTOMER", "other")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Role defaults                                                               */
/* -------------------------------------------------------------------------- */

describe("default role permissions", () => {
  it("treats admins and moderators as staff and customers as not", () => {
    expect(isStaffRole("SUPER_ADMIN")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("MODERATOR")).toBe(true);
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("keeps ownership-level controls away from Admin by default", () => {
    const admin = DEFAULT_ROLE_PERMISSIONS.ADMIN;
    expect(admin).not.toContain(PERMISSIONS.ROLE_MANAGE);
    expect(admin).not.toContain(PERMISSIONS.STAFF_MANAGE);
    expect(admin).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(admin).not.toContain(PERMISSIONS.AUDIT_VIEW);
  });

  it("lets a Moderator run the order desk and build the catalogue", () => {
    const moderator = DEFAULT_ROLE_PERMISSIONS.MODERATOR;
    expect(moderator).toContain(PERMISSIONS.REVIEW_MODERATE);
    expect(moderator).toContain(PERMISSIONS.MESSAGE_REPLY);
    // The day-to-day order desk is theirs.
    expect(moderator).toContain(PERMISSIONS.ORDER_UPDATE_STATUS);
    expect(moderator).toContain(PERMISSIONS.PRODUCT_CREATE);
    expect(moderator).toContain(PERMISSIONS.PRODUCT_UPDATE);
  });

  it("stops a Moderator short of approving their own work or touching money", () => {
    const moderator = DEFAULT_ROLE_PERMISSIONS.MODERATOR;

    // Writing a product is not the same as deciding customers should see it,
    // and a moderator may only touch products they created.
    expect(moderator).not.toContain(PERMISSIONS.PRODUCT_PUBLISH);
    expect(moderator).not.toContain(PERMISSIONS.PRODUCT_MANAGE_ALL);
    expect(moderator).not.toContain(PERMISSIONS.PRODUCT_DELETE);

    // Money and personal data stay with an admin.
    expect(moderator).not.toContain(PERMISSIONS.ORDER_REFUND);
    expect(moderator).not.toContain(PERMISSIONS.ORDER_CANCEL);
    expect(moderator).not.toContain(PERMISSIONS.ORDER_CUSTOMER_SEARCH);
    expect(moderator).not.toContain(PERMISSIONS.ORDER_VIEW_CONTACT);
    expect(moderator).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
  });

  it("lets an Admin approve what a Moderator drafted", () => {
    const admin = DEFAULT_ROLE_PERMISSIONS.ADMIN;
    expect(admin).toContain(PERMISSIONS.PRODUCT_PUBLISH);
    expect(admin).toContain(PERMISSIONS.PRODUCT_MANAGE_ALL);
  });
});

/* -------------------------------------------------------------------------- */
/* Order state machine                                                         */
/* -------------------------------------------------------------------------- */

describe("order status transitions", () => {
  it("allows the normal fulfilment path", () => {
    expect(ORDER_STATUS_TRANSITIONS.PENDING).toContain("CONFIRMED");
    expect(ORDER_STATUS_TRANSITIONS.CONFIRMED).toContain("PROCESSING");
    expect(ORDER_STATUS_TRANSITIONS.PROCESSING).toContain("PACKED");
    expect(ORDER_STATUS_TRANSITIONS.PACKED).toContain("SHIPPED");
    expect(ORDER_STATUS_TRANSITIONS.SHIPPED).toContain("OUT_FOR_DELIVERY");
    expect(ORDER_STATUS_TRANSITIONS.OUT_FOR_DELIVERY).toContain("DELIVERED");
  });

  it("rejects impossible jumps", () => {
    expect(ORDER_STATUS_TRANSITIONS.PENDING).not.toContain("DELIVERED");
    expect(ORDER_STATUS_TRANSITIONS.DELIVERED).not.toContain("PENDING");
    expect(ORDER_STATUS_TRANSITIONS.DELIVERED).not.toContain("SHIPPED");
    expect(ORDER_STATUS_TRANSITIONS.CANCELLED).not.toContain("DELIVERED");
  });

  it("treats a refunded order as final", () => {
    expect(ORDER_STATUS_TRANSITIONS.REFUNDED).toHaveLength(0);
  });

  it("routes fraud review to a decision, never straight to delivery", () => {
    expect(ORDER_STATUS_TRANSITIONS.FRAUD_REVIEW).toEqual(
      expect.arrayContaining(["CONFIRMED", "REJECTED", "CANCELLED"]),
    );
    expect(ORDER_STATUS_TRANSITIONS.FRAUD_REVIEW).not.toContain("DELIVERED");
  });

  it("only allows a return or refund after delivery, rejection or return", () => {
    expect(ORDER_STATUS_TRANSITIONS.DELIVERED).toContain("RETURNED");
    expect(ORDER_STATUS_TRANSITIONS.RETURNED).toContain("REFUNDED");
    expect(ORDER_STATUS_TRANSITIONS.PENDING).not.toContain("RETURNED");
  });
});

/* -------------------------------------------------------------------------- */
/* Open redirect and unsafe URL protection                                     */
/* -------------------------------------------------------------------------- */

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/account/orders")).toBe("/account/orders");
    expect(safeRedirectPath("/checkout?coupon=X")).toBe("/checkout?coupon=X");
  });

  it("blocks absolute and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://evil.example/steal")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("\\\\evil.example")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("falls back when nothing is supplied", () => {
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/");
  });
});

describe("isSafeUrl", () => {
  it("accepts http(s) and relative paths only", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("/shop")).toBe(true);
  });

  it("rejects script and data URLs", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeUrl("not a url")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Contact masking                                                             */
/* -------------------------------------------------------------------------- */

describe("contact masking", () => {
  it("hides most of a phone number", () => {
    const masked = maskPhone("01712345678");
    expect(masked).toContain("017");
    expect(masked).toContain("678");
    expect(masked).not.toContain("1234");
  });

  it("hides most of an email local part", () => {
    const masked = maskEmail("nusrat.jahan@example.com");
    expect(masked.startsWith("nu")).toBe(true);
    expect(masked.endsWith("@example.com")).toBe(true);
    expect(masked).not.toContain("nusrat.jahan");
  });
});

/* -------------------------------------------------------------------------- */
/* Audit redaction                                                             */
/* -------------------------------------------------------------------------- */

describe("audit redaction", () => {
  it("strips secrets before they reach the audit log", () => {
    const output = redact({
      email: "a@b.com",
      password: "hunter2",
      passwordHash: "$2a$12$abc",
      token: "abc123",
      apiKey: "sk-live-123",
      nested: { secret: "shhh", storePassword: "p", keep: "visible" },
    }) as Record<string, unknown>;

    expect(output.email).toBe("a@b.com");
    expect(output.password).toBe("[redacted]");
    expect(output.passwordHash).toBe("[redacted]");
    expect(output.token).toBe("[redacted]");
    expect(output.apiKey).toBe("[redacted]");
    const nested = output.nested as Record<string, unknown>;
    expect(nested.secret).toBe("[redacted]");
    expect(nested.storePassword).toBe("[redacted]");
    expect(nested.keep).toBe("visible");
  });

  it("handles arrays, dates and nullish values", () => {
    expect(redact(null)).toBeNull();
    expect(redact([1, 2, 3])).toEqual([1, 2, 3]);
    expect(typeof redact(new Date())).toBe("string");
  });
});

describe("hero call-to-action buttons", () => {
  /**
   * The rule the homepage applies: a button needs both a label and a link.
   * A label with no link is a button that goes nowhere, and neither set means
   * the whole row is skipped rather than leaving a gap where buttons would be.
   */
  function ctaButtons(hero: {
    ctaLabel?: string | null;
    linkUrl?: string | null;
    secondaryCtaLabel?: string | null;
    secondaryLinkUrl?: string | null;
  }) {
    return [
      { label: hero.ctaLabel, href: hero.linkUrl },
      { label: hero.secondaryCtaLabel, href: hero.secondaryLinkUrl },
    ].filter((button): button is { label: string; href: string } =>
      Boolean(button.label?.trim() && button.href?.trim()),
    );
  }

  it("shows nothing when nothing is configured", () => {
    expect(ctaButtons({})).toHaveLength(0);
    expect(ctaButtons({ ctaLabel: null, linkUrl: null })).toHaveLength(0);
  });

  it("shows one button when only one pair is complete", () => {
    expect(ctaButtons({ ctaLabel: "Shop now", linkUrl: "/shop" })).toHaveLength(1);
    expect(ctaButtons({ secondaryCtaLabel: "Track", secondaryLinkUrl: "/track-order" })).toHaveLength(1);
  });

  it("shows both when both pairs are complete", () => {
    expect(
      ctaButtons({
        ctaLabel: "Shop now",
        linkUrl: "/shop",
        secondaryCtaLabel: "Track order",
        secondaryLinkUrl: "/track-order",
      }),
    ).toHaveLength(2);
  });

  it("skips a half-configured button rather than linking nowhere", () => {
    expect(ctaButtons({ ctaLabel: "Shop now" })).toHaveLength(0);
    expect(ctaButtons({ linkUrl: "/shop" })).toHaveLength(0);
    expect(ctaButtons({ ctaLabel: "   ", linkUrl: "/shop" })).toHaveLength(0);
  });
});
