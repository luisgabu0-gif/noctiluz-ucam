<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET  /api/resenas.php → últimas reseñas y si quien mira puede opinar (el equipo de administración no)
// POST /api/resenas.php {pedido, email, nombre, estrellas, texto, sesion_id} → publica una reseña (evento review.created)
permitir('GET', 'POST');
if (metodo() === 'GET') {
    responder(['resenas' => Resenas::ultimas(), 'puede_opinar' => !Resenas::esAdmin()]);
}
responder(Resenas::crear(cuerpoJson()), 201);
