# Verificación 5.8.0

La web y la interfaz incluida en Android y Windows se construyeron desde las fuentes actuales y declaran la versión 5.8.0.

Android: APK firmado, paquete `local.gympass.controlacceso.mobile`, código 5800, versión 5.8.0 y certificado SHA-256 `a6735a9d424cb835fac4e5ca05f08df8cd9bd9007bdb8cf32f4fa42492187ded`, el mismo de 5.7.0, así que la actualización se instala sobre la aplicación existente. El APK está alineado para páginas de 16 KB. No había un emulador o dispositivo ADB conectado para la prueba de arranque.

Windows: instalador x64 generado con Electron 45.0.0; el ejecutable declara 5.8.0 en sus propiedades. La distribución conserva la política anterior y no incluye firma de código de Windows. El portable no forma parte de esta entrega.

Las huellas y tamaños de los dos binarios publicados figuran en `client-releases/5.8.0.json` y `client-releases/GymPASS-5.8.0-SHA256.txt`.
