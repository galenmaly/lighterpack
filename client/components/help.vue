<style lang="scss">

#help {
    width: 800px;
}

</style>

<template>
    <modal id="help" :shown="shown" @hide="shown = false">
        <h2>Help</h2>

        <p>Getting Started:</p>
        <ol>
            <li>Click on things to edit them. Give your list and category a name.</li>
            <li>Add new categories and items to your list.</li>
            <li>When you're done, share your list with others!</li>
        </ol>
        <hr>
        <strong>Quantity and worn values</strong>
        <p>If you have multiple quantity of an item and mark that item as worn, only the first quantity will count towards your worn weight. The rest will count towards your pack weight. This is because most items you have multiple of, you only wear one at once. This means you can't list your shoes/trekking poles with weights as individual weights and quantity of two - you should list as the combined weight with quantity of one.</p>
        <hr>
        <strong>Items in multiple lists</strong>
        <p>If you copy your list or drag an item from the gear library into a second list, those items are now <strong>linked</strong>. This means that changes to an item in one place will update that list everywhere. If you want to copy your list without links, for now you can export to CSV and re-import the list.</p>
        <hr>
        <p><a class="lpHref" href="mailto:info@lighterpack.com">More help available via email.</a></p>
    </modal>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'Help',
    components: {
        modal,
    },
    data() {
        return {
            shown: false,
        };
    },
    beforeMount() {
        bus.$on('showHelp', () => {
            this.shown = true;
        });
    },
};
</script>
