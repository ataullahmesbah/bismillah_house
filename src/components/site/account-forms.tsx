"use client";

import { useActionState, useState } from "react";

import {
  changePasswordAction, signOutEverywhereAction, updateProfileAction,
} from "@/app/actions/auth";
import {
  deleteAddressAction, markNotificationsReadAction, replyToConversationAction,
  saveAddressAction, startConversationAction, submitReviewAction,
} from "@/app/actions/account";
import { Field } from "@/components/ui";
import { idleState, type ActionState } from "@/lib/api";
import { usePreservedForm } from "@/lib/hooks/use-preserved-form";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/ui/password-input";

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "success" && state.message) {
    return <div className="alert-success" role="status"><div>{state.message}</div></div>;
  }
  if (state.status === "error") {
    return <div className="alert-danger" role="alert"><div>{state.message}</div></div>;
  }
  return null;
}

/* -------------------------------------------------------------------------- */

export function ProfileForm({ user }: { user: { name: string; email: string; phone: string | null } }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form {...formProps} action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Personal details</h2></div>
      <div className="card-body stack">
        <Feedback state={state} />
        <div className="grid-form-2">
          <Field label="Full name" htmlFor="name" required error={fields.name}>
            <input id="name" name="name" className="input" defaultValue={user.name} required maxLength={120} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" required error={fields.phone}>
            <input id="phone" name="phone" className="input" defaultValue={user.phone ?? ""} required inputMode="tel" maxLength={20} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Contact support to change the email on your account.">
            <input id="email" className="input" defaultValue={user.email} disabled />
          </Field>
        </div>
      </div>
      <div className="card-footer">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, idleState);
  const { formProps } = usePreservedForm(state);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form {...formProps} action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Change password</h2></div>
      <div className="card-body stack">
        <Feedback state={state} />
        <Field label="Current password" htmlFor="currentPassword" required error={fields.currentPassword}>
          <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="password" required error={fields.password} hint="At least 8 characters with upper case, lower case and a number.">
          <PasswordInput id="password" name="password" required autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" required error={fields.confirmPassword}>
          <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" />
        </Field>
      </div>
      <div className="card-footer">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

export function SignOutEverywhereForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionState) => signOutEverywhereAction(),
    idleState,
  );

  return (
    <form action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Active sessions</h2></div>
      <div className="card-body stack">
        <Feedback state={state} />
        <p className="text-sm text-brand-600">
          Signing out everywhere revokes every device that is currently signed in, including this one.
        </p>
      </div>
      <div className="card-footer">
        <button type="submit" className="btn-danger-soft" disabled={pending}>
          {pending ? "Signing out…" : "Sign out on all devices"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export type AddressRow = {
  id: string;
  label: string | null;
  type: string;
  fullName: string;
  phone: string;
  districtId: string | null;
  districtName: string;
  city: string | null;
  area: string | null;
  addressLine1: string;
  postalCode: string | null;
  isDefault: boolean;
};

export function AddressManager({
  addresses,
  districts,
}: {
  addresses: AddressRow[];
  districts: Array<{ id: string; name: string; division: string }>;
}) {
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [creating, setCreating] = useState(addresses.length === 0);
  const [saveState, saveAction, savePending] = useActionState(saveAddressAction, idleState);
  const { formProps: addressFormProps } = usePreservedForm(saveState);
  const [deleteState, deleteAction] = useActionState(deleteAddressAction, idleState);

  const fields = saveState.status === "error" ? (saveState.fields ?? {}) : {};
  const active = editing;
  const showForm = creating || Boolean(editing);

  const grouped = districts.reduce<Record<string, typeof districts>>((acc, district) => {
    (acc[district.division] ||= []).push(district);
    return acc;
  }, {});

  return (
    <div className="stack">
      <Feedback state={saveState} />
      <Feedback state={deleteState} />

      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <div key={address.id} className="card p-4">
            <div className="row-between">
              <p className="text-sm font-bold">
                {address.label ?? address.fullName}
                {address.isDefault ? <span className="badge-gray ml-2">Default</span> : null}
              </p>
              <span className="badge-outline">{address.type}</span>
            </div>
            <p className="mt-2 text-sm text-brand-600">
              {address.fullName} · {address.phone}
              <br />
              {address.addressLine1}
              {address.area ? `, ${address.area}` : ""}
              {address.city ? `, ${address.city}` : ""}
              <br />
              {address.districtName}
              {address.postalCode ? ` — ${address.postalCode}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={() => { setEditing(address); setCreating(false); }}
              >
                Edit
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="addressId" value={address.id} />
                <button type="submit" className="btn-danger-soft btn-xs">Remove</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button type="button" className="btn-primary self-start" onClick={() => { setCreating(true); setEditing(null); }}>
          Add a new address
        </button>
      ) : (
        <form {...addressFormProps} action={saveAction} className="card" key={active?.id ?? "new"}>
          <div className="card-header">
            <h2 className="card-title">{active ? "Edit address" : "New address"}</h2>
          </div>
          <div className="card-body grid-form-2">
            <input type="hidden" name="addressId" value={active?.id ?? ""} />

            <Field label="Label" htmlFor="label" hint="Home, Office, Mum’s house…">
              <input id="label" name="label" className="input" defaultValue={active?.label ?? ""} maxLength={40} />
            </Field>
            <Field label="Address type" htmlFor="type">
              <select id="type" name="type" className="select" defaultValue={active?.type ?? "HOME"}>
                <option value="HOME">Home</option>
                <option value="OFFICE">Office</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Recipient name" htmlFor="fullName" required error={fields.fullName}>
              <input id="fullName" name="fullName" className="input" defaultValue={active?.fullName ?? ""} required maxLength={120} />
            </Field>
            <Field label="Mobile number" htmlFor="addr-phone" required error={fields.phone}>
              <input id="addr-phone" name="phone" className="input" defaultValue={active?.phone ?? ""} required inputMode="tel" maxLength={20} />
            </Field>
            <Field label="District" htmlFor="districtId" required error={fields.districtId}>
              <select id="districtId" name="districtId" className="select" defaultValue={active?.districtId ?? ""} required>
                <option value="">Select district</option>
                {Object.entries(grouped).map(([division, items]) => (
                  <optgroup key={division} label={division}>
                    {items.map((district) => (
                      <option key={district.id} value={district.id}>{district.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Area / thana" htmlFor="area">
              <input id="area" name="area" className="input" defaultValue={active?.area ?? ""} maxLength={120} />
            </Field>
            <Field label="City / town" htmlFor="city">
              <input id="city" name="city" className="input" defaultValue={active?.city ?? ""} maxLength={80} />
            </Field>
            <Field label="Postal code" htmlFor="postalCode">
              <input id="postalCode" name="postalCode" className="input" defaultValue={active?.postalCode ?? ""} maxLength={12} inputMode="numeric" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Full address" htmlFor="addressLine1" required error={fields.addressLine1}>
                <textarea id="addressLine1" name="addressLine1" className="textarea" defaultValue={active?.addressLine1 ?? ""} required rows={3} maxLength={300} />
              </Field>
            </div>
            <label className="check-row sm:col-span-2">
              <input type="checkbox" name="isDefault" value="true" className="checkbox mt-0.5" defaultChecked={active?.isDefault ?? addresses.length === 0} />
              <span>Use this as my default delivery address</span>
            </label>
          </div>
          <div className="card-footer">
            <button type="button" className="btn-ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={savePending}>
              {savePending ? "Saving…" : "Save address"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function ReviewForm({
  productId,
  orderItemId,
  productName,
}: {
  productId: string;
  orderItemId: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState(submitReviewAction, idleState);
  const { formProps } = usePreservedForm(state);
  const [rating, setRating] = useState(5);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  if (state.status === "success") {
    return <div className="alert-success" role="status"><div>{state.message}</div></div>;
  }

  return (
    <form {...formProps} action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">Review {productName}</h2></div>
      <div className="card-body stack">
        <Feedback state={state} />
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="orderItemId" value={orderItemId} />
        <input type="hidden" name="rating" value={rating} />

        <div className="field">
          <span className="label">Your rating</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={cn("text-2xl leading-none transition-colors", value <= rating ? "text-accent-500" : "text-brand-300")}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                aria-pressed={value === rating}
              >
                ★
              </button>
            ))}
          </div>
          {fields.rating ? <p className="form-error">{fields.rating}</p> : null}
        </div>

        <Field label="Title" htmlFor="title" error={fields.title}>
          <input id="title" name="title" className="input" maxLength={160} placeholder="Sum up your experience" />
        </Field>

        <Field label="Your review" htmlFor="body" required error={fields.body}>
          <textarea id="body" name="body" className="textarea" required rows={4} maxLength={3000} placeholder="What did you like or dislike?" />
        </Field>
      </div>
      <div className="card-footer">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function NewConversationForm({ orders }: { orders: Array<{ id: string; orderNumber: string }> }) {
  const [state, formAction, pending] = useActionState(startConversationAction, idleState);
  const { formProps } = usePreservedForm(state);
  const [open, setOpen] = useState(false);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  if (!open) {
    return <button type="button" className="btn-primary" onClick={() => setOpen(true)}>Start a conversation</button>;
  }

  return (
    <form {...formProps} action={formAction} className="card">
      <div className="card-header"><h2 className="card-title">New message</h2></div>
      <div className="card-body stack">
        <Feedback state={state} />
        <Field label="Subject" htmlFor="subject" required error={fields.subject}>
          <input id="subject" name="subject" className="input" required maxLength={200} />
        </Field>
        {orders.length > 0 ? (
          <Field label="Related order (optional)" htmlFor="orderId">
            <select id="orderId" name="orderId" className="select" defaultValue="">
              <option value="">Not about a specific order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.orderNumber}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Message" htmlFor="message" required error={fields.message}>
          <textarea id="message" name="message" className="textarea" required rows={5} maxLength={4000} />
        </Field>
      </div>
      <div className="card-footer">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

export function ConversationReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState(replyToConversationAction, idleState);

  return (
    <form action={formAction} className="card-footer flex-col items-stretch gap-2 bg-white">
      <input type="hidden" name="conversationId" value={conversationId} />
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <textarea name="body" className="textarea" rows={3} required maxLength={4000} placeholder="Write a reply…" />
      <button type="submit" className="btn-primary self-end" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}

export function MarkAllReadButton() {
  const [state, formAction, pending] = useActionState(markNotificationsReadAction, idleState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button type="submit" className="btn-secondary btn-sm" disabled={pending}>
        {pending ? "Marking…" : "Mark all as read"}
      </button>
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
    </form>
  );
}
