/* Phase 8 customer return request. Scope: order-status.html only. */
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
function statusText(status){
  if(status==='approved')return 'درخواست شما تأیید شده است. پس از بازگشت کالا و ثبت دریافت توسط فروشگاه، بازگشت وجه انجام می‌شود.';
  if(status==='rejected')return 'درخواست مرجوعی تأیید نشد.';
  if(status==='received')return 'کالای مرجوعی توسط فروشگاه دریافت شده و بازگشت وجه در انتظار ثبت نهایی است.';
  if(status==='refunded')return 'بازگشت وجه این سفارش ثبت شده است.';
  return 'درخواست مرجوعی ثبت شده و در انتظار بررسی فروشگاه است.';
}
function statusLabel(status){
  if(status==='approved')return 'تأیید شده';
  if(status==='rejected')return 'رد شده';
  if(status==='received')return 'کالا دریافت شد';
  if(status==='refunded')return 'بازگشت وجه انجام شد';
  return 'در انتظار بررسی';
}
function insertAfterTarget(section){
  var shipping=document.getElementById('order-shipping-tracking');
  var summary=document.getElementById('order-summary');
  var target=shipping||summary;
  if(target)target.insertAdjacentElement('afterend',section);
}
function render(order){
  var old=document.getElementById('order-return-box');
  if(old)old.remove();
  if(!order||!['shipped'].includes(order.status)&&!order.returnRequest)return;

  var section=document.createElement('section');
  section.id='order-return-box';
  section.className='order-return-box';

  var request=order.returnRequest;
  if(request){
    var meta='';
    meta+='<div><span>دلیل درخواست</span><strong>'+safe(request.reason)+'</strong></div>';
    meta+='<div><span>تاریخ ثبت</span><strong>'+safe(dateText(request.requestedAt))+'</strong></div>';
    if(request.refundAmount!=null)meta+='<div><span>مبلغ بازگشت وجه</span><strong>'+safe(formatPrice(Number(request.refundAmount)))+' تومان</strong></div>';
    if(request.refundReference)meta+='<div><span>مرجع بازگشت وجه</span><strong dir="ltr">'+safe(request.refundReference)+'</strong></div>';
    section.innerHTML='<h2>مرجوعی و بازگشت وجه</h2><p class="orb-sub">وضعیت درخواست مربوط به این سفارش</p>'+
      '<div class="orb-status '+safe(request.status)+'"><strong>'+safe(statusLabel(request.status))+'</strong><br>'+safe(statusText(request.status))+'</div>'+
      '<div class="orb-meta">'+meta+'</div>';
    insertAfterTarget(section);
    return;
  }

  section.innerHTML='<h2>درخواست مرجوعی</h2><p class="orb-sub">برای سفارش ارسال‌شده می‌توانید درخواست بررسی مرجوعی ثبت کنید.</p>'+
    '<form class="orb-form" id="orb-form">'+
      '<label>دلیل مرجوعی<input id="orb-reason" maxlength="120" placeholder="مثلاً آسیب‌دیدگی، مغایرت یا دلیل دیگر" required></label>'+
      '<label>توضیحات تکمیلی<textarea id="orb-note" maxlength="2000" placeholder="جزئیات درخواست را بنویسید..."></textarea></label>'+
      '<div class="orb-error" id="orb-error" hidden></div>'+
      '<button type="submit" class="orb-submit">ثبت درخواست مرجوعی</button>'+
    '</form>';
  insertAfterTarget(section);

  var form=document.getElementById('orb-form');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var reason=document.getElementById('orb-reason').value.trim();
    var note=document.getElementById('orb-note').value.trim();
    var error=document.getElementById('orb-error');
    error.hidden=true;
    if(reason.length<3){
      error.textContent='دلیل مرجوعی را واضح‌تر وارد کنید.';
      error.hidden=false;
      return;
    }
    var button=form.querySelector('.orb-submit');
    button.disabled=true;
    button.textContent='در حال ثبت...';
    apiFetch('/orders/mine/'+orderId+'/return-request',{
      method:'POST',
      body:JSON.stringify({reason:reason,customerNote:note})
    }).then(function(){
      return apiFetch('/orders/mine/'+orderId);
    }).then(render).catch(function(err){
      button.disabled=false;
      button.textContent='ثبت درخواست مرجوعی';
      error.textContent=err.message||'ثبت درخواست انجام نشد.';
      error.hidden=false;
    });
  });
}

apiFetch('/orders/mine/'+orderId).then(render).catch(function(){});
})();