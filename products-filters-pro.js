/* Phase 4: professional product listing filters. Scope: products.html only. */
(function(){
'use strict';

const root=document.querySelector('.products-pro-page');
if(!root)return;

const state={
  products:[],
  categories:[],
  bestSellerIds:[],
  query:'',
  categoryIds:[],
  availability:'all',
  minPrice:'',
  maxPrice:'',
  sort:'newest'
};

const els={
  search:document.getElementById('products-search'),
  count:document.getElementById('products-count'),
  grid:document.getElementById('products-grid'),
  categories:document.getElementById('products-category-options'),
  availability:document.getElementById('products-availability-options'),
  minPrice:document.getElementById('products-min-price'),
  maxPrice:document.getElementById('products-max-price'),
  sort:document.getElementById('products-sort'),
  active:document.getElementById('products-active-filters'),
  reset:document.getElementById('products-reset'),
  mobileFilter:document.getElementById('products-mobile-filter'),
  backdrop:document.getElementById('products-filter-backdrop'),
  close:document.getElementById('products-filter-close')
};

function safe(v){return typeof escapeHtml==='function'?escapeHtml(v==null?'':String(v)):String(v==null?'':v);}
function fa(v){return typeof toFaDigits==='function'?toFaDigits(v):String(v==null?'':v);}
function money(v){
  const n=Number(v||0);
  return n>0?(typeof formatPrice==='function'?formatPrice(n):fa(n.toLocaleString('en-US'))) + ' تومان':'قیمت فروش تنظیم نشده';
}
function productPrice(product){return typeof getProductMinPrice==='function'?Number(getProductMinPrice(product)||0):0;}
function categoryId(product){return Number(product&&product.category&&product.category.id||product&&product.categoryId||0);}
function categoryName(product){return product&&product.category&&product.category.name?String(product.category.name):'بدون دسته‌بندی';}
function stockState(product){
  const stock=Number(product&&product.stockQty||0);
  const low=Number(product&&product.lowStockAt||0);
  if(stock<=0)return {key:'out',label:'ناموجود',cls:'out'};
  if(low>0&&stock<=low)return {key:'low',label:'رو به اتمام',cls:'low'};
  return {key:'in',label:'موجود',cls:'in'};
}
function imageUrl(product){
  try{return typeof getProductImageUrl==='function'?getProductImageUrl(product)||'':'';}catch(e){return '';}
}
function normalizeNumberInput(value){
  const normalized=typeof faToEnDigits==='function'?faToEnDigits(String(value||'')):String(value||'');
  const digits=normalized.replace(/[^\d]/g,'');
  return digits?Number(digits):'';
}
function formatInput(input){
  const value=normalizeNumberInput(input.value);
  input.value=value===''?'':Number(value).toLocaleString('en-US');
}
function params(){
  return new URLSearchParams(window.location.search);
}
function readUrl(){
  const p=params();
  state.query=p.get('q')||'';
  state.categoryIds=p.getAll('category').map(Number).filter(Boolean);
  state.availability=['all','in','low','out'].includes(p.get('availability'))?p.get('availability'):'all';
  state.minPrice=normalizeNumberInput(p.get('minPrice')||'');
  state.maxPrice=normalizeNumberInput(p.get('maxPrice')||'');
  state.sort=['newest','cheap','expensive','bestseller'].includes(p.get('sort'))?p.get('sort'):'newest';
}
function writeUrl(){
  const url=new URL(window.location.href);
  ['q','category','availability','minPrice','maxPrice','sort'].forEach(key=>url.searchParams.delete(key));
  if(state.query.trim())url.searchParams.set('q',state.query.trim());
  state.categoryIds.forEach(id=>url.searchParams.append('category',String(id)));
  if(state.availability!=='all')url.searchParams.set('availability',state.availability);
  if(state.minPrice!=='')url.searchParams.set('minPrice',String(state.minPrice));
  if(state.maxPrice!=='')url.searchParams.set('maxPrice',String(state.maxPrice));
  if(state.sort!=='newest')url.searchParams.set('sort',state.sort);
  history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():''));
}
function productMatches(product){
  const query=state.query.trim().toLocaleLowerCase('fa-IR');
  if(query){
    const haystack=[product.name,product.description,categoryName(product)].filter(Boolean).join(' ').toLocaleLowerCase('fa-IR');
    if(!haystack.includes(query))return false;
  }
  if(state.categoryIds.length&&!state.categoryIds.includes(categoryId(product)))return false;
  const stock=stockState(product);
  if(state.availability!=='all'&&stock.key!==state.availability)return false;
  const price=productPrice(product);
  if(state.minPrice!==''&&price<Number(state.minPrice))return false;
  if(state.maxPrice!==''&&price>Number(state.maxPrice))return false;
  return true;
}
function sorted(list){
  const rows=list.slice();
  if(state.sort==='cheap'){
    return rows.sort((a,b)=>{
      const ap=productPrice(a)||Number.MAX_SAFE_INTEGER;
      const bp=productPrice(b)||Number.MAX_SAFE_INTEGER;
      return ap-bp;
    });
  }
  if(state.sort==='expensive')return rows.sort((a,b)=>productPrice(b)-productPrice(a));
  if(state.sort==='bestseller'){
    const rank=new Map(state.bestSellerIds.map((id,index)=>[Number(id),index]));
    return rows.sort((a,b)=>{
      const ar=rank.has(Number(a.id))?rank.get(Number(a.id)):Number.MAX_SAFE_INTEGER;
      const br=rank.has(Number(b.id))?rank.get(Number(b.id)):Number.MAX_SAFE_INTEGER;
      if(ar!==br)return ar-br;
      return Number(b.id||0)-Number(a.id||0);
    });
  }
  return rows.sort((a,b)=>Number(b.id||0)-Number(a.id||0));
}
function card(product){
  const img=imageUrl(product);
  const stock=stockState(product);
  return '<a href="product-detail.html?id='+encodeURIComponent(product.id)+'" class="products-card">'+
    '<div class="products-card-media">'+
      (img?'<img src="'+safe(img)+'" alt="'+safe(product.name)+'" loading="lazy" decoding="async">':'<span class="products-card-placeholder">بدون تصویر</span>')+
      '<span class="products-stock-badge '+stock.cls+'">'+safe(stock.label)+'</span>'+
    '</div>'+
    '<div class="products-card-body">'+
      '<span class="products-card-category">'+safe(categoryName(product))+'</span>'+
      '<h3>'+safe(product.name)+'</h3>'+
      '<span class="products-card-price">'+safe(money(productPrice(product)))+'</span>'+
    '</div>'+
  '</a>';
}
function activeFilterButtons(){
  const items=[];
  if(state.query.trim())items.push({key:'query',label:'جستجو: '+state.query.trim()});
  state.categoryIds.forEach(id=>{
    const category=state.categories.find(c=>Number(c.id)===Number(id));
    if(category)items.push({key:'category:'+id,label:category.name});
  });
  if(state.availability!=='all'){
    const labels={in:'موجود',low:'رو به اتمام',out:'ناموجود'};
    items.push({key:'availability',label:labels[state.availability]});
  }
  if(state.minPrice!=='')items.push({key:'minPrice',label:'از '+money(state.minPrice)});
  if(state.maxPrice!=='')items.push({key:'maxPrice',label:'تا '+money(state.maxPrice)});
  els.active.innerHTML=items.map(item=>'<button type="button" class="products-active-filter" data-remove-filter="'+safe(item.key)+'">'+safe(item.label)+' ×</button>').join('');
  els.active.querySelectorAll('[data-remove-filter]').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.removeFilter;
    if(key==='query'){state.query='';els.search.value='';}
    else if(key.startsWith('category:'))state.categoryIds=state.categoryIds.filter(id=>Number(id)!==Number(key.split(':')[1]));
    else if(key==='availability')state.availability='all';
    else if(key==='minPrice'){state.minPrice='';els.minPrice.value='';}
    else if(key==='maxPrice'){state.maxPrice='';els.maxPrice.value='';}
    syncControls();render();
  }));
}
function render(){
  const list=sorted(state.products.filter(productMatches));
  els.count.innerHTML='<strong>'+fa(list.length)+'</strong> محصول';
  if(!list.length){
    els.grid.innerHTML='<div class="products-empty"><strong>محصولی با این فیلترها پیدا نشد</strong><span>فیلترها را تغییر بده یا همه را پاک کن.</span><button type="button" id="products-empty-reset">پاک کردن فیلترها</button></div>';
    const btn=document.getElementById('products-empty-reset');if(btn)btn.addEventListener('click',resetFilters);
  }else{
    els.grid.innerHTML=list.map(card).join('');
  }
  activeFilterButtons();
  writeUrl();
}
function categoryOptions(){
  els.categories.innerHTML=state.categories.length?state.categories.map(category=>
    '<label><input type="checkbox" value="'+category.id+'" '+(state.categoryIds.includes(Number(category.id))?'checked':'')+'><span>'+safe(category.name)+'</span></label>'
  ).join(''):'<span style="color:#999;font-size:10px;">دسته‌بندی‌ای ثبت نشده است.</span>';
  els.categories.querySelectorAll('input[type="checkbox"]').forEach(input=>input.addEventListener('change',()=>{
    const id=Number(input.value);
    if(input.checked&&!state.categoryIds.includes(id))state.categoryIds.push(id);
    if(!input.checked)state.categoryIds=state.categoryIds.filter(value=>value!==id);
    render();
  }));
}
function syncAvailability(){
  els.availability.querySelectorAll('[data-availability]').forEach(button=>{
    button.classList.toggle('active',button.dataset.availability===state.availability);
  });
}
function syncControls(){
  els.search.value=state.query;
  els.minPrice.value=state.minPrice===''?'':Number(state.minPrice).toLocaleString('en-US');
  els.maxPrice.value=state.maxPrice===''?'':Number(state.maxPrice).toLocaleString('en-US');
  els.sort.value=state.sort;
  categoryOptions();
  syncAvailability();
}
function resetFilters(){
  state.query='';
  state.categoryIds=[];
  state.availability='all';
  state.minPrice='';
  state.maxPrice='';
  state.sort='newest';
  syncControls();
  render();
}
function openFilters(){
  root.classList.add('filters-open');
  document.documentElement.style.overflow='hidden';
  if(els.close)els.close.focus();
}
function closeFilters(){
  root.classList.remove('filters-open');
  document.documentElement.style.overflow='';
  if(els.mobileFilter)els.mobileFilter.focus();
}
function bind(){
  els.search.addEventListener('input',()=>{state.query=els.search.value;render();});
  els.availability.querySelectorAll('[data-availability]').forEach(button=>button.addEventListener('click',()=>{
    state.availability=button.dataset.availability;
    syncAvailability();
    render();
  }));
  [els.minPrice,els.maxPrice].forEach(input=>{
    input.addEventListener('input',()=>formatInput(input));
    input.addEventListener('change',()=>{
      state.minPrice=normalizeNumberInput(els.minPrice.value);
      state.maxPrice=normalizeNumberInput(els.maxPrice.value);
      if(state.minPrice!==''&&state.maxPrice!==''&&Number(state.minPrice)>Number(state.maxPrice)){
        const swap=state.minPrice;state.minPrice=state.maxPrice;state.maxPrice=swap;
        syncControls();
      }
      render();
    });
  });
  els.sort.addEventListener('change',()=>{state.sort=els.sort.value;render();});
  els.reset.addEventListener('click',resetFilters);
  els.mobileFilter.addEventListener('click',openFilters);
  els.backdrop.addEventListener('click',closeFilters);
  if(els.close)els.close.addEventListener('click',closeFilters);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('filters-open'))closeFilters();});

  const toggle=document.querySelector('.menu-toggle');
  const closeBtn=document.querySelector('.close-menu');
  const overlay=document.querySelector('.side-menu-overlay');
  const menu=document.querySelector('.side-menu');
  function openMenu(){if(menu&&overlay){menu.classList.add('open');overlay.classList.add('open');}}
  function closeMenu(){if(menu&&overlay){menu.classList.remove('open');overlay.classList.remove('open');}}
  if(toggle)toggle.addEventListener('click',openMenu);
  if(closeBtn)closeBtn.addEventListener('click',closeMenu);
  if(overlay)overlay.addEventListener('click',closeMenu);
  if(toggle)toggle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')openMenu();});
  if(closeBtn)closeBtn.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')closeMenu();});
}
async function load(){
  readUrl();
  syncControls();
  bind();
  els.grid.innerHTML='<div class="products-empty">در حال بارگذاری محصولات...</div>';
  try{
    const [products,categories,bestsellers]=await Promise.all([
      apiFetch('/products/public/'+SELLER_ID),
      fetchPublicCategories().catch(()=>[]),
      apiFetch('/storefront-insights/public/'+SELLER_ID+'/best-sellers?limit=20').catch(()=>({productIds:[]}))
    ]);
    state.products=Array.isArray(products)?products:[];
    state.categories=Array.isArray(categories)?categories:[];
    state.bestSellerIds=Array.isArray(bestsellers&&bestsellers.productIds)?bestsellers.productIds:[];
    syncControls();
    render();
  }catch(error){
    els.count.textContent='';
    els.grid.innerHTML='<div class="products-empty"><strong>خطا در بارگذاری محصولات</strong><span>'+safe(error.message||'دوباره تلاش کنید.')+'</span></div>';
  }
}

load();
})();