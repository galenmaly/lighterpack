<template>
    <div id="resetPasswordContainer">
        <modal id="resetPassword" :shown="true" :blackout="true">
            <div class="lpModalHeader">
                <h2>
                    Choose a new password
                </h2>
                <router-link to="/signin" class="lpHref">
                    Return to sign in
                </router-link>
            </div>

            <form class="resetPassword lpFields" data-testid="reset-password-form" @submit.prevent="submit">
                <div class="lpFields">
                    <input v-model="password" v-focus-on-create type="password" placeholder="New password" name="password" class="password">
                    <input v-model="passwordConfirm" type="password" placeholder="Confirm new password" name="passwordConfirm" class="passwordConfirm">
                </div>

                <errors :errors="errors" />

                <div class="lpButtons">
                    <button class="lpButton">
                        Save new password
                        <spinner v-if="saving" />
                    </button>

                    <router-link to="/forgot-password" class="lpHref">
                        Request a new link
                    </router-link>
                </div>
            </form>
        </modal>

        <blackoutFooter />
    </div>
</template>

<script>
import blackoutFooter from '../components/blackout-footer.vue';
import errors from '../components/errors.vue';
import modal from '../components/modal.vue';
import spinner from '../components/spinner.vue';
import { fetchJson } from '../utils/utils.js';

export default {
    name: 'ResetPassword',
    components: {
        blackoutFooter,
        errors,
        modal,
        spinner,
    },
    data() {
        return {
            password: '',
            passwordConfirm: '',
            saving: false,
            errors: [],
        };
    },
    computed: {
        token() {
            return this.$route.params.token;
        },
    },
    methods: {
        submit() {
            this.errors = [];

            if (!this.password) {
                this.errors.push({ field: 'password', message: 'Please enter a password.' });
            }

            if (!this.passwordConfirm) {
                this.errors.push({ field: 'passwordConfirm', message: 'Please enter a password confirmation.' });
            }

            if (this.password && this.passwordConfirm && this.password !== this.passwordConfirm) {
                this.errors.push({ field: 'password', message: "Your passwords don't match." });
            }

            if (this.password && (this.password.length < 5 || this.password.length > 60)) {
                this.errors.push({ field: 'password', message: 'Please enter a password between 5 and 60 characters.' });
            }

            if (this.errors.length) {
                return;
            }

            this.saving = true;

            return fetchJson('/resetPassword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ token: this.token, password: this.password }),
            })
                .then((response) => {
                    // The reset signs us in, so pick up the session exactly as
                    // the signin form does.
                    this.$store.commit('setSyncToken', response.sync_token);
                    this.$store.commit('loadLibraryData', response.library);
                    this.$store.commit('setSaveType', 'remote');
                    this.$store.commit('setLoggedIn', response.username);
                    this.saving = false;
                    this.$router.push('/');
                })
                .catch((err) => {
                    this.saving = false;
                    this.errors = err.errors || [{ message: err.message }];
                });
        },
    },
};
</script>

<style lang="scss">

</style>
