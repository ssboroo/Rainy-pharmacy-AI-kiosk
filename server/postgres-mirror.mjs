import pg from 'pg';
const {Pool}=pg;
export function createPostgresMirror(url,{ssl}={}){
 const pool=new Pool({connectionString:url,max:3,connectionTimeoutMillis:7000,
  ...(ssl?{ssl:{rejectUnauthorized:true}}:{})});
 async function init(){
  await pool.query('CREATE TABLE IF NOT EXISTS rainy_branch_snapshots (branch_slug text PRIMARY KEY, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
 }
 async function sync(branch,payload){
  if(typeof branch!=='string'||!/^(default|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(branch))throw Error('Invalid branch');
  await pool.query(
   'INSERT INTO rainy_branch_snapshots (branch_slug,snapshot,updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (branch_slug) DO UPDATE SET snapshot=EXCLUDED.snapshot,updated_at=now()',
   [branch,JSON.stringify(payload)]);
 }
 async function read(branch){
  const result=await pool.query('SELECT snapshot,updated_at FROM rainy_branch_snapshots WHERE branch_slug=$1',[branch]);
  return result.rows[0]||null;
 }
 async function status(){const r=await pool.query('SELECT COUNT(*)::int AS branches FROM rainy_branch_snapshots');return r.rows[0];}
 async function close(){await pool.end();}
 return {init,sync,read,status,close};
}
