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
                <div class="lpError"></div>
                <input type="text" name="username" class="username" disabled :value="username"/>
                <input v-model="currentPassword" type="password" placeholder="Current Password" name="currentPassword" class="currentPassword"/>
                <hr>
                <input v-model="newEmail" type="email" placeholder="New Email" name="newEmail" class="newEmail" />
                <hr>
                <input v-model="newPassword" type="password" placeholder="New Password" name="newPassword" class="newPassword"/>
                <input v-model="confirmNewPassword" type="password" placeholder="Confirm New Password" name="confirmNewPassword" class="confirmNewPassword"/>

                <input type="submit" value="Submit" class="lpButton" />
                <a href="#" class="lpHref close">Cancel</a>
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
            error: false,
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

            this.error = "";
            if (!this.currentPassword) this.error = "Please enter a password.";
            if (this.newPassword && this.newPassword != this.confirmNewPassword) this.error = "New passwords don't match!";

            if (this.error) {
                return;
            }

            var hash = CryptoJS.SHA3(this.currentPassword+this.username);
            hash = hash.toString(CryptoJS.enc.Base64);
            var data = {username: this.username, password: hash}

            var dirty = false;

            if (this.newPassword) {
                dirty = true;
                var newHash = CryptoJS.SHA3(this.newPassword+this.username);
                newHash = newHash.toString(CryptoJS.enc.Base64);
                data.newPassword = newHash;
            }
            if (this.newEmail) {
                dirty = true;
                data.newEmail = this.newEmail;
            }

            if (!dirty) return;

            this.currentPassword = "";

            fetch("/account", {
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
                var error = "An error occurred while trying to save your account information.";
                if (response.responseText) {
                    this.error = response.responseText;
                }
                this.error = error;
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