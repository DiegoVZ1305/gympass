# Verificación 5.5.0

Tipos y compilación web reproducible, con retención de 5.4.0. Pasaron 72 comprobaciones del servidor, 131 pruebas web, 629 pruebas Windows y 76 pruebas Android.

Los planes guardan cantidad de sesiones y plazo por separado. Se comprobaron plazos en días y meses, cálculo al cobrar sin introducir una fecha manual, conservación de paquetes ya vendidos y rechazo de un catálogo que cambió antes de confirmar. Las copias sin conexión conservan un plan de dos meses y sincronizan su compra con la fecha calculada. Las ediciones de clientes anteriores conservan el plazo central y el esquema compatible omite las columnas nuevas.

Chromium: creación y guardado de un plan de 20 sesiones en dos meses; selección de exactamente tres avisos y reproducción de pruebas de beep correcto y denegado. El catálogo se comprobó a 1440 × 900 y a 390 × 844: crece con sus tarjetas, sin desplazamiento interno vertical ni desbordamiento horizontal en móvil. Las pruebas de voz comprueban nombre y rechazo, migración de preferencias anteriores y ausencia de carga de modelos.

Windows: ejecutable empaquetado y portable respondieron a `/api/health` y cerraron sin errores en directorios de prueba aislados. El runtime creó y verificó un respaldo en un trabajador con esquema 27. Se comprobó la versión del instalador y se mantiene la política de firma anterior.

Android 17 con páginas de 16 KiB: paquete y certificado conservados, versión 5.5.0 y código 5500. El APK pasó dos arranques en frío con gestión local sobre la copia existente. Se comprobaron las 156 fuentes compartidas y el servicio incluido en el APK frente a la fuente final. No se probó en un teléfono físico.

Las huellas y tamaños publicados se registran en `client-releases/5.5.0.json` y `client-releases/GymPASS-5.5.0-SHA256.txt`. El parche nativo se comprobó con `git apply --check` sobre las fuentes 5.4.0 conservadas antes de la actualización.
