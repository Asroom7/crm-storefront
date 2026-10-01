/* Stability/UX guards for the complete Storefront Editor. */
(function(){
'use strict';

function editor(){return window.StorefrontEditorComplete&&window.StorefrontEditorComplete.state;}
function routeName(){return location.hash.replace(/^#\/?/,'').split('/')[0];}
function clone(v){return JSON.parse(JSON.stringify(v));}
function toastSafe(m){if(typeof toast==='function')toast(m);}
function productRows(){try{return typeof state!=='undefined'&&Array.isArray(state.products)?state.products:[];}catch(e){return[];}}
function productImage(p){if(!p)return'';const m=Array.isArray(p.media)?p.media.find(x=>x&&(!x.kind||x.kind==='image')&&x.url):null;return(m&&m.url)||p.imageUrl||p.image||p.thumbnailUrl||p.coverUrl||p.photoUrl||'';}
function safe(v){if(typeof esc==='function')return esc(v==null?'':String(v));return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fa(v){return typeof faDigits==='function'?faDigits(v):String(v);}

/* The legacy editor also registered a hash listener. Capture the editor route
   first so direct links and later navigation always end on the complete UI. */
function renderCompleteRoute(){
  if(routeName()!=='storefront-editor'||!window.StorefrontEditorComplete)return;
  if(typeof closeMenu==='function')closeMenu();
  if(typeof renderNav==='function')renderNav('settings');
  const view=document.getElementById('view');
  if(view){view.scrollTop=0;window.StorefrontEditorComplete.render(view);}
}
window.addEventListener('hashchange',function(event){
  if(routeName()!=='storefront-editor'||!window.StorefrontEditorComplete)return;
  event.stopImmediatePropagation();
  renderCompleteRoute();
},true);
if(routeName()==='storefront-editor')window.setTimeout(renderCompleteRoute,15);

/* All section types that can be safely recreated must stay available in the
   add menu. This prevents a deleted core section becoming impossible to add. */
const ADDABLE={
  search:'جستجو و ناوبری',categories:'دسته‌بندی محصولات','product-collection':'کالکشن محصولات',
  'best-sellers':'پرفروش‌ترین‌ها',campaign:'جعبه صورتی',videos:'جعبه جادویی',hero:'بنر اصلی',
  banner:'بنر تبلیغاتی','support-banner':'بنر پشتیبانی',trust:'مزایای فروشگاه'
};
function ensureAddOptions(){
  const E=editor();if(!E||!E.root)return;
  const select=E.root.querySelector('[data-add-type]');if(!select)return;
  Object.keys(ADDABLE).forEach(type=>{
    if(select.querySelector('option[value="'+CSS.escape(type)+'"]'))return;
    const option=document.createElement('option');option.value=type;option.textContent=ADDABLE[type];select.appendChild(option);
  });
}

function pushSnapshot(E){
  E.undo=E.undo||[];E.undo.push({config:clone(E.config),theme:clone(E.theme),activeSection:E.activeSection,sectionTabs:clone(E.sectionTabs||{})});
  if(E.undo.length>50)E.undo.shift();E.redo=[];
}
function markChanged(E){
  E.dirty=true;E.changeCount=(E.changeCount||0)+1;
  const top=E.root&&E.root.querySelector('.ec-save-state strong');if(top)top.textContent=fa(E.changeCount)+' تغییر منتشرنشده';
  const bar=E.root&&E.root.querySelector('.ec-statusbar');if(bar){const dot=bar.querySelector('.ec-status-dot');if(dot)dot.classList.add('dirty');const strong=bar.querySelector('.ec-status-copy strong');if(strong)strong.textContent='پیش‌نویس دارای '+fa(E.changeCount)+' تغییر است';}
  if(E.iframe&&E.iframe.contentWindow)try{E.iframe.contentWindow.postMessage({type:'storefront-preview-config',config:clone(E.config),theme:clone(E.theme||{})},location.origin);}catch(e){}
}

/* Best-seller promotion controls belong to the complete editor, not the old
   monkey-patching extension. They remain optional and never force mode=manual. */
function promotionEditor(section){
  const ids=Array.isArray(section.settings&&section.settings.productIds)?section.settings.productIds.map(Number):[];
  const rows=productRows(),by=new Map(rows.map(p=>[Number(p.id),p]));
  const promos=section.settings&&section.settings.promotions&&typeof section.settings.promotions==='object'?section.settings.promotions:{};
  if(!ids.length)return'<div class="ec-empty">برای تنظیم تخفیف نمایشی، ابتدا محصول انتخاب کن.</div>';
  return '<div class="ec-stability-promos">'+ids.map(id=>{const p=by.get(id)||{id,name:'محصول '+id},pr=promos[String(id)]||promos[id]||{},img=productImage(p);return '<div class="ec-stability-promo" data-promo-id="'+id+'"><div class="media">'+(img?'<img src="'+safe(img)+'" alt="">':'✦')+'</div><div class="copy"><strong>'+safe(p.name)+'</strong><label><input type="checkbox" data-promo-enabled '+(pr.enabled?'checked':'')+'> نمایش تخفیف</label><div class="fields"><input data-promo-old value="'+safe(pr.oldPrice||'')+'" placeholder="قیمت قبلی"><input data-promo-label value="'+safe(pr.discountLabel||'')+'" placeholder="مثلاً ۲۰٪ تخفیف"></div></div></div>';}).join('')+'<button type="button" class="ec-btn primary" data-apply-promos>اعمال تنظیمات تخفیف</button></div>';
}
function ensurePromotionEditor(){
  const E=editor();if(!E||!E.root||!E.config)return;
  E.root.querySelectorAll('.ec-section.is-open[data-section-id]').forEach(node=>{
    const section=(E.config.sections||[]).find(x=>x&&x.id===node.dataset.sectionId);if(!section||section.type!=='best-sellers')return;
    const editorBox=node.querySelector('.ec-section-editor');if(!editorBox||editorBox.querySelector('[data-stability-promotions]'))return;
    const wrap=document.createElement('div');wrap.dataset.stabilityPromotions='1';wrap.className='ec-stability-promotion-wrap';wrap.innerHTML='<div class="ec-stability-head"><strong>تخفیف نمایشی اختیاری</strong><span>قیمت اصلی محصول دست‌نخورده می‌ماند</span></div>'+promotionEditor(section);
    const actions=editorBox.querySelector('.ec-inline-actions');editorBox.insertBefore(wrap,actions||null);
    const apply=wrap.querySelector('[data-apply-promos]');if(apply)apply.onclick=function(){
      pushSnapshot(E);const next={};wrap.querySelectorAll('[data-promo-id]').forEach(card=>{const id=String(card.dataset.promoId);next[id]={enabled:!!card.querySelector('[data-promo-enabled]').checked,oldPrice:String(card.querySelector('[data-promo-old]').value||'').trim(),discountLabel:String(card.querySelector('[data-promo-label]').value||'').trim()};});section.settings=section.settings||{};section.settings.promotions=next;markChanged(E);toastSafe('تنظیمات تخفیف در پیش‌نویس اعمال شد');
    };
  });
}

/* Protect referenced media from accidental deletion and make Replace update
   selected video URLs too. The complete editor already updates image fields. */
let pendingReplaceUrl='';
function refCount(url){
  const E=editor();if(!E||!E.config||!url)return 0;let count=0;
  (E.config.sections||[]).forEach(s=>{const c=s.content||{},st=s.settings||{};['imageUrl','imageDesktopUrl','imageMobileUrl'].forEach(k=>{if(c[k]===url)count++;});if(Array.isArray(st.videoUrls))st.videoUrls.forEach(v=>{if(v===url)count++;});});
  return count;
}
function replaceVideoRefs(oldUrl,newUrl){
  const E=editor();if(!E||!E.config||!oldUrl||!newUrl)return;let changed=false;
  (E.config.sections||[]).forEach(s=>{const st=s.settings||{};if(Array.isArray(st.videoUrls)){const next=st.videoUrls.map(v=>v===oldUrl?newUrl:v);if(next.some((v,i)=>v!==st.videoUrls[i])){st.videoUrls=next;changed=true;}}});
  if(changed&&E.iframe&&E.iframe.contentWindow)try{E.iframe.contentWindow.postMessage({type:'storefront-preview-config',config:clone(E.config),theme:clone(E.theme||{})},location.origin);}catch(e){}
}
document.addEventListener('click',function(event){
  const normalUpload=event.target.closest&&event.target.closest('[data-upload],[data-video-upload]');
  if(normalUpload){pendingReplaceUrl='';return;}
  const replace=event.target.closest&&event.target.closest('.ec-media-item [data-replace]');
  if(replace){const item=replace.closest('.ec-media-item'),media=item&&item.querySelector('.ec-media-visual img,.ec-media-visual video');pendingReplaceUrl=media?(media.currentSrc||media.src||''):'';window.setTimeout(()=>{pendingReplaceUrl='';},30000);return;}
  const del=event.target.closest&&event.target.closest('.ec-media-item [data-del]');
  if(del){const item=del.closest('.ec-media-item'),media=item&&item.querySelector('.ec-media-visual img,.ec-media-visual video'),url=media?(media.currentSrc||media.src||''):'';const refs=refCount(url);if(refs>0){event.preventDefault();event.stopImmediatePropagation();toastSafe('این رسانه در '+fa(refs)+' بخش استفاده شده؛ اول «جایگزین» کن تا لینک شکسته ایجاد نشود.');}}
},true);
if(typeof window.sellerApiFetch==='function'&&!window.sellerApiFetch.__editorStabilityWrapped){
  const original=window.sellerApiFetch;
  const wrapped=async function(path,options){const result=await original(path,options);if(path==='/storefront/media/upload'&&options&&String(options.method||'GET').toUpperCase()==='POST'&&pendingReplaceUrl&&result&&result.url){const old=pendingReplaceUrl,newUrl=result.url;pendingReplaceUrl='';window.setTimeout(()=>replaceVideoRefs(old,newUrl),0);}return result;};
  wrapped.__editorStabilityWrapped=true;window.sellerApiFetch=wrapped;
}

function decorate(){ensureAddOptions();ensurePromotionEditor();}
new MutationObserver(decorate).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('hashchange',()=>window.setTimeout(decorate,30));
window.setTimeout(decorate,100);
})();