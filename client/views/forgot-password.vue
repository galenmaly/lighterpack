<style lang="scss">

#forgotPassword {
    width: 620px;
}

</style>

<template>
    <div id="forgotPasswordContainer">
        <modal :shown="true" :blackout="true" id="forgotPassword">
            <div class="columns">
                <div class="lpHalf">
                    <h3>
                        Forgot Your Password?
                    </h3>

                    <p>Please enter your username.</p>
                    <form class="forgotPassword" @submit.prevent="resetPassword">
                        <div class="lpFields">
                            <input type="text" placeholder="Username" name="username" class="username" v-model="forgotPasswordUsername"/>
                            <input type="submit" value="Submit" class="lpButton" />
                        </div>

                        <errors :errors="forgotPasswordErrors" />
                    </form>
                </div>
                <div class="lpHalf">
                    <h3>
                        Forgot Your Username?
                    </h3>

                    <p>Please enter your email address.</p>
                    <form class="forgotUsername" @submit.prevent="forgotUsername">
                        <div class="lpFields">
                            <input type="text" placeholder="Email Address" name="email" class="email" v-model="forgotUsernameEmail"/>
                            <input type="submit" value="Submit" class="lpButton" />
                        </div>

                        <errors :errors="forgotUsernameErrors" />
                    </form>
                </div>
                <router-link to="/signin" class="lpHref">&larr; Return to sign in</router-link>
            </div>
        </modal>
        <blackoutFooter></blackoutFooter>
    </div>
</template>

<script>
import blackoutFooter from "../components/blackout-footer.vue";
import errors from "../components/errors.vue";
import modal from "../components/modal.vue";

export default {
    name: "forgotPassword",
    components: {
        blackoutFooter,
        errors,
        modal
    },
    data: function() {
        return {
            forgotPasswordUsername: "",
            forgotPasswordErrors: [],
            forgotUsernameEmail: "",
            forgotUsernameErrors: []
        }
    },
    methods: {
        resetPassword: function() {
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
        forgotUsername: function() {
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