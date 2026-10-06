-- NOCTILUZ · Nuevas fotos y descripciones de las mochilas, para una base MySQL YA instalada (hosting).
-- Se ejecuta una sola vez desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, eventos ni stock.
-- En una instalación nueva no hace falta: datos_prueba.sql ya incluye estos cambios.
-- Antes hay que subir las fotos nuevas de public_html/assets/img/productos/ (mochila-halo-*, mochila-trayecto-*).

START TRANSACTION;

-- Color de luz nuevo para la Mochila Trayecto roja.
INSERT INTO colores (id, nombre, hex) VALUES ('rojo', 'Rojo neón', '#F25C5C');

UPDATE productos SET
  descripcion = 'Mochila urbana de frontal liso con un hilo de fibra óptica que recorre todo su contorno y la dibuja en la oscuridad, visible desde cualquier ángulo en la carretera.',
  material    = 'Poliéster 600D reciclado con frontal semirrígido, capacidad de 20 L'
WHERE slug = 'mochila-halo';

UPDATE productos SET
  descripcion = 'Mochila para el trayecto diario con funda acolchada para portátil y bolsillos laterales. Según el color, la fibra óptica perfila asa, tirantes y bolsillos con flechas de dirección o dibuja un patrón geométrico en el frontal.',
  material    = 'Poliéster técnico resistente al agua, 24 L con funda para portátil de 15"'
WHERE slug = 'mochila-trayecto';

-- La Halo violeta pasa a verde lima y la Trayecto blanca a roja (mismo id y stock, nuevo SKU y foto).
UPDATE variantes SET sku = 'mochila-halo-lima', color_id = 'lima', imagen = 'assets/img/productos/mochila-halo-lima.jpg'
WHERE sku = 'mochila-halo-violeta';

UPDATE variantes SET imagen = 'assets/img/productos/mochila-trayecto-rosa.jpg'
WHERE sku = 'mochila-trayecto-rosa';

UPDATE variantes SET sku = 'mochila-trayecto-rojo', color_id = 'rojo', imagen = 'assets/img/productos/mochila-trayecto-rojo.jpg'
WHERE sku = 'mochila-trayecto-blanco';

-- La Halo cian no cambia en la base: solo se sustituye el archivo mochila-halo-cian.jpg.

COMMIT;
