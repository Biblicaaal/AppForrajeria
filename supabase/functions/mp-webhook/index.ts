import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

function normalizeStatus(status: string, detail = "") {
  const value = `${status || ""} ${detail || ""}`.toLowerCase();
  if (value.includes("processed") || value.includes("approved") || value.includes("accredited") || value.includes("paid")) return "approved";
  if (value.includes("rejected") || value.includes("cancel") || value.includes("refund") || value.includes("failed") || value.includes("expired") || value.includes("charged_back")) return "rejected";
  return "pending";
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function validSignature(req: Request, dataId: string) {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) return true;
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=").map((value) => value.trim())));
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, parts.v1);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!accessToken || !supabaseUrl || !serviceKey) return json({ error: "Missing backend environment variables" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  const dataId = String(url.searchParams.get("data.id") || body?.data?.id || body?.id || "");
  if (!dataId) return json({ ok: true });
  if (!(await validSignature(req, dataId))) return json({ error: "Invalid webhook signature" }, { status: 401 });

  const isOrder = body?.type === "order" || String(body?.action || "").startsWith("order.") || dataId.startsWith("ORD");
  const resourceUrl = isOrder
    ? `https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`
    : `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`;
  const resourceResponse = await fetch(resourceUrl, { headers: { "Authorization": `Bearer ${accessToken}` } });
  const resource = await resourceResponse.json().catch(() => ({}));
  if (!resourceResponse.ok) return json({ error: "Could not fetch Mercado Pago resource", detail: resource }, { status: 502 });

  const payment = isOrder ? (resource?.transactions?.payments?.[0] || {}) : resource;
  const externalReference = resource.external_reference || body?.data?.external_reference;
  if (!externalReference) return json({ ok: true });
  const status = normalizeStatus(resource.status || payment.status, resource.status_detail || payment.status_detail);
  const supabase = createClient(supabaseUrl, serviceKey);
  const row: Record<string, unknown> = {
    external_reference: externalReference,
    amount: Number(resource.total_paid_amount || resource.total_amount || payment.paid_amount || payment.transaction_amount || payment.amount || 0),
    status,
    payment_id: String(payment.id || ""),
    payment_method_type: payment?.payment_method?.type || payment?.payment_type_id || null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (isOrder) {
    row.order_id = String(resource.id || dataId);
    row.raw_order = resource;
  } else {
    row.raw_payment = resource;
  }
  const { error } = await supabase.from("mp_sales").upsert(row, { onConflict: "external_reference" });
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ ok: true });
});
