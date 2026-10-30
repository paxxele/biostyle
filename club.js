const { createClient } = window.supabase;
const sb = createClient(window.BIOSTYLE_SUPABASE_URL, window.BIOSTYLE_SUPABASE_KEY);
const rewardsFallback = [
  {id:1,name:'10% de descuento',description:'Un descuento para tu próxima compra.',points_cost:100},
  {id:2,name:'15% de descuento',description:'Un beneficio especial para tu próxima compra.',points_cost:200},
  {id:3,name:'Gel BioStyle 100 g',description:'Canjeá tus puntos por una unidad de 100 g.',points_cost:350},
  {id:4,name:'Gel BioStyle 200 g',description:'Llevate la presentación de 200 g.',points_cost:600}
];
const params = new URLSearchParams(location.search);
const pendingCode = params.get('envase');
let currentUser = null;
let profile = null;
let rewards = [];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(text){ $('authMsg').textContent = text; }
function showTab(which){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===which));$('loginForm').classList.toggle('hidden',which!=='login');$('registerForm').classList.toggle('hidden',which!=='register');msg('');}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('registerForm').addEventListener('submit', async e=>{
  e.preventDefault(); msg('Creando tu cuenta...');
  const full_name=$('regName').value.trim(), email=$('regEmail').value.trim(), password=$('regPass').value;
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name}}});
  if(error){msg(error.message);return;}
  if(data.session){await loadAccount();} else {msg('Cuenta creada. Revisá tu correo para confirmar el registro y después iniciá sesión.');showTab('login');}
});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg('Ingresando...');const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPass').value});if(error){msg(error.message);return;}await loadAccount();});
$('logout').addEventListener('click',async()=>{await sb.auth.signOut();currentUser=null;profile=null;showAuth();});
function showAuth(){ $('auth').classList.remove('hidden');$('dashboard').classList.add('hidden'); }
async function loadAccount(){
  const {data:{user}}=await sb.auth.getUser(); currentUser=user;
  if(!user){showAuth();return;}
  const {data:p,error}=await sb.from('profiles').select('id,full_name,points_balance').eq('id',user.id).single();
  if(error){msg('No pudimos cargar tu perfil: '+error.message);return;} profile=p;
  $('auth').classList.add('hidden');
  $('customerName').textContent=(p.full_name||user.email||'').split(' ')[0];
  if(pendingCode){
    $('dashboard').classList.add('hidden');
    await prepareRating(pendingCode);
    return;
  }
  $('dashboard').classList.remove('hidden');
  await refreshDashboard();
}
async function refreshDashboard(){
  const [{data:tx,error:txErr},{data:rw,error:rwErr}] = await Promise.all([
    sb.from('point_transactions').select('points,movement_type,description,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}),
    sb.from('rewards').select('id,name,description,points_cost').eq('active',true).order('points_cost')
  ]);
  if(txErr){$('history').textContent='No se pudo cargar el historial.';}
  if(rwErr){$('rewards').textContent='No se pudieron cargar los premios.';return;}
  rewards=rw||[];
  const {data:p}=await sb.from('profiles').select('points_balance,full_name').eq('id',currentUser.id).single();
  if(p){profile={...profile,...p};$('balance').textContent=p.points_balance;$('customerName').textContent=(p.full_name||'').split(' ')[0];}
  $('rewards').innerHTML=rewards.map(r=>`<article class="reward"><span class="gift">✧</span><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><strong>${r.points_cost} puntos</strong><button data-reward="${r.id}" ${(profile?.points_balance||0)<r.points_cost?'disabled':''}>Canjear premio</button></article>`).join('');
  $('rewards').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>redeemReward(Number(b.dataset.reward))));
  $('history').innerHTML=(tx||[]).length?(tx||[]).map(t=>{const positive=t.points>0;return `<div class="history-row"><span>${esc(t.description)}<br><small>${new Date(t.created_at).toLocaleString('es-AR')}</small></span><strong class="${positive?'plus':'minus'}">${positive?'+':''}${t.points} pts</strong></div>`}).join(''):'<p class="hint">Todavía no tenés movimientos.</p>';
}
async function prepareRating(code){
  const notice=$('scanNotice');notice.classList.remove('hidden');notice.textContent='Verificando tu QR...';
  const {data,error}=await sb.rpc('validate_product_qr',{p_code:code});
  if(error){
    notice.textContent=/PGRST202|Could not find the function.*validate_product_qr/i.test(error.message||'')
      ?'Falta configurar validate_product_qr en Supabase. Ejecutá supabase-fix-validate-qr.sql en el proyecto conectado; no depende del navegador.'
      :error.message;
    return;
  }
  if(!data?.available){notice.textContent='Este QR ya fue usado. No se puede volver a valorar.';return;}
  showRatingForm(code);
}
function showRatingForm(code){
  const notice=$('scanNotice');
  let claimed=false;
  const ratingMarkup=Array.from({length:6},(_,rating)=>`<button class="rating-choice" type="button" data-rating="${rating}" aria-label="${rating} estrellas" aria-pressed="false">${rating===0?'0':'★'.repeat(rating)}</button>`).join('');
  notice.innerHTML=`<form id="reviewForm" class="review-form"><h3>¿Cómo fue tu experiencia?</h3><p>Dejanos una valoración de 0 a 5 estrellas. El comentario es opcional. Al responder, sumarás tus puntos y volverás a BioStyle Club.</p><div class="rating-choices" role="group" aria-label="Valoración en estrellas">${ratingMarkup}</div><textarea id="reviewComment" maxlength="1000" placeholder="Comentario opcional (hasta 1000 caracteres)"></textarea><button class="primary" id="submitReview" type="submit">Enviar valoración</button><p class="hint" id="reviewMsg" aria-live="polite"></p></form>`;
  let selectedRating=null;
  notice.querySelectorAll('.rating-choice').forEach(button=>button.addEventListener('click',()=>{
    selectedRating=Number(button.dataset.rating);
    notice.querySelectorAll('.rating-choice').forEach(choice=>{
      const selected=Number(choice.dataset.rating)===selectedRating;
      choice.setAttribute('aria-pressed',String(selected));
      choice.classList.toggle('selected',selected);
    });
  }));
  $('reviewForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(selectedRating===null){$('reviewMsg').textContent='Elegí una valoración de 0 a 5 estrellas.';return;}
    const submit=$('submitReview');submit.disabled=true;$('reviewMsg').textContent='Guardando tu valoración...';
    if(!claimed){
      const {data:claimData,error:claimError}=await sb.rpc('redeem_product_qr',{p_code:code});
      if(claimError){
        const alreadyUsed=/ya (fue )?(utilizado|usado|canjeado)|already (used|redeemed)/i.test(claimError.message||'');
        if(alreadyUsed){notice.textContent='Este QR ya fue usado. No se puede volver a valorar.';return;}
        $('reviewMsg').textContent=claimError.message;
        submit.disabled=false;
        return;
      }
      claimed=true;
      notice.dataset.pointsAdded=String(claimData?.points_added||0);
    }
    const {error}=await sb.rpc('submit_product_review',{
      p_code:code,
      p_rating:selectedRating,
      p_comment:$('reviewComment').value.trim()
    });
    if(error){
      $('reviewMsg').textContent=/ya (fue )?valorad|already (rated|reviewed)/i.test(error.message||'')
        ?'Este QR ya tiene una valoración registrada.'
        :error.message;
      submit.disabled=false;
      return;
    }
    const pointsAdded=Number(notice.dataset.pointsAdded||0);
    $('reviewForm').innerHTML=`<h3>¡Gracias por compartir tu opinión!</h3><p>Tu valoración fue registrada y sumaste ${pointsAdded} puntos. Redirigiendo a BioStyle Club...</p>`;
    window.setTimeout(()=>location.replace(location.pathname),1200);
  });
}
async function redeemReward(id){
  const reward=rewards.find(r=>r.id===id);if(!reward)return;
  if(!confirm(`¿Querés canjear ${reward.name} por ${reward.points_cost} puntos?`))return;
  const {data,error}=await sb.rpc('redeem_reward',{p_reward_id:id});
  if(error){alert(error.message);return;}
  alert('¡Canje registrado correctamente!');await refreshDashboard();
}
sb.auth.onAuthStateChange((_event,session)=>{if(!session){currentUser=null;profile=null;showAuth();}});
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session)await loadAccount();else showAuth();})();
