<style lang="scss">
#dashboard .hello-world {
    font-size: 15px;
    line-height: 1.8;
}
</style>

<template>
    <div v-if="shown">
        <div class="lpDialog" id="accountSettings">
            <h2>Account Settings</h2>

            <form id="accountForm" v-on:submit="updateAccount($event)">
                <input type="text" name="username" class="username" disabled :value="username"/>
                <input v-model="currentPassword" type="password" placeholder="Current Password" name="currentPassword" class="currentPassword"/>
                <hr>
                <input v-model="newEmail" type="email" placeholder="New Email" name="newEmail" class="newEmail" />
                <hr>
                <input v-model="newPassword" type="password" placeholder="New Password" name="newPassword" class="newPassword"/>
                <input v-model="confirmNewPassword" type="password" placeholder="Confirm New Password" name="confirmNewPassword" class="confirmNewPassword"/>

                <ul class="lpError" v-if="errors">
                    <li v-for="error in errors">{{error.message}}</li>
                </ul>

                <input type="submit" value="Submit" class="lpButton" />
                <a v-on:click="closeModal" class="lpHref">Cancel</a>
                <span class="status"></span>
            </form>
        </div>
        <div v-on:click="closeModal" class="lpModalOverlay"></div>
    </div>
</template>

<script>
const modalMixin = require("../mixins/modal-mixin.js");

export default {
    name: "account",
    mixins: [modalMixin],
    data: function() {
        return {
            errors: [],
            currentPassword: "",
            newEmail: "",
            newPassword: "",
            confirmNewPassword: ""
        }
    },
    computed: {
        library: function() {
            return this.$store.state.library;
        },
        username: function() {
            return this.$store.state.loggedIn;
        }
    },
    methods: {
        updateAccount: function(evt) {
            evt.preventDefault();

            this.errors = [];

            if (!this.currentPassword) {
                this.errors.push({field:"currentPassword", message: "Please enter your current password."});
            }

            if (this.newPassword && this.newPassword != this.confirmNewPassword) {
                this.errors.push({field:"newPassword", message: "Your passwords don't match."});
            }

            if (this.newPassword && (this.newPassword.length < 5 || this.newPassword.length > 60)) {
                this.errors.push({field:"newPassword", message: "Please enter a password between 5 and 60 characters."});
            }

            if (this.errors.length) {
                return;
            }

            var data = {username: this.username, currentPassword: this.currentPassword}

            var dirty = false;

            if (this.newPassword) {
                dirty = true;
                data.newPassword = this.newPassword;
            }
            if (this.newEmail) {
                dirty = true;
                data.newEmail = this.newEmail;
            }

            if (!dirty) return;

            this.currentPassword = "";

            fetchJson("/account", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            })
            .then((response) => {
                this.closeModal();
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
         bus.$on("showAccount", () => {
            this.openModal();
        });
    }
}
</script>