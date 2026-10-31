const orderForm=document.getElementById('orderForm');
const orderHint=document.getElementById('orderHint');
const submitOrder=document.getElementById('submitOrder');
const supabaseClient=window.supabase.createClient(window.BIOSTYLE_SUPABASE_URL,window.BIOSTYLE_SUPABASE_KEY);
document.getElementById('year').textContent=new Date().getFullYear();
orderForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!orderForm.reportValidity())return;
  const form=new FormData(orderForm);
  const sizeGrams=Number(String(form.get('presentation')).match(/\d+/)?.[0]);
  submitOrder.disabled=true;
  submitOrder.textContent='Guardando pedido...';
  orderHint.textContent='Registrando tu pedido de forma segura...';
  try{
    const {data,error}=await supabaseClient.rpc('create_customer_order',{
      p_first_name:String(form.get('firstName')).trim(),
      p_last_name:String(form.get('lastName')).trim(),
      p_address:String(form.get('address')).trim(),
      p_province:String(form.get('province')).trim(),
      p_locality:String(form.get('locality')).trim(),
      p_postal_code:String(form.get('postalCode')).trim(),
      p_size_g:sizeGrams,
      p_quantity:Number(form.get('quantity'))
    });
    if(error)throw new Error(error.message);
    orderForm.innerHTML=`<div class="order-success"><p class="eyebrow">PEDIDO REGISTRADO</p><h2>¡Gracias, ${escapeHtml(String(form.get('firstName')).trim())}!</h2><p>Tu pedido <strong>#${escapeHtml(String(data.order_number))}</strong> quedó guardado correctamente. Nos comunicaremos para coordinar la entrega.</p><div class="payment-note"><span aria-hidden="true">✳</span><p><strong>Pagás cuando recibís el producto.</strong><br>No se realizó ningún cobro por adelantado.</p></div><a class="button button-dark" href="index.html">Volver al inicio <span>↗</span></a></div>`;
  }catch(error){
    orderHint.textContent=`No se pudo guardar el pedido: ${error.message}. Intentá nuevamente.`;
    submitOrder.disabled=false;
    submitOrder.innerHTML='Reintentar pedido <span>↗</span>';
  }
});
function escapeHtml(value){
  return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
