<template>
    <div class="lpListSummary">
        <div class="lpChartContainer">
            <canvas class="lpChart" height="260" width="260" />
        </div>
        <div class="lpTotalsContainer">
            <ul class="lpTotals lpTable lpDataTable" :class="{ lpHasPrice: list.optionalFields['price'] }">
                <li v-for="category in categories" :key="category.id" :class="{'hover': category.id === hoveredCategoryId, 'lpTotalCategory lpRow': true}">
                    <span class="lpCell lpLegendCell">
                        <colorPicker v-if="category.displayColor" :color="colorToHex(category.displayColor)" @color-change="updateColor(category, $event)" />
                    </span>
                    <span class="lpCell lpCategoryCell">
                        {{ category.name }}
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber">
                        {{ displayPrice(category.subtotalPrice, library.currencySymbol) }}
                    </span>
                    <span class="lpCell lpNumber lpWeightVal">
                        <span class="lpDisplaySubtotal" :mg="category.subtotalWeight">{{ displayWeight(category.subtotalWeight, library.totalUnit) }}</span>
                    </span>
                    <span class="lpCell lpUnitCell lpSubtotalUnit">{{ library.totalUnit }}</span>
                </li>
                <li class="lpRow lpFooter lpTotal">
                    <span class="lpCell lpLegendCell" />
                    <span class="lpCell lpCategoryCell lpSubtotal" :title="list.totalQty +' items'">
                        Total
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber lpSubtotal" :title="list.totalQty +' items'">
                        {{ displayPrice(list.totalPrice, library.currencySymbol) }}
                    </span>
                    <span class="lpCell lpNumber lpWeightVal lpSubtotal">
                        <span class="lpTotalValue" data-testid="total-weight" :title="list.totalQty + ' items'">
                            {{ displayWeight(list.totalWeight, library.totalUnit) }}
                        </span>
                    </span>
                    <span class="lpCell lpUnitCell lpTotalUnit"><unitSelect :unit="library.totalUnit" :on-change="setTotalUnit" /></span>
                </li>
                <li v-if="list.totalConsumableWeight" data-weight-type="consumable" class="lpRow lpFooter lpBreakdown lpConsumableWeight">
                    <span class="lpCell lpLegendCell" />
                    <span class="lpCell lpCategoryCell">
                        Consumable
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber">
                        {{ displayPrice(list.totalConsumablePrice, library.currencySymbol) }}
                    </span>
                    <span class="lpCell lpNumber lpWeightVal">
                        <span class="lpDisplaySubtotal" data-testid="consumable-weight" :mg="list.totalConsumableWeight">{{ displayWeight(list.totalConsumableWeight, library.totalUnit) }}</span>
                    </span>
                    <span class="lpCell lpUnitCell lpSubtotalUnit">{{ library.totalUnit }}</span>
                </li>
                <li v-if="list.totalWornWeight" data-weight-type="worn" class="lpRow lpFooter lpBreakdown lpWornWeight">
                    <span class="lpCell lpLegendCell" />
                    <span class="lpCell lpCategoryCell">
                        Worn
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber" />
                    <span class="lpCell lpNumber lpWeightVal">
                        <span class="lpDisplaySubtotal" data-testid="worn-weight" :mg="list.totalWornWeight">{{ displayWeight(list.totalWornWeight, library.totalUnit) }}</span>
                    </span>
                    <span class="lpCell lpUnitCell lpSubtotalUnit">{{ library.totalUnit }}</span>
                </li>
                <li v-if="list.totalWornWeight || list.totalConsumableWeight" data-weight-type="base" class="lpRow lpFooter lpBreakdown lpBaseWeight">
                    <span class="lpCell lpLegendCell" />
                    <span class="lpCell lpCategoryCell" :title="displayWeight(list.totalPackWeight, library.totalUnit) + ' ' + library.totalUnit + ' pack weight (consumable + base weight)'">
                        Base Weight
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber" />
                    <span class="lpCell lpNumber lpWeightVal">
                        <span class="lpDisplaySubtotal" data-testid="base-weight" :mg="list.totalBaseWeight" :title="displayWeight(list.totalPackWeight, library.totalUnit) + ' ' + library.totalUnit + ' pack weight (consumable + base weight)'">
                            {{ displayWeight(list.totalBaseWeight, library.totalUnit) }}
                        </span>
                    </span>
                    <span class="lpCell lpUnitCell lpSubtotalUnit">{{ library.totalUnit }}</span>
                </li>
                <li v-if="list.optionalFields['packWeight']" data-weight-type="pack" class="lpRow lpFooter lpBreakdown lpTotalPackWeight">
                    <span class="lpCell lpLegendCell" />
                    <span class="lpCell lpCategoryCell" title="Total weight minus worn items">
                        Total Pack Weight
                    </span>
                    <span v-if="list.optionalFields['price']" class="lpCell lpNumber" />
                    <span class="lpCell lpNumber lpWeightVal">
                        <span class="lpDisplaySubtotal" data-testid="pack-weight" :mg="list.totalPackWeight" title="Total weight minus worn items">
                            {{ displayWeight(list.totalPackWeight, library.totalUnit) }}
                        </span>
                    </span>
                    <span class="lpCell lpUnitCell lpSubtotalUnit">{{ library.totalUnit }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import colorPicker from './colorpicker.vue';
import unitSelect from './unit-select.vue';

import pies from '../pies.js';
import { chartLineColor, chartHoverColor, onThemeChange } from '../utils/theme.js';
import utilsMixin from '../mixins/utils-mixin.js';
import colorUtils from '../utils/color.js';

export default {
    name: 'ListSummary',
    components: {
        colorPicker,
        unitSelect,
    },
    mixins: [utilsMixin],
    props: ['list'],
    data() {
        return {
            chart: null,
            hoveredCategoryId: null,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        categories() {
            return this.list.categoryIds.map(id => this.library.getCategoryById(id));
        },
    },
    watch: {
        '$store.state.library.defaultListId': 'updateChart',
        'list.totalWeight': 'updateChart',
        'list.categoryIds': 'updateChart',
    },
    mounted() {
        this.updateChart();
        // The canvas can't follow the palette on its own, so re-hand it the
        // colors when the theme flips. Stored off `data` — it's a handle, not
        // state anything renders from.
        this.stopThemeWatch = onThemeChange(() => this.recolorChart());
    },
    beforeUnmount() {
        if (this.stopThemeWatch) this.stopThemeWatch();
    },
    methods: {
        recolorChart() {
            if (!this.chart) return;
            this.chart.update({ lineColor: chartLineColor(), hoverColor: chartHoverColor() });
        },
        updateChart(type) {
            const chartData = this.library.renderChart(type);

            if (chartData) {
                if (this.chart) {
                    this.chart.update({ processedData: chartData });
                } else {
                    this.chart = pies({
                        processedData: chartData,
                        container: document.getElementsByClassName('lpChart')[0],
                        hoverCallback: this.chartHover,
                        lineColor: chartLineColor(),
                        hoverColor: chartHoverColor(),
                    });
                }
            }
            return chartData;
        },
        chartHover(chartItem) {
            if (chartItem && chartItem.id) {
                this.hoveredCategoryId = chartItem.id;
            } else {
                this.hoveredCategoryId = null;
            }
        },
        setTotalUnit(unit) {
            this.$store.commit('setTotalUnit', unit);
        },
        updateColor(category, color) {
            category.color = colorUtils.hexToRgb(color);
            category.displayColor = colorUtils.rgbToString(colorUtils.hexToRgb(color));
            this.$store.commit('updateCategoryColor', category);
            this.updateChart();
        },
        colorToHex(color) {
            return colorUtils.rgbToHex(colorUtils.stringToRgb(color));
        },
    },
};

</script>

<style lang="scss">
@import "../css/_globals";

// Chart + category totals, centered as a pair over the list.
.lpListSummary {
    align-items: center;
    display: flex;
    flex-direction: row;
    gap: 48px;
    justify-content: center;
    padding: 22px 0 20px;
}

.lpChartContainer {
    flex: 0 0 auto;

    .lpChart {
        display: block;
        height: 260px;
        width: 260px;
    }
}

// A flex item floors at its contents' min-content width, so `flex: 0 0 330px`
// was only ever a suggestion — one long category name pushed the panel, and the
// page, well past it. Bound the growth instead: 330px is the resting width, and
// only a name that needs the room takes the panel wider.
.lpTotalsContainer {
    flex: 0 1 auto;
    max-width: 460px;
    min-width: min(330px, 100%);
}

.lpTotals {
    color: var(--lp-text);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    margin: 0;
    padding: 0;

    // One column budget for every row, declared the way the item table below
    // declares its own (category.vue). `minmax(0, 1fr)` is the load-bearing
    // part: a bare 1fr floors at its content, which is what let a long category
    // name widen the panel instead of ellipsizing inside it.
    .lpRow {
        align-items: center;
        column-gap: 9px;
        display: grid;
        grid-template-columns: 11px minmax(0, 1fr) 52px 30px;
        list-style: none;
        padding: 3px 0;

        &.hover {
            background: var(--lp-row-hover);
        }
    }

    // The price cell is conditional, so it gets its own track rather than
    // shifting every column after it. These are subtotals, so unlike the item
    // table's fixed 52px the track has to be able to outgrow it.
    &.lpHasPrice .lpRow {
        grid-template-columns: 11px minmax(0, 1fr) minmax(52px, auto) 52px 30px;
    }

    .lpTotalCategory {
        border-bottom: 1px solid var(--lp-border);
    }

    .lpTotal {
        font-weight: 700;
        margin-top: 3px;
        padding: 5px 0 4px;

        .lpNumber:not(.lpWeightVal) {
            font-weight: 400;
        }
    }

    .lpBreakdown {
        color: var(--lp-text-secondary);
        padding: 4px 0;

        .lpCategoryCell,
        .lpNumber {
            color: var(--lp-text-secondary);
        }
    }

    .lpCell {
        padding: 0;
    }

    .lpLegendCell {
        line-height: 0;
    }

    .lpCategoryCell {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    // Right-aligned like the item table's, so the price track growing for a
    // four-figure subtotal doesn't shift the column.
    .lpNumber {
        color: var(--lp-text-secondary);
        text-align: right;
    }

    .lpWeightVal {
        color: var(--lp-text);
        text-align: right;
    }

    .lpUnitCell {
        color: var(--lp-text-secondary);
        font-size: 12px;
        padding-left: 5px;
    }
}

// The Total row's unit label is the global unit picker.
.lpTotalUnit .lpUnitSelect {
    border: none;
    border-bottom: 1px dotted var(--lp-icon-rest);
    cursor: pointer;
    font-weight: 400;
    padding: 0 1px;
    white-space: nowrap;

    .lpDisplay {
        font-size: 12px;
        width: auto;
    }

    &:hover,
    &.lpHover {
        background: transparent;
        border-color: transparent;
        border-bottom: 1px dotted var(--lp-text-secondary);
    }
}

.lpLegend {
    border: none;
    display: block;
    height: 11px;
    width: 11px;

    &:hover {
        cursor: pointer;
        outline: 1px solid var(--lp-text-secondary);
    }
}
</style>
