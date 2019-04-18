<style lang="scss">

</style>

<template>
    <modal :shown="shown" @hide="shown = false" id="accountSettings">
        <h2>Account Settings</h2>

        <form id="accountForm" @submit.prevent="updateAccount()">
            <div class="lpFields">
                <input type="text" name="username" class="username" disabled :value="username"/>
                <input v-model="currentPassword" type="password" placeholder="Current Password" name="currentPassword" class="currentPassword"/>
                <hr>
                <input v-model="newEmail" type="email" placeholder="New Email" name="newEmail" class="newEmail" />
                <hr>
                <input v-model="newPassword" type="password" placeholder="New Password" name="newPassword" class="newPassword"/>
                <input v-model="confirmNewPassword" type="password" placeholder="Confirm New Password" name="confirmNewPassword" class="confirmNewPassword"/>
            </div>

            <errors :errors="errors" />

            <div class="lpButtons">
                <input type="submit" value="Submit" class="lpButton" />
                <a @click="shown = false" class="lpHref">Cancel</a>
                <a @click="showDeleteAccount" class="lpHref">Delete account</a>
            </div>
        </form>
    </modal>
</template>

<script>
import errors from "./errors.vue";
import modal from "./modal.vue";

export default {
    name: "account",
    components: {
        errors,
        modal
    },
    data: function() {
        return {
            saving: false,
            errors: [],
            currentPassword: "",
            newEmail: "",
            newPassword: "",
            confirmNewPassword: "",
            shown: false
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
        updateAccount: function() {
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
            this.saving = true;

            fetchJson("/account", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            })
            .then((response) => {
                this.saving = false;
                this.shown = false;
            })
            .catch((err) => {
                this.errors = err;
                this.saving = false;
            });
        },
        showDeleteAccount: function() {
            this.shown = false;
            bus.$emit("showDeleteAccount");
        }
    },
    beforeMount: function() {
         bus.$on("showAccount", () => {
            this.shown = true;
        });
    }
}
</script>