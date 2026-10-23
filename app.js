(function(){
const SIDES={groom:{label:'ฝั่งเจ้าบ่าว',c:'var(--groom)',bg:'var(--groom-bg)'},bride:{label:'ฝั่งเจ้าสาว',c:'var(--bride)',bg:'var(--bride-bg)'},both:{label:'ร่วมทั้งสองฝั่ง',c:'var(--both)',bg:'var(--both-bg)'},spare:{label:'สำรอง (ไม่แสดงให้แขก)',c:'var(--spare)',bg:'var(--spare-bg)'}};
let S=null;
const view={open:{},tab:'all',q:'',sel:null,tip:''};
const app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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


/* ---------- guest view (read-only) ---------- */
function renderGuest(){
  const st=S,map=tableMap(st),E=st.event;
  document.title='ผังโต๊ะ '+(E.couple||'งานแต่ง');
  const visible=st.groups.map((g,i)=>({...g,i,list:parseTables(g.tables,st.layout.tables).list})).filter(g=>g.side!=='spare'&&g.name.trim()&&g.list.length);
  const q=view.q.trim().toLowerCase();
  const shown=visible.filter(g=>(view.tab==='all'||g.side===view.tab||g.side==='both')&&(!q||g.name.toLowerCase().includes(q)||(g.cat||'').toLowerCase().includes(q)));
  const sel=view.sel!=null?visible.find(g=>g.i===view.sel):null;
  const hits=sel?sel.list:[];
  const items=[];const catIdx={};
  shown.forEach(g=>{const c=(g.cat||'').trim();
    if(!c){items.push({g});return}
    if(catIdx[c]==null){catIdx[c]=items.length;items.push({cat:c,members:[]})}
    items[catIdx[c]].members.push(g)});
  const gBtn=(g,sub)=>`<button class="gbtn${sub?' sub':''}" data-g="${g.i}" aria-pressed="${view.sel===g.i}"><span class="dot" style="background:${SIDES[g.side].c}"></span><span class="gname">${esc(g.name)}</span><span class="gtab">โต๊ะ ${fmtList(g.list)}</span></button>`;
  const listHTML=items.map(it=>{
    if(it.g)return gBtn(it.g,false);
    if(it.members.length===1&&!view.open[it.cat])return gBtn(it.members[0],false);
    const open=!!q||!!view.open[it.cat]||it.members.some(m=>m.i===view.sel);
    const sides=[...new Set(it.members.map(m=>m.side))];const dot=SIDES[sides.length===1?sides[0]:'both'].c;
    return `<div class="cat${open?' open':''}"><button class="gbtn catbtn" data-cat="${esc(it.cat)}" aria-expanded="${open}"><span class="dot" style="background:${dot}"></span><span class="gname">${esc(it.cat)}</span><span class="gtab">${it.members.length} กลุ่มย่อย</span><span class="chev" aria-hidden="true">›</span></button>${open?`<div class="subs">${it.members.map(m=>gBtn(m,true)).join('')}</div>`:''}</div>`;
  }).join('');
  app.innerHTML=`<div class="wrap">
  <header class="hero">
    <div class="eyebrow">Seating chart</div>
    <h1 class="couple">${esc(E.couple)}</h1>
    ${E.bride||E.groom?`<div class="names"><span>${esc(E.bride)}</span><span class="knot">∞</span><span>${esc(E.groom)}</span></div>`:''}
    <div class="rule"></div>
    <div class="meta">${[E.date,E.venue,E.time].filter(Boolean).map(esc).join('<br>')}</div>
  </header>
  <section class="card">
    <h2>คุณมาในนามกลุ่มไหน</h2>
    <p class="hint">แตะชื่อกลุ่มของคุณ ระบบจะบอกโต๊ะที่นั่งและแสดงตำแหน่งบนผัง</p>
    <div class="tabs" role="group">
      ${[['all','ทั้งหมด'],['groom','แขกเจ้าบ่าว'],['bride','แขกเจ้าสาว']].map(([k,l])=>`<button class="tab" data-tab="${k}" aria-pressed="${view.tab===k}">${l}</button>`).join('')}
    </div>
    <input id="q" class="search" type="search" placeholder="พิมพ์ค้นหากลุ่ม เช่น เพื่อน, ญาติ, ที่ทำงาน" value="${esc(view.q)}">
    <div class="groups">${listHTML||(visible.length?'<div class="empty">ไม่พบกลุ่มนี้ ลองค้นคำอื่น หรือสอบถามเจ้าหน้าที่หน้างาน</div>':'<div class="empty">ยังไม่มีรายชื่อกลุ่ม</div>')}</div>
  </section>
  ${sel?`<section class="card result" id="result">
    <div class="lbl">${esc(SIDES[sel.side].label)}</div>
    <div class="grp">${sel.cat?`<span class="lbl">${esc(sel.cat)} › </span>`:''}${esc(sel.name)}</div>
    <div class="lbl">เชิญนั่งโต๊ะหมายเลข</div>
    <div class="tnums" style="margin-top:8px">${sel.list.map(t=>`<span class="tnum">${t}</span>`).join('')}</div>
    ${sel.list.length>1?'<p class="note">เลือกนั่งโต๊ะใดก็ได้ในกลุ่มนี้ที่ยังมีที่ว่าง</p>':''}
  </section>`:''}
  <section class="card plan-card" id="plan">
    <div class="legend"><span><i style="background:var(--groom)"></i>เจ้าบ่าว</span><span><i style="background:var(--bride)"></i>เจ้าสาว</span><span><i style="background:var(--both)"></i>ร่วม</span><span><i style="background:var(--spare)"></i>สำรอง</span></div>
    ${planHTML(st,map,hits,false)}
    <div class="tip" id="tip">${esc(view.tip||'แตะที่โต๊ะเพื่อดูว่าเป็นของกลุ่มใด')}</div>
  </section>
  <p class="foot">ขอบคุณที่มาร่วมแสดงความยินดีกับเรา</p>
  </div>`;
  app.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{view.tab=b.dataset.tab;renderGuest()});
  const qi=app.querySelector('#q');qi.oninput=()=>{view.q=qi.value;const p=qi.selectionStart;renderGuest();const n=app.querySelector('#q');n.focus();try{n.setSelectionRange(p,p)}catch(e){}};
  app.querySelectorAll('.catbtn').forEach(b=>b.onclick=()=>{const c=b.dataset.cat;view.open[c]=!(b.getAttribute('aria-expanded')==='true');if(!view.open[c]&&view.sel!=null&&S.groups[view.sel]&&S.groups[view.sel].cat===c)view.sel=null;renderGuest()});
  app.querySelectorAll('.gbtn[data-g]').forEach(b=>b.onclick=()=>{const gi=+b.dataset.g;view.sel=view.sel===gi?null:gi;view.tip='';renderGuest();if(view.sel!=null){const r=app.querySelector('#result');r&&r.scrollIntoView&&r.scrollIntoView({behavior:'smooth',block:'start'})}});
  app.querySelectorAll('.tbl').forEach(b=>b.onclick=()=>{const t=+b.dataset.t;const gs=map[t]||[];
    view.tip=gs.length?('โต๊ะ '+t+' : '+gs.map(i=>st.groups[i].side==='spare'?'โต๊ะสำรอง':st.groups[i].name).join(' / ')):('โต๊ะ '+t+' ยังไม่ได้กำหนดกลุ่ม');
    app.querySelector('#tip').textContent=view.tip});
}

fetch('data.json',{cache:'no-cache'})
  .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(d=>{S=normLayout(d);renderGuest()})
  .catch(()=>{app.innerHTML='<div class="wrap"><p class="empty">โหลดผังโต๊ะไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</p></div>'});
})();
