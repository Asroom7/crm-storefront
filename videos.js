/* Full education video library. */
(function(){
  'use strict';
  const grid=document.getElementById('all-videos-grid');
  const filters=document.getElementById('videos-filter-strip');
  if(!grid)return;

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  function safeUrl(value){
    if(!value)return'';
    try{
      const u=new URL(String(value),location.href);
      return ['http:','https:'].includes(u.protocol)?u.href:'';
    }catch(_){return''}
  }
  function categoryName(product){
    return product&&product.category&&product.category.name?String(product.category.name):(product&&product.categoryName?String(product.categoryName):'سایر آموزش‌ها');
  }

  function renderCards(rows){
    if(!rows.length){
      grid.innerHTML='<div class="videos-empty">هنوز ویدیوی آموزشی برای نمایش ثبت نشده است.</div>';
      return;
    }
    grid.innerHTML=rows.map(row=>{
      const url=safeUrl(row.media&&row.media.url);
      return '<article class="all-video-card" data-category="'+esc(row.category)+'">'
        +'<video controls playsinline preload="metadata" aria-label="'+esc(row.product.name)+'"><source src="'+esc(url)+'"></video>'
        +'<div class="all-video-card-copy"><span>'+esc(row.category)+'</span><h2>'+esc(row.product.name)+'</h2></div>'
        +'</article>';
    }).join('');
  }

  function bindFilters(categories,rows){
    if(!filters)return;
    const items=['همه',...categories];
    filters.innerHTML=items.map((name,index)=>'<button type="button" class="videos-filter'+(index===0?' is-active':'')+'" data-filter="'+esc(name)+'">'+esc(name)+'</button>').join('');
    filters.addEventListener('click',event=>{
      const button=event.target.closest('.videos-filter');
      if(!button)return;
      filters.querySelectorAll('.videos-filter').forEach(item=>item.classList.toggle('is-active',item===button));
      const value=button.dataset.filter;
      grid.querySelectorAll('.all-video-card').forEach(card=>{
        card.hidden=value!=='همه'&&card.dataset.category!==value;
      });
    });
  }

  async function boot(){
    if(typeof apiFetch!=='function'||typeof SELLER_ID==='undefined'){
      grid.innerHTML='<div class="videos-error">امکان دریافت ویدیوها در حال حاضر وجود ندارد.</div>';
      return;
    }
    try{
      const products=await apiFetch('/products/public/'+SELLER_ID);
      const rows=[];
      (Array.isArray(products)?products:[]).forEach(product=>{
        const category=categoryName(product);
        (Array.isArray(product.media)?product.media:[]).forEach(media=>{
          if(media&&media.kind==='video'&&safeUrl(media.url))rows.push({product,media,category});
        });
      });
      const categories=[...new Set(rows.map(row=>row.category))];
      renderCards(rows);
      bindFilters(categories,rows);
    }catch(error){
      console.error(error);
      grid.innerHTML='<div class="videos-error">دریافت ویدیوها با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.</div>';
    }
  }

  boot();
})();
