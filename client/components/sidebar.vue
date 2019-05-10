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
        box-sizing: content-box;
        margin: 0;
        overflow-x: hidden;
        padding: 0;
    }

    .lpHref {
        color: $blue2;
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

            <libraryLists />
            <libraryItems />
        </div>
    </div>
</template>

<script>
import libraryItems from './library-items.vue';
import libraryLists from './library-lists.vue';

export default {
    name: 'Sidebar',
    components: {
        libraryItems,
        libraryLists,
    },
};
</script>
