<template>
    <div id="getStarted">
        <div class="lpGetStartedChart">
            <canvas ref="chart" class="lpDecorChart" height="260" width="260" />
        </div>
        <div class="lpGetStartedText">
            <h2>Welcome to LighterPack!</h2>
            <p>Here's how to get started:</p>
            <ol>
                <li>Click anything to edit it. Start by naming your list and its first category.</li>
                <li>Add items and give them weights to start filling in the chart.</li>
                <li v-if="!isLocalSaving">
                    When you're done, share your list with others!
                </li>
            </ol>
            <p v-if="isLocalSaving" class="lpWarning">
                <strong>Note:</strong> Your data is being saved to your local computer. In order to share your lists please register an account.
            </p>
        </div>
    </div>
</template>

<script>
import pies from '../pies.js';
import colorUtils from '../utils/color.js';

// The favicon's five wedges: the first five palette colors (blue, red,
// yellow, green, purple) at the proportions the mark uses. Decorative
// only — it stands in for the chart the list doesn't have yet.
const FAVICON_SLICES = [0.2, 0.3, 0.25, 0.125, 0.125];

// pies.js draws whatever `processedData` shape renderChart() produces; a
// flat ring needs nothing beyond a percent and a color per slice.
function faviconChartData() {
    const points = {};
    FAVICON_SLICES.forEach((percent, i) => {
        points[i] = { value: percent, percent, color: colorUtils.getColor(i) };
    });
    return { total: 1, points };
}

export default {
    name: 'GetStarted',
    computed: {
        isLocalSaving() {
            return this.$store.state.saveType === 'local';
        },
    },
    mounted() {
        pies({ processedData: faviconChartData(), container: this.$refs.chart });
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

#getStarted {
    align-items: center;
    display: flex;
    flex-direction: row;
    gap: 48px;
    justify-content: center;
    line-height: 1.6;
    padding: 22px 0 20px;
}

.lpGetStartedChart {
    flex: 0 0 auto;

    .lpDecorChart {
        display: block;
        height: 260px;
        opacity: 0.15;
        pointer-events: none;
        width: 260px;
    }
}

.lpGetStartedText {
    flex: 0 0 450px;

    h2 {
        font-size: 24px;
        line-height: 1;
    }

    h2,
    p,
    ol {
        margin: 0 0 $spacingMedium;

        &:last-child {
            margin-bottom: 0;
        }
    }

    ol {
        padding-left: 18px;
    }
}
</style>
