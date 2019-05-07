<style lang="scss">

</style>

<template>
    <form class="lpRegister lpFields" @submit.prevent="submit">
        <div class="lpFields">
            <input v-focus-on-create type="text" placeholder="Username" name="username" v-model="username" />
            <input type="email" placeholder="Email" name="email" v-model="email" />
            <input type="password" placeholder="Password" name="password" v-model="password" />
            <input type="password" placeholder="Confirm password" name="passwordConfirm" v-model="passwordConfirm" />
        </div>
        <errors :errors="errors" />
        <div class="lpButtons">
            <button class="lpButton">
                Register
                <spinner v-if="saving" />
            </button>
        </div>
    </form>
</template>

<script>
import errors from "./errors.vue";
import spinner from "./spinner.vue";

export default {
    name: "registerForm",
    components: {
        errors,
        spinner
    },
    data: function() {
        return {
            username: "",
            email: "",
            password: "",
            passwordConfirm: "",
            saving: false,
            errors: []
        }
    },
    methods: {
        submit() {
            this.errors = [];

            if (!this.username) {
                this.errors.push({field: "username", message: "Please enter a username."});
            }

            if (this.username && (this.username.length < 3 || this.username.length > 32)) {
                this.errors.push({field: "username", message: "Please enter a username between 3 and 32 characters."});
            }

            if (!this.email) {
                this.errors.push({field: "email", message: "Please enter an email."});
            }

            if (!this.password) {
                this.errors.push({field: "password", message: "Please enter a password."});
            }

            if (!this.passwordConfirm) {
                this.errors.push({field: "passwordConfirm", message: "Please enter a password confirmation."});
            }

            if (this.password && this.passwordConfirm && this.password !== this.passwordConfirm) {
                this.errors.push({field: "password", message: "Your passwords don't match."});
            }

            if (this.password && (this.password.length < 5 || this.password.length > 60)) {
                this.errors.push({field: "password", message: "Please enter a password between 5 and 60 characters."});
            }

            if (this.errors.length) {
                return;
            }

            var registerData = {username: this.username, email: this.email, password: this.password};

            if (localStorage.library) {
                registerData.library = localStorage.library;
            }

            this.saving = true;
            return fetchJson("/register", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(registerData)
            })
            .then((response) => {
                this.$store.commit('setSyncToken', response.syncToken);
                this.$store.commit('loadLibraryData', response.library);
                this.$store.commit('setSaveType', "remote");
                this.$store.commit('setLoggedIn', response.username)

                if (registerData.library) {
                    localStorage.registeredLibrary = localStorage.library;
                    delete localStorage.library;
                }
                this.saving = false;
                router.push("/");
            })
            .catch((err) => {
                this.saving = false;
                this.errors = err;
            });
        }
    },
    beforeMount: function() {
    }
}
</script>