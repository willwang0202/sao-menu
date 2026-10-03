import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import electronPath from 'electron';
import {_electron as electron} from 'playwright';
const temporary=await mkdtemp(path.join(tmpdir(),'sao-startup-frames-')),output=path.resolve('output/playwright/startup-frames');await mkdir(output,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>value!==undefined&&!['ELECTRON_RUN_AS_NODE','SAO_DEV_URL'].includes(key)));
const instance=await electron.launch({executablePath:electronPath,args:['.'],cwd:process.cwd(),env:{...env,SAO_USER_DATA:temporary}});
try{
 const page=await instance.firstWindow();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.evaluate(()=>{document.querySelector('video').pause();});
 const frames=[0,760,1520,1536.666,1553.332,1569.998,1586.664,1603.33,1619.996,2280,3040,3590,3800,4560,5320,6080,6840];
 for(const time of frames){await page.evaluate(time=>new Promise(resolve=>{const v=document.querySelector('video');v.addEventListener('seeked',resolve,{once:true});v.currentTime=time/1000;}),time);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(output,`${Math.round(time).toString().padStart(4,'0')}ms.png`)});}
 await page.evaluate(()=>document.querySelector('video').play());await page.getByRole('form',{name:'SAO account login'}).waitFor();await page.screenshot({path:path.join(output,'7621ms.png')});
 assert.equal(await page.locator('.startup-login-error').count(),0);
 await writeFile(path.join(output,'comparison.json'),JSON.stringify({reference:'https://www.youtube.com/watch?v=1hXfFHmWm7g',frames,method:'Native playback of original 3832×2160 60fps VP9 source; actual decoded frames at matching media timestamps',parity:'Source footage reused without retiming, recoloring, interpolation or video re-encoding'},null,2)+'\n');
 console.log(`Captured ${frames.length+1} original-video comparison frames in ${output}`);
}finally{await instance.close();await rm(temporary,{recursive:true,force:true});}
