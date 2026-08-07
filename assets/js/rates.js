/* ==========================================================================
   BF LOGISTICS — Rate tables and pricing engine
   Source of truth: client rate card (bflogictics price chart.docx) and the
   printed "Same Day - Out of Town Rates" sheet. Blueprint v2 §9.
   --------------------------------------------------------------------------
   ⚠ PORTING NOTE
   On the static build this file is served to the browser, so the rate table is
   publicly readable. Blueprint §12 calls for the calculator to run SERVER-SIDE.
   This file is deliberately self-contained and free of DOM references so it can
   be dropped into a Next.js route handler (e.g. app/api/quote/route.ts) without
   modification — the client would then POST inputs and receive only the result.
   ========================================================================== */

(function (root) {
  'use strict';

  /* --- Settings — every value here becomes an admin-editable field (§5.2 G) - */

  var SETTINGS = {
    weightThresholdLbs: 30,     // surcharge applies only ABOVE this
    perLbRate: 0.15,
    vanCharge: 15.00,
    hstRate: 0.13,

    // Issue 1 resolution (confirmed): neither end in Zone 1 -> higher zone + uplift
    interZoneUplift: 10.00,

    // Cutoffs, in America/Toronto. Minutes from midnight.
    sameDayCutoffMin: 11 * 60 + 30,   // 11:30 AM
    rushCutoffMin: 14 * 60 + 30,      // 2:30 PM

    // Business hours (confirmed): Mon-Fri 10:00-17:00, closed Sat/Sun
    openMin: 10 * 60,
    closeMin: 17 * 60,
    openDays: [1, 2, 3, 4, 5],

    // Hard stops -> "Contact us" (§9.6 rule 5)
    maxWeightLbs: 500,
    maxPieces: 10,

    // Optional accessorials, all default $0.00 until switched on (§9.3)
    surcharges: {
      fuelPct: 0,        // fraction of subtotal, e.g. 0.12
      waitTime: 0,       // flat $
      afterHours: 0,     // flat $
      extraStop: 0       // flat $ per extra stop
    }
  };

  /* --- Zone matrix — rate card, verbatim (§9.2) ---------------------------- */

  var ZONES = [
    { id: 1,  label: 'Brampton / Mississauga', cities: ['Brampton', 'Mississauga'],   same_day: 18, rush: 22, direct: 28 },
    { id: 2,  label: 'Toronto / Scarborough',  cities: ['Toronto', 'Scarborough'],    same_day: 21, rush: 32, direct: 38 },
    { id: 3,  label: 'Vaughan',                cities: ['Vaughan'],                   same_day: 22, rush: 34, direct: 40 },
    { id: 4,  label: 'Markham',                cities: ['Markham'],                   same_day: 25, rush: 36, direct: 42 },
    { id: 5,  label: 'Richmond Hill',          cities: ['Richmond Hill'],             same_day: 30, rush: 42, direct: 48 },
    { id: 6,  label: 'Aurora / Newmarket',     cities: ['Aurora', 'Newmarket'],       same_day: 35, rush: 45, direct: 51 },
    { id: 7,  label: 'Oakville / Georgetown',  cities: ['Oakville', 'Georgetown'],    same_day: 30, rush: 40, direct: 50 },
    { id: 8,  label: 'Burlington / Milton',    cities: ['Burlington', 'Milton'],      same_day: 35, rush: 45, direct: 55 },
    { id: 9,  label: 'Pickering / Ajax',       cities: ['Pickering', 'Ajax'],         same_day: 40, rush: 50, direct: 60 },
    { id: 10, label: 'Whitby / Oshawa',        cities: ['Whitby', 'Oshawa'],          same_day: 46, rush: 56, direct: 66 }
  ];

  /* --- Out-of-town flat rates, Same Day only (§9.4) ------------------------
     Transcribed from the printed sheet and verified against the photograph.
     Sheet spellings corrected: Coburg -> Cobourg, Huntville -> Huntsville,
     Exter -> Exeter, St. Catherines -> St. Catharines.

     Whitby ($60) and Oshawa ($70) appear on the printed sheet but are ALSO in
     the zone table at $46. Issue 2 resolution (confirmed): the zone table wins
     for anything inside the 10 GTA zones, so both are omitted here and price
     at $46 as Zone 10.

     Buffalo NY and Montreal QC are marked quoteOnly: cross-border / out-of-
     province, different liability and customs profile (§9.4 note).
  -------------------------------------------------------------------------- */

  var OUT_OF_TOWN = [
    { city: 'Acton',          province: 'ON', rate: 60 },
    { city: 'Alliston',       province: 'ON', rate: 75 },
    { city: 'Ancaster',       province: 'ON', rate: 85 },
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
    { city: 'Cambridge',      province: 'ON', rate: 95 },
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
    { city: 'Guelph',         province: 'ON', rate: 80 },
    { city: 'Hamilton',       province: 'ON', rate: 80 },
    { city: 'Huntsville',     province: 'ON', rate: 275 },
    { city: 'Ingersoll',      province: 'ON', rate: 140 },
    { city: 'Keswick',        province: 'ON', rate: 110 },
    { city: 'Kingston',       province: 'ON', rate: 325 },
    { city: 'Kitchener',      province: 'ON', rate: 100 },
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
    { city: 'Stoney Creek',   province: 'ON', rate: 80 },
    { city: 'Stratford',      province: 'ON', rate: 135 },
    { city: 'Sudbury',        province: 'ON', rate: 600 },
    { city: 'Tillsonburg',    province: 'ON', rate: 325 },
    { city: 'Trenton',        province: 'ON', rate: 200 },
    { city: 'Uxbridge',       province: 'ON', rate: 95 },
    { city: 'Waterloo',       province: 'ON', rate: 100 },
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

  function outOfTownByCity(name) {
    var key = String(name).toLowerCase();
    for (var i = 0; i < OUT_OF_TOWN.length; i++) {
      if (OUT_OF_TOWN[i].city.toLowerCase() === key) return OUT_OF_TOWN[i];
    }
    return null;
  }

  /* Flat list of every selectable origin/destination, for the dropdowns.
     Value format:  "z:<zoneId>:<City>"  or  "o:<City>"                       */
  function locationOptions() {
    var gta = [];
    ZONES.forEach(function (z) {
      z.cities.forEach(function (c) {
        gta.push({ value: 'z:' + z.id + ':' + c, city: c, zone: z.id, label: c + ' — Zone ' + z.id });
      });
    });
    gta.sort(function (a, b) { return a.city.localeCompare(b.city); });

    var oot = OUT_OF_TOWN.map(function (o) {
      var name = o.city + (o.province !== 'ON' ? ', ' + o.province : '');
      return { value: 'o:' + o.city, city: name, zone: null, label: name };
    });

    return { gta: gta, outOfTown: oot };
  }

  function parseLocation(value) {
    if (!value) return null;
    var parts = String(value).split(':');
    if (parts[0] === 'z') {
      var z = zoneById(parseInt(parts[1], 10));
      if (!z) return null;
      return { kind: 'zone', zone: z, city: parts.slice(2).join(':') || z.label };
    }
    if (parts[0] === 'o') {
      var o = outOfTownByCity(parts.slice(1).join(':'));
      if (!o) return null;
      return { kind: 'oot', oot: o, city: o.city + (o.province !== 'ON' ? ', ' + o.province : '') };
    }
    return null;
  }

  /* --- Current time in America/Toronto (§9.6 rule 2, QA: not visitor TZ) ---- */

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

  /* --- Base rate resolution (§9.5 STEP 1) ---------------------------------- */

  function resolveBase(from, to, service) {
    var notes = [];

    // Both inside the 10 GTA zones
    if (from.kind === 'zone' && to.kind === 'zone') {
      var a = from.zone, b = to.zone;

      if (a.id === 1 || b.id === 1) {
        // Matches the rate card exactly: "For deliveries to and from Zone 1."
        var other = (a.id === 1) ? b : a;
        return {
          ok: true,
          base: other[service],
          zoneUsed: other.id,
          notes: notes,
          basis: 'Zone ' + other.id + ', ' + other.label
        };
      }

      // Neither end is Zone 1 — Issue 1 rule (confirmed).
      // Base stays the raw zone rate; the uplift is a separate, visible line.
      var higher = (a[service] >= b[service]) ? a : b;
      notes.push('Neither end of this trip is Zone 1, so the higher zone rate applies plus a ' +
                 money(SETTINGS.interZoneUplift) + ' inter-zone uplift.');
      return {
        ok: true,
        base: higher[service],
        zoneUsed: higher.id,
        uplift: SETTINGS.interZoneUplift,
        notes: notes,
        basis: 'Zone ' + higher.id + ', ' + higher.label
      };
    }

    // Both ends outside the GTA zones — we have no rate for that.
    if (from.kind === 'oot' && to.kind === 'oot') {
      return {
        ok: false,
        reason: 'contact',
        message: 'Both ends of this trip are outside the GTA. We can absolutely quote it — ' +
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

    // Issue 3 rule (confirmed): out-of-town publishes Same Day only.
    if (service !== 'same_day') {
      return {
        ok: false,
        reason: 'call',
        message: 'We publish Same Day rates for ' + oot.city + '. Rush and Direct outside the GTA ' +
                 'are priced per job — call us for a rate.'
      };
    }

    return {
      ok: true,
      base: oot.rate,
      zoneUsed: null,
      notes: notes,
      basis: 'Out-of-town flat rate — ' + oot.city
    };
  }

  /* --- The quote (§9.5) ----------------------------------------------------- */

  function quote(input) {
    var from = parseLocation(input.from);
    var to = parseLocation(input.to);
    var service = input.service || 'same_day';
    var weight = Number(input.weightLbs);
    var pieces = input.pieces == null ? 1 : Number(input.pieces);
    var vanRequired = !!input.vanRequired;

    if (!from || !to) {
      return { ok: false, reason: 'incomplete', message: 'Choose a pickup and delivery location to see a price.' };
    }
    if (!isFinite(weight) || weight <= 0) {
      return { ok: false, reason: 'incomplete', message: 'Enter the total weight in pounds to see a price.' };
    }

    // Hard stops (§9.6 rule 5)
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

    // STEP 2 — weight surcharge, applies only ABOVE the threshold
    var billableWeight = Math.max(0, weight - SETTINGS.weightThresholdLbs);
    var weightSurcharge = round2(billableWeight * SETTINGS.perLbRate);

    // STEP 3 — van charge
    var vanCharge = vanRequired ? SETTINGS.vanCharge : 0;

    // STEP 4 — optional accessorials, $0.00 until switched on
    var uplift = baseResult.uplift || 0;
    var s = SETTINGS.surcharges;
    var preFuel = baseResult.base + uplift + weightSurcharge + vanCharge;
    var fuel = round2(preFuel * (s.fuelPct || 0));
    var accessorials = round2(fuel + (s.waitTime || 0) + (s.afterHours || 0) + (s.extraStop || 0));

    // STEP 5 — totals. HST is rounded to cents, then added (matches §9.5 worked examples).
    var subtotal = round2(baseResult.base + uplift + weightSurcharge + vanCharge + accessorials);
    var hst = round2(subtotal * SETTINGS.hstRate);
    var total = round2(subtotal + hst);

    return {
      ok: true,
      from: from.city,
      to: to.city,
      service: service,
      serviceName: (SERVICE_LEVELS.filter(function (l) { return l.key === service; })[0] || {}).name,
      basis: baseResult.basis,
      zoneUsed: baseResult.zoneUsed,
      base: round2(baseResult.base),
      uplift: round2(uplift),
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
    outOfTownByCity: outOfTownByCity,
    locationOptions: locationOptions,
    parseLocation: parseLocation,
    torontoNow: torontoNow,
    cutoffStatus: cutoffStatus,
    fmtClock: fmtClock
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = root.BFRates; }

})(typeof window !== 'undefined' ? window : globalThis);
