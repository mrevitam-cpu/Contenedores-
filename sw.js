'use strict';
// No se almacenan inventarios, contraseñas ni respuestas de Firebase en caché.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let p;try{p=event.data.json()}catch{return}
  event.waitUntil(self.registration.showNotification(p.title||'Revitam',{
    body:p.body||'Hay alertas pendientes.',icon:'./icon-192.png',badge:'./icon-192.png',
    tag:p.tag||'revitam-alertas',data:{url:new URL('./index.html#configuracion',self.registration.scope).href}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=new URL('./index.html#configuracion',self.registration.scope).href;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of clients)if(c.url.startsWith(self.registration.scope)){await c.navigate(url);return c.focus()}
    return self.clients.openWindow(url);
  })());
});
