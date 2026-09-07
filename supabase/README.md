# Mercado Pago Point Smart y QR

La caja usa la API de Orders de Mercado Pago a traves de Supabase Edge Functions. Los secretos nunca se guardan en el navegador.

## Configuracion

1. Ejecute `schema.sql` en el SQL Editor del proyecto Supabase.
2. Configure estos secretos en Supabase:
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `MERCADO_PAGO_WEBHOOK_SECRET`
3. Despliegue las funciones `_shared`, `create-mp-order`, `mp-status` y `mp-webhook`.
4. En Mercado Pago Developers, configure el evento **Order (Mercado Pago)** para enviar webhooks a:
   `https://SU-PROYECTO.supabase.co/functions/v1/mp-webhook`
5. En la pestaña Dev de la caja, guarde:
   - URL y anon key de Supabase.
   - Terminal ID del Point Smart para debito/credito.
   - External POS ID de la caja QR para pagos QR.

Si la integracion no esta configurada, QR y tarjetas siguen disponibles y quedan registradas como pagos manuales. Cuando esta configurada, la caja envia el importe exacto, conserva los IDs de orden/pago y sincroniza el resultado confirmado por webhook.

El QR usa modo hibrido: la orden llega al QR estatico de la caja y Mercado Pago tambien devuelve datos para un QR dinamico. La interfaz actual opera con el QR de la caja configurada.
