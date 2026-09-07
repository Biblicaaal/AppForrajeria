import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

function cleanReference(value: unknown) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!accessToken || !supabaseUrl || !serviceKey) return json({ error: "Faltan variables seguras del backend" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "qr" ? "qr" : "point";
  const amount = Number(body.amount || 0);
  const externalReference = cleanReference(body.externalReference);
  if (!externalReference || !Number.isFinite(amount) || amount <= 0) return json({ error: "Referencia o importe invalido" }, { status: 400 });
  if (mode === "point" && !body.terminalId) return json({ error: "Falta configurar el Terminal ID del Point Smart" }, { status: 400 });
  if (mode === "qr" && !body.externalPosId) return json({ error: "Falta configurar el External POS ID del QR" }, { status: 400 });

  const amountText = amount.toFixed(2);
  const items = Array.isArray(body.items) ? body.items.slice(0, 100).map((item: any) => ({
    title: String(item.title || "Producto").slice(0, 120),
    unit_price: Number(item.unit_price || 0).toFixed(2),
    quantity: Number(item.quantity || 1),
    unit_measure: "unit",
  })) : [];
  const orderBody: Record<string, unknown> = {
    type: mode,
    external_reference: externalReference,
    expiration_time: "PT15M",
    description: "Venta La Vieja Esquina",
    transactions: { payments: [{ amount: amountText }] },
  };
  if (mode === "point") {
    orderBody.config = {
      point: {
        terminal_id: String(body.terminalId),
        print_on_terminal: "no_ticket",
        ticket_number: externalReference.slice(-8).toUpperCase(),
      },
      payment_method: { default_type: body.paymentMethod === "Debito" ? "debit_card" : "credit_card" },
    };
  } else {
    orderBody.total_amount = amountText;
    orderBody.config = { qr: { external_pos_id: String(body.externalPosId), mode: "hybrid" } };
    if (items.length) orderBody.items = items;
  }

  const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(orderBody),
  });
  const order = await mpResponse.json().catch(() => ({}));
  if (!mpResponse.ok) {
    const message = order?.message || order?.error || "Mercado Pago rechazo la orden";
    return json({ error: message, detail: order }, { status: mpResponse.status });
  }

  const payment = order?.transactions?.payments?.[0] || {};
  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from("mp_sales").upsert({
    external_reference: externalReference,
    amount,
    status: String(order.status || payment.status || "created"),
    order_id: String(order.id || ""),
    payment_id: String(payment.id || ""),
    payment_method_type: mode === "qr" ? "qr" : (body.paymentMethod === "Debito" ? "debit_card" : "credit_card"),
    items,
    business_date: body.businessDate || null,
    shift_type: body.shiftType || null,
    raw_order: order,
    updated_at: new Date().toISOString(),
  }, { onConflict: "external_reference" });
  if (error) return json({ error: error.message }, { status: 500 });

  return json({
    orderId: order.id || "",
    paymentId: payment.id || "",
    status: order.status || payment.status || "created",
    qrData: order?.config?.qr?.qr_data || order?.qr_data || "",
  }, { status: 201 });
});
