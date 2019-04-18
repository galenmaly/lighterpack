<style lang="scss">
@import "../css/_globals";

#sidebar {
    background: #555;
    box-shadow: -7px 0 7px rgba(0, 0, 0, 0.2) inset;
    color: #fff;
    height: 100%;
    margin-left: -600px;
    opacity: 0;
    padding-left: 620px;
    padding-right: 20px;
    position: fixed;
    transition: opacity $transitionDurationSlow ease-in-out 0s;
    width: 280px;
    z-index: $sidebar;

    .lpHasSidebar & {
        opacity: 1;
    }

    h1 {
        @include fullBleedLeft();

        box-sizing: border-box;
        height: 60px;
        margin: 0 -20px 20px 0;
        padding: 20px 0 20px;
        position: relative;

        span {
            color: #aaa;
        }
    }

    section {
        margin-bottom: 40px;
        position: relative;
    }

    h2 {
        font-size: 16px;
        margin: 0 0 10px;
    }

    ul {
        background: #606060;
        -moz-box-sizing: content-box;
        box-sizing: content-box;
        margin: 0;
        overflow-x: hidden;
        padding: 0;
    }

    .lpHref {
        color: $blue2;
    }

    #addListFlyout {
        position: absolute;
        right: 0;
        top: -10px;
        width: 126px;

        .lpTarget {
            border: 1px solid transparent;
            border-bottom: none;
        }

        &:hover .lpTarget {
            background: #444;
            border: 1px solid #999;
            border-bottom: none;
            display: block;
        }

        .lpContent {
            background: #444;
            border: 1px solid #999;
            border-top: none;
            left: 0;
            padding: 0 5px 5px;
        }

        #importList {
            padding-top: 0;
        }
    }
}

#scrollable {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    top: 0;

    > h1 {
        flex: 0 0 auto;
    }
}

</style>

<template>
    <div id="sidebar">
        <div id="scrollable">
            <h1>LighterPack <span>(beta)</span></h1>

            <libraryLists></libraryLists>
            <libraryItems></libraryItems>
        </div>
    </div>
</template>

<script>
import libraryItems from "./library-items.vue";
import libraryLists from "./library-lists.vue";

export default {
    name: "sidebar",
    components: {
        libraryItems,
        libraryLists
    }
}
</script>