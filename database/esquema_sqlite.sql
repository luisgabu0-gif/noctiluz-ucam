-- NOCTILUZ · Esquema equivalente para SQLite (solo pruebas en local, ver README).
-- Mismas tablas y columnas que esquema_mysql.sql.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS eventos;
DROP TABLE IF EXISTS incidencias;
DROP TABLE IF EXISTS historial_estados;
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS lineas_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS variantes;
DROP TABLE IF EXISTS producto_modos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS cupones;
DROP TABLE IF EXISTS modos;
DROP TABLE IF EXISTS colores;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios_admin;

CREATE TABLE categorias (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, nombre_singular TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE colores (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, hex TEXT NOT NULL);
CREATE TABLE modos (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT NOT NULL);

CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria_id TEXT NOT NULL REFERENCES categorias(id),
  descripcion TEXT NOT NULL,
  material TEXT NOT NULL,
  autonomia_h INTEGER NOT NULL,
  precio NUMERIC NOT NULL,
  tiene_tallas INTEGER NOT NULL DEFAULT 0,
  valoracion NUMERIC NOT NULL DEFAULT 0,
  num_resenas INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE producto_modos (
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  modo_id TEXT NOT NULL REFERENCES modos(id),
  PRIMARY KEY (producto_id, modo_id)
);
CREATE TABLE variantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  color_id TEXT NOT NULL REFERENCES colores(id),
  imagen TEXT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE TABLE cupones (
  codigo TEXT PRIMARY KEY, descripcion TEXT NOT NULL, tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0, minimo NUMERIC NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE usuarios_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, password_hash TEXT NOT NULL
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  telefono TEXT NULL, creado_en TEXT NOT NULL
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  sesion_id TEXT NULL,
  estado TEXT NOT NULL,
  metodo_envio TEXT NOT NULL,
  cupon_codigo TEXT NULL,
  subtotal NUMERIC NOT NULL, descuento NUMERIC NOT NULL DEFAULT 0, envio NUMERIC NOT NULL DEFAULT 0,
  base_imponible NUMERIC NOT NULL, iva NUMERIC NOT NULL, total NUMERIC NOT NULL,
  dir_linea TEXT NOT NULL, dir_cp TEXT NOT NULL, dir_ciudad TEXT NOT NULL, dir_provincia TEXT NOT NULL,
  creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
);
CREATE INDEX idx_ped_estado ON pedidos(estado);
CREATE INDEX idx_ped_fecha ON pedidos(creado_en);

CREATE TABLE lineas_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  variante_id INTEGER NOT NULL REFERENCES variantes(id),
  descripcion TEXT NOT NULL,
  modo_id TEXT NOT NULL REFERENCES modos(id),
  talla TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC NOT NULL,
  importe NUMERIC NOT NULL
);
CREATE TABLE pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  metodo TEXT NOT NULL, resultado TEXT NOT NULL, importe NUMERIC NOT NULL,
  referencia TEXT NOT NULL UNIQUE, tarjeta_ultimos4 TEXT NOT NULL, mensaje TEXT NOT NULL, creado_en TEXT NOT NULL
);
CREATE TABLE historial_estados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  estado_anterior TEXT NULL, estado_nuevo TEXT NOT NULL, motivo TEXT NULL, actor TEXT NOT NULL, creado_en TEXT NOT NULL
);
CREATE TABLE incidencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  pedido_id INTEGER NULL REFERENCES pedidos(id),
  nombre TEXT NOT NULL, email TEXT NOT NULL, motivo TEXT NOT NULL, mensaje TEXT NOT NULL,
  estado TEXT NOT NULL, creado_en TEXT NOT NULL
);
CREATE TABLE eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  origen TEXT NOT NULL,
  ocurrido_en TEXT NOT NULL,
  sesion_id TEXT NULL,
  cliente_id INTEGER NULL,
  pedido_id INTEGER NULL,
  datos TEXT NOT NULL
);
CREATE INDEX idx_ev_tipo ON eventos(tipo);
CREATE INDEX idx_ev_fecha ON eventos(ocurrido_en);
CREATE INDEX idx_ev_sesion ON eventos(sesion_id);
