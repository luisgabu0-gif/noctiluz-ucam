<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// GET /api/productos.php → catálogo completo con variantes, modos y reglas comerciales
permitir('GET');
responder(Catalogo::listar());
