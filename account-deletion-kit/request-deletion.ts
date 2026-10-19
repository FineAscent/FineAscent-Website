// Supabase Edge Function: the public "request account deletion" endpoint.
//
// This function NEVER deletes anything. It only emails a one-time confirmation
// link to the address supplied. Deletion happens in delete-account, and only
// for whoever proves they can read that inbox.
//
// Deploy with verify_jwt = false, since the caller is signed out by definition.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CONFIG, type SupabaseLike } from "./config.ts";
import { sendConfirmationEmail } from "./brevo.ts";

/**
 * The response never varies with whether the address has an account. Saying
 * "no such user" would turn this endpoint into a free membership oracle.
 */
const GENERIC_OK = {
  ok: true,
  message:
    "If an account exists for that address, we've emailed a confirmation link. " +
    "The account is only deleted once you click it.",
};

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = CONFIG.allowedOrigins.includes("*")
    ? (origin ?? "*")
    : CONFIG.allowedOrigins.includes(origin ?? "")
    ? origin!
    : "";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "content-type": "application/json" },
  });
}

/** Store a coarse fingerprint for rate limiting rather than the raw address. */
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("IP_HASH_SALT") ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cloudflare Turnstile. Skipped entirely when TURNSTILE_SECRET is unset. */
async function captchaOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}

async function underRateLimit(
  admin: SupabaseLike,
  email: string,
  ipHash: string,
): Promise<boolean> {
  if (!CONFIG.deletionRequestsTable) return true;

  const since = new Date(Date.now() - 3_600_000).toISOString();

  const byEmail = await admin
    .from(CONFIG.deletionRequestsTable)
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("requested_at", since);
  if ((byEmail.count ?? 0) >= CONFIG.rateLimit.perEmail) return false;

  const byIp = await admin
    .from(CONFIG.deletionRequestsTable)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("requested_at", since);
  if ((byIp.count ?? 0) >= CONFIG.rateLimit.perIp) return false;

  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Function is misconfigured" }, 500, origin);
  }

  let body: { email?: string; reason?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400, origin);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const reason = String(body.reason ?? "").trim().slice(0, 2000) || null;

  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Enter a valid email address" }, 400, origin);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!await captchaOk(body.captchaToken, ip)) {
    return json({ error: "Captcha verification failed" }, 403, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseLike;

  const ipHash = await hashIp(ip);
  if (!await underRateLimit(admin, email, ipHash)) {
    // Deliberately generic: a distinct "rate limited" reply would still confirm
    // the address is being processed.
    return json(GENERIC_OK, 200, origin);
  }

  // Recorded before the account is looked up, so attempts against addresses
  // that have no account still count towards the limit. Otherwise enumeration
  // probing would be unmetered. Rows for unknown addresses are inert: the
  // deleter only ever matches them against a real user's email.
  if (CONFIG.deletionRequestsTable) {
    await admin.from(CONFIG.deletionRequestsTable).insert({
      email,
      reason,
      ip_hash: ipHash,
    });
  }

  // generateLink fails for an address with no account. That is the existence
  // check, and swallowing the error is what keeps the response uniform.
  let actionLink: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (!error && data?.properties?.hashed_token) {
      const url = new URL(CONFIG.confirmUrl);
      url.searchParams.set("token_hash", data.properties.hashed_token);
      actionLink = url.toString();
    }
  } catch {
    actionLink = null;
  }

  if (actionLink) await sendConfirmationEmail(email, actionLink);
  return json(GENERIC_OK, 200, origin);
});
