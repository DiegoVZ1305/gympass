# Verificación 5.5.4

La web y la interfaz incluida en los clientes envían `work=local` de forma explícita para que una copia local de escritorio no vuelva al servidor al reiniciar.

Windows x64 se compiló con Electron 45.0.0 y generó instalador y portable sin firma de código. El APK Android se compiló con código 5540 y conserva el certificado SHA-256 `a6735a9d424cb835fac4e5ca05f08df8cd9bd9007bdb8cf32f4fa42492187ded`.

Las pruebas de la aplicación pasaron. No se ejecutó la prueba de dos arranques Android porque no había un emulador o dispositivo ADB conectado.
