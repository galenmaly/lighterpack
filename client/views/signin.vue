<style lang="scss">

</style>

<template>
    <div id="signinContainer">
        <modal id="signin" :shown="true" :blackout="true">
            <div class="lpModalHeader">
                <h2>
                    Sign in
                </h2>
                <router-link to="/register" class="lpHref">
                    Need to register?
                </router-link>
            </div>

            <form class="signin" @submit.prevent="signin">
                <p v-if="message" class="lpSuccess">
                    {{ message }}
                </p>
                <div class="lpFields">
                    <input v-model="username" v-focus-on-create type="text" placeholder="Username" name="username" class="username">
                    <input v-model="password" v-select-on-bus="'focus-signin-password'" type="password" placeholder="Password" name="password" class="password">
                </div>

                <errors :errors="errors" />

                <div class="lpButtons">
                    <button class="lpButton">
                        Sign in
                        <spinner v-if="fetching" />
                    </button>
                    <router-link to="/forgot-password" class="lpHref alternateAction">
                        Forgot username/password?
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

export default {
    name: 'Welcome',
    components: {
        blackoutFooter,
        errors,
        modal,
        spinner,
    },
    data() {
        return {
            fetching: false,
            errors: [],
            username: '',
            password: '',
            message: '',
        };
    },
    beforeMount() {
        if (this.$route.path.indexOf('/reset-password') > -1 || this.$route.path.indexOf('/forgot-username') > -1) {
            this.message = 'An email has been sent to the address associated with your account.';
        }
    },
    methods: {
        signin() {
            this.errors = [];

            if (!this.username) {
                this.errors.push({ field: 'username', message: 'Please enter a username.' });
            }

            if (!this.password) {
                this.errors.push({ field: 'password', message: 'Please enter a password.' });
            }

            if (this.errors.length) {
                return;
            }

            this.fetching = true; // ho ho

            return fetchJson('/signin/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ username: this.username, password: this.password }),
            })
                .then((response) => {
                    this.$store.commit('setSyncToken', response.syncToken);
                    this.$store.commit('loadLibraryData', response.library);
                    this.$store.commit('setSaveType', 'remote');
                    this.$store.commit('setLoggedIn', response.username);
                    this.$router.push('/');
                    this.fetching = false;
                })
                .catch((err) => {
                    this.errors = err;
                    bus.$emit('focus-signin-password');
                    this.password = '';
                    this.fetching = false;
                });
        },
    },
};
</script>
