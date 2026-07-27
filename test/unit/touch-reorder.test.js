import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { insertionIndexFor, autoscrollDelta } from '../../client/utils/touch-reorder.js';

// Four 50px rows stacked from y=100, as they'd be measured mid-drag with the
// dragged row already excluded.
const ROWS = [
    { top: 100, height: 50 }, // midpoint 125
    { top: 150, height: 50 }, // midpoint 175
    { top: 200, height: 50 }, // midpoint 225
    { top: 250, height: 50 }, // midpoint 275
];

describe('insertionIndexFor', () => {
    test('lands before the first row whose midpoint the pointer is above', () => {
        assert.equal(insertionIndexFor(ROWS, 124), 0);
        assert.equal(insertionIndexFor(ROWS, 174), 1);
        assert.equal(insertionIndexFor(ROWS, 224), 2);
        assert.equal(insertionIndexFor(ROWS, 274), 3);
    });

    test('crossing a midpoint moves the slot past that row', () => {
        assert.equal(insertionIndexFor(ROWS, 125), 1);
        assert.equal(insertionIndexFor(ROWS, 175), 2);
    });

    test('past the last midpoint appends', () => {
        assert.equal(insertionIndexFor(ROWS, 275), ROWS.length);
        assert.equal(insertionIndexFor(ROWS, 10000), ROWS.length);
    });

    test('above every row lands at the top', () => {
        assert.equal(insertionIndexFor(ROWS, 0), 0);
        assert.equal(insertionIndexFor(ROWS, -500), 0); // scrolled past the top
    });

    test('an empty category accepts the row at index 0', () => {
        assert.equal(insertionIndexFor([], 400), 0);
    });

    test('rows of differing heights use their own midpoints', () => {
        const ragged = [
            { top: 0, height: 20 }, // midpoint 10
            { top: 20, height: 200 }, // midpoint 120
        ];
        assert.equal(insertionIndexFor(ragged, 9), 0);
        assert.equal(insertionIndexFor(ragged, 11), 1);
        assert.equal(insertionIndexFor(ragged, 119), 1);
        assert.equal(insertionIndexFor(ragged, 121), 2);
    });
});

describe('autoscrollDelta', () => {
    const VIEWPORT = 800;

    test('is inert away from the edges', () => {
        assert.equal(autoscrollDelta(400, VIEWPORT), 0);
        assert.equal(autoscrollDelta(72, VIEWPORT), 0);
        assert.equal(autoscrollDelta(728, VIEWPORT), 0);
    });

    test('scrolls up near the top and down near the bottom', () => {
        assert.ok(autoscrollDelta(20, VIEWPORT) < 0, 'top edge should scroll up');
        assert.ok(autoscrollDelta(780, VIEWPORT) > 0, 'bottom edge should scroll down');
    });

    test('ramps with depth into the edge zone', () => {
        const shallow = Math.abs(autoscrollDelta(60, VIEWPORT));
        const deep = Math.abs(autoscrollDelta(10, VIEWPORT));
        assert.ok(deep > shallow, 'deeper into the zone should scroll faster');
    });

    test('is symmetric at equal depth', () => {
        assert.equal(autoscrollDelta(30, VIEWPORT), -autoscrollDelta(VIEWPORT - 30, VIEWPORT));
    });

    test('clamps past the viewport edges', () => {
        // A finger dragged off the top reports negative clientY; the ramp must
        // saturate rather than accelerate without bound.
        const atEdge = Math.abs(autoscrollDelta(0, VIEWPORT));
        assert.equal(Math.abs(autoscrollDelta(-200, VIEWPORT)), atEdge);
        assert.equal(Math.abs(autoscrollDelta(VIEWPORT + 200, VIEWPORT)), atEdge);
    });
});
