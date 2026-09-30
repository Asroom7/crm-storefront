/* Home educational video rail enhancements. */
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

  function labelFor(product){
    if(product&&product.category&&product.category.name)return String(product.category.name);
    if(product&&product.categoryName)return String(product.categoryName);
    return 'آموزش استفاده';
  }

  async function enhanceEducationSection(){
    const section=document.querySelector('.sf-video-section');
    if(!section)return;

    section.id='education-videos';
    section.setAttribute('aria-label','آموزش‌ها');

    const allLink=section.querySelector('.sf-section-head > a');
    if(allLink){
      allLink.href='education.html';
      allLink.innerHTML='مشاهده همه <span aria-hidden="true">‹</span>';
      allLink.setAttribute('aria-label','مشاهده همه ویدیوهای آموزشی');
    }

    const rail=section.querySelector('.sf-video-grid, .sf-video-demo');
    if(rail){
      rail.setAttribute('role','region');
      rail.setAttribute('aria-label','فهرست افقی ویدیوهای آموزشی');
      rail.setAttribute('tabindex','0');
    }

    const cards=Array.from(section.querySelectorAll('.sf-video-card'));
    const videos=Array.from(section.querySelectorAll('video'));
    videos.forEach((video,index)=>{
      const card=video.closest('.sf-video-card');
      video.autoplay=false;
      video.loop=false;
      video.preload='metadata';
      video.playsInline=true;
      video.setAttribute('aria-label','ویدیوی آموزشی '+(index+1));
      video.addEventListener('play',()=>{
        if(card)card.classList.add('is-playing');
        videos.forEach(other=>{
          if(other!==video&&!other.paused)other.pause();
        });
      });
      video.addEventListener('pause',()=>card&&card.classList.remove('is-playing'));
      video.addEventListener('ended',()=>card&&card.classList.remove('is-playing'));
    });

    if(!cards.length||typeof apiFetch!=='function'||typeof SELLER_ID==='undefined')return;
    try{
      const products=await apiFetch('/products/public/'+SELLER_ID);
      const map=new Map((Array.isArray(products)?products:[]).map(product=>[Number(product.id),product]));
      cards.forEach(card=>{
        const product=map.get(productIdFromCard(card));
        const badge=card.querySelector('.sf-video-copy > span');
        if(badge)badge.textContent=labelFor(product);
      });
    }catch(_){/* Generic badge remains if the category request fails. */}
  }

  window.addEventListener('storefront:home-ready',enhanceEducationSection);
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceEducationSection,0),{once:true});
  }else{
    setTimeout(enhanceEducationSection,0);
  }
})();
