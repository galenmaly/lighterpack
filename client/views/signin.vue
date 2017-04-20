<style lang="scss">

</style>

<template>
    <div id="signinContainer">
        <div class="lpDialog" id="signin">
            <h2>
                Sign in
                <router-link to="/register"><a class="lpHref alternateAction">Need to register?</a></router-link>
            </h2>

            <p class="lpSuccess"></p>
            <form class="signin" v-on:submit="signin($event)">
                <p v-if="error" class="lpError">{{error}}</p>
                <input v-focus-on-create type="text" placeholder="Username" name="username" class="username" v-model="username"/>
                <input type="password" placeholder="Password" name="password" class="password" v-model="password" v-select-on-bus="'focus-signin-password'"/>
                <input type="submit" value="Sign in" class="lpButton" />
                <span class="status"></span>
                <router-link to="/forgotPassword"><a class="lpHref alternateAction">Forgot username/password?</a></router-link>
            </form>
        </div>

        <blackoutFooter></blackoutFooter>
        <div class="lpModalOverlay lpBlackout"></div>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";

export default {
    name: "welcome",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter
    },
    data: function() {
        return {
            error: false,
            username: "",
            password: ""
        }
    },
    methods: {
        signin: function(evt) {
            evt.preventDefault();

            var username = this.username.toLowerCase().trim();
            var hash = CryptoJS.SHA3(this.password+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            return fetchJson("/signin/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({username: username, password: hash})
            })
            .then((response) => {
                this.$store.commit('loadLibraryData', response.library);
                this.$store.commit('setSaveType', "remote");
                this.$store.commit('setLoggedIn', response.username)
                router.push("/");
            })
            .catch((response) => {
                console.log(response);
                var error = "An error occurred.";
                if (response.json && response.json.status) {
                    error = response.json.status;
                }
                this.error = error;
                bus.$emit("focus-signin-password");
                this.password = "";
            });
        }
    }
}
</script>