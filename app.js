(() => {
  const { teams, fixtures } = window.TOURNAMENT_DATA;
  const STORAGE_KEY = 'smashcourt-pools-playoffs-v2';
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const poolOf = id => id <= 4 ? 'A' : 'B';
  const poolFixtures = fixtures.filter(f => poolOf(f.a) === poolOf(f.b)); // preserve original fixture order
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
  let results = saved.poolScores || {};
  let playoffResults = saved.playoffScores || {};
  const $ = id => document.getElementById(id);
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0]).join('').replace(/[()]/g,'').slice(0,2).toUpperCase();
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parseScore(raw) { const m=String(raw||'').trim().match(/^(\d{1,3})\s*[-–—:]\s*(\d{1,3})$/); if(!m)return null; const a=+m[1],b=+m[2]; if(a===b)return null; return {a,b,diff:a-b}; }
  function statsForPool(pool) {
    const ids=teams.filter(t=>poolOf(t.id)===pool).map(t=>t.id);
    const stats=Object.fromEntries(ids.map(id=>[id,{played:0,wins:0,losses:0,points:0,diff:0}]));
    poolFixtures.filter(f=>poolOf(f.a)===pool).forEach(f=>{const s=parseScore(results[f.match]);if(!s)return;const a=stats[f.a],b=stats[f.b];a.played++;b.played++;a.diff+=s.diff;b.diff-=s.diff;if(s.diff>0){a.wins++;b.losses++;a.points+=2;}else{b.wins++;a.losses++;b.points+=2;}});
    return teams.filter(t=>ids.includes(t.id)).map(t=>({...t,...stats[t.id]})).sort((a,b)=>b.points-a.points||b.diff-a.diff||b.wins-a.wins||a.id-b.id);
  }
  const teamLabel = t => t ? `${t.name} · ${t.icon} + ${t.sub}` : 'Waiting for pool results';
  function renderStandings() {
    for(const pool of ['A','B']) {
      const body=$(`pool-${pool.toLowerCase()}-body`);
      body.innerHTML=statsForPool(pool).map((t,i)=>`<tr><td><span class="rank ${i<2?'top':''}">${i+1}</span></td><td><div class="team-cell"><span class="team-avatar">${initials(t.icon)}</span><div><div class="team-name">${safe(t.name)}</div><div class="player-line">${safe(t.icon)} + ${safe(t.sub)}</div></div></div></td><td>${t.played}</td><td>${t.wins}</td><td>${t.losses}</td><td><span class="points-badge">${t.points}</span></td><td class="${t.diff>0?'diff-pos':t.diff<0?'diff-neg':''}">${t.diff>0?'+':''}${t.diff}</td></tr>`).join('');
    }
  }
  function renderTeams(){ $('team-grid').innerHTML=teams.map(t=>`<article class="team-card"><div class="team-card-top"><span class="team-avatar">${initials(t.icon)}</span><span class="team-tag">POOL ${poolOf(t.id)} · TEAM ${String(t.id).padStart(2,'0')}</span></div><h3>${safe(t.icon)}</h3><p><span class="pair-plus">+</span> ${safe(t.sub)}</p></article>`).join(''); }
  function renderFixtures(){
    const selected=$('pool-filter').value;
    const list=poolFixtures.filter(f=>selected==='all'||poolOf(f.a)===selected);
    let html='',lastPool=null;
    list.forEach(f=>{const pool=poolOf(f.a);if(pool!==lastPool){html+=`<div class="round-divider">POOL ${pool} <span>·</span> ${pool==='A'?'TEAMS 1–4':'TEAMS 5–8'}</div>`;lastPool=pool;}
      const a=teamById[f.a],b=teamById[f.b],raw=results[f.match]||'',s=parseScore(raw),complete=!!s;
      const winner=complete?(s.diff>0?a:b):null, diff=complete?(s.diff>0?'+':'')+s.diff:'—';
      html+=`<article class="match-card"><div class="match-meta"><span class="match-number">POOL ${pool} · FIXTURE ${String(f.match).padStart(2,'0')}</span><span class="status ${complete?'done':''}">${complete?'COMPLETED':'UPCOMING'}</span></div><div class="match-body"><div class="side-team"><b>${safe(a.name)}</b><span>${safe(a.icon)} + ${safe(a.sub)}</span></div><input class="score-input" type="text" inputmode="numeric" maxlength="9" aria-label="Match ${f.match} score" placeholder="e.g. 21-18" value="${safe(raw)}" data-score="${f.match}"><div class="side-team right"><b>${safe(b.name)}</b><span>${safe(b.icon)} + ${safe(b.sub)}</span></div></div><div class="match-result"><span class="${complete?'result-winner':'result-pending'}">${complete?safe(winner.name+' wins'):'Enter final score'}</span><span class="difference ${complete?(s.diff>0?'positive':'negative'):''}">${complete?'Difference '+diff:'Difference —'}</span></div></article>`;
    });
    $('fixture-list').innerHTML=html||'<div class="empty-state">No fixtures in this pool.</div>';
    $('fixture-list').querySelectorAll('[data-score]').forEach(input=>{input.addEventListener('change',()=>savePoolScore(input));input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();savePoolScore(input);input.blur();}});});
  }
  function savePoolScore(input){const id=input.dataset.score,value=input.value.trim();if(!value){delete results[id];persist();renderAll();showToast('Score cleared.');return;}if(!parseScore(value)){input.classList.add('invalid');showToast('Enter a valid score like 21-18. Scores cannot be tied.');setTimeout(()=>input.classList.remove('invalid'),900);return;}results[id]=value.replace(/[–—:]/g,'-');persist();renderAll();showToast('Pool score saved. Standings and qualifiers updated.');}
  function playoffWinner(key){const s=parseScore(playoffResults[key]);if(!s)return null;const teamsNow=playoffTeams();const pair=teamsNow[key];return pair&&pair[0]&&pair[1]?(s.diff>0?pair[0]:pair[1]):null;}
  function playoffTeams(){const A=statsForPool('A'),B=statsForPool('B');const q1=[A[0],B[0]],q2=[A[1],B[1]];const q1w=playoffResults.q1&&parseScore(playoffResults.q1)?(parseScore(playoffResults.q1).diff>0?q1[0]:q1[1]):null;const q1l=playoffResults.q1&&parseScore(playoffResults.q1)?(parseScore(playoffResults.q1).diff>0?q1[1]:q1[0]):null;const q2w=playoffResults.q2&&parseScore(playoffResults.q2)?(parseScore(playoffResults.q2).diff>0?q2[0]:q2[1]):null;const elim=[q1l,q2w];const ew=playoffResults.el&&parseScore(playoffResults.el)?(parseScore(playoffResults.el).diff>0?elim[0]:elim[1]):null;return {q1,q2,el:elim,final:[q1w,ew]};}
  function renderPlayoffs(){const p=playoffTeams();const done=pool=>poolFixtures.filter(f=>poolOf(f.a)===pool).every(f=>parseScore(results[f.match]));const started=pool=>poolFixtures.some(f=>poolOf(f.a)===pool&&parseScore(results[f.match]));const poolSlot=(pool,idx,t)=>done(pool)?teamLabel(t):`Pool ${pool} – ${idx===0?'1st':'2nd'} place`+(started(pool)?` (now: ${t.name})`:'');const labels={'q1-a':poolSlot('A',0,p.q1[0]),'q1-b':poolSlot('B',0,p.q1[1]),'q2-a':poolSlot('A',1,p.q2[0]),'q2-b':poolSlot('B',1,p.q2[1]),'el-a':p.el[0]?teamLabel(p.el[0]):'Loser of Qualifier 1','el-b':p.el[1]?teamLabel(p.el[1]):'Winner of Qualifier 2','final-a':p.final[0]?teamLabel(p.final[0]):'Winner of Qualifier 1','final-b':p.final[1]?teamLabel(p.final[1]):'Winner of Eliminator'};Object.entries(labels).forEach(([id,l])=>{$(id).textContent=l;});
    for(const key of ['q1','q2','el','final']){const input=$(`${key}-score`);if(document.activeElement!==input)input.value=playoffResults[key]||'';}
    const q1s=parseScore(playoffResults.q1),q2s=parseScore(playoffResults.q2),els=parseScore(playoffResults.el),fs=parseScore(playoffResults.final);
    $('q1-note').textContent=q1s?`Winner: ${playoffWinner('q1')?.name||'—'}. Loser advances to the Eliminator.`:'Winner advances directly to the Final. Loser goes to the Eliminator.';
    $('q2-note').textContent=q2s?`Winner: ${playoffWinner('q2')?.name||'—'} advances to the Eliminator.`:'Winner faces the Qualifier 1 loser.';
    $('el-note').textContent=els?`Winner: ${playoffWinner('el')?.name||'—'} advances to the Final.`:'Winner advances to the Final.';
    $('final-note').textContent=fs?`CHAMPION: ${playoffWinner('final')?.name||'—'} 🏆`:'The winner is the tournament champion 🏆';
    $('champion-banner').textContent=fs&&playoffWinner('final')?`🏆 TOURNAMENT CHAMPION: ${playoffWinner('final').name} — ${playoffWinner('final').icon} + ${playoffWinner('final').sub}`:'🏆 The champion will appear here after the Grand Final score is entered.';
    document.querySelectorAll('.playoff-score').forEach(input=>{input.disabled=!canPlayoff(input.id,p);input.title=input.disabled?'Waiting for the required teams to qualify':'';});
  }
  function canPlayoff(id,p){if(id.startsWith('q1-')||id.startsWith('q2-'))return true;if(id==='el-score')return !!parseScore(playoffResults.q1)&&!!parseScore(playoffResults.q2);if(id==='final-score')return !!parseScore(playoffResults.q1)&&!!parseScore(playoffResults.el);return true;}
  function savePlayoff(input){const key=input.id.replace('-score',''),v=input.value.trim();if(!v){delete playoffResults[key];if(key==='q1'){delete playoffResults.el;delete playoffResults.final;}if(key==='q2')delete playoffResults.el;if(key==='el')delete playoffResults.final;persist();renderAll();showToast('Playoff score cleared.');return;}if(!parseScore(v)){input.classList.add('invalid');showToast('Enter a valid score like 21-18. Scores cannot be tied.');setTimeout(()=>input.classList.remove('invalid'),900);return;}if((key==='el'&&(!parseScore(playoffResults.q1)||!parseScore(playoffResults.q2)))||(key==='final'&&(!parseScore(playoffResults.q1)||!parseScore(playoffResults.el)))){showToast('The previous playoff matches must be completed first.');return;}playoffResults[key]=v.replace(/[–—:]/g,'-');if(key==='q1'){delete playoffResults.el;delete playoffResults.final;}if(key==='q2')delete playoffResults.el,delete playoffResults.final;if(key==='el')delete playoffResults.final;persist();renderAll();showToast('Playoff result saved.');}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({poolScores:results,playoffScores:playoffResults}));}catch(_){}}
  function renderAll(){renderStandings();renderFixtures();renderPlayoffs();}
  let toastTimer;function showToast(message){const toast=$('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);}
  function exportResults(){const rows=[['POOL MATCHES'],['Match','Pool','Team A','Players A','Team B','Players B','Score','Difference A-B','Winner','Points A','Points B']];poolFixtures.forEach(f=>{const a=teamById[f.a],b=teamById[f.b],s=parseScore(results[f.match]);rows.push([f.match,poolOf(f.a),a.name,`${a.icon} + ${a.sub}`,b.name,`${b.icon} + ${b.sub}`,results[f.match]||'',s?(s.diff>0?'+':'')+s.diff:'',s?(s.diff>0?a.name:b.name):'',s?(s.diff>0?2:0):'',s?(s.diff<0?2:0):'']);});rows.push([],['POOL STANDINGS']);for(const pool of ['A','B']){rows.push([`POOL ${pool}`,'Team','Icon Player','Sub Player','Played','Wins','Losses','Points','Difference']);statsForPool(pool).forEach((t,i)=>rows.push([i+1,t.name,t.icon,t.sub,t.played,t.wins,t.losses,t.points,t.diff]));}rows.push([],['PLAYOFFS'],['Match','Team A','Score','Team B','Winner']);const p=playoffTeams();for(const [key,label,pair] of [['q1','Qualifier 1',p.q1],['q2','Qualifier 2',p.q2],['el','Eliminator',p.el],['final','Grand Final',p.final]]){const s=parseScore(playoffResults[key]);rows.push([label,pair[0]?.name||'',playoffResults[key]||'',pair[1]?.name||'',s?(s.diff>0?pair[0]?.name:pair[1]?.name)||'':'']);}const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='smashcourt-tournament-results.csv';a.click();URL.revokeObjectURL(url);showToast('Results exported as CSV.');}
  $('pool-filter').addEventListener('change',renderFixtures);$('export-btn').addEventListener('click',exportResults);
  document.querySelectorAll('.playoff-score').forEach(input=>{input.addEventListener('change',()=>savePlayoff(input));input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();savePlayoff(input);input.blur();}});});
  $('reset-btn').addEventListener('click',()=>{if(confirm('Reset all pool and playoff scores? This cannot be undone.')){results={};playoffResults={};persist();renderAll();showToast('All scores have been reset.');}});
  renderTeams();renderAll();
})();
