(function(){
'use strict';

const CODE_BASELINE={
  approvedCommit:'afd0c66d51f742548d7c63abfb0faa307f355cca',
  stableBranch:'stable-approved',
  codeBackupBranch:'backup-code-approved-2026-10-01',
  repository:'Asroom7/crm-storefront'
};

const SETTINGS_ENDPOINTS={
  storefront:'/storefront/editor/home',
  versions:'/storefront/editor/home/versions',
  media:'/storefront/media'
};

const DATA_ENDPOINTS={
  customers:'/customers',
  products:'/products',
  sales:'/sales',
  payments:'/payments',
  orders:'/orders/seller',
  conversations:'/conversations',
  categories:'/categories'
};

const logEl=document.getElementById('backupLog');

function nowIso(){return new Date().toISOString();}
function stamp(){return nowIso().replace(/[:.]/g,'-');}
function log(message,type){
  if(!logEl)return;
  const line=document.createElement('div');
  line.className=type||'';
  line.textContent='['+new Date().toLocaleTimeString('fa-IR')+'] '+message;
  logEl.prepend(line);
}
function downloadJson(prefix,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=prefix+'-'+stamp()+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function fetchOne(label,path){
  if(typeof sellerApiFetch!=='function')throw new Error('sellerApiFetch در دسترس نیست');
  try{
    const data=await sellerApiFetch(path);
    return{ok:true,label,path,data};
  }catch(error){
    return{ok:false,label,path,error:error&&error.message?error.message:String(error)};
  }
}
async function collect(map){
  const entries=Object.entries(map);
  const rows=await Promise.all(entries.map(([label,path])=>fetchOne(label,path)));
  const data={},errors={};
  rows.forEach(row=>{
    if(row.ok)data[row.label]=row.data;
    else errors[row.label]={path:row.path,error:row.error};
  });
  return{data,errors,successCount:Object.keys(data).length,errorCount:Object.keys(errors).length};
}
function envelope(kind,body){
  return{
    schema:'crm-storefront-backup-v1',
    kind,
    createdAt:nowIso(),
    codeBaseline:CODE_BASELINE,
    ...body
  };
}
async function withBusy(button,work){
  if(!button)return;
  const old=button.textContent;
  button.disabled=true;
  button.textContent='در حال تهیه بکاپ...';
  try{await work();}
  finally{button.disabled=false;button.textContent=old;}
}

async function backupSettings(button){
  await withBusy(button,async()=>{
    log('دریافت تنظیمات و محتوای فروشگاه شروع شد.');
    const result=await collect(SETTINGS_ENDPOINTS);
    const payload=envelope('settings-and-storefront-content',result);
    downloadJson('storefront-settings-backup',payload);
    if(result.errorCount)log('بکاپ تنظیمات ساخته شد، اما '+result.errorCount+' منبع در دسترس نبود. جزئیات داخل فایل ثبت شده است.','warn');
    else log('بکاپ تنظیمات و محتوای سایت با موفقیت دانلود شد.','ok');
  });
}

async function backupData(button){
  await withBusy(button,async()=>{
    log('دریافت داده‌های واقعی فروشنده شروع شد.');
    const result=await collect(DATA_ENDPOINTS);
    const payload=envelope('seller-live-data',result);
    downloadJson('seller-data-backup',payload);
    if(result.errorCount)log('بکاپ داده ساخته شد، اما '+result.errorCount+' منبع در دسترس نبود. جزئیات داخل فایل ثبت شده است.','warn');
    else log('بکاپ داده‌های واقعی با موفقیت دانلود شد. این فایل را عمومی نکن.','ok');
  });
}

async function backupFull(button){
  await withBusy(button,async()=>{
    log('ساخت بکاپ کامل سه‌لایه شروع شد.');
    const [settings,data]=await Promise.all([collect(SETTINGS_ENDPOINTS),collect(DATA_ENDPOINTS)]);
    const payload=envelope('full-three-layer-backup',{
      code:CODE_BASELINE,
      settings,
      liveData:data,
      privacyNotice:'liveData may contain customer/order/payment information. Do not commit this file to a public repository.'
    });
    downloadJson('crm-storefront-full-backup',payload);
    const errors=settings.errorCount+data.errorCount;
    if(errors)log('بکاپ کامل دانلود شد؛ '+errors+' منبع API در دسترس نبود و در فایل گزارش شده است.','warn');
    else log('بکاپ کامل سه‌لایه با موفقیت دانلود شد.','ok');
  });
}

function bind(id,handler){const el=document.getElementById(id);if(el)el.addEventListener('click',()=>handler(el));}
bind('backupSettingsBtn',backupSettings);
bind('backupDataBtn',backupData);
bind('backupFullBtn',backupFull);

log('مرکز بکاپ آماده است. بکاپ کد در GitHub ثابت شده؛ تنظیمات و داده فقط با اقدام شما به فایل محلی دانلود می‌شوند.','ok');
})();
