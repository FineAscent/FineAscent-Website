import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./inquiry.js',import.meta.url),'utf8');
function fixture(fetchImpl) {
  let submit;
  const control={disabled:false};
  const button={innerHTML:'Send inquiry',textContent:'',disabled:false};
  const status={hidden:true,setAttribute(){},focus(){}};
  const success={hidden:true,scrollIntoView(){}};
  const panel={style:{}};
  const form={reportValidity:()=>true,querySelector:()=>button,elements:[control,button],setAttribute(){},removeAttribute(){},addEventListener:(_,fn)=>submit=fn,getBoundingClientRect:()=>({height:500}),classList:{add(){}},hidden:false};
  const data={name:'Tester',email:'test+shop@example.invalid',company:'Example & Co',interest:'Bring NobleCart to our stores',message:'Test message',website:''};
  const elements={'business-inquiry':form,'inquiry-status':status,'inquiry-panel':panel,'inquiry-success':success,'success-title':{focus(){}}};
  let ids=0;
  vm.runInNewContext(source,{document:{getElementById:id=>elements[id]},window:{matchMedia:()=>({matches:true})},crypto:{randomUUID:()=>`test-id-${++ids}`},FormData:class {get(key){return data[key]}},fetch:fetchImpl,AbortSignal,Error,setTimeout});
  return {submit:()=>submit({preventDefault(){}}),form,status,success,button,control,data};
}
test('prevents duplicate clicks and shows success only after server acceptance',async()=>{
  let resolve, calls=0;
  const f=fixture(()=>{calls++;return new Promise(r=>resolve=r)});
  const pending=f.submit();
  assert.equal(f.button.textContent,'Sending…');
  assert.equal(f.control.disabled,true);
  await f.submit();
  assert.equal(calls,1);
  assert.equal(f.success.hidden,true);
  resolve(Response.json({ok:true}));
  await pending;
  assert.equal(f.success.hidden,false);
  assert.equal(f.form.hidden,true);
});
test('failure preserves form values and retries the same payload with the same request ID',async()=>{
  const bodies=[];
  const f=fixture(async(_,options)=>{bodies.push(JSON.parse(options.body));return Response.json({ok:false},{status:503})});
  await f.submit();
  assert.equal(f.form.hidden,false);
  assert.equal(f.success.hidden,true);
  assert.equal(f.control.disabled,false);
  assert.equal(f.status.hidden,false);
  assert.equal(f.data.message,'Test message');
  await f.submit();
  assert.equal(bodies[0].requestId,bodies[1].requestId);
  f.data.message='Changed message';
  await f.submit();
  assert.notEqual(bodies[1].requestId,bodies[2].requestId);
});
