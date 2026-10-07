-- NOCTILUZ · Fotos nuevas de las cuatro chaquetas (Circuito ámbar y violeta, Perímetro verde lima y blanco frío), para la base del hosting.
-- Se ejecuta una sola vez desde phpMyAdmin. Antes hay que subir las fotos chaqueta-*.jpg de public_html/assets/img/productos/.
UPDATE variantes SET imagen = 'assets/img/productos/chaqueta-circuito-ambar.jpg'   WHERE sku = 'chaqueta-circuito-ambar';
UPDATE variantes SET imagen = 'assets/img/productos/chaqueta-circuito-violeta.jpg' WHERE sku = 'chaqueta-circuito-violeta';
UPDATE variantes SET imagen = 'assets/img/productos/chaqueta-perimetro-lima.jpg'   WHERE sku = 'chaqueta-perimetro-lima';
UPDATE variantes SET imagen = 'assets/img/productos/chaqueta-perimetro-blanco.jpg' WHERE sku = 'chaqueta-perimetro-blanco';
