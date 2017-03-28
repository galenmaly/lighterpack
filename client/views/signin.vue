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
                <div class="lpError"></div>
                <input type="text" placeholder="Username" name="username" class="username" v-model="username"/>
                <input type="password" placeholder="Password" name="password" class="password" v-model="password"/>
                <input type="submit" value="Sign in" class="lpButton" />
                <span class="status"></span>
                <router-link to="/forgotPassword"><a class="lpHref alternateAction">Forgot username/password?</a></router-link>
            </form>
        </div>

        <blackoutFooter></blackoutFooter>
        <modalBlackout></modalBlackout>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";
import modalBlackout from "../components/modal-blackout.vue";

export default {
    name: "welcome",
    mixins: [],
    components: {
        blackoutFooter: blackoutFooter,
        modalBlackout: modalBlackout
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

            var username = this.username.toLowerCase();
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
                library.load(JSON.parse(response.data.library));
                context.commit('loadLibrary', library);
            })
            .catch((response) => {
                var error = "An error occurred.";
                if (data.responseText) {
                    error = data.responseText;
                }
                this.error = error;
                $(".password", form).val("").focus();
            });
        }
    }
}
</script>