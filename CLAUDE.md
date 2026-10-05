# CLAUDE.md

Contexto para Claude Code al trabajar en este repositorio.

## El proyecto

NOCTILUZ es la Tarea 1 de *Soluciones Informáticas para la Empresa* (Grado en Ingeniería Informática, UCAM): una tienda online de moda luminosa (prendas con LED y fibra óptica) con compra completa, back-office y **registro de eventos de negocio**. Es un prototipo académico: no se cobra ni se envía nada y todos los datos son de prueba.

- **Equipo:** Luis Galindo Buendia, Roberto Ciller Miñana, Javier Zamora Lopez y JunJie Yang Jao. El reparto está en `COLABORAR.md`.
- **Entrega:** 7 de octubre de 2026. Se entregan la memoria en PDF (máx. 6 páginas de cuerpo más anexo), la URL pública, este repositorio y las diapositivas para una defensa de 7 minutos.
- **Todo en español:** código, comentarios, commits, textos de la web y documentación.
- La Tarea 2 consumirá los eventos de esta tienda desde otro sistema (`GET api/admin/eventos.php?desde_id=N`), así que no hay que cambiar el formato de los eventos sin motivo.

## Quién te habla

Quien usa Claude aquí es un estudiante que **tiene que defender en persona lo que sube**. Por eso:

- Explica cada cambio en lenguaje sencillo, para que pueda contarlo en la defensa.
- Prefiere cambios pequeños y comprensibles a reescrituras grandes.
- Los commits se hacen con la identidad Git de quien está trabajando (su `user.name`/`user.email`). Nunca reescribas el historial ni cambies la autoría de commits existentes.
- El uso de IA se declara en el anexo de la memoria: recuérdalo si se genera contenido para la entrega.

## Documentación

- `README.md`: qué hace la tienda, arquitectura, ejecución en local, despliegue, datos de prueba, reglas de negocio, eventos y API. **Léelo antes de cambiar nada.**
- `COLABORAR.md`: cómo trabaja el grupo con Git y el reparto de tareas.
- `docs/`: memoria (`.docx`), diapositivas (`.pptx`), diagrama entidad-relación (`modelo_er.png`) y esquema relacional (`modelo_datos.png`).

## Ejecutar en local

```bash
php database/instalar_local.php
php -S localhost:8000 -t public_html
```

`instalar_local.php` crea una base SQLite de pruebas y un `public_html/app/config.php` local, y al volver a ejecutarlo deja la base como recién instalada. No hay dependencias que instalar.

Pruebas automáticas de las reglas de negocio (totales, IVA, envío, cupones y stock), sobre una base SQLite en memoria:

```bash
php tests/pruebas_reglas_negocio.php
```

Ejecútalas después de cualquier cambio en `ReglasNegocio.php`, `Pedidos.php` o los datos de prueba; si cambia una regla a propósito, actualiza también la prueba correspondiente.

## Arquitectura

PHP 8 sin framework, MySQL en el hosting (SQLite en local) y HTML, CSS y JavaScript nativos (módulos ES) sin librerías.

- `public_html/index.html` y `admin.html`: interfaces de la tienda y del back-office. JS en `assets/js/`.
- `public_html/api/*.php`: endpoints JSON (uno por recurso), todos cargan `api/_inicio.php`. Los de `api/admin/` exigen sesión del back-office.
- `public_html/app/*.php`: lógica de negocio (`ReglasNegocio`, `Pedidos`, `Pagos`, `Eventos`…) y acceso a datos (`Db.php`, PDO). La carpeta está bloqueada por `.htaccess`.
- `database/`: esquemas MySQL y SQLite (deben mantenerse equivalentes) y datos de prueba.

Principios que no hay que romper:

- **Precios, descuentos, IVA, envío y stock se calculan siempre en el servidor.** El navegador solo envía qué quiere comprar.
- **Cada cambio relevante (pedido, pago, cambio de estado) se guarda en una transacción junto con su evento.**
- Los estados del pedido solo cambian según `ReglasNegocio::TRANSICIONES`.
- Sin frameworks ni dependencias nuevas.

## Despliegue

La web está publicada de forma provisional en InfinityFree: **https://algo.free.je** (y `noctiluz.free.je` cuando termine de activarse). **Subir a GitHub no actualiza la web**: Luis copia los archivos de `public_html/` al hosting a mano. No intentes desplegar ni pidas credenciales del hosting.

## Normas

- **`public_html/app/config.php` nunca va al repositorio**: contiene las credenciales de la base de datos y está en `.gitignore`. No escribas contraseñas ni datos personales reales en ningún archivo del repo.
- **La memoria (`.docx`) y las diapositivas (`.pptx`) se editan por turnos**: Git no puede fusionarlas. Antes de modificarlas, haz `git pull` y confirma que nadie más las está editando.
- Antes de empezar a trabajar, `git pull`. Si cambias el esquema de la base de datos, cambia los dos esquemas (`esquema_mysql.sql` y `esquema_sqlite.sql`) y avisa de que hay que actualizar la base del hosting desde phpMyAdmin.
