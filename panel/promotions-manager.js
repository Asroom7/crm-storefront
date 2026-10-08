/* Phase 3 promotion manager. Scoped to #/promotions and Settings link injection only. */
(function(){
'use strict';

const ROUTE='promotions';
let rows=[];
let loading=false;

function routeName(){return location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';}
function safe(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fa(v){return typeof faDigits==='function'?faDigits(v):String(v==null?'':v);}
function money(v){return typeof fmtPrice==='function'?fmtPrice(Number(v||0)):fa(Number(v||0).toLocaleString('en-US'))+' تومان';}
function toastSafe(v){if(typeof toast==='function')toast(v);}
function view(){return document.getElementById('view');}
function productRows(){try{return Array.isArray(state.products)?state.products:[];}catch(e){return[];}}
function categoryRows(){try{return Array.isArray(state.categories)?state.categories:[];}catch(e){return[];}}
function dateText(value){
  if(!value)return 'بدون محدودیت';
  try{return new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
  catch(e){return String(value);}
}
function dateInput(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function statusInfo(row){
  const now=Date.now();
  if(!row.isActive)return {label:'غیرفعال',cls:'off'};
  if(row.startsAt&&Date.parse(row.startsAt)>now)return {label:'زمان‌بندی شده',cls:'scheduled'};
  if(row.endsAt&&Date.parse(row.endsAt)<now)return {label:'پایان یافته',cls:'ended'};
  return {label:'فعال',cls:'active'};
}
function discountLabel(row){
  if(row.discountType==='percent'){
    let text=fa(row.value)+'٪';
    if(row.maxDiscount)text+=' تا سقف '+money(row.maxDiscount);
    return text;
  }
  return money(row.value);
}
function scopeLabel(row){
  if(row.scopeType==='product')return fa((row.scopeIds||[]).length)+' محصول';
  if(row.scopeType==='category')return fa((row.scopeIds||[]).length)+' دسته‌بندی';
  return 'همه محصولات';
}
function usageLabel(row){
  const used=Number(row.usageCount||0);
  if(row.usageLimit)return fa(used)+' از '+fa(row.usageLimit);
  return fa(used)+' استفاده';
}

function injectSettingsLink(){
  if(routeName()!=='settings')return;
  const root=view();if(!root||root.querySelector('[data-promotions-settings-link]'))return;
  const titles=Array.from(root.querySelectorAll('.settings-group__title'));
  const target=titles.find(el=>el.textContent.trim()==='مدیریت فروشگاه')?.closest('.settings-group')||root.querySelector('.settings-group');
  if(!target)return;
  const link=document.createElement('a');
  link.href='#/promotions';
  link.className='settings-row';
  link.dataset.promotionsSettingsLink='1';
  link.style.cssText='text-decoration:none;color:inherit;';
  link.innerHTML='<div class="settings-row__icon">٪</div><div class="settings-row__text"><div class="settings-row__title">تخفیف‌ها و کمپین‌ها</div><div class="settings-row__desc">کد تخفیف و کمپین خودکار</div></div><div class="settings-row__chev">‹</div>';
  target.appendChild(link);
}

async function loadRows(){
  loading=true;
  try{rows=await sellerApiFetch('/promotions');}
  finally{loading=false;}
}

function summary(){
  const active=rows.filter(r=>statusInfo(r).cls==='active').length;
  const coupons=rows.filter(r=>r.mode==='coupon').length;
  const automatic=rows.filter(r=>r.mode==='automatic').length;
  const uses=rows.reduce((sum,r)=>sum+Number(r.usageCount||0),0);
  return '<div class="pm-summary">'+
    '<div><strong>'+fa(active)+'</strong><span>فعال</span></div>'+
    '<div><strong>'+fa(coupons)+'</strong><span>کد تخفیف</span></div>'+
    '<div><strong>'+fa(automatic)+'</strong><span>کمپین خودکار</span></div>'+
    '<div><strong>'+fa(uses)+'</strong><span>استفاده</span></div>'+
  '</div>';
}

function card(row){
  const st=statusInfo(row);
  const code=row.mode==='coupon'?(row.code||'بدون کد'):'اعمال خودکار';
  return '<article class="pm-card" data-promo-id="'+row.id+'">'+
    '<div class="pm-card-head"><div><div class="pm-eyebrow">'+(row.mode==='coupon'?'کد تخفیف':'کمپین خودکار')+'</div><h3>'+safe(row.name)+'</h3></div><span class="pm-status '+st.cls+'">'+st.label+'</span></div>'+
    '<div class="pm-code">'+safe(code)+'</div>'+
    '<div class="pm-grid">'+
      '<div><span>مقدار تخفیف</span><strong>'+safe(discountLabel(row))+'</strong></div>'+
      '<div><span>محدوده</span><strong>'+safe(scopeLabel(row))+'</strong></div>'+
      '<div><span>حداقل خرید</span><strong>'+(row.minSubtotal?money(row.minSubtotal):'ندارد')+'</strong></div>'+
      '<div><span>استفاده</span><strong>'+safe(usageLabel(row))+'</strong></div>'+
    '</div>'+
    '<div class="pm-dates"><span>شروع: '+safe(dateText(row.startsAt))+'</span><span>پایان: '+safe(dateText(row.endsAt))+'</span></div>'+
    '<div class="pm-actions">'+
      '<button type="button" data-pm-edit>ویرایش</button>'+
      '<button type="button" data-pm-toggle>'+(row.isActive?'غیرفعال':'فعال')+'</button>'+
      '<button type="button" class="danger" data-pm-delete>حذف</button>'+
    '</div>'+
  '</article>';
}

function render(){
  const root=view();if(!root)return;
  if(typeof renderNav==='function')renderNav('settings');
  root.scrollTop=0;
  root.innerHTML='<section class="promo-manager">'+
    '<div class="pm-head"><div><h1>تخفیف‌ها و کمپین‌ها</h1><p>تخفیف واقعی سفارش را اینجا مدیریت کن. در هر سفارش فقط یک تخفیف تجاری اعمال می‌شود.</p></div><button type="button" class="pm-primary" id="pmNew">+ تخفیف جدید</button></div>'+
    summary()+
    '<div class="pm-rule-note"><strong>قانون اعمال:</strong> اگر مشتری کد وارد کند همان کد بررسی می‌شود؛ اگر کدی وارد نشود، بهترین کمپین خودکار فعال اعمال خواهد شد.</div>'+
    '<div class="pm-list">'+(rows.length?rows.map(card).join(''):'<div class="pm-empty"><strong>هنوز تخفیفی ساخته نشده</strong><span>یک کد تخفیف یا کمپین خودکار بساز.</span></div>')+'</div>'+
  '</section>';
  root.querySelector('#pmNew').addEventListener('click',()=>openForm());
  root.querySelectorAll('[data-promo-id]').forEach(el=>{
    const row=rows.find(r=>Number(r.id)===Number(el.dataset.promoId));if(!row)return;
    el.querySelector('[data-pm-edit]').addEventListener('click',()=>openForm(row));
    el.querySelector('[data-pm-toggle]').addEventListener('click',()=>toggleRow(row));
    el.querySelector('[data-pm-delete]').addEventListener('click',()=>deleteRow(row));
  });
}

async function route(){
  if(routeName()!==ROUTE){injectSettingsLink();return;}
  const root=view();if(!root)return;
  if(loading)return;
  root.innerHTML='<div class="promo-manager"><div class="pm-empty">در حال دریافت تخفیف‌ها...</div></div>';
  try{await loadRows();render();}
  catch(error){root.innerHTML='<div class="promo-manager"><div class="pm-empty"><strong>خطا در دریافت تخفیف‌ها</strong><span>'+safe(error.message)+'</span></div></div>';}
}

function scopeOptions(type,selected){
  const ids=new Set((selected||[]).map(Number));
  const source=type==='product'?productRows():categoryRows();
  if(!source.length)return '<div class="pm-scope-empty">موردی برای انتخاب وجود ندارد.</div>';
  return '<div class="pm-scope-picks">'+source.map(item=>{
    const title=type==='product'?item.name:item.name;
    return '<label><input type="checkbox" data-pm-scope-id value="'+item.id+'" '+(ids.has(Number(item.id))?'checked':'')+'><span>'+safe(title)+'</span></label>';
  }).join('')+'</div>';
}

function formHTML(row){
  const r=row||{name:'',code:'',mode:'coupon',discountType:'percent',value:10,minSubtotal:0,maxDiscount:null,scopeType:'all',scopeIds:[],usageLimit:null,perCustomerLimit:null,isActive:true,startsAt:null,endsAt:null};
  return '<div class="modal__handle"></div><div class="pm-modal" data-pm-modal>'+
    '<div class="pm-modal-head"><div><h3>'+(row?'ویرایش تخفیف':'تخفیف جدید')+'</h3><p>قیمت نهایی فقط در Backend محاسبه می‌شود.</p></div></div>'+
    '<div class="pm-error" data-pm-error hidden></div>'+
    '<form id="pmForm">'+
      '<div class="pm-form-grid">'+
        '<label class="wide"><span>نام کمپین *</span><input name="name" required maxlength="120" value="'+safe(r.name)+'" placeholder="مثلاً تخفیف آخر هفته"></label>'+
        '<label><span>نوع اجرا</span><select name="mode"><option value="coupon" '+(r.mode==='coupon'?'selected':'')+'>کد تخفیف</option><option value="automatic" '+(r.mode==='automatic'?'selected':'')+'>کمپین خودکار</option></select></label>'+
        '<label data-code-field><span>کد تخفیف</span><input name="code" maxlength="40" value="'+safe(r.code||'')+'" placeholder="BEAUTY20" dir="ltr"></label>'+
        '<label><span>نوع تخفیف</span><select name="discountType"><option value="percent" '+(r.discountType==='percent'?'selected':'')+'>درصدی</option><option value="fixed" '+(r.discountType==='fixed'?'selected':'')+'>مبلغ ثابت</option></select></label>'+
        '<label><span>مقدار تخفیف *</span><input name="value" inputmode="numeric" value="'+safe(r.value)+'"></label>'+
        '<label><span>حداقل مبلغ خرید</span><input name="minSubtotal" inputmode="numeric" value="'+safe(r.minSubtotal||'')+'" placeholder="اختیاری"></label>'+
        '<label data-max-discount><span>سقف تخفیف</span><input name="maxDiscount" inputmode="numeric" value="'+safe(r.maxDiscount||'')+'" placeholder="اختیاری"></label>'+
        '<label><span>محدودیت کل استفاده</span><input name="usageLimit" inputmode="numeric" value="'+safe(r.usageLimit||'')+'" placeholder="نامحدود"></label>'+
        '<label><span>محدودیت هر مشتری</span><input name="perCustomerLimit" inputmode="numeric" value="'+safe(r.perCustomerLimit||'')+'" placeholder="نامحدود"></label>'+
        '<label><span>شروع</span><input name="startsAt" type="datetime-local" value="'+safe(dateInput(r.startsAt))+'"></label>'+
        '<label><span>پایان</span><input name="endsAt" type="datetime-local" value="'+safe(dateInput(r.endsAt))+'"></label>'+
        '<label class="wide"><span>محدوده تخفیف</span><select name="scopeType"><option value="all" '+(r.scopeType==='all'?'selected':'')+'>همه محصولات</option><option value="category" '+(r.scopeType==='category'?'selected':'')+'>دسته‌بندی‌های انتخابی</option><option value="product" '+(r.scopeType==='product'?'selected':'')+'>محصولات انتخابی</option></select></label>'+
      '</div>'+
      '<div data-scope-box></div>'+
      '<label class="pm-active-row"><input type="checkbox" name="isActive" '+(r.isActive?'checked':'')+'><span><strong>فعال باشد</strong><small>در صورت خاموش بودن روی هیچ سفارشی اعمال نمی‌شود.</small></span></label>'+
      '<div class="pm-modal-actions"><button type="button" class="pm-secondary" data-close-modal>انصراف</button><button type="submit" class="pm-primary">'+(row?'ذخیره تغییرات':'ساخت تخفیف')+'</button></div>'+
    '</form>'+
  '</div>';
}

function num(value){const s=typeof faToEnDigits==='function'?faToEnDigits(String(value||'')):String(value||'');return Number(s.replace(/[^\d]/g,''))||0;}
function nullableNum(value){const n=num(value);return n>0?n:null;}

function openForm(row){
  const wrap=openModal(formHTML(row));
  wrap.classList.add('pm-modal-wrap');
  const modal=wrap.querySelector('[data-pm-modal]');
  const form=wrap.querySelector('#pmForm');
  const error=wrap.querySelector('[data-pm-error]');
  const mode=form.elements.mode, type=form.elements.discountType, scope=form.elements.scopeType;
  const scopeBox=wrap.querySelector('[data-scope-box]');

  function sync(){
    wrap.querySelector('[data-code-field]').hidden=mode.value!=='coupon';
    wrap.querySelector('[data-max-discount]').hidden=type.value!=='percent';
    scopeBox.innerHTML=scope.value==='all'?'':scopeOptions(scope.value,row&&row.scopeType===scope.value?row.scopeIds:[]);
  }
  mode.addEventListener('change',sync);type.addEventListener('change',sync);scope.addEventListener('change',sync);
  form.elements.code.addEventListener('input',()=>{form.elements.code.value=form.elements.code.value.toUpperCase().replace(/\s+/g,'');});
  sync();

  form.addEventListener('submit',async event=>{
    event.preventDefault();error.hidden=true;
    const scopeIds=Array.from(wrap.querySelectorAll('[data-pm-scope-id]:checked')).map(el=>Number(el.value));
    const payload={
      name:form.elements.name.value.trim(),
      mode:mode.value,
      code:mode.value==='coupon'?form.elements.code.value.trim():null,
      discountType:type.value,
      value:num(form.elements.value.value),
      minSubtotal:num(form.elements.minSubtotal.value),
      maxDiscount:type.value==='percent'?nullableNum(form.elements.maxDiscount.value):null,
      usageLimit:nullableNum(form.elements.usageLimit.value),
      perCustomerLimit:nullableNum(form.elements.perCustomerLimit.value),
      startsAt:form.elements.startsAt.value?new Date(form.elements.startsAt.value).toISOString():null,
      endsAt:form.elements.endsAt.value?new Date(form.elements.endsAt.value).toISOString():null,
      scopeType:scope.value,
      scopeIds:scope.value==='all'?[]:scopeIds,
      isActive:form.elements.isActive.checked
    };
    if(!payload.name){error.textContent='نام کمپین را وارد کن.';error.hidden=false;return;}
    if(payload.mode==='coupon'&&!payload.code){error.textContent='کد تخفیف را وارد کن.';error.hidden=false;return;}
    if(!(payload.value>0)){error.textContent='مقدار تخفیف باید بیشتر از صفر باشد.';error.hidden=false;return;}
    if(payload.discountType==='percent'&&payload.value>100){error.textContent='درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.';error.hidden=false;return;}
    if(payload.scopeType!=='all'&&!payload.scopeIds.length){error.textContent='حداقل یک محصول یا دسته‌بندی انتخاب کن.';error.hidden=false;return;}
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='در حال ذخیره...';
    try{
      if(row)await sellerApiFetch('/promotions/'+row.id,{method:'PATCH',body:JSON.stringify(payload)});
      else await sellerApiFetch('/promotions',{method:'POST',body:JSON.stringify(payload)});
      closeModal();toastSafe(row?'تخفیف ویرایش شد':'تخفیف ساخته شد');await loadRows();render();
    }catch(e){submit.disabled=false;submit.textContent=row?'ذخیره تغییرات':'ساخت تخفیف';error.textContent=e.message||'ذخیره ناموفق بود';error.hidden=false;}
  });
}

async function toggleRow(row){
  try{await sellerApiFetch('/promotions/'+row.id+'/toggle',{method:'POST'});toastSafe(row.isActive?'تخفیف غیرفعال شد':'تخفیف فعال شد');await loadRows();render();}
  catch(e){toastSafe(e.message);}
}

function deleteRow(row){
  const run=async()=>{
    try{await sellerApiFetch('/promotions/'+row.id,{method:'DELETE'});toastSafe('تخفیف حذف شد');await loadRows();render();}
    catch(e){toastSafe(e.message);}
  };
  if(typeof confirmDialog==='function')confirmDialog('حذف تخفیف','«'+row.name+'» حذف شود؟ تخفیفی که سابقه استفاده دارد قابل حذف نیست.',run);
  else if(window.confirm('این تخفیف حذف شود؟'))run();
}

window.addEventListener('hashchange',()=>window.setTimeout(route,0));
window.addEventListener('pageshow',()=>{injectSettingsLink();route();});
const observer=new MutationObserver(()=>{injectSettingsLink();if(routeName()===ROUTE){const root=view();if(root&&!root.querySelector('.promo-manager'))route();}});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.setTimeout(()=>{injectSettingsLink();route();},50);
})();
