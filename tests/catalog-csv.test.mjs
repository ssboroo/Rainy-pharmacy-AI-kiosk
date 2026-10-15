import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalogCSV} from '../public/catalog-csv.js';

test('CSV medicine importer supports quoted Mongolian text, embedded commas and UTF-8 BOM',()=>{
 const csv='\ufeffid,name,category,description,warnings,verified,priceMnt,stock\n' +
 'test-one,"Парацетамол","Өвдөлт, халууралт","Ерөнхий, жишээ тайлбар","Эм зүйчээс лавлана",false,,\n' +
 'test-two,Лоратадин,Харшил,"Ерөнхий мэдээлэл",Анхааруулга,false,1500,3';
 const r=parseCatalogCSV(csv);
 assert.equal(r.length,2);
 assert.equal(r[0].description,'Ерөнхий, жишээ тайлбар');
 assert.equal(r[0].priceMnt,null);
 assert.equal(r[1].stock,3);
 assert.equal(r[0].verified,false);
});
test('CSV medicine importer refuses verified:true to prevent fabricated medical validation',()=>{
 assert.throws(()=>parseCatalogCSV('name,verified\nЭм,true'),/баталгаажуул/i);
 assert.throws(()=>parseCatalogCSV('name,priceMnt\nЭм,not-price'),/Үнэ/i);
 assert.throws(()=>parseCatalogCSV('name\n'),/мөр/i);
});
