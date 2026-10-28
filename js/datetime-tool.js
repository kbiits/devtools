DevTools.DateTimeTool = (function() {
  const MS = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 };
  const MAX_MS = 8.64e15; // ECMAScript Date range limit
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let clockTimer = null;

  // --- Mode-aware date helpers (local vs UTC calendar) ---

  function isUtc() {
    return document.getElementById('dt-zone-mode').value === 'utc';
  }

  function parts(d, utc) {
    return utc
      ? { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds(), wd: d.getUTCDay() }
      : { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds(), wd: d.getDay() };
  }

  function make(y, mo, d, h, mi, s, ms, utc) {
    if (utc) return new Date(Date.UTC(y, mo, d, h, mi, s, ms));
    const date = new Date(0);
    date.setFullYear(y, mo, d);
    date.setHours(h, mi, s, ms);
    return date;
  }

  function daysInMonth(y, mo) {
    return new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  }

  // Calendar month addition, clamping to the end of the month (Jan 31 + 1mo = Feb 28/29)
  function addMonths(date, n, utc) {
    const p = parts(date, utc);
    const total = p.y * 12 + p.mo + n;
    const y = Math.floor(total / 12);
    const mo = total - y * 12;
    return make(y, mo, Math.min(p.d, daysInMonth(y, mo)), p.h, p.mi, p.s, p.ms, utc);
  }

  function addDays(date, n, utc) {
    const p = parts(date, utc);
    return make(p.y, p.mo, p.d + n, p.h, p.mi, p.s, p.ms, utc);
  }

  function isValid(date) {
    const t = date.getTime();
    return !isNaN(t) && Math.abs(t) <= MAX_MS;
  }

  // --- Parsing ---

  function detectUnit(intDigits) {
    if (intDigits <= 11) return 's';
    if (intDigits <= 14) return 'ms';
    if (intDigits <= 17) return 'us';
    return 'ns';
  }

  function epochToMs(str, unit) {
    const negative = str.startsWith('-');
    const unsigned = negative ? str.slice(1) : str;
    const [intPart] = unsigned.split('.');
    if (!unit || unit === 'auto') unit = detectUnit(intPart.replace(/^0+/, '').length || 1);

    let ms;
    if ((unit === 'us' || unit === 'ns') && !unsigned.includes('.')) {
      // BigInt keeps precision for values beyond Number.MAX_SAFE_INTEGER
      ms = Number(BigInt(str) / (unit === 'us' ? 1000n : 1000000n));
    } else {
      const factor = { s: 1000, ms: 1, us: 0.001, ns: 0.000001 }[unit];
      ms = Math.floor(parseFloat(str) * factor);
    }
    return { date: new Date(ms), unit };
  }

  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

  // Accepts "now", epoch numbers, ISO-like dates, or anything Date.parse understands.
  // Dates without an explicit offset are read in the selected zone mode.
  function parseInput(raw, unit = 'auto') {
    const str = raw.trim();
    if (!str) return null;
    if (str.toLowerCase() === 'now') return { date: new Date(), kind: 'now' };

    if (/^-?\d+(\.\d+)?$/.test(str)) {
      const { date, unit: used } = epochToMs(str, unit);
      if (!isValid(date)) throw new Error('Epoch value is out of the supported date range');
      return { date, kind: 'epoch', unit: used };
    }

    const m = str.match(ISO_RE);
    if (m) {
      const [, y, mo, d, h = '0', mi = '0', s = '0', frac = '0', offset] = m;
      if (+mo < 1 || +mo > 12 || +d < 1 || +d > daysInMonth(+y, +mo - 1) || +h > 23 || +mi > 59 || +s > 59) {
        throw new Error(`Invalid date: "${str}"`);
      }
      const ms = Math.floor(Number('0.' + frac) * 1000);
      let date;
      if (offset) {
        date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms));
        if (offset.toUpperCase() !== 'Z') {
          const sign = offset[0] === '-' ? -1 : 1;
          const digits = offset.slice(1).replace(':', '');
          const offMin = sign * (parseInt(digits.slice(0, 2), 10) * 60 + parseInt(digits.slice(2), 10));
          date = new Date(date.getTime() - offMin * MS.minute);
        }
      } else {
        date = make(+y, +mo - 1, +d, +h, +mi, +s, ms, isUtc());
      }
      if (!isValid(date)) throw new Error(`Invalid date: "${str}"`);
      return { date, kind: 'date' };
    }

    const parsed = Date.parse(str);
    if (isNaN(parsed)) {
      throw new Error(`Could not parse "${str}". Try an epoch number, ISO 8601 (2026-10-29T14:30:00Z), or "now".`);
    }
    return { date: new Date(parsed), kind: 'date' };
  }

  // --- Formatting ---

  function pad(n, len = 2) {
    return String(Math.abs(n)).padStart(len, '0');
  }

  function isoWithOffset(date) {
    const p = parts(date, false);
    const off = -date.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}.${pad(p.ms, 3)}` +
      `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  }

  function formatInZone(date, timeZone) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone, year: 'numeric', month: 'short', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'longOffset'
    }).format(date);
  }

  function relative(date) {
    const diff = date.getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const units = [['year', 365.25 * MS.day], ['month', 30.44 * MS.day], ['week', MS.week], ['day', MS.day], ['hour', MS.hour], ['minute', MS.minute], ['second', MS.second]];
    for (const [name, size] of units) {
      if (Math.abs(diff) >= size || name === 'second') {
        return rtf.format(Math.round(diff / size), name);
      }
    }
  }

  function dayOfYear(date, utc) {
    const p = parts(date, utc);
    return Math.round((Date.UTC(p.y, p.mo, p.d) - Date.UTC(p.y, 0, 1)) / MS.day) + 1;
  }

  function isoWeek(date, utc) {
    const p = parts(date, utc);
    const t = new Date(Date.UTC(p.y, p.mo, p.d));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum); // Thursday of this week decides the year
    const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((t - yearStart) / MS.day + 1) / 7);
    return `${t.getUTCFullYear()}-W${pad(week)}`;
  }

  function describe(date, { full = true } = {}) {
    const ms = date.getTime();
    const utc = isUtc();
    const zoneLabel = utc ? 'UTC' : 'local';
    const rows = [
      ['Unix seconds', String(Math.floor(ms / 1000))],
      ['Unix milliseconds', String(ms)]
    ];
    if (full) {
      rows.push(['Unix microseconds', String(BigInt(ms) * 1000n)]);
      rows.push(['Unix nanoseconds', String(BigInt(ms) * 1000000n)]);
    }
    rows.push(['ISO 8601 (UTC)', date.toISOString()]);
    rows.push(['ISO 8601 (local)', isoWithOffset(date)]);
    if (full) rows.push(['RFC 7231 / HTTP', date.toUTCString()]);
    rows.push([`Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`, formatInZone(date, undefined)]);

    const extraZone = document.getElementById('dt-extra-zone').value;
    if (extraZone) rows.push([extraZone, formatInZone(date, extraZone)]);

    rows.push(['Relative', relative(date)]);
    if (full) {
      rows.push([`Day of week (${zoneLabel})`, WEEKDAYS[parts(date, utc).wd]]);
      rows.push([`Day of year (${zoneLabel})`, String(dayOfYear(date, utc))]);
      rows.push([`ISO week (${zoneLabel})`, isoWeek(date, utc)]);
    }
    return rows;
  }

  // --- Rendering ---

  function renderRows(containerId, rows) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 py-1.5 border-b border-gray-200 dark:border-gray-800 last:border-b-0';

      const labelEl = document.createElement('div');
      labelEl.className = 'w-44 shrink-0 text-xs text-gray-500 dark:text-gray-400';
      labelEl.textContent = label;

      const valueEl = document.createElement('div');
      valueEl.className = 'flex-1 min-w-0 font-mono text-xs break-words';
      valueEl.textContent = value;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs font-medium';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyWithFeedback(copyBtn, value));

      row.append(labelEl, valueEl, copyBtn);
      container.appendChild(row);
    });
  }

  function renderMessage(containerId, msg, isError) {
    const container = document.getElementById(containerId);
    const el = document.createElement('div');
    el.className = isError
      ? 'text-sm font-mono text-red-700 dark:text-red-300'
      : 'text-sm text-gray-500 dark:text-gray-400';
    el.textContent = msg;
    container.replaceChildren(el);
  }

  function copyWithFeedback(btn, text) {
    DevTools.copyToClipboard(text).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  }

  // --- Live clock ---

  function tick() {
    const now = Date.now();
    document.getElementById('dt-now-seconds').textContent = Math.floor(now / 1000);
    document.getElementById('dt-now-ms').textContent = now;
    document.getElementById('dt-now-iso').textContent = new Date(now).toISOString();
  }

  function startClock() {
    if (clockTimer) return;
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  // --- Converter ---

  function convert() {
    const input = document.getElementById('dt-convert-input').value;
    const unit = document.getElementById('dt-convert-unit').value;
    const detected = document.getElementById('dt-convert-detected');
    detected.textContent = '';

    try {
      const result = parseInput(input, unit);
      if (!result) {
        renderMessage('dt-convert-output', 'Enter an epoch timestamp or a date to convert.', false);
        return;
      }
      if (result.kind === 'epoch') {
        const names = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };
        detected.textContent = `Read as epoch ${names[result.unit]}`;
      } else {
        detected.textContent = 'Read as date';
      }
      renderRows('dt-convert-output', describe(result.date));
    } catch (e) {
      renderMessage('dt-convert-output', e.message, true);
    }
  }

  // --- Add / subtract ---

  function readAmount(id) {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? 0 : v;
  }

  function calculateAdd() {
    try {
      const start = parseInput(document.getElementById('dt-add-start').value || 'now');
      const sign = document.getElementById('dt-add-op').value === 'sub' ? -1 : 1;
      const utc = isUtc();

      // Calendar units step through the calendar; time units add exact elapsed time
      let date = start.date;
      const months = Math.trunc(readAmount('dt-add-years')) * 12 + Math.trunc(readAmount('dt-add-months'));
      if (months) date = addMonths(date, sign * months, utc);
      const days = Math.trunc(readAmount('dt-add-weeks')) * 7 + Math.trunc(readAmount('dt-add-days'));
      if (days) date = addDays(date, sign * days, utc);
      const elapsed = readAmount('dt-add-hours') * MS.hour + readAmount('dt-add-minutes') * MS.minute + readAmount('dt-add-seconds') * MS.second;
      date = new Date(date.getTime() + sign * Math.round(elapsed));

      if (!isValid(date)) throw new Error('Result is out of the supported date range');
      renderRows('dt-add-output', describe(date, { full: false }));
    } catch (e) {
      renderMessage('dt-add-output', e.message, true);
    }
  }

  // --- Difference ---

  function calendarDiff(a, b, utc) {
    // Assumes a <= b. Largest units first: months, then days, then exact time.
    const pa = parts(a, utc), pb = parts(b, utc);
    let months = (pb.y - pa.y) * 12 + (pb.mo - pa.mo);
    let cursor = addMonths(a, months, utc);
    if (cursor > b) cursor = addMonths(a, --months, utc);

    let days = Math.floor((b - cursor) / MS.day);
    while (days > 0 && addDays(cursor, days, utc) > b) days--;
    while (addDays(cursor, days + 1, utc) <= b) days++;
    cursor = addDays(cursor, days, utc);

    let rest = b - cursor;
    const hours = Math.floor(rest / MS.hour); rest -= hours * MS.hour;
    const minutes = Math.floor(rest / MS.minute); rest -= minutes * MS.minute;
    const seconds = Math.floor(rest / MS.second); rest -= seconds * MS.second;

    return { years: Math.floor(months / 12), months: months % 12, days, hours, minutes, seconds, ms: rest };
  }

  // Weekdays (Mon–Fri) in the half-open range [a, b), counted by calendar date
  function businessDays(a, b, utc) {
    const pa = parts(a, utc), pb = parts(b, utc);
    const start = Date.UTC(pa.y, pa.mo, pa.d);
    const totalDays = Math.round((Date.UTC(pb.y, pb.mo, pb.d) - start) / MS.day);
    const fullWeeks = Math.floor(totalDays / 7);
    let count = fullWeeks * 5;
    let wd = pa.wd;
    for (let i = 0; i < totalDays % 7; i++) {
      if (wd !== 0 && wd !== 6) count++;
      wd = (wd + 1) % 7;
    }
    return count;
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function formatNumber(n) {
    return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  function calculateDiff() {
    try {
      const fromInput = parseInput(document.getElementById('dt-diff-from').value || 'now');
      const toInput = parseInput(document.getElementById('dt-diff-to').value || 'now');
      const utc = isUtc();
      const negative = toInput.date < fromInput.date;
      const [a, b] = negative ? [toInput.date, fromInput.date] : [fromInput.date, toInput.date];
      const total = b - a;
      const sign = negative ? '-' : '';
      const c = calendarDiff(a, b, utc);

      const pieces = [];
      if (c.years) pieces.push(plural(c.years, 'year'));
      if (c.months) pieces.push(plural(c.months, 'month'));
      if (c.days) pieces.push(plural(c.days, 'day'));
      if (c.hours) pieces.push(plural(c.hours, 'hour'));
      if (c.minutes) pieces.push(plural(c.minutes, 'minute'));
      if (c.seconds) pieces.push(plural(c.seconds, 'second'));
      if (c.ms) pieces.push(`${c.ms} ms`);
      const human = pieces.length ? pieces.join(', ') : 'No difference';

      renderRows('dt-diff-output', [
        ['Direction', total === 0 ? 'Same instant' : negative ? '"To" is before "From"' : '"To" is after "From"'],
        ['Calendar', (negative && pieces.length ? '− ' : '') + human],
        ['Total weeks', sign + formatNumber(total / MS.week)],
        ['Total days', sign + formatNumber(total / MS.day)],
        ['Total hours', sign + formatNumber(total / MS.hour)],
        ['Total minutes', sign + formatNumber(total / MS.minute)],
        ['Total seconds', sign + formatNumber(total / MS.second)],
        ['Total milliseconds', sign + String(total)],
        ['Business days (Mon–Fri)', sign + businessDays(a, b, utc)]
      ]);
    } catch (e) {
      renderMessage('dt-diff-output', e.message, true);
    }
  }

  function recalcAll() {
    convert();
    calculateAdd();
    calculateDiff();
  }

  function populateZones() {
    const select = document.getElementById('dt-extra-zone');
    const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC'];
    zones.forEach(zone => {
      const opt = document.createElement('option');
      opt.value = zone;
      opt.textContent = zone;
      select.appendChild(opt);
    });
  }

  return {
    init() {
      populateZones();
      document.getElementById('dt-local-zone').textContent = `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;

      document.querySelectorAll('[data-dt-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
          copyWithFeedback(btn, document.getElementById(btn.dataset.dtCopy).textContent);
        });
      });

      document.getElementById('dt-zone-mode').addEventListener('change', recalcAll);
      document.getElementById('dt-extra-zone').addEventListener('change', recalcAll);

      document.getElementById('dt-convert-input').addEventListener('input', convert);
      document.getElementById('dt-convert-unit').addEventListener('change', convert);
      document.getElementById('btn-dt-convert-now').addEventListener('click', () => {
        document.getElementById('dt-convert-input').value = String(Math.floor(Date.now() / 1000));
        convert();
      });

      document.querySelectorAll('[data-dt-add]').forEach(el => {
        el.addEventListener('input', calculateAdd);
        el.addEventListener('change', calculateAdd);
      });
      document.getElementById('btn-dt-add-reset').addEventListener('click', () => {
        document.querySelectorAll('input[data-dt-add]').forEach(el => {
          if (el.type === 'number') el.value = '';
        });
        calculateAdd();
      });

      document.querySelectorAll('[data-dt-diff]').forEach(el => el.addEventListener('input', calculateDiff));
      document.getElementById('btn-dt-diff-swap').addEventListener('click', () => {
        const from = document.getElementById('dt-diff-from');
        const to = document.getElementById('dt-diff-to');
        [from.value, to.value] = [to.value, from.value];
        calculateDiff();
      });

      recalcAll();
    },
    onShow: startClock,
    onHide: stopClock
  };
})();
