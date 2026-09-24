<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/eventos.php {tipo, datos, sesion_id} → registra un evento generado en el navegador
permitir('POST');
responder(['uuid' => Eventos::registrarDesdeCliente(cuerpoJson())], 201);
