/* Phase 5 wishlist. Scope: product-detail.html only. */
(function(){
'use strict';

const page=document.getElementById('pdp-page');
if(!page)return;

const productId=Number(new URLSearchParams(location.search).get('id'));
let active=false;
let busy=false;
let mounted=false;

function safeNext(){
  return 'product-detail.html?id='+encodeURIComponent(productId);
}
function session(){
  try{return typeof getCustomerSession==='function'?getCustomerSession():null;}catch(e){return null;}
}
function button(){
  return page.querySelector('.wishlist-toggle');
}
function paint(){
  const btn=button();
  if(!btn)return;
  btn.classList.toggle('is-active',active);
  btn.setAttribute('aria-pressed',active?'true':'false');
  btn.innerHTML='<span class="heart">'+(active?'♥':'♡')+'</span><span>'+(active?'ذخیره شده':'علاقه‌مندی')+'</span>';
  btn.disabled=busy;
}
async function loadState(){
  if(!session()){active=false;paint();return;}
  try{
    const items=await apiFetch('/wishlist');
    active=Array.isArray(items)&&items.some(item=>Number(item.productId)===productId);
  }catch(e){
    active=false;
  }
  paint();
}
async function toggle(){
  if(busy)return;
  if(!session()){
    location.href='login.html?next='+encodeURIComponent(safeNext());
    return;
  }
  busy=true;paint();
  try{
    if(active)await apiFetch('/wishlist/'+productId,{method:'DELETE'});
    else await apiFetch('/wishlist/'+productId,{method:'POST'});
    active=!active;
  }catch(e){
    alert(e.message||'تغییر علاقه‌مندی انجام نشد.');
  }finally{
    busy=false;paint();
  }
}
function mount(){
  if(mounted||!productId)return;
  const row=page.querySelector('.pdp-kicker-row');
  if(!row)return;
  mounted=true;
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='wishlist-toggle';
  btn.setAttribute('aria-label','افزودن یا حذف از علاقه‌مندی‌ها');
  btn.addEventListener('click',toggle);
  row.appendChild(btn);
  paint();
  loadState();
}
const observer=new MutationObserver(mount);
observer.observe(page,{childList:true,subtree:true});
mount();
})();
