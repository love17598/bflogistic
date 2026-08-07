/* ==========================================================================
   BF LOGISTICS — Site behaviour
   Navigation · live cutoff clock · price calculator · table filter · forms
   Depends on rates.js (must load first).
   ========================================================================== */

(function () {
  'use strict';

  var R = window.BFRates;

  /* --------------------------------------------------------------------------
     DEMO MODE
     There is no backend on the static build. Form submissions are validated and
     acknowledged locally but are NOT delivered anywhere. Leave this true until a
     server is connected, or the site will silently drop real customer bookings.
     Set to false once /api routes, email and the database are live.
     -------------------------------------------------------------------------- */
  var DEMO_MODE = true;

  var CONTACT = {
    phone: '(289) 499-2838',
    phoneHref: 'tel:+12894992838',
    email: 'admin@bflogistic.ca'
  };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) { Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON = {
    clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    info: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    alert: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>'
  };

  /* ========================================================================
     1. Navigation
     ======================================================================== */

  function initNav() {
    // Desktop mega menus
    $$('.nav-item').forEach(function (item) {
      var trigger = $('.nav-link', item);
      var mega = $('.mega', item);
      if (!trigger || !mega) return;

      var closeTimer;
      function open() { clearTimeout(closeTimer); closeAll(item); item.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
      function close() { item.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }

      item.addEventListener('mouseenter', open);
      item.addEventListener('mouseleave', function () { closeTimer = setTimeout(close, 120); });
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        item.classList.contains('is-open') ? close() : open();
      });
      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) close();
      });
    });

    function closeAll(except) {
      $$('.nav-item.is-open').forEach(function (i) {
        if (i === except) return;
        i.classList.remove('is-open');
        var t = $('.nav-link', i);
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeAll(); closeMobile(); }
    });

    // Mobile panel
    var panel = $('#mobileNav');
    var toggle = $('.nav-toggle');
    var closeBtn = $('.mobile-nav-close');

    function openMobile() {
      if (!panel) return;
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      var first = $('a, button', panel);
      if (first) first.focus();
    }
    function closeMobile() {
      if (!panel) return;
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
    }
    if (toggle) toggle.addEventListener('click', openMobile);
    if (closeBtn) closeBtn.addEventListener('click', function () { closeMobile(); if (toggle) toggle.focus(); });
    if (panel) $$('a', panel).forEach(function (a) { a.addEventListener('click', closeMobile); });
  }

  /* ========================================================================
     2. Live cutoff clock — §2.1, §10.5
     ======================================================================== */

  function paintClock(node, status) {
    var text = $('[data-cutoff-text]', node);
    if (text) { text.innerHTML = status.html; } else { node.innerHTML = status.html; }
    node.classList.toggle('is-urgent', status.urgent);
    node.classList.toggle('is-closed', status.closed);
  }

  function clockStatus() {
    var s = R.cutoffStatus();
    var urgent = (s.state === 'same-day' && s.minutesLeft != null && s.minutesLeft <= 30);
    var closed = (s.state === 'closed' || s.state === 'before-open');

    // Emphasise the number — it is the point of the whole component.
    var html = esc(s.message).replace(/(\d+ minutes?)/, '<b>$1</b>');
    return { html: html, urgent: urgent, closed: closed, raw: s };
  }

  function initClock() {
    var nodes = $$('[data-cutoff-clock]');
    if (!nodes.length) return;

    nodes.forEach(function (n) {
      if (!$('.dot', n)) n.insertBefore(el('span', { class: 'dot' }), n.firstChild);
      if (!$('[data-cutoff-text]', n)) n.appendChild(el('span', { 'data-cutoff-text': '' }));
    });

    function tick() {
      var s = clockStatus();
      nodes.forEach(function (n) { paintClock(n, s); });
    }
    tick();
    setInterval(tick, 20000);
  }

  /* ========================================================================
     3. Price calculator — §2.3, §9.5, §9.6
     ======================================================================== */

  var LB_PER_KG = 2.2046226218;

  function buildLocationSelect(name, id, preselectValue) {
    var opts = R.locationOptions();
    var html = '<option value="">Select a city…</option>';
    html += '<optgroup label="GTA — 10 zones">';
    opts.gta.forEach(function (o) {
      html += '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
    });
    html += '</optgroup><optgroup label="Out of town (Same Day only)">';
    opts.outOfTown.forEach(function (o) {
      html += '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>';
    });
    html += '</optgroup>';

    var sel = el('select', { class: 'select', name: name, id: id });
    sel.innerHTML = html;
    if (preselectValue) sel.value = preselectValue;
    return sel;
  }

  function findCityValue(cityName) {
    if (!cityName) return '';
    var opts = R.locationOptions();
    var all = opts.gta.concat(opts.outOfTown);
    for (var i = 0; i < all.length; i++) {
      if (all[i].city.toLowerCase() === String(cityName).toLowerCase()) return all[i].value;
    }
    return '';
  }

  function calcTemplate(uid, opts) {
    var svc = R.SERVICE_LEVELS.map(function (l) {
      return '<label class="svc">' +
        '<input type="radio" name="svc-' + uid + '" value="' + l.key + '">' +
        '<span class="svc-name">' + esc(l.name) + '</span>' +
        '<span class="svc-time">' + esc(l.time) + '</span>' +
        '</label>';
    }).join('');

    var piecesField = opts.showPieces ?
      '<div class="field">' +
        '<label for="pieces-' + uid + '">Pieces</label>' +
        '<input class="input" type="number" inputmode="numeric" min="1" step="1" value="1" id="pieces-' + uid + '" name="pieces">' +
      '</div>' : '';

    return '' +
      '<div class="calc-head">' +
        '<h3>' + esc(opts.title) + '</h3>' +
        '<div class="cutoff" data-cutoff-clock role="status"></div>' +
      '</div>' +
      '<div class="calc-body">' +
        '<div class="calc-grid">' +
          '<div class="field"><label for="from-' + uid + '">Pickup city</label><span data-slot="from"></span></div>' +
          '<div class="field"><label for="to-' + uid + '">Delivery city</label><span data-slot="to"></span></div>' +
          '<div class="field">' +
            '<label for="weight-' + uid + '">Total weight</label>' +
            '<div style="display:flex;gap:.4rem">' +
              '<input class="input" type="number" inputmode="decimal" min="0" step="0.5" placeholder="e.g. 45" id="weight-' + uid + '" name="weight" style="flex:1">' +
              '<button type="button" class="btn btn-outline btn-sm" data-unit-toggle style="min-width:56px" aria-label="Switch weight units between pounds and kilograms">lbs</button>' +
            '</div>' +
            '<span class="hint" data-weight-hint>Pounds. Surcharge applies over 30 lbs.</span>' +
          '</div>' +
          piecesField +
        '</div>' +
        // A role="group" div rather than fieldset/legend: browsers give <legend>
        // special layout that ignores .sr-only, which pushed the page wider than
        // the viewport. This labels the radio group just as well.
        '<div class="fieldset" role="group" aria-label="Service level" style="margin:1.1rem 0 0">' +
          '<div class="calc-services">' + svc + '</div>' +
        '</div>' +
        '<label class="check" style="margin-top:1rem;margin-bottom:0">' +
          '<input type="checkbox" name="van">' +
          '<span>Van required <span class="muted">(+' + R.money(R.SETTINGS.vanCharge) + ')</span></span>' +
        '</label>' +
        '<div class="calc-result" data-calc-result aria-live="polite"></div>' +
      '</div>';
  }

  function renderQuote(target, q, state, opts) {
    opts = opts || {};
    if (!q.ok) {
      if (q.reason === 'incomplete') {
        target.innerHTML = '<p class="calc-empty">' + esc(q.message) + '</p>';
        return;
      }
      target.innerHTML =
        '<div class="calc-notice calc-notice--warn">' + ICON.alert +
          '<div><b>We will price this one personally.</b><br>' + esc(q.message) + '</div>' +
        '</div>' +
        '<div class="btn-row" style="margin-top:1rem">' +
          '<a class="btn btn-primary" href="' + CONTACT.phoneHref + '">' + ICON.phone + ' Call ' + esc(CONTACT.phone) + '</a>' +
          '<a class="btn btn-outline" href="logistics-quote.html">Request a quote</a>' +
        '</div>';
      return;
    }

    var lines = '';
    lines += line('Base rate <span class="muted">— ' + esc(q.basis) + '</span>', R.money(q.base));
    if (q.uplift > 0) lines += line('Inter-zone uplift', R.money(q.uplift));

    var wLabel = q.billableWeight > 0
      ? 'Weight surcharge <span class="muted">— ' + q.billableWeight.toFixed(q.billableWeight % 1 ? 1 : 0) +
        ' lbs over ' + R.SETTINGS.weightThresholdLbs + ' @ ' + R.money(R.SETTINGS.perLbRate) + '/lb</span>'
      : 'Weight surcharge <span class="muted">— under ' + R.SETTINGS.weightThresholdLbs + ' lbs</span>';
    lines += line(wLabel, R.money(q.weightSurcharge), q.weightSurcharge === 0);

    lines += line('Van charge', R.money(q.vanCharge), q.vanCharge === 0);
    if (q.accessorials > 0) lines += line('Additional charges', R.money(q.accessorials));

    lines += line('Subtotal', R.money(q.subtotal), false, 'is-sub');
    lines += line('HST (' + Math.round(q.hstRate * 100) + '%)', R.money(q.hst));
    lines += line('Total', R.money(q.total), false, 'is-total');

    var notes = (q.notes || []).map(function (n) {
      return '<div class="calc-notice" style="margin-bottom:.75rem">' + ICON.info + '<div>' + esc(n) + '</div></div>';
    }).join('');

    var actions = opts.hideActions ? '' :
      '<div class="btn-row">' +
        '<a class="btn btn-primary" href="courier-book.html" data-book-link>Book this pickup</a>' +
        '<a class="btn btn-outline" href="' + CONTACT.phoneHref + '">' + ICON.phone + ' ' + esc(CONTACT.phone) + '</a>' +
      '</div>';

    target.innerHTML =
      '<div class="calc-lines">' + lines + '</div>' +
      notes +
      actions +
      '<p class="calc-disclaimer">Estimated price — final rate confirmed at pickup based on actual weight. ' +
      'All prices in CAD and include 13% HST as shown.</p>';

    var book = $('[data-book-link]', target);
    if (book) {
      book.addEventListener('click', function () {
        try { sessionStorage.setItem('bf_quote', JSON.stringify({ quote: q, inputs: state })); } catch (e) {}
      });
    }

    function line(label, value, muted, extra) {
      return '<div class="calc-line ' + (extra || '') + (muted ? ' is-muted' : '') + '">' +
        '<span>' + label + '</span><span>' + esc(value) + '</span></div>';
    }
  }

  function initCalculators() {
    var uid = 0;
    $$('[data-calculator]').forEach(function (host) {
      uid++;
      var id = uid;
      var showPieces = host.getAttribute('data-pieces') !== 'false';
      var title = host.getAttribute('data-title') || 'Get an instant price';

      var wrap = el('div', { class: 'calc' + (host.getAttribute('data-variant') === 'inline' ? ' calc--inline' : '') });
      wrap.innerHTML = calcTemplate(id, { title: title, showPieces: showPieces });
      host.appendChild(wrap);

      var fromSel = buildLocationSelect('from', 'from-' + id, findCityValue(host.getAttribute('data-from') || 'Brampton'));
      var toSel = buildLocationSelect('to', 'to-' + id, findCityValue(host.getAttribute('data-to')));
      $('[data-slot="from"]', wrap).replaceWith(fromSel);
      $('[data-slot="to"]', wrap).replaceWith(toSel);

      var weightInput = $('[name="weight"]', wrap);
      var piecesInput = $('[name="pieces"]', wrap);
      var vanInput = $('[name="van"]', wrap);
      var unitBtn = $('[data-unit-toggle]', wrap);
      var weightHint = $('[data-weight-hint]', wrap);
      var result = $('[data-calc-result]', wrap);
      var radios = $$('input[type="radio"]', wrap);

      // §9.6 rule 2 — preselect the tier the clock actually implies.
      var suggested = R.cutoffStatus().suggested;
      radios.forEach(function (r) { if (r.value === suggested) r.checked = true; });

      var unit = 'lbs';
      unitBtn.addEventListener('click', function () {
        var current = parseFloat(weightInput.value);
        if (unit === 'lbs') {
          unit = 'kg';
          unitBtn.textContent = 'kg';
          weightHint.textContent = 'Kilograms — converted to lbs for pricing.';
          if (isFinite(current)) weightInput.value = Math.round((current / LB_PER_KG) * 10) / 10;
        } else {
          unit = 'lbs';
          unitBtn.textContent = 'lbs';
          weightHint.textContent = 'Pounds. Surcharge applies over 30 lbs.';
          if (isFinite(current)) weightInput.value = Math.round((current * LB_PER_KG) * 10) / 10;
        }
        run();
      });

      function collect() {
        var raw = parseFloat(weightInput.value);
        var lbs = isFinite(raw) ? (unit === 'kg' ? raw * LB_PER_KG : raw) : NaN;
        var svc = (radios.filter(function (r) { return r.checked; })[0] || {}).value || 'same_day';
        return {
          from: fromSel.value,
          to: toSel.value,
          weightLbs: lbs,
          pieces: piecesInput ? parseInt(piecesInput.value, 10) || 1 : 1,
          vanRequired: vanInput.checked,
          service: svc,
          displayWeight: raw,
          displayUnit: unit
        };
      }

      function run() {
        var state = collect();
        renderQuote(result, R.quote(state), state);
        try { sessionStorage.setItem('bf_calc_state', JSON.stringify(state)); } catch (e) {}
      }

      // §12 — debounce at 300ms.
      var timer;
      function debounced() { clearTimeout(timer); timer = setTimeout(run, 300); }

      [fromSel, toSel, vanInput].concat(radios).forEach(function (n) {
        n.addEventListener('change', run);
      });
      if (piecesInput) piecesInput.addEventListener('input', debounced);
      weightInput.addEventListener('input', debounced);

      run();
    });
  }

  /* Standalone location dropdowns (the booking form uses real form fields
     rather than an injected calculator, so its selects are populated here). */
  function initLocationSelects() {
    $$('select[data-location-select]').forEach(function (sel) {
      if (sel.options.length) return;
      var built = buildLocationSelect(sel.name, sel.id);
      sel.innerHTML = built.innerHTML;
    });
  }

  /* Live price panel inside the booking form — §6.2 Step 1 */
  function initBookingPrice() {
    var form = $('#bookForm');
    var panel = form && $('[data-live-price]', form);
    if (!form || !panel) return;

    function run() {
      var svc = form.querySelector('input[name="service_level"]:checked');
      var state = {
        from: form.elements['from'].value,
        to: form.elements['to'].value,
        weightLbs: parseFloat(form.elements['weight_lbs'].value),
        pieces: parseInt(form.elements['pieces'].value, 10) || 1,
        vanRequired: form.elements['van_required'].checked,
        service: svc ? svc.value : 'same_day'
      };
      renderQuote(panel, R.quote(state), state, { hideActions: true });
    }

    var timer;
    function debounced() { clearTimeout(timer); timer = setTimeout(run, 300); }

    ['from', 'to', 'van_required'].forEach(function (n) {
      if (form.elements[n]) form.elements[n].addEventListener('change', run);
    });
    $$('input[name="service_level"]', form).forEach(function (r) { r.addEventListener('change', run); });
    ['weight_lbs', 'pieces'].forEach(function (n) {
      if (form.elements[n]) form.elements[n].addEventListener('input', debounced);
    });

    // Preselect the tier the clock implies, unless a prefill already chose one.
    if (!form.querySelector('input[name="service_level"]:checked')) {
      var suggested = R.cutoffStatus().suggested;
      $$('input[name="service_level"]', form).forEach(function (r) {
        if (r.value === suggested) r.checked = true;
      });
    }
    run();
  }

  /* ========================================================================
     4. Filterable rate table — out-of-town page
     ======================================================================== */

  function initTableFilter() {
    $$('[data-table-filter]').forEach(function (input) {
      var table = $(input.getAttribute('data-table-filter'));
      if (!table) return;
      var counter = $('[data-filter-count]');
      var rows = $$('tbody tr', table);

      function apply() {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        rows.forEach(function (row) {
          var cell = row.cells[0];
          var match = !q || (cell && cell.textContent.toLowerCase().indexOf(q) !== -1);
          row.hidden = !match;
          if (match) shown++;
        });
        if (counter) {
          counter.textContent = q
            ? shown + ' of ' + rows.length + ' destinations'
            : rows.length + ' destinations';
        }
      }
      input.addEventListener('input', apply);
      apply();
    });
  }

  /* ========================================================================
     5. Forms — §6.4
     ======================================================================== */

  function reference(prefix) {
    var n = Math.floor(100000 + Math.random() * 900000);
    return prefix + '-' + n;
  }

  function fieldOf(node) { return node.closest('.field') || node.closest('.check'); }

  function setError(node, message) {
    var f = fieldOf(node);
    if (!f) return;
    f.classList.add('has-error');
    var e = $('.field-error', f);
    if (!e) { e = el('span', { class: 'field-error' }); f.appendChild(e); }
    e.textContent = message;
    node.setAttribute('aria-invalid', 'true');
  }

  function clearError(node) {
    var f = fieldOf(node);
    if (!f) return;
    f.classList.remove('has-error');
    node.removeAttribute('aria-invalid');
  }

  var PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    phone: /^(\+?1[\s\-.]?)?\(?[2-9]\d{2}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$/,
    postal: /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/
  };

  function validateField(node) {
    var value = (node.type === 'checkbox') ? node.checked : String(node.value || '').trim();

    if (node.required && (node.type === 'checkbox' ? !value : !value)) {
      setError(node, node.type === 'checkbox' ? 'Please tick this box to continue.' : 'This field is required.');
      return false;
    }
    if (!value || node.type === 'checkbox') { clearError(node); return true; }

    var kind = node.getAttribute('data-validate');
    if (kind === 'email' && !PATTERNS.email.test(value)) { setError(node, 'Enter a valid email address.'); return false; }
    if (kind === 'phone' && !PATTERNS.phone.test(value)) { setError(node, 'Enter a valid Canadian phone number, e.g. (289) 499-2838.'); return false; }
    if (kind === 'postal' && !PATTERNS.postal.test(value)) { setError(node, 'Enter a valid postal code, e.g. L6W 1Y7.'); return false; }
    if (node.type === 'date' && node.min && value < node.min) { setError(node, 'Pickup date cannot be in the past.'); return false; }

    clearError(node);
    return true;
  }

  function validateScope(scope) {
    var ok = true;
    var firstBad = null;
    $$('input, select, textarea', scope).forEach(function (n) {
      if (n.type === 'hidden' || n.closest('.honeypot')) return;
      if (!validateField(n)) { ok = false; if (!firstBad) firstBad = n; }
    });
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return ok;
  }

  function serialise(form) {
    var out = {};
    $$('input, select, textarea', form).forEach(function (n) {
      if (!n.name || n.closest('.honeypot')) return;
      if (n.type === 'checkbox') { out[n.name] = n.checked; }
      else if (n.type === 'radio') { if (n.checked) out[n.name] = n.value; }
      else { out[n.name] = n.value; }
    });
    return out;
  }

  function mailtoFor(form, data, ref) {
    var subject = (form.getAttribute('data-subject') || 'Website enquiry') + ' — ' + ref;
    var body = Object.keys(data).map(function (k) {
      var label = k.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return label + ': ' + data[k];
    }).join('\n');
    return 'mailto:' + CONTACT.email +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body + '\n\nReference: ' + ref);
  }

  function initForms() {
    $$('form[data-form]').forEach(function (form) {
      var prefix = form.getAttribute('data-ref-prefix') || 'CT';

      // sessionStorage persistence — §6.4
      var storeKey = 'bf_form_' + (form.id || prefix);
      try {
        var saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
        if (saved) {
          Object.keys(saved).forEach(function (k) {
            var n = form.elements[k];
            if (!n || n.length) return;
            if (n.type === 'checkbox') n.checked = !!saved[k];
            else if (n.type !== 'radio') n.value = saved[k];
          });
        }
      } catch (e) {}

      form.addEventListener('input', function () {
        try { sessionStorage.setItem(storeKey, JSON.stringify(serialise(form))); } catch (e) {}
      });

      $$('input, select, textarea', form).forEach(function (n) {
        n.addEventListener('blur', function () { if (n.value || n.required) validateField(n); });
      });

      // Multi-step
      var steps = $$('.form-step', form);
      if (steps.length > 1) {
        var bar = $$('.steps-bar li', form);
        var index = 0;

        function show(i) {
          index = i;
          steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
          bar.forEach(function (b, k) {
            b.classList.toggle('is-active', k === i);
            b.classList.toggle('is-done', k < i);
          });
          form.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }

        $$('[data-step-next]', form).forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!validateScope(steps[index])) return;
            show(Math.min(index + 1, steps.length - 1));
          });
        });
        $$('[data-step-back]', form).forEach(function (btn) {
          btn.addEventListener('click', function () { show(Math.max(index - 1, 0)); });
        });
        show(0);
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot — a bot fills every field it finds.
        var hp = $('.honeypot input', form);
        if (hp && hp.value) return;

        if (!validateScope(form)) return;

        var data = serialise(form);
        var ref = reference(prefix);

        try {
          sessionStorage.setItem('bf_submission', JSON.stringify({
            reference: ref,
            kind: form.getAttribute('data-form'),
            title: form.getAttribute('data-subject') || 'Request',
            name: data.pickup_contact || data.contact_name || data.name || '',
            phone: data.pickup_phone || data.phone || '',
            email: data.pickup_email || data.email || '',
            quote: JSON.parse(sessionStorage.getItem('bf_quote') || 'null'),
            submittedAt: new Date().toISOString(),
            demo: DEMO_MODE
          }));
          sessionStorage.removeItem(storeKey);
        } catch (err) {}

        if (DEMO_MODE) {
          // Nothing is transmitted. Offer the customer a route that actually works
          // today rather than pretending the request was received.
          var link = mailtoFor(form, data, ref);
          var out = $('[data-form-outcome]', form) || form.appendChild(el('div', { 'data-form-outcome': '' }));
          out.innerHTML =
            '<div class="demo-note" style="margin:1.5rem 0 0" role="alert">' + ICON.alert +
              '<div><b>This form is not connected to a server yet.</b><br>' +
              'Your details have <b>not</b> been sent. Until the backend is live, use the button below to ' +
              'send them by email, or call us on ' + esc(CONTACT.phone) + '.' +
              '<div class="btn-row" style="margin-top:.9rem">' +
                '<a class="btn btn-primary btn-sm" href="' + esc(link) + '">Send by email instead</a>' +
                '<a class="btn btn-outline btn-sm" href="' + CONTACT.phoneHref + '">Call ' + esc(CONTACT.phone) + '</a>' +
              '</div></div>' +
            '</div>';
          out.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }

        window.location.href = 'thank-you.html';
      });
    });
  }

  /* ========================================================================
     6. Thank-you page
     ======================================================================== */

  function initThankYou() {
    var host = $('[data-submission]');
    if (!host) return;
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem('bf_submission') || 'null'); } catch (e) {}

    if (!s) {
      host.innerHTML = '<p class="lead">Thanks for getting in touch. If you were expecting a reference number ' +
        'here, call us on <a href="' + CONTACT.phoneHref + '">' + esc(CONTACT.phone) + '</a> and we will pick it up straight away.</p>';
      return;
    }

    var q = s.quote && s.quote.quote;
    var quoteBlock = q && q.ok ? (
      '<div class="card" style="margin-top:1.5rem">' +
        '<h3 style="font-size:1.1rem">Your quoted price</h3>' +
        '<div class="calc-line"><span>' + esc(q.from) + ' → ' + esc(q.to) + ' · ' + esc(q.serviceName) + '</span><span></span></div>' +
        '<div class="calc-line"><span>Subtotal</span><span>' + esc(R.money(q.subtotal)) + '</span></div>' +
        '<div class="calc-line"><span>HST</span><span>' + esc(R.money(q.hst)) + '</span></div>' +
        '<div class="calc-line is-total"><span>Total</span><span>' + esc(R.money(q.total)) + '</span></div>' +
      '</div>'
    ) : '';

    // The <h1> is static in the page so it survives with JS disabled; this only
    // fills in the detail beneath it.
    var pill = $('[data-ref-pill]');
    if (pill) { pill.textContent = 'Reference ' + s.reference; pill.hidden = false; }

    host.innerHTML =
      '<p class="lead">Request <b>' + esc(s.reference) + '</b> is with our team. ' +
      'A member of staff will call you' + (s.phone ? ' on <b>' + esc(s.phone) + '</b>' : '') +
      ' <b>within 30 minutes</b> during business hours to confirm the details.</p>' +
      '<p>Need it sooner? Call us directly on <a href="' + CONTACT.phoneHref + '"><b>' + esc(CONTACT.phone) + '</b></a>.</p>' +
      quoteBlock +
      (s.demo ? '<div class="demo-note" style="margin-top:1.5rem">' + ICON.alert +
        '<div><b>Demo submission.</b> This static build has no server, so nothing was actually transmitted. ' +
        'Reference numbers are generated locally for layout purposes only.</div></div>' : '');
  }

  /* ========================================================================
     7. Small page utilities
     ======================================================================== */

  function initMisc() {
    // Footer year
    $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

    // Mark the current page in every nav. Section triggers light up for any page
    // in their section, so "Courier" stays lit on courier-pricing.html.
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    $$('.nav a[href], .subnav a[href], .mobile-nav a[href]').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (href && href === here) a.setAttribute('aria-current', 'page');
    });
    var section = here.indexOf('courier') === 0 ? 'courier'
                : here.indexOf('logistics') === 0 ? 'logistics' : null;
    if (section) {
      var trigger = $('.nav-link[data-section="' + section + '"]');
      if (trigger) trigger.setAttribute('aria-current', 'page');
    }

    // Pre-fill the booking form from a calculator hand-off — §6.2
    var bookForm = $('#bookForm');
    if (bookForm) {
      var payload = null;
      try { payload = JSON.parse(sessionStorage.getItem('bf_quote') || 'null'); } catch (e) {}
      if (payload && payload.inputs) {
        var i = payload.inputs;
        var setIf = function (name, value) {
          var n = bookForm.elements[name];
          if (n && value != null && value !== '' && !n.length) n.value = value;
        };
        setIf('from', i.from);
        setIf('to', i.to);
        setIf('weight_lbs', isFinite(i.weightLbs) ? Math.round(i.weightLbs * 10) / 10 : '');
        setIf('pieces', i.pieces);
        var van = bookForm.elements['van_required'];
        if (van && van.type === 'checkbox') van.checked = !!i.vanRequired;
        var svc = bookForm.elements['service_level'];
        if (svc && svc.length) {
          Array.prototype.forEach.call(svc, function (r) { if (r.value === i.service) r.checked = true; });
        } else if (svc) { svc.value = i.service; }

        var banner = $('[data-prefill-note]');
        if (banner && payload.quote && payload.quote.ok) {
          banner.hidden = false;
          banner.innerHTML = ICON.info + '<div>Carried over from your quote: <b>' +
            esc(payload.quote.from) + ' → ' + esc(payload.quote.to) + '</b>, ' +
            esc(payload.quote.serviceName) + ', estimated <b>' + esc(R.money(payload.quote.total)) +
            '</b> including HST.</div>';
        }
      }

      // Today's date floor on the pickup date — §6.2
      var dateInput = bookForm.elements['pickup_date'];
      if (dateInput) {
        var t = R.torontoNow();
        var d = new Date();
        var iso = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(d);
        dateInput.min = iso;
        if (!dateInput.value) dateInput.value = iso;
      }
    }

    // Service-level note inside the booking form
    var svcNote = $('[data-service-note]');
    if (svcNote) {
      var st = R.cutoffStatus();
      svcNote.innerHTML = ICON.clock + '<div>' + esc(st.message) + '</div>';
    }
  }

  /* ======================================================================== */

  function boot() {
    if (!R) { return; }
    initNav();
    initClock();
    initCalculators();
    initLocationSelects();   // must precede any prefill that sets a select value
    initTableFilter();
    initForms();             // restores sessionStorage, wires steps
    initMisc();              // carries a calculator quote into the booking form
    initBookingPrice();      // reads whatever the two above left in the fields
    initThankYou();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
