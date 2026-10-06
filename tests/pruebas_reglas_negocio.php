<?php
// Pruebas automáticas de las reglas de negocio: totales, IVA, envío gratis, cupones y stock.
// Uso, desde la carpeta del proyecto:   php tests/pruebas_reglas_negocio.php
//
// Trabaja sobre una base SQLite EN MEMORIA cargada con database/esquema_sqlite.sql y
// database/datos_prueba.sql: no toca la base local ni la del hosting y cada ejecución empieza de cero.
// Termina con código 0 si todo pasa y 1 si falla alguna prueba.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("Este script solo se ejecuta desde la línea de comandos.\n");
}
foreach (['pdo_sqlite', 'mbstring'] as $ext) {
    if (!extension_loaded($ext)) {
        exit("Falta la extensión $ext: actívala en php.ini (extension=$ext).\n");
    }
}

$raiz = dirname(__DIR__);
foreach (['Db', 'Validador', 'ReglasNegocio', 'Catalogo', 'Eventos', 'Clientes', 'Pedidos'] as $clase) {
    require_once "$raiz/public_html/app/$clase.php";
}
date_default_timezone_set('Europe/Madrid');

Db::configurar(['driver' => 'sqlite', 'sqlite_ruta' => ':memory:']);
$pdo = Db::conexion();
// Igual que instalar_local.php: se cargan esquema y datos sin claves foráneas y se reactivan después.
$pdo->exec('PRAGMA foreign_keys = OFF');
$pdo->exec(file_get_contents("$raiz/database/esquema_sqlite.sql"));
$pdo->exec(file_get_contents("$raiz/database/datos_prueba.sql"));
$pdo->exec('PRAGMA foreign_keys = ON');
// Cupón solo para estas pruebas: 50 € de descuento sin mínimo, para ver que el descuento nunca supera el subtotal.
$pdo->exec("INSERT INTO cupones (codigo, descripcion, tipo, valor, minimo, activo) VALUES ('PRUEBA50', 'Solo para las pruebas', 'importe', 50.00, 0.00, 1)");

// ---------------------------------------------------------------- Mini marco de pruebas

$aciertos = 0;
$fallos = [];

function seccion(string $titulo): void
{
    echo "\n== $titulo ==\n";
}

/** Compara el valor obtenido con el esperado (mismo tipo y valor). */
function comprobar(string $prueba, $esperado, $obtenido): void
{
    global $aciertos, $fallos;
    if ($esperado === $obtenido) {
        $aciertos++;
        echo "  [OK]    $prueba\n";
        return;
    }
    $detalle = 'esperado ' . var_export($esperado, true) . ', obtenido ' . var_export($obtenido, true);
    $fallos[] = "$prueba ($detalle)";
    echo "  [FALLO] $prueba\n          $detalle\n";
}

/** Ejecuta $fn y comprueba que lanza ErrorNegocio con ese mensaje (en el detalle de $campo si se indica). */
function comprobarError(string $prueba, callable $fn, string $mensaje, ?string $campo = null): void
{
    try {
        $fn();
        comprobar($prueba, "ErrorNegocio: $mensaje", 'no se lanzó ningún error');
    } catch (ErrorNegocio $e) {
        $obtenido = $campo === null ? $e->getMessage() : ($e->detalles[$campo] ?? "(sin error en '$campo')");
        comprobar($prueba, $mensaje, $obtenido);
    }
}

/** Líneas ya validadas con los importes en céntimos (lo único que usa calcular()). */
function lineas(int ...$importes): array
{
    return array_map(fn (int $i) => ['importe' => $i], $importes);
}

function linea(string $sku, int $cantidad, string $modo = 'fijo', string $talla = 'M'): array
{
    return ['sku' => $sku, 'cantidad' => $cantidad, 'modo' => $modo, 'talla' => $talla];
}

function stock(string $sku): int
{
    return (int) Db::uno('SELECT stock FROM variantes WHERE sku = ?', [$sku])['stock'];
}

function datosCheckout(array $lineas): array
{
    return [
        'cliente'            => ['nombre' => 'Cliente de Pruebas', 'email' => 'pruebas@ejemplo.test', 'telefono' => '600000999'],
        'direccion'          => ['linea' => 'Calle de las Pruebas 1', 'cp' => '30107', 'ciudad' => 'Murcia', 'provincia' => 'Murcia'],
        'envio'              => 'estandar',
        'acepta_condiciones' => true,
        'lineas'             => $lineas,
    ];
}

// ---------------------------------------------------------------- 1. Totales e IVA

seccion('Totales e IVA (21 % incluido en el precio)');

comprobar('El IVA de la tienda es el 21 %', 21, ReglasNegocio::IVA_PORCENTAJE);

// Los tres pedidos de ejemplo de datos_prueba.sql, calculados a mano en sus comentarios.
$t = ReglasNegocio::calcular(lineas(6900, 4900), '', 'estandar', true);
comprobar('Pedido 69 € + 49 €: subtotal 118,00 €', 11800, $t['subtotal']);
comprobar('Pedido 69 € + 49 €: envío 4,95 €', 495, $t['envio']);
comprobar('Pedido 69 € + 49 €: total 122,95 €', 12295, $t['total']);
comprobar('Pedido 69 € + 49 €: base imponible 101,61 €', 10161, $t['base_imponible']);
comprobar('Pedido 69 € + 49 €: IVA 21,34 €', 2134, $t['iva']);

$t = ReglasNegocio::calcular(lineas(14900), 'NOCHE10', 'estandar', true);
comprobar('Pedido 149 € con NOCHE10: total 134,10 €', 13410, $t['total']);
comprobar('Pedido 149 € con NOCHE10: base 110,83 € e IVA 23,27 €', [11083, 2327], [$t['base_imponible'], $t['iva']]);

$t = ReglasNegocio::calcular(lineas(8900), '', 'expres', true);
comprobar('Pedido 89 € exprés: total 98,95 €', 9895, $t['total']);
comprobar('Pedido 89 € exprés: base 81,78 € e IVA 17,17 €', [8178, 1717], [$t['base_imponible'], $t['iva']]);

// En cualquier pedido: base + IVA = total, y el IVA es el 21 % de la base (con 1 céntimo de margen por redondeo).
$casos = [
    [lineas(1), '', 'estandar'], [lineas(6900), 'BIENVENIDA5', 'estandar'], [lineas(5555), 'NOCHE10', 'expres'],
    [lineas(14900, 15900, 4900), 'NOCHE10', 'estandar'], [lineas(4900), 'PRUEBA50', 'estandar'],
];
$cuadra = true;
foreach ($casos as [$l, $cupon, $envio]) {
    $t = ReglasNegocio::calcular($l, $cupon, $envio, true);
    $cuadra = $cuadra
        && $t['base_imponible'] + $t['iva'] === $t['total']
        && abs((int) round($t['base_imponible'] * 0.21) - $t['iva']) <= 1
        && $t['total'] === $t['subtotal'] - $t['descuento'] + $t['envio'];
}
comprobar('Base + IVA = total = subtotal − descuento + envío en 5 pedidos distintos', true, $cuadra);

$e = ReglasNegocio::aEuros(ReglasNegocio::calcular(lineas(6900, 4900), '', 'estandar', true));
comprobar('aEuros() convierte los céntimos a euros (122,95)', 122.95, $e['total']);

// ---------------------------------------------------------------- 2. Envío

seccion('Envío: estándar 4,95 €, gratis desde 120 € tras descuento; exprés 9,95 € siempre');

$t = ReglasNegocio::calcular(lineas(12000), '', 'estandar', true);
comprobar('Justo 120,00 €: envío estándar gratis', 0, $t['envio']);
comprobar('Justo 120,00 €: no falta nada para el envío gratis', 0, $t['falta_envio_gratis']);

$t = ReglasNegocio::calcular(lineas(11999), '', 'estandar', true);
comprobar('119,99 €: envío estándar 4,95 €', 495, $t['envio']);
comprobar('119,99 €: falta 0,01 € para el envío gratis', 1, $t['falta_envio_gratis']);

$t = ReglasNegocio::calcular(lineas(50000), '', 'expres', true);
comprobar('Exprés con 500 €: sigue costando 9,95 €', 995, $t['envio']);
comprobar('Exprés: no se muestra "te faltan X € para el envío gratis"', 0, $t['falta_envio_gratis']);

$t = ReglasNegocio::calcular(lineas(13000), 'NOCHE10', 'estandar', true);
comprobar('130 € − 10 % = 117 €: el umbral se mira tras el descuento, se paga envío', 495, $t['envio']);

$t = ReglasNegocio::calcular(lineas(12500), 'BIENVENIDA5', 'estandar', true);
comprobar('125 € − 5 € = 120 €: envío gratis', 0, $t['envio']);

$t = ReglasNegocio::calcular(lineas(4900), 'ENVIOGRATIS', 'estandar', true);
comprobar('ENVIOGRATIS con 49 €: envío estándar gratis', 0, $t['envio']);
comprobar('ENVIOGRATIS no descuenta nada del subtotal', 0, $t['descuento']);

$t = ReglasNegocio::calcular(lineas(4900), 'ENVIOGRATIS', 'expres', true);
comprobar('ENVIOGRATIS no hace gratis el exprés', 995, $t['envio']);

comprobarError('Un método de envío desconocido se rechaza',
    fn () => ReglasNegocio::calcular(lineas(4900), '', 'urgente', true), 'Elige un método de envío.', 'envio');

// ---------------------------------------------------------------- 3. Cupones

seccion('Cupones');

$t = ReglasNegocio::calcular(lineas(6900), 'NOCHE10', 'estandar', true);
comprobar('NOCHE10 con 69 €: descuento 6,90 €', 690, $t['descuento']);
comprobar('NOCHE10 con 69 €: total 67,05 € (69 − 6,90 + 4,95)', 6705, $t['total']);
comprobar('El desglose devuelve qué cupón se ha aplicado', 'NOCHE10', $t['cupon']['codigo']);

$t = ReglasNegocio::calcular(lineas(5000), 'NOCHE10', 'estandar', true);
comprobar('NOCHE10 con justo 50 € (el mínimo): se aplica', 500, $t['descuento']);

$t = ReglasNegocio::calcular(lineas(5555), 'NOCHE10', 'estandar', true);
comprobar('NOCHE10 con 55,55 €: el 10 % (5,555 €) se redondea a 5,56 €', 556, $t['descuento']);

$t = ReglasNegocio::calcular(lineas(6900), 'BIENVENIDA5', 'estandar', true);
comprobar('BIENVENIDA5 con 69 €: descuento 5,00 €', 500, $t['descuento']);

$t = ReglasNegocio::calcular(lineas(6900), '  noche10 ', 'estandar', true);
comprobar('El código se acepta en minúsculas y con espacios', 690, $t['descuento']);

$t = ReglasNegocio::calcular(lineas(4900), 'PRUEBA50', 'estandar', true);
comprobar('Un cupón de 50 € en un pedido de 49 € solo descuenta 49 € (nunca total negativo)', [4900, 495], [$t['descuento'], $t['total']]);

$t = ReglasNegocio::calcular(lineas(6900), '', 'estandar', true);
comprobar('Sin cupón: ni descuento ni error', [0, null, null], [$t['descuento'], $t['cupon'], $t['cupon_error']]);

comprobarError('NOCHE10 con 49,99 €: no llega al mínimo',
    fn () => ReglasNegocio::calcular(lineas(4999), 'NOCHE10', 'estandar', true), 'Este cupón requiere un pedido mínimo de 50,00 €.');
comprobarError('BIENVENIDA5 con 29,99 €: no llega al mínimo',
    fn () => ReglasNegocio::calcular(lineas(2999), 'BIENVENIDA5', 'estandar', true), 'Este cupón requiere un pedido mínimo de 30,00 €.');
comprobarError('VERANO25 está desactivado: se rechaza',
    fn () => ReglasNegocio::calcular(lineas(6900), 'VERANO25', 'estandar', true), 'El cupón ha caducado.', 'cupon');
comprobarError('Un cupón que no existe se rechaza',
    fn () => ReglasNegocio::calcular(lineas(6900), 'GRATISTOTAL', 'estandar', true), 'El cupón no existe.', 'cupon');

// Vista previa del checkout (no estricta): el cupón inválido no bloquea, se ignora y se explica.
$t = ReglasNegocio::calcular(lineas(4900), 'NOCHE10', 'estandar', false);
comprobar('Vista previa: un cupón inválido se ignora (sin descuento)', [0, null], [$t['descuento'], $t['cupon']]);
comprobar('Vista previa: se devuelve el motivo para mostrarlo', 'Este cupón requiere un pedido mínimo de 50,00 €.', $t['cupon_error']);
comprobar('Vista previa: el total se calcula igual, sin el cupón', 5395, $t['total']);

// ---------------------------------------------------------------- 4. Stock y validación de líneas

seccion('Stock y validación de las líneas del carrito');

$l = ReglasNegocio::validarLineas([['sku' => 'camiseta-pulso-cian', 'cantidad' => 2, 'modo' => 'fijo', 'talla' => 'L', 'precio' => 0.01]]);
comprobar('El precio sale de la base de datos aunque el navegador envíe otro', 6900, $l[0]['precio']);
comprobar('Importe de la línea = precio × cantidad (2 × 69 €)', 13800, $l[0]['importe']);

$l = ReglasNegocio::validarLineas([linea('mochila-trayecto-rojo', 3, 'parpadeo', 'Única')]);
comprobar('Se pueden comprar justo las unidades que hay en stock (3 de 3)', 3, $l[0]['cantidad']);

comprobarError('Un producto agotado (stock 0) no se puede comprar',
    fn () => ReglasNegocio::validarLineas([linea('chaqueta-perimetro-blanco', 1, 'degradado')]), 'Chaqueta Perímetro · Blanco frío está agotado.', 'lineas.0');
comprobarError('No se pueden pedir más unidades que el stock (4 de 3)',
    fn () => ReglasNegocio::validarLineas([linea('mochila-trayecto-rojo', 4, 'parpadeo', 'Única')]), 'Solo quedan 3 unidades de Mochila Trayecto · Rojo neón.', 'lineas.0');
comprobarError('El stock se suma entre líneas del mismo SKU (2 + 2 de 3)',
    fn () => ReglasNegocio::validarLineas([linea('mochila-trayecto-rojo', 2, 'parpadeo', 'Única'), linea('mochila-trayecto-rojo', 2, 'parpadeo', 'Única')]),
    'Solo quedan 3 unidades de Mochila Trayecto · Rojo neón.', 'lineas.1');
comprobarError('Máximo 9 unidades por línea',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-pulso-cian', 10)]), 'La cantidad debe estar entre 1 y 9.', 'lineas.0');
comprobarError('Cantidad 0 no permitida',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-pulso-cian', 0)]), 'La cantidad debe estar entre 1 y 9.', 'lineas.0');
comprobarError('Un SKU que no existe se rechaza',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-fantasma-negro', 1)]), 'Este producto ya no está disponible.', 'lineas.0');
comprobarError('Un modo de iluminación que el producto no admite se rechaza',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-linea-lima', 1, 'parpadeo')]), 'Explosión refrescante no admite el modo de iluminación elegido.', 'lineas.0');
comprobarError('La Camiseta Pulso (cian) solo admite luz fija',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-pulso-cian', 1, 'parpadeo')]), 'Camiseta Pulso no admite el modo de iluminación elegido.', 'lineas.0');
comprobarError('Onda Vibrante (rosa) solo admite parpadeo',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-pulso-rosa', 1, 'fijo')]), 'Onda Vibrante no admite el modo de iluminación elegido.', 'lineas.0');
$modosPorProducto = Db::todos('SELECT p.nombre, COUNT(pm.modo_id) AS n FROM productos p LEFT JOIN producto_modos pm ON pm.producto_id = p.id GROUP BY p.id, p.nombre HAVING COUNT(pm.modo_id) <> 1');
comprobar('Cada producto tiene exactamente un modo de iluminación', [], array_column($modosPorProducto, 'nombre'));
comprobarError('Una mochila no tiene tallas de ropa',
    fn () => ReglasNegocio::validarLineas([linea('mochila-halo-cian', 1, 'fijo', 'M')]), 'Talla no válida para Mochila Halo.', 'lineas.0');
comprobarError('Una camiseta no tiene talla única',
    fn () => ReglasNegocio::validarLineas([linea('camiseta-pulso-rosa', 1, 'parpadeo', 'Única')]), 'Talla no válida para Onda Vibrante.', 'lineas.0');
comprobarError('El carrito vacío no se puede comprar',
    fn () => ReglasNegocio::validarLineas([]), 'El carrito está vacío.');
comprobarError('Más de 20 líneas en el carrito se rechaza',
    fn () => ReglasNegocio::validarLineas(array_fill(0, 21, linea('camiseta-pulso-cian', 1))), 'El carrito tiene demasiadas líneas.');

try {
    ReglasNegocio::validarLineas([linea('chaqueta-perimetro-blanco', 1, 'degradado'), linea('camiseta-pulso-cian', 1), linea('mochila-halo-cian', 1, 'fijo', 'XL')]);
    comprobar('Se informa de todas las líneas con error a la vez', ['lineas.0', 'lineas.2'], 'no se lanzó ningún error');
} catch (ErrorNegocio $e) {
    comprobar('Se informa de todas las líneas con error a la vez', ['lineas.0', 'lineas.2'], array_keys($e->detalles));
}

// El stock real se descuenta al crear el pedido y se devuelve si se cancela.
$antes = stock('gorra-faro-violeta');
$pedido = Pedidos::crear(datosCheckout([linea('gorra-faro-violeta', 3, 'fijo', 'Única')]));
comprobar('Al crear el pedido se descuenta el stock (4 → 1)', $antes - 3, stock('gorra-faro-violeta'));
comprobar('El total guardado es el calculado (3 × 59 € = 177 €, envío gratis)', 177.0, $pedido['total']);

comprobarError('Después, ya no se pueden comprar 2 de las que solo queda 1',
    fn () => Pedidos::crear(datosCheckout([linea('gorra-faro-violeta', 2, 'fijo', 'Única')])), 'Solo quedan 1 unidades de Gorra Faro · Violeta.', 'lineas.0');

$fila = Db::uno('SELECT * FROM pedidos WHERE codigo = ?', [$pedido['codigo']]);
Db::transaccion(fn () => Pedidos::cambiarEstado($fila, 'cancelado', 'Prueba automática', 'sistema'));
comprobar('Al cancelar el pedido se devuelve el stock (1 → 4)', $antes, stock('gorra-faro-violeta'));

// ---------------------------------------------------------------- Resumen

$total = $aciertos + count($fallos);
echo "\n" . str_repeat('-', 60) . "\n";
if ($fallos) {
    echo "FALLAN " . count($fallos) . " de $total pruebas:\n";
    foreach ($fallos as $f) {
        echo "  - $f\n";
    }
    exit(1);
}
echo "Todas las pruebas pasan: $total de $total.\n";
exit(0);
