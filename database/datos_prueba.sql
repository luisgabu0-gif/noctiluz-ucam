-- NOCTILUZ · Datos de prueba (válidos para MySQL y SQLite)
-- Todos los datos son FICTICIOS: clientes de prueba con dominio .test, sin datos personales reales.

-- ---------- Datos maestros ----------

INSERT INTO categorias (id, nombre, nombre_singular, orden) VALUES
('camiseta', 'Camisetas', 'Camiseta', 1),
('chaqueta', 'Chaquetas', 'Chaqueta', 2),
('mochila',  'Mochilas',  'Mochila',  3),
('gorra',    'Gorras',    'Gorra',    4);

INSERT INTO colores (id, nombre, hex) VALUES
('cian',    'Cian',        '#55DCD4'),
('rosa',    'Rosa',        '#F27FAA'),
('ambar',   'Ámbar',       '#F3B36B'),
('violeta', 'Violeta',     '#A594F2'),
('lima',    'Verde lima',  '#BFE86E'),
('blanco',  'Blanco frío', '#E9EEF7'),
('rojo',    'Rojo neón',   '#F25C5C'),
('azul',    'Azul',        '#4D8DFF');

INSERT INTO modos (id, nombre, descripcion) VALUES
('fijo',      'Fijo',      'Luz continua a intensidad constante. Máxima autonomía.'),
('parpadeo',  'Parpadeo',  'Pulso intermitente muy visible, pensado para bici y patinete.'),
('degradado', 'Degradado', 'La intensidad sube y baja de forma suave y continua.');

INSERT INTO productos (id, slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo) VALUES
(1, 'chaqueta-circuito', 'Nervadura', 'chaqueta',
 'Chaqueta técnica de cuello alto con pistas de fibra óptica que recorren el pecho y las mangas como un circuito impreso. Bolsillo diagonal con cremallera y módulo LED extraíble en el pecho: luz continua y discreta para la ciudad de noche.',
 'Nailon ripstop repelente al agua, forro de malla transpirable', 8, 149.00, 1, 4.8, 32, 1),
(2, 'chaqueta-perimetro', 'Pespunte', 'chaqueta',
 'Silueta recta y costuras marcadas con hilo luminoso perimetral. Pensada para trayectos en bici y noches largas de ciudad.',
 'Softshell cortavientos con membrana transpirable', 10, 159.00, 1, 4.6, 21, 1),
(3, 'camiseta-pulso', 'Pentagrama', 'camiseta',
 'Camiseta de algodón técnico con una línea de fibra óptica central que sigue la costura: de día invisible y de noche presente.',
 'Algodón técnico 95 % y elastano 5 %', 6, 69.00, 1, 4.7, 44, 1),
(4, 'camiseta-linea', 'Retícula', 'camiseta',
 'Corte oversize con doble línea luminosa lateral. Tejido ligero y transpirable para uso durante todo el año.',
 'Algodón orgánico peinado de 180 g/m²', 6, 69.00, 1, 4.5, 15, 1),
(5, 'mochila-halo', 'Marco', 'mochila',
 'Mochila urbana de frontal liso con un hilo de fibra óptica que recorre todo su contorno y la dibuja en la oscuridad, visible desde cualquier ángulo en la carretera.',
 'Poliéster 600D reciclado con frontal semirrígido, capacidad de 20 L', 12, 89.00, 0, 4.9, 27, 1),
(6, 'mochila-trayecto', 'Cartografía', 'mochila',
 'Mochila para el trayecto diario con funda acolchada para portátil y bolsillos laterales. Según el color, la fibra óptica perfila asa, tirantes y bolsillos con flechas de dirección o dibuja un patrón geométrico en el frontal.',
 'Poliéster técnico resistente al agua, 24 L con funda para portátil de 15"', 14, 119.00, 0, 4.6, 19, 1),
(7, 'gorra-aura', 'Celosía', 'gorra',
 'Gorra de visera curva con un halo luminoso alrededor de la copa, alimentado por una batería plana en el ajuste trasero.',
 'Sarga de algodón con cierre ajustable', 5, 49.00, 0, 4.4, 12, 1),
(8, 'gorra-faro', 'Horizonte', 'gorra',
 'Gorra técnica resistente al agua con línea luminosa frontal integrada en la costura de la visera.',
 'Poliéster técnico impermeable', 5, 59.00, 0, 4.7, 23, 1),
-- La azul de la antigua Camiseta Línea se vende como producto propio, «Anatomía»: misma prenda, precio y modos que «Retícula».
(9, 'estetica-azul', 'Anatomía', 'camiseta',
 'Corte oversize con doble línea luminosa lateral. Tejido ligero y transpirable para uso durante todo el año.',
 'Algodón orgánico peinado de 180 g/m²', 6, 69.00, 1, 4.5, 15, 1),
-- La cian de la antigua Camiseta Pulso se vende como producto propio (solo luz fija); Pentagrama se queda con la rosa (solo parpadeo).
(10, 'pulso-cian', 'Meridiano', 'camiseta',
 'Camiseta de algodón técnico con una línea de fibra óptica central que sigue la costura: de día invisible y de noche presente.',
 'Algodón técnico 95 % y elastano 5 %', 6, 69.00, 1, 4.7, 44, 1);

-- Modo de iluminación de cada producto: uno solo, el que mejor encaja con su diseño (depende del controlador que lleva).
INSERT INTO producto_modos (producto_id, modo_id) VALUES
(1, 'fijo'),         -- Nervadura: luz discreta y continua
(2, 'degradado'),    -- Pespunte: el contorno sube y baja de intensidad
(3, 'parpadeo'),     -- Pentagrama
(4, 'fijo'),         -- Retícula
(5, 'fijo'),         -- Marco: el contorno la dibuja en la oscuridad
(6, 'parpadeo'),     -- Cartografía: flechas de dirección, como un intermitente
(7, 'degradado'),    -- Celosía: halo que respira
(8, 'fijo'),         -- Horizonte: ilumina como un faro
(9, 'fijo'),         -- Anatomía
(10, 'fijo');       -- Meridiano (cian)

-- Variantes (SKU = producto + color de luz). imagen NULL = se muestra la ilustración provisional.
INSERT INTO variantes (id, sku, producto_id, color_id, imagen, stock) VALUES
(1,  'chaqueta-circuito-ambar',   1, 'ambar',   'assets/img/productos/chaqueta-circuito-ambar-modelo.webp', 11),
(2,  'chaqueta-circuito-violeta', 1, 'violeta', 'assets/img/productos/chaqueta-circuito-violeta.jpg', 8),
(3,  'chaqueta-perimetro-lima',   2, 'lima',    'assets/img/productos/chaqueta-perimetro-lima.jpg', 6),
(4,  'chaqueta-perimetro-blanco', 2, 'blanco',  'assets/img/productos/chaqueta-perimetro-blanco.jpg', 0),
(5,  'camiseta-pulso-cian',      10, 'cian',   'assets/img/productos/camiseta-pulso-cian.jpg', 25),
(6,  'camiseta-pulso-rosa',       3, 'rosa',    'assets/img/productos/camiseta-pulso-rosa.jpg', 17),
(7,  'camiseta-linea-azul',       9, 'azul',   'assets/img/productos/camiseta-linea-azul.jpg', 20),
(8,  'camiseta-linea-lima',       4, 'lima',    'assets/img/productos/camiseta-linea-lima.jpg', 14),
(9,  'mochila-halo-cian',         5, 'cian',    'assets/img/productos/mochila-halo-cian.jpg', 9),
(10, 'mochila-halo-lima',         5, 'lima',    'assets/img/productos/mochila-halo-lima.jpg', 12),
(11, 'mochila-trayecto-rosa',     6, 'rosa',    'assets/img/productos/mochila-trayecto-rosa.jpg', 7),
(12, 'mochila-trayecto-rojo',     6, 'rojo',    'assets/img/productos/mochila-trayecto-rojo.jpg', 3),
(13, 'gorra-aura-violeta',        7, 'violeta', 'assets/img/productos/gorra-aura-violeta.jpg', 18),
(14, 'gorra-aura-blanco',         7, 'blanco',  'assets/img/productos/gorra-aura-blanco.jpg', 15),
(15, 'gorra-faro-cian',           8, 'cian',    'assets/img/productos/gorra-faro-cian.jpg', 10),
(16, 'gorra-faro-violeta',        8, 'violeta', 'assets/img/productos/gorra-faro-violeta.jpg', 4);

INSERT INTO cupones (codigo, descripcion, tipo, valor, minimo, activo) VALUES
('NOCHE10',     '10 % de descuento en pedidos desde 50 €',         'porcentaje', 10.00, 50.00, 1),
('BIENVENIDA5', '5 € de descuento en pedidos desde 30 €',           'importe',     5.00, 30.00, 1),
('ENVIOGRATIS', 'Envío estándar gratuito sin pedido mínimo',        'envio',       0.00,  0.00, 1),
('VERANO25',    'Campaña de verano (caducada, para probar la regla)', 'porcentaje', 25.00,  0.00, 0);

-- Cuenta de administración DE PRUEBA (contraseña documentada en el README; no es una credencial real).
INSERT INTO usuarios_admin (id, email, nombre, password_hash) VALUES
(1, 'admin@noctiluz.test', 'Administración (prueba)', '$2y$10$AoZhD5i7X.0MmZ2e54xsYOlbFSGwya3DT3aG81sMjy8dKyKt6hKby');

-- ---------- Clientes de prueba (ficticios) ----------

INSERT INTO clientes (id, nombre, email, telefono, creado_en) VALUES
(1, 'Lucía Ferrer (prueba)', 'lucia.ferrer@ejemplo.test', '600000101', '2026-09-20 21:04:10'),
(2, 'Marcos Ibáñez (prueba)', 'marcos.ibanez@ejemplo.test', '600000102', '2026-09-22 19:40:02'),
(3, 'Sara Nieto (prueba)', 'sara.nieto@ejemplo.test', '600000103', '2026-09-23 22:15:47');

-- ---------- Pedidos de ejemplo ----------
-- Pedido 1: 69 + 49 = 118,00 (< 120 → envío estándar 4,95) → total 122,95 · base 101,61 · IVA 21,34
-- Pedido 2: 149,00 − 10 % (NOCHE10) = 134,10 (≥ 120 → envío gratis) → total 134,10 · base 110,83 · IVA 23,27
-- Pedido 3: 89,00 + envío exprés 9,95 → total 98,95 · base 81,78 · IVA 17,17 (pago rechazado, sigue "creado")

INSERT INTO pedidos (id, codigo, cliente_id, sesion_id, estado, metodo_envio, cupon_codigo, subtotal, descuento, envio, base_imponible, iva, total, dir_linea, dir_cp, dir_ciudad, dir_provincia, creado_en, actualizado_en) VALUES
(1, 'NCZ-260920-A7K2QD', 1, '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', 'enviado', 'estandar', NULL,
 118.00, 0.00, 4.95, 101.61, 21.34, 122.95, 'Calle Ficticia 12, 3.º B', '30001', 'Murcia', 'Murcia', '2026-09-20 21:09:31', '2026-09-22 10:15:00'),
(2, 'NCZ-260922-M3P9XT', 2, '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', 'pagado', 'estandar', 'NOCHE10',
 149.00, 14.90, 0.00, 110.83, 23.27, 134.10, 'Avenida de Prueba 45', '30107', 'Guadalupe', 'Murcia', '2026-09-22 19:44:18', '2026-09-22 19:45:02'),
(3, 'NCZ-260923-R8W4LN', 3, 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', 'creado', 'expres', NULL,
 89.00, 0.00, 9.95, 81.78, 17.17, 98.95, 'Plaza Inventada 3', '30820', 'Alcantarilla', 'Murcia', '2026-09-23 22:19:05', '2026-09-23 22:19:05');

INSERT INTO lineas_pedido (id, pedido_id, variante_id, descripcion, modo_id, talla, cantidad, precio_unitario, importe) VALUES
(1, 1, 6,  'Pentagrama · Rosa',    'parpadeo',  'M',     1, 69.00,  69.00),
(2, 1, 13, 'Celosía · Violeta',      'degradado', 'Única', 1, 49.00,  49.00),
(3, 2, 1,  'Nervadura · Ámbar', 'fijo',      'L',     1, 149.00, 149.00),
(4, 3, 9,  'Marco · Cian',       'fijo',      'Única', 1, 89.00,  89.00);

INSERT INTO pagos (id, pedido_id, metodo, resultado, importe, referencia, tarjeta_ultimos4, mensaje, creado_en) VALUES
(1, 1, 'tarjeta_simulada', 'aprobado',  122.95, 'SIM-7Q2M9X4K1P', '4242', 'Pago simulado aprobado', '2026-09-20 21:10:02'),
(2, 2, 'tarjeta_simulada', 'aprobado',  134.10, 'SIM-3H8T5V0R6W', '4242', 'Pago simulado aprobado', '2026-09-22 19:45:02'),
(3, 3, 'tarjeta_simulada', 'rechazado',  98.95, 'SIM-9L4D2Z7B3C', '0002', 'Tarjeta de prueba rechazada: fondos insuficientes', '2026-09-23 22:20:11');

INSERT INTO historial_estados (id, pedido_id, estado_anterior, estado_nuevo, motivo, actor, creado_en) VALUES
(1, 1, NULL,             'creado',         'Pedido generado desde la tienda', 'cliente',           '2026-09-20 21:09:31'),
(2, 1, 'creado',         'pagado',         'Pago simulado aprobado',          'pasarela-simulada', '2026-09-20 21:10:02'),
(3, 1, 'pagado',         'en_preparacion', 'Pedido pasado a almacén',         'admin@noctiluz.test', '2026-09-21 09:30:00'),
(4, 1, 'en_preparacion', 'enviado',        'Entregado a la mensajería',       'admin@noctiluz.test', '2026-09-22 10:15:00'),
(5, 2, NULL,             'creado',         'Pedido generado desde la tienda', 'cliente',           '2026-09-22 19:44:18'),
(6, 2, 'creado',         'pagado',         'Pago simulado aprobado',          'pasarela-simulada', '2026-09-22 19:45:02'),
(7, 3, NULL,             'creado',         'Pedido generado desde la tienda', 'cliente',           '2026-09-23 22:19:05');

INSERT INTO incidencias (id, codigo, pedido_id, nombre, email, motivo, mensaje, estado, creado_en) VALUES
(1, 'INC-260923-4TQZ', 1, 'Lucía Ferrer (prueba)', 'lucia.ferrer@ejemplo.test', 'envio',
 'El seguimiento indica que el pedido está enviado, pero todavía no me ha llegado. ¿Podéis revisarlo?', 'abierta', '2026-09-23 18:02:40');

-- ---------- Eventos de ejemplo (mismo formato que los que genera la aplicación) ----------

INSERT INTO eventos (id, uuid, tipo, origen, ocurrido_en, sesion_id, cliente_id, pedido_id, datos) VALUES
(1,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a01', 'product.viewed',       'cliente',  '2026-09-20 21:04:10', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', NULL, NULL, '{"sku":"camiseta-pulso-rosa"}'),
(2,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a02', 'cart.item_added',      'cliente',  '2026-09-20 21:05:22', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', NULL, NULL, '{"sku":"camiseta-pulso-rosa","modo":"parpadeo","talla":"M","cantidad":1,"precio":69}'),
(3,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a03', 'product.viewed',       'cliente',  '2026-09-20 21:06:03', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', NULL, NULL, '{"sku":"gorra-aura-violeta"}'),
(4,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a04', 'cart.item_added',      'cliente',  '2026-09-20 21:06:40', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', NULL, NULL, '{"sku":"gorra-aura-violeta","modo":"degradado","talla":"Única","cantidad":1,"precio":49}'),
(5,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a05', 'checkout.started',     'cliente',  '2026-09-20 21:07:15', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', NULL, NULL, '{"lineas":2,"unidades":2,"subtotal":118}'),
(6,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a06', 'order.created',        'servidor', '2026-09-20 21:09:31', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', 1, 1, '{"codigo":"NCZ-260920-A7K2QD","total":122.95,"lineas":2,"metodo_envio":"estandar","cupon":null}'),
(7,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a07', 'payment.simulated',    'servidor', '2026-09-20 21:10:02', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', 1, 1, '{"codigo":"NCZ-260920-A7K2QD","resultado":"aprobado","importe":122.95,"referencia":"SIM-7Q2M9X4K1P"}'),
(8,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a08', 'order.status_changed', 'servidor', '2026-09-20 21:10:02', '5f0c7a2e-1b3d-4c8e-9a61-0d2b7e4f1a01', 1, 1, '{"codigo":"NCZ-260920-A7K2QD","de":"creado","a":"pagado","actor":"pasarela-simulada"}'),
(9,  '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a09', 'order.status_changed', 'servidor', '2026-09-21 09:30:00', NULL, 1, 1, '{"codigo":"NCZ-260920-A7K2QD","de":"pagado","a":"en_preparacion","actor":"admin@noctiluz.test"}'),
(10, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a10', 'order.status_changed', 'servidor', '2026-09-22 10:15:00', NULL, 1, 1, '{"codigo":"NCZ-260920-A7K2QD","de":"en_preparacion","a":"enviado","actor":"admin@noctiluz.test"}'),
(11, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a11', 'product.viewed',       'cliente',  '2026-09-22 19:40:02', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', NULL, NULL, '{"sku":"chaqueta-circuito-ambar"}'),
(12, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a12', 'cart.item_added',      'cliente',  '2026-09-22 19:41:10', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', NULL, NULL, '{"sku":"chaqueta-circuito-ambar","modo":"fijo","talla":"L","cantidad":1,"precio":149}'),
(13, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a13', 'checkout.started',     'cliente',  '2026-09-22 19:42:31', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', NULL, NULL, '{"lineas":1,"unidades":1,"subtotal":149}'),
(14, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a14', 'order.created',        'servidor', '2026-09-22 19:44:18', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', 2, 2, '{"codigo":"NCZ-260922-M3P9XT","total":134.1,"lineas":1,"metodo_envio":"estandar","cupon":"NOCHE10"}'),
(15, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a15', 'payment.simulated',    'servidor', '2026-09-22 19:45:02', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', 2, 2, '{"codigo":"NCZ-260922-M3P9XT","resultado":"aprobado","importe":134.1,"referencia":"SIM-3H8T5V0R6W"}'),
(16, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a16', 'order.status_changed', 'servidor', '2026-09-22 19:45:02', '8a4d2c19-6e7f-4b10-b2a3-51c9d8e0f202', 2, 2, '{"codigo":"NCZ-260922-M3P9XT","de":"creado","a":"pagado","actor":"pasarela-simulada"}'),
(17, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a17', 'support.requested',    'servidor', '2026-09-23 18:02:40', NULL, 1, 1, '{"codigo":"INC-260923-4TQZ","motivo":"envio","pedido":"NCZ-260920-A7K2QD"}'),
(18, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a18', 'product.viewed',       'cliente',  '2026-09-23 22:15:47', 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', NULL, NULL, '{"sku":"mochila-halo-cian"}'),
(19, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a19', 'cart.item_added',      'cliente',  '2026-09-23 22:16:30', 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', NULL, NULL, '{"sku":"mochila-halo-cian","modo":"fijo","talla":"Única","cantidad":1,"precio":89}'),
(20, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a20', 'checkout.started',     'cliente',  '2026-09-23 22:17:12', 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', NULL, NULL, '{"lineas":1,"unidades":1,"subtotal":89}'),
(21, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a21', 'order.created',        'servidor', '2026-09-23 22:19:05', 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', 3, 3, '{"codigo":"NCZ-260923-R8W4LN","total":98.95,"lineas":1,"metodo_envio":"expres","cupon":null}'),
(22, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a22', 'payment.simulated',    'servidor', '2026-09-23 22:20:11', 'c3e9f7a1-2b4d-4e6f-8a0b-9d1c2e3f4a03', 3, 3, '{"codigo":"NCZ-260923-R8W4LN","resultado":"rechazado","importe":98.95,"referencia":"SIM-9L4D2Z7B3C"}'),
(23, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a23', 'product.viewed',       'cliente',  '2026-09-24 09:12:05', 'd7a2b1c0-9e8f-4a7b-8c6d-5e4f3a2b1c04', NULL, NULL, '{"sku":"gorra-faro-cian"}'),
(24, '0b1f6c2a-7d3e-4f51-8a92-1c3d5e7f9a24', 'product.viewed',       'cliente',  '2026-09-24 09:13:40', 'd7a2b1c0-9e8f-4a7b-8c6d-5e4f3a2b1c04', NULL, NULL, '{"sku":"mochila-trayecto-rosa"}');
