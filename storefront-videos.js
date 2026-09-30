/* Homepage education-video enhancements. Keeps the rail lightweight and links to the full library. */
(function(){
  'use strict';

  function productIdFromCard(card){
    const link=card.querySelector('a[href*="product-detail.html?id="]');
    if(!link)return null;
    try{
      const url=new URL(link.getAttribute('href'),location.href);
      return Number(url.searchParams.get('id'))||null;
    }catch(_){return null}
  }

  function categoryLabel(product){
    if(product&&product.category&&product.category.name)return String(product.category.name);
    if(product&&product.categoryName)return String(product.categoryName);
    return 'آموزش استفاده';
  }

  async function enhance(){
    const section=document.querySelector('.sf-video-section');
    if(!section)return;

    const allLink=section.querySelector('.sf-section-head>a');
    if(allLink){
      allLink.href='videos.html';
      allLink.setAttribute('aria-label','مشاهده همه ویدیوهای آموزشی');
    }

    const cards=[...section.querySelectorAll('.sf-video-card')];
    cards.forEach(card=>{
      const video=card.querySelector('video');
      if(video){
        video.autoplay=false;
        video.loop=false;
        video.setAttribute('playsinline','');
        video.preload='metadata';
        video.addEventListener('play',()=>card.classList.add('is-playing'));
        video.addEventListener('pause',()=>card.classList.remove('is-playing'));
        video.addEventListener('ended',()=>card.classList.remove('is-playing'));
      }
    });

    if(!cards.length||typeof apiFetch!=='function'||typeof SELLER_ID==='undefined')return;
    try{
      const products=await apiFetch('/products/public/'+SELLER_ID);
      const map=new Map((Array.isArray(products)?products:[]).map(p=>[Number(p.id),p]));
      cards.forEach(card=>{
        const id=productIdFromCard(card), product=map.get(id);
        const tag=card.querySelector('.sf-video-copy>span');
        if(tag)tag.textContent=categoryLabel(product);
      });
    }catch(_){/* labels remain usable without a second successful request */}
  }

  window.addEventListener('storefront:home-ready',enhance,{once:true});
  if(document.querySelector('.sf-video-section'))enhance();
})();
