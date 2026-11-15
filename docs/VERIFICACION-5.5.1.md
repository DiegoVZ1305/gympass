# Verificación 5.5.1

Pasaron 75 comprobaciones del servidor, 133 pruebas web, 631 pruebas Windows y 76 pruebas Android. La compilación web conserva los recursos publicados de 5.5.0.

El cierre diario se activa a las 23:59 tanto al migrar gimnasios existentes como al crear uno. Se comprobó el límite exacto en la zona horaria del gimnasio, el cierre de todos los presentes, la conservación de salidas reales, la recuperación tras varios días apagado, la entrada del siguiente día y la ausencia de consumos adicionales de sesiones. El mantenimiento se ejecuta periódicamente; una salida recuperada conserva la hora estimada de cierre correspondiente.

La copia Android ejecuta el mantenimiento desde su temporizador sin necesitar nuevas lecturas ni Internet, con autorización vigente. La salida se guarda una sola vez, no descuenta sesiones y queda pendiente para sincronizar. Se conservan los controles de revocación, reloj y conflictos.

Chromium: WhatsApp junto a la campana, dos destinos y nombres correctos, mensaje con versión, cierre con Escape y recuperación del foco. Diálogo a 1440, 390 y 320 píxeles; cabecera con estado largo de copia sin conexión a 850, 412, 390, 360 y 320 píxeles, sin controles fuera de pantalla. Configuración con cierre a las 23:59.

Windows: arranque del ejecutable empaquetado y portable en directorios de prueba aislados, respuesta correcta de salud y cierre limpio. El runtime creó y verificó un respaldo mediante trabajador con esquema 28. Instalador con versión 5.5.1; se conserva la distribución sin firma de código.

Android 17 con páginas de 16 KiB: APK firmado con el certificado anterior y código 5510, dos arranques en frío hasta la gestión local y diálogo de soporte con Diego Vargas y Mateo Bazoberry. La comprobación elimina el XML anterior antes de cada captura para evitar aceptar una pantalla obsoleta si UI Automator falla. No se probó en un teléfono físico.

Se compararon 158 fuentes compartidas, el servicio y la copia local incluidos en el mapa del paquete Android, la interfaz incorporada al APK y los recursos del runtime Windows con sus archivos finales. El parche nativo se comprobó sobre las fuentes 5.5.0 conservadas antes de actualizar. Las huellas de los archivos publicados figuran en `client-releases/5.5.1.json` y `client-releases/GymPASS-5.5.1-SHA256.txt`.
