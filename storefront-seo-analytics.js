/* Item 10: storefront SEO + privacy-conscious first-party analytics. */
(function(){
'use strict';

var BASE='https://asroom7.github.io/crm-storefront/';
var PUBLIC_PAGES={
  'index.html':true,
  'products.html':true,
  'product-detail.html':true,
  'education.html':true,
  'cart.html':true
};

function pageFile(){
  return window.location.pathname.split('/').filter(Boolean).pop()||'index.html';
}
function absolute(file){
  return BASE+(file==='index.html'?'':file);
}
function ensureMeta(selector,attrs){
  var el=document.head.querySelector(selector);
  if(!el){
    el=document.createElement('meta');
    Object.keys(attrs).forEach(function(key){if(key!=='content')el.setAttribute(key,attrs[key]);});
    document.head.appendChild(el);
  }
  if(attrs.content!=null)el.setAttribute('content',String(attrs.content));
  return el;
}
function setNamedMeta(name,content){
  ensureMeta('meta[name="'+name+'"]',{name:name,content:content});
}
function setPropertyMeta(property,content){
  ensureMeta('meta[property="'+property+'"]',{property:property,content:content});
}
function setCanonical(url){
  var el=document.head.querySelector('link[rel="canonical"]');
  if(!el){el=document.createElement('link');el.rel='canonical';document.head.appendChild(el);}
  el.href=url;
}
function cleanText(value,max){
  var text=String(value||'').replace(/\s+/g,' ').trim();
  if(max&&text.length>max)text=text.slice(0,max-1).trim()+'…';
  return text;
}
function setTitle(value){
  document.title=value;
  setPropertyMeta('og:title',value);
  setPropertyMeta('og:site_name','Lumière');
}
function putJsonLd(id,data){
  var old=document.getElementById(id);
  if(old)old.remove();
  var script=document.createElement('script');
  script.id=id;
  script.type='application/ld+json';
  script.textContent=JSON.stringify(data);
  document.head.appendChild(script);
}
function storeBrand(config){
  return cleanText(config&&config.seller&&(config.seller.brandName||config.seller.name),80)||'Lumière';
}
function applyStaticSeo(){
  var file=pageFile();
  if(!PUBLIC_PAGES[file])return;

  setNamedMeta('robots','index,follow,max-image-preview:large');
  setPropertyMeta('og:type','website');
  setPropertyMeta('og:locale','fa_IR');

  var title='فروشگاه آرایشی و بهداشتی';
  var description='خرید آنلاین محصولات مراقبتی، آرایشی و زیبایی.';
  var canonical=absolute(file);

  if(file==='products.html'){
    title='محصولات | Lumière';
    description='مشاهده، جستجو و فیلتر محصولات مراقبتی، آرایشی و زیبایی.';
  }else if(file==='education.html'){
    title='آموزش و نکات مراقبتی | Lumière';
    description='محتوای آموزشی و نکات کاربردی برای انتخاب و استفاده بهتر از محصولات.';
  }else if(file==='cart.html'){
    title='سبد خرید | Lumière';
    description='مرور کالاهای انتخاب‌شده در سبد خرید.';
    setNamedMeta('robots','noindex,follow');
  }

  if(file!=='product-detail.html'){
    setTitle(title);
    setNamedMeta('description',description);
    setPropertyMeta('og:description',description);
    setPropertyMeta('og:url',canonical);
    setCanonical(canonical);
  }

  if(file==='index.html'){
    fetchStoreConfig().then(function(config){
      var brand=storeBrand(config);
      var homeTitle=brand+' | فروشگاه آنلاین';
      setTitle(homeTitle);
      putJsonLd('seo-store-schema',{
        '@context':'https://schema.org',
        '@type':'Store',
        name:brand,
        url:BASE
      });
    }).catch(function(){
      putJsonLd('seo-store-schema',{
        '@context':'https://schema.org',
        '@type':'Store',
        name:'Lumière',
        url:BASE
      });
    });
  }else if(file==='products.html'){
    putJsonLd('seo-collection-schema',{
      '@context':'https://schema.org',
      '@type':'CollectionPage',
      name:'محصولات',
      url:absolute('products.html')
    });
  }else if(file==='education.html'){
    putJsonLd('seo-education-schema',{
      '@context':'https://schema.org',
      '@type':'CollectionPage',
      name:'آموزش و نکات مراقبتی',
      url:absolute('education.html')
    });
  }
}

function productIdFromUrl(){
  var value=Number(new URLSearchParams(window.location.search).get('id'));
  return Number.isInteger(value)&&value>0?value:0;
}
function applyProductSeo(){
  if(pageFile()!=='product-detail.html')return Promise.resolve(null);
  var productId=productIdFromUrl();
  if(!productId){
    setNamedMeta('robots','noindex,follow');
    return Promise.resolve(null);
  }
  var canonical=absolute('product-detail.html')+'?id='+encodeURIComponent(productId);
  setCanonical(canonical);
  setPropertyMeta('og:url',canonical);
  setPropertyMeta('og:type','product');
  setNamedMeta('robots','index,follow,max-image-preview:large');

  return apiFetch('/products/public/'+SELLER_ID+'/'+productId).then(function(product){
    var name=cleanText(product&&product.name,120)||'محصول';
    var description=cleanText(product&&product.description,160)||('مشاهده مشخصات و خرید '+name+'.');
    var title=name+' | Lumière';
    var image='';
    var price=0;
    try{image=getProductImageUrl(product)||'';}catch(e){}
    try{price=Number(getProductMinPrice(product)||0);}catch(e){}

    setTitle(title);
    setNamedMeta('description',description);
    setPropertyMeta('og:description',description);
    if(image)setPropertyMeta('og:image',image);

    var schema={
      '@context':'https://schema.org',
      '@type':'Product',
      name:name,
      description:description,
      url:canonical
    };
    if(image)schema.image=[image];
    if(price>0){
      schema.offers={
        '@type':'Offer',
        url:canonical,
        priceCurrency:'IRR',
        price:String(Math.round(price*10)),
        availability:Number(product.stockQty||0)>0?'https://schema.org/InStock':'https://schema.org/OutOfStock'
      };
    }
    putJsonLd('seo-product-schema',schema);
    return product;
  }).catch(function(){
    setNamedMeta('robots','noindex,follow');
    return null;
  });
}

function randomId(prefix){
  try{
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return prefix+window.crypto.randomUUID();
  }catch(e){}
  return prefix+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
}
function storedId(storage,key,prefix){
  try{
    var value=storage.getItem(key);
    if(value&&/^[A-Za-z0-9_-]{8,80}$/.test(value))return value;
    value=randomId(prefix).slice(0,80);
    storage.setItem(key,value);
    return value;
  }catch(e){
    return randomId(prefix).slice(0,80);
  }
}
function analyticsAllowed(){
  return String(navigator.doNotTrack||window.doNotTrack||'')!=='1';
}
function visitorId(){
  return storedId(window.localStorage,'storefrontAnalyticsVisitor','v_');
}
function sessionId(){
  return storedId(window.sessionStorage,'storefrontAnalyticsSession','s_');
}
function sendEvent(type,data){
  if(!analyticsAllowed())return Promise.resolve();
  var payload=Object.assign({
    visitorId:visitorId(),
    sessionId:sessionId(),
    eventType:type,
    path:pageFile()
  },data||{});
  return fetch(API_BASE+'/storefront-insights/public/'+SELLER_ID+'/events',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    keepalive:true
  }).catch(function(){});
}
function wireAnalytics(productPromise){
  var file=pageFile();
  if(PUBLIC_PAGES[file])sendEvent('page_view');

  if(file==='product-detail.html'){
    productPromise.then(function(product){
      if(product&&product.id)sendEvent('product_view',{productId:Number(product.id)});
    });
  }
  if(file==='checkout.html'){
    sendEvent('begin_checkout');
  }

  if(typeof window.addToCart==='function'&&!window.addToCart.__analyticsWrapped){
    var original=window.addToCart;
    var wrapped=function(productId,quantity){
      var result=original.apply(this,arguments);
      var id=Number(productId);
      var qty=Math.max(1,Math.floor(Number(quantity)||1));
      if(Number.isInteger(id)&&id>0)sendEvent('add_to_cart',{productId:id,quantity:qty});
      return result;
    };
    wrapped.__analyticsWrapped=true;
    window.addToCart=wrapped;
  }
}

applyStaticSeo();
var productPromise=applyProductSeo();
wireAnalytics(productPromise);
})();