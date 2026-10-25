import { DurableObject } from 'cloudflare:workers';
const origins = new Set(['https://aesmetz.com','https://www.aesmetz.com','http://127.0.0.1:8876','http://localhost:8876']);
export class ElectionPoll extends DurableObject {
 constructor(ctx, env) {
  super(ctx, env);
  this.sql = ctx.storage.sql;
  this.sql.exec("CREATE TABLE IF NOT EXISTS votes(voter TEXT PRIMARY KEY, candidate TEXT NOT NULL CHECK(candidate IN ('ahmet','dame','khoudia')))");
 }
 respond(voter, candidate) {
  let duplicate = false;
  if (candidate) {
   this.sql.exec('INSERT OR IGNORE INTO votes(voter,candidate) VALUES (?,?)', voter, candidate);
   duplicate = this.sql.exec('SELECT changes() AS n').one().n === 0;
  }
  const counts = {ahmet:0,dame:0,khoudia:0};
  for (const row of this.sql.exec('SELECT candidate, COUNT(*) AS n FROM votes GROUP BY candidate')) counts[row.candidate] = row.n;
  const voted = this.sql.exec('SELECT candidate FROM votes WHERE voter=?',voter).toArray().length > 0;
  return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0),voted,duplicate};
 }
}
export default {
 async fetch(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const json = (body, status=200) => new Response(JSON.stringify(body),{status,headers});
  if (origin && !origins.has(origin)) return json({error:'Origine non autorisée.'},403);
  const path = new URL(request.url).pathname;
  if (!['/','/preview'].includes(path)) return json({error:'Introuvable.'},404);
  if (path === '/preview' && !['http://127.0.0.1:8876','http://localhost:8876'].includes(origin)) return json({error:'Aperçu local uniquement.'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Poll-Token','Access-Control-Max-Age':'600'}});
  if (!['GET','POST'].includes(request.method)) return json({error:'Méthode non autorisée.'},405);
  let candidate;
  const token = request.headers.get('X-Poll-Token') || '';
  if (token && !/^[a-f0-9]{64}$/.test(token)) return json({error:'Identifiant invalide.'},400);
  if (request.method === 'POST') {
   if (!origin || !token || !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Requête invalide.'},403);
   if (Number(request.headers.get('Content-Length')) > 1024) return json({error:'Requête trop longue.'},413);
   try { const text=await request.text(); if(text.length>1024) return json({error:'Requête trop longue.'},413); candidate=JSON.parse(text).candidate; } catch { return json({error:'Réponse invalide.'},422); }
   if (!['ahmet','dame','khoudia'].includes(candidate)) return json({error:'Choisissez une candidature.'},422);
  }
  try {
   const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
   const voter = [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const data = await env.POLL.get(env.POLL.idFromName(path === '/preview' ? 'preview-2026' : 'presidence-2026')).respond(voter,candidate);
   return json(data, data.duplicate ? 409 : 200);
  } catch { return json({error:'Le sondage est momentanément indisponible.'},503); }
 }
};
