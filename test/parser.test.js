import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseDepartures } from '../api/departure.js';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/departures.html', import.meta.url)),
  'utf8'
);

test('parses every departure row from a real page snapshot', () => {
  const departures = parseDepartures(fixture);

  assert.equal(departures.length, 5);
  assert.deepEqual(departures[0], {
    service: 'X3',
    destination: "Addenbrooke's",
    time: 'Due',
  });
  assert.deepEqual(departures[4], {
    service: 'PR3',
    destination: 'Trumpington P&R',
    time: '9 Mins',
  });
});

test('decodes entities and trims surrounding whitespace', () => {
  const { destination } = parseDepartures(fixture)[4];
  assert.equal(destination, 'Trumpington P&R'); // was "Trumpington P&amp;R"

  for (const dep of parseDepartures(fixture)) {
    for (const value of Object.values(dep)) {
      assert.equal(value, value.trim());
    }
  }
});

test('caps the result at the limit (default 5)', () => {
  const rows = Array.from(
    { length: 8 },
    (_, i) =>
      `<tr class="gridRow">
        <td class="gridServiceItem">${i}</td>
        <td class="gridDestinationItem"><span>Dest ${i}</span></td>
        <td class="gridTimeItem">${i} Mins</td>
      </tr>`
  ).join('');
  const html = `<table id="gridViewRTI">${rows}</table>`;

  assert.equal(parseDepartures(html).length, 5);
  assert.equal(parseDepartures(html, 3).length, 3);
  assert.equal(parseDepartures(html, 20).length, 8);
});

test('returns fewer rows when the page has fewer departures', () => {
  const html = `<table id="gridViewRTI">
    <tr class="gridRow">
      <td class="gridServiceItem">1</td>
      <td class="gridDestinationItem"><span>Somewhere</span></td>
      <td class="gridTimeItem">Due</td>
    </tr>
  </table>`;

  assert.deepEqual(parseDepartures(html), [
    { service: '1', destination: 'Somewhere', time: 'Due' },
  ]);
});

test('tolerates a row with missing cells without throwing', () => {
  const html = `<table id="gridViewRTI"><tr class="gridRow"></tr></table>`;

  assert.deepEqual(parseDepartures(html), [
    { service: '', destination: '', time: '' },
  ]);
});

test('returns an empty array when the expected markup is absent', () => {
  assert.deepEqual(parseDepartures(''), []);
  assert.deepEqual(
    parseDepartures('<html><body><p>Service unavailable</p></body></html>'),
    []
  );
  // Right rows, wrong container id - a plausible shape after a redesign.
  assert.deepEqual(
    parseDepartures('<table id="departures"><tr class="gridRow"></tr></table>'),
    []
  );
});
