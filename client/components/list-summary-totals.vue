<style lang="scss">

</style>

<template>
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
        {{#categories}}
            <li class="lpTotalCategory lpRow" id="total_{{id}}" category="{{id}}">
                <span class="lpCell lpLegendCell">
                    <span class="lpLegend" style="background-color: {{displayColor}}"></span>
                </span>
                <span class="lpCell">
                    {{name}}
                </span>
                <span class="lpCell lpNumber">
                    <div class="lpSubtotal"><span class="lpDisplaySubtotal"  mg="{{subtotal}}">{{displaySubtotal}}</span> <span class="lpSubtotalUnit">{{subtotalUnit}}</span></div>
                </span>
            </li>
        {{/categories}}
        <li class="lpRow lpFooter lpTotal">
            <span class="lpCell"></span>
            <span class="lpCell lpSubtotal" title="{{qtyTotal}} items">
                Total
            </span>
            <span class="lpCell lpNumber lpSubtotal">
                <span class="lpTotalValue" title="{{qtyTotal}} items">{{total}}</span>
                <span class="lpTotalUnit">{{{totalUnit}}}</span>
            </span>
        </li>
        <li data-weight-type="consumable" class="lpRow lpFooter lpBreakdown lpConsumableWeight">
            <span class="lpCell"></span>
            <span class="lpCell lpSubtotal">
                Consumable
            </span>
            <span class="lpCell lpNumber lpSubtotal">
                <span class="lpDisplaySubtotal" mg="{{consumableTotal}}">{{consumableDisplayTotal}}</span>
                <span class="lpSubtotalUnit">{{subtotalUnit}}</span>
            </span>
        </li>
        <li data-weight-type="worn" class="lpRow lpFooter lpBreakdown lpWornWeight">
            <span class="lpCell"></span>
            <span class="lpCell lpSubtotal">
                Worn
            </span>
            <span class="lpCell lpNumber lpSubtotal">
                <span class="lpDisplaySubtotal" mg="{{wornTotal}}">{{wornDisplayTotal}}</span>
                <span class="lpSubtotalUnit">{{subtotalUnit}}</span>
            </span>
        </li>
        <li data-weight-type="base" class="lpRow lpFooter lpBreakdown lpPackWeight">
            <span class="lpCell"></span>
            <span class="lpCell lpSubtotal">
                Base Weight
            </span>
            <span class="lpCell lpNumber lpSubtotal">
                <span class="lpDisplaySubtotal" mg="{{packTotal}}">{{packDisplayTotal}}</span>
                <span class="lpSubtotalUnit">{{subtotalUnit}}</span>
            </span>
        </li>
    </ul>

</template>

<script>
export default {
    name: "list-summary-totals",
    mixins: [],
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>