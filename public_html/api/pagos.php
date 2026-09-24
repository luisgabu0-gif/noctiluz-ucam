<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/pagos.php {codigo, email, titular, numero, caducidad, cvc} → pago simulado (solo tarjetas de prueba)
permitir('POST');
responder(Pagos::simular(cuerpoJson()));
