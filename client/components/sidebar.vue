<style lang="scss">

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