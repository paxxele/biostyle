const orderForm=document.getElementById('orderForm');
document.getElementById('year').textContent=new Date().getFullYear();
orderForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!orderForm.reportValidity())return;
  const form=new FormData(orderForm);
  const orderDetails=[
    'Hola, quiero hacer un pedido de BioStyle.',
    '',
    `Nombre: ${form.get('firstName')} ${form.get('lastName')}`,
    `Dirección: ${form.get('address')}`,
    `Localidad: ${form.get('locality')}`,
    `Provincia: ${form.get('province')}`,
    `Código postal: ${form.get('postalCode')}`,
    `Producto: ${form.get('presentation')}`,
    `Cantidad: ${form.get('quantity')}`,
    'Forma de pago: al recibir el producto.'
  ].join('\n');
  const whatsappUrl=`https://wa.me/5493872110087?text=${encodeURIComponent(orderDetails)}`;
  window.location.href=whatsappUrl;
});
