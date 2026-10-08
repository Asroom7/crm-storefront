/* Phase 7 checkout shipping. */
(function () {
  'use strict';

  var address = document.getElementById('f-address');
  if (!address) return;

  var options = [];
  var selected = 'standard';
  var lockedMethod = '';

  function fa(value) {
    return typeof toFaDigits === 'function' ? toFaDigits(value) : String(value);
  }

  function money(value) {
    var amount = Number(value || 0);
    return amount > 0 ? formatPrice(amount) + ' تومان' : 'رایگان';
  }

  function currentItems() {
    return getCart().map(function (item) {
      return {
        productId: Number(item.productId),
        quantity: Number(item.quantity)
      };
    }).filter(function (item) {
      return item.productId > 0 && item.quantity > 0;
    });
  }

  var box = document.createElement('div');
  box.className = 'checkout-shipping-box';
  box.innerHTML =
    '<h3>روش ارسال</h3>' +
    '<p>هزینه و بازه تقریبی تحویل قبل از ثبت سفارش از سرور محاسبه می‌شود.</p>' +
    '<div id="checkout-shipping-content"><div class="checkout-shipping-loading">در حال دریافت روش‌های ارسال...</div></div>';

  var promo = document.querySelector('.checkout-promo-box');
  if (promo) promo.insertAdjacentElement('beforebegin', box);
  else address.insertAdjacentElement('afterend', box);

  var contentBox = document.getElementById('checkout-shipping-content');

  function render() {
    if (!options.length) {
      contentBox.innerHTML = '<div class="checkout-shipping-error">روش ارسالی در دسترس نیست.</div>';
      return;
    }

    var active = lockedMethod || selected;
    if (!options.some(function (option) { return option.id === active; })) {
      selected = options[0].id;
      active = selected;
    }

    contentBox.innerHTML =
      '<div class="checkout-shipping-options">' +
      options.map(function (option) {
        var checked = active === option.id ? ' checked' : '';
        var disabled = lockedMethod ? ' disabled' : '';
        var eta = 'حدود ' + fa(option.etaMinDays) + ' تا ' + fa(option.etaMaxDays) + ' روز';
        return '<label class="checkout-shipping-option">' +
          '<input type="radio" name="shipping-method" value="' + option.id + '"' + checked + disabled + '>' +
          '<span><strong>' + option.label + ' · ' + money(option.fee) + '</strong>' +
          '<small>' + option.description + ' · ' + eta + '</small></span></label>';
      }).join('') +
      '</div>';

    contentBox.querySelectorAll('input[name="shipping-method"]').forEach(function (input) {
      input.addEventListener('change', function () {
        selected = input.value;
      });
    });
  }

  window.getSelectedShippingMethod = function () {
    var input = document.querySelector('input[name="shipping-method"]:checked');
    return input ? input.value : (lockedMethod || selected || 'standard');
  };

  window.lockCheckoutShippingMethod = function (method) {
    lockedMethod = String(method || 'standard');
    selected = lockedMethod;
    render();
  };

  var items = currentItems();
  if (!items.length) {
    contentBox.innerHTML = '<div class="checkout-shipping-error">سبد خرید خالی است.</div>';
    return;
  }

  apiFetch('/orders/shipping-options', {
    method: 'POST',
    body: JSON.stringify({ items: items })
  }).then(function (data) {
    options = Array.isArray(data && data.options) ? data.options : [];
    if (options.length && !options.some(function (option) { return option.id === selected; })) {
      selected = options[0].id;
    }
    render();
  }).catch(function (error) {
    contentBox.innerHTML = '<div class="checkout-shipping-error">' +
      (error.message || 'دریافت روش‌های ارسال ناموفق بود.') +
      '</div>';
  });

  apiFetch('/orders/mine/pending-payment').then(function (order) {
    if (order && order.shippingMethod) window.lockCheckoutShippingMethod(order.shippingMethod);
  }).catch(function () {});
}());
