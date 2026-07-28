export default (function () {
    function WeightToMg(value, unit) {
        if (unit == 'g') {
            return value * 1000;
        } if (unit == 'kg') {
            return value * 1000000;
        } if (unit == 'oz') {
            return value * 28349.5;
        } if (unit == 'lb') {
            return value * 453592;
        }
    }

    function MgToWeight(value, unit) {
        if (unit == 'g') {
            return Math.round(100 * value / 1000.0) / 100;
        } if (unit == 'kg') {
            return Math.round(100 * value / 1000000.0, 2) / 100;
        } if (unit == 'oz') {
            return Math.round(100 * value / 28349.5, 2) / 100;
        } if (unit == 'lb') {
            return Math.round(100 * value / 453592.0, 2) / 100;
        }
    }

    // Display-only rounding, layered on top of MgToWeight's flat two decimals.
    // A hundredth of an ounce or a pound is a real distinction; a hundredth of
    // a gram is not, so a 1.2 oz item read in grams should say 34, not 34.02 --
    // digits the author never entered. Precision scales with magnitude instead
    // of being fixed at zero so a weight genuinely typed in grams (12.5) still
    // survives the round trip, and a sub-gram item doesn't collapse to 0.
    //
    // Grams only: kg, oz and lb are all coarser than a gram at two decimals
    // already, and readers expect to see them that way.
    //
    // Not for the item row's weight box, the arrow keys that step it, or the
    // CSV export -- those hand back the author's own number and must not round
    // it. They call MgToWeight directly.
    function MgToDisplayWeight(value, unit) {
        const weight = MgToWeight(value, unit);

        if (unit != 'g') {
            return weight;
        } if (Math.abs(weight) >= 100) {
            return Math.round(weight);
        } if (Math.abs(weight) >= 1) {
            return Math.round(weight * 10) / 10;
        }

        return weight;
    }

    return {
        WeightToMg,
        MgToWeight,
        MgToDisplayWeight,
    };
}());
