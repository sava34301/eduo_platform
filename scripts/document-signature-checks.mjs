// Actual workspace routes, encrypted SQLite records and fictional signatures.
export async function checkDocumentSignatures({check,sql,setUser,store,app,dir}) {
  const ink = await import(dir+'/document-signature.mjs'), docs = await import(dir+'/document-data.mjs'), {env} = await import(dir+'/env.mjs');
  const owner = 'drawn-signature-owner', other = 'drawn-signature-other';
  const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
  const post = async(type,data,headers={}) => { const response=await app.POST(new Request('https://example.test/api/workspace',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({type,data})}));return {status:response.status,data:await response.json(),cache:response.headers.get('cache-control')}; };
  const fields={title:'PRIVATE_SIGNATURE_DOCUMENT',content:'Exact fictional consent text. <script>alert(1)</script>',category:'Родителско съгласие',due:'2026-10-16',files:[]};
  const issue=async()=>{const created=await post('document',{...fields,requestId:crypto.randomUUID()});if(created.status!==200)throw Error('Signature document fixture failed');const r=await post('publish-document',{id:created.data.record.id,revision:1});if(r.status!==200)throw Error('Signature issue fixture failed');return r.data.record;};
  const drawing=ink.signatureDrawing([[[20,130],[90,40],[135,150],[220,70],[295,120]],[[100,175],[340,145]]]);
  const alternative=ink.signatureDrawing([[[25,100],[120,35],[250,150],[320,70]]]);
  const request=d=>({id:d.id,version:d.version,contentHash:d.contentHash,name:'PRIVATE_SIGNATURE_PARENT',accepted:true,method:'drawn-signature',signature:drawing});
  setUser(owner);await store.getRecords(owner);let d=await issue(),body=request(d);
  setUser(null);check((await post('acknowledge',body)).status===401,'Anonymous visitors cannot submit a drawn signature');
  setUser(other);check((await post('acknowledge',body)).status===404,'A different account cannot sign another private workspace document');
  const otherView=await(await app.GET(new Request('https://example.test/api/workspace'))).json();
  check(!otherView.records.some(r=>r.id===d.id),'Private document content and signature do not appear in another account');
  setUser(owner);
  check((await post('acknowledge',body,{origin:'https://foreign.test'})).status===403,'Foreign-origin signature submissions are refused');
  check((await post('acknowledge',body,{'sec-fetch-site':'cross-site'})).status===403,'Cross-site signature requests are refused');
  check((await post('acknowledge',body,{'content-type':'text/plain'})).status===415,'Signature submissions require the JSON media type');
  check((await post('acknowledge',body,{'content-length':'128001'})).status===413,'A declared oversized signature request is refused before decoding');
  let response=await app.POST(new Request('https://example.test/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'acknowledge',data:{...body,name:'界'.repeat(50000)}})}));
  check(response.status===413,'The streamed request bound counts UTF-8 bytes rather than characters');
  let cancelled=false;const chunk=new TextEncoder().encode('x'.repeat(65000));
  const stream=new ReadableStream({pull(controller){controller.enqueue(chunk)},cancel(){cancelled=true}});
  response=await app.POST(new Request('https://example.test/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'}));
  check(response.status===413&&cancelled,'An oversized signature stream is cancelled without accumulating its remainder');
  response=await app.POST(new Request('https://example.test/api/workspace',{method:'POST',headers:{'content-type':'application/json'},body:'{bad'}));
  check(response.status===400&&response.headers.get('cache-control')==='private, no-store','Malformed signature requests return a private JSON error');
  const invalid=[
    ['missing drawing',{signature:undefined}],['empty drawing',{signature:ink.signatureDrawing([])}],
    ['single tap',{signature:ink.signatureDrawing([[[20,20]]])}],['stationary points',{signature:ink.signatureDrawing([[[20,20],[20,20]]])}],
    ['fractional coordinates',{signature:ink.signatureDrawing([[[1.2,20],[40,40]]])}],['negative coordinates',{signature:ink.signatureDrawing([[[-1,20],[40,40]]])}],
    ['out-of-bounds coordinates',{signature:ink.signatureDrawing([[[20,20],[641,40]]])}],['invalid dimensions',{signature:{...drawing,width:100000}}],
    ['non-finite coordinates',{signature:ink.signatureDrawing([[[20,20],[NaN,40]]])}],['extra point values',{signature:ink.signatureDrawing([[[20,20,1],[40,40,2]]])}],
    ['too many strokes',{signature:ink.signatureDrawing(Array.from({length:41},()=>[[20,20],[40,40]]))}],
    ['too many total points',{signature:ink.signatureDrawing([Array.from({length:1100},(_,i)=>[i%600,50]),Array.from({length:1100},(_,i)=>[i%600,80])])}],
    ['raw SVG input',{signature:'<svg onload="alert(1)"/>'}],['embedded drawing metadata',{signature:{...drawing,pressure:[1],capturedAt:'2020-01-01'}}],
    ['unsupported method',{method:'verified-signature'}],['drawing on acknowledgment',{method:'acknowledgment'}],
    ['unconfirmed signature',{accepted:false}],['blank parent name',{name:' '}],['forged receipt',{receipt:{verified:true}}],
  ];
  for(const [label,change]of invalid)check((await post('acknowledge',{...body,...change})).status===400,'Signature validation refuses '+label);
  check((await post('acknowledge',{...body,method:'provider-signature',signature:undefined})).status===409,'Disconnected provider signing is refused instead of falling back to a drawn signature');
  check((await post('acknowledge',{...body,contentHash:'0'.repeat(64)})).status===409,'A drawing cannot be submitted against a different document fingerprint');
  check((await store.getRecord(owner,d.id)).status==='pending','Invalid signature attempts leave the pending document unchanged');

  let result=await post('acknowledge',body),signed=result.data.record;
  check(result.status===200&&signed.status==='acknowledged'&&signed.ackMethod==='drawn-signature','A confirmed drawn signature is saved through the real document route');
  check(JSON.stringify(signed.drawnSignature.drawing)===JSON.stringify(drawing),'The saved record retains the exact bounded strokes');
  const signatureHash=await sha(ink.signatureHashInput(drawing));
  check(signed.drawnSignature.sha256===signatureHash&&signed.receipt.signatureHash===signatureHash,'The server fingerprints the actual drawing rather than trusting a supplied digest');
  check(signed.receipt.evidenceFormat==='eduo-drawn-receipt-v1'&&signed.receipt.evidenceHash===await sha(ink.drawnReceiptHashInput(signed.receipt)),'The receipt fingerprint binds name, timestamp, document version and drawing fingerprint');
  check(signed.receipt.contentHash===d.contentHash&&signed.receipt.documentId===d.id&&signed.receipt.version===d.version,'The drawing receipt identifies the exact published document');
  check(!Number.isNaN(Date.parse(signed.ackAt))&&signed.ackAt===signed.receipt.at&&result.cache==='private, no-store','Signature timestamps come from the server and responses are not cached');
  const encrypted=sql.prepare('SELECT payload FROM school_records WHERE owner=? AND id=?').get(owner,d.id).payload;
  const plaintext=new TextDecoder().decode(await store.decrypt(Uint8Array.from(atob(encrypted),c=>c.charCodeAt(0)),owner));
  check(!encrypted.includes(body.name)&&!encrypted.includes('eduo-ink-v1')&&plaintext.includes(signatureHash),'Actual document and drawing data are stored together inside the encrypted payload');
  let wrongOwner=false;try{await store.decrypt(Uint8Array.from(atob(encrypted),c=>c.charCodeAt(0)),other)}catch{wrongOwner=true}
  check(wrongOwner,'The encrypted signature cannot be decrypted with another account scope');
  const snapshot=docs.documentSnapshot(signed);
  check(snapshot.ackMethod==='drawn-signature'&&snapshot.drawnSignature.sha256===signatureHash,'Version snapshots retain the drawn method and drawing');
  result=await post('acknowledge',body);
  check(result.status===200&&result.data.record.receipt.id===signed.receipt.id&&result.data.record.ackAt===signed.ackAt&&result.data.record.revision===signed.revision,'An exact drawing retry returns the original receipt without a duplicate version or timestamp');
  check((await post('acknowledge',{...body,signature:alternative})).status===409,'A retry cannot overwrite the saved signature with another drawing');
  check((await post('acknowledge',{...body,name:'Another Parent'})).status===409,'A retry cannot replace the recorded signing name');
  check((await post('acknowledge',{...body,method:'acknowledgment',signature:undefined})).status===409,'An acknowledgment cannot replace an existing drawn signature');
  const html=docs.documentReceiptHtml(d.id,signed),text=docs.documentReceiptText(d.id,signed);
  check(html.includes('<svg ')&&html.includes(signatureHash)&&html.includes(signed.receipt.evidenceHash)&&html.includes(signed.receipt.id),'The printable self-contained copy includes the actual drawing and all receipt fingerprints');
  check(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')&&!html.includes('<script>'),'Document text is escaped in signed HTML copies');
  const hostile=docs.documentReceiptHtml(d.id,{...signed,title:'<img src=x onerror=alert(1)>',ackName:'<iframe src="https://foreign.test">'});
  check(!hostile.includes('<img ')&&!hostile.includes('<iframe ')&&hostile.includes('Content-Security-Policy'),'Printable copies do not execute supplied markup or fetch remote resources');
  check(text.includes('Рисуван подпис')&&text.includes(signatureHash)&&text.includes(signed.receipt.evidenceHash),'The text receipt identifies drawing evidence separately from the document fingerprint');
  check(ink.signatureSvg({format:'eduo-ink-v1',width:640,height:240,strokes:[[['"><script>',1],[20,20]]]})==='','The drawing exporter rejects nonnumeric SVG injection');
  check(ink.signatureSvg(drawing).includes('polyline')&&!ink.signatureSvg(drawing).includes('<script'),'Drawing export builds only numeric polylines');

  result=await post('revise-document',{id:d.id,revision:signed.revision});
  check(result.status===200&&result.data.record.drawnSignature.sha256===signatureHash,'Preparing a new draft keeps the already signed version intact');
  result=await post('save-document-draft',{...fields,id:d.id,revision:result.data.record.revision,content:'Updated arrangements require a fresh signature.'});
  result=await post('publish-document',{id:d.id,revision:result.data.record.revision});d=result.data.record;
  check(result.status===200&&d.version===2&&d.status==='pending'&&!d.drawnSignature&&!d.ackMethod&&!d.receipt,'Publishing a replacement clears signing evidence from the new current version');
  check(d.versions[0].drawnSignature.sha256===signatureHash&&d.versions[0].receipt.id===signed.receipt.id,'The previous drawing and receipt remain in immutable version history');
  check(docs.documentReceiptHtml(d.id,d.versions[0]).includes(signatureHash)&&!docs.documentReceiptHtml(d.id,d).includes('<svg '),'Historical exports include the old signature while unsigned replacements do not');
  check((await post('acknowledge',body)).status===409,'An old drawing form cannot sign a replacement version');
  const plain=await post('acknowledge',{id:d.id,version:2,contentHash:d.contentHash,name:'Demo Parent',accepted:true});
  check(plain.status===200&&plain.data.record.ackMethod==='demo-acknowledgment'&&!plain.data.record.drawnSignature,'Legacy typed acknowledgment remains available as a distinct method');
  check((await post('acknowledge',request(d))).status===409,'A drawing cannot silently replace a completed typed acknowledgment');

  const legacy=await store.getRecord(owner,'doc-trip');
  result=await post('acknowledge',{...request(legacy),version:1,contentHash:undefined});
  check(result.status===200&&result.data.record.drawnSignature.sha256===signatureHash&&result.data.record.receipt.contentHash.length===64,'A legacy pending demonstration document can acquire a drawing and server-computed version fingerprint');
  const legacyReceipt=result.data.record.receipt.id;
  check((await post('acknowledge',{...request(legacy),version:1,contentHash:undefined})).data.record.receipt.id===legacyReceipt,'An exact legacy drawing retry retains its original receipt');

  d=await issue();body=request(d);const race=await Promise.all([post('acknowledge',body),post('acknowledge',{...body,signature:alternative})]);
  const winner=race.find(r=>r.status===200)?.data.record;
  check(race.filter(r=>r.status===200).length===1&&race.filter(r=>r.status===409).length===1,'Competing drawing submissions accept exactly one writer');
  check((await store.getRecord(owner,d.id)).receipt.id===winner.receipt.id,'The winning signature receipt remains the only saved receipt');

  d=await issue();body=request(d);const batch=env.DB.batch;let armed=true;
  env.DB.batch=async statements=>{const r=await batch(statements);if(armed){armed=false;throw Error('Synthetic lost signature response')}return r};
  result=await post('acknowledge',body);env.DB.batch=batch;const afterLoss=await store.getRecord(owner,d.id);
  check(result.status===503&&afterLoss.ackMethod==='drawn-signature','A lost response does not erase a committed encrypted signature');
  result=await post('acknowledge',body);check(result.status===200&&result.data.record.receipt.id===afterLoss.receipt.id,'Retry after a lost response recovers the original receipt');

  d=await issue();body=request(d);const beforeAudit=sql.prepare("SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind='audit'").get(owner).n;
  env.DB.batch=async statements=>batch(statements.map((s,i)=>i===1?{run(){throw Error('Synthetic signature audit rollback')}}:s));
  result=await post('acknowledge',body);env.DB.batch=batch;
  check(result.status===503&&(await store.getRecord(owner,d.id)).status==='pending','SQL failure rolls back the drawing and receipt together');
  check(sql.prepare("SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind='audit'").get(owner).n===beforeAudit,'A failed signing transaction adds no success audit');
  result=await post('withdraw-document',{id:d.id,revision:d.revision,reason:'Fixture request no longer applies.'});
  check((await post('acknowledge',body)).status===409&&!result.data.record.drawnSignature,'A withdrawn request cannot acquire a signature');

  d=await issue();const maximum=ink.signatureDrawing(Array.from({length:40},(_,s)=>Array.from({length:50},(_,i)=>[i*12,(s*5+i)%240])));
  result=await post('acknowledge',{...request(d),signature:maximum});
  check(result.status===200&&result.data.record.drawnSignature.drawing.strokes.flat().length===2000,'The documented maximum stroke and point counts can be saved without truncation');
  d=await issue();const large={...d,versions:[{content:'x'.repeat(1000000)}]};(await store.stmt(owner,large)).run();
  result=await post('acknowledge',request(d));
  check(result.status===409&&(await store.getRecord(owner,d.id)).versions[0].content.length===1000000,'Document history capacity refuses a signature without truncating existing versions');
  d=await issue();const secret=env.SCHOOL_ENCRYPTION_KEY;delete env.SCHOOL_ENCRYPTION_KEY;
  result=await post('acknowledge',request(d));env.SCHOOL_ENCRYPTION_KEY=secret;
  check(result.status===503&&(await store.getRecord(owner,d.id)).status==='pending','Unavailable encryption never falls back to storing a plaintext signature');
}
