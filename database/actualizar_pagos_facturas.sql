-- NOCTILUZ · Pago con PayPal (sandbox) y facturas por correo, para una base MySQL YA instalada (hosting).
-- Se ejecuta una sola vez desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, pagos, eventos ni stock.
-- En una instalación nueva no hace falta: esquema_mysql.sql ya incluye estos cambios.
-- Antes hay que subir los archivos nuevos y modificados de public_html/ (ver README, apartado «Actualizar el hosting»)
-- y añadir los bloques 'tienda', 'paypal' y 'correo' a app/config.php (ver app/config.ejemplo.php).

-- Un pago con PayPal no tiene últimas cifras de tarjeta.
ALTER TABLE pagos MODIFY tarjeta_ultimos4 CHAR(4) NULL;

-- Una factura por pedido pagado, con numeración correlativa por año (F2026-000001) y estado del envío por correo.
CREATE TABLE IF NOT EXISTS facturas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id     INT          NOT NULL UNIQUE,
  numero        VARCHAR(20)  NOT NULL UNIQUE,
  emitida_en    DATETIME     NOT NULL,
  email_destino VARCHAR(120) NOT NULL,
  estado_envio  VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  enviada_en    DATETIME     NULL,
  error_envio   VARCHAR(200) NULL,
  CONSTRAINT fk_fac_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
