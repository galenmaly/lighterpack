<style lang="scss">
#share label {
    font-weight: bold;
}
</style>

<template>
    <span v-if="isSignedIn" class="headerItem hasFlyout">
        <span id="share" class="lpFlyout" @mouseenter="focusShare">
            <span class="lpTarget"><i class="lpSprite lpLink"></i> Share</span>
            <div class="lpContent lpFields">
                <div class="lpField">
                    <label for="shareUrl">Share your list</label>
                    <input type="text" id="shareUrl" :value="shareUrl" v-select-on-bus="'show-share-box'"/>
                </div>
                <div class="lpField">
                    <label for="embedUrl">Embed your list</label>
                    <textarea id="embedUrl" v-select-on-focus>&lt;script src="{{this.baseUrl}}/e/{{this.externalId}}"&gt;&lt;/script&gt;&lt;div id="{{this.externalId}}"&gt;&lt;/div&gt;</textarea>
                </div>
                <a :href="csvUrl"  id="csvUrl" target="_blank" class="lpHref"><i class="lpSprite lpSpriteDownload"></i>Export to CSV</a>
            </div>
        </span>
    </span>
</template>

<script>

export default {
    name: "share",
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        list: function() {
            return this.library.getListById(this.library.defaultListId);
        },
        isSignedIn: function() {
            return this.$store.state.loggedIn;
        },
        externalId: function() {
            return this.list.externalId || "";
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
            if (!this.list.externalId) {
                return fetchJson("/externalId", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'
                })
                .then((response) => {
                    this.$store.commit('setExternalId', {externalId: response.externalId, list: this.list});
                    setTimeout(() => {
                        bus.$emit('show-share-box');
                    },0);
                })
                .catch((response) => {
                    alert("An error occurred while attempting to get an ID for your list. Please try again later."); //TODO
                });
            } else {
                bus.$emit('show-share-box');
            }
        }
    }
}
</script>
