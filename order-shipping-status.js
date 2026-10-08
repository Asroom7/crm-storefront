/* Phase 7 customer shipment timeline. Scope: order-status.html only. */
(function(){
'use strict';

var orderId=Number(new URLSearchParams(window.location.search).get('id'));
if(!orderId)return;

function safe(v){return typeof escapeHtml==='function'?escapeHtml(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof toFaDigits==='function'?toFaDigits(v):String(v==null?'':v);}
function dateText(v){
  if(!v)return '';
  try{return new Date(v).toLocaleDateString('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric'});}
  catch(e){return '';}
}
function dateTimeText(v){
  if(!v)return '';
  try{return new Date(v).toLocaleString('fa-IR-u-ca-persian',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
  catch(e){return '';}
}
function methodLabel(method){return method==='express'?'ارسال سریع':'ارسال استاندارد';}
function statusRank(status){
  if(status==='shipped')return 4;
  if(status==='confirmed'||status==='paid')return 3;
  if(status==='pending_review')return 2;
  if(status==='pending_payment')return 1;
  return 0;
}
function step(cls,num,title,detail){
  return '<div class="ost-step '+cls+'"><div class="ost-dot">'+fa(num)+'</div><div class="ost-body"><strong>'+safe(title)+'</strong><span>'+safe(detail||'')+'</span></div></div>';
}
function render(order){
  if(!order||['cancelled','rejected'].includes(order.status))return;
  var summary=document.getElementById('order-summary');
  if(!summary)return;

  var old=document.getElementById('order-shipping-tracking');
  if(old)old.remove();

  var rank=statusRank(order.status);
  var section=document.createElement('section');
  section.className='order-shipping-tracking';
  section.id='order-shipping-tracking';

  var created=dateText(order.createdAt);
  var shipped=dateTimeText(order.shippingShippedAt);
  var etaStart=dateText(order.shippingEtaStart);
  var etaEnd=dateText(order.shippingEtaEnd);
  var eta=etaStart&&etaEnd?(etaStart===etaEnd?etaStart:etaStart+' تا '+etaEnd):(etaStart||etaEnd||'پس از ارسال به‌روزرسانی می‌شود');

  var timeline='';
  timeline+=step(rank>=1?'done':'current',1,'سفارش ثبت شد',created||'ثبت سفارش انجام شده است');
  timeline+=step(rank>=2?'done':(rank===1?'current':''),2,'پرداخت سفارش',rank>=2?'پرداخت ثبت شده است':'در انتظار تکمیل یا تأیید پرداخت');
  timeline+=step(rank>=3?'done':(rank===2?'current':''),3,'آماده‌سازی سفارش',rank>=3?'سفارش برای ارسال آماده شده است':'پس از تأیید پرداخت آغاز می‌شود');
  timeline+=step(rank>=4?'done':(rank===3?'current':''),4,'ارسال مرسوله',rank>=4?(shipped?'ارسال در '+shipped:'ارسال ثبت شده است'):'هنوز تحویل شرکت حمل نشده است');
  timeline+=step(rank>=4?'current':'',5,'بازه تقریبی تحویل',eta);

  var tracking=order.shippingTrackingCode||'';
  var carrier=order.shippingCarrier||'';
  section.innerHTML='<h2>رهگیری ارسال</h2><p class="ost-sub">وضعیت آماده‌سازی و ارسال این سفارش</p><div class="ost-timeline">'+timeline+'</div>'+
    '<div class="ost-meta">'+
      '<div><span>روش ارسال</span><strong>'+safe(methodLabel(order.shippingMethod))+'</strong></div>'+
      '<div><span>هزینه ارسال</span><strong>'+(Number(order.shippingFee||0)>0?safe(formatPrice(Number(order.shippingFee)))+' تومان':'رایگان')+'</strong></div>'+
      (carrier?'<div><span>شرکت حمل</span><strong>'+safe(carrier)+'</strong></div>':'')+
      (tracking?'<div><span>کد رهگیری مرسوله</span><strong dir="ltr">'+safe(tracking)+'</strong><button type="button" class="ost-copy" data-copy-tracking>کپی کد رهگیری</button></div>':'')+
    '</div>';

  summary.insertAdjacentElement('afterend',section);
  var copy=section.querySelector('[data-copy-tracking]');
  if(copy)copy.addEventListener('click',function(){
    var done=function(){copy.textContent='کپی شد ✓';setTimeout(function(){copy.textContent='کپی کد رهگیری';},1300);};
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(tracking).then(done).catch(function(){});
    else{
      var input=document.createElement('textarea');input.value=tracking;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
      try{document.execCommand('copy');done();}catch(e){}
      input.remove();
    }
  });
}

apiFetch('/orders/mine/'+orderId).then(render).catch(function(){});
})();