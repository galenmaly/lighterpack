<template>
    <modal id="lpImageDialog" :shown="shown" @hide="$emit('hide')">
        <img :src="imageUrl">
    </modal>
</template>

<script>
import modal from './modal.vue';

export default {
    name: 'ItemViewImage',
    components: {
        modal,
    },
    props: {
        shown: {
            type: Boolean,
            required: true,
        },
        imageUrl: {
            type: String,
            default: '',
        },
    },
    emits: ['hide'],
};
</script>

<style lang="scss">

#itemImageDialog {
    width: 640px;

    .imageUploadDescription {
        margin-bottom: 19px;
    }
}

</style>
