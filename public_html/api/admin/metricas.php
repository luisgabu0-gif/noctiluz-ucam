<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// GET → indicadores del negocio y embudo de conversión calculado a partir de los eventos
permitir('GET');
Admin::exigir();
responder(Admin::metricas());
