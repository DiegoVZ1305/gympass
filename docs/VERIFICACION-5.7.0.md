# Verificación 5.7.0

La web y la interfaz incluida en Android y Windows se construyeron desde las fuentes actuales y declaran la versión 5.7.0.

Android: APK firmado, paquete `local.gympass.controlacceso.mobile`, código 5700, versión 5.7.0 y certificado SHA-256 `a6735a9d424cb835fac4e5ca05f08df8cd9bd9007bdb8cf32f4fa42492187ded`. No había un emulador o dispositivo ADB conectado para la prueba de arranque.

Windows: instalador x64 generado con Electron 45.0.0; declara 5.7.0. La distribución conserva la política anterior y no incluye firma de código de Windows. El portable no forma parte de esta entrega.

Las huellas y tamaños de los dos binarios publicados figuran en `client-releases/5.7.0.json` y `client-releases/GymPASS-5.7.0-SHA256.txt`.
