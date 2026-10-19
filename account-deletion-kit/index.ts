// Supabase Edge Function: permanently delete a user from Supabase and Brevo.
//
// Deploy with JWT verification on (the default) so unauthenticated callers are
// rejected at the gateway before this code runs.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CONFIG, type SupabaseLike } from "./config.ts";
import { deleteBrevoContact, sendFarewellEmail, type StepResult } from "./brevo.ts";
import {
  consumeDeletionRequest,
  deleteAuthUser,
  purgeStorage,
  purgeTables,
  writeAuditRow,
} from "./purge.ts";

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = CONFIG.allowedOrigins.includes("*")
    ? (origin ?? "*")
    : CONFIG.allowedOrigins.includes(origin ?? "")
    ? origin!
    : CONFIG.allowedOrigins[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders(origin), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405, origin);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Function is misconfigured" }, 500, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseLike;

  // Identify the caller from their own JWT.
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing bearer token" }, 401, origin);

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt);
  const caller = callerData?.user;
  if (callerError || !caller) {
    return json({ error: "Invalid or expired token" }, 401, origin);
  }

  let body: { userId?: string; confirm?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400, origin);
  }

  // Guard against a mis-wired client wiping an account by accident.
  if (body.confirm !== "DELETE") {
    return json({ error: 'Set "confirm":"DELETE" to proceed' }, 400, origin);
  }

  // The target comes from the verified JWT, never from the body. Under
  // selfServiceOnly a `userId` is refused rather than ignored, so a client
  // trying to delete someone else gets a hard error instead of silently
  // deleting itself.
  if (CONFIG.selfServiceOnly) {
    if (body.userId && body.userId !== caller.id) {
      return json({ error: "This endpoint only deletes your own account" }, 403, origin);
    }
  } else if (body.userId && body.userId !== caller.id) {
    if (!await CONFIG.isAdmin(caller.id, admin)) {
      return json({ error: "You may only delete your own account" }, 403, origin);
    }
  }

  const targetId = CONFIG.selfServiceOnly ? caller.id : (body.userId ?? caller.id);

  // Read the email before anything is destroyed; Brevo is keyed on it.
  const { data: targetData, error: targetError } = await admin.auth.admin
    .getUserById(targetId);
  const target = targetData?.user;
  if (targetError || !target) {
    return json({ error: "User not found" }, 404, origin);
  }

  const email: string = target.email ?? "";
  const name: string = target.user_metadata?.full_name ??
    target.user_metadata?.name ?? "";

  const steps: StepResult[] = [];

  // Brevo runs first so `requireBrevoSuccess` can abort while the account is
  // still fully intact.
  if (email) {
    steps.push(await sendFarewellEmail(email, name));
    steps.push(await deleteBrevoContact(email));

    if (CONFIG.requireBrevoSuccess && steps.some((s) => !s.ok)) {
      return json(
        { ok: false, userId: targetId, aborted: "brevo", steps },
        502,
        origin,
      );
    }
  } else {
    steps.push({ step: "brevo", ok: true, skipped: true, detail: "no email on user" });
  }

  const reason = body.reason ?? await consumeDeletionRequest(admin, email);

  steps.push(
    await writeAuditRow(admin, {
      user_id: targetId,
      email,
      requested_by: caller.id,
      reason,
    }),
  );

  steps.push(...await purgeStorage(admin, targetId));
  steps.push(...await purgeTables(admin, targetId));

  // Last on purpose: if an earlier step fails the account still exists, so the
  // whole request can simply be retried. Deleting auth first would strand the
  // leftover data with no identity to key a retry on.
  steps.push(await deleteAuthUser(admin, targetId));

  const ok = steps.every((s) => s.ok);
  return json({ ok, userId: targetId, email, steps }, ok ? 200 : 207, origin);
});
