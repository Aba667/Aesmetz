import { DurableObject } from 'cloudflare:workers';
export class Audience extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS views(day TEXT,path TEXT,n INTEGER NOT NULL,PRIMARY KEY(day,path))');}
 record(path){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date());this.sql.exec('INSERT INTO views VALUES(?,?,1) ON CONFLICT(day,path) DO UPDATE SET n=n+1',day,path);this.sql.exec("DELETE FROM views WHERE day < ?",new Date(Date.now()-180*86400000).toISOString().slice(0,10));}
 stats(){return this.sql.exec('SELECT day,path,n FROM views ORDER BY day DESC,n DESC').toArray();}
}
export default {async fetch(req,env){
 const u=new URL(req.url),origin=req.headers.get('Origin');
 const allowed=['https://aesmetz.com','https://www.aesmetz.com'];
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 if(u.pathname==='/collect'){
  if(!allowed.includes(origin))return new Response('Forbidden',{status:403});
  if(req.method!=='POST')return new Response('',{status:405});
  try{const text=await req.text();if(text.length>600)throw Error();const {path}=JSON.parse(text);if(typeof path!=='string'||!/^\/[a-zA-Z0-9/_\-.]*$/.test(path)||path.length>250)throw Error();await env.STATS.get(env.STATS.idFromName('production')).record(path);return new Response(null,{status:204,headers});}catch{return new Response('Invalid',{status:400,headers});}
 }
 if(u.pathname==='/stats'){
  if(!env.ADMIN_KEY||req.headers.get('Authorization')!=='Bearer '+env.ADMIN_KEY)return new Response('Unauthorized',{status:401,headers});
  const rows=await env.STATS.get(env.STATS.idFromName('production')).stats();return Response.json(rows,{headers});
 }
 if(u.pathname!=='/')return new Response('Not found',{status:404});
 return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Audience AESM</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:20px;color:#163e30;background:#faf8f1}input,button{padding:12px;font:inherit}td,th{text-align:left;padding:12px;border-bottom:1px solid #ccc}table{width:100%}</style><h1>Audience du site AESM</h1><p>Pages vues avec consentement · Statistiques à partir du 1er novembre 2026 · 180 jours maximum.</p><p>Ces chiffres comptent des consultations, pas des personnes uniques. Les refus, bloqueurs et certaines visites automatisées peuvent affecter les résultats.</p><form><label>Clé privée <input type="password" required autocomplete="current-password"></label> <button>Afficher</button></form><p id="status" role="status"></p><div id="results"></div><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const status=document.querySelector('#status');status.textContent='Chargement…';try{const r=await fetch('/stats',{headers:{Authorization:'Bearer '+document.querySelector('input').value}});if(!r.ok)throw Error();const rows=await r.json();status.textContent=rows.reduce((s,r)=>s+r.n,0)+' pages vues enregistrées';const table=document.createElement('table');for(const values of [['Jour (Paris)','Page','Vues'],...rows.map(r=>[r.day,r.path,r.n])]){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td)}table.append(tr)}document.querySelector('#results').replaceChildren(table)}catch{status.textContent='Clé incorrecte ou service indisponible.'}};</script></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','X-Frame-Options':'DENY'}});
}};
