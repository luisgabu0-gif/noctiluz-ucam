-- NOCTILUZ · Un nombre distinto para cada artículo, para la base del hosting. Ejecutar después de actualizar_nombres.sql.
-- La segunda variante de cada modelo pasa a ser un producto propio (mismo SKU, foto, precio y stock).
-- Se ejecuta una sola vez desde phpMyAdmin. INSERT IGNORE: si el producto ya existe (slug único), no se duplica.
START TRANSACTION;

UPDATE productos SET nombre = 'Rumbo' WHERE slug = 'mochila-trayecto';

-- Constelación (sale de chaqueta-circuito)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'nervadura-constelacion', 'Constelación', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'chaqueta-circuito';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'chaqueta-circuito'
  JOIN productos nuevo ON nuevo.slug = 'nervadura-constelacion';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'nervadura-constelacion') WHERE sku = 'chaqueta-circuito-violeta';

-- Ribete (sale de chaqueta-perimetro)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'pespunte-ribete', 'Ribete', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'chaqueta-perimetro';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'chaqueta-perimetro'
  JOIN productos nuevo ON nuevo.slug = 'pespunte-ribete';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'pespunte-ribete') WHERE sku = 'chaqueta-perimetro-blanco';

-- Silueta (sale de mochila-halo)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'marco-silueta', 'Silueta', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'mochila-halo';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'mochila-halo'
  JOIN productos nuevo ON nuevo.slug = 'marco-silueta';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'marco-silueta') WHERE sku = 'mochila-halo-lima';

-- Cartografía (sale de mochila-trayecto)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'cartografia', 'Cartografía', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'mochila-trayecto';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'mochila-trayecto'
  JOIN productos nuevo ON nuevo.slug = 'cartografia';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'cartografia') WHERE sku = 'mochila-trayecto-rojo';

-- Trazo (sale de gorra-aura)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'celosia-trazo', 'Trazo', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'gorra-aura';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'gorra-aura'
  JOIN productos nuevo ON nuevo.slug = 'celosia-trazo';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'celosia-trazo') WHERE sku = 'gorra-aura-blanco';

-- Ocaso (sale de gorra-faro)
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'horizonte-ocaso', 'Ocaso', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'gorra-faro';
INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id FROM producto_modos pm
  JOIN productos orig ON orig.id = pm.producto_id AND orig.slug = 'gorra-faro'
  JOIN productos nuevo ON nuevo.slug = 'horizonte-ocaso';
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'horizonte-ocaso') WHERE sku = 'gorra-faro-violeta';

COMMIT;
