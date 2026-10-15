import test from 'node:test';
import assert from 'node:assert/strict';
import {findMedicineMention,matchMedicineSpoken} from '../src/medicine-panel.js';
import {validateCatalog,evaluateQuestion} from '../server/core.mjs';
const source='https://example.org/pharmacy-verification';
const catalog=validateCatalog([
 {id:'para500',name:'Парацетамол 500 мг',aliases:['парацетамол','paracetamol','парацетомол'],verified:true,verifiedAt:'2026-10-15',sourceUrl:source,description:'Халуурах үед хэрэглэдэг тухай бүртгэл.',priceMnt:3600,stock:12,form:'шахмал',imageUrl:'https://cdn.example.org/para500.jpg',warnings:'Тунг эм зүйчээс асууна уу.'},
 {id:'nuro',name:'Нурофен',aliases:['нурофэн','nurofen'],verified:true,verifiedAt:'2026-10-15',sourceUrl:source,description:'Бүтээгдэхүүний бүртгэлийн мэдээлэл.',stock:0},
 {id:'fake',name:'Туршилтын эм',aliases:['demo pill'],verified:false,description:'Баталгаажаагүй'}]);
test('Mongolian spoken medicine recognition uses approved aliases and cautious suffixes',()=>{
 assert.equal(findMedicineMention('Парацетамолыг хэд гэдэг вэ?',catalog).id,'para500');
 assert.equal(matchMedicineSpoken('Парацетомол 500 мг үнэ хэд вэ',catalog).item.id,'para500');
 assert.equal(matchMedicineSpoken('paraсetamol',catalog).item,null); // mixed-script spoof is unsafe
 assert.equal(matchMedicineSpoken('өнөөдөр агаарын температур ямар вэ?',catalog).item,null);
 assert.equal(matchMedicineSpoken('нурофэн байдаг уу',catalog).item.id,'nuro');
 assert.equal(matchMedicineSpoken('туршилтын эм',catalog.filter(x=>x.verified)).item,null);
});
test('catalog medicines give only registered information and friendly purchase path',()=>{
 const r=evaluateQuestion('Парацетомолын үнэ хэд вэ?',catalog.filter(x=>x.verified));
 assert.equal(r.kind,'catalog');
 assert.equal(r.medicine.id,'para500');
 assert.match(r.reply,/3,600|3600/);
 assert.match(r.reply,/эм зүйч/i);
 assert.doesNotMatch(r.reply,/https:\/\//);
 const out=evaluateQuestion('Нурофэн авах уу?',catalog.filter(x=>x.verified));
 assert.match(out.reply,/одоогоор|үлдэгдэл/);
 assert.equal(out.medicine.id,'nuro');
 const other=evaluateQuestion('хөлбөмбөгийн мэдээ юу байна?',catalog.filter(x=>x.verified));
 assert.equal(other.kind,'unknown');
 assert.doesNotMatch(other.reply,/хөлбөмбөг/);
});
test('safe catalog requires HTTPS image and preserves published product media',()=>{
 assert.equal(catalog[0].imageUrl,'https://cdn.example.org/para500.jpg');
 assert.throws(()=>validateCatalog([{name:'X',imageUrl:'javascript:alert(1)'}]),/зураг|URL/i);
 assert.throws(()=>validateCatalog([{name:'X',imageUrl:'data:image/svg+xml,evil'}]),/зураг|URL/i);
});
