/* Phase 8 returns/refunds manager. Scope: #/returns and one Settings link. */
(function(){
'use strict';

var ROUTE='returns';
var rows=[];
var filter='requested';
var loading=false;

function routeName(){return location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';}
function safe(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof faDigits==='function'?faDigits(v):String(v==null?'':v);}
function money(v){return typeof fmtPrice==='function'?fmtPrice(Number(v||0)):String(v||0);}
function root(){return document.getElementById('view');}
function dateText(v){try{return new Date(v).toLocaleDateString('fa-IR-u-ca-persian');}catch(e){return '';}}
function statusLabel(v){
  if(v==='approved')return 'تأیید شده';
  if(v==='rejected')return 'رد شده';
  if(v==='received')return 'کالا دریافت شد';
  if(v==='refunded')return 'وجه برگشت شد';
  return 'در انتظار بررسی';
}

function addSettingsLink(){
  if(routeName()!=='settings')return;
  var view=root();
  if(!view||view.querySelector('[data-returns-settings-link]'))return;
  var titles=Array.from(view.querySelectorAll('.settings-group__title'));
  var title=titles.find(function(el){return el.textContent.trim()==='مدیریت فروشگاه';});
  var target=title?title.closest('.settings-group'):view.querySelector('.settings-group');
  if(!target)return;
  var a=document.createElement('a');
  a.href='#/returns';
  a.className='settings-row';
  a.dataset.returnsSettingsLink='1';
  a.style.cssText='text-decoration:none;color:inherit;';
  a.innerHTML='<div class="settings-row__icon">↩</div><div class="settings-row__text"><div class="settings-row__title">مرجوعی و بازگشت وجه</div><div class="settings-row__desc">بررسی درخواست‌های مرجوعی سفارش‌ها</div></div><div class="settings-row__chev">‹</div>';
  target.appendChild(a);
}

function counts(){
  var out={requested:0,approved:0,rejected:0,received:0,refunded:0};
  rows.forEach(function(row){if(out[row.status]!==undefined)out[row.status]+=1;});
  return out;
}

function summary(){
  var c=counts();
  var items=[
    ['requested','در انتظار',c.requested],
    ['approved','تأییدشده',c.approved],
    ['received','دریافت کالا',c.received],
    ['refunded','بازگشت وجه',c.refunded],
    ['rejected','ردشده',c.rejected]
  ];
  return '<div class="rr-summary">'+items.map(function(item){
    return '<button type="button" class="'+(filter===item[0]?'active':'')+'" data-rr-filter="'+item[0]+'"><strong>'+fa(item[2])+'</strong><span>'+item[1]+'</span></button>';
  }).join('')+'</div>';
}

function card(row){
  var order=row.order||{};
  var customer=row.customer||{};
  var customerName=[customer.firstName,customer.lastName].filter(Boolean).join(' ')||'مشتری';
  var items=Array.isArray(order.items)?order.items:[];
  var itemHtml=items.map(function(item){
    return '<span>'+safe(item.product&&item.product.name||'محصول')+' × '+fa(item.quantity)+'</span>';
  }).join('');
  var actions='';
  if(row.status==='requested'){
    actions='<button type="button" class="approve" data-return-action="approve">تأیید درخواست</button><button type="button" class="reject" data-return-action="reject">رد درخواست</button>';
  }else if(row.status==='approved'){
    actions='<button type="button" class="receive" data-return-action="receive">ثبت دریافت کالای مرجوعی</button>';
  }else if(row.status==='received'){
    actions='<button type="button" class="refund" data-return-action="refund">ثبت بازگشت وجه</button>';
  }
  return '<article class="rr-card" data-return-id="'+row.id+'">'+
    '<div class="rr-card-head"><div><div class="rr-order">سفارش #'+fa(order.id||'')+'</div><div class="rr-customer">'+safe(customerName)+(customer.phone?' · '+safe(customer.phone):'')+'</div></div><span class="rr-status '+safe(row.status)+'">'+statusLabel(row.status)+'</span></div>'+
    '<div class="rr-reason"><strong>'+safe(row.reason)+'</strong><p>'+safe(row.customerNote||'بدون توضیح تکمیلی')+'</p></div>'+
    '<div class="rr-items">'+itemHtml+'</div>'+
    '<div class="rr-meta"><span>ثبت: '+safe(dateText(row.requestedAt))+'</span><span>مبلغ سفارش: '+safe(money(order.totalAmount))+'</span></div>'+
    (row.refundAmount!=null?'<div class="rr-refund">مبلغ بازگشت وجه: '+safe(money(row.refundAmount))+(row.refundReference?' · مرجع: '+safe(row.refundReference):'')+'</div>':'')+
    (actions?'<div class="rr-actions">'+actions+'</div>':'')+
  '</article>';
}

function render(){
  var view=root();if(!view)return;
  if(typeof renderNav==='function')renderNav('settings');
  var shown=rows.filter(function(row){return row.status===filter;});
  view.innerHTML='<section class="returns-manager"><div class="rr-head"><div><h1>مرجوعی و بازگشت وجه</h1><p>درخواست مشتری، دریافت کالای مرجوعی و ثبت بازگشت وجه بدون تغییر سوابق اصلی سفارش.</p></div></div>'+summary()+'<div class="rr-list">'+(shown.length?shown.map(card).join(''):'<div class="rr-empty">درخواستی در این وضعیت وجود ندارد.</div>')+'</div></section>';
  view.querySelectorAll('[data-rr-filter]').forEach(function(btn){btn.addEventListener('click',function(){filter=btn.dataset.rrFilter;render();});});
  view.querySelectorAll('[data-return-id]').forEach(function(node){
    node.querySelectorAll('[data-return-action]').forEach(function(btn){
      btn.addEventListener('click',function(){
        openAction(Number(node.dataset.returnId),btn.dataset.returnAction);
      });
    });
  });
}

function load(){
  loading=true;
  return sellerApiFetch('/orders/seller/returns').then(function(data){
    rows=Array.isArray(data)?data:[];
  }).finally(function(){loading=false;});
}

function closeModal(){
  var wrap=document.querySelector('.return-action-modal-wrap');
  if(wrap)wrap.remove();
}

function openAction(id,action){
  closeModal();
  var row=rows.find(function(item){return Number(item.id)===Number(id);});
  if(!row)return;
  var titles={approve:'تأیید درخواست مرجوعی',reject:'رد درخواست مرجوعی',receive:'ثبت دریافت کالای مرجوعی',refund:'ثبت بازگشت وجه'};
  var wrap=document.createElement('div');
  wrap.className='return-action-modal-wrap';
  var refundFields=action==='refund'
    ? '<label>مبلغ بازگشت وجه *<input type="text" inputmode="numeric" name="refundAmount" value="'+Number(row.order&&row.order.totalAmount||0).toLocaleString('en-US')+'"></label><label>مرجع یا شماره پیگیری بازگشت وجه<input name="refundReference" maxlength="150" placeholder="اختیاری"></label>'
    : '';
  wrap.innerHTML='<div class="return-action-modal"><h3>'+titles[action]+'</h3><p>سفارش #'+fa(row.order&&row.order.id||'')+' · '+safe(row.reason)+'</p><form id="return-action-form">'+refundFields+'<label>یادداشت داخلی فروشگاه<textarea name="note" maxlength="2000" placeholder="اختیاری"></textarea></label><div class="ram-error" hidden></div><div class="ram-actions"><button type="button" data-cancel>انصراف</button><button type="submit" class="primary">ثبت</button></div></form></div>';
  document.body.appendChild(wrap);
  wrap.addEventListener('click',function(e){if(e.target===wrap)closeModal();});
  wrap.querySelector('[data-cancel]').addEventListener('click',closeModal);
  var form=wrap.querySelector('#return-action-form');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var payload={action:action,note:form.elements.note.value.trim()};
    if(action==='refund'){
      var digits=String(form.elements.refundAmount.value||'').replace(/[^0-9]/g,'');
      payload.refundAmount=Number(digits||0);
      payload.refundReference=form.elements.refundReference.value.trim();
      if(!(payload.refundAmount>0)){
        var err=wrap.querySelector('.ram-error');err.textContent='مبلغ بازگشت وجه را وارد کنید.';err.hidden=false;return;
      }
    }
    var submit=form.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent='در حال ثبت...';
    sellerApiFetch('/orders/seller/returns/'+id+'/action',{method:'POST',body:JSON.stringify(payload)})
      .then(function(){closeModal();return load();})
      .then(function(){render();if(typeof toast==='function')toast('وضعیت مرجوعی به‌روزرسانی شد');})
      .catch(function(error){
        submit.disabled=false;submit.textContent='ثبت';
        var err=wrap.querySelector('.ram-error');err.textContent=error.message||'ثبت تغییرات ناموفق بود';err.hidden=false;
      });
  });
}

function route(){
  if(routeName()!==ROUTE){addSettingsLink();return;}
  var view=root();if(!view||loading)return;
  view.innerHTML='<div class="returns-manager"><div class="rr-empty">در حال دریافت درخواست‌های مرجوعی...</div></div>';
  load().then(render).catch(function(error){
    view.innerHTML='<div class="returns-manager"><div class="rr-empty">'+safe(error.message||'دریافت درخواست‌ها ناموفق بود')+'</div></div>';
  });
}

window.addEventListener('hashchange',function(){setTimeout(route,0);});
window.addEventListener('pageshow',function(){addSettingsLink();route();});
new MutationObserver(function(){
  addSettingsLink();
  if(routeName()===ROUTE){
    var view=root();
    if(view&&!view.querySelector('.returns-manager'))route();
  }
}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(function(){addSettingsLink();route();},60);
})();