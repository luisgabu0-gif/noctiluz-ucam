-- NOCTILUZ · Cambios del catálogo (nombres de las camisetas y un solo modo de luz por producto), para una base MySQL YA instalada (hosting).
-- Se ejecuta desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, eventos ni stock.
-- Se puede ejecutar más de una vez: si ya se aplicó una versión anterior, solo hace lo que falte.
-- En una instalación nueva no hace falta: datos_prueba.sql ya incluye estos cambios.
-- No hay que subir archivos: los SKU y las fotos no cambian.

START TRANSACTION;

-- La Camiseta Pulso pasa a llamarse Onda Vibrante (mismo slug, SKU, precio y stock).
UPDATE productos SET nombre = 'Onda Vibrante' WHERE slug = 'camiseta-pulso';

-- La Camiseta Línea azul se vende como producto propio, «Estética azul»:
-- misma prenda, precio, tallas y modos que la Camiseta Línea, que se queda solo con el color verde lima.
-- INSERT IGNORE: si el producto ya existe (slug único), no se duplica.
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'estetica-azul', 'Estética azul', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'camiseta-linea';

INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id
  FROM producto_modos pm
  JOIN productos linea ON linea.id = pm.producto_id AND linea.slug = 'camiseta-linea'
  JOIN productos nuevo ON nuevo.slug = 'estetica-azul';

-- La variante azul (mismo id, SKU, foto y stock) pasa al producto nuevo.
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'estetica-azul')
WHERE sku = 'camiseta-linea-azul';

-- La Camiseta Línea, que se queda solo con el verde lima, pasa a llamarse Explosión refrescante.
UPDATE productos SET nombre = 'Explosión refrescante' WHERE slug = 'camiseta-linea';

-- La cian de Onda Vibrante se vende como producto propio, «Camiseta Pulso», solo con luz fija.
INSERT IGNORE INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'pulso-cian', 'Camiseta Pulso', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'camiseta-pulso';

INSERT IGNORE INTO producto_modos (producto_id, modo_id)
SELECT id, 'fijo' FROM productos WHERE slug = 'pulso-cian';

UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'pulso-cian')
WHERE sku = 'camiseta-pulso-cian';

-- Onda Vibrante se queda con la rosa y solo con el modo parpadeo.
DELETE FROM producto_modos
WHERE producto_id = (SELECT id FROM productos WHERE slug = 'camiseta-pulso') AND modo_id <> 'parpadeo';

-- Cada producto tiene un solo modo de iluminación: se borran los demás.
-- (Onda Vibrante, Explosión refrescante, Estética azul y Camiseta Pulso ya tienen uno solo.)
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'chaqueta-circuito')  AND modo_id <> 'fijo';
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'chaqueta-perimetro') AND modo_id <> 'degradado';
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'mochila-halo')       AND modo_id <> 'fijo';
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'mochila-trayecto')   AND modo_id <> 'parpadeo';
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'gorra-aura')         AND modo_id <> 'degradado';
DELETE FROM producto_modos WHERE producto_id = (SELECT id FROM productos WHERE slug = 'gorra-faro')         AND modo_id <> 'fijo';

COMMIT;
