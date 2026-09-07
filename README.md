# La Vieja Esquina

Caja Local Web para forrajeria, reconstruida como app estatica local-first.

## Uso

Abrir `LaViejaEsquina.exe`. No abrir `index.html` ni usar la direccion de preview para ventas reales: el ejecutable mantiene siempre el mismo perfil de datos, inicia la copia de seguridad local y abre la caja sin consola.

Cada operacion se guarda primero en IndexedDB y tambien se copia automaticamente a `_data/app-data.json`. El archivo anterior queda en `_data/app-data.previous.json`; las copias creadas antes de una limpieza quedan en `_data/archives`. La aplicacion restaura esa copia si el perfil del navegador aparece vacio.

La actualizacion de la base es incremental: conserva usuarios, ventas, cierres, stock e historial existentes y agrega los nuevos almacenes sin reiniciar datos.

## Stock y Excel

En `STOCK`, los usuarios admin/dev tienen dos acciones:

- `Importar .xlsx`: por defecto reemplaza solamente `En la planilla`. Tambien permite actualizar de forma explicita `En la tienda`, sin borrar los productos que no aparezcan en el archivo.
- `Exportar .xlsx`: descarga un libro con `Resumen`, `En tienda` y `En la planilla`, listo para volver a importar.

La importacion reconoce la hoja `Inventario` y las columnas de la planilla oficial (`ID`, `Categoria`, `Marca`, `Producto`, `Variante`, `Stock`, `Stock Min`, `Unidad`, `Precio`, `Codigo`, `Ubicacion`, `Activo`, `Notas`, `Ult. Modificacion`).

## Proveedores, pedidos y costos

Los usuarios admin/dev tienen una pestana `PROVEEDORES` para crear viajantes, guardar pedidos en borrador y confirmar mercaderia ya recibida. Un borrador no modifica Stock. `Confirmar ingreso` registra en una sola operacion el aumento de stock, el movimiento de inventario, el historial de compra, el costo real y las revisiones de precio pendientes.

El costo anterior desconocido se conserva como desconocido. El sistema separa:

- ultimo costo o costo de reposicion, usado para sugerir precios futuros;
- costo promedio ponderado del stock con costo real conocido;
- cantidad de stock con costo conocido y desconocido.

Los precios sugeridos nunca cambian Caja automaticamente. Se aprueban, editan o descartan desde `STOCK > Revision de precios`. Las anulaciones y correcciones de pedidos confirmados generan reversas y mantienen el original para auditoria.

Las fotos de facturas se comprimen y se guardan fuera de la base, en `_data/invoices`, vinculadas permanentemente al pedido. Conviene copiar siempre la carpeta completa de la app para conservar datos y adjuntos.

La caja sigue abriendose con `file://` para conservar el mismo origen de IndexedDB y no perder acceso a los datos existentes.

## Uso portable en laptop

La forma mas liviana de usar la app en una PC vieja es copiar la carpeta completa a la laptop y abrir:

`LaViejaEsquina.exe`

Ese launcher abre `Abrir-AppCajaPana.bat` sin mostrar consola, busca Chrome, Edge o un navegador portable en `Browser\chrome.exe`, y usa un perfil local en `_perfil_caja` para que los datos de la caja queden separados del navegador personal.

Antes de abrir la app, el launcher revisa `update.json` en GitHub. Si encuentra una version mas nueva, descarga el ZIP, crea un backup en `_backups`, reemplaza los archivos de la app y despues abre la caja. Si no hay internet o GitHub falla, abre la version local igual.

Para dejar un icono en el escritorio:

`Crear-Acceso-Directo.bat`

Si la laptop solo tiene Internet Explorer, instalar un navegador compatible primero. Internet Explorer no es recomendado para IndexedDB ni para esta app.

Usuarios iniciales sin contrasena:

- `admin`
- `turno_manana`
- `turno_tarde`

El usuario `dev` tiene la clave tecnica configurada por el propietario.

## Incluye

- Caja rapida con bloqueo anti doble venta.
- Enter respeta el medio de pago seleccionado.
- Atajos `E` para efectivo y `Q` para QR.
- Cierres, metricas, movimientos, actividad, usuarios y herramientas dev.
- Stock, Proveedores, Balance y Metricas con costos y cobertura de datos.
- Modo opcional de canasta de productos.
- Checker de updates en Dev: revisa `update.json` en GitHub al iniciar y ofrece descargar el ZIP del repo.

## Updates

La app portable instala updates automaticamente cuando se abre con `LaViejaEsquina.exe` o `Abrir-AppCajaPana.bat`.

Para forzar una instalacion manual en una terminal, cerrar la app y ejecutar:

`Update-AppCajaPana.bat`

Ese script descarga la ultima version desde GitHub, crea un backup en `_backups`, e instala los archivos nuevos en la carpeta del programa.

Tambien se puede probar sin tocar archivos con:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\update-app.ps1 -WhatIf`

Para publicar una version nueva:

1. Actualizar `APP_VERSION` en `app.js`.
2. Actualizar `version` y `notes` en `update.json`.
3. Subir los cambios a GitHub.

## Modo laptop vieja

En equipos muy lentos, entrar como `dev`, abrir `Dev > Apariencia y espacio`, y cambiar `Rendimiento` a `Windows 98 / rapido`.

Ese modo usa una interfaz estilo Windows 98, elimina animaciones, sombras, blur y fondos animados, mantiene graficos simples, y baja la frecuencia de revisiones en segundo plano.

Para hacer una prueba sintetica de carga similar a varios meses de uso:

`node .\tools\stress-test-low-end.js`

El test genera datos temporales en memoria y mide consultas pesadas de balance, movimientos y produccion. No modifica la base local de la app.

## Mercado Pago automatico

La app incluye una integracion opcional con Supabase Edge Functions para crear pagos de Mercado Pago y sincronizar el estado automaticamente.

1. Crear un proyecto gratuito en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL editor.
3. Deployar las funciones en `supabase/functions`.
4. Configurar secrets de Supabase:
   - `MERCADO_PAGO_ACCESS_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MP_WEBHOOK_URL` opcional, normalmente `https://TU-PROYECTO.supabase.co/functions/v1/mp-webhook`
5. En la app, entrar como `admin` o `dev`, ir a `Dev`, y guardar:
   - Supabase project URL
   - Supabase anon key

No guardar el Access Token de Mercado Pago en el navegador.
