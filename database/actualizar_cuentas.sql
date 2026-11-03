-- NOCTILUZ · Cuentas de cliente y respuestas a incidencias, para una base MySQL YA instalada (hosting).
-- Se ejecuta una sola vez desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, eventos ni stock.
-- En una instalación nueva no hace falta: esquema_mysql.sql ya incluye estas columnas.
-- Antes hay que subir los archivos nuevos de public_html (app/Cuentas.php, api/cuenta.php...).

ALTER TABLE clientes
  ADD COLUMN clave_hash    VARCHAR(255) NULL,
  ADD COLUMN registrado_en DATETIME     NULL;

ALTER TABLE incidencias
  ADD COLUMN respuesta     TEXT     NULL,
  ADD COLUMN respondida_en DATETIME NULL;
