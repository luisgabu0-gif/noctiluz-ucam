-- NOCTILUZ · Nuevos nombres de las camisetas, para una base MySQL YA instalada (hosting).
-- Se ejecuta una sola vez desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, eventos ni stock.
-- En una instalación nueva no hace falta: datos_prueba.sql ya incluye estos cambios.
-- No hay que subir archivos: el SKU y la foto de la camiseta azul no cambian.

START TRANSACTION;

-- La Camiseta Pulso pasa a llamarse Onda Vibrante (mismo slug, SKU, precio y stock).
UPDATE productos SET nombre = 'Onda Vibrante' WHERE slug = 'camiseta-pulso';

-- La Camiseta Línea azul se vende como producto propio, «Estética azul»:
-- misma prenda, precio, tallas y modos que la Camiseta Línea, que se queda solo con el color verde lima.
INSERT INTO productos (slug, nombre, categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo)
SELECT 'estetica-azul', 'Estética azul', categoria_id, descripcion, material, autonomia_h, precio, tiene_tallas, valoracion, num_resenas, activo
  FROM productos WHERE slug = 'camiseta-linea';

INSERT INTO producto_modos (producto_id, modo_id)
SELECT nuevo.id, pm.modo_id
  FROM producto_modos pm
  JOIN productos linea ON linea.id = pm.producto_id AND linea.slug = 'camiseta-linea'
  JOIN productos nuevo ON nuevo.slug = 'estetica-azul';

-- La variante azul (mismo id, SKU, foto y stock) pasa al producto nuevo.
UPDATE variantes SET producto_id = (SELECT id FROM productos WHERE slug = 'estetica-azul')
WHERE sku = 'camiseta-linea-azul';

COMMIT;
