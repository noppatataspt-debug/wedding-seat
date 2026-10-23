(function(){
const SIDES={groom:{label:'ฝั่งเจ้าบ่าว',c:'var(--groom)',bg:'var(--groom-bg)'},bride:{label:'ฝั่งเจ้าสาว',c:'var(--bride)',bg:'var(--bride-bg)'},both:{label:'ร่วมทั้งสองฝั่ง',c:'var(--both)',bg:'var(--both-bg)'},spare:{label:'สำรอง (ไม่แสดงให้แขก)',c:'var(--spare)',bg:'var(--spare-bg)'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=window.supabase.createClient(window.SEAT_CONFIG.url,window.SEAT_CONFIG.anonKey);
const TABLE='seating_config';
let S=null;
const view={open:{},tab:'all',q:'',sel:null,tip:'',admin:false,draft:null,status:'',saving:false};
const app=document.getElementById('app');
function parseTables(str,max){
  const out=[],errs=[];
  String(str||'').split(/[,\s]+/).filter(Boolean).forEach(p=>{
    const m=p.match(/^(\d+)(?:-(\d+))?$/);
    if(!m){errs.push('อ่าน "'+p+'" ไม่ได้');return}
    let a=+m[1],b=m[2]?+m[2]:a; if(b<a)[a,b]=[b,a];
    for(let i=a;i<=b;i++){ if(i<1||i>max){errs.push('โต๊ะ '+i+' เกินจำนวนโต๊ะ');} else if(!out.includes(i)) out.push(i); }
  });
  return {list:out.sort((x,y)=>x-y),errs:[...new Set(errs)]};
}
function tableMap(st){
  const m={}; st.groups.forEach((g,gi)=>parseTables(g.tables,st.layout.tables).list.forEach(t=>{(m[t]=m[t]||[]).push(gi)})); return m;
}
function fmtList(l){ // 3,4,5,8 -> 3-5, 8
  const r=[];let i=0;while(i<l.length){let j=i;while(j+1<l.length&&l[j+1]===l[j]+1)j++;r.push(j>i?l[i]+'–'+l[j]:''+l[i]);i=j+1}return r.join(', ');
}
/* layout: each side is a list of columns {n: tables in column, start: empty rows above}.
   Numbering runs row by row, left side first, then right side — same as the venue plan. */
function normLayout(st){
  const L=st.layout||{};
  if(!Array.isArray(L.left)){ // older format -> columns
    const N=+L.tables||40,pr=+L.perRow||2,h=Math.ceil(N/2);
    L.left=Array.from({length:pr},(_,i)=>({n:Math.ceil((h-i)/pr),start:0}));
    L.right=Array.from({length:pr},(_,i)=>({n:Math.ceil((N-h-i)/pr),start:0}));
  }
  const fix=c=>{const o={n:Math.max(0,Math.min(c.max?+c.max:40,parseInt(c.n)||0)),start:Math.max(0,Math.min(20,parseInt(c.start)||0))};
    if(c.extra){o.extra=true;o.max=+c.max||3;o.align='bottom'}return o};
  L.left=L.left.map(fix);L.right=L.right.map(fix);
  // the alcove beside the right wall near the doors: up to 3 overflow tables
  if(!L.right.some(c=>c.extra))L.right.push({n:0,start:0,extra:true,max:3,align:'bottom'});
  L.right.sort((a,b)=>(a.extra?1:0)-(b.extra?1:0));
  L.tables=[...L.left,...L.right].reduce((a,c)=>a+c.n,0);
  delete L.perRow;delete L.order;
  st.layout=L;return st;
}
function positions(st){
  const side=all=>{
    const cols=all.filter(c=>c.n>0);
    const base=Math.max(1,...cols.filter(c=>c.align!=='bottom').map(c=>c.start+c.n));
    cols.forEach(c=>{c._s=c.align==='bottom'?Math.max(0,base-c.n):c.start});
    const rows=Math.max(base,...cols.map(c=>c._s+c.n));const cells=[];
    for(let r=0;r<rows;r++)cols.forEach((c,ci)=>{if(r>=c._s&&r<c._s+c.n)cells.push({row:r+1,col:ci+1,extra:!!c.extra})});
    return {cols:Math.max(1,cols.length),rows,cells};
  };
  const left=side(st.layout.left.map(c=>({...c}))),right=side(st.layout.right.map(c=>({...c})));
  // regular tables first (left then right, row by row); alcove tables get the last numbers so adding them never renumbers the rest
  let t=0;
  [false,true].forEach(ex=>[left,right].forEach(s=>s.cells.forEach(c=>{if(c.extra===ex)c.t=++t})));
  return {left,right};
}
function planHTML(st,map,hits,preview){
  const {left,right}=positions(st);
  const tbl=x=>{const t=x.t;
    const gs=map[t]||[];const g=gs.length?st.groups[gs[0]]:null;const sd=SIDES[g?g.side:'spare'];
    const cls=hits.length?(hits.includes(t)?'hit':'dim'):'';
    const label=g&&g.side!=='spare'?esc(g.name):(g?'สำรอง':'');
    return `<${preview?'div':'button'} class="tbl ${cls}" data-t="${t}" style="grid-row:${x.row};grid-column:${x.col}" aria-label="โต๊ะ ${t}${g?' '+esc(g.name):''}"><span class="c" style="background:${sd.bg};border-color:${sd.c}">${t}</span>${preview?'':`<span class="n">${label}</span>`}</${preview?'div':'button'}>`;
  };
  const L=left.cols,R=right.cols,rows=Math.max(left.rows,right.rows);
  const cells=[...left.cells,...right.cells.map(c=>({...c,col:c.col+L+1}))];
  return `<div class="stage">STAGE · เวที</div>
    <div class="hall" style="grid-template-columns:repeat(${L},minmax(0,1fr)) var(--walk-w) repeat(${R},minmax(0,1fr));grid-template-rows:repeat(${rows},auto)">
      ${cells.map(tbl).join('')}<div class="walk" style="grid-column:${L+1};grid-row:1 / span ${rows}"><span>WALK WAY</span></div>
    </div>
    <div class="door"><span>ประตู</span><span>ประตู</span><span>ประตู</span></div>`;
}


/* ---------- admin view ---------- */
function issuesOf(d){
  const N=+d.layout.tables,map={},out=[];
  d.groups.forEach((g,gi)=>parseTables(g.tables,N).list.forEach(t=>(map[t]=map[t]||[]).push(g.name||('กลุ่มที่ '+(gi+1)))));
  const dup=Object.entries(map).filter(([,v])=>v.length>1);
  dup.forEach(([t,v])=>out.push('โต๊ะ '+t+' ซ้ำกัน: '+v.join(', ')));
  const free=[];for(let t=1;t<=N;t++)if(!map[t])free.push(t);
  if(free.length)out.push('ยังไม่มีกลุ่ม: โต๊ะ '+fmtList(free));
  return out;
}
function renderAdmin(){
  const d=view.draft,N=+d.layout.tables;
  const iss=issuesOf(d);
  app.innerHTML=`<div class="wrap admin">
  <div class="actions" style="justify-content:space-between"><h2 style="margin:0;font-weight:500">จัดการผังโต๊ะ</h2><button class="btn ghost small" id="back">ดูหน้าแขก</button></div>

  <section class="card"><h3>ข้อมูลงาน</h3>
    <div class="grid2">
      <label class="field">ชื่อบนหัว<input id="e_couple" value="${esc(d.event.couple)}"></label>
      <label class="field">วันที่<input id="e_date" value="${esc(d.event.date)}"></label>
      <label class="field">เจ้าสาว<input id="e_bride" value="${esc(d.event.bride)}"></label>
      <label class="field">เจ้าบ่าว<input id="e_groom" value="${esc(d.event.groom)}"></label>
      <label class="field">สถานที่<input id="e_venue" value="${esc(d.event.venue)}"></label>
      <label class="field">เวลา<input id="e_time" value="${esc(d.event.time)}"></label>
    </div>
  </section>

  <section class="card"><h3>ผังห้อง · รวม ${N} โต๊ะ</h3>
    <p class="hint">กำหนดแต่ละแนวตั้ง (column) ว่ามีกี่โต๊ะ ถ้าแนวไหนติดกำแพงหรือเสาด้านบน ให้ใส่จำนวนแถวที่เว้นไว้ เลขโต๊ะเรียงทีละแถว ฝั่งซ้ายก่อนแล้วต่อฝั่งขวา</p>
    <div class="cols-wrap">
      ${['left','right'].map(sd=>`<div class="colset"><div class="colhead">${sd==='left'?'ฝั่งซ้ายของทางเดิน':'ฝั่งขวาของทางเดิน'}</div>
        <div class="colrow colrow-h"><span></span><span>จำนวนโต๊ะ</span><span>เว้นด้านบน</span><span></span></div>
        ${d.layout[sd].map((c,ci)=>c.extra?`<div class="colrow extra"><span class="cl">แนว ${ci+1}</span>
          <input type="number" min="0" max="${c.max}" inputmode="numeric" id="c_${sd}_${ci}_n" data-sd="${sd}" data-ci="${ci}" data-f="n" value="${c.n}">
          <span class="cl">ชิดด้านล่าง</span><span></span>
          <span class="xnote">ช่องข้างกำแพงขวาใกล้ประตู ใส่ได้ 0–${c.max} โต๊ะ · ใส่ 0 = ไม่ใช้ · เลขโต๊ะจะต่อท้ายสุด จึงไม่กระทบเลขโต๊ะอื่น</span></div>`
          :`<div class="colrow"><span class="cl">แนว ${ci+1}</span>
          <input type="number" min="0" max="40" inputmode="numeric" id="c_${sd}_${ci}_n" data-sd="${sd}" data-ci="${ci}" data-f="n" value="${c.n}">
          <input type="number" min="0" max="20" inputmode="numeric" id="c_${sd}_${ci}_s" data-sd="${sd}" data-ci="${ci}" data-f="start" value="${c.start}">
          <button class="x" data-delcol="${sd}:${ci}" aria-label="ลบแนว">ลบ</button></div>`).join('')}
        <button class="btn ghost small" data-addcol="${sd}">+ เพิ่มแนว</button></div>`).join('')}
    </div>
    <p class="hint" style="margin:12px 0 6px">แนว 1 คือแนวซ้ายสุดของแต่ละฝั่ง · ตัวอย่างผังตอนนี้:</p>
    <div class="mini">${planHTML(d,tableMap(d),[],true)}</div>
  </section>

  <section class="card"><h3>กลุ่มแขก และหมายเลขโต๊ะ</h3>
    <p class="hint">ใส่โต๊ะเป็นช่วงหรือหลายตัวคั่นด้วยจุลภาค เช่น <b>5-8</b> หรือ <b>3, 7, 12-14</b> · กลุ่ม "สำรอง" จะไม่แสดงในรายการให้แขกเลือก<br>
    <b>หมวดใหญ่:</b> กลุ่มที่ใส่หมวดใหญ่ชื่อเดียวกันจะรวมเป็นปุ่มเดียวในหน้าแขก แตะแล้วจึงเห็นกลุ่มย่อย เช่น หมวด "เพื่อนเจ้าบ่าว" → มหาลัย, จภ. · เว้นว่างได้ถ้าไม่ต้องการแบ่ง</p>
    <datalist id="catlist">${[...new Set(d.groups.map(g=>(g.cat||'').trim()).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
    <div class="glist">${d.groups.map((g,i)=>{const p=parseTables(g.tables,N);return `<div class="grow" data-i="${i}">
      <input class="full catin" data-k="cat" list="catlist" placeholder="หมวดใหญ่ (ถ้ามี) เช่น เพื่อนเจ้าบ่าว" value="${esc(g.cat||'')}">
      <input class="full" data-k="name" placeholder="ชื่อกลุ่ม เช่น มหาลัย" value="${esc(g.name)}">
      <div class="row3"><input data-k="tables" inputmode="numeric" placeholder="โต๊ะ เช่น 5-8" value="${esc(g.tables)}">
      <select data-k="side">${Object.entries(SIDES).map(([k,v])=>`<option value="${k}" ${g.side===k?'selected':''}>${v.label.replace(' (ไม่แสดงให้แขก)','')}</option>`).join('')}</select>
      <button class="x" data-up="${i}" aria-label="เลื่อนขึ้น" ${i===0?'disabled':''}>▲</button>
      <button class="x" data-down="${i}" aria-label="เลื่อนลง" ${i===d.groups.length-1?'disabled':''}>▼</button>
      <button class="x" data-del="${i}" aria-label="ลบกลุ่ม">ลบ</button></div>
      ${p.errs.length?`<div class="err">${esc(p.errs.join(' · '))}</div>`:''}
    </div>`}).join('')}</div>
    <div class="actions" style="margin-top:10px"><button class="btn ghost small" id="add">+ เพิ่มกลุ่ม</button></div>
  </section>

  <div class="issues ${iss.length?'':'ok'}">${iss.length?iss.map(esc).join('<br>'):'ทุกโต๊ะมีกลุ่มแล้ว และไม่มีโต๊ะซ้ำ'}</div>

  <section class="card"><h3>QR Code สำหรับแขก</h3>
    <p class="hint">วางลิงก์สาธารณะของหน้านี้ (จากปุ่ม Share ของ Claude) แล้วกดบันทึก QR จะชี้มาที่ลิงก์นี้</p>
    <div class="qrbox"><canvas id="qr" width="300" height="300"></canvas>
      <div class="qside"><label class="field">ลิงก์สำหรับแขก<input id="g_url" placeholder="https://claude.ai/..." value="${esc(d.guestUrl)}"></label>
      <div class="actions"><button class="btn ghost small" id="dlqr">บันทึกรูป QR</button></div></div></div>
  </section>

  <div class="actions"><button class="btn" id="save" ${view.saving?'disabled':''}>${view.saving?'กำลังบันทึก…':'บันทึกและเผยแพร่'}</button><button class="btn ghost" id="cancel">ยกเลิก</button><span class="status" id="status">${esc(view.status)}</span></div>
  <details><summary class="status">สำรองข้อมูล (JSON)</summary><textarea class="json" readonly>${esc(JSON.stringify(d))}</textarea></details>
  </div>`;

  const bind=(id,fn)=>{const el=app.querySelector('#'+id);if(el)el.addEventListener('change',()=>{fn(el.value);renderAdmin()})};
  ['couple','date','bride','groom','venue','time'].forEach(k=>{const el=app.querySelector('#e_'+k);el.oninput=()=>{d.event[k]=el.value}});
  app.querySelectorAll('[data-sd]').forEach(el=>el.addEventListener('change',()=>{d.layout[el.dataset.sd][+el.dataset.ci][el.dataset.f]=el.value;normLayout(d);const id=el.id;renderAdmin();const n=app.querySelector('#'+id);n&&n.focus()}));
  app.querySelectorAll('[data-addcol]').forEach(b=>b.onclick=()=>{d.layout[b.dataset.addcol].push({n:8,start:0});normLayout(d);renderAdmin()});
  app.querySelectorAll('[data-delcol]').forEach(b=>b.onclick=()=>{const [sd,ci]=b.dataset.delcol.split(':');if(d.layout[sd].filter(c=>!c.extra).length<=1)return;d.layout[sd].splice(+ci,1);normLayout(d);renderAdmin()});
  const gu=app.querySelector('#g_url');gu.oninput=()=>{d.guestUrl=gu.value.trim();drawQR()};
  app.querySelectorAll('.grow').forEach(row=>{const i=+row.dataset.i;
    row.querySelectorAll('[data-k]').forEach(el=>{
      el.oninput=()=>{d.groups[i][el.dataset.k]=el.value};
      el.onchange=()=>{d.groups[i][el.dataset.k]=el.value;renderAdmin()};
    })});
  app.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{d.groups.splice(+b.dataset.del,1);renderAdmin()});
  // ลำดับในรายการนี้ = ลำดับที่แขกเห็น (หมวดใหญ่จะแสดงตามตำแหน่งของกลุ่มแรกในหมวด)
  app.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.up;if(i>0){[d.groups[i-1],d.groups[i]]=[d.groups[i],d.groups[i-1]];renderAdmin()}});
  app.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>{const i=+b.dataset.down;if(i<d.groups.length-1){[d.groups[i],d.groups[i+1]]=[d.groups[i+1],d.groups[i]];renderAdmin()}});
  app.querySelector('#add').onclick=()=>{d.groups.push({name:'',side:'groom',tables:''});renderAdmin();const rows=app.querySelectorAll('.grow input[data-k="name"]');rows[rows.length-1].focus()};
  app.querySelector('#back').onclick=()=>{location.href='index.html'};
  app.querySelector('#cancel').onclick=()=>{view.draft=JSON.parse(JSON.stringify(S));view.status='';renderAdmin()};
  app.querySelector('#save').onclick=save;
  app.querySelector('#dlqr').onclick=downloadQR;
  drawQR();
}
function qrValue(){return (view.draft&&view.draft.guestUrl)||S.guestUrl||''}
function drawQR(){
  const c=app.querySelector('#qr');if(!c)return;const v=qrValue();
  if(window.QRious&&v){new QRious({element:c,value:v,size:300,level:'M',background:'#ffffff',foreground:'#2f3438'})}
  else{const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,300);x.fillStyle='#7a8189';x.font='16px sans-serif';x.textAlign='center';x.fillText(v?'กำลังโหลด QR…':'ใส่ลิงก์ก่อน',150,155)}
}
async function downloadQR(){
  const st=app.querySelector('#status');
  if(!qrValue()){st.textContent='ใส่ลิงก์สำหรับแขกก่อน';return}
  // compose a print-friendly card
  const cv=document.createElement('canvas');cv.width=900;cv.height=1100;const x=cv.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,900,1100);
  const q=document.createElement('canvas');new QRious({element:q,value:qrValue(),size:700,level:'M',background:'#ffffff',foreground:'#2f3438'});
  x.fillStyle='#2f3438';x.textAlign='center';x.font='80px Allura, cursive';x.fillText(view.draft.event.couple,450,120);
  x.drawImage(q,100,170,700,700);
  x.font='40px Kanit, sans-serif';x.fillText('สแกนเพื่อดูโต๊ะของคุณ',450,950);
  x.font='28px Kanit, sans-serif';x.fillStyle='#7a8189';x.fillText('Seating chart',450,1010);
  cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='QR-ผังโต๊ะ.png';document.body.appendChild(a);a.click();a.remove();st.textContent='บันทึกรูปแล้ว'},'image/png');
}

function emptyState(){return {event:{couple:'',bride:'',groom:'',date:'',venue:'',time:''},layout:{left:[{n:10,start:0}],right:[{n:10,start:0}]},groups:[],guestUrl:''}}
async function loadState(){
  const {data,error}=await sb.from(TABLE).select('data').eq('id',1).maybeSingle();
  if(error) throw error;
  const d=normLayout(data&&data.data?data.data:emptyState());
  if(!d.guestUrl){try{d.guestUrl=new URL('index.html',location.href).href}catch(e){d.guestUrl=''}}
  return d;
}
async function save(){
  const d=normLayout(view.draft);
  d.groups=d.groups.filter(g=>g.name.trim()||g.tables.trim()).map(g=>{const o={name:g.name.trim(),side:g.side,tables:g.tables.trim()};const c=(g.cat||'').trim();if(c)o.cat=c;return o});
  view.saving=true;view.status='';renderAdmin();
  const {error}=await sb.from(TABLE).upsert({id:1,data:d,updated_at:new Date().toISOString()});
  view.saving=false;
  if(error){view.status='บันทึกไม่สำเร็จ: '+error.message}
  else{S=JSON.parse(JSON.stringify(d));view.draft=JSON.parse(JSON.stringify(d));view.status='บันทึกแล้ว หน้าแขกจะอัปเดตให้อัตโนมัติ'}
  renderAdmin();
}
const origRender=renderAdmin;
renderAdmin=function(){
  origRender();
  const w=app.querySelector('.wrap');
  if(w&&!app.querySelector('#logout')){w.insertAdjacentHTML('beforeend','<button class="btn ghost small" id="logout" style="align-self:center">ออกจากระบบ</button>');
    app.querySelector('#logout').onclick=async()=>{await sb.auth.signOut();showLogin()}}
};
function showLogin(){
  app.innerHTML='<div class="wrap" style="max-width:420px"><section class="card"><h2>เข้าสู่ระบบผู้จัดงาน</h2><p class="hint">ใช้อีเมลและรหัสผ่านที่ตั้งไว้ใน Supabase</p><form id="lf" class="admin" style="gap:10px"><input id="le" type="email" autocomplete="username" placeholder="อีเมล" required class="search" style="margin:0"><input id="lp" type="password" autocomplete="current-password" placeholder="รหัสผ่าน" required class="search" style="margin:0"><button class="btn" type="submit">เข้าสู่ระบบ</button><p id="lerr" class="pin-err"></p></form></section></div>';
  document.getElementById('lf').onsubmit=async e=>{e.preventDefault();
    const {error}=await sb.auth.signInWithPassword({email:document.getElementById('le').value.trim(),password:document.getElementById('lp').value});
    if(error){document.getElementById('lerr').textContent='อีเมลหรือรหัสผ่านไม่ถูกต้อง';return}
    boot()};
}
async function boot(){
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session) return showLogin();
    S=await loadState(); view.draft=JSON.parse(JSON.stringify(S)); view.admin=true; view.status=''; renderAdmin();
  }catch(e){app.innerHTML='<div class="wrap"><p class="empty">โหลดข้อมูลไม่สำเร็จ: '+esc(e.message||e)+'</p></div>'}
}
boot();
})();
