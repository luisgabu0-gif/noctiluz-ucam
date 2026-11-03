<?php
declare(strict_types=1);

/**
 * Reglas de negocio de la tienda. Todos los importes se calculan en céntimos (enteros)
 * para evitar errores de redondeo con decimales.
 */
final class ReglasNegocio
{
    public const IVA_PORCENTAJE      = 21;       // Precios de catálogo con IVA incluido
    public const ENVIO_ESTANDAR      = 495;      // Tarifas de la Península (zona por defecto): ver ZONAS_ENVIO
    public const ENVIO_EXPRES        = 995;
    public const UMBRAL_ENVIO_GRATIS = 12000;
    public const MAX_UNIDADES_LINEA  = 9;
    public const MAX_LINEAS          = 20;
    public const TALLAS              = ['XS', 'S', 'M', 'L', 'XL'];
    public const TALLA_UNICA         = 'Única';
    public const METODOS_ENVIO       = ['estandar' => 'Estándar', 'expres' => 'Exprés'];

    /**
     * Política de portes por zona (importes en céntimos, IVA incluido). El estándar es gratis desde
     * 'gratis_desde' (tras descuento) o con el cupón de envío; el exprés nunca es gratis.
     */
    public const ZONAS_ENVIO = [
        'peninsula' => [
            'nombre' => 'Península', 'gratis_desde' => 12000,
            'estandar' => ['precio' => 495, 'plazo' => '48-72 h'],
            'expres'   => ['precio' => 995, 'plazo' => '24 h'],
        ],
        'baleares' => [
            'nombre' => 'Islas Baleares', 'gratis_desde' => 18000,
            'estandar' => ['precio' => 895, 'plazo' => '3-5 días laborables'],
            'expres'   => ['precio' => 1695, 'plazo' => '48 h'],
        ],
    ];

    /**
     * Canarias (35, 38), Ceuta (51) y Melilla (52) quedan fuera del territorio del IVA (allí rigen el IGIC
     * y el IPSI), así que la tienda, que trabaja con precios con IVA incluido, no envía a esas zonas.
     */
    public const PREFIJOS_SIN_ENVIO = ['35' => 'Canarias', '38' => 'Canarias', '51' => 'Ceuta', '52' => 'Melilla'];

    /** Zona de envío de un código postal; un código vacío (vista previa sin dirección) cuenta como Península. */
    public static function zonaEnvio(string $cp): string
    {
        $prefijo = substr(trim($cp), 0, 2);
        if (isset(self::PREFIJOS_SIN_ENVIO[$prefijo])) {
            $msg = 'De momento no enviamos a ' . self::PREFIJOS_SIN_ENVIO[$prefijo] . ': allí no se aplica el IVA, sino otro impuesto.';
            throw new ErrorNegocio($msg, ['cp' => $msg]);
        }
        return $prefijo === '07' ? 'baleares' : 'peninsula';
    }

    public const ESTADOS = [
        'creado'         => 'Creado (pendiente de pago)',
        'pagado'         => 'Pagado (simulado)',
        'en_preparacion' => 'Pendiente de preparación',
        'enviado'        => 'Enviado',
        'entregado'      => 'Entregado',
        'incidencia'     => 'Con incidencia',
        'cancelado'      => 'Cancelado',
    ];

    /** Máquina de estados del pedido: desde cada estado, a cuáles se puede pasar. */
    public const TRANSICIONES = [
        'creado'         => ['pagado', 'cancelado'],
        'pagado'         => ['en_preparacion', 'enviado', 'entregado', 'incidencia', 'cancelado'],
        'en_preparacion' => ['enviado', 'entregado', 'incidencia', 'cancelado'],
        'enviado'        => ['entregado', 'incidencia'],
        'entregado'      => ['incidencia'],
        'incidencia'     => ['en_preparacion', 'enviado', 'entregado', 'cancelado'],
        'cancelado'      => [],
    ];

    /** "pagado" solo lo puede poner la pasarela de pago simulada, nunca el back-office a mano. */
    public const ESTADOS_SOLO_SISTEMA = ['pagado'];

    public static function puedeTransicionar(string $desde, string $hacia): bool
    {
        return in_array($hacia, self::TRANSICIONES[$desde] ?? [], true);
    }

    /**
     * Comprueba cada línea contra la base de datos (existencia, modo, talla, cantidad y stock)
     * y devuelve las líneas con el precio oficial.
     */
    public static function validarLineas($lineas): array
    {
        if (!is_array($lineas) || count($lineas) === 0) {
            throw new ErrorNegocio('El carrito está vacío.');
        }
        if (count($lineas) > self::MAX_LINEAS) {
            throw new ErrorNegocio('El carrito tiene demasiadas líneas.');
        }

        $errores = [];
        $resultado = [];
        $unidadesPorSku = [];

        foreach (array_values($lineas) as $i => $l) {
            $campo = "lineas.$i";
            $sku = is_array($l) && is_string($l['sku'] ?? null) ? $l['sku'] : '';
            $v = $sku !== '' ? Catalogo::variante($sku) : null;
            if ($v === null) {
                $errores[$campo] = 'Este producto ya no está disponible.';
                continue;
            }
            $cantidad = filter_var($l['cantidad'] ?? null, FILTER_VALIDATE_INT);
            if ($cantidad === false || $cantidad < 1 || $cantidad > self::MAX_UNIDADES_LINEA) {
                $errores[$campo] = 'La cantidad debe estar entre 1 y ' . self::MAX_UNIDADES_LINEA . '.';
                continue;
            }
            $modo = (string) ($l['modo'] ?? '');
            if (!in_array($modo, $v['modos'], true)) {
                $errores[$campo] = "{$v['nombre']} no admite el modo de iluminación elegido.";
                continue;
            }
            $talla = (string) ($l['talla'] ?? '');
            $tallasValidas = $v['tiene_tallas'] ? self::TALLAS : [self::TALLA_UNICA];
            if (!in_array($talla, $tallasValidas, true)) {
                $errores[$campo] = "Talla no válida para {$v['nombre']}.";
                continue;
            }

            $unidadesPorSku[$sku] = ($unidadesPorSku[$sku] ?? 0) + $cantidad;
            if ($unidadesPorSku[$sku] > (int) $v['stock']) {
                $errores[$campo] = (int) $v['stock'] === 0
                    ? "{$v['nombre']} · {$v['color_nombre']} está agotado."
                    : "Solo quedan {$v['stock']} unidades de {$v['nombre']} · {$v['color_nombre']}.";
                continue;
            }

            $precio = centimos($v['precio']);
            $resultado[] = [
                'variante_id' => (int) $v['variante_id'],
                'sku'         => $sku,
                'descripcion' => "{$v['nombre']} · {$v['color_nombre']}",
                'modo'        => $modo,
                'talla'       => $talla,
                'cantidad'    => $cantidad,
                'precio'      => $precio,
                'importe'     => $precio * $cantidad,
            ];
        }

        if ($errores) {
            throw new ErrorNegocio('Hay productos del carrito que no se pueden comprar.', $errores);
        }
        return $resultado;
    }

    /** Devuelve el cupón si existe, está activo y se cumple el mínimo; si no, lanza ErrorNegocio. */
    public static function cuponAplicable(string $codigo, int $subtotal): array
    {
        $cupon = Db::uno('SELECT * FROM cupones WHERE codigo = ?', [mb_strtoupper(trim($codigo))]);
        if ($cupon === null) {
            throw new ErrorNegocio('El cupón no existe.', ['cupon' => 'El cupón no existe.']);
        }
        if (!(int) $cupon['activo']) {
            throw new ErrorNegocio('El cupón ha caducado.', ['cupon' => 'El cupón ha caducado.']);
        }
        if ($subtotal < centimos($cupon['minimo'])) {
            $msg = 'Este cupón requiere un pedido mínimo de ' . number_format((float) $cupon['minimo'], 2, ',', '.') . ' €.';
            throw new ErrorNegocio($msg, ['cupon' => $msg]);
        }
        return $cupon;
    }

    /**
     * Calcula el desglose completo. Si $estricto es false (vista previa del checkout),
     * un cupón no válido no bloquea: se ignora y se devuelve el motivo en 'cupon_error'.
     * Los portes dependen de la zona del código postal ($cp vacío = Península).
     */
    public static function calcular(array $lineas, string $cuponCodigo, string $metodoEnvio, bool $estricto, string $cp = ''): array
    {
        if (!array_key_exists($metodoEnvio, self::METODOS_ENVIO)) {
            throw new ErrorNegocio('Método de envío no válido.', ['envio' => 'Elige un método de envío.']);
        }
        $zonaId = self::zonaEnvio($cp);
        $zona = self::ZONAS_ENVIO[$zonaId];

        $subtotal = array_sum(array_column($lineas, 'importe'));

        $cupon = null;
        $cuponError = null;
        if (trim($cuponCodigo) !== '') {
            try {
                $cupon = self::cuponAplicable($cuponCodigo, $subtotal);
            } catch (ErrorNegocio $e) {
                if ($estricto) {
                    throw $e;
                }
                $cuponError = $e->getMessage();
            }
        }

        $descuento = 0;
        if ($cupon !== null && $cupon['tipo'] === 'porcentaje') {
            $descuento = (int) round($subtotal * (float) $cupon['valor'] / 100);
        } elseif ($cupon !== null && $cupon['tipo'] === 'importe') {
            $descuento = min(centimos($cupon['valor']), $subtotal);
        }

        if ($metodoEnvio === 'expres') {
            $envio = $zona['expres']['precio'];
        } elseif (($cupon !== null && $cupon['tipo'] === 'envio') || ($subtotal - $descuento) >= $zona['gratis_desde']) {
            $envio = 0;
        } else {
            $envio = $zona['estandar']['precio'];
        }

        $total = $subtotal - $descuento + $envio;
        $base = (int) round($total * 100 / (100 + self::IVA_PORCENTAJE));

        return [
            'subtotal'       => $subtotal,
            'descuento'      => $descuento,
            'envio'          => $envio,
            'base_imponible' => $base,
            'iva'            => $total - $base,
            'total'          => $total,
            'cupon'          => $cupon !== null ? ['codigo' => $cupon['codigo'], 'descripcion' => $cupon['descripcion']] : null,
            'cupon_error'    => $cuponError,
            'metodo_envio'   => $metodoEnvio,
            'zona'           => ['id' => $zonaId, 'nombre' => $zona['nombre'], 'plazo' => $zona[$metodoEnvio]['plazo']],
            'tarifas'        => self::tarifasZona($zonaId),
            'falta_envio_gratis' => $metodoEnvio === 'estandar' && $envio > 0
                ? $zona['gratis_desde'] - ($subtotal - $descuento) : 0,
        ];
    }

    /** Tarifas de una zona en euros, para mostrarlas en el checkout y en la página de envíos. */
    public static function tarifasZona(string $zonaId): array
    {
        $z = self::ZONAS_ENVIO[$zonaId];
        return [
            'gratis_desde' => euros($z['gratis_desde']),
            'estandar'     => ['precio' => euros($z['estandar']['precio']), 'plazo' => $z['estandar']['plazo']],
            'expres'       => ['precio' => euros($z['expres']['precio']), 'plazo' => $z['expres']['plazo']],
        ];
    }

    /** Convierte un desglose en céntimos a euros para enviarlo como JSON. */
    public static function aEuros(array $totales): array
    {
        foreach (['subtotal', 'descuento', 'envio', 'base_imponible', 'iva', 'total', 'falta_envio_gratis'] as $k) {
            $totales[$k] = euros($totales[$k]);
        }
        return $totales;
    }
}
