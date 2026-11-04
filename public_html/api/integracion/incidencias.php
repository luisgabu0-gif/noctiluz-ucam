<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// POST {codigo, respuesta} → n8n guarda en la tienda la respuesta aprobada por una persona; el cliente la ve en «Mi cuenta».
permitir('POST');
Integracion::exigirToken();
responder(Integracion::guardarRespuesta(cuerpoJson()));
