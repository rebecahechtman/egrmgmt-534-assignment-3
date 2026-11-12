const $ = (id) => document.getElementById(id);
const fmt = (n, digits = 2) => Number(n).toFixed(digits);
const signed = (n, digits = 1) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), digits)}`;
const monthName = (month) => new Date(`${month}-02T12:00:00`).toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
let rows = [];
let range = '2019-2025';

function correlation(data) {
  const pairs = data.slice(1).map((row, i) => [row.term_premium_pct - data[i].term_premium_pct, row.mortgage_rate_pct - data[i].mortgage_rate_pct]);
  const n = pairs.length;
  const x = pairs.reduce((sum, pair) => sum + pair[0], 0) / n;
  const y = pairs.reduce((sum, pair) => sum + pair[1], 0) / n;
  const numerator = pairs.reduce((sum, pair) => sum + (pair[0] - x) * (pair[1] - y), 0);
  const vx = pairs.reduce((sum, pair) => sum + (pair[0] - x) ** 2, 0);
  const vy = pairs.reduce((sum, pair) => sum + (pair[1] - y) ** 2, 0);
  return {value: numerator / Math.sqrt(vx * vy), n};
}

function selectedRows() {
  if (range === '2023') return rows.filter(row => row.month.startsWith('2023'));
  if (range === '2019-2025') return rows.filter(row => row.month <= '2025-12');
  return rows;
}

function svgChart(data, series, rightSeries = null) {
  const W = 1000, H = 270, left = 58, right = rightSeries ? 60 : 24, top = 15, bottom = 36;
  const width = W - left - right, height = H - top - bottom;
  const x = i => left + (i / (data.length - 1)) * width;
  const limits = (field, fixed = false) => {
    if (fixed) return [0, 9];
    const values = data.map(row => row[field]);
    const min = Math.min(...values), max = Math.max(...values), pad = Math.max((max - min) * .15, .05);
    return [min - pad, max + pad];
  };
  const leftLimits = limits(series[0].field, series[0].fixed);
  const rightLimits = rightSeries ? limits(rightSeries.field) : leftLimits;
  const y = (value, lim) => top + (lim[1] - value) / (lim[1] - lim[0]) * height;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
  for (let i = 0; i <= 4; i++) {
    const yy = top + i * height / 4;
    const l = leftLimits[1] - i * (leftLimits[1] - leftLimits[0]) / 4;
    svg += `<line x1="${left}" y1="${yy}" x2="${W-right}" y2="${yy}" stroke="#e4e9e7" stroke-dasharray="3 5"/>`;
    svg += `<text x="${left-10}" y="${yy+4}" text-anchor="end" fill="#64736f" font-size="11">${fmt(l,1)}${series[0].unit}</text>`;
    if (rightSeries) {
      const r = rightLimits[1] - i * (rightLimits[1] - rightLimits[0]) / 4;
      svg += `<text x="${W-right+10}" y="${yy+4}" fill="#64736f" font-size="11">${fmt(r,1)}%</text>`;
    }
  }
  const tickIndices = data.length > 12 ? data.flatMap((row, i) => row.month.endsWith('-01') ? [i] : []) : data.map((_,i) => i);
  for (const i of tickIndices) svg += `<text x="${x(i)}" y="${H-10}" text-anchor="middle" fill="#64736f" font-size="11">${data.length > 12 ? data[i].month.slice(0,4) : monthName(data[i].month).slice(0,3)}</text>`;
  for (const entry of [...series, ...(rightSeries ? [rightSeries] : [])]) {
    const lim = entry === rightSeries ? rightLimits : leftLimits;
    const path = data.map((row, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(row[entry.field],lim).toFixed(2)}`).join(' ');
    svg += `<path d="${path}" fill="none" stroke="${entry.color}" stroke-width="2.6" vector-effect="non-scaling-stroke"/>`;
  }
  return svg + '</svg>';
}

function renderHistory() {
  const shown = selectedRows(), last = shown.at(-1);
  $('metric-premium').innerHTML = `${fmt(last.term_premium_pct)}<small>%</small>`;
  $('metric-duration').innerHTML = `${fmt(last.modified_duration_years)}<small>years</small>`;
  $('metric-mortgage').innerHTML = `${fmt(last.mortgage_rate_pct)}<small>%</small>`;
  $('metric-date').textContent = monthName(last.month);
  $('risk-chart').innerHTML = svgChart(shown, [{field:'modified_duration_years', color:'#8170ac', unit:''}], {field:'term_premium_pct', color:'#17766a', unit:'%'});
  $('rates-chart').innerHTML = svgChart(shown, [{field:'mortgage_rate_pct', color:'#bc6a38', unit:'%', fixed:true}, {field:'treasury_yield_pct', color:'#17766a', unit:'%', fixed:true}]);
  $('data-table').innerHTML = shown.map(row => `<tr><td>${monthName(row.month)}</td><td>${fmt(row.term_premium_pct,3)}</td><td>${fmt(row.modified_duration_years,3)}</td><td>${fmt(row.treasury_yield_pct,3)}</td><td>${fmt(row.mortgage_rate_pct,3)}</td></tr>`).join('');
}

function renderComparison() {
  const start = $('start-month').value, end = $('end-month').value;
  const a = rows.find(row => row.month === start), b = rows.find(row => row.month === end);
  const valid = a && b && start < end;
  $('finding').hidden = !valid;
  if (!valid) { $('compare-results').innerHTML = '<p class="selection-error" role="alert">Choose an ending month after the starting month.</p>'; return; }
  const tp = (b.term_premium_pct - a.term_premium_pct) * 100;
  const mortgage = (b.mortgage_rate_pct - a.mortgage_rate_pct) * 100;
  const treasury = (b.treasury_yield_pct - a.treasury_yield_pct) * 100;
  $('compare-results').innerHTML = `<div class="change-row"><span>10-year term premium</span><strong>${signed(tp)}<small>bp</small></strong></div><div class="change-row mortgage"><span>30-year mortgage rate</span><strong>${signed(mortgage)}<small>bp</small></strong></div><div class="change-row compact"><span>10-year Treasury yield</span><strong>${signed(treasury)} bp</strong></div><p class="basis-note">1 basis point (bp) = 0.01 percentage point.</p>`;
  const move = (b.term_premium_pct - a.term_premium_pct) * (b.mortgage_rate_pct - a.mortgage_rate_pct) > 0 ? 'Both measures moved in the same direction in this window' : 'The two measures did not move in the same direction in this window';
  $('finding-text').textContent = `From ${monthName(start)} to ${monthName(end)}, the monthly average 10-year Treasury term premium ${tp >= 0 ? 'rose' : 'fell'} from ${fmt(a.term_premium_pct)}% to ${fmt(b.term_premium_pct)}% (${signed(tp)} basis points). Over the same window, the U.S. 30-year fixed mortgage rate ${mortgage >= 0 ? 'rose' : 'fell'} from ${fmt(a.mortgage_rate_pct)}% to ${fmt(b.mortgage_rate_pct)}% (${signed(mortgage)} basis points). ${move}; this comparison does not establish causation.`;
}

fetch('./data.json').then(response => {
  if (!response.ok) throw Error('Data unavailable');
  return response.json();
}).then(data => {
  rows = data.monthly.filter(row => ['treasury_yield_pct','term_premium_pct','mortgage_rate_pct','modified_duration_years'].every(field => Number.isFinite(row[field])));
  if (!rows.length) throw Error('No observations');
  for (const id of ['start-month','end-month']) $('' + id).innerHTML = rows.map(row => `<option value="${row.month}">${monthName(row.month)}</option>`).join('');
  $('start-month').value = '2023-07'; $('end-month').value = '2023-10';
  const sample = correlation(rows.filter(row => row.month >= '2019-01' && row.month <= '2025-12'));
  $('correlation').textContent = fmt(sample.value); $('correlation-count').textContent = sample.n;
  $('load-status').hidden = true; $('analysis').hidden = false;
  renderHistory(); renderComparison();
  for (const button of document.querySelectorAll('[data-range]')) button.addEventListener('click', () => {
    range = button.dataset.range;
    for (const other of document.querySelectorAll('[data-range]')) { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); }
    renderHistory();
  });
  $('start-month').addEventListener('change', renderComparison);
  $('end-month').addEventListener('change', renderComparison);
}).catch(() => { $('load-status').textContent = 'The data could not be loaded. Please refresh to try again.'; });
