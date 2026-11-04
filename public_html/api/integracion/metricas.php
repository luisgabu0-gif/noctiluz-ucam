<?php
declare(strict_types=1);
require dirname(__DIR__) . '/_inicio.php';

// POST → embudo de conversión y estado de la cola, para el cuadro de mando del back-office.
permitir('POST');
Integracion::exigirToken();
responder(['embudo' => Eventos::embudo(), 'cola' => Integracion::estadoCola()['cola']]);
