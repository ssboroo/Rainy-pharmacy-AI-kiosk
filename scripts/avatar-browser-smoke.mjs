import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const allowed=new Map([
 ['/',{file:'tests/fixtures/avatar-smoke.html',type:'text/html; charset=utf-8'}],
 ['/src/avatar-25d.js',{file:'src/avatar-25d.js',type:'text/javascript'}],
 ['/src/avatar-idle.js',{file:'src/avatar-idle.js',type:'text/javascript'}],
 ['/src/avatar-25d.css',{file:'src/avatar-25d.css',type:'text/css'}]
]);
const server=createServer(async(req,res)=>{
 const entry=allowed.get(req.url);
 if(!entry){res.writeHead(404);res.end();return;}
 try{const data=await readFile(resolve(entry.file));res.writeHead(200,{'Content-Type':entry.type});res.end(data);}
 catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;
try{
 const browsers=['/usr/bin/google-chrome','/usr/bin/chromium','google-chrome','chromium'];
 let output='',stderr='',code=-1,spawned=false;
 for(const browser of browsers){
  if(browser.startsWith('/')&&!existsSync(browser))continue;
  const result=await new Promise(resolveResult=>{
   const child=spawn(browser,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--virtual-time-budget=14000','--dump-dom','http://127.0.0.1:'+port+'/'
   ],{stdio:['ignore','pipe','pipe']});
   const timer=setTimeout(()=>child.kill('SIGKILL'),35000);
   let stdout='',err='';
   child.stdout.on('data',d=>stdout+=String(d));
   child.stderr.on('data',d=>err+=String(d));
   child.on('error',()=>{clearTimeout(timer);resolveResult({spawned:false})});
   child.on('close',status=>{clearTimeout(timer);resolveResult({spawned:true,stdout,err,status})});
  });
  if(!result.spawned)continue;
  spawned=true;output=result.stdout;stderr=result.err;code=result.status;break;
 }
 if(!spawned||!output.includes('data-smoke="pass"')){
   console.error('Browser avatar test failed:',{spawned,code});
   console.error('BODY STATUS:',(output.match(/<body[^>]*>/)||[])[0]||'missing');
   console.error('HTML HEAD:',output.slice(0,800));
   console.error(stderr.slice(-1100));
   process.exitCode=1;
 }else console.log('Chromium SVG animation smoke PASS: Nomi, Mira, Kiki, Aria and Bobo');
}finally{await new Promise(done=>server.close(done));}
