import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import weightUtils from '../../client/utils/weight.js';

const { WeightToMg, MgToWeight, MgToDisplayWeight } = weightUtils;

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

describe('MgToDisplayWeight', () => {
    test('leaves every unit but grams exactly as MgToWeight had it', () => {
        for (const unit of ['kg', 'oz', 'lb']) {
            for (const mg of [400, 34019.4, 446504.625, 5597325.28]) {
                assert.equal(MgToDisplayWeight(mg, unit), MgToWeight(mg, unit));
            }
        }
    });

    test('drops the invented decimals when another unit is read as grams', () => {
        assert.equal(MgToWeight(WeightToMg(1.2, 'oz'), 'g'), 34.02); // before
        assert.equal(MgToDisplayWeight(WeightToMg(1.2, 'oz'), 'g'), 34);

        assert.equal(MgToDisplayWeight(WeightToMg(15.75, 'oz'), 'g'), 447);
        assert.equal(MgToDisplayWeight(WeightToMg(12.34, 'lb'), 'g'), 5597);
    });

    test('rounds to the nearest gram', () => {
        assert.equal(MgToDisplayWeight(60, 'g'), 0); // under 1g: two decimals
        assert.equal(MgToDisplayWeight(34060, 'g'), 34); // 1-100g: one decimal
        assert.equal(MgToDisplayWeight(999500, 'g'), 1000); // 100g up: whole grams
    });

    test('holds the boundaries', () => {
        assert.equal(MgToDisplayWeight(999, 'g'), 1); // 0.999 -> 1.0
        assert.equal(MgToDisplayWeight(1000, 'g'), 1);
        assert.equal(MgToDisplayWeight(99950, 'g'), 100); // 99.95 -> 100.0
        assert.equal(MgToDisplayWeight(100000, 'g'), 100);
    });

    test('a zero weight stays zero, not a rounding artefact', () => {
        assert.equal(MgToDisplayWeight(0, 'g'), 0);
    });

    test('returns undefined for an unknown unit', () => {
        assert.equal(MgToDisplayWeight(1000, 'stone'), undefined);
    });
});

describe('roundtrip', () => {
    test('author weight survives WeightToMg -> MgToWeight', () => {
        assert.equal(MgToWeight(WeightToMg(2.5, 'lb'), 'lb'), 2.5);
        assert.equal(MgToWeight(WeightToMg(48, 'oz'), 'oz'), 48);
        assert.equal(MgToWeight(WeightToMg(0.75, 'kg'), 'kg'), 0.75);
    });
});
