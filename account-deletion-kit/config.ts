// The only file you should need to edit per project.
import { renderConfirmationEmail, renderFarewellEmail } from "./email-template.mjs";

export interface PurgeTable {
  /** Table name inside `schema`. */
  table: string;
  /** Column holding the owning user's uuid. */
  column: string;
  /** Defaults to "public". */
  schema?: string;
}

export interface PurgeBucket {
  bucket: string;
  /** Folder holding this user's objects, e.g. `${userId}/`. */
  prefix: (userId: string) => string;
}

export const CONFIG = {
  /**
   * Rows to delete, in dependency order: children first, parents last.
   *
   * Tables with `on delete cascade` from auth.users can be omitted, since
   * deleting the auth user removes them. List a table here when the foreign key
   * has no cascade, when it points somewhere other than auth.users, or when you
   * want the deletion to be explicit and show up in the result report.
   */
  tables: [
    // { table: "order_items", column: "user_id" },
    // { table: "orders",      column: "user_id" },
    // { table: "profiles",    column: "id" },
  ] as PurgeTable[],

  /** Storage objects to remove. */
  buckets: [
    // { bucket: "avatars", prefix: (userId: string) => `${userId}/` },
  ] as PurgeBucket[],

  brevo: {
    /** Remove the contact from Brevo entirely. */
    deleteContact: true,
    /** Send a final notice before removing the contact. */
    sendFarewell: true,
    // Set the email to a sender address verified in your Brevo account.
    sender: { name: "NobleCart", email: "no-reply@yourdomain.com" },

    /** Sent by the public form. Clicking the link is what authorizes deletion. */
    confirmSubject: "Confirm deleting your account",
    confirmHtml: (link: string) => renderConfirmationEmail(link).html,
    confirmText: (link: string) => renderConfirmationEmail(link).text,

    subject: "Your account has been deleted",
    html: (name: string) => renderFarewellEmail(name).html,
    text: (name: string) => renderFarewellEmail(name).text,
  },

  /**
   * false: a Brevo failure is reported but the account is still deleted.
   * true:  a Brevo failure aborts before anything in Supabase is touched.
   */
  requireBrevoSuccess: false,

  /**
   * Soft delete keeps the auth.users row flagged as deleted so the hashed user
   * id stays resolvable. It is not reversible and it is not full erasure, so
   * leave it false when the goal is a GDPR-style hard delete.
   */
  softDeleteAuthUser: false,

  /**
   * Table for the deletion record, or null to skip. Written before the purge,
   * because afterwards there is no user left to attribute it to.
   * See sql/audit_table.sql.
   */
  auditTable: "account_deletions" as string | null,

  /**
   * Hard lock: the target is always taken from the caller's own JWT and a
   * `userId` in the request body is refused outright. Nobody, including staff
   * and anybody holding the service role key, can delete someone else through
   * this endpoint. Keep it true for a public "delete my account" page.
   */
  selfServiceOnly: true,

  /**
   * Only consulted when selfServiceOnly is false. Default: nobody.
   * Example: look the caller up in your own admins table.
   */
  isAdmin: async (_callerId: string, _admin: SupabaseLike): Promise<boolean> => false,

  /**
   * Pending requests from the public form, or null if you are not using it.
   * Supplies the deletion reason and the per-email rate limit.
   * See sql/deletion_requests.sql.
   */
  deletionRequestsTable: "account_deletion_requests" as string | null,

  /** Page the emailed confirmation link points at. Must be HTTPS in production. */
  confirmUrl: "https://yourdomain.com/delete-account/confirm",

  /** Requests allowed per hour, to keep the public form from being abused. */
  rateLimit: { perEmail: 3, perIp: 10 },

  /**
   * Origins allowed to call this from a browser. Set your real domains before
   * going live: ["*"] is fine for local work and wrong for production.
   */
  allowedOrigins: ["*"] as string[],
};

/** Structural type, so this file needs no import from supabase-js. */
export interface SupabaseLike {
  from: (table: string) => any;
  schema: (name: string) => any;
  storage: any;
  auth: any;
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
