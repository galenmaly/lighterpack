<style lang="scss">

</style>

<template>
    <form class="register" v-on:submit="submit($event)">
        <div class="lpError"></div>
        <input v-focus-on-create type="text" placeholder="Username" name="username" v-model="username" />
        <input type="email" placeholder="Email" name="email" v-model="email" />
        <input type="password" placeholder="Password" name="password" v-model="password" />
        <input type="password" placeholder="Confirm Password" name="passwordConfirm" v-model="passwordConfirm" />
        <ul class="lpError" v-if="errors">
            <li v-for="error in errors">{{error.message}}</li>
        </ul>
        <input type="submit" value="Register" class="lpButton" />
        <span class="status"></span>
    </form>
</template>

<script>

export default {
    name: "registerForm",
    mixins: [],
    data: function() {
        return {
            username: "",
            email: "",
            password: "",
            passwordConfirm: "",
            errors: []
        }
    },
    methods: {
        submit(evt) {
            evt.preventDefault();

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
                router.push("/");
            })
            .catch((response) => {
                if (response.json && response.json.errors) {
                    this.errors = response.json.errors;
                } else {
                    this.errors = [{message: "An error occurred while registering. Please try again later."}];
                }
            });
        }
    },
    beforeMount: function() {
    }
}
</script>