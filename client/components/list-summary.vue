<style lang="scss">

</style>

<template>
    <div class="lpListSummary">
        <div class="lpChartContainer">
            <canvas class="lpChart" height="260" width="260"></canvas>
        </div>
        <div class="lpTotalsContainer">
            <ul class="lpTotals lpTable lpDataTable">
                <li class="lpRow lpHeader">
                    <span class="lpCell"></span>
                    <span class="lpCell">
                        Category
                    </span>
                    <span class="lpCell" v-if="library.optionalFields['price']">
                        Price
                    </span>
                    <span class="lpCell">
                        Weight
                    </span>
                </li>
                <li v-for="category in categories" :class="{'hover':category.activeHover, 'lpTotalCategory lpRow': true}">
                    <span class="lpCell lpLegendCell">
                        <span v-on:click="showColorPicker($event, category)" class="lpLegend" :style="{'background-color': category.displayColor}"></span>
                    </span>
                    <span class="lpCell">
                        {{category.name}}
                    </span>
                    <span class="lpCell lpNumber" v-if="library.optionalFields['price']">
                        {{category.subtotalPrice | displayPrice(library.currencySymbol)}}
                    </span>
                    <span class="lpCell lpNumber">
                        <span class="lpDisplaySubtotal" :mg="category.subtotalWeight">{{category.subtotalWeight | displayWeight(library.totalUnit)}}</span> <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
                <li class="lpRow lpFooter lpTotal">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal" :title="list.totalQty +' items'">
                        Total
                    </span>
                    <span class="lpCell lpNumber lpSubtotal" v-if="library.optionalFields['price']" :title="list.totalQty +' items'">
                        {{list.totalPrice | displayPrice(library.currencySymbol)}}
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpTotalValue" :title="list.totalQty + ' items'">
                            {{list.totalWeight | displayWeight(library.totalUnit)}}
                        </span>
                        <span class="lpTotalUnit"><unitSelect :unit="library.totalUnit" :onChange="setTotalUnit"></unitSelect></span>
                    </span>
                </li>
                <li data-weight-type="consumable" class="lpRow lpFooter lpBreakdown lpConsumableWeight" v-if="list.totalConsumableWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal">
                        Consumable
                    </span>
                    <span class="lpCell lpNumber lpSubtotal" v-if="library.optionalFields['price']">
                        {{list.totalConsumablePrice | displayPrice(library.currencySymbol)}}
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.totalConsumableWeight">{{list.totalConsumableWeight | displayWeight(library.totalUnit)}}</span>
                        <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
                <li data-weight-type="worn" class="lpRow lpFooter lpBreakdown lpWornWeight" v-if="list.totalWornWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal">
                        Worn
                    </span>
                    <span class="lpCell lpNumber" v-if="library.optionalFields['price']"></span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.totalWornWeight">{{list.totalWornWeight | displayWeight(library.totalUnit)}}</span>
                        <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
                <li data-weight-type="base" class="lpRow lpFooter lpBreakdown lpBaseWeight" v-if="list.totalWornWeight || list.totalConsumableWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal" :title="$options.filters.displayWeight(list.totalPackWeight, library.totalUnit) + ' ' + library.totalUnit + ' pack weight (consumable + base weight)'">
                        Base Weight
                    </span>
                    <span class="lpCell lpNumber" v-if="library.optionalFields['price']"></span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.totalBaseWeight" :title="$options.filters.displayWeight(list.totalPackWeight, library.totalUnit) + ' ' + library.totalUnit + ' pack weight (consumable + base weight)'">
                            {{list.totalBaseWeight | displayWeight(library.totalUnit)}}
                        </span>
                        <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
const pies = require("../pies.js");
const utilsMixin = require("../mixins/utils-mixin.js");
const unitSelect = require("./unit-select.vue");
const colorUtils = require("../utils/color.js");

module.exports = {
    name: "list-summary",
    mixins: [utilsMixin],
    props: ["list"],
    components: {
        unitSelect: unitSelect
    },
    data: function() {
        return {
            chart: null,
            hoveredCategoryId: null
        }
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        categories() {
            return this.list.categoryIds.map((id) => {
                var category = this.library.getCategoryById(id);
                category.activeHover = (this.hoveredCategoryId === category.id);
                return category;
            });
        }
    },
    methods: {
        updateChart: function(type) {
            var chartData = this.library.renderChart(type);

            if (chartData) {
                if (this.chart) {
                    this.chart.update({processedData: chartData});
                } else {
                    this.chart = pies({processedData: chartData, container: document.getElementsByClassName("lpChart")[0], hoverCallback: this.chartHover});
                }
            }
            return chartData;
        },
        chartHover: function(chartItem) {
            if (chartItem && chartItem.id) {
                this.hoveredCategoryId = chartItem.id;
            } else {
                this.hoveredCategoryId = null;
            }
        },
        setTotalUnit: function(unit) {
            this.$store.commit("setTotalUnit", unit);
        },
        showColorPicker: function(evt, category) {
            var self = this;
            var callback = function(color) {
                self.updateColor(category, color);
            }
            bus.$emit("showColorPicker", {evt, category, callback});
        },
        updateColor: function(category, color) {
            category.color = color;
            category.displayColor = colorUtils.rgbToString(color);
            this.$store.commit("updateCategoryColor", category)
            this.updateChart();
        }
    },
    mounted: function() {
        this.updateChart();
    },
    watch: {
        "$store.state.library.defaultListId": function(to, from) {
            this.updateChart();
        },
        "list.totalWeight": function(to, from) {
            //TODO: this doesn't cover all cases
            this.updateChart();
        }
    }
}

</script>