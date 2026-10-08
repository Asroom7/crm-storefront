(function(){
'use strict';
var ROUTE='reviews',rows=[],filter='pending',loading=false;
function rn(){return location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';}
function s(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof faDigits==='function'?faDigits(v):String(v);}
function root(){return document.getElementById('view');}
function stars(v){var n=Math.max(0,Math.min(5,Number(v)||0));return '★'.repeat(n)+'☆'.repeat(5-n);}
function label(v){return v==='approved'?'تأییدشده':v==='rejected'?'ردشده':'در انتظار';}
function date(v){try{return new Date(v).toLocaleDateString('fa-IR-u-ca-persian');}catch(_){return '';}}

function addSettingsLink(){
  if(rn()!=='settings')return;
  var view=root();if(!view||view.querySelector('[data-review-link]'))return;
  var groups=Array.from(view.querySelectorAll('.settings-group__title'));
  var title=groups.find(function(el){return el.textContent.trim()==='مدیریت فروشگاه';});
  var target=title?title.closest('.settings-group'):view.querySelector('.settings-group');
  if(!target)return;
  var a=document.createElement('a');
  a.href='#/reviews';a.className='settings-row';a.dataset.reviewLink='1';a.style.cssText='text-decoration:none;color:inherit;';
  a.innerHTML='<div class="settings-row__icon">★</div><div class="settings-row__text"><div class="settings-row__title">نظرات محصولات</div><div class="settings-row__desc">بررسی و تأیید نظر مشتریان</div></div><div class="settings-row__chev">‹</div>';
  target.appendChild(a);
}
function counts(){
  return {all:rows.length,pending:rows.filter(function(r){return r.status==='pending';}).length,approved:rows.filter(function(r){return r.status==='approved';}).length,rejected:rows.filter(function(r){return r.status==='rejected';}).length};
}
function summary(){
  var c=counts(),items=[['all','همه',c.all],['pending','در انتظار',c.pending],['approved','تأییدشده',c.approved],['rejected','ردشده',c.rejected]];
  return '<div class="rm-summary">'+items.map(function(x){return '<button type="button" class="'+(filter===x[0]?'active':'')+'" data-rmf="'+x[0]+'"><strong>'+fa(x[2])+'</strong><span>'+x[1]+'</span></button>';}).join('')+'</div>';
}
function card(r){
  var customer=[r.customer&&r.customer.firstName,r.customer&&r.customer.lastName].filter(Boolean).join(' ')||'مشتری';
  return '<article class="rm-card" data-rid="'+r.id+'"><div class="rm-card-head"><div><div class="rm-product">'+s(r.product&&r.product.name||'محصول')+'</div><div class="rm-customer">'+s(customer)+'</div><span class="rm-status '+s(r.status)+'">'+label(r.status)+'</span></div><div class="rm-stars">'+stars(r.rating)+'</div></div><div class="rm-body">'+s(r.body)+'</div><div class="rm-meta"><span>'+s(date(r.createdAt))+'</span>'+(r.verifiedPurchase?'<span class="rm-verified">✓ خریدار تأییدشده</span>':'<span>بدون خرید تأییدشده</span>')+'</div><div class="rm-actions">'+(r.status!=='approved'?'<button type="button" class="approve" data-act="approved">تأیید و انتشار</button>':'')+(r.status!=='rejected'?'<button type="button" class="reject" data-act="rejected">رد نظر</button>':'')+'</div></article>';
}
function render(){
  var view=root();if(!view)return;
  if(typeof renderNav==='function')renderNav('settings');
  var shown=filter==='all'?rows:rows.filter(function(r){return r.status===filter;});
  view.innerHTML='<section class="review-manager"><div class="rm-head"><div><h1>نظرات محصولات</h1><p>نظرهای مشتریان قبل از انتشار عمومی اینجا بررسی می‌شوند.</p></div></div>'+summary()+'<div class="rm-list">'+(shown.length?shown.map(card).join(''):'<div class="rm-empty">نظری در این وضعیت وجود ندارد.</div>')+'</div></section>';
  view.querySelectorAll('[data-rmf]').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.rmf;render();});});
  view.querySelectorAll('[data-rid]').forEach(function(node){node.querySelectorAll('[data-act]').forEach(function(b){b.addEventListener('click',function(){moderate(Number(node.dataset.rid),b.dataset.act,b);});});});
}
function fetchRows(){loading=true;return sellerApiFetch('/reviews/seller').then(function(v){rows=Array.isArray(v)?v:[];}).finally(function(){loading=false;});}
function moderate(id,status,button){
  button.disabled=true;
  sellerApiFetch('/reviews/seller/'+id,{method:'PATCH',body:JSON.stringify({status:status})}).then(function(){
    if(typeof toast==='function')toast(status==='approved'?'نظر منتشر شد':'نظر رد شد');
    return fetchRows();
  }).then(render).catch(function(e){button.disabled=false;if(typeof toast==='function')toast(e.message||'تغییر وضعیت انجام نشد');});
}
function route(){
  if(rn()!==ROUTE){addSettingsLink();return;}
  var view=root();if(!view||loading)return;
  view.innerHTML='<div class="review-manager"><div class="rm-empty">در حال دریافت نظرات...</div></div>';
  fetchRows().then(render).catch(function(e){view.innerHTML='<div class="review-manager"><div class="rm-empty">'+s(e.message||'دریافت نظرات ناموفق بود')+'</div></div>';});
}
window.addEventListener('hashchange',function(){setTimeout(route,0);});
window.addEventListener('pageshow',function(){addSettingsLink();route();});
new MutationObserver(function(){addSettingsLink();if(rn()===ROUTE){var v=root();if(v&&!v.querySelector('.review-manager'))route();}}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(function(){addSettingsLink();route();},50);
})();