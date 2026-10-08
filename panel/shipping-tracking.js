/* Phase 7 shipment tracking. Scope: panel sales shipping controls only. */
(function(){
'use strict';

function fa(v){return typeof faDigits==='function'?faDigits(v):String(v==null?'':v);}
function safe(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v);}
function fmtDateInput(value){
  if(!value)return '';
  var d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  var p=function(n){return String(n).padStart(2,'0');};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function closeModal(){
  var wrap=document.querySelector('.shipping-modal-wrap');
  if(wrap)wrap.remove();
}
async function openShipping(orderId){
  closeModal();
  var order;
  try{order=await sellerApiFetch('/orders/seller/'+orderId);}
  catch(e){if(typeof toast==='function')toast(e.message||'سفارش دریافت نشد');return;}

  var wrap=document.createElement('div');
  wrap.className='shipping-modal-wrap';
  var etaStart=fmtDateInput(order.shippingEtaStart);
  var etaEnd=fmtDateInput(order.shippingEtaEnd);
  wrap.innerHTML='<div class="shipping-modal" role="dialog" aria-modal="true">'+
    '<div class="shipping-modal__head"><div><h3>'+(order.status==='shipped'?'ویرایش رهگیری سفارش':'ثبت ارسال سفارش')+'</h3><p>اطلاعات مرسوله برای مشتری در صفحه وضعیت سفارش نمایش داده می‌شود.</p></div><button type="button" class="shipping-modal__close" aria-label="بستن">×</button></div>'+
    '<div class="shipping-modal__info"><div><span>سفارش</span><strong>#'+fa(order.id)+'</strong></div><div><span>روش ارسال</span><strong>'+safe(order.shippingMethod==='express'?'ارسال سریع':'ارسال استاندارد')+'</strong></div><div><span>هزینه ارسال</span><strong>'+safe(typeof fmtPrice==='function'?fmtPrice(Number(order.shippingFee||0)):'0')+'</strong></div><div><span>آدرس</span><strong>'+safe(order.shippingAddress||'—')+'</strong></div></div>'+
    '<form id="shipping-form"><div class="shipping-modal__grid">'+
      '<label class="wide"><span>شرکت یا روش حمل *</span><input name="carrier" required maxlength="100" list="shipping-carriers" value="'+safe(order.shippingCarrier||'')+'" placeholder="مثلاً پست جمهوری اسلامی"><datalist id="shipping-carriers"><option value="پست جمهوری اسلامی"><option value="تیپاکس"><option value="چاپار"><option value="پیک شهری"><option value="سایر"></datalist></label>'+
      '<label class="wide"><span>کد رهگیری مرسوله</span><input name="trackingCode" maxlength="150" value="'+safe(order.shippingTrackingCode||'')+'" placeholder="در صورت وجود"></label>'+
      '<label><span>شروع بازه تحویل</span><input type="datetime-local" name="etaStart" value="'+safe(etaStart)+'"></label>'+
      '<label><span>پایان بازه تحویل</span><input type="datetime-local" name="etaEnd" value="'+safe(etaEnd)+'"></label>'+
    '</div><div class="shipping-modal__error" hidden></div><div class="shipping-modal__actions"><button type="button" data-cancel>انصراف</button><button type="submit" class="primary">'+(order.status==='shipped'?'ذخیره تغییرات':'ثبت ارسال')+'</button></div></form></div>';

  document.body.appendChild(wrap);
  wrap.querySelector('.shipping-modal__close').addEventListener('click',closeModal);
  wrap.querySelector('[data-cancel]').addEventListener('click',closeModal);
  wrap.addEventListener('click',function(e){if(e.target===wrap)closeModal();});

  var form=wrap.querySelector('#shipping-form');
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    var err=wrap.querySelector('.shipping-modal__error');
    err.hidden=true;
    var carrier=form.elements.carrier.value.trim();
    if(carrier.length<2){err.textContent='نام شرکت یا روش حمل را وارد کنید.';err.hidden=false;return;}
    var payload={
      carrier:carrier,
      trackingCode:form.elements.trackingCode.value.trim(),
      etaStart:form.elements.etaStart.value?new Date(form.elements.etaStart.value).toISOString():null,
      etaEnd:form.elements.etaEnd.value?new Date(form.elements.etaEnd.value).toISOString():null
    };
    var submit=form.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent='در حال ذخیره...';
    try{
      await sellerApiFetch('/orders/seller/'+order.id+'/ship',{method:'POST',body:JSON.stringify(payload)});
      closeModal();
      if(typeof loadAll==='function')await loadAll();
      if(typeof router==='function')router();
      if(typeof toast==='function')toast('اطلاعات ارسال ثبت شد');
    }catch(ex){
      submit.disabled=false;submit.textContent=order.status==='shipped'?'ذخیره تغییرات':'ثبت ارسال';
      err.textContent=ex.message||'ثبت اطلاعات ارسال ناموفق بود';err.hidden=false;
    }
  });
}

function orderForSaleNode(node){
  try{
    var sale=state.sales.find(function(row){return Number(row.id)===Number(node.dataset.sale);});
    if(!sale||!sale.orderId)return null;
    return state.orders.find(function(row){return Number(row.id)===Number(sale.orderId);})||null;
  }catch(e){return null;}
}
function enhance(){
  document.querySelectorAll('[data-sale]').forEach(function(node){
    var order=orderForSaleNode(node);
    if(!order||order.status!=='shipped')return;
    if(!node.querySelector('.shipping-tracking-chip')){
      var body=node.querySelector('.rec-card__body')||node;
      var chip=document.createElement('div');
      chip.className='shipping-tracking-chip';
      chip.textContent=(order.shippingCarrier||'ارسال ثبت شده')+(order.shippingTrackingCode?' · رهگیری: '+order.shippingTrackingCode:'');
      body.appendChild(chip);
    }
    if(!node.querySelector('[data-shipping-edit]')){
      var body2=node.querySelector('.rec-card__body')||node;
      var btn=document.createElement('button');
      btn.type='button';btn.className='shipping-edit-btn';btn.dataset.shippingEdit=String(order.id);btn.textContent='ویرایش رهگیری';
      body2.appendChild(btn);
    }
  });
}

document.addEventListener('click',function(e){
  var target=e.target.closest('[data-ship],[data-shipping-edit]');
  if(!target)return;
  e.preventDefault();
  e.stopPropagation();
  if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
  var id=Number(target.dataset.ship||target.dataset.shippingEdit);
  if(id>0)openShipping(id);
},true);

new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(enhance,80);
})();