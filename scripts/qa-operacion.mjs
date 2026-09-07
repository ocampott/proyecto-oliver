import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

// QA aislado: build de producción con URLs ficticias y API/auth interceptadas.
// Nunca lee ni escribe datos en Supabase.
const output = mkdtempSync(join(tmpdir(), 'oliver-ui-'));
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, VITE_API_URL: 'http://127.0.0.1:3007', VITE_SUPABASE_URL: 'http://127.0.0.1:54329', VITE_SUPABASE_ANON_KEY: 'qa-only' };
execFileSync(process.execPath, ['./node_modules/vite/bin/vite.js', 'build', '--outDir', join(output, 'dist')], { env, stdio: 'pipe' });
const preview = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'preview', '--outDir', join(output, 'dist'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
for (let attempt = 0; attempt < 100; attempt++) {
  try { if ((await fetch(base)).ok) break; } catch {}
  if (attempt === 99) { preview.kill(); throw new Error('El preview no arrancó.'); }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
let browser;
try {
browser = await chromium.launch({headless:true});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
let pending=true, cierre=false, history=[];
const revision='10000000-0000-4000-8000-000000000010';
const emp={id:'10000000-0000-4000-8000-000000000003',nombre:'Ana',apellido:'Pérez',estado:'activo'};
const solicitud={id:'10000000-0000-4000-8000-000000000020',empleado_id:emp.id,empleados:emp,motivo:'Licencia',detalle:'Turno médico por la mañana.',fecha_desde:'2026-08-10',fecha_hasta:'2026-08-10',revision:1,estado:'pendiente',certificado_pendiente:false};
const fila={empleado_id:emp.id,nombre:'Ana Pérez',tipo_pago:'mensual',sueldo_mensual:500000,valor_hora:null,valor_dia:null,horas_trabajadas:160,horas_pactadas:160,valor_hora_equivalente:3125,horas_en_curso:false,minutos_perdidos:0,descuento_tardanza:0,descuento_ausencia:0,dias_ausencia:0,dias_ausencia_justificada:0,horas_extra:0,total_por_horas:500000,total:500000,advertencias:[]};
const plan={slug:'basico',nombre:'Básico',modulos:['asistencia','rrhh','horas','turnos','reportes'],maxEmpleados:100,maxSucursales:10,precioMensual:1000};
const org={id:'10000000-0000-4000-8000-000000000001',name:'Organización de prueba',slug:'demo',role:'owner',plan:'basico',entitlements:{plan,modulos:plan.modulos,ilimitado:false,maxEmpleados:100,maxSucursales:10,suscripcion:null}};
let snapshot={desde:'2026-08-01',hasta:'2026-08-31',revision,filas:[fila]};
const c={id:'10000000-0000-4000-8000-000000000030',desde:'2026-08-01',hasta:'2026-08-31',created_at:'2026-09-07T12:00:00Z',nota:'Período revisado',actor_email:'qa@example.test',revision};
await page.addInitScript(()=>{
  const payload={sub:'10000000-0000-4000-8000-000000000004',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+36000};
  const access_token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify(payload))+'.test';
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token,refresh_token:'qa-refresh',expires_at:payload.exp,expires_in:36000,token_type:'bearer',user:{id:payload.sub,email:'qa@example.test',aud:'authenticated'}}));
});
const requests=[];
await page.route('http://127.0.0.1:3007/**',async route=>{
 const u=new URL(route.request().url()), path=u.pathname;requests.push(path);
 let data;
 if(path==='/api/org/current')data=org;
 else if(path==='/api/rrhh/pendientes')data={solicitudes:pending?[solicitud]:[],certificados:[],totalSolicitudes:pending?1:0,totalCertificados:0,marcasRechazadas:0};
 else if(path.endsWith('/decision')){pending=false;history=[{id:'h',accion:'UPDATE',actor_email:'qa@example.test',actual:{estado:'aprobada'},comentario:'Certificado revisado',created_at:new Date().toISOString()}];data={...solicitud,estado:'aprobada',revision:2};}
 else if(path.endsWith('/historial') && path.includes('ausencias'))data=history;
 else if(path==='/api/empleados')data=[emp];
 else if(path==='/api/sucursales')data=[];
 else if(path==='/api/rrhh/avisos-urgentes')data=[];
 else if(path==='/api/settings/rrhh-categorias')data={categorias:['Licencia','Vacaciones']};
 else if(path==='/api/ausencias')data={ausencias:[],resumen:{total:0,certificadosPendientes:0,porSucursal:{},porMotivo:{}},pagination:{page:1,pageSize:20,total:0,totalPages:0}};
 else if(path==='/api/liquidacion'){data={...snapshot,desde:u.searchParams.get('desde'),hasta:u.searchParams.get('hasta')};}
 else if(path==='/api/liquidacion/cierres' && route.request().method()==='POST'){cierre=true;data={id:c.id};}
 else if(path==='/api/liquidacion/cierres')data=cierre?[c]:[];
 else if(path===`/api/liquidacion/cierres/${c.id}`)data={...c,snapshot,hayCambios:false,cambios:[]};
 else if(path==='/api/portal/demo')data={nombre:'Ana',anio:2026,horarios:[{id:'h1',dia_semana:1,hora_inicio:'09:00',hora_fin:'17:00',sucursal_nombre:'Centro'}],vacaciones:{saldo:14,advertencia:null},solicitudes:[{...solicitud,estado:pending?'pendiente':'aprobada'}],archivos:[{id:'f1',nombre_original:'Certificado.pdf',created_at:new Date().toISOString()}]};
 else if(path==='/api/horarios')data=[{id:'h1',empleado_id:emp.id,dia_semana:1,hora_inicio:'09:00',hora_fin:'17:00',sucursal_id:null,tolerancia_min:null}];
 else if(path==='/api/turno-templates')data=[];
 else if(path==='/api/turnos/tolerancia')data={tolerancia_min:5};
 else if(path==='/api/chat/estado')data={vinculado:true,empleadoNombre:'Ana'};
 else if(path==='/api/chat/historial')data={mensajes:[{remitente:'sistema',texto:'Hola Ana'}],entrada:'menu',opciones:[]};
 else {data={};console.log('Unhandled fixture',path);}
 await route.fulfill({json:data,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'}});
});
await page.goto(base+'/rrhh');
await page.getByRole('button',{name:'Revisar',exact:true}).waitFor();
await page.screenshot({path:join(output,'pendientes.png'),fullPage:true});
await page.getByRole('button',{name:'Revisar',exact:true}).click();
await page.getByRole('button',{name:'Aprobar',exact:true}).click();
await page.getByLabel('Motivo de la decisión').fill('Certificado revisado');
await page.getByRole('button',{name:'Confirmar decisión',exact:true}).click();
await page.getByText('No hay solicitudes pendientes.').waitFor();
assert.equal(pending,false);
await page.goto(base+'/liquidacion');
await page.getByLabel('Desde',{exact:true}).fill('2026-08-01');
await page.getByLabel('Hasta',{exact:true}).fill('2026-08-31');
const cerrar=page.getByRole('button',{name:'Cerrar período',exact:true});
await cerrar.waitFor();
await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Cerrar período'&&!b.disabled));
await cerrar.click();
await page.getByLabel('Nota de revisión').fill('Período revisado');
await page.getByLabel('Revisé los importes y las advertencias de todos los empleados.').check();
await page.getByRole('button',{name:'Guardar cierre',exact:true}).click();
await page.getByText('Total guardado:').waitFor();
await page.screenshot({path:join(output,'cierre.png'),fullPage:true});
assert.equal(cierre,true);
await page.goto(base+'/turnos');
await page.getByRole('heading',{name:'Horarios por empleado'}).waitFor();
assert.equal(requests.filter(x=>x==='/api/horarios').length,1);
await page.setViewportSize({width:390,height:844});
await page.goto(base+'/portal/demo');
await page.getByRole('heading',{name:'Mis horarios'}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
await page.screenshot({path:join(output,'portal-mobile.png'),fullPage:true});
assert.deepEqual(errors,[]);
console.log('UI OK: aprobación, cierre, consulta única de horarios, portal móvil sin overflow; sin errores JS. API/auth son fixtures locales.');
console.log('Capturas de QA:', output);
} finally {
  await browser?.close();
  preview.kill();
}
