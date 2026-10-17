/* ==========================================================================
   Thème « Avent » — scripts
   Réglages et textes : window.theme (snippets/theme-config.liquid)
   ========================================================================== */
(function () {
  'use strict';

  var theme = window.theme || {};
  var strings = theme.strings || {};
  var DAY = 864e5;

  /* ---------- Outils ---------- */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function fill(template, values) {
    return String(template || '').replace(/\[(\w+)\]/g, function (match, key) {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    cents = parseInt(cents, 10) || 0;
    format = format || theme.moneyFormat || '{{amount_with_comma_separator}} €';

    function withDelimiters(number, precision, thousands, decimal) {
      var fixed = (number / 100).toFixed(precision);
      var parts = fixed.split('.');
      var whole = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands);
      return parts[1] ? whole + decimal + parts[1] : whole;
    }

    return format.replace(/\{\{\s*(\w+)\s*\}\}/, function (match, type) {
      switch (type) {
        case 'amount':
          return withDelimiters(cents, 2, ',', '.');
        case 'amount_no_decimals':
          return withDelimiters(cents, 0, ',', '.');
        case 'amount_with_comma_separator':
          return withDelimiters(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator':
          return withDelimiters(cents, 0, '.', ',');
        case 'amount_with_space_separator':
          return withDelimiters(cents, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator':
          return withDelimiters(cents, 0, ' ', ',');
        case 'amount_with_apostrophe_separator':
          return withDelimiters(cents, 2, "'", '.');
        default:
          return withDelimiters(cents, 2, '.', ',');
      }
    });
  }

  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }

  function formatDate(date, long) {
    var options = long
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' };
    try {
      return date.toLocaleDateString(theme.locale || 'fr', options);
    } catch (e) {
      return date.toLocaleDateString();
    }
  }

  function lockScroll(locked) {
    document.body.classList.toggle('is-locked', locked);
  }

  /* ---------- Le calendrier de la saison ----------
     Saison = du 1er septembre au 24 décembre. En dehors, les messages liés au
     1er décembre ne s'affichent pas (le texte de secours du bandeau reste). */

  var today = startOfDay(new Date());
  var season = (function () {
    var year = today.getFullYear();
    var month = today.getMonth();
    var dec1 = new Date(year, 11, 1);
    var inSeason = month >= 8 && !(month === 11 && today.getDate() > 24);
    var dayOfDecember = month === 11 && today.getDate() <= 24 ? today.getDate() : 0;
    return { dec1: dec1, inSeason: inSeason, dayOfDecember: dayOfDecember };
  })();

  function deliveryWindow(minDays, maxDays) {
    var d = theme.delivery || {};
    var processing = Number(d.processing) || 0;
    var min = minDays !== undefined && minDays !== '' ? Number(minDays) : Number(d.min) || 0;
    var max = maxDays !== undefined && maxDays !== '' ? Number(maxDays) : Number(d.max) || min;
    if (max < min) max = min;
    return {
      from: addDays(today, processing + min),
      to: addDays(today, processing + max),
      totalMax: processing + max
    };
  }

  /* ---------- Barre d'annonce ---------- */

  function initAnnouncements() {
    $$('[data-announcement]').forEach(function (bar) {
      var items = $$('.announcement__item', bar);
      if (items.length < 2) return;
      var index = 0;
      var delay = (Number(bar.getAttribute('data-speed')) || 5) * 1000;
      setInterval(function () {
        items[index].classList.remove('is-active');
        index = (index + 1) % items.length;
        items[index].classList.add('is-active');
      }, delay);
    });
  }

  /* ---------- En-tête ---------- */

  function initHeader() {
    var wrapper = $('[data-header]');
    if (wrapper) {
      var onScroll = function () {
        wrapper.classList.toggle('is-scrolled', window.scrollY > 4);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    var search = $('[data-header-search]');
    $$('[data-search-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!search) return;
        var open = search.hasAttribute('hidden');
        search.toggleAttribute('hidden', !open);
        button.setAttribute('aria-expanded', String(open));
        if (open) {
          var input = $('input[type="search"]', search);
          if (input) input.focus();
        }
      });
    });

    // Ferme les sous-menus ouverts quand on clique ailleurs
    document.addEventListener('click', function (event) {
      $$('.nav details[open]').forEach(function (details) {
        if (!details.contains(event.target)) details.removeAttribute('open');
      });
    });
  }

  /* ---------- Tiroirs (menu mobile, panier, filtres) ---------- */

  var lastFocus = null;

  function openDrawer(drawer) {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    var focusable = $('[data-drawer-close], a, button, input', drawer);
    if (focusable) setTimeout(function () { focusable.focus(); }, 50);
  }

  function closeDrawer(drawer) {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initDrawers() {
    document.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-drawer-open]');
      if (opener) {
        var target = document.getElementById(opener.getAttribute('data-drawer-open'));
        if (target) {
          event.preventDefault();
          openDrawer(target);
        }
        return;
      }
      var closer = event.target.closest('[data-drawer-close]');
      if (closer) {
        event.preventDefault();
        closeDrawer(closer.closest('.drawer'));
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      $$('.drawer.is-open').forEach(closeDrawer);
    });
  }

  /* ---------- Les 24 cases ---------- */

  function initAdvent() {
    $$('[data-advent]').forEach(function (grid) {
      var doors = $$('.door', grid);
      var day = season.dayOfDecember;

      doors.forEach(function (door) {
        var number = Number(door.getAttribute('data-day'));
        var leaf = $('.door__leaf', door);
        if (day && number < day) door.classList.add('is-open');
        if (day && number === day) door.classList.add('is-today');
        if (leaf) leaf.setAttribute('aria-pressed', String(door.classList.contains('is-open')));

        if (leaf) {
          leaf.addEventListener('click', function () {
            var open = door.classList.toggle('is-open');
            door.classList.remove('is-today');
            leaf.setAttribute('aria-pressed', String(open));
          });
        }
      });

      // Hors décembre : quelques cases s'ouvrent toutes seules pour donner envie
      if (!day && grid.hasAttribute('data-teaser')) {
        var picks = [doors[3], doors[8], doors[14], doors[20]].filter(Boolean);
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;
        picks.forEach(function (door, i) {
          setTimeout(function () { door.classList.add('is-open'); }, 900 + i * 450);
          setTimeout(function () { door.classList.remove('is-open'); }, 3600 + i * 450);
        });
      }
    });
  }

  /* ---------- Compte à rebours jusqu'au 1er décembre ---------- */

  function initCountdown() {
    $$('[data-countdown]').forEach(function (box) {
      var badge = $('[data-countdown-badge]', box);
      var label = $('[data-countdown-label]', box);
      if (!badge || !label) return;

      if (season.dayOfDecember) {
        badge.textContent = season.dayOfDecember;
        label.textContent = fill(strings.countdownDuring, { day: season.dayOfDecember });
        box.hidden = false;
        return;
      }
      if (!season.inSeason) return;

      var days = daysBetween(today, season.dec1);
      badge.textContent = days;
      label.textContent = days === 1 ? strings.countdownTomorrow : fill(strings.countdownBefore, { days: days });
      box.hidden = false;
    });
  }

  /* ---------- Bandeau « commandez avant le… » ---------- */

  function initDeadline() {
    $$('[data-deadline]').forEach(function (banner) {
      var text = $('[data-deadline-text]', banner);
      var pill = $('[data-deadline-pill]', banner);
      if (!text || !season.inSeason) return;

      var win = deliveryWindow();

      if (season.dayOfDecember) {
        text.innerHTML = fill(strings.deadlineDecember, {
          from: '<strong>' + formatDate(win.from) + '</strong>',
          to: '<strong>' + formatDate(win.to) + '</strong>'
        });
        return;
      }

      // Dernier jour pour commander = 30 novembre moins le délai le plus long
      var lastDay = addDays(season.dec1, -1 - win.totalMax);
      var left = daysBetween(today, lastDay);

      if (left >= 0) {
        text.innerHTML = fill(strings.deadlineBefore, { date: '<strong>' + formatDate(lastDay, true) + '</strong>' });
        if (pill) {
          pill.textContent = left === 0 ? strings.lastDay : left === 1 ? strings.dayLeft : fill(strings.daysLeft, { days: left });
        }
      } else {
        text.innerHTML = fill(strings.deadlineAfter, {
          from: '<strong>' + formatDate(win.from) + '</strong>',
          to: '<strong>' + formatDate(win.to) + '</strong>'
        });
      }
    });
  }

  /* ---------- Livraison estimée (fiche produit) ---------- */

  function initDelivery(root) {
    $$('[data-delivery]', root).forEach(function (box) {
      var win = deliveryWindow(box.getAttribute('data-min'), box.getAttribute('data-max'));
      var range = $('[data-delivery-range]', box);
      var status = $('[data-delivery-status]', box);
      if (range) {
        range.innerHTML = fill(strings.deliveryRange, {
          from: '<strong>' + formatDate(win.from) + '</strong>',
          to: '<strong>' + formatDate(win.to) + '</strong>'
        });
      }
      if (!status || !season.inSeason || season.dayOfDecember) return;

      var key = 'before';
      if (win.from >= season.dec1) key = 'after';
      else if (win.to >= season.dec1) key = 'borderline';

      var messages = { before: strings.deliveryBefore, borderline: strings.deliveryBorderline, after: strings.deliveryAfter };
      box.setAttribute('data-status', key);
      status.textContent = messages[key];
    });
  }

  /* ---------- Panier (tiroir + ajout en AJAX) ---------- */

  function cartSections() {
    var ids = ['cart-drawer'];
    return ids;
  }

  function renderCartSections(sections) {
    if (!sections) return;
    var html = sections['cart-drawer'];
    if (!html) return;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var fresh = $('[data-cart-drawer-inner]', doc);
    var current = $('[data-cart-drawer-inner]');
    if (fresh && current) current.replaceWith(fresh);

    var count = fresh ? Number(fresh.getAttribute('data-count')) || 0 : null;
    if (count !== null) {
      $$('[data-cart-count]').forEach(function (bubble) {
        bubble.textContent = count;
        bubble.hidden = count === 0;
      });
    }
  }

  function openCart() {
    var drawer = document.getElementById('CartDrawer');
    if (theme.cartType === 'page' || !drawer) {
      window.location.href = (theme.routes && theme.routes.cart) || '/cart';
      return;
    }
    openDrawer(drawer);
  }

  function addToCart(formData, button, errorBox) {
    formData.append('sections', cartSections().join(','));
    formData.append('sections_url', window.location.pathname);

    if (button) {
      button.classList.add('is-loading');
      button.setAttribute('aria-disabled', 'true');
    }
    if (errorBox) errorBox.textContent = '';

    return fetch((theme.routes.cartAdd || '/cart/add') + '.js', {
      method: 'POST',
      headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.status) {
          if (errorBox) errorBox.textContent = data.description || data.message || strings.cartError;
          return;
        }
        renderCartSections(data.sections);
        openCart();
      })
      .catch(function () {
        if (errorBox) errorBox.textContent = strings.cartError;
      })
      .finally(function () {
        if (button) {
          button.classList.remove('is-loading');
          button.removeAttribute('aria-disabled');
        }
      });
  }

  function changeLine(line, quantity) {
    var drawer = $('[data-cart-drawer-inner]');
    if (drawer) drawer.style.opacity = '0.6';
    return fetch((theme.routes.cartChange || '/cart/change') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity, sections: cartSections(), sections_url: window.location.pathname })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        renderCartSections(data.sections);
      })
      .catch(function () {
        window.location.reload();
      })
      .finally(function () {
        var fresh = $('[data-cart-drawer-inner]');
        if (fresh) fresh.style.opacity = '';
      });
  }

  function initCart() {
    // Formulaires d'ajout (fiche produit + ajout rapide sur les cartes)
    document.addEventListener('submit', function (event) {
      var form = event.target.closest('form[data-add-to-cart]');
      if (!form || !window.fetch) return;
      if (theme.cartType === 'page') return;
      event.preventDefault();
      var button = $('[type="submit"]', form);
      var errorBox = $('[data-form-error]', form.closest('[data-product]') || form);
      addToCart(new FormData(form), button, errorBox);
    });

    // Quantités et suppression dans le tiroir
    document.addEventListener('click', function (event) {
      var stepper = event.target.closest('[data-line-step]');
      if (stepper) {
        event.preventDefault();
        var line = Number(stepper.getAttribute('data-line'));
        var qty = Number(stepper.getAttribute('data-quantity'));
        changeLine(line, Math.max(0, qty + Number(stepper.getAttribute('data-line-step'))));
        return;
      }
      var remove = event.target.closest('[data-line-remove]');
      if (remove && remove.closest('[data-cart-drawer-inner]')) {
        event.preventDefault();
        changeLine(Number(remove.getAttribute('data-line-remove')), 0);
      }
    });

    // Page panier : on enregistre dès qu'une quantité change
    $$('[data-cart-form] [data-qty-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        input.form.submit();
      });
    });
  }

  /* ---------- Quantité (+ / -) ---------- */

  function initQuantity() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-qty-step]');
      if (!button) return;
      var wrapper = button.closest('.qty');
      var input = wrapper && $('input', wrapper);
      if (!input) return;
      event.preventDefault();
      var min = Number(input.min) || 0;
      var value = (Number(input.value) || 0) + Number(button.getAttribute('data-qty-step'));
      input.value = Math.max(min, value);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ---------- Fiche produit ---------- */

  function initProduct(root) {
    $$('[data-product]', root).forEach(function (section) {
      var dataTag = $('[data-product-json]', section);
      if (!dataTag) return;
      var product = JSON.parse(dataTag.textContent);
      var form = $('form[data-add-to-cart]', section);
      var idInput = form && $('input[name="id"]', form);
      var submit = form && $('[type="submit"]', form);
      var submitLabel = submit && $('[data-submit-label]', submit);
      var priceBox = $('[data-price]', section);
      var stickyPrice = $('[data-sticky-price]', section);
      var stickyButton = $('[data-sticky-buy] button', section);

      function selectedOptions() {
        return $$('[data-option]', section).map(function (fieldset) {
          var checked = $('input:checked', fieldset);
          return checked ? checked.value : null;
        });
      }

      function findVariant(options) {
        return product.variants.find(function (variant) {
          return variant.options.every(function (value, i) {
            return value === options[i];
          });
        });
      }

      function renderPrice(variant) {
        if (!priceBox || !variant) return;
        var html = '';
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          html += '<span class="price__sale">' + formatMoney(variant.price) + '</span>';
          html += '<s class="price__compare">' + formatMoney(variant.compare_at_price) + '</s>';
          var percent = Math.round(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price);
          html += '<span class="badge">-' + percent + '%</span>';
        } else {
          html += '<span>' + formatMoney(variant.price) + '</span>';
        }
        priceBox.innerHTML = html;
        if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price);
      }

      function markUnavailable(options) {
        // Grise les valeurs qui ne mènent à aucune variante disponible
        $$('[data-option]', section).forEach(function (fieldset, index) {
          $$('input', fieldset).forEach(function (input) {
            var test = options.slice();
            test[index] = input.value;
            var match = findVariant(test);
            var label = input.nextElementSibling;
            if (label) label.classList.toggle('is-unavailable', !match || !match.available);
          });
        });
      }

      function update() {
        var options = selectedOptions();
        var variant = findVariant(options);
        markUnavailable(options);
        $$('[data-option]', section).forEach(function (fieldset, index) {
          var current = $('[data-option-value]', fieldset);
          if (current) current.textContent = options[index] || '';
        });

        if (!variant) {
          if (submit) submit.setAttribute('disabled', 'disabled');
          if (submitLabel) submitLabel.textContent = strings.unavailable;
          return;
        }

        if (idInput) idInput.value = variant.id;
        renderPrice(variant);

        var label = variant.available ? strings.addToCart : strings.soldOut;
        if (submit) submit.toggleAttribute('disabled', !variant.available);
        if (submitLabel) submitLabel.textContent = label;
        if (stickyButton) {
          stickyButton.toggleAttribute('disabled', !variant.available);
          stickyButton.textContent = label;
        }

        if (variant.featured_media) goToMedia(variant.featured_media.id);

        if (section.hasAttribute('data-update-url') && window.history.replaceState) {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({}, '', url.toString());
        }
      }

      $$('[data-option] input', section).forEach(function (input) {
        input.addEventListener('change', update);
      });

      // Galerie
      var track = $('[data-gallery-track]', section);
      var thumbs = $$('[data-gallery-thumb]', section);
      var counter = $('[data-gallery-count]', section);
      var slides = track ? $$('[data-media-id]', track) : [];

      function goTo(index) {
        if (!track || !slides[index]) return;
        track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: 'smooth' });
      }

      function goToMedia(mediaId) {
        var index = slides.findIndex(function (slide) {
          return Number(slide.getAttribute('data-media-id')) === Number(mediaId);
        });
        if (index > -1) goTo(index);
      }

      function currentIndex() {
        if (!track) return 0;
        return Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      }

      if (track) {
        track.addEventListener(
          'scroll',
          function () {
            var index = currentIndex();
            thumbs.forEach(function (thumb, i) {
              thumb.setAttribute('aria-current', String(i === index));
            });
            if (counter) counter.textContent = index + 1 + ' / ' + slides.length;
          },
          { passive: true }
        );
      }

      thumbs.forEach(function (thumb, i) {
        thumb.addEventListener('click', function () {
          goTo(i);
        });
      });

      $$('[data-gallery-prev]', section).forEach(function (button) {
        button.addEventListener('click', function () {
          goTo(Math.max(0, currentIndex() - 1));
        });
      });

      $$('[data-gallery-next]', section).forEach(function (button) {
        button.addEventListener('click', function () {
          goTo(Math.min(slides.length - 1, currentIndex() + 1));
        });
      });

      // Barre d'achat collante sur mobile
      var sticky = $('[data-sticky-buy]', section);
      if (sticky && form && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          var entry = entries[0];
          sticky.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        }).observe(form);
        if (stickyButton) {
          stickyButton.addEventListener('click', function () {
            if (submit) submit.click();
          });
        }
      }

      if ($$('[data-option]', section).length) markUnavailable(selectedOptions());
    });
  }

  /* ---------- Produits recommandés ---------- */

  function initRecommendations() {
    $$('[data-recommendations]').forEach(function (box) {
      var url = box.getAttribute('data-url');
      if (!url || !window.fetch) return;
      fetch(url)
        .then(function (response) {
          return response.text();
        })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var fresh = $('[data-recommendations]', doc);
          if (fresh && fresh.innerHTML.trim().length) {
            box.innerHTML = fresh.innerHTML;
            initReveal(box);
          }
        })
        .catch(function () {});
    });
  }

  /* ---------- Filtres de collection ---------- */

  function initFilters() {
    $$('[data-filter-form]').forEach(function (form) {
      form.addEventListener('change', function (event) {
        if (event.target.matches('input[type="number"]')) return;
        form.submit();
      });
    });

    $$('[data-sort-select]').forEach(function (select) {
      select.addEventListener('change', function () {
        var url = new URL(window.location.href);
        url.searchParams.set('sort_by', select.value);
        url.searchParams.delete('page');
        window.location.href = url.toString();
      });
    });

    $$('[data-filters-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var filters = document.getElementById(button.getAttribute('aria-controls'));
        if (!filters) return;
        var open = filters.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ---------- Apparition au défilement ---------- */

  function initReveal(root) {
    var items = $$('.reveal:not(.is-visible)', root);
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    items.forEach(function (item) { observer.observe(item); });
  }

  /* ---------- Démarrage ---------- */

  function init() {
    initAnnouncements();
    initHeader();
    initDrawers();
    initAdvent();
    initCountdown();
    initDeadline();
    initDelivery(document);
    initCart();
    initQuantity();
    initProduct(document);
    initRecommendations();
    initFilters();
    initReveal(document);
  }

  // Éditeur de thème Shopify : on relance quand une section est modifiée
  document.addEventListener('shopify:section:load', function (event) {
    initAdvent();
    initCountdown();
    initDeadline();
    initDelivery(event.target);
    initProduct(event.target);
    initReveal(event.target);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.themeFormatMoney = formatMoney;
})();
