<style lang="scss">

</style>

<template>
    <span id="account">
        <span v-if="isSignedIn" id="account" class="headerItem hasFlyout">
            <span class="lpFlyout">
                <span class="lpTarget">Signed in as <span class="username">{{username}}</span> <i class="lpSprite lpExpand"></i></span>
                <div class="lpContent">
                    <a v-on:click="showAccount" class="lpHref accountSettings">Account Settings</a><br />
                    <a v-on:click="showHelp" class="lpHref">Help</a><br />
                    <a v-on:click="showTodo" class="lpHref">Bugs / TODO</a><br />
                    <a v-on:click="signout" class="lpHref signout">Sign Out</a>
                </div>
            </span>
        </span>
        <span v-if="!isSignedIn" class="headerItem">
            <router-link to="/register" class="lpButton lpSmall">Register</router-link>
            or
            <router-link to="/signin" class="lpButton lpSmall">Sign In</router-link>
        </span>
    </span>
</template>

<script>

module.exports = {
    name: "accountDropdown",
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        isSignedIn: function() {
            return this.$store.state.loggedIn;
        },
        username: function() {
            return this.$store.state.loggedIn;
        }
    },
    methods: {
        showAccount: function() {
            bus.$emit("showAccount");
        },
        showHelp: function() {
            bus.$emit("showHelp");
        },
        showTodo: function() {
            bus.$emit("showTodo");
        },
        signout: function() {
            this.$store.commit("signout");
            router.push("/signin");
        }
    }
}
</script>
