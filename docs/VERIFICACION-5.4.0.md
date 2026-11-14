# Verificación 5.4.0

Se comprobaron tipos, compilación reproducible y retención de la web 5.3.2. Pasaron 70 comprobaciones del servidor, 126 pruebas web, 618 pruebas del cliente Windows y 76 pruebas Android.

Las pruebas cubren fecha obligatoria, último día incluido según la zona horaria, agotamiento anticipado, salida después del vencimiento, sesiones restantes sin acceso al vencer, compra de otro plan y reintentos sin duplicar cobros. Una copia desconectada rechazó un paquete vencido y sincronizó su renovación conservando las sesiones históricas. La migración conserva personas, planes, cobros y QR.

En Chromium se registró un socio sin fotografía, se cobró un paquete de 15 sesiones con fecha límite elegida y se abrió su credencial con el nombre del plan. La tarjeta generada no contiene fotografías y mantiene su código. Las pruebas de voz comprueban rechazo con nombre, cancelación de avisos, voz nativa sin Web Speech y alternativa tras 250 ms sin reproducir después el audio tardío.

Android 17, con páginas de 16 KiB: APK instalado en emulador, dos arranques en frío con gestión local y sin errores de ejecución. El motor nativo se conectó a TextToSpeech. Se verificaron paquete, versión 5.4.0, código 5400 y el mismo certificado de 5.3.0. No se probó en un teléfono físico.

Windows x64: arranque y cierre limpios del ejecutable empaquetado y del portable usando directorios de prueba separados; ambos respondieron a `/api/health`. El runtime empaquetado ejecutó los trabajadores para crear y verificar un respaldo con esquema 26. Se verificó la versión del instalador; se conserva la distribución sin firma de código. Las 155 fuentes compartidas coinciden entre web y clientes, y el servicio incluido en el APK coincide con la fuente final.

Los archivos de entrega y sus huellas están registrados en `client-releases/5.4.0.json` y `client-releases/GymPASS-5.4.0-SHA256.txt`. El código nativo está en `client-releases/5.4.0-native.patch`, comprobado mediante `git apply --check` contra las fuentes anteriores.
