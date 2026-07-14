import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import weightUtils from '../../client/utils/weight.js';

const { WeightToMg, MgToWeight } = weightUtils;

describe('WeightToMg', () => {
    test('converts each supported unit to milligrams', () => {
        assert.equal(WeightToMg(1, 'g'), 1000);
        assert.equal(WeightToMg(1, 'kg'), 1000000);
        assert.equal(WeightToMg(1, 'oz'), 28349.5);
        assert.equal(WeightToMg(1, 'lb'), 453592);
    });

    test('returns undefined for an unknown unit', () => {
        assert.equal(WeightToMg(1, 'stone'), undefined);
    });
});

describe('MgToWeight', () => {
    test('converts milligrams to each supported unit', () => {
        assert.equal(MgToWeight(1000, 'g'), 1);
        assert.equal(MgToWeight(1000000, 'kg'), 1);
        assert.equal(MgToWeight(28349.5, 'oz'), 1);
        assert.equal(MgToWeight(453592, 'lb'), 1);
    });

    test('rounds the display value to two decimals', () => {
        assert.equal(MgToWeight(500, 'g'), 0.5);
        assert.equal(MgToWeight(1005, 'g'), 1.01); // 100.5 rounds up
        assert.equal(MgToWeight(1004, 'g'), 1); // 100.4 rounds down
    });

    test('returns undefined for an unknown unit', () => {
        assert.equal(MgToWeight(1000, 'stone'), undefined);
    });
});

describe('roundtrip', () => {
    test('author weight survives WeightToMg -> MgToWeight', () => {
        assert.equal(MgToWeight(WeightToMg(2.5, 'lb'), 'lb'), 2.5);
        assert.equal(MgToWeight(WeightToMg(48, 'oz'), 'oz'), 48);
        assert.equal(MgToWeight(WeightToMg(0.75, 'kg'), 'kg'), 0.75);
    });
});
