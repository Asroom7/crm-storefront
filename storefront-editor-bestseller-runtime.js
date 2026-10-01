/* Final best-seller renderer: auto mode always follows real best-seller IDs. */
(function(){
'use strict';
if(!window.StorefrontHome||typeof window.StorefrontHome.registerSection!=='function')return;
function arr(v){return Array.isArray(v)?v:[];}
function esc(v){return typeof escapeHtml==='function'?escapeHtml(v==null?'':String(v)):String(v||'');}
function b(v,d){return typeof v==='boolean'?v:d;}
function n(v,d,min,max){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):d;}
function pimg(p){try{if(typeof getProductImageUrl==='function')return getProductImageUrl(p)||'';}catch(e){}return'';}
function price(p){try{return typeof getProductPriceLabel==='function'?getProductPriceLabel(p):'';}catch(e){return'';}}
function byIds(ids,products){const map=new Map(arr(products).map(p=>[Number(p.id),p]));return arr(ids).map(Number).map(id=>map.get(id)).filter(Boolean);}
function category(p){return p&&p.category&&p.category.name?String(p.category.name):'بدون دسته‌بندی';}
function stock(p){const q=Number(p&&p.stockQty||0),low=Number(p&&p.lowStockAt||0);return q<=0?'ناموجود':low>0&&q<=low?'رو به اتمام':'موجود';}
function style(block){const s=block.settings||{};return'background:'+esc(s.backgroundColor||'transparent')+';color:'+esc(s.textColor||'inherit')+';border-radius:'+n(s.cardRadius,20,0,60)+'px;padding-top:'+n(s.paddingTop,24,0,160)+'px;padding-bottom:'+n(s.paddingBottom,24,0,160)+'px;--sec-gap:'+n(s.gap,12,0,64)+'px;--sec-card-min:'+n(s.cardMinWidth,180,100,420)+'px;--sec-visible:'+n(s.visibleCards,2,1,6)+';--sec-card-radius:'+n(s.cardRadius,20,0,60)+';';}
function card(p,block){const s=block.settings||{},im=pimg(p),promos=s.promotions&&typeof s.promotions==='object'?s.promotions:{},pr=promos[String(p.id)]||promos[p.id]||{},old=pr.enabled&&pr.oldPrice?String(pr.oldPrice):'',label=pr.enabled&&pr.discountLabel?String(pr.discountLabel):'پرفروش';return'<a class="sf-editor-product-card" href="product-detail.html?id='+encodeURIComponent(p.id)+'"><div class="media">'+(im?'<img src="'+esc(im)+'" alt="'+esc(p.name)+'" loading="lazy">':'<span class="placeholder">✦</span>')+'<span class="stock">'+esc(stock(p))+'</span>'+(b(s.showDiscount,true)&&label?'<span class="discount">'+esc(label)+'</span>':'')+'</div><div class="copy"><span class="cat">'+esc(category(p))+'</span><h3>'+esc(p.name)+'</h3>'+(b(s.showPrice,true)?(b(s.showDiscount,true)&&old?'<div class="old-price">'+esc(old)+'</div>':'')+'<div class="price">'+esc(price(p))+'</div>':'')+'</div></a>';}
window.StorefrontHome.registerSection('best-sellers',function(block,ctx){
  const s=block.settings||{},c=block.content||{};
  const ids=s.mode==='auto'?arr(ctx.bestSellerIds):arr(s.productIds);
  const products=byIds(ids,ctx.products).slice(0,n(s.limit,8,1,20));
  const subtitle=b(s.showSubtitle,true)&&c.subtitle?'<p>'+esc(c.subtitle)+'</p>':'';
  const all=b(s.showAll,true)?'<a href="products.html">مشاهده همه <span>‹</span></a>':'';
  const head='<div class="sf-section-head"><div><h2>'+esc(c.title||'پرفروش‌ترین‌ها')+'</h2>'+subtitle+'</div>'+all+'</div>';
  const items=products.length?'<div class="sf-editor-items '+(b(s.horizontalScroll,true)?'':'is-grid')+'">'+products.map(p=>card(p,block)).join('')+'</div>':'<div class="sf-section-empty">محصولات پرفروش به‌زودی اضافه می‌شوند.</div>';
  return'<section class="sf-section sf-container sf-editor-section sf-best-sellers" data-section-id="'+esc(block.id)+'" style="'+style(block)+'">'+head+items+'</section>';
});
})();
