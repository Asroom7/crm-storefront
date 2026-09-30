/* Best-sellers editor extension.
   Keeps the existing Visual Editor intact while making best-seller selection,
   ordering and optional visual promotion labels explicitly manual. */
(function(){
  'use strict';

  if(typeof window.sellerApiFetch!=='function')return;

  var currentSectionId='';
  var pendingPromotions=Object.create(null);
  var modalEnhanceToken=0;
  var originalSellerApiFetch=window.sellerApiFetch;

  function escapeText(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});
  }

  function clone(value){
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function parseOptions(options){
    if(!options||typeof options.body!=='string')return null;
    try{return JSON.parse(options.body);}catch(_){return null;}
  }

  window.sellerApiFetch=function(path,options){
    var payload=path==='/storefront/editor/home'&&options&&String(options.method||'GET').toUpperCase()==='PUT'?parseOptions(options):null;
    if(payload&&payload.config&&Array.isArray(payload.config.sections)){
      payload.config.sections.forEach(function(section){
        if(!section||section.type!=='best-sellers')return;
        section.settings=section.settings||{};
        section.settings.mode='manual';
        if(pendingPromotions[section.id])section.settings.promotions=clone(pendingPromotions[section.id]);
      });
      options=Object.assign({},options,{body:JSON.stringify(payload)});
    }
    return originalSellerApiFetch(path,options);
  };

  document.addEventListener('click',function(event){
    var editButton=event.target&&event.target.closest?event.target.closest('[data-section-edit]'):null;
    if(editButton){
      currentSectionId=String(editButton.getAttribute('data-section-edit')||'');
      window.setTimeout(function(){enhanceOpenModal(currentSectionId);},0);
    }
  },true);

  function optionRows(form){
    var picker=form.querySelector('.store-editor-product-picker');
    if(!picker)return[];
    return Array.prototype.slice.call(picker.querySelectorAll('.store-editor-product-option'));
  }

  function productInfo(label){
    var input=label.querySelector('input[name="productIds"]');
    var title=label.querySelector('span');
    return{
      id:input?Number(input.value):0,
      checked:!!(input&&input.checked),
      name:title?String(title.textContent||'').trim():'محصول'
    };
  }

  function collectPromoInputs(container,promoState){
    if(!container)return;
    container.querySelectorAll('[data-bs-promo-card]').forEach(function(card){
      var id=String(card.getAttribute('data-bs-promo-card')||'');
      if(!id)return;
      promoState[id]={
        enabled:!!(card.querySelector('[data-bs-promo-enabled]')&&card.querySelector('[data-bs-promo-enabled]').checked),
        oldPrice:String((card.querySelector('[data-bs-old-price]')||{}).value||'').trim(),
        discountLabel:String((card.querySelector('[data-bs-discount-label]')||{}).value||'').trim()
      };
    });
  }

  function moveCheckedOption(form,id,direction){
    var rows=optionRows(form);
    var checked=rows.filter(function(row){return productInfo(row).checked;});
    var index=checked.findIndex(function(row){return productInfo(row).id===Number(id);});
    if(index<0)return;
    var target=index+direction;
    if(target<0||target>=checked.length)return;
    var row=checked[index],other=checked[target],parent=row.parentNode;
    if(direction<0)parent.insertBefore(row,other);
    else parent.insertBefore(row,other.nextSibling);
  }

  function renderManualControls(form,promoState){
    var picker=form.querySelector('.store-editor-product-picker');
    if(!picker)return;
    var existing=form.querySelector('[data-bs-editor-controls]');
    if(existing)collectPromoInputs(existing,promoState);
    if(existing)existing.remove();

    var selected=optionRows(form).map(function(row){return{row:row,info:productInfo(row)};}).filter(function(item){return item.info.checked;});
    var wrap=document.createElement('div');
    wrap.setAttribute('data-bs-editor-controls','1');
    wrap.innerHTML='<div class="bs-editor-note"><strong>انتخاب پرفروش‌ها دستی است.</strong><br>محصولات را تیک بزن و ترتیب نمایش را با فلش‌ها عوض کن. قیمت اصلی همیشه از خود محصول می‌آید؛ قیمت خط‌خورده و برچسب تخفیف فقط وقتی که خودت فعال کنی نمایش داده می‌شوند.</div>'+
      '<div class="bs-selected-wrap"><div class="bs-selected-head"><strong>ترتیب نمایش</strong><span>'+selected.length+' محصول انتخاب شده</span></div><div class="bs-selected-list" data-bs-selected-list></div></div>'+
      '<div class="bs-promo-box"><div class="bs-selected-head"><strong>تخفیف نمایشی اختیاری</strong><span>پیش‌فرض: خاموش</span></div><div data-bs-promo-list></div></div>';
    picker.insertAdjacentElement('afterend',wrap);

    var orderList=wrap.querySelector('[data-bs-selected-list]');
    var promoList=wrap.querySelector('[data-bs-promo-list]');
    if(!selected.length){
      orderList.innerHTML='<div class="store-editor-empty">هنوز محصولی انتخاب نشده است.</div>';
      promoList.innerHTML='<div class="store-editor-empty">بعد از انتخاب محصول، تنظیم تخفیف اختیاری اینجا ظاهر می‌شود.</div>';
      return;
    }

    selected.forEach(function(item,index){
      var info=item.info;
      var row=document.createElement('div');
      row.className='bs-selected-row';
      row.innerHTML='<div class="bs-selected-row__title"><strong>'+escapeText(info.name)+'</strong><span>محصول #'+info.id+'</span></div><div class="bs-selected-row__actions"><button type="button" data-bs-up="'+info.id+'" '+(index===0?'disabled':'')+' aria-label="بالاتر">↑</button><button type="button" data-bs-down="'+info.id+'" '+(index===selected.length-1?'disabled':'')+' aria-label="پایین‌تر">↓</button></div>';
      orderList.appendChild(row);

      var saved=promoState[String(info.id)]||{enabled:false,oldPrice:'',discountLabel:''};
      var promo=document.createElement('div');
      promo.className='bs-promo-card';
      promo.setAttribute('data-bs-promo-card',String(info.id));
      promo.innerHTML='<div class="bs-promo-card__head"><strong>'+escapeText(info.name)+'</strong><label><input type="checkbox" data-bs-promo-enabled '+(saved.enabled?'checked':'')+'> نمایش تخفیف</label></div><div class="bs-promo-fields '+(saved.enabled?'':'is-disabled')+'" data-bs-promo-fields><label>قیمت قبلی (خط‌خورده)<input type="text" data-bs-old-price value="'+escapeText(saved.oldPrice||'')+'" placeholder="مثلاً ۱٬۲۰۰٬۰۰۰ تومان"></label><label>برچسب تخفیف<input type="text" data-bs-discount-label value="'+escapeText(saved.discountLabel||'')+'" placeholder="مثلاً ۲۰٪ تخفیف"></label></div>';
      promoList.appendChild(promo);
    });

    wrap.querySelectorAll('[data-bs-up]').forEach(function(button){button.addEventListener('click',function(){collectPromoInputs(wrap,promoState);moveCheckedOption(form,button.getAttribute('data-bs-up'),-1);renderManualControls(form,promoState);});});
    wrap.querySelectorAll('[data-bs-down]').forEach(function(button){button.addEventListener('click',function(){collectPromoInputs(wrap,promoState);moveCheckedOption(form,button.getAttribute('data-bs-down'),1);renderManualControls(form,promoState);});});
    wrap.querySelectorAll('[data-bs-promo-enabled]').forEach(function(input){input.addEventListener('change',function(){var fields=input.closest('.bs-promo-card').querySelector('[data-bs-promo-fields]');if(fields)fields.classList.toggle('is-disabled',!input.checked);});});
  }

  async function loadExistingPromotions(sectionId){
    try{
      var page=await originalSellerApiFetch('/storefront/editor/home');
      var sections=page&&page.config&&Array.isArray(page.config.sections)?page.config.sections:[];
      var section=sections.find(function(item){return item&&String(item.id)===String(sectionId);});
      return clone(section&&section.settings&&section.settings.promotions||{});
    }catch(_){return{};}
  }

  async function enhanceOpenModal(sectionId){
    var token=++modalEnhanceToken;
    var form=document.querySelector('[data-section-form]');
    if(!form||!form.elements||!form.elements.mode)return;
    var manualOption=form.querySelector('select[name="mode"] option[value="manual"]');
    if(!manualOption)return;

    form.elements.mode.value='manual';
    var modeField=form.elements.mode.closest('.field');
    if(modeField)modeField.classList.add('bs-mode-field-hidden');

    var promoState=await loadExistingPromotions(sectionId);
    if(token!==modalEnhanceToken||!form.isConnected)return;
    pendingPromotions[sectionId]=promoState;
    renderManualControls(form,promoState);

    var picker=form.querySelector('.store-editor-product-picker');
    if(picker){
      picker.addEventListener('change',function(event){
        if(!event.target.matches('input[name="productIds"]'))return;
        var controls=form.querySelector('[data-bs-editor-controls]');
        collectPromoInputs(controls,promoState);
        renderManualControls(form,promoState);
      });
    }

    form.addEventListener('submit',function(){
      var controls=form.querySelector('[data-bs-editor-controls]');
      collectPromoInputs(controls,promoState);
      pendingPromotions[sectionId]=clone(promoState);
      form.elements.mode.value='manual';
    },true);
  }
})();
