# Verificación 5.5.3

Web: compilación y tipos correctos; 75 comprobaciones de servidor y 139 pruebas web aprobadas. Móvil: 76 pruebas y comprobación de tipos aprobadas. Se conserva la interfaz web 5.5.2 para las sesiones abiertas.

Android: APK con versión 5.5.3, código 5530 y paquete `local.gympass.controlacceso.mobile`. Firma verificada con el certificado existente `a6735a9d424cb835fac4e5ca05f08df8cd9bd9007bdb8cf32f4fa42492187ded`. La prueba de arranque del APK con SHA-256 `0db1e23243b6ed0bfe06e41416f8dc14194c59800619106d7ba26d65e7b5d177` confirmó dos arranques en frío hasta la gestión local en Android 17 con páginas de 16 KiB. No se probó en teléfono físico.

Windows: compilación local completada para x64 con Electron 45.0.0. Se comprobó el arranque del ejecutable empaquetado y del portable en perfiles de prueba independientes, respuesta de salud correcta y cierre con código cero. El instalador declara versión de producto y archivo 5.5.3. Distribución sin firma de código.

Los tamaños y SHA-256 de APK, instalador y portable constan en `client-releases/5.5.3.json`. Los botones de descarga de la página apuntan a la entrega GitHub `v5.5.3`.
