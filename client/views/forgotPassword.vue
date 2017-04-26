<style lang="scss">

</style>

<template>
    <div id="forgotPasswordContainer">
        <div class="lpDialog" id="forgotPassword">
            <div class="columns">
                <div class="lpHalf">
                    <h3>
                        Forgot Your Password?
                    </h3>

                    <p>If you've forgotten your password we will email you a new one. Please enter your username.</p>
                    <form class="forgotPassword" v-on:submit="resetPassword($event)"">
                        <input type="text" placeholder="Username" name="username" class="username" v-model="forgotPasswordUsername"/>
                        <input type="submit" value="Submit" class="lpButton" />
                        <ul class="lpError" v-if="forgotPasswordErrors">
                            <li v-for="error in forgotPasswordErrors">{{error.message}}</li>
                        </ul>
                        <span class="status"></span>
                        <router-link to="/signin" class="lpHref alternateAction">Return to sign in</router-link>
                    </form>
                </div>
                <div class="lpHalf">
                    <h3>
                        Forgot Your Username?
                    </h3>

                    <p>If you've forgotten your username we will email it to you. Please enter your email address.</p>
                    <form class="forgotUsername" v-on:submit="forgotUsername($event)"">
                        <input type="text" placeholder="Email Address" name="email" class="email" v-model="forgotUsernameEmail"/>
                        <input type="submit" value="Submit" class="lpButton" />
                        <ul class="lpError" v-if="forgotUsernameErrors">
                            <li v-for="error in forgotUsernameErrors">{{error.message}}</li>
                        </ul>
                        <span class="status"></span>
                        <router-link to="/signin" class="lpHref alternateAction">Return to sign in</router-link>
                    </form>
                </div>
            </div>
        </div>
        <blackoutFooter></blackoutFooter>
        <div class="lpModalOverlay lpBlackout"></div>
    </div>
</template>

<script>
export default {
    name: "forgotPassword",
    mixins: [],
    data: function() {
        return {
            forgotPasswordUsername: "",
            forgotPasswordErrors: [],
            forgotUsernameEmail: "",
            forgotUsernameErrors: []
        }
    },
    methods: {
        resetPassword: function(evt) {
            evt.preventDefault();

            this.forgotPasswordErrors = [];

            return fetchJson("/forgotPassword", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({username: this.forgotPasswordUsername})
            })
            .then((response) => {
                router.push("/signin/reset-password");
            })
            .catch((response) => {
                var errors = [{message: "An error occurred, please try again later."}];
                if (response.json && response.json.errors) {
                    errors = response.json.errors;
                }
                this.forgotPasswordErrors = errors;
            });
        },
        forgotUsername: function(evt) {
            evt.preventDefault();
            this.forgotUsernameErrors = [];

            return fetchJson("/forgotUsername", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({email: this.forgotUsernameEmail})
            })
            .then((response) => {
                router.push("/signin/forgot-username");
            })
            .catch((response) => {
                var errors = [{message: "An error occurred, please try again later."}];
                if (response.json && response.json.errors) {
                    errors = response.json.errors;
                }
                this.forgotUsernameErrors = errors;
            });
        }
    }
}
</script>