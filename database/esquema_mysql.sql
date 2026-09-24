-- NOCTILUZ · Esquema de base de datos (MySQL / MariaDB)
-- Prototipo académico UCAM — Soluciones Informáticas para la Empresa.
-- Importar en phpMyAdmin ANTES de datos_prueba.sql.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS eventos, incidencias, historial_estados, pagos, lineas_pedido, pedidos,
  clientes, variantes, producto_modos, productos, cupones, modos, colores, categorias, usuarios_admin;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Datos maestros ----------

CREATE TABLE categorias (
  id              VARCHAR(20)  PRIMARY KEY,
  nombre          VARCHAR(40)  NOT NULL,
  nombre_singular VARCHAR(40)  NOT NULL,
  orden           INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE colores (
  id     VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  hex    CHAR(7)     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modos (
  id          VARCHAR(20)  PRIMARY KEY,
  nombre      VARCHAR(40)  NOT NULL,
  descripcion VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE productos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(60)   NOT NULL UNIQUE,
  nombre       VARCHAR(80)   NOT NULL,
  categoria_id VARCHAR(20)   NOT NULL,
  descripcion  TEXT          NOT NULL,
  material     VARCHAR(160)  NOT NULL,
  autonomia_h  INT           NOT NULL,
  precio       DECIMAL(8,2)  NOT NULL,
  tiene_tallas TINYINT(1)    NOT NULL DEFAULT 0,
  valoracion   DECIMAL(2,1)  NOT NULL DEFAULT 0,
  num_resenas  INT           NOT NULL DEFAULT 0,
  activo       TINYINT(1)    NOT NULL DEFAULT 1,
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE producto_modos (
  producto_id INT         NOT NULL,
  modo_id     VARCHAR(20) NOT NULL,
  PRIMARY KEY (producto_id, modo_id),
  CONSTRAINT fk_pm_prod FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_pm_modo FOREIGN KEY (modo_id) REFERENCES modos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE variantes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sku         VARCHAR(80)  NOT NULL UNIQUE,
  producto_id INT          NOT NULL,
  color_id    VARCHAR(20)  NOT NULL,
  imagen      VARCHAR(160) NULL,
  stock       INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_var_prod  FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_var_color FOREIGN KEY (color_id) REFERENCES colores(id),
  CONSTRAINT ck_var_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cupones (
  codigo      VARCHAR(20)  PRIMARY KEY,
  descripcion VARCHAR(120) NOT NULL,
  tipo        VARCHAR(20)  NOT NULL,          -- porcentaje | importe | envio
  valor       DECIMAL(8,2) NOT NULL DEFAULT 0,
  minimo      DECIMAL(8,2) NOT NULL DEFAULT 0,
  activo      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuarios_admin (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(120) NOT NULL UNIQUE,
  nombre        VARCHAR(80)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Datos transaccionales ----------

CREATE TABLE clientes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  email     VARCHAR(120) NOT NULL UNIQUE,
  telefono  VARCHAR(20)  NULL,
  creado_en DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pedidos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  codigo         VARCHAR(20)   NOT NULL UNIQUE,
  cliente_id     INT           NOT NULL,
  sesion_id      VARCHAR(40)   NULL,
  estado         VARCHAR(20)   NOT NULL,
  metodo_envio   VARCHAR(20)   NOT NULL,
  cupon_codigo   VARCHAR(20)   NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  descuento      DECIMAL(10,2) NOT NULL DEFAULT 0,
  envio          DECIMAL(10,2) NOT NULL DEFAULT 0,
  base_imponible DECIMAL(10,2) NOT NULL,
  iva            DECIMAL(10,2) NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  dir_linea      VARCHAR(160)  NOT NULL,
  dir_cp         CHAR(5)       NOT NULL,
  dir_ciudad     VARCHAR(80)   NOT NULL,
  dir_provincia  VARCHAR(80)   NOT NULL,
  creado_en      DATETIME      NOT NULL,
  actualizado_en DATETIME      NOT NULL,
  CONSTRAINT fk_ped_cli FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  INDEX idx_ped_estado (estado),
  INDEX idx_ped_fecha (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lineas_pedido (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT           NOT NULL,
  variante_id     INT           NOT NULL,
  descripcion     VARCHAR(160)  NOT NULL,
  modo_id         VARCHAR(20)   NOT NULL,
  talla           VARCHAR(6)    NOT NULL,
  cantidad        INT           NOT NULL,
  precio_unitario DECIMAL(8,2)  NOT NULL,
  importe         DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_lin_ped  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id),
  CONSTRAINT fk_lin_var  FOREIGN KEY (variante_id) REFERENCES variantes(id),
  CONSTRAINT fk_lin_modo FOREIGN KEY (modo_id)     REFERENCES modos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pagos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id        INT           NOT NULL,
  metodo           VARCHAR(30)   NOT NULL,
  resultado        VARCHAR(20)   NOT NULL,     -- aprobado | rechazado
  importe          DECIMAL(10,2) NOT NULL,
  referencia       VARCHAR(40)   NOT NULL UNIQUE,
  tarjeta_ultimos4 CHAR(4)       NOT NULL,
  mensaje          VARCHAR(160)  NOT NULL,
  creado_en        DATETIME      NOT NULL,
  CONSTRAINT fk_pag_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE historial_estados (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT          NOT NULL,
  estado_anterior VARCHAR(20)  NULL,
  estado_nuevo    VARCHAR(20)  NOT NULL,
  motivo          VARCHAR(200) NULL,
  actor           VARCHAR(60)  NOT NULL,
  creado_en       DATETIME     NOT NULL,
  CONSTRAINT fk_his_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE incidencias (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  codigo    VARCHAR(20)  NOT NULL UNIQUE,
  pedido_id INT          NULL,
  nombre    VARCHAR(100) NOT NULL,
  email     VARCHAR(120) NOT NULL,
  motivo    VARCHAR(30)  NOT NULL,
  mensaje   TEXT         NOT NULL,
  estado    VARCHAR(20)  NOT NULL,              -- abierta | resuelta
  creado_en DATETIME     NOT NULL,
  CONSTRAINT fk_inc_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE eventos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  uuid        CHAR(36)    NOT NULL UNIQUE,
  tipo        VARCHAR(40) NOT NULL,
  origen      VARCHAR(10) NOT NULL,             -- cliente | servidor
  ocurrido_en DATETIME    NOT NULL,
  sesion_id   VARCHAR(40) NULL,
  cliente_id  INT         NULL,
  pedido_id   INT         NULL,
  datos       TEXT        NOT NULL,             -- JSON
  INDEX idx_ev_tipo (tipo),
  INDEX idx_ev_fecha (ocurrido_en),
  INDEX idx_ev_sesion (sesion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
