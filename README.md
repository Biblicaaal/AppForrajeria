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

## Conteos de stock

La pestana `CONTEOS` esta disponible para empleados, administradores y developer. El sistema prepara una cantidad diaria de misiones segun los productos que todavia no fueron revisados en el ciclo mensual, priorizando los que nunca se contaron o llevan mas tiempo sin control. Completar una mision diaria suma automaticamente al conteo mensual; cuando el inventario esta al dia, la carga diaria baja hasta llegar a cero.

El empleado ve la cantidad y el precio que deberian estar en la tienda, cuenta el stock fisico y verifica el precio exhibido. El envio siempre se confirma de la misma manera. Las diferencias se guardan en privado para administracion y no cambian el stock hasta que un admin vuelve a revisar el producto.

Al confirmar una correccion, el sistema actualiza stock y precio, registra el movimiento y, cuando existe costo conocido, agrega el faltante como gasto `Perdida` en Balance. Si el costo es parcial o desconocido, solo registra la parte demostrable y conserva una advertencia para revision; nunca inventa costos. La pantalla administrativa tambien muestra misiones vencidas y cumplimiento por empleado.

## Clima y ventas

Despues de autorizar una vez la ubicacion de la PC, la aplicacion consulta el clima aproximadamente cada hora mientras esta abierta. Guarda las observaciones alcanzadas entre las 06:00 y las 22:00, clasifica cada hora y conserva por separado las horas con lluvia y tormenta.

El estado general del dia se decide por la condicion horaria dominante, con umbrales para lluvia y tormenta. Por ejemplo, 14 horas soleadas de 17 producen un dia `Soleado`, aunque las horas lluviosas minoritarias siguen marcadas. La clasificacion termica (`Muy frio`, `Frio`, `Normal`, `Caluroso`, `Muy caluroso`) usa en conjunto el promedio y la mediana de las temperaturas horarias para no depender de un unico pico.

## Proveedores, pedidos y costos

Los usuarios admin/dev tienen una pestana `PROVEEDORES` para crear viajantes, guardar pedidos en borrador y confirmar mercaderia ya recibida. Un borrador no modifica Stock. `Confirmar ingreso` registra en una sola operacion el aumento de stock, el movimiento de inventario, el historial de compra, el costo real y las revisiones de precio pendientes.

El costo anterior desconocido se conserva como desconocido. El sistema separa:

- ultimo costo o costo de reposicion, usado para sugerir precios futuros;
- costo promedio ponderado del stock con costo real conocido;
- cantidad de stock con costo conocido y desconocido.

Los precios sugeridos nunca cambian Caja automaticamente. Se aprueban, editan o descartan desde `STOCK > Revision de precios`. Las anulaciones y correcciones de pedidos confirmados generan reversas y mantienen el original para auditoria.

Las fotos de facturas se comprimen y se guardan fuera de la base, en `_data/invoices`, vinculadas permanentemente al pedido. Conviene copiar siempre la carpeta completa de la app para conservar datos y adjuntos.

## Mercado Libre

Los usuarios `admin` y `dev` tienen un modulo separado para investigar y preparar publicaciones. Los empleados no ven la pestana. El modulo agrega sus propios almacenes de IndexedDB (`mlCandidates`, `mlResearch`, `mlListings` y `mlSyncEvents`) y no reemplaza ni modifica productos, stock, ventas, cierres, proveedores o usuarios del POS.

Flujo disponible:

`DISCOVERED -> RESEARCHING -> NEEDS_REVIEW -> APPROVED -> PREPARING -> READY -> PUBLISHED`

Tambien se conservan los estados `REJECTED`, `PAUSED` y `ERROR`. Solo el boton final habilitado al escribir `PUBLICAR` crea un item remoto. Los precios del POS y de Mercado Libre nunca se actualizan automaticamente.

El inventario online se calcula por separado:

`ml_available_stock = min(physical_stock, ml_max_stock) - ml_reserved_stock`

El limite inicial de Mercado Libre siempre es cero. Los productos vendidos por kg/litro se marcan como fraccionados y no pueden publicarse como paquete cerrado hasta que el administrador verifique fisicamente una presentacion vendible. Un costo cero, parcial o no demostrado se muestra como `COSTO DESCONOCIDO`; en ese caso no se calcula un margen confiable.

### Configurar OAuth

1. Crear una aplicacion en Mercado Libre Developers para el sitio Argentina (`MLA`).
2. Registrar exactamente la Redirect URI mostrada por el POS: `http://127.0.0.1:4174/api/ml/oauth/callback`. Si la configuracion de la aplicacion exige HTTPS, ingresar en ambos lados la URL HTTPS propia que redirija a este callback.
3. En `Mercado Libre > Configurar cuenta`, cargar App ID, Secret Key y la misma Redirect URI.
4. Guardar y pulsar `Conectar cuenta` para completar el flujo Authorization Code oficial.

La Secret Key, access token, refresh token y la API key opcional del asistente se cifran con Windows DPAPI para el usuario que ejecuta la caja y se guardan en `_data/mercado-libre/secure.dat`. Nunca se incluyen en IndexedDB, los snapshots, el repositorio o los formularios despues de guardarlos. El refresh token rotado reemplaza al anterior de forma automatica.

El servicio consulta en vivo el predictor de categorias, los atributos de `/categories/{id}/attributes`, la ficha tecnica, los atributos condicionales y `/sites/MLA/listing_prices`. En Argentina el calculo de cargos requiere que el administrador cargue el peso facturable real; el sistema no inventa pesos ni dimensiones.

Las fotos se cargan desde archivos propios o autorizados, se guardan en `_data/mercado-libre/images` y se suben por la API oficial al publicar. Los resultados de competidores se usan solo como informacion estadistica: sus fotos nunca se copian.

### Asistente IA opcional

La configuracion admite una Gemini API key cifrada localmente y usa por defecto el modelo estable `gemini-2.5-flash`. El asistente recibe solo el producto abierto y el resumen de investigacion de Mercado Libre. Puede proponer titulo, descripcion, formato individual/multipack, cantidad, precio e ideas de kits, pero sus resultados vuelven siempre a `NEEDS_REVIEW` y no pueden ejecutar `PUBLICAR`.

Si no se configura una API key, la investigacion oficial, el borrador local, el flujo de revision, los atributos dinamicos, las fotos y la publicacion manual siguen funcionando.

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
