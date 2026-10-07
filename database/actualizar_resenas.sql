-- NOCTILUZ · Reseñas de clientes y nueva foto de la mochila Marco, para una base MySQL YA instalada (hosting).
-- Se ejecuta una sola vez desde phpMyAdmin (pestaña SQL o Importar). No borra pedidos, eventos ni stock.
-- En una instalación nueva no hace falta: esquema_mysql.sql y datos_prueba.sql ya incluyen estos cambios.
-- Antes hay que subir public_html/app/Resenas.php, public_html/api/resenas.php y la foto nueva
-- public_html/assets/img/productos/mochila-halo-cian.jpg.

CREATE TABLE resenas (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT          NULL UNIQUE,
  nombre    VARCHAR(60)  NOT NULL,
  prenda    VARCHAR(120) NOT NULL,
  estrellas TINYINT      NOT NULL,
  texto     TEXT         NOT NULL,
  creado_en DATETIME     NOT NULL,
  CONSTRAINT fk_res_ped FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT ck_res_estrellas CHECK (estrellas BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

-- Las tres reseñas que antes estaban escritas a mano en la portada.
INSERT INTO resenas (pedido_id, nombre, prenda, estrellas, texto, creado_en) VALUES
(NULL, 'Sara N.',   'Horizonte · Cian',   4, 'Me encanta que la luz vaya en la visera: discreta de día y espectacular de noche.', '2026-09-25 20:41:00'),
(NULL, 'Marcos I.', 'Rumbo · Rosa',       5, 'La uso para ir en bici al trabajo. El parpadeo se ve desde lejísimos.', '2026-09-26 08:15:00'),
(NULL, 'Lucía F.',  'Retícula · Verde lima', 5, 'En el concierto no paraban de preguntarme dónde la había comprado. Brilla muchísimo y no pesa nada.', '2026-09-27 23:02:00');

-- La mochila Marco cambia de foto: su descripción se adapta.
UPDATE productos SET
  descripcion = 'Mochila técnica con fibra óptica en el asa, los tirantes, las cremalleras y los bolsillos laterales, y un circuito luminoso en el frontal. Se ve desde cualquier ángulo en la carretera.',
  material    = 'Poliéster 600D reciclado con bolsillos laterales y frontal acolchado, capacidad de 20 L'
WHERE slug = 'mochila-halo';

COMMIT;
