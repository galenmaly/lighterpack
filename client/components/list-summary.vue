<template>
    <div class="lpListSummary">
        <div class="lpChartContainer">
            <canvas class="lpChart" height="260" width="260" />
        </div>
        <div class="lpTotalsContainer">
            <ul class="lpTotals lpTable lpDataTable">
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
            </ul>
        </div>
    </div>
</template>

<script>
import colorPicker from './colorpicker.vue';
import unitSelect from './unit-select.vue';

import pies from '../pies.js';
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
    },
    methods: {
        updateChart(type) {
            const chartData = this.library.renderChart(type);

            if (chartData) {
                if (this.chart) {
                    this.chart.update({ processedData: chartData });
                } else {
                    this.chart = pies({ processedData: chartData, container: document.getElementsByClassName('lpChart')[0], hoverCallback: this.chartHover });
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

.lpTotalsContainer {
    flex: 0 0 330px;
}

.lpTotals {
    color: var(--lp-text);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    margin: 0;
    padding: 0;

    .lpRow {
        align-items: center;
        display: flex;
        gap: 9px;
        list-style: none;
        padding: 3px 0;

        &.hover {
            background: var(--lp-hairline-faint);
        }
    }

    .lpTotalCategory {
        border-bottom: 1px solid var(--lp-hairline-faint);
    }

    .lpTotal {
        font-weight: 700;
        margin-top: 3px;
        padding: 5px 0 2px;

        .lpNumber:not(.lpWeightVal) {
            font-weight: 400;
        }
    }

    .lpBreakdown {
        color: var(--lp-text-muted);
        padding: 2px 0;

        .lpCategoryCell,
        .lpNumber {
            color: var(--lp-text-muted);
        }
    }

    .lpCell {
        padding: 0;
    }

    .lpLegendCell {
        flex: 0 0 11px;
        line-height: 0;
    }

    .lpCategoryCell {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lpNumber {
        color: var(--lp-text-muted);
        flex: 0 0 auto;
    }

    .lpWeightVal {
        color: var(--lp-text);
        flex: 0 0 52px;
        text-align: right;
    }

    .lpUnitCell {
        color: var(--lp-text-faint);
        flex: 0 0 30px;
        font-size: 10.5px;
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
        font-size: 10.5px;
        width: auto;
    }

    &:hover,
    &.lpHover {
        background: transparent;
        border-color: transparent;
        border-bottom: 1px dotted var(--lp-text-muted);
    }
}

.lpLegend {
    border: none;
    display: block;
    height: 11px;
    width: 11px;

    &:hover {
        cursor: pointer;
        outline: 1px solid var(--lp-text-muted);
    }
}
</style>
