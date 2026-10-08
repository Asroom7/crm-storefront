/* Phase 5 wishlist section. Scope: profile.html only. */
(function(){
'use strict';

const orders=document.getElementById('orders-list');
if(!orders)return;

function safe(v){return typeof escapeHtml==='function'?escapeHtml(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof toFaDigits==='function'?toFaDigits(v):String(v);}
function price(product){return typeof getProductPriceLabel==='function'?getProductPriceLabel(product):'قیمت ثبت نشده';}
function image(product){try{return typeof getProductImageUrl==='function'?getProductImageUrl(product)||'':'';}catch(e){return '';}}

const section=document.createElement('section');
section.className='section-block profile-wishlist-section';
section.innerHTML='<div class="profile-wishlist-head"><h2>علاقه‌مندی‌های من</h2><span class="profile-wishlist-count" id="profile-wishlist-count">...</span></div><div class="profile-wishlist-grid" id="profile-wishlist-grid"><div class="profile-wishlist-empty">در حال بارگذاری...</div></div>';
orders.closest('.section-block').insertAdjacentElement('afterend',section);

const grid=document.getElementById('profile-wishlist-grid');
const count=document.getElementById('profile-wishlist-count');

function card(item){
  const product=item.product||{};
  const img=image(product);
  const category=product.category&&product.category.name?product.category.name:'بدون دسته‌بندی';
  return '<article class="profile-wishlist-card" data-wish-product="'+Number(item.productId)+'">'+
    '<a class="profile-wishlist-link" href="product-detail.html?id='+encodeURIComponent(item.productId)+'">'+
      '<div class="profile-wishlist-media">'+(img?'<img src="'+safe(img)+'" alt="'+safe(product.name||'محصول')+'" loading="lazy" decoding="async">':'<span class="profile-wishlist-placeholder">بدون تصویر</span>')+'</div>'+
      '<div class="profile-wishlist-body"><span>'+safe(category)+'</span><h3>'+safe(product.name||'محصول')+'</h3><strong>'+safe(price(product))+'</strong></div>'+
    '</a>'+
    '<button type="button" class="profile-wishlist-remove" aria-label="حذف از علاقه‌مندی‌ها" title="حذف از علاقه‌مندی‌ها">♥</button>'+
  '</article>';
}

function bindRemove(){
  grid.querySelectorAll('[data-wish-product]').forEach(function(node){
    const button=node.querySelector('.profile-wishlist-remove');
    button.addEventListener('click',function(){
      const id=Number(node.dataset.wishProduct);
      button.disabled=true;
      apiFetch('/wishlist/'+id,{method:'DELETE'})
        .then(load)
        .catch(function(err){button.disabled=false;button.title=err.message||'حذف انجام نشد';});
    });
  });
}

function render(items){
  count.textContent=fa(items.length)+' محصول';
  if(!items.length){
    grid.innerHTML='<div class="profile-wishlist-empty"><strong>هنوز محصولی ذخیره نکردی.</strong><a href="products.html">مشاهده محصولات</a></div>';
    return;
  }
  grid.innerHTML=items.map(card).join('');
  bindRemove();
}

function load(){
  return apiFetch('/wishlist')
    .then(function(items){render(Array.isArray(items)?items:[]);})
    .catch(function(err){
      count.textContent='—';
      grid.innerHTML='<div class="profile-wishlist-empty"><strong>علاقه‌مندی‌ها بارگذاری نشد.</strong><span>'+safe(err.message||'دوباره تلاش کنید.')+'</span></div>';
    });
}
load();
})();