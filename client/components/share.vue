<style lang="scss">

</style>

<template>
    <span v-if="isSignedIn" class="headerItem hasFlyout">
        <span id="share" class="lpFlyout" v-on:mouseenter="focusShare">
            <span class="lpTarget"><i class="lpSprite lpLink"></i> Share</span>
            <div class="lpContent">
                <h3>Share your list</h3>
                <input type="text" id="shareUrl" :value="shareUrl" v-select-on-bus="'show-share-box'"/>
                <h3>Embed your list</h3>
                <textarea id="embedUrl" v-select-on-focus>&lt;script src="{{this.baseUrl}}/e/{{this.externalId}}"&gt;&lt;/script&gt;&lt;div id="{{this.externalId}}"&gt;&lt;/div&gt;</textarea>
                <a :href="csvUrl"  id="csvUrl" target="_blank" class="lpHref"><i class="lpSprite lpSpriteDownload"></i>Export to CSV</a>
            </div>
        </span>
    </span>
</template>

<script>

module.exports = {
    name: "header",
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        isSignedIn: function() {
            return this.$store.state.loggedIn;
        },
        externalId: function() {
            return this.library.getListById(this.library.defaultListId).externalId;
        },
        baseUrl: function() {
            var location = window.location;
            return location.origin ? location.origin : location.protocol + '//' + location.hostname;
        },
        shareUrl: function() {
            return this.baseUrl + "/r/" + this.externalId;
        },
        csvUrl: function() {
            return this.baseUrl + "/csv/" + this.externalId;
        }
    },
    methods: {
        focusShare: function(evt) {
            bus.$emit('show-share-box');
        }
    }
}
</script>
