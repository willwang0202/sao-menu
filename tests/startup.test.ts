import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('the source startup movie and supplied login artwork retain their exact bytes',async()=>{
 const manifest=JSON.parse(await readFile('public/startup/manifest.json','utf8'));
 assert.equal(manifest.video.fps,60);assert.equal(manifest.video.width,3832);assert.equal(manifest.video.height,2160);
 for(const entry of [manifest.video,manifest.login]) assert.equal(createHash('sha256').update(await readFile('public/startup/'+entry.file)).digest('hex'),entry.sha256);
});
