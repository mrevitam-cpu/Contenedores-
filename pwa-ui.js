(() => {
  'use strict';
  const $=id=>document.getElementById(id), KEY='revitam_notify_v2';
  const defaults={mode:'off',channel:'window',interval:60,days:30,pauseUntil:0};
  let prefs={...defaults},state=null,registration=null,registered=false,autoShown=false,busy=false;
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{$('notificationStatus').textContent='No se pueden guardar preferencias en este navegador.';return false}};
  prefs={...defaults,...read(KEY,{})};
  let deviceId=read('revitam_device_v2',null);if(!deviceId){deviceId=crypto.randomUUID();write('revitam_device_v2',deviceId)}
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const iphone=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function status(t){$('notificationStatus').textContent=t}
  async function cloud(name,data={}){await window.firebaseReady;if(!window.revitamCall)throw Error('Firebase aún no está conectado.');return window.revitamCall(name,data)}
  async function worker(){if(!isSecureContext||!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))throw Error('Publica los archivos PWA en HTTPS para activar este dispositivo.');if(!registration)registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;return registration}
  function showPrefs(){
    for(const n of ['mode','channel','interval','days'])$('notificationForm').elements[n].value=prefs[n];
    $('pauseStatus').textContent=prefs.pauseUntil>Date.now()?'Pausadas hasta '+new Date(prefs.pauseUntil).toLocaleString('es-MX'):'Sin pausa';
    $('installStatus').textContent=standalone()?'Aplicación instalada.':'Puedes instalarla desde aquí. El aviso automático aparece como máximo tres veces por navegador; el límite por IP se aplica al conectar las funciones de Firebase.';
    const permission='Notification' in window?Notification.permission:'no compatible';
    $('deviceStatus').textContent='Permiso: '+permission+' · Push: '+(registered?'dispositivo registrado':'sin conexión confirmada');
  }
  function list(){return state?window.RevitamAlertRules.alerts(state,prefs.days):[]}
  function renderAlerts(){const items=list();$('alertCount').textContent=state?items.length+' alerta(s) pendiente(s)':'Entra en Firebase para consultar las alertas.';$('alertList').replaceChildren();for(const a of items){const li=document.createElement('li');li.textContent=a.text;$('alertList').append(li)}if(state&&!items.length){const li=document.createElement('li');li.textContent='Sin alertas pendientes.';$('alertList').append(li)}}
  function popup(items,test=false){
    if($('editor').open||$('installDialog').open||$('notificationDialog').open||document.hidden)return false;
    $('notificationTitle').textContent=test?'Prueba de ventana':'Revitam · Alertas pendientes';
    $('notificationItems').replaceChildren();
    for(const item of items){const li=document.createElement('li');li.textContent=item.text;$('notificationItems').append(li)}
    $('notificationDialog').showModal();return true;
  }
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  async function check(){
    if(busy||!state||prefs.mode==='off'||prefs.pauseUntil>Date.now())return;
    // Las notificaciones del dispositivo son programadas por Firebase; esta ruta sólo abre ventanas.
    if(prefs.channel==='device')return;
    const items=list();renderAlerts();if(!items.length)return;
    const last=read('revitam_last_window_v2',{}),now=Date.now();
    if(prefs.mode==='daily'?last.day===day():now-(last.time||0)<prefs.interval*60000)return;
    busy=true;
    try{
      const run=()=>{
        const latest=read('revitam_last_window_v2',{});
        if(prefs.mode==='daily'?latest.day===day():now-(latest.time||0)<prefs.interval*60000)return;
        if(popup(items))write('revitam_last_window_v2',{time:now,day:day()});
      };
      if(navigator.locks)await navigator.locks.request('revitam-window-alert',run);else run();
    }finally{busy=false}
  }
  async function sync(){
    try{await cloud('revitamSaveDevice',{deviceId,preferences:prefs});status('Preferencias guardadas en este equipo y en Firebase.');return true}
    catch{status('Preferencias guardadas sólo en este equipo. No se confirmó el cambio en Firebase: si ya había notificaciones push activas, pueden seguir con la configuración anterior. Reintenta guardar con conexión.');return false}
  }
  async function install(manual=false){
    if(standalone())return;
    if(!manual){
      if(autoShown||document.hidden||$('editor').open||$('notificationDialog').open)return;
      const count=read('revitam_install_count_v2',0);if(count>=3)return;
      if(!window.revitamInstallPrompt&&!iphone)return;
      autoShown=true;
      try{const r=await cloud('revitamClaimInstall');if(!r.show)return;$('installStatus').textContent='Límite por IP activo · Aviso '+r.count+' de 3.'}
      catch{$('installStatus').textContent='Firebase IP pendiente: por ahora el límite de tres avisos se guarda en este navegador.'}
      if(!write('revitam_install_count_v2',count+1))return;
    }
    $('installInstructions').textContent=iphone?'En Safari toca Compartir → Agregar a pantalla de inicio → Agregar. Después abre Revitam desde su icono para activar notificaciones.':'Presiona Instalar. Si el navegador no ofrece instalación, usa su menú → Instalar aplicación o Agregar a pantalla de inicio.';
    $('installNative').hidden=!window.revitamInstallPrompt;
    if(!$('installDialog').open)$('installDialog').showModal();
  }
  $('installApp').onclick=()=>install(true);
  $('installNative').onclick=async()=>{const p=window.revitamInstallPrompt;if(!p)return;window.revitamInstallPrompt=null;$('installNative').disabled=true;try{await p.prompt();const result=await p.userChoice;if(result.outcome==='accepted')$('installDialog').close()}catch{status('Usa el menú de tu navegador para instalar.')}finally{$('installNative').disabled=false;$('installNative').hidden=true}};
  $('installClose').onclick=()=>$('installDialog').close();
  window.addEventListener('revitam-install-ready',()=>install());
  window.addEventListener('appinstalled',()=>{$('installDialog').close();showPrefs()});
  $('notificationForm').onsubmit=async e=>{e.preventDefault();const f=e.target.elements;prefs={...prefs,mode:f.mode.value,channel:f.channel.value,interval:Number(f.interval.value),days:Number(f.days.value)};if(!write(KEY,prefs))return;await sync();showPrefs();renderAlerts();check()};
  $('pauseAlerts').onclick=async()=>{prefs.pauseUntil=Date.now()+Number($('pauseHours').value)*3600000;write(KEY,prefs);showPrefs();await sync()};
  $('resumeAlerts').onclick=async()=>{prefs.pauseUntil=0;write(KEY,prefs);showPrefs();await sync();check()};
  $('testWindow').onclick=()=>{if(!popup([{text:'Esta es una prueba. Las alertas reales aparecerán con este formato.'}],true))status('Cierra la ventana actual para probar.')};
  $('notificationClose').onclick=()=>$('notificationDialog').close();
  $('notificationReview').onclick=()=>{$('notificationDialog').close();window.openModule('configuracion',true);renderAlerts()};
  $('enableDevice').onclick=async()=>{
    $('enableDevice').disabled=true;
    try{
      if(iphone&&!standalone())throw Error('En iPhone instala Revitam y abre su icono antes de activar notificaciones.');
      if(!('Notification' in window)||!('PushManager' in window))throw Error('Este navegador no admite notificaciones push. Usa las ventanas del sistema.');
      // La solicitud de permiso comienza directamente desde el clic del usuario.
      const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permiso '+permission+'. Puedes cambiarlo desde los ajustes del navegador.');
      const reg=await worker(),cfg=await cloud('revitamPushConfig');
      const padded=cfg.publicKey.replace(/-/g,'+').replace(/_/g,'/');const key=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
      let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      await cloud('revitamSaveDevice',{deviceId,preferences:prefs,subscription:sub.toJSON()});registered=true;status('Dispositivo conectado. Selecciona notificaciones del dispositivo y una frecuencia; guarda las preferencias.');
    }catch(e){status(e.message||'No se pudo activar Push. Revisa el despliegue de Firebase.')}
    finally{$('enableDevice').disabled=false;showPrefs()}
  };
  $('testDevice').onclick=async()=>{try{const r=await cloud('revitamTestPush',{deviceId});status(r.accepted?'Prueba aceptada por el servicio push. Confirma abajo si la viste en tu dispositivo.':'Prueba no entregada.')}catch(e){status(e.message||'Activa el dispositivo primero.')}};
  $('confirmDevice').onclick=()=>{write('revitam_push_test_v2',new Date().toISOString());status('Confirmaste recepción de la prueba el '+new Date().toLocaleString('es-MX')+'.')};
  window.revitamDisconnectDevice=async()=>{
    await cloud('revitamRemoveDevice',{deviceId});
    const reg=await worker(),sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();registered=false;showPrefs();status('Este dispositivo quedó desconectado.');
  };
  $('disconnectDevice').onclick=()=>window.revitamDisconnectDevice().catch(e=>status(e.message||'No se pudo desconectar. Reintenta con internet.'));
  window.addEventListener('revitam-state',e=>{state=e.detail;renderAlerts();check();install()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();install()}});
  window.addEventListener('storage',e=>{if(e.key===KEY){prefs={...defaults,...read(KEY,{})};showPrefs();renderAlerts()}});
  showPrefs();renderAlerts();setInterval(()=>{showPrefs();renderAlerts();check();install()},60000);
  worker().catch(e=>{$('pwaStatus').textContent=e.message});
  window.firebaseReady.then(async()=>{try{const r=await cloud('revitamDeviceStatus',{deviceId});registered=r.registered;showPrefs()}catch{}}).catch(()=>{});
})();
