<?php
declare(strict_types=1);

/**
 * Facturas de los pedidos pagados: numeración correlativa por año, documento HTML y envío por correo.
 * La factura se EMITE dentro de la transacción del pago (si el pago se deshace, la factura también),
 * y se ENVÍA después, cuando el pago ya está guardado: un fallo del correo no puede deshacer un cobro.
 */
final class Facturas
{
    /** Datos del emisor. Son ficticios: NOCTILUZ no es una empresa real. */
    public const EMISOR = [
        'nombre'    => 'NOCTILUZ Moda Luminosa, S.L. (empresa ficticia)',
        'nif'       => 'B00000000 (ficticio)',
        'direccion' => 'Calle de la Luz 1, 30001 Murcia',
    ];

    /** Crea la factura del pedido si aún no existe. Debe llamarse dentro de la transacción del pago. */
    public static function emitir(int $pedidoId, string $email): string
    {
        $existente = Db::uno('SELECT numero FROM facturas WHERE pedido_id = ?', [$pedidoId]);
        if ($existente !== null) {
            return $existente['numero'];
        }
        $prefijo = 'F' . date('Y') . '-';
        $ultima = Db::uno('SELECT numero FROM facturas WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1', [$prefijo . '%']);
        $siguiente = $ultima === null ? 1 : (int) substr($ultima['numero'], strlen($prefijo)) + 1;
        $numero = $prefijo . str_pad((string) $siguiente, 6, '0', STR_PAD_LEFT);
        Db::insertar(
            'INSERT INTO facturas (pedido_id, numero, emitida_en, email_destino, estado_envio) VALUES (?, ?, ?, ?, ?)',
            [$pedidoId, $numero, ahora(), $email, 'pendiente']
        );
        return $numero;
    }

    /**
     * Envía por correo la factura del pedido y guarda el resultado (enviada / error) junto con un evento
     * invoice.sent. Devuelve el estado final del envío.
     */
    public static function enviar(string $codigo): string
    {
        $p = Pedidos::detalle($codigo);
        $f = $p === null ? null : Db::uno('SELECT * FROM facturas WHERE pedido_id = ?', [(int) $p['id']]);
        if ($f === null) {
            throw new ErrorNegocio('Este pedido no tiene factura.', [], 404);
        }

        $modo = (string) config('correo.modo', 'desactivado');
        $error = null;
        try {
            $error = self::mandarCorreo($modo, $p, $f);
        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
        $estado = $error === null ? 'enviada' : 'error';

        Db::ejecutar(
            'UPDATE facturas SET estado_envio = ?, enviada_en = ?, error_envio = ? WHERE id = ?',
            [$estado, $error === null ? ahora() : null, $error === null ? null : mb_substr($error, 0, 200), $f['id']]
        );
        Eventos::registrar('invoice.sent', [
            'codigo' => $codigo, 'factura' => $f['numero'], 'resultado' => $estado, 'modo' => $modo, 'error' => $error,
        ], 'servidor', $p['sesion_id'] ?? null, (int) $p['cliente_id'], (int) $p['id']);
        return $estado;
    }

    /** Devuelve null si el correo ha salido, o el motivo del fallo. */
    private static function mandarCorreo(string $modo, array $p, array $f): ?string
    {
        if ($modo === 'desactivado') {
            return 'El envío de correo está desactivado en config.php.';
        }
        $remitente = (string) config('correo.remitente', '');
        if (!filter_var($remitente, FILTER_VALIDATE_EMAIL)) {
            return 'Falta un remitente válido en config.php (correo.remitente).';
        }

        $limite = 'noctiluz-' . bin2hex(random_bytes(8));
        // Asunto y nombre en una sola línea (RFC 2047): mail() no admite cabeceras partidas en varias líneas.
        $mime = fn (string $t) => '=?UTF-8?B?' . base64_encode($t) . '?=';
        $asunto = $mime("Factura {$f['numero']} · Pedido {$p['codigo']} · NOCTILUZ (prototipo)");
        $cabeceras = [
            'From: ' . $mime('NOCTILUZ (prototipo)') . " <$remitente>",
            "Reply-To: $remitente",
            'MIME-Version: 1.0',
            "Content-Type: multipart/alternative; boundary=\"$limite\"",
        ];
        $copia = (string) config('correo.copia_oculta', '');
        if (filter_var($copia, FILTER_VALIDATE_EMAIL)) {
            $cabeceras[] = "Bcc: $copia";
        }
        $cuerpo = "--$limite\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode(self::texto($p, $f))) . "\r\n"
            . "--$limite\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode(self::html($p, $f))) . "\r\n--$limite--\r\n";

        if ($modo === 'archivo') {
            $carpeta = dirname(__DIR__) . '/datos/correos';
            if (!is_dir($carpeta) && !mkdir($carpeta, 0775, true)) {
                return "No se puede crear la carpeta $carpeta.";
            }
            $eml = "To: {$f['email_destino']}\r\nSubject: $asunto\r\nDate: " . date(DATE_RFC2822) . "\r\n"
                . implode("\r\n", $cabeceras) . "\r\n\r\n" . $cuerpo;
            return file_put_contents("$carpeta/{$f['numero']}.eml", $eml) === false ? 'No se pudo guardar el correo.' : null;
        }
        if ($modo === 'mail') {
            $ok = mail($f['email_destino'], $asunto, $cuerpo, implode("\r\n", $cabeceras), '-f' . $remitente);
            return $ok ? null : 'El servidor de correo del hosting no ha aceptado el mensaje.';
        }
        return "Modo de correo desconocido: $modo.";
    }

    /** Factura del pedido para su cliente (el email debe coincidir) o para el back-office ($email = null). */
    public static function documento(string $codigo, ?string $email): ?string
    {
        $p = Pedidos::detalle($codigo);
        if ($p === null || ($email !== null && mb_strtolower($p['cliente_email']) !== mb_strtolower(trim($email)))) {
            return null;
        }
        $f = Db::uno('SELECT * FROM facturas WHERE pedido_id = ?', [(int) $p['id']]);
        return $f === null ? null : self::html($p, $f);
    }

    public static function html(array $p, array $f): string
    {
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $eur = fn ($v) => number_format((float) $v, 2, ',', '.') . ' €';
        $lineas = '';
        foreach ($p['lineas'] as $l) {
            $lineas .= "<tr><td>{$e($l['descripcion'])}<br><small>{$e($l['modo_nombre'])} · Talla {$e($l['talla'])}</small></td>"
                . "<td class=\"n\">{$e($l['cantidad'])}</td><td class=\"n\">{$eur($l['precio_unitario'])}</td><td class=\"n\">{$eur($l['importe'])}</td></tr>";
        }
        $descuento = (float) $p['descuento'] > 0
            ? "<tr><td colspan=\"3\">Descuento" . ($p['cupon_codigo'] ? " ({$e($p['cupon_codigo'])})" : '') . "</td><td class=\"n\">−{$eur($p['descuento'])}</td></tr>" : '';
        $emisor = self::EMISOR;
        $pago = $p['pagos'] ? end($p['pagos']) : null;
        $metodoPago = $pago === null ? '—' : ($pago['metodo'] === 'paypal_sandbox' ? 'PayPal (entorno sandbox)' : 'Tarjeta de prueba •••• ' . $pago['tarjeta_ultimos4']);

        return <<<HTML
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Factura {$e($f['numero'])} · NOCTILUZ</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1b1b1f;max-width:720px;margin:24px auto;padding:0 16px;font-size:14px}
  h1{font-size:22px;margin:0 0 4px} .aviso{background:#fff4d6;border:1px solid #e8c766;padding:8px 12px;border-radius:6px;margin:12px 0 20px}
  .dos{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px} .dos div{flex:1;min-width:220px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left;vertical-align:top}
  th{background:#f3f3f5} .n{text-align:right;white-space:nowrap} small{color:#666} .total td{font-weight:bold;font-size:16px}
</style></head><body>
<h1>Factura {$e($f['numero'])}</h1>
<div>Fecha de emisión: {$e(date('d/m/Y', strtotime($f['emitida_en'])))} · Pedido <strong>{$e($p['codigo'])}</strong></div>
<div class="aviso"><strong>Prototipo académico (UCAM).</strong> Documento de ejemplo sin validez fiscal: no se ha cobrado nada ni se enviará ningún producto.</div>
<div class="dos">
  <div><strong>Emisor</strong><br>{$e($emisor['nombre'])}<br>NIF {$e($emisor['nif'])}<br>{$e($emisor['direccion'])}</div>
  <div><strong>Cliente</strong><br>{$e($p['cliente_nombre'])}<br>{$e($p['cliente_email'])}<br>{$e($p['dir_linea'])}<br>{$e($p['dir_cp'])} {$e($p['dir_ciudad'])} ({$e($p['dir_provincia'])})</div>
</div>
<table>
  <thead><tr><th>Concepto</th><th class="n">Ud.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead>
  <tbody>
    $lineas
    <tr><td colspan="3">Subtotal</td><td class="n">{$eur($p['subtotal'])}</td></tr>
    $descuento
    <tr><td colspan="3">Envío · {$e($p['metodo_envio_nombre'])}</td><td class="n">{$eur($p['envio'])}</td></tr>
    <tr><td colspan="3">Base imponible</td><td class="n">{$eur($p['base_imponible'])}</td></tr>
    <tr><td colspan="3">IVA ({$e(ReglasNegocio::IVA_PORCENTAJE)} %)</td><td class="n">{$eur($p['iva'])}</td></tr>
    <tr class="total"><td colspan="3">Total</td><td class="n">{$eur($p['total'])}</td></tr>
  </tbody>
</table>
<p><small>Precios con IVA incluido. Forma de pago: {$e($metodoPago)}.</small></p>
</body></html>
HTML;
    }

    private static function texto(array $p, array $f): string
    {
        $eur = fn ($v) => number_format((float) $v, 2, ',', '.') . ' €';
        $t = "NOCTILUZ · Factura {$f['numero']} · Pedido {$p['codigo']}\n"
            . "PROTOTIPO ACADÉMICO (UCAM): documento de ejemplo sin validez fiscal. No se ha cobrado nada.\n\n"
            . "Cliente: {$p['cliente_nombre']} <{$p['cliente_email']}>\n\n";
        foreach ($p['lineas'] as $l) {
            $t .= "- {$l['cantidad']} × {$l['descripcion']} ({$l['talla']}): {$eur($l['importe'])}\n";
        }
        return $t . "\nEnvío: {$eur($p['envio'])}\nBase imponible: {$eur($p['base_imponible'])}\n"
            . 'IVA (' . ReglasNegocio::IVA_PORCENTAJE . " %): {$eur($p['iva'])}\nTOTAL: {$eur($p['total'])}\n\n"
            . "La factura completa va en la versión HTML de este correo.\n";
    }
}
