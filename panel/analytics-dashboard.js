/* Item 10 seller analytics dashboard. Scope: #/analytics and one Settings link. */
(function(){
'use strict';

var ROUTE='analytics';
var days=30;
var loading=false;
var currentData=null;

function routeName(){
  return location.hash.replace(/^#\/?/,'').split('/')[0]||'dashboard';
}
function safe(value){
  if(typeof esc==='function')return esc(value==null?'':String(value));
  return String(value==null?'':value);
}
function fa(value){
  return typeof faDigits==='function'?faDigits(value):String(value==null?'':value);
}
function root(){
  return document.getElementById('view');
}
function shortDate(iso){
  if(!iso)return '';
  try{
    return new Date(iso+'T00:00:00Z').toLocaleDateString('fa-IR-u-ca-persian',{month:'numeric',day:'numeric'});
  }catch(e){return iso.slice(5);}
}
function pageLabel(path){
  var labels={
    'index.html':'صفحه اصلی',
    'products.html':'محصولات',
    'product-detail.html':'جزئیات محصول',
    'education.html':'آموزش‌ها',
    'cart.html':'سبد خرید'
  };
  return labels[path]||path||'صفحه';
}
function addSettingsLink(){
  if(routeName()!=='settings')return;
  var view=root();
  if(!view||view.querySelector('[data-analytics-settings-link]'))return;
  var titles=Array.from(view.querySelectorAll('.settings-group__title'));
  var title=titles.find(function(el){return el.textContent.trim()==='مدیریت فروشگاه';});
  var target=title?title.closest('.settings-group'):view.querySelector('.settings-group');
  if(!target)return;

  var a=document.createElement('a');
  a.href='#/analytics';
  a.className='settings-row';
  a.dataset.analyticsSettingsLink='1';
  a.style.cssText='text-decoration:none;color:inherit;';
  a.innerHTML='<div class="settings-row__icon">↗</div><div class="settings-row__text"><div class="settings-row__title">SEO و آمار فروشگاه</div><div class="settings-row__desc">بازدید، مشاهده محصول، افزودن به سبد و شروع خرید</div></div><div class="settings-row__chev">‹</div>';
  target.appendChild(a);
}
function metric(label,value,note){
  return '<div class="sa-metric"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong><small>'+safe(note||'')+'</small></div>';
}
function rangeHtml(){
  return '<div class="sa-range">'+[7,30,90].map(function(value){
    return '<button type="button" data-sa-days="'+value+'" class="'+(days===value?'active':'')+'">'+fa(value)+' روز</button>';
  }).join('')+'</div>';
}
function chartHtml(daily){
  var rows=Array.isArray(daily)?daily:[];
  var max=Math.max(1,...rows.map(function(row){return Number(row.pageViews||0);}));
  return '<div class="sa-chart">'+rows.map(function(row){
    var height=Math.max(row.pageViews?4:2,Math.round((Number(row.pageViews||0)/max)*108));
    return '<div class="sa-day" title="'+safe(shortDate(row.date))+' · '+fa(row.pageViews||0)+' بازدید">'+
      '<div class="sa-bar-wrap"><div class="sa-bar" style="height:'+height+'px"></div></div>'+
      '<small>'+safe(shortDate(row.date))+'</small>'+
    '</div>';
  }).join('')+'</div>';
}
function listRows(rows,type){
  if(!rows||!rows.length)return '<div class="sa-empty">هنوز داده‌ای برای این بخش ثبت نشده است.</div>';
  return rows.map(function(row){
    if(type==='pages'){
      return '<div class="sa-row"><strong>'+safe(pageLabel(row.path))+'</strong><small>'+fa(row.views||0)+' بازدید</small></div>';
    }
    return '<div class="sa-row"><strong>'+safe(row.name||'محصول')+'</strong><small>'+fa(row.views||0)+' مشاهده · '+fa(row.addToCart||0)+' سبد</small></div>';
  }).join('');
}
function render(){
  var view=root();
  if(!view||routeName()!==ROUTE)return;
  if(typeof renderNav==='function')renderNav('settings');

  if(!currentData){
    view.innerHTML='<section class="store-analytics"><div class="sa-empty">داده‌ای دریافت نشد.</div></section>';
    return;
  }

  var s=currentData.summary||{};
  var daily=currentData.daily||[];
  var pageNote=currentData.truncated?'حجم داده زیاد بوده و گزارش از آخرین ۲۰٬۰۰۰ رویداد ساخته شده است.':'داده‌ها از Analytics داخلی فروشگاه هستند.';
  view.innerHTML=
    '<section class="store-analytics">'+
      '<div class="sa-head"><div><h1>SEO و Analytics فروشگاه</h1><p>رفتار ناشناس بازدیدکنندگان برای تصمیم‌گیری روی محتوا و مسیر خرید.</p></div>'+rangeHtml()+'</div>'+
      '<div class="sa-metrics">'+
        metric('بازدیدکننده یکتا',fa(s.uniqueVisitors||0),'در بازه انتخاب‌شده')+
        metric('بازدید صفحه',fa(s.pageViews||0),'صفحات عمومی و سبد')+
        metric('مشاهده محصول',fa(s.productViews||0),'صفحه جزئیات محصول')+
        metric('افزودن به سبد',fa(s.addToCart||0),'تعداد کالاهای افزوده‌شده')+
        metric('شروع خرید',fa(s.beginCheckout||0),'ورود به Checkout')+
      '</div>'+
      '<div class="sa-card"><div class="sa-card-head"><strong>روند بازدید صفحات</strong><span>'+fa(currentData.days||days)+' روز اخیر</span></div>'+chartHtml(daily)+'</div>'+
      '<div class="sa-card"><div class="sa-card-head"><strong>قیف خرید</strong><span>نرخ‌ها بر اساس رویدادهای ثبت‌شده</span></div>'+
        '<div class="sa-funnel">'+
          '<div class="sa-funnel-step"><strong>'+fa(s.uniqueVisitors||0)+'</strong><span>بازدیدکننده</span></div>'+
          '<div class="sa-funnel-step"><strong>'+fa(s.productViews||0)+'</strong><span>مشاهده محصول</span></div>'+
          '<div class="sa-funnel-step"><strong>'+fa(s.addToCart||0)+'</strong><span>افزودن به سبد · '+fa(s.productToCartRate||0)+'٪</span></div>'+
          '<div class="sa-funnel-step"><strong>'+fa(s.beginCheckout||0)+'</strong><span>شروع خرید · '+fa(s.visitorToCheckoutRate||0)+'٪</span></div>'+
        '</div>'+
      '</div>'+
      '<div class="sa-two-col">'+
        '<div class="sa-card"><div class="sa-card-head"><strong>صفحات پربازدید</strong><span>۱۰ مورد اول</span></div>'+listRows(currentData.topPages,'pages')+'</div>'+
        '<div class="sa-card"><div class="sa-card-head"><strong>محصولات پربازدید</strong><span>مشاهده / سبد</span></div>'+listRows(currentData.topProducts,'products')+'</div>'+
      '</div>'+
      '<div class="sa-note">'+safe(pageNote)+' شناسه بازدیدکننده تصادفی است و نام، تلفن، IP یا اطلاعات حساب مشتری در Eventهای این بخش ذخیره نمی‌شود.</div>'+
    '</section>';

  view.querySelectorAll('[data-sa-days]').forEach(function(button){
    button.addEventListener('click',function(){
      var next=Number(button.dataset.saDays);
      if(next===days)return;
      days=next;
      load();
    });
  });
}
function load(){
  var view=root();
  if(!view||routeName()!==ROUTE||loading)return;
  loading=true;
  if(typeof renderNav==='function')renderNav('settings');
  view.innerHTML='<section class="store-analytics"><div class="sa-empty">در حال دریافت آمار فروشگاه...</div></section>';

  sellerApiFetch('/storefront-insights/seller/analytics?days='+days)
    .then(function(data){
      currentData=data;
      render();
    })
    .catch(function(error){
      if(routeName()!==ROUTE)return;
      view.innerHTML='<section class="store-analytics"><div class="sa-empty">'+safe(error.message||'دریافت آمار ناموفق بود')+'</div></section>';
    })
    .finally(function(){loading=false;});
}
function route(){
  if(routeName()!==ROUTE){
    addSettingsLink();
    return;
  }
  var view=root();
  if(!view||loading)return;
  if(!view.querySelector('.store-analytics'))load();
}

window.addEventListener('hashchange',function(){setTimeout(route,0);});
window.addEventListener('pageshow',function(){addSettingsLink();route();});
new MutationObserver(function(){
  addSettingsLink();
  if(routeName()===ROUTE){
    var view=root();
    if(view&&!view.querySelector('.store-analytics')&&!loading)load();
  }
}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(function(){addSettingsLink();route();},80);
})();