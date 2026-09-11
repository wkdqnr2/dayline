const $ = s => document.querySelector(s);
const storageKey = 'dayline.records.v1';
let records = JSON.parse(localStorage.getItem(storageKey) || '[]');
let selected = new Date();
selected.setHours(0,0,0,0);
let captureType = 'note';
const fmtKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const koDow = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const shortDow = ['일','월','화','수','목','금','토'];

function save(){ localStorage.setItem(storageKey, JSON.stringify(records)); renderAll(); }
function dateLabel(d){ return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`; }
function monthLabel(d){ return `${d.getFullYear()}년 ${d.getMonth()+1}월`; }
function esc(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function noteRecords(){ return records.filter(r=>r.date===fmtKey(selected)); }

function renderTimeline(){
  const timeline=$('#timeline'); timeline.innerHTML='';
  const start=new Date(selected); start.setDate(start.getDate()-14);
  const todayKey=fmtKey(new Date());
  for(let i=0;i<29;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const key=fmtKey(d); const count=records.filter(r=>r.date===key).length;
    const node=document.createElement('div');
    node.className='day-node'+(key===fmtKey(selected)?' selected':'')+(key===todayKey?' today':'');
    node.innerHTML=`<div class="dow">${shortDow[d.getDay()]}</div><div class="dot"></div><div class="num">${d.getDate()}</div><div class="mini">${count?count+' record'+(count>1?'s':''):''}</div>`;
    node.onclick=()=>{selected=d;renderAll();setTimeout(()=>node.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}),0)};
    timeline.appendChild(node);
  }
  $('#monthTitle').textContent=monthLabel(selected);
  setTimeout(()=>$('.day-node.selected')?.scrollIntoView({inline:'center',block:'nearest'}),0);
}

function renderNotes(){
  $('#selectedWeekday').textContent=koDow[selected.getDay()].toUpperCase();
  $('#selectedDate').textContent=dateLabel(selected);
  const list=$('#notesList'); list.innerHTML=''; const items=noteRecords();
  $('#noteCount').textContent=`${items.length} record${items.length===1?'':'s'}`;
  if(!items.length){list.innerHTML='<div class="empty">이 날짜에는 아직 기록이 없어요.<br>위 입력창에서 첫 생각을 남겨보세요.</div>';}
  items.sort((a,b)=>b.created-a.created).forEach(rec=>{
    const el=$('#noteTemplate').content.firstElementChild.cloneNode(true);
    const labels={note:'NOTE',checklist:'CHECKLIST',mindmap:'MIND MAP'};
    el.querySelector('.kind-badge').textContent=labels[rec.type]||'NOTE';
    el.querySelector('.note-title').textContent=rec.title;
    const body=el.querySelector('.note-body');
    if(rec.type==='checklist'){
      (rec.items||[]).forEach((item,idx)=>{
        const row=document.createElement('label'); row.className='check-row';
        row.innerHTML=`<input type="checkbox" ${item.done?'checked':''}><span>${esc(item.text)}</span>`;
        row.querySelector('input').onchange=e=>{rec.items[idx].done=e.target.checked;save()}; body.appendChild(row);
      });
    } else if(rec.type==='mindmap'){
      const mm=document.createElement('div'); mm.className='mindmap';
      const root=rec.nodes?.[0]||rec.title; const children=(rec.nodes||[]).slice(1);
      mm.innerHTML=`<span class="mind-root">${esc(root)}</span><div class="mind-branch">${children.map(x=>`<span class="mind-child">${esc(x)}</span>`).join('')}</div>`; body.appendChild(mm);
    } else body.textContent=rec.body;
    const tags=el.querySelector('.note-tags'); (rec.tags||[]).forEach(t=>{const s=document.createElement('span');s.textContent='#'+t;tags.appendChild(s)});
    el.querySelector('time').textContent=new Date(rec.created).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    el.querySelector('.delete-btn').onclick=()=>{records=records.filter(r=>r.id!==rec.id);save()};
    list.appendChild(el);
  });
  renderInsights(items);
}

function keywords(text){
  const stop=new Set(['그리고','하지만','그래서','하는','있는','해야','하면','같다','정도','오늘','내일','다음주','메모','생각','정리']);
  const words=(text.match(/[가-힣A-Za-z0-9]{2,}/g)||[]).filter(w=>!stop.has(w));
  const score={}; words.forEach(w=>score[w]=(score[w]||0)+1);
  return Object.entries(score).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
}
function titleFrom(text){ const first=text.split(/[\n.!?]/).map(s=>s.trim()).find(Boolean)||'새 기록'; return first.length>24?first.slice(0,24)+'…':first; }
function lines(text){ return text.split(/\n|,| 그리고 | 해야되고 | 해야 하고 | 해야함 | 해야 함 /).map(x=>x.trim()).filter(Boolean); }
function buildRecord(text,type){
  const tags=keywords(text); const base={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),date:fmtKey(selected),type,title:titleFrom(text),tags,created:Date.now()};
  if(type==='checklist') base.items=lines(text).map(x=>({text:x.replace(/^[-•☐☑]\s*/,''),done:false}));
  else if(type==='mindmap') base.nodes=[titleFrom(text),...tags,...lines(text).slice(1,5)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,6);
  else base.body=text;
  return base;
}
function organizeText(text){
  const ks=keywords(text); const ls=lines(text); const title=titleFrom(text);
  const todos=ls.filter(x=>/(해야|예약|작성|찾|준비|구매|모집|선정|확인|연락)/.test(x)).slice(0,5);
  return {title,ks,todos,summary:ls.slice(0,3).join(' · ')};
}
function renderInsights(items){
  const checks=items.filter(r=>r.type==='checklist').flatMap(r=>r.items||[]); const done=checks.filter(x=>x.done).length;
  const pct=checks.length?Math.round(done/checks.length*100):0; $('#flowScore').textContent=pct+'%'; $('#flowBar').style.width=pct+'%';
  $('#flowText').textContent=checks.length?`${checks.length}개의 할 일 중 ${done}개를 완료했어요.`:'체크리스트를 만들면 오늘의 흐름을 보여드려요.';
  const all=[...new Set(items.flatMap(r=>r.tags||[]))].slice(0,6); $('#keywordChips').innerHTML=(all.length?all:['dayline','timeline']).map(x=>`<span>#${esc(x)}</span>`).join('');
}
function renderAll(){renderTimeline();renderNotes();}

$('#typeSwitch').addEventListener('click',e=>{if(!e.target.dataset.type)return; captureType=e.target.dataset.type; document.querySelectorAll('.type').forEach(b=>b.classList.toggle('active',b===e.target));});
$('#saveBtn').onclick=()=>{const t=$('#quickText').value.trim(); if(!t)return; records.push(buildRecord(t,captureType)); $('#quickText').value=''; save();};
$('#organizeBtn').onclick=()=>{const ta=$('#quickText'); const t=ta.value.trim(); if(!t)return; const o=organizeText(t); const block=`${o.title}\n\n핵심: ${o.summary}${o.todos.length?'\n\n할 일:\n'+o.todos.map(x=>'☐ '+x).join('\n'):''}${o.ks.length?'\n\n#'+o.ks.join(' #'):''}`; ta.value=block; captureType=o.todos.length?'checklist':'note'; document.querySelectorAll('.type').forEach(b=>b.classList.toggle('active',b.dataset.type===captureType));};
$('#todayBtn').onclick=()=>{selected=new Date();selected.setHours(0,0,0,0);renderAll();};
$('#newBtn').onclick=()=>{$('#quickText').focus();};
$('#prevWeek').onclick=()=>{selected.setDate(selected.getDate()-7);renderAll();}; $('#nextWeek').onclick=()=>{selected.setDate(selected.getDate()+7);renderAll();};

if(!records.length){
  const k=fmtKey(selected); records=[
    {id:'sample1',date:k,type:'note',title:'Dayline에 오신 것을 환영해요',body:'떠오르는 생각을 날짜 위에 바로 남겨보세요. 기록은 이 기기에 자동 저장됩니다.',tags:['시작','기록'],created:Date.now()-3000},
    {id:'sample2',date:k,type:'checklist',title:'오늘의 작은 계획',items:[{text:'첫 메모 남기기',done:false},{text:'타임라인 둘러보기',done:false},{text:'마인드맵 만들어보기',done:false}],tags:['오늘','계획'],created:Date.now()-2000},
    {id:'sample3',date:k,type:'mindmap',title:'나의 아이디어',nodes:['새 프로젝트','아이디어','사람','일정','다음 행동'],tags:['아이디어'],created:Date.now()-1000}
  ]; localStorage.setItem(storageKey,JSON.stringify(records));
}
renderAll();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
