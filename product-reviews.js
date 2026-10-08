(function(){
'use strict';
var page=document.getElementById('pdp-page');
if(!page)return;
var productId=Number(new URLSearchParams(window.location.search).get('id'));
if(!productId)return;
var data={summary:{count:0,average:0},reviews:[]};
var own=null;
var selected=5;
var started=false;

function e(v){return typeof escapeHtml==='function'?escapeHtml(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof toFaDigits==='function'?toFaDigits(v):String(v);}
function sess(){try{return getCustomerSession();}catch(_){return null;}}
function starText(v){var n=Math.max(0,Math.min(5,Math.round(Number(v)||0)));return '★'.repeat(n)+'☆'.repeat(5-n);}
function statusText(v){if(v==='approved')return 'نظر شما منتشر شده است.';if(v==='rejected')return 'نظر شما تأیید نشد؛ می‌توانید ویرایش و دوباره ارسال کنید.';return 'نظر شما ثبت شده و بعد از بررسی منتشر می‌شود.';}
function dateText(v){try{return new Date(v).toLocaleDateString('fa-IR-u-ca-persian');}catch(_){return '';}}

function addSummary(){
  var title=page.querySelector('.pdp-title');if(!title)return;
  var box=page.querySelector('.pdp-rating-summary');
  if(!box){box=document.createElement('div');box.className='pdp-rating-summary';title.insertAdjacentElement('afterend',box);}
  var count=Number(data.summary.count||0),avg=Number(data.summary.average||0);
  box.innerHTML=count?'<span class="pdp-rating-stars">'+starText(avg)+'</span><strong>'+fa(avg.toFixed(1))+'</strong><span>از '+fa(count)+' نظر</span>':'<span class="pdp-rating-stars">☆☆☆☆☆</span><span>هنوز امتیازی ثبت نشده</span>';
}

function reviewCard(r){
  return '<article class="pdp-review-card"><div class="pdp-review-card-head"><div class="pdp-review-person"><strong>'+e(r.customerName||'کاربر')+'</strong><span>'+e(dateText(r.createdAt))+'</span>'+(r.verifiedPurchase?'<span class="pdp-verified">✓ خریدار تأییدشده</span>':'')+'</div><span class="pdp-rating-stars">'+starText(r.rating)+'</span></div><p>'+e(r.body)+'</p></article>';
}

function formHtml(){
  if(!sess())return '<div class="pdp-review-login">برای ثبت نظر، <a href="login.html?next='+encodeURIComponent('product-detail.html?id='+productId)+'">وارد حساب کاربری</a> شو.</div>';
  var r=own&&own.review?own.review:null;
  selected=r?Number(r.rating):5;
  return '<form class="pdp-review-form" id="pdp-review-form"><h3>'+(r?'ویرایش نظر شما':'نظر شما درباره این محصول')+'</h3><div class="pdp-star-picker" id="pdp-star-picker">'+[5,4,3,2,1].map(function(n){return '<button type="button" data-rating="'+n+'">★</button>';}).join('')+'</div><textarea id="pdp-review-body" maxlength="2000" placeholder="تجربه‌ات از این محصول را بنویس...">'+e(r?r.body:'')+'</textarea>'+(r?'<div class="pdp-own-review-status '+e(r.status)+'">'+e(statusText(r.status))+(r.verifiedPurchase?' · خریدار تأییدشده':'')+'</div>':'')+'<div class="pdp-review-form-actions"><span class="pdp-review-note">'+(own&&own.verifiedPurchase?'سابقه خرید این محصول تأیید شده است.':'نظر بعد از بررسی فروشگاه منتشر می‌شود.')+'</span><button type="submit" class="pdp-review-submit">'+(r?'ارسال دوباره نظر':'ثبت نظر')+'</button></div></form>';
}

function render(){
  addSummary();
  var sections=page.querySelector('.pdp-sections');if(!sections)return;
  var section=page.querySelector('#pdp-reviews-section');
  if(!section){section=document.createElement('section');section.id='pdp-reviews-section';section.className='pdp-reviews';sections.appendChild(section);}
  var count=Number(data.summary.count||0),avg=Number(data.summary.average||0),reviews=Array.isArray(data.reviews)?data.reviews:[];
  section.innerHTML='<div class="pdp-reviews-head"><div><h2>نظر و امتیاز خریداران</h2><p>تجربه کاربران درباره این محصول</p></div><div class="pdp-review-score"><strong>'+(count?fa(avg.toFixed(1)):'—')+'</strong><div class="pdp-rating-stars">'+starText(avg)+'</div><span>'+fa(count)+' نظر</span></div></div>'+formHtml()+'<div class="pdp-reviews-list">'+(reviews.length?reviews.map(reviewCard).join(''):'<div class="pdp-review-empty">هنوز نظر تأییدشده‌ای ثبت نشده است.</div>')+'</div>';
  bindForm();
}

function paintStars(){
  var picker=page.querySelector('#pdp-star-picker');if(!picker)return;
  picker.querySelectorAll('[data-rating]').forEach(function(b){b.classList.toggle('active',Number(b.dataset.rating)<=selected);});
}
function bindForm(){
  var form=page.querySelector('#pdp-review-form');if(!form)return;
  form.querySelectorAll('[data-rating]').forEach(function(b){b.addEventListener('click',function(){selected=Number(b.dataset.rating);paintStars();});});
  paintStars();
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var body=form.querySelector('#pdp-review-body').value.trim();
    if(body.length<3){form.querySelector('#pdp-review-body').focus();return;}
    var submit=form.querySelector('.pdp-review-submit');submit.disabled=true;submit.textContent='در حال ثبت...';
    apiFetch('/reviews/'+productId,{method:'POST',body:JSON.stringify({rating:selected,body:body})})
      .then(loadAll)
      .catch(function(err){submit.disabled=false;submit.textContent='ثبت نظر';var note=form.querySelector('.pdp-review-note');if(note)note.textContent=err.message||'ثبت نظر انجام نشد.';});
  });
}
function loadAll(){
  var publicReq=apiFetch('/reviews/public/'+SELLER_ID+'/'+productId).then(function(v){data=v;});
  var mineReq=sess()?apiFetch('/reviews/mine/'+productId).then(function(v){own=v;}).catch(function(){own=null;}):Promise.resolve();
  return Promise.all([publicReq,mineReq]).then(render);
}
function start(){
  if(started||!page.querySelector('.pdp-sections')||!page.querySelector('.pdp-title'))return;
  started=true;loadAll().catch(render);
}
new MutationObserver(start).observe(page,{childList:true,subtree:true});
start();
})();