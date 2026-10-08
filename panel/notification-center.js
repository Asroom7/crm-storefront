/* Phase 10 notification center. Scope: seller panel topbar only. */
(function(){
'use strict';

var trigger=null;
var badge=null;
var overlay=null;
var panel=null;
var body=null;
var summary=null;
var refreshButton=null;
var loading=false;
var lastLoadedAt=0;
var model={
  payments:[],
  shipping:[],
  reviews:[],
  returns:[],
  stock:[],
  counts:{payments:0,shipping:0,reviews:0,returns:0,stock:0}
};

function safe(value){
  if(typeof esc==='function')return esc(value==null?'':String(value));
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function fa(value){
  return typeof faDigits==='function'?faDigits(value):String(value==null?'':value);
}
function personName(customer){
  if(!customer)return '';
  return [customer.firstName,customer.lastName].filter(Boolean).join(' ').trim();
}
function totalCount(){
  var c=model.counts;
  return Number(c.payments||0)+Number(c.shipping||0)+Number(c.reviews||0)+Number(c.returns||0)+Number(c.stock||0);
}
function badgeText(value){
  return value>99?'۹۹+':fa(value);
}
function setBadge(){
  if(!badge)return;
  var count=totalCount();
  badge.hidden=count<=0;
  badge.textContent=badgeText(count);
  trigger.setAttribute('aria-label',count>0?'مرکز اعلان‌ها، '+fa(count)+' مورد نیازمند اقدام':'مرکز اعلان‌ها');
}
function openCenter(){
  if(!overlay)return;
  overlay.hidden=false;
  trigger.setAttribute('aria-expanded','true');
  refresh(false);
  setTimeout(function(){if(panel)panel.focus();},0);
}
function closeCenter(){
  if(!overlay)return;
  overlay.hidden=true;
  trigger.setAttribute('aria-expanded','false');
}
function createShell(){
  var search=document.getElementById('topbarSearchBtn');
  if(!search||document.getElementById('notificationCenterTrigger'))return Boolean(trigger);

  trigger=document.createElement('button');
  trigger.type='button';
  trigger.id='notificationCenterTrigger';
  trigger.className='notification-center-trigger';
  trigger.setAttribute('aria-label','مرکز اعلان‌ها');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span class="notification-center-trigger__icon" aria-hidden="true">🔔</span><span class="notification-center-trigger__badge" hidden></span>';
  badge=trigger.querySelector('.notification-center-trigger__badge');
  search.parentNode.insertBefore(trigger,search);

  overlay=document.createElement('div');
  overlay.className='notification-center-overlay';
  overlay.id='notificationCenterOverlay';
  overlay.hidden=true;
  overlay.innerHTML=
    '<section class="notification-center" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">'+
      '<div class="notification-center__head">'+
        '<div><h2 id="notification-center-title">مرکز اعلان‌ها</h2><p id="notification-center-sub">مواردی که الان به اقدام شما نیاز دارند</p></div>'+
        '<div class="notification-center__head-actions">'+
          '<button type="button" class="notification-center__refresh" aria-label="تازه‌سازی">↻</button>'+
          '<button type="button" class="notification-center__close" aria-label="بستن">×</button>'+
        '</div>'+
      '</div>'+
      '<div class="notification-center__summary"></div>'+
      '<div class="notification-center__body"><div class="notification-center__empty">در حال دریافت اعلان‌ها...</div></div>'+
    '</section>';
  document.body.appendChild(overlay);
  panel=overlay.querySelector('.notification-center');
  body=overlay.querySelector('.notification-center__body');
  summary=overlay.querySelector('.notification-center__summary');
  refreshButton=overlay.querySelector('.notification-center__refresh');

  trigger.addEventListener('click',function(){
    if(overlay.hidden)openCenter();else closeCenter();
  });
  overlay.querySelector('.notification-center__close').addEventListener('click',closeCenter);
  refreshButton.addEventListener('click',function(){refresh(true);});
  overlay.addEventListener('click',function(event){if(event.target===overlay)closeCenter();});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!overlay.hidden)closeCenter();});

  return true;
}
function summaryHtml(){
  var c=model.counts;
  return [
    ['پرداخت',c.payments],
    ['ارسال',c.shipping],
    ['نظر',c.reviews],
    ['مرجوعی',c.returns],
    ['موجودی',c.stock]
  ].map(function(row){
    return '<div><strong>'+fa(row[1]||0)+'</strong><span>'+row[0]+'</span></div>';
  }).join('');
}
function groupHtml(title,count,items){
  if(!(count>0))return '';
  return '<section class="notification-group"><div class="notification-group__head"><strong>'+safe(title)+'</strong><span>'+fa(count)+'</span></div>'+items.join('')+'</section>';
}
function itemHtml(type,icon,title,meta,target,id){
  return '<button type="button" class="notification-item '+type+'" data-notification-target="'+safe(target)+'"'+(id?' data-notification-id="'+Number(id)+'"':'')+'>'+
    '<span class="notification-item__icon" aria-hidden="true">'+icon+'</span>'+
    '<span class="notification-item__body"><span class="notification-item__title">'+safe(title)+'</span><span class="notification-item__meta">'+safe(meta||'')+'</span></span>'+
    '<span class="notification-item__chev" aria-hidden="true">‹</span>'+
  '</button>';
}
function render(){
  if(!summary||!body)return;
  summary.innerHTML=summaryHtml();

  if(totalCount()===0){
    body.innerHTML='<div class="notification-center__empty"><strong>همه‌چیز رسیدگی شده ✓</strong><span>در حال حاضر موردی برای اقدام فوری وجود ندارد.</span></div>';
    setBadge();
    return;
  }

  var paymentItems=model.payments.map(function(payment){
    var customer=personName(payment.customer)||'مشتری';
    var orderPart=payment.order&&payment.order.id?'سفارش #'+fa(payment.order.id):'واریزی دستی';
    return itemHtml('payment','💳','بررسی واریزی '+customer,orderPart+' · '+(typeof fmtPrice==='function'?fmtPrice(payment.amount):payment.amount),'payments');
  });
  var shippingItems=model.shipping.map(function(order){
    var customer=personName(order.customer)||'مشتری';
    return itemHtml('shipping','📦','سفارش #'+fa(order.id)+' آماده ارسال است',customer+(order.shippingMethod==='express'?' · ارسال سریع':' · ارسال استاندارد'),'shipping');
  });
  var reviewItems=model.reviews.map(function(review){
    var customer=personName(review.customer)||'مشتری';
    return itemHtml('review','★','نظر جدید برای '+(review.product&&review.product.name||'محصول'),customer+' · '+fa(review.rating)+' ستاره','reviews');
  });
  var returnItems=model.returns.map(function(request){
    var customer=personName(request.customer)||'مشتری';
    return itemHtml('return','↩','درخواست مرجوعی سفارش #'+fa(request.orderId||request.order&&request.order.id||''),customer+' · '+(request.reason||'بدون دلیل'),'returns');
  });
  var stockItems=model.stock.map(function(product){
    return itemHtml('stock','◫','موجودی کم: '+(product.name||'محصول'),'موجودی '+fa(product.stockQty||0)+' · حد هشدار '+fa(product.lowStockAt||0),'product',product.id);
  });

  body.innerHTML=
    groupHtml('واریزی‌های نیازمند بررسی',model.counts.payments,paymentItems)+
    groupHtml('سفارش‌های آماده ارسال',model.counts.shipping,shippingItems)+
    groupHtml('نظرات در انتظار بررسی',model.counts.reviews,reviewItems)+
    groupHtml('درخواست‌های مرجوعی',model.counts.returns,returnItems)+
    groupHtml('هشدار موجودی',model.counts.stock,stockItems);

  body.querySelectorAll('[data-notification-target]').forEach(function(row){
    row.addEventListener('click',function(){
      navigate(row.dataset.notificationTarget,Number(row.dataset.notificationId||0));
    });
  });
  setBadge();
}
function navigate(target,id){
  closeCenter();
  if(target==='payments'){location.hash='#/payments-history';return;}
  if(target==='shipping'){location.hash='#/sales';return;}
  if(target==='reviews'){location.hash='#/reviews';return;}
  if(target==='returns'){location.hash='#/returns';return;}
  if(target==='product'){
    location.hash='#/products';
    if(id>0)setTimeout(function(){if(typeof openProductForm==='function')openProductForm(id);},180);
  }
}
function settledValue(result,fallback){
  return result&&result.status==='fulfilled'?result.value:fallback;
}
async function refresh(force){
  if(loading)return;
  if(!force&&Date.now()-lastLoadedAt<15000){render();return;}
  loading=true;
  if(refreshButton){refreshButton.disabled=true;refreshButton.classList.add('is-loading');}

  try{
    var results=await Promise.allSettled([
      sellerApiFetch('/payments?status=pending'),
      sellerApiFetch('/orders/seller'),
      sellerApiFetch('/reviews/seller?status=pending'),
      sellerApiFetch('/orders/seller/returns?status=requested'),
      sellerApiFetch('/dashboard/summary')
    ]);

    var payments=settledValue(results[0],[]);
    var orders=settledValue(results[1],[]);
    var reviews=settledValue(results[2],[]);
    var returns=settledValue(results[3],[]);
    var dashboard=settledValue(results[4],null);
    var failed=results.filter(function(result){return result.status==='rejected';}).length;

    model.payments=Array.isArray(payments)?payments.filter(function(row){return row.status==='pending';}).slice(0,25):[];
    model.shipping=Array.isArray(orders)?orders.filter(function(row){return row.status==='confirmed'||row.status==='paid';}).slice(0,25):[];
    model.reviews=Array.isArray(reviews)?reviews.filter(function(row){return row.status==='pending';}).slice(0,25):[];
    model.returns=Array.isArray(returns)?returns.filter(function(row){return row.status==='requested';}).slice(0,25):[];
    model.stock=dashboard&&Array.isArray(dashboard.lowStock)?dashboard.lowStock.slice(0,25):[];

    var decision=dashboard&&dashboard.decisionMetrics?dashboard.decisionMetrics:{};
    model.counts={
      payments:Array.isArray(payments)?payments.filter(function(row){return row.status==='pending';}).length:Number(dashboard&&dashboard.pendingPayments||0),
      shipping:Array.isArray(orders)?orders.filter(function(row){return row.status==='confirmed'||row.status==='paid';}).length:Number(decision.orderStatuses&&decision.orderStatuses.readyToShip||0),
      reviews:Array.isArray(reviews)?reviews.filter(function(row){return row.status==='pending';}).length:model.reviews.length,
      returns:Array.isArray(returns)?returns.filter(function(row){return row.status==='requested';}).length:model.returns.length,
      stock:Number(decision.lowStockCount!=null?decision.lowStockCount:model.stock.length)
    };

    lastLoadedAt=Date.now();
    render();
    var sub=document.getElementById('notification-center-sub');
    if(sub)sub.textContent=failed?'بعضی منابع اعلان در دسترس نبودند؛ موارد موجود نمایش داده شده‌اند':'مواردی که الان به اقدام شما نیاز دارند';
  }catch(error){
    if(body)body.innerHTML='<div class="notification-center__error">دریافت اعلان‌ها ناموفق بود. دوباره تازه‌سازی کنید.</div>';
  }finally{
    loading=false;
    if(refreshButton){refreshButton.disabled=false;refreshButton.classList.remove('is-loading');}
  }
}
function init(){
  if(!createShell())return;
  refresh(true);
  window.addEventListener('focus',function(){if(Date.now()-lastLoadedAt>30000)refresh(false);});
  window.addEventListener('hashchange',function(){setTimeout(function(){refresh(true);},350);});
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden&&Date.now()-lastLoadedAt>30000)refresh(false);
  });
  setInterval(function(){if(!document.hidden)refresh(false);},90000);
  window.refreshNotificationCenter=function(){return refresh(true);};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();