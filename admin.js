const sb=window.supabase.createClient(window.BIOSTYLE_SUPABASE_URL,window.BIOSTYLE_SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let adminUser=null;
$('adminForm').addEventListener('submit',async e=>{e.preventDefault();$('adminMsg').textContent='Verificando acceso...';const {error}=await sb.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPass').value});if(error){$('adminMsg').textContent=error.message;return;}await verifyAdmin();});
async function verifyAdmin(){const {data:{user}}=await sb.auth.getUser();if(!user){$('adminMsg').textContent='Iniciá sesión.';return;}const {data:p,error}=await sb.from('profiles').select('is_admin').eq('id',user.id).single();if(error||!p?.is_admin){await sb.auth.signOut();$('adminMsg').textContent='Esta cuenta no tiene permisos de administrador.';return;}adminUser=user;$('adminLogin').classList.add('hidden');$('adminPanel').classList.remove('hidden');await render();}
$('makeCodes').addEventListener('submit',async e=>{e.preventDefault();const size=Number($('size').value),quantity=Math.max(1,Math.min(50,Number($('quantity').value)||1));const {data,error}=await sb.rpc('admin_create_qr_codes',{p_size_g:size,p_quantity:quantity});if(error){alert(error.message);return;}alert(`Se generaron ${data.created} códigos QR.`);await render();});
function codeUrl(code){return new URL('club.html?envase='+encodeURIComponent(code),location.href).href;}
async function render(){
 const [{data:codes,error:cErr},{data:users,error:uErr},{data:redemptions,error:rErr}] = await Promise.all([
  sb.from('qr_codes').select('id,code,points,redeemed_by,redeemed_at,created_at,products(size_g)').order('created_at',{ascending:false}),
  sb.from('profiles').select('id,full_name,points_balance').order('created_at',{ascending:false}),
  sb.from('reward_redemptions').select('id,user_id,points_spent,created_at,rewards(name)').order('created_at',{ascending:false})
 ]);
 if(cErr||uErr||rErr){alert('No se pudieron cargar los datos del panel. Revisá las políticas SQL adicionales.');return;}
 const used=(codes||[]).filter(c=>c.redeemed_at).length;$('totalCodes').textContent=codes.length;$('usedCodes').textContent=used;$('unusedCodes').textContent=codes.length-used;
 $('codesList').innerHTML=codes.length?codes.map(c=>`<article class="code-card ${c.redeemed_at?'used':'unused'}"><div class="qr" id="qr-${c.id}"></div><h3>BioStyle ${c.products.size_g} g</h3><p><b>${esc(c.code)}</b></p><p>${c.points} puntos</p><p class="status ${c.redeemed_at?'used':''}">${c.redeemed_at?'UTILIZADO':'DISPONIBLE'}</p>${c.redeemed_at?`<p>${esc(c.redeemed_by||'Cliente')}<br>${new Date(c.redeemed_at).toLocaleDateString('es-AR')}</p>`:`<button class="ghost copy" data-url="${esc(codeUrl(c.code))}">Copiar enlace</button>`}</article>`).join(''):'<p class="empty">Todavía no generaste códigos.</p>';
 (codes||[]).filter(c=>!c.redeemed_at).forEach(c=>{const el=$('qr-'+c.id);if(el&&window.QRCode)new QRCode(el,{text:codeUrl(c.code),width:135,height:135,colorDark:'#19372b',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});});
 document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.url);b.textContent='Enlace copiado';}catch(e){prompt('Copiá este enlace:',b.dataset.url);}}));
 $('usersList').innerHTML=users.length?users.map(u=>`<div class="data-row"><span><b>${esc(u.full_name)}</b><br>${esc(u.id)}</span><strong>${u.points_balance} puntos</strong></div>`).join(''):'<p class="empty">Todavía no hay clientes.</p>';
 $('redemptionsList').innerHTML=redemptions.length?redemptions.map(r=>`<div class="data-row"><span><b>${esc(r.rewards?.name||'Premio')}</b><br>${esc((users||[]).find(u=>u.id===r.user_id)?.full_name||r.user_id)} · ${r.points_spent} puntos</span><small>${new Date(r.created_at).toLocaleDateString('es-AR')}</small></div>`).join(''):'<p class="empty">Todavía no hay canjes.</p>';
 const {data:reviews,error:reviewsError}=await sb.rpc('admin_list_product_reviews');
 if(reviewsError){$('reviewsList').innerHTML=`<p class="empty">No se pudieron cargar las valoraciones: ${esc(reviewsError.message)}</p>`;return;}
 $('reviewsList').innerHTML=reviews.length?reviews.map(review=>{
  const stars=Number(review.rating)>0?'★'.repeat(Number(review.rating)):'0 estrellas';
  const comment=review.comment?`<p class="review-comment">${esc(review.comment)}</p>`:'<p class="review-comment muted">Sin comentario</p>';
  return `<article class="review-row"><div class="review-heading"><strong>${esc(review.reviewer_name)}</strong><span class="review-stars">${stars} <small>${review.rating}/5</small></span></div>${comment}<small class="review-details">QR ${esc(review.qr_code)} · ${new Date(review.created_at).toLocaleString('es-AR')}</small></article>`;
 }).join(''):'<p class="empty">Todavía no hay valoraciones.</p>';
}
$('printCodes').addEventListener('click',()=>window.print());
sb.auth.getSession().then(async({data})=>{if(data.session)await verifyAdmin();});
