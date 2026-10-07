-- NOCTILUZ · Nombres nuevos de los productos, para la base del hosting. Mismo slug, SKU, precio y stock.
-- Se ejecuta una sola vez desde phpMyAdmin.
UPDATE productos SET nombre = 'Nervadura' WHERE slug = 'chaqueta-circuito';
UPDATE productos SET nombre = 'Pespunte' WHERE slug = 'chaqueta-perimetro';
UPDATE productos SET nombre = 'Pentagrama' WHERE slug = 'camiseta-pulso';
UPDATE productos SET nombre = 'Retícula' WHERE slug = 'camiseta-linea';
UPDATE productos SET nombre = 'Anatomía' WHERE slug = 'estetica-azul';
UPDATE productos SET nombre = 'Meridiano' WHERE slug = 'pulso-cian';
UPDATE productos SET nombre = 'Marco' WHERE slug = 'mochila-halo';
UPDATE productos SET nombre = 'Cartografía' WHERE slug = 'mochila-trayecto';
UPDATE productos SET nombre = 'Celosía' WHERE slug = 'gorra-aura';
UPDATE productos SET nombre = 'Horizonte' WHERE slug = 'gorra-faro';
