<template>
    <div id="forgotPasswordContainer">
        <modal id="forgotPassword" class="lpAuthCard" :shown="true" :blackout="true">
            <div class="columns">
                <div class="lpHalf">
                    <h3>
                        Forgot Your Password?
                    </h3>

                    <p>Enter your username and we'll email you a link to choose a new password.</p>
                    <form class="forgotPassword" @submit.prevent="requestPasswordReset">
                        <div class="lpFields">
                            <input v-model="forgotPasswordUsername" type="text" placeholder="Username" name="username" class="username">
                            <input type="submit" value="Submit" class="lpButton">
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
                            <input v-model="forgotUsernameEmail" type="text" placeholder="Email Address" name="email" class="email">
                            <input type="submit" value="Submit" class="lpButton">
                        </div>

                        <errors :errors="forgotUsernameErrors" />
                    </form>
                </div>
                <router-link to="/signin" class="lpHref">
                    &larr; Return to sign in
                </router-link>
            </div>
        </modal>
        <siteFooter fixed />
    </div>
</template>

<script>
import siteFooter from '../components/site-footer.vue';
import errors from '../components/errors.vue';
import modal from '../components/modal.vue';
import { fetchJson } from '../utils/utils.js';

export default {
    name: 'ForgotPassword',
    components: {
        siteFooter,
        errors,
        modal,
    },
    data() {
        return {
            forgotPasswordUsername: '',
            forgotPasswordErrors: [],
            forgotUsernameEmail: '',
            forgotUsernameErrors: [],
        };
    },
    methods: {
        requestPasswordReset() {
            this.forgotPasswordErrors = [];

            return fetchJson('/forgotPassword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ username: this.forgotPasswordUsername }),
            })
                .then((_response) => {
                    this.$router.push('/signin/reset-password');
                })
                .catch((response) => {
                    let errors = [{ message: 'An error occurred, please try again later.' }];
                    if (response.json && response.json.errors) {
                        errors = response.json.errors;
                    }
                    this.forgotPasswordErrors = errors;
                });
        },
        forgotUsername() {
            this.forgotUsernameErrors = [];

            return fetchJson('/forgotUsername', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ email: this.forgotUsernameEmail }),
            })
                .then((_response) => {
                    this.$router.push('/signin/forgot-username');
                })
                .catch((response) => {
                    let errors = [{ message: 'An error occurred, please try again later.' }];
                    if (response.json && response.json.errors) {
                        errors = response.json.errors;
                    }
                    this.forgotUsernameErrors = errors;
                });
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// Two halves side by side need more room than a default dialog.
@media only screen and (width > $mobile) {
    #forgotPassword {
        width: 620px;
    }
}

// On a phone they stack instead: at 50% of a 320px viewport neither form has
// room for its heading, let alone its field. Without this the card keeps the
// 620px above and hangs off both edges of the screen.
@media only screen and (width <= $mobile) {
    #forgotPasswordContainer .lpModal .lpHalf {
        float: none;
        padding: 0;
        width: 100%;

        // A rule between them, so the two separate requests do not read as one
        // long form once they are in a single column.
        + .lpHalf {
            border-top: 1px solid var(--lp-border);
            margin-top: 22px;
            padding-top: 22px;
        }
    }

    // The halves are floated on desktop, where this link clears them on its
    // own. Stacked, it needs the separation stated. Its row treatment is the
    // shared one in _auth-pages.
    #forgotPasswordContainer .columns > .lpHref {
        margin-top: 6px;
    }
}

</style>
