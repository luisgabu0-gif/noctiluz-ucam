-- Tarea 2: cola de envíos de la tienda a n8n. Ejecutar una sola vez en phpMyAdmin,
-- ANTES de poner integracion.activo = true en app/config.php.
CREATE TABLE IF NOT EXISTS integracion_salida (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  evento_uuid       CHAR(36)     NOT NULL UNIQUE,
  tipo              VARCHAR(40)  NOT NULL,
  cuerpo            MEDIUMTEXT   NOT NULL,             -- JSON que se envía
  estado            VARCHAR(12)  NOT NULL DEFAULT 'pendiente',  -- pendiente | enviado | fallido
  intentos          INT          NOT NULL DEFAULT 0,
  siguiente_intento DATETIME     NOT NULL,
  ultimo_codigo     INT          NULL,
  ultimo_error      VARCHAR(300) NULL,
  creado_en         DATETIME     NOT NULL,
  enviado_en        DATETIME     NULL,
  INDEX idx_is_pendientes (estado, siguiente_intento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
