# Revitam · PWA y alertas

Esta versión conserva el inventario, la conexión y el acceso existentes. Añade Configuración, instalación y alertas.

## Qué funciona con el HTML

- Configuración accesible aun si falla la conexión de inventario.
- Alertas: situación sin clasificar, proveedor inexistente, fecha de asignación faltante y plazo de revisión vencido (30 días por defecto, editable).
- Ventanas con el sistema abierto y visible: apagadas, repetidas cada 15/30/60/240 minutos, o una vez por día de México.
- Pausa: 1/8/24 horas o 7 días, y reanudación.
- Botón de prueba de ventana. Las pruebas no consumen el límite de alertas reales.
- Aviso PWA: máximo tres apariciones por navegador; instalación manual siempre disponible en Configuración. Al conectar las funciones, se verifica además el máximo por IP. Personas en una misma red pública pueden compartir esa IP; una IP dinámica puede cambiar. Borrar datos del navegador reinicia el límite local, pero no el del servidor.

## Publicar la PWA

1. Descomprime el ZIP.
2. Publica juntos `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` e `icon-maskable.png` en la carpeta del sistema de tu alojamiento HTTPS. Si usas GitHub Pages, sube esos seis archivos a la misma carpeta. El HTML descargado por separado equivale a este `index.html`; al publicarlo usa ese nombre.
3. Conserva tus reglas de inventario. No cambies permisos para hacer pública la base.
4. Abre la URL publicada. En Configuración usa “Instalar / ver instrucciones”. El navegador decide si ofrece el botón de instalación.
5. En iPhone: Safari → Compartir → Agregar a pantalla de inicio. Abre el icono instalado antes de activar notificaciones.

La PWA necesita internet para el inventario. Esta versión no guarda datos de Firebase en caché ni promete uso sin conexión.

## Activar IP y notificaciones con la app cerrada

Este paso está preparado, pero NO está desplegado ni conectado automáticamente. Requiere acceso administrativo a Firebase, Node 22, Firebase CLI y un proyecto con facturación Blaze habilitada para Cloud Functions / Cloud Scheduler. No hay que pegar claves privadas en el HTML.

1. En la carpeta `functions`, instala las dependencias con `npm install`.
2. Genera un par de claves VAPID: `npx web-push generate-vapid-keys`. Guarda la pública y la privada separadamente. Conserva las mismas claves en despliegues posteriores para no invalidar las suscripciones.
3. Crea `functions/.env.crm-revitam` con tus valores:

```dotenv
REVITAM_VAPID_PUBLIC=TU_CLAVE_PUBLICA
REVITAM_PUSH_CONTACT=mailto:TU_CORREO
REVITAM_ALLOWED_UIDS=UID_ADMIN,UID_OTRO_USUARIO_AUTORIZADO
REVITAM_APP_URL=https://TU_DOMINIO/TU_CARPETA/index.html
```

Los UID se copian desde Firebase Authentication; el sistema también muestra el UID de la sesión. Incluye únicamente usuarios autorizados a consultar el inventario. Al quitar un UID de esta lista, el programador dejará de enviarle avisos.

4. Desde la carpeta que contiene `firebase.json`, inicia sesión con Firebase CLI: `firebase login`.
5. Configura secretos (el comando solicita el valor sin escribirlo en el HTML):

```bash
firebase functions:secrets:set REVITAM_VAPID_PRIVATE --project crm-revitam
firebase functions:secrets:set REVITAM_IP_PEPPER --project crm-revitam
```

Usa la clave privada VAPID en el primero y una cadena aleatoria larga en el segundo. Mantén estable el segundo secreto: cambiarlo reinicia la identidad de los contadores por IP. Las IP se guardan como hash con secreto, no como texto.

6. Despliega sólo estas funciones, sin sustituir otras funciones del proyecto:

```bash
firebase deploy --project crm-revitam --only functions:revitamPushConfig,functions:revitamClaimInstall,functions:revitamSaveDevice,functions:revitamRemoveDevice,functions:revitamDeviceStatus,functions:revitamTestPush,functions:revitamSendAlerts
```

Las funciones se ejecutan en `us-central1`, igual que el cliente incluido. El programador revisa cada 15 minutos el documento existente `revitamContenedores/estado` y su campo `payload`. No necesita FCM: utiliza Web Push y VAPID directamente.

Las colecciones auxiliares `revitamPushDevices` y `revitamInstallIps` se administran desde las funciones. Las reglas de Firestore deben impedir acceso directo del cliente a ellas. Si tus reglas sólo permiten la colección del inventario y deniegan el resto, no requieren cambios. Si hay un permiso global, restríngelo antes de activar este módulo: una regla de denegación específica no anula otro permiso global.

## Validar en el teléfono

1. Entra con tu cuenta de Firebase en la URL publicada o la PWA.
2. En Configuración presiona “Activar este dispositivo” y acepta el permiso.
3. Selecciona “Notificación al dispositivo” o “Ambos formatos”, la frecuencia y guarda.
4. Presiona “Enviar prueba al dispositivo”. El resultado sólo confirma aceptación por el servicio push; presiona “Sí recibí la prueba” cuando realmente la veas.
5. Cierra la app y verifica una alerta real al siguiente ciclo del programador. Debe existir al menos un registro que cumpla los criterios.
6. Prueba “Apagadas” y “Pausar”; confirma que el mensaje dice que las preferencias se guardaron también en Firebase. Si falla esa confirmación, el servidor puede conservar la frecuencia anterior. Reintenta con internet.

En modo diario se avisa en el primer ciclo con alertas pendientes. En “Ambos formatos” se permite una ventana y una notificación al día por dispositivo. Las ventanas sólo pueden verse cuando la app está abierta. Las notificaciones ya enviadas pueden llegar después de pausar; la entrega depende del navegador, conexión y permisos del dispositivo. No se garantiza una hora exacta.

Las preferencias son por dispositivo/navegador. El cierre de sesión desconecta su suscripción push antes de salir; si no se puede confirmar, muestra el error para reintentar. Puedes usar “Desconectar dispositivo” desde Configuración.

## Validación realizada

Sintaxis revisada en todos los scripts, módulo Firebase y funciones. Pruebas de lógica con DOM simulado: alertas, apagado, ventana de prueba, límite diario, pausa/reanudación, repetición, máximo de tres avisos y acceso manual. Sin identificadores HTML duplicados. No se pudo ejecutar un navegador real en este entorno. No se han desplegado las funciones ni se ha comprobado recepción push real.

Documentación oficial de referencia:
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
- https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/functions/schedule-functions
- https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
