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
                    <span class="lpCell">
                        Weight
                    </span>
                </li>
                <li v-for="category in categories" :class="{'hover':category.activeHover, 'lpTotalCategory lpRow': true}">
                    <span class="lpCell lpLegendCell">
                        <span class="lpLegend" :style="{'background-color': list.displayColor}"></span>
                    </span>
                    <span class="lpCell">
                        {{category.name}}
                    </span>
                    <span class="lpCell lpNumber">
                        <div class="lpSubtotal"><span class="lpDisplaySubtotal" :mg="category.subtotal">{{category.subtotal | displayWeight(library.totalUnit)}}</span> <span class="lpSubtotalUnit">{{library.totalUnit}}</span></div>
                    </span>
                </li>
                <li class="lpRow lpFooter lpTotal">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal" :title="list.qtyTotal +' items'">
                        Total
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpTotalValue" :title="list.qtyTotal + ' items'">
                            {{list.total | displayWeight(library.totalUnit)}}
                        </span>
                        <span class="lpTotalUnit"><unitSelect :unit="library.totalUnit" :onChange="setTotalUnit"></unitSelect></span>
                    </span>
                </li>
                <li data-weight-type="consumable" class="lpRow lpFooter lpBreakdown lpConsumableWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal">
                        Consumable
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.consumableTotal">{{list.consumableTotal | displayWeight(library.totalUnit)}}</span>
                        <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
                <li data-weight-type="worn" class="lpRow lpFooter lpBreakdown lpWornWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal">
                        Worn
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.wornTotal">{{list.wornTotal | displayWeight(library.totalUnit)}}</span>
                        <span class="lpSubtotalUnit">{{library.totalUnit}}</span>
                    </span>
                </li>
                <li data-weight-type="base" class="lpRow lpFooter lpBreakdown lpPackWeight">
                    <span class="lpCell"></span>
                    <span class="lpCell lpSubtotal">
                        Base Weight
                    </span>
                    <span class="lpCell lpNumber lpSubtotal">
                        <span class="lpDisplaySubtotal" :mg="list.packTotal">{{list.packTotal | displayWeight(library.totalUnit)}}</span>
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
        }
    },
    mounted: function() {
        this.updateChart();
    },
    watch: {
        "$store.state.library.defaultListId": function(to, from) {
            this.updateChart();
        },
        "list.total": function(to, from) {
            //TODO: this doesn't cover all cases
            this.updateChart();
        }
    }
}
</script>