# MonMon Café · Frontend

Interfaz web (React + Vite + Tailwind) del sistema de la cafetería. La misma app se empaqueta como APK de Android con [Capacitor](https://capacitorjs.com).

## Desarrollo web

```bash
npm install
npm run dev        # http://localhost:5173
```

La URL del backend sale de `VITE_API_URL` (por defecto `http://localhost:3001/api`) y se puede cambiar en la pantalla de inicio de sesión, en el enlace **Servidor** debajo de la contraseña. El valor se guarda en el dispositivo.

## App Android

La app Android es el mismo frontend dentro de un WebView. No trae el backend: se conecta al backend que corre en la PC, a través del Wi-Fi del local.

### 1. Preparar la PC donde corre el backend

1. **IP fija de la PC.** Busca la IP con `ipconfig` (por ejemplo `192.168.1.50`). Conviene reservarla en el router para que no cambie.
2. **Permitir a la app en CORS.** La app Android se presenta con el origen `http://localhost`, así que en el `.env` del backend agrégalo a `FRONTEND_URL`, separado por coma:
   ```env
   FRONTEND_URL=http://localhost:5173,http://localhost
   ```
   Reinicia el backend después de cambiarlo.
3. **Abrir el puerto 3001 en el firewall de Windows** (PowerShell como administrador, solo redes privadas):
   ```powershell
   New-NetFirewallRule -DisplayName "MonMon backend" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```
   La red Wi-Fi debe estar marcada como **Privada** en Windows.
4. Comprueba desde el navegador del celular que abre `http://192.168.1.50:3001/api`.

### 2. Obtener el APK

**Opción A, desde GitHub (sin instalar nada).** Las versiones publicadas están en [Releases](https://github.com/Airdel/monmoncafe_frontend/releases/latest): abre la página desde el celular y descarga `monmoncafe-vX.Y.Z.apk` (sin zip y sin iniciar sesión). Lo que trae cada versión está en [CHANGELOG.md](CHANGELOG.md).

Además, cada push y PR corre el job `android` del CI y deja un APK de prueba como artefacto `monmoncafe-vX.Y.Z+<corrida>` (pestaña *Actions* → la corrida → *Artifacts*; baja como zip y pide sesión de GitHub).

**Opción B, compilarlo en la PC.** Requiere [Android Studio](https://developer.android.com/studio) (trae el SDK) y JDK 21 (`JAVA_HOME` apuntando a él; sirve el JBR de Android Studio).

```bash
npm run android:apk     # build web + cap sync + gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. También puedes abrir el proyecto con `npm run android:open` y usar *Run* en Android Studio con el celular conectado por USB.

Después de cualquier cambio en el frontend hay que volver a generar el APK (`npm run android:sync` copia el build web al proyecto Android).

### 3. Instalar y configurar en el celular

1. Pasa el APK al celular (cable, Drive, WhatsApp) y ábrelo. Android pedirá permitir **instalar apps de origen desconocido** para la app con la que lo abriste.
2. Al abrir MonMon Café por primera vez aparece el campo **Servidor**: escribe la IP de la PC (`192.168.1.50` basta; se completa como `http://192.168.1.50:3001/api`).
3. Inicia sesión. La dirección queda guardada; para cambiarla, toca **Servidor** en la pantalla de inicio de sesión.

Si aparece *No se pudo conectar con el servidor*, revisa que el celular esté en el mismo Wi-Fi, que el backend esté corriendo y el punto 1 de arriba.

### Notas técnicas

- `capacitor.config.ts` sirve la app como `http://localhost` (`androidScheme: 'http'`) y permite tráfico sin cifrar, porque el backend en la red local es HTTP. Con el esquema `https` por defecto el WebView bloquearía esas llamadas como contenido mixto.
- El APK del CI se firma siempre con la misma llave (secretos `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`, creados con `scripts/crear-llave-apk.ps1`), así cada versión se instala encima de la anterior. Sirve para instalarlo a mano, no para Play Store.

## Publicar una versión

1. Cada PR anota sus cambios en la sección **Sin publicar** de [CHANGELOG.md](CHANGELOG.md).
2. En GitHub: *Actions* → **Publicar versión** → *Run workflow*, rama `main`, y elige el tipo: `patch` (arreglos), `minor` (funciones nuevas) o `major` (cambio grande).
3. El workflow sube la versión en `package.json`, convierte **Sin publicar** en la nueva versión con fecha, hace commit en `main`, compila el APK firmado y crea la release `vX.Y.Z` con ese texto y el APK adjunto.

Si **Sin publicar** está vacía, el workflow se detiene sin publicar nada.
