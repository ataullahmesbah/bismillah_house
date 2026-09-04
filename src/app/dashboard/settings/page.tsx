import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { Field, PageHeader } from "@/components/ui";
import {
  saveAiSettingsAction, saveFeatureSettingsAction, saveSecuritySettingsAction,
  saveSiteSettingsAction, saveThemeSettingsAction,
} from "@/app/actions/dashboard/settings";
import { isCaptchaConfigured } from "@/lib/auth/captcha";
import { isGoogleSignInConfigured } from "@/lib/auth/google";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { AI_PROVIDER_LIST } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  await requirePermissionPage(PERMISSIONS.SETTINGS_MANAGE);
  const settings = await getSettings();

  // Whether the keys behind each switch are actually present. A switch turned
  // on without its keys is a no-op, not a lockout — but nobody should have to
  // discover that by trying to sign in.
  const turnstileReady = isCaptchaConfigured();
  const googleReady = isGoogleSignInConfigured();

  // Which providers actually have a key, so the panel says what is missing
  // rather than leaving someone to discover it when a draft fails.
  const aiProviders = AI_PROVIDER_LIST.map((provider) => ({
    key: provider.key,
    label: provider.label,
    consoleUrl: provider.consoleUrl,
    configured: provider.isConfigured(),
  }));

  return (
    <>
      <PageHeader
        title="Business settings"
        description="Shop identity, contact details, social links and feature switches — no code changes needed."
      />

      <div className="stack">
        <ActionForm action={saveSiteSettingsAction} className="stack">
          <section className="card">
            <div className="card-header"><h2 className="card-title">Shop identity</h2></div>
            <div className="card-body stack">
              <div className="grid-form-2">
                <Field label="Shop name" htmlFor="siteName" required>
                  <input id="siteName" name="siteName" className="input" defaultValue={settings.site.siteName} required maxLength={80} />
                </Field>
                <Field label="Tagline" htmlFor="tagline">
                  <input id="tagline" name="tagline" className="input" defaultValue={settings.site.tagline} maxLength={160} />
                </Field>
              </div>

              <div className="grid-form-2">
                <ImageUploadField
                  name="logoUrl"
                  label="Logo"
                  defaultValue={settings.site.logoUrl ?? ""}
                  folder="site"
                  recommendation="280 × 72 px, transparent PNG"
                  maxSizeMb={settings.upload.maxFileSizeMb}
                />
                <ImageUploadField
                  name="faviconUrl"
                  label="Favicon"
                  defaultValue={settings.site.faviconUrl ?? ""}
                  folder="site"
                  recommendation="512 × 512 px PNG"
                  maxSizeMb={settings.upload.maxFileSizeMb}
                />
              </div>

              <Field label="Footer about text" htmlFor="footerAbout">
                <textarea id="footerAbout" name="footerAbout" className="textarea min-h-20" defaultValue={settings.site.footerAbout} maxLength={600} />
              </Field>
              <div className="grid-form-2">
                <Field label="Copyright line" htmlFor="copyright">
                  <input id="copyright" name="copyright" className="input" defaultValue={settings.site.copyright} maxLength={160} />
                </Field>
                <Field label="Timezone" htmlFor="timezone" hint="Used for order timestamps and campaign windows.">
                  <input id="timezone" name="timezone" className="input" defaultValue={settings.site.timezone} maxLength={40} />
                </Field>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Announcement bar</h2></div>
            <div className="card-body stack">
              <label className="check-row">
                <input type="checkbox" name="announcementEnabled" className="checkbox mt-0.5" defaultChecked={settings.site.announcementEnabled} />
                <span>Show the announcement bar at the top of the shop</span>
              </label>
              <Field label="Announcement text" htmlFor="announcement">
                <input id="announcement" name="announcement" className="input" defaultValue={settings.site.announcement} maxLength={200} />
              </Field>
              <Field label="Announcement link" htmlFor="announcementLink" hint="Optional. e.g. /shop?sort=featured">
                <input id="announcementLink" name="announcementLink" className="input" defaultValue={settings.site.announcementLink ?? ""} maxLength={500} />
              </Field>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Contact details</h2></div>
            <div className="card-body grid-form-2">
              <Field label="Phone" htmlFor="phone">
                <input id="phone" name="phone" className="input" defaultValue={settings.contact.phone} maxLength={30} />
              </Field>
              <Field label="Alternate phone" htmlFor="altPhone">
                <input id="altPhone" name="altPhone" className="input" defaultValue={settings.contact.altPhone} maxLength={30} />
              </Field>
              <Field label="General email" htmlFor="email">
                <input id="email" name="email" type="email" className="input" defaultValue={settings.contact.email} maxLength={160} />
              </Field>
              <Field label="Support email" htmlFor="supportEmail">
                <input id="supportEmail" name="supportEmail" type="email" className="input" defaultValue={settings.contact.supportEmail} maxLength={160} />
              </Field>
              <Field label="Working hours" htmlFor="workingHours">
                <input id="workingHours" name="workingHours" className="input" defaultValue={settings.contact.workingHours} maxLength={120} />
              </Field>
              <Field label="Map embed URL" htmlFor="mapEmbedUrl" hint="Optional Google Maps embed link for the contact page.">
                <input id="mapEmbedUrl" name="mapEmbedUrl" className="input" defaultValue={settings.contact.mapEmbedUrl ?? ""} maxLength={2048} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" htmlFor="address">
                  <textarea id="address" name="address" className="textarea min-h-16" defaultValue={settings.contact.address} maxLength={300} />
                </Field>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2 className="card-title">Social links</h2></div>
            <div className="card-body grid-form-3">
              {([
                ["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"],
                ["tiktok", "TikTok"], ["linkedin", "LinkedIn"], ["whatsapp", "WhatsApp"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={key}>
                  <input id={key} name={key} className="input" defaultValue={settings.social[key]} maxLength={300} placeholder="https://…" />
                </Field>
              ))}
            </div>
            <div className="card-footer">
              <SubmitButton>Save business settings</SubmitButton>
            </div>
          </section>
        </ActionForm>

        <ActionForm action={saveThemeSettingsAction} className="card">
          <div className="card-header">
            <h2 className="card-title">Look and feel</h2>
            <span className="muted-xs">Applies across the shop</span>
          </div>
          <div className="card-body stack">
            <div className="grid-form-3">
              <Field
                label="Primary colour"
                htmlFor="primaryColor"
                hint="Main buttons, headers and the cart."
              >
                <select id="primaryColor" name="primaryColor" className="select" defaultValue={settings.theme.primaryColor}>
                  <option value="graphite">Graphite (default)</option>
                  <option value="navy">Navy blue</option>
                </select>
              </Field>

              <Field
                label="Secondary colour"
                htmlFor="secondaryColor"
                hint="Alternate calls to action, such as Buy now."
              >
                <select id="secondaryColor" name="secondaryColor" className="select" defaultValue={settings.theme.secondaryColor}>
                  <option value="navy">Navy blue</option>
                  <option value="graphite">Graphite</option>
                  <option value="accent">Orange</option>
                </select>
              </Field>

              <Field label="Font" htmlFor="fontFamily" hint="Every option also carries a Bengali face.">
                <select id="fontFamily" name="fontFamily" className="select" defaultValue={settings.theme.fontFamily}>
                  <option value="inter">Inter — clean and neutral</option>
                  <option value="manrope">Manrope — rounded and friendly</option>
                  <option value="notoSans">Noto Sans — widest Bangla coverage</option>
                </select>
              </Field>
            </div>

            <div className="panel flex flex-wrap items-center gap-2">
              <span className="muted-xs mr-1">Preview:</span>
              <span className="btn-primary btn-sm">Primary</span>
              <span className="btn-alt btn-sm">Secondary</span>
              <span className="btn-secondary btn-sm">Neutral</span>
            </div>
          </div>
          <div className="card-footer">
            <SubmitButton>Save look and feel</SubmitButton>
          </div>
        </ActionForm>

        <ActionForm action={saveSecuritySettingsAction} className="card">
          <div className="card-header">
            <h2 className="card-title">Sign-in security</h2>
            <span className="muted-xs">Enforced on the server</span>
          </div>
          <div className="card-body stack">
            <div className="alert-neutral">
              <div>
                <p>
                  These are switches. The keys they switch on live in environment variables, never in the
                  database — a switch turned on without its keys simply does nothing.
                </p>
                <ul className="mt-2 space-y-0.5 text-xs">
                  <li>
                    <code className="mono">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> +{" "}
                    <code className="mono">TURNSTILE_SECRET_KEY</code> —{" "}
                    {turnstileReady ? (
                      <span className="font-semibold text-success-700">present</span>
                    ) : (
                      <>
                        missing.{" "}
                        <a
                          href="https://dash.cloudflare.com/?to=/:account/turnstile"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                        >
                          Turnstile is free
                        </a>
                      </>
                    )}
                  </li>
                  <li>
                    <code className="mono">GOOGLE_CLIENT_ID</code> +{" "}
                    <code className="mono">GOOGLE_CLIENT_SECRET</code> —{" "}
                    {googleReady ? (
                      <span className="font-semibold text-success-700">present</span>
                    ) : (
                      <>
                        missing.{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                        >
                          Create OAuth credentials
                        </a>
                      </>
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                name="turnstileEnabled"
                className="checkbox mt-0.5"
                defaultChecked={settings.security.turnstileEnabled}
              />
              <span>
                Cloudflare Turnstile
                <span className="form-hint block">
                  A free bot check that usually resolves without asking the visitor to do anything. Verified on the
                  server, so hiding the widget is never what stops a bot.
                </span>
              </span>
            </label>

            <div className="grid gap-2 pl-6 sm:grid-cols-2">
              <label className="check-row">
                <input
                  type="checkbox"
                  name="turnstileOnLogin"
                  className="checkbox mt-0.5"
                  defaultChecked={settings.security.turnstileOnLogin}
                />
                <span>Challenge on sign-in</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  name="turnstileOnRegister"
                  className="checkbox mt-0.5"
                  defaultChecked={settings.security.turnstileOnRegister}
                />
                <span>Challenge on sign-up</span>
              </label>
            </div>
            <p className="form-hint">
              Sign-up is where the bots are, so protecting it alone is a reasonable choice — it keeps friction off
              customers who already have an account.
            </p>

            <label className="check-row">
              <input
                type="checkbox"
                name="googleAuthEnabled"
                className="checkbox mt-0.5"
                defaultChecked={settings.security.googleAuthEnabled}
              />
              <span>
                Continue with Google
                <span className="form-hint block">
                  Off hides the button and refuses the OAuth route — hiding a button does not stop anyone visiting
                  the URL it points at.
                </span>
              </span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>Save sign-in security</SubmitButton>
          </div>
        </ActionForm>

        <ActionForm action={saveFeatureSettingsAction} className="card">
          <div className="card-header">
            <h2 className="card-title">Feature switches</h2>
            <span className="muted-xs">Take effect immediately</span>
          </div>
          <div className="card-body stack">
            {/*
              * One control rather than the two switches this replaced.
              * "Allow guest checkout" and "Require login for checkout" could be
              * set to contradict each other, and the combination that reads as
              * "guests welcome" (require-login off, allow-guest off) actually
              * sent every shopper to the login page. A single question has no
              * contradictory answer.
              */}
            <Field
              label="Who can check out?"
              htmlFor="checkoutAccess"
              hint="Guests order faster; accounts give you order history and repeat customers."
            >
              <select
                id="checkoutAccess"
                name="checkoutAccess"
                className="select"
                defaultValue={
                  settings.features.requireLoginForCheckout || !settings.features.guestCheckoutEnabled
                    ? "members"
                    : "anyone"
                }
              >
                <option value="anyone">Anyone — no account needed</option>
                <option value="members">Signed-in customers only</option>
              </select>
            </Field>
          </div>

          <div className="card-body grid gap-2 border-t border-line sm:grid-cols-2">
            {([
              ["reviewsEnabled", "Enable product reviews", "Show and accept customer reviews."],
              ["requireDeliveredForReview", "Reviews only after delivery", "Recommended — keeps reviews genuine."],
              ["autoApproveReviews", "Auto-approve reviews", "Skip the moderation queue."],
              ["chatbotEnabled", "AI shopping assistant", "Show the assistant widget on the shop."],
              ["messagingEnabled", "Customer messaging", "Let customers open support conversations."],
              ["popupAdsEnabled", "Popup banners", "Allow scheduled popup ads."],
              [
                "checkoutOtpEnabled",
                "Verify mobile number at checkout",
                "Sends an SMS code before an order is accepted. Needs an SMS gateway configured — see SMS_PROVIDER in .env.",
              ],
              ["lowStockAlerts", "Low stock alerts", "Notify staff when stock runs low."],
              ["maintenanceMode", "Maintenance mode", "Takes the storefront offline for visitors."],
            ] as const).map(([key, title, hint]) => (
              <label key={key} className="check-row">
                <input type="checkbox" name={key} className="checkbox mt-0.5" defaultChecked={settings.features[key]} />
                <span className="min-w-0">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-xs text-brand-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="card-footer">
            <SubmitButton>Save feature switches</SubmitButton>
          </div>
        </ActionForm>

        <ActionForm action={saveAiSettingsAction} className="card">
          <div className="card-header">
            <h2 className="card-title">AI assistant &amp; automation</h2>
            <span className={aiProviders.some((p) => p.configured) ? "badge-green" : "badge-amber"}>
              {aiProviders.filter((p) => p.configured).length} of {aiProviders.length} providers ready
            </span>
          </div>
          <div className="card-body stack">
            <div className="alert-neutral">
              <div>
                <p>
                  API keys live in environment variables, never in the database. With none set the assistant falls
                  back to a plain catalogue search and the message below, and product drafting stays unavailable —
                  nothing breaks.
                </p>
                <ul className="mt-2 space-y-0.5 text-xs">
                  {aiProviders.map((provider) => (
                    <li key={provider.key}>
                      <code className="mono">{provider.key.toUpperCase()}_API_KEY</code> — {provider.label}{" "}
                      {provider.configured ? (
                        <span className="font-semibold text-success-700">ready</span>
                      ) : (
                        <a href={provider.consoleUrl} target="_blank" rel="noopener noreferrer" className="link">
                          get a key
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <label className="check-row">
              <input type="checkbox" name="aiEnabled" className="checkbox mt-0.5" defaultChecked={settings.ai.enabled} />
              <span>Enable the assistant</span>
            </label>

            <div className="grid-form-2">
              <Field label="Assistant name" htmlFor="assistantName">
                <input id="assistantName" name="assistantName" className="input" defaultValue={settings.ai.assistantName} maxLength={60} />
              </Field>
              <Field label="Products in context" htmlFor="maxProductsInContext" hint="How many catalogue entries the assistant may see per question.">
                <input id="maxProductsInContext" name="maxProductsInContext" type="number" min="3" max="30" className="input" defaultValue={settings.ai.maxProductsInContext} />
              </Field>
            </div>
            <Field label="Greeting" htmlFor="greeting">
              <input id="greeting" name="greeting" className="input" defaultValue={settings.ai.greeting} maxLength={300} />
            </Field>
            <Field label="Fallback message" htmlFor="fallbackMessage" hint="Shown when no AI provider is configured or the provider is down.">
              <textarea id="fallbackMessage" name="fallbackMessage" className="textarea min-h-16" defaultValue={settings.ai.fallbackMessage} maxLength={500} />
            </Field>

            <hr className="border-line" />

            <div className="grid-form-2">
              <Field
                label="Product drafting"
                htmlFor="productMode"
                hint="No mode publishes anything on its own — a person always approves."
              >
                <select id="productMode" name="productMode" className="select" defaultValue={settings.ai.productMode}>
                  <option value="manual">Manual only — hide the AI panel</option>
                  <option value="ai">AI drafts, a person approves</option>
                  <option value="hybrid">Hybrid — AI fills what it can</option>
                </select>
              </Field>

              <Field label="Try first" htmlFor="primaryProvider" hint="Falls through to the others if it fails.">
                <select id="primaryProvider" name="primaryProvider" className="select" defaultValue={settings.ai.primaryProvider}>
                  {aiProviders.map((provider) => (
                    <option key={provider.key} value={provider.key}>{provider.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Gemini model" htmlFor="geminiModel">
                <input id="geminiModel" name="geminiModel" className="input mono text-xs" defaultValue={settings.ai.geminiModel} maxLength={80} />
              </Field>
              <Field label="OpenAI model" htmlFor="openaiModel">
                <input id="openaiModel" name="openaiModel" className="input mono text-xs" defaultValue={settings.ai.openaiModel} maxLength={80} />
              </Field>
              <Field label="Anthropic model" htmlFor="anthropicModel">
                <input id="anthropicModel" name="anthropicModel" className="input mono text-xs" defaultValue={settings.ai.anthropicModel} maxLength={80} />
              </Field>
              <Field label="Monthly request budget" htmlFor="monthlyRequestBudget" hint="Shown on the drafting screen so nobody is surprised by a bill.">
                <input
                  id="monthlyRequestBudget"
                  name="monthlyRequestBudget"
                  type="number"
                  min="0"
                  className="input"
                  defaultValue={settings.ai.monthlyRequestBudget}
                />
              </Field>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                name="autoPublishDrafts"
                className="checkbox mt-0.5"
                defaultChecked={settings.ai.autoPublishDrafts}
              />
              <span>
                Let AI drafts go live without review
                <span className="form-hint block">
                  Leave this off. A model that invents a specification puts a wrong listing in front of customers,
                  and nobody finds out until the parcel comes back.
                </span>
              </span>
            </label>
          </div>
          <div className="card-footer">
            <SubmitButton>Save assistant settings</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
