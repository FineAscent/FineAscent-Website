// Brevo REST API calls. Deliberately uses HTTPS rather than SMTP: Supabase Edge
// Functions block outbound SMTP ports, so an SMTP client would fail at runtime.

import { CONFIG } from "./config.ts";

const BREVO_BASE = "https://api.brevo.com/v3";

export interface StepResult {
  step: string;
  ok: boolean;
  skipped?: boolean;
  detail?: string;
}

function apiKey(): string {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("BREVO_API_KEY is not set");
  return key;
}

/**
 * Brevo rate limits aggressively and occasionally 5xxs. Retrying matters here
 * because the caller may already have deleted rows by the time we run.
 */
async function brevoFetch(
  path: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${BREVO_BASE}${path}`, {
        ...init,
        headers: {
          "api-key": apiKey(),
          "content-type": "application/json",
          accept: "application/json",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Brevo ${res.status}: ${await safeBody(res)}`);
        if (attempt < attempts) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        return res;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<unreadable body>";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One-time confirmation link for the public deletion form. Failure is returned
 * rather than thrown so the caller can still answer with its generic response.
 */
export async function sendConfirmationEmail(
  email: string,
  link: string,
): Promise<StepResult> {
  try {
    const res = await brevoFetch("/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: CONFIG.brevo.sender,
        to: [{ email }],
        subject: CONFIG.brevo.confirmSubject,
        htmlContent: CONFIG.brevo.confirmHtml(link),
        textContent: CONFIG.brevo.confirmText(link),
      }),
    });

    if (!res.ok) {
      return {
        step: "brevo.confirmation_email",
        ok: false,
        detail: `HTTP ${res.status}: ${await safeBody(res)}`,
      };
    }
    return { step: "brevo.confirmation_email", ok: true };
  } catch (err) {
    return {
      step: "brevo.confirmation_email",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Final transactional email, sent while the contact still exists. */
export async function sendFarewellEmail(
  email: string,
  name: string,
): Promise<StepResult> {
  if (!CONFIG.brevo.sendFarewell) {
    return { step: "brevo.farewell_email", ok: true, skipped: true };
  }

  try {
    const res = await brevoFetch("/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: CONFIG.brevo.sender,
        to: [{ email, name: name || email }],
        subject: CONFIG.brevo.subject,
        htmlContent: CONFIG.brevo.html(name),
        textContent: CONFIG.brevo.text(name),
      }),
    });

    if (!res.ok) {
      return {
        step: "brevo.farewell_email",
        ok: false,
        detail: `HTTP ${res.status}: ${await safeBody(res)}`,
      };
    }
    return { step: "brevo.farewell_email", ok: true };
  } catch (err) {
    return {
      step: "brevo.farewell_email",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Erase the contact. A 404 counts as success so the whole function stays safe
 * to re-run after a partial failure.
 */
export async function deleteBrevoContact(email: string): Promise<StepResult> {
  if (!CONFIG.brevo.deleteContact) {
    return { step: "brevo.delete_contact", ok: true, skipped: true };
  }

  try {
    const res = await brevoFetch(
      `/contacts/${encodeURIComponent(email)}?identifierType=email_id`,
      { method: "DELETE" },
    );

    if (res.status === 204 || res.status === 404) {
      return {
        step: "brevo.delete_contact",
        ok: true,
        detail: res.status === 404 ? "contact not in Brevo" : undefined,
      };
    }
    return {
      step: "brevo.delete_contact",
      ok: false,
      detail: `HTTP ${res.status}: ${await safeBody(res)}`,
    };
  } catch (err) {
    return {
      step: "brevo.delete_contact",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
