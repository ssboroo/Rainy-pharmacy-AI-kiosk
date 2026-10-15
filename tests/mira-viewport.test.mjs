import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {avatarMarkup} from '../src/avatar-25d.js';

test('Mira uses a full recognisable SVG character, layered hair and an upper-body outfit',()=>{
 const svg=avatarMarkup('mira','mira-test');
 assert.match(svg,/class="avatar25-mira-hair-back"/);
 assert.match(svg,/class="avatar25-mira-fringe"/);
 assert.match(svg,/class="avatar25-mira-outfit"/);
 assert.match(svg,/class="avatar25-mouth-open 2d5-mouth-open"/);
 assert.match(svg,/id="mira-test-mira-hair"/);
 assert.match(svg,/scale\(1\.0[0-9]*\)/);
 assert.doesNotMatch(svg,/<!-- 2\.5D head only, no neck, shoulders or torso -->/);
});
test('Mira SVG remains self-contained and all other characters retain current head-only mode',()=>{
 const first=avatarMarkup('mira','mira-one');
 const second=avatarMarkup('mira','mira-two');
 assert.match(first,/url\(#mira-one-mira-hair\)/);
 assert.match(second,/url\(#mira-two-mira-hair\)/);
 assert.doesNotMatch(first,/mira-two/);
 assert.doesNotMatch(avatarMarkup('nomi'),/avatar25-mira-outfit/);
});
test('final kiosk layout prioritises all controls and a fully contained avatar',async()=>{
 const css=await readFile(new URL('../src/kiosk-finish.css',import.meta.url),'utf8');
 assert.match(css,/\.main-inner[^{]*\{[^}]*overflow:\s*hidden/s);
 assert.match(css,/\.content-grid[^{]*\{[^}]*min-height:\s*0/s);
 assert.match(css,/#avatar25\s+\.rainy-2d5-portrait[^{]*\{[^}]*transform:\s*none\s*!important/s);
 assert.match(css,/\.chat-messages[^{]*\{[^}]*overflow-y:\s*auto/s);
 assert.match(css,/@media\s*\(max-height:/);
});
