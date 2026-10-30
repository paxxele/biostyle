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
  $('auth').classList.add('hidden');$('dashboard').classList.remove('hidden');
  $('customerName').textContent=(p.full_name||user.email||'').split(' ')[0];
  await refreshDashboard();
  if(pendingCode){await claimCode(pendingCode);}
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
async function claimCode(code){
  const notice=$('scanNotice');notice.classList.remove('hidden');notice.textContent='Validando tu código...';
  const {data,error}=await sb.rpc('redeem_product_qr',{p_code:code});
  if(error){notice.textContent=error.message.includes('ya fue utilizado')?'Este código ya fue utilizado y no puede volver a sumar puntos.':error.message;}
  else{notice.textContent=`¡Listo! Sumaste ${data.points_added} puntos a tu cuenta BioStyle.`;await refreshDashboard();}
  history.replaceState({},'',location.pathname);
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
