/* ==========================================================================
   BF LOGISTICS — Rate tables and pricing engine
   --------------------------------------------------------------------------
   PRICING MODEL (November 2026)
     • Three zones. Each zone has one Same Day base rate.
     • A trip between two different zones uses the HIGHER zone's rate.
     • A trip that stays inside one zone uses the same-zone rate ($19).
     • Rush  = base × 1.5      Direct = base × 1.7
     • Distance: after the first 50 km, add $1 for every extra kilometre.
       (The per-km charge is NOT multiplied for Rush / Direct.)
     • Distance is estimated from postal codes (see postal-data.js):
       straight-line distance between the two postal areas × a road factor.
     • Towns outside the 3 zones keep their published out-of-town flat rate
       (Same Day only, no per-km charge).
     • Weight surcharge, van charge and HST are unchanged.

   Every number below can be changed here and the calculator follows at once.
   The published tables in the HTML pages are separate — see README.md.

   Requires assets/js/postal-data.js to be loaded first.
   ========================================================================== */

(function (root) {
  'use strict';

  var P = root.BFPostal || (typeof require === 'function' ? require('./postal-data.js') : null);

  /* --- Settings ------------------------------------------------------------ */

  var SETTINGS = {
    weightThresholdLbs: 30,     // surcharge applies only ABOVE this
    perLbRate: 0.15,
    vanCharge: 15.00,
    hstRate: 0.13,

    // Trip that starts and ends in the same zone (any zone)
    sameZoneRate: 19.00,

    // Service multipliers, applied to the base rate only
    serviceMultiplier: { same_day: 1.0, rush: 1.5, direct: 1.7 },

    // Distance charge
    includedKm: 50,             // first 50 km included in the base rate
    perKmRate: 1.00,            // $ per km after that
    roadFactor: 1.3,            // straight-line km × this ≈ driving km

    // Cutoffs, in America/Toronto. Minutes from midnight.
    sameDayCutoffMin: 11 * 60 + 30,   // 11:30 AM
    rushCutoffMin: 14 * 60 + 30,      // 2:30 PM

    // Business hours (confirmed): Mon-Fri 10:00-17:00, closed Sat/Sun
    openMin: 10 * 60,
    closeMin: 17 * 60,
    openDays: [1, 2, 3, 4, 5],

    // Hard stops -> "Contact us"
    maxWeightLbs: 500,
    maxPieces: 10,

    // Optional accessorials, all default $0.00 until switched on
    surcharges: {
      fuelPct: 0,        // fraction of subtotal, e.g. 0.12
      waitTime: 0,       // flat $
      afterHours: 0,     // flat $
      extraStop: 0       // flat $ per extra stop
    }
  };

  /* --- The three zones ----------------------------------------------------- */

  var ZONES = [
    { id: 1, same_day: 19, label: 'Brampton, Toronto & West GTA',
      cities: ['Brampton', 'Georgetown', 'Milton', 'Oakville', 'Toronto', 'Vaughan',
               'Scarborough', 'Mississauga', 'Richmond Hill'] },
    { id: 2, same_day: 22, label: 'Durham, York & Guelph',
      cities: ['Ajax', 'Pickering', 'Markham', 'Newmarket', 'Whitby', 'Aurora',
               'Oshawa', 'Guelph', 'Acton'] },
    { id: 3, same_day: 32, label: 'Hamilton & Waterloo Region',
      cities: ['Hamilton', 'Kitchener', 'Waterloo', 'Cambridge'] }
  ];

  /* Other spellings customers might type, mapped to the city we price as. */
  var CITY_ALIASES = {
    'george town': 'Georgetown', 'halton hills': 'Georgetown',
    'new market': 'Newmarket', 'richmondhill': 'Richmond Hill',
    'etobicoke': 'Toronto', 'north york': 'Toronto', 'york': 'Toronto', 'east york': 'Toronto',
    'downtown toronto': 'Toronto', 'willowdale': 'Toronto', 'don mills': 'Toronto',
    'woodbridge': 'Vaughan', 'concord': 'Vaughan', 'maple': 'Vaughan', 'kleinburg': 'Vaughan',
    'thornhill': 'Vaughan', 'unionville': 'Markham',
    'ancaster': 'Hamilton', 'dundas': 'Hamilton', 'stoney creek': 'Hamilton', 'waterdown': 'Hamilton',
    'st catharines': 'St. Catharines', 'saint catharines': 'St. Catharines',
    'st thomas': 'St. Thomas', 'saint thomas': 'St. Thomas',
    'greater sudbury': 'Sudbury', 'montréal': 'Montreal'
  };

  /* --- Out-of-town flat rates, Same Day only -------------------------------
     Unchanged from the printed sheet, EXCEPT that cities now inside the three
     zones were removed (zone pricing wins): Acton, Guelph, Hamilton, Ancaster,
     Stoney Creek, Kitchener, Waterloo, Cambridge.
     Buffalo NY and Montreal QC stay quoteOnly (cross-border / out-of-province).
  -------------------------------------------------------------------------- */

  var OUT_OF_TOWN = [
    { city: 'Alliston',       province: 'ON', rate: 75 },
    { city: 'Angus',          province: 'ON', rate: 80 },
    { city: 'Arthur',         province: 'ON', rate: 95 },
    { city: 'Barrie',         province: 'ON', rate: 110 },
    { city: 'Beamsville',     province: 'ON', rate: 90 },
    { city: 'Bolton',         province: 'ON', rate: 40 },
    { city: 'Bowmanville',    province: 'ON', rate: 80 },
    { city: 'Bracebridge',    province: 'ON', rate: 175 },
    { city: 'Bradford',       province: 'ON', rate: 70 },
    { city: 'Brantford',      province: 'ON', rate: 110 },
    { city: 'Buffalo',        province: 'NY', rate: 300, quoteOnly: true },
    { city: 'Caledon',        province: 'ON', rate: 50 },
    { city: 'Chatham',        province: 'ON', rate: 275 },
    { city: 'Cobourg',        province: 'ON', rate: 125 },
    { city: 'Collingwood',    province: 'ON', rate: 125 },
    { city: 'Cornwall',       province: 'ON', rate: 475 },
    { city: 'Elmira',         province: 'ON', rate: 100 },
    { city: 'Elmvale',        province: 'ON', rate: 95 },
    { city: 'Erin',           province: 'ON', rate: 70 },
    { city: 'Exeter',         province: 'ON', rate: 140 },
    { city: 'Fergus',         province: 'ON', rate: 100 },
    { city: 'Fort Erie',      province: 'ON', rate: 160 },
    { city: 'Goderich',       province: 'ON', rate: 200 },
    { city: 'Gravenhurst',    province: 'ON', rate: 175 },
    { city: 'Grimsby',        province: 'ON', rate: 90 },
    { city: 'Huntsville',     province: 'ON', rate: 275 },
    { city: 'Ingersoll',      province: 'ON', rate: 140 },
    { city: 'Keswick',        province: 'ON', rate: 110 },
    { city: 'Kingston',       province: 'ON', rate: 325 },
    { city: 'Leamington',     province: 'ON', rate: 350 },
    { city: 'London',         province: 'ON', rate: 190 },
    { city: 'Midland',        province: 'ON', rate: 140 },
    { city: 'Montreal',       province: 'QC', rate: 625, quoteOnly: true },
    { city: 'Niagara Falls',  province: 'ON', rate: 160 },
    { city: 'North Bay',      province: 'ON', rate: 500 },
    { city: 'Orillia',        province: 'ON', rate: 150 },
    { city: 'Owen Sound',     province: 'ON', rate: 185 },
    { city: 'Parry Sound',    province: 'ON', rate: 225 },
    { city: 'Pembroke',       province: 'ON', rate: 450 },
    { city: 'Peterborough',   province: 'ON', rate: 160 },
    { city: 'Port Colborne',  province: 'ON', rate: 160 },
    { city: 'Port Perry',     province: 'ON', rate: 100 },
    { city: 'Sarnia',         province: 'ON', rate: 290 },
    { city: 'Schomberg',      province: 'ON', rate: 60 },
    { city: 'Simcoe',         province: 'ON', rate: 115 },
    { city: 'St. Catharines', province: 'ON', rate: 110 },
    { city: 'St. Thomas',     province: 'ON', rate: 190 },
    { city: 'Stratford',      province: 'ON', rate: 135 },
    { city: 'Sudbury',        province: 'ON', rate: 600 },
    { city: 'Tillsonburg',    province: 'ON', rate: 325 },
    { city: 'Trenton',        province: 'ON', rate: 200 },
    { city: 'Uxbridge',       province: 'ON', rate: 95 },
    { city: 'Windsor',        province: 'ON', rate: 350 },
    { city: 'Woodstock',      province: 'ON', rate: 150 }
  ];

  var SERVICE_LEVELS = [
    { key: 'same_day', name: 'Same Day', time: 'Delivered by 5:00 PM',  book: 'Request by 11:30 AM' },
    { key: 'rush',     name: 'Rush',     time: '3-hour pickup & delivery',  book: 'After 11:30 AM' },
    { key: 'direct',   name: 'Direct',   time: '90-minute pickup & delivery', book: 'After 2:30 PM' }
  ];

  /* --- Helpers ------------------------------------------------------------- */

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function money(n) {
    return '$' + round2(n).toFixed(2);
  }

  function zoneById(id) {
    for (var i = 0; i < ZONES.length; i++) { if (ZONES[i].id === id) return ZONES[i]; }
    return null;
  }

  function zoneForCity(name) {
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].cities.indexOf(name) !== -1) return ZONES[i];
    }
    return null;
  }

  function outOfTownByCity(name) {
    var key = String(name).toLowerCase();
    for (var i = 0; i < OUT_OF_TOWN.length; i++) {
      if (OUT_OF_TOWN[i].city.toLowerCase() === key) return OUT_OF_TOWN[i];
    }
    return null;
  }

  /* Base rate for a zone and service level (before any distance charge). */
  function zoneRate(zone, service) {
    return round2(zone.same_day * (SETTINGS.serviceMultiplier[service] || 1));
  }

  /* --- Postal codes and distance ------------------------------------------ */

  // Centre point of each priced city = average of its postal areas.
  var CITY_CENTRE = (function () {
    var acc = {};
    if (!P) return acc;
    Object.keys(P.FSA).forEach(function (k) {
      var r = P.FSA[k], name = P.CITIES[r[0]];
      var a = acc[name] || (acc[name] = { lat: 0, lng: 0, n: 0 });
      a.lat += r[1]; a.lng += r[2]; a.n++;
    });
    Object.keys(acc).forEach(function (k) {
      acc[k] = { lat: acc[k].lat / acc[k].n, lng: acc[k].lng / acc[k].n };
    });
    return acc;
  })();

  var POSTAL_RE = /^([A-Z]\d[A-Z])(\d[A-Z]\d)?$/;

  function normalizePostal(text) {
    return String(text || '').toUpperCase().replace(/[\s-]+/g, '');
  }

  function canonicalCity(text) {
    var key = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/,\s*(on|ontario)$/, '');
    if (!key) return null;
    if (CITY_ALIASES[key]) return CITY_ALIASES[key];
    var all = cityNames();
    for (var i = 0; i < all.length; i++) {
      if (all[i].toLowerCase() === key) return all[i];
    }
    return null;
  }

  function cityNames() {
    var names = [];
    ZONES.forEach(function (z) { names = names.concat(z.cities); });
    OUT_OF_TOWN.forEach(function (o) { names.push(o.city); });
    return names;
  }

  function placeFromCity(name, extra) {
    var z = zoneForCity(name);
    var pt = CITY_CENTRE[name] || null;
    if (z) {
      return { kind: 'zone', zone: z, city: name,
               lat: extra && extra.lat != null ? extra.lat : (pt && pt.lat),
               lng: extra && extra.lng != null ? extra.lng : (pt && pt.lng),
               postal: extra && extra.postal || null };
    }
    var o = outOfTownByCity(name);
    if (o) {
      return { kind: 'oot', oot: o, city: o.city + (o.province !== 'ON' ? ', ' + o.province : ''),
               postal: extra && extra.postal || null };
    }
    return null;
  }

  /* Turn what the customer typed — a postal code ("L6W 4V4", "l6w") or a
     town name ("Brampton") — into a priced place.
     Returns null when empty, or { kind: 'zone' | 'oot' | 'unknown', ... }.  */
  function resolvePlace(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;

    var pc = normalizePostal(raw);
    var m = pc.match(POSTAL_RE);
    if (m) {
      var fsa = m[1];
      var pretty = m[2] ? fsa + ' ' + m[2] : fsa;
      var rec = P && P.FSA[fsa];
      if (rec) {
        return placeFromCity(P.CITIES[rec[0]], { lat: rec[1], lng: rec[2], postal: pretty });
      }
      return {
        kind: 'unknown', postal: pretty, rural: fsa.charAt(1) === '0',
        city: pretty
      };
    }

    var name = canonicalCity(raw);
    if (name) return placeFromCity(name);
    return { kind: 'unknown', city: raw };
  }

  function haversineKm(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* Estimated driving distance in whole km, or null if unknown. */
  function estimateKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    return Math.round(haversineKm(a, b) * SETTINGS.roadFactor);
  }

  /* Short label shown in the UI under an input, e.g. "Brampton · Zone 1". */
  function describePlace(place) {
    if (!place) return '';
    if (place.kind === 'zone') return place.city + ' · Zone ' + place.zone.id;
    if (place.kind === 'oot') return place.city + ' · Out of town';
    if (place.rural) return 'Rural postal code — please type the town name instead';
    return 'We don’t have a published rate for this location';
  }

  /* Back-compat for older code: list of every named place for suggestions. */
  function locationOptions() {
    var gta = [];
    ZONES.forEach(function (z) {
      z.cities.forEach(function (c) {
        gta.push({ value: c, city: c, zone: z.id, label: c + ' — Zone ' + z.id });
      });
    });
    gta.sort(function (a, b) { return a.city.localeCompare(b.city); });
    var oot = OUT_OF_TOWN.map(function (o) {
      var name = o.city + (o.province !== 'ON' ? ', ' + o.province : '');
      return { value: o.city, city: name, zone: null, label: name + ' — out of town' };
    });
    return { gta: gta, outOfTown: oot };
  }

  function parseLocation(value) { return resolvePlace(value); }

  /* --- Current time in America/Toronto ---- */

  function torontoNow(date) {
    var d = date || new Date();
    var parts;
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(d);
    } catch (e) {
      // Very old browser with no IANA tz data — fall back to local time.
      return {
        hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
        dow: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes(), approximate: true
      };
    }
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var hour = parseInt(map.hour, 10) % 24;
    var minute = parseInt(map.minute, 10);
    return {
      hour: hour,
      minute: minute,
      second: parseInt(map.second, 10),
      dow: dows[map.weekday] != null ? dows[map.weekday] : d.getDay(),
      minutes: hour * 60 + minute,
      approximate: false
    };
  }

  function fmtClock(minutesFromMidnight) {
    var h = Math.floor(minutesFromMidnight / 60);
    var m = minutesFromMidnight % 60;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  /* Which service level the clock suggests right now, and the message to show.
     Returns { suggested, state, message, minutesLeft }
     state: 'before-open' | 'same-day' | 'rush' | 'direct' | 'closed'          */
  function cutoffStatus(now) {
    var t = now || torontoNow();
    var isOpenDay = SETTINGS.openDays.indexOf(t.dow) !== -1;
    var mins = t.minutes;

    if (!isOpenDay) {
      var next = t.dow === 6 ? 'Monday' : 'tomorrow';
      return {
        suggested: 'same_day',
        state: 'closed',
        message: 'Closed today — we reopen ' + next + ' at ' + fmtClock(SETTINGS.openMin) +
                 '. Book online any time and we will call you back.',
        minutesLeft: null
      };
    }

    if (mins < SETTINGS.openMin) {
      return {
        suggested: 'same_day',
        state: 'before-open',
        message: 'We open at ' + fmtClock(SETTINGS.openMin) + ' — Same Day cutoff is ' +
                 fmtClock(SETTINGS.sameDayCutoffMin) + '. Book online now and we will call you first thing.',
        minutesLeft: SETTINGS.sameDayCutoffMin - mins
      };
    }

    if (mins < SETTINGS.sameDayCutoffMin) {
      var left = SETTINGS.sameDayCutoffMin - mins;
      return {
        suggested: 'same_day',
        state: 'same-day',
        message: "It's " + fmtClock(mins) + ' — ' + left + ' minute' + (left === 1 ? '' : 's') +
                 ' left to book Same Day',
        minutesLeft: left
      };
    }

    if (mins < SETTINGS.rushCutoffMin) {
      return {
        suggested: 'rush',
        state: 'rush',
        message: "It's " + fmtClock(mins) + ' — Same Day cutoff has passed. Rush (3 hours) available until ' +
                 fmtClock(SETTINGS.rushCutoffMin) + '.',
        minutesLeft: SETTINGS.rushCutoffMin - mins
      };
    }

    if (mins < SETTINGS.closeMin) {
      return {
        suggested: 'direct',
        state: 'direct',
        message: "It's " + fmtClock(mins) + ' — Direct (90 minutes) rates apply. Call us to confirm today’s delivery.',
        minutesLeft: SETTINGS.closeMin - mins
      };
    }

    return {
      suggested: 'same_day',
      state: 'closed',
      message: "We're closed for the day — we reopen at " + fmtClock(SETTINGS.openMin) +
               '. Book online now and we will call you first thing.',
      minutesLeft: null
    };
  }

  /* --- Base rate resolution ------------------------------------------------ */

  function unknownMessage(place) {
    if (place.rural) {
      return place.postal + ' is a rural postal code that covers a wide area. ' +
             'Type the town name instead, or call us and we will price it.';
    }
    return 'We don’t have a published rate for ' + place.city + '. ' +
           'Give us a call or send a quote request and we will price it for you.';
  }

  function resolveBase(from, to, service) {
    var notes = [];
    var mult = SETTINGS.serviceMultiplier[service] || 1;

    if (from.kind === 'unknown') return { ok: false, reason: 'contact', message: unknownMessage(from) };
    if (to.kind === 'unknown')   return { ok: false, reason: 'contact', message: unknownMessage(to) };

    // Both inside the three zones
    if (from.kind === 'zone' && to.kind === 'zone') {
      var a = from.zone, b = to.zone;
      var sameDayBase, basis, zoneUsed;

      if (a.id === b.id) {
        sameDayBase = SETTINGS.sameZoneRate;
        zoneUsed = a.id;
        basis = 'Within Zone ' + a.id;
      } else {
        var higher = (a.same_day >= b.same_day) ? a : b;
        sameDayBase = higher.same_day;
        zoneUsed = higher.id;
        basis = 'Zone ' + Math.min(a.id, b.id) + ' to Zone ' + Math.max(a.id, b.id);
      }

      var base = round2(sameDayBase * mult);
      if (mult !== 1) {
        basis += ', ' + money(sameDayBase) + ' × ' + mult;
      }

      // Distance charge — not multiplied for Rush / Direct
      var km = estimateKm(from, to);
      var extraKm = km == null ? 0 : Math.max(0, km - SETTINGS.includedKm);
      var distanceCharge = round2(extraKm * SETTINGS.perKmRate);

      return {
        ok: true,
        base: base,
        sameDayBase: sameDayBase,
        multiplier: mult,
        zoneUsed: zoneUsed,
        distanceKm: km,
        extraKm: extraKm,
        distanceCharge: distanceCharge,
        notes: notes,
        basis: basis
      };
    }

    // Both ends outside the zones — we have no rate for that.
    if (from.kind === 'oot' && to.kind === 'oot') {
      return {
        ok: false,
        reason: 'contact',
        message: 'Both ends of this trip are outside our three zones. We can absolutely quote it — ' +
                 'give us a call or send a quote request.'
      };
    }

    // One end out of town
    var oot = (from.kind === 'oot') ? from.oot : to.oot;

    if (oot.quoteOnly) {
      return {
        ok: false,
        reason: 'contact',
        message: oot.city + ' is a cross-border / out-of-province run with customs and liability ' +
                 'requirements we confirm case by case. Please call us for a price.'
      };
    }

    if (service !== 'same_day') {
      return {
        ok: false,
        reason: 'call',
        message: 'We publish Same Day rates for ' + oot.city + '. Rush and Direct outside our zones ' +
                 'are priced per job — call us for a rate.'
      };
    }

    return {
      ok: true,
      base: oot.rate,
      sameDayBase: oot.rate,
      multiplier: 1,
      zoneUsed: null,
      distanceKm: null,
      extraKm: 0,
      distanceCharge: 0,
      notes: notes,
      basis: 'Out-of-town flat rate — ' + oot.city
    };
  }

  /* --- The quote ----------------------------------------------------------- */

  function quote(input) {
    var from = resolvePlace(input.from);
    var to = resolvePlace(input.to);
    var service = input.service || 'same_day';
    var weight = Number(input.weightLbs);
    var pieces = input.pieces == null ? 1 : Number(input.pieces);
    var vanRequired = !!input.vanRequired;

    if (!from || !to) {
      return { ok: false, reason: 'incomplete', message: 'Enter a pickup and delivery postal code to see a price.' };
    }
    if (!isFinite(weight) || weight <= 0) {
      return { ok: false, reason: 'incomplete', message: 'Enter the total weight in pounds to see a price.' };
    }

    if (weight > SETTINGS.maxWeightLbs) {
      return {
        ok: false, reason: 'contact',
        message: 'Anything over ' + SETTINGS.maxWeightLbs + ' lbs is quoted individually — ' +
                 'that is usually a freight job rather than a courier run.'
      };
    }
    if (pieces > SETTINGS.maxPieces) {
      return {
        ok: false, reason: 'contact',
        message: 'More than ' + SETTINGS.maxPieces + ' pieces is quoted individually. Send us the details ' +
                 'and we will come back with a rate.'
      };
    }

    var baseResult = resolveBase(from, to, service);
    if (!baseResult.ok) return baseResult;

    // Weight surcharge, applies only ABOVE the threshold
    var billableWeight = Math.max(0, weight - SETTINGS.weightThresholdLbs);
    var weightSurcharge = round2(billableWeight * SETTINGS.perLbRate);

    // Van charge
    var vanCharge = vanRequired ? SETTINGS.vanCharge : 0;

    // Optional accessorials, $0.00 until switched on
    var distanceCharge = baseResult.distanceCharge || 0;
    var s = SETTINGS.surcharges;
    var preFuel = baseResult.base + distanceCharge + weightSurcharge + vanCharge;
    var fuel = round2(preFuel * (s.fuelPct || 0));
    var accessorials = round2(fuel + (s.waitTime || 0) + (s.afterHours || 0) + (s.extraStop || 0));

    // Totals. HST is rounded to cents, then added.
    var subtotal = round2(baseResult.base + distanceCharge + weightSurcharge + vanCharge + accessorials);
    var hst = round2(subtotal * SETTINGS.hstRate);
    var total = round2(subtotal + hst);

    function label(p) { return p.postal ? p.city + ' (' + p.postal + ')' : p.city; }

    return {
      ok: true,
      from: label(from),
      to: label(to),
      service: service,
      serviceName: (SERVICE_LEVELS.filter(function (l) { return l.key === service; })[0] || {}).name,
      basis: baseResult.basis,
      zoneUsed: baseResult.zoneUsed,
      base: round2(baseResult.base),
      multiplier: baseResult.multiplier,
      distanceKm: baseResult.distanceKm,
      extraKm: baseResult.extraKm,
      distanceCharge: round2(distanceCharge),
      uplift: 0,
      billableWeight: billableWeight,
      weightSurcharge: weightSurcharge,
      vanCharge: round2(vanCharge),
      fuel: fuel,
      accessorials: accessorials,
      subtotal: subtotal,
      hst: hst,
      hstRate: SETTINGS.hstRate,
      total: total,
      notes: baseResult.notes || []
    };
  }

  /* --- Export --------------------------------------------------------------- */

  root.BFRates = {
    SETTINGS: SETTINGS,
    ZONES: ZONES,
    OUT_OF_TOWN: OUT_OF_TOWN,
    SERVICE_LEVELS: SERVICE_LEVELS,
    quote: quote,
    round2: round2,
    money: money,
    zoneById: zoneById,
    zoneForCity: zoneForCity,
    zoneRate: zoneRate,
    outOfTownByCity: outOfTownByCity,
    cityNames: cityNames,
    resolvePlace: resolvePlace,
    describePlace: describePlace,
    estimateKm: estimateKm,
    locationOptions: locationOptions,
    parseLocation: parseLocation,
    torontoNow: torontoNow,
    cutoffStatus: cutoffStatus,
    fmtClock: fmtClock
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = root.BFRates; }

})(typeof window !== 'undefined' ? window : globalThis);
