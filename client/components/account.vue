<template>
    <modal id="accountSettings" :shown="shown" @hide="$emit('hide')">
        <h2>Account Settings</h2>

        <div class="lpAccountPreferences">
            <label>
                <input type="checkbox" data-testid="shared-item-bubble-toggle" :checked="sharedItemBubble" @change="toggleSharedItemBubble">
                Warn when editing an item that's in multiple lists
            </label>
            <label>
                <input type="checkbox" data-testid="worn-qty-hint-toggle" :checked="wornQtyHint" @change="toggleWornQtyHint">
                Note when a worn item has quantity over 1
            </label>
        </div>
        <hr>

        <form id="accountForm" @submit.prevent="updateAccount()">
            <div class="lpFields">
                <input type="text" name="username" class="username" disabled :value="username">
                <input v-model="currentPassword" type="password" placeholder="Current Password" name="currentPassword" class="currentPassword">
                <hr>
                <input v-model="newEmail" type="email" placeholder="New Email" name="newEmail" class="newEmail">
                <hr>
                <input v-model="newPassword" type="password" placeholder="New Password" name="newPassword" class="newPassword">
                <input v-model="confirmNewPassword" type="password" placeholder="Confirm New Password" name="confirmNewPassword" class="confirmNewPassword">
            </div>

            <errors :errors="errors" />

            <div class="lpButtons">
                <button class="lpButton">
                    Submit
                    <spinner v-if="saving" />
                </button>
                <a class="lpHref" @click="$emit('hide')">Cancel</a>
                <a class="lpHref" @click="showDeleteAccount">Delete account</a>
            </div>
        </form>
    </modal>
</template>

<script>
import errors from './errors.vue';
import modal from './modal.vue';
import spinner from './spinner.vue';
import { fetchJson } from '../utils/utils.js';

export default {
    name: 'Account',
    components: {
        errors,
        modal,
        spinner,
    },
    inject: ['openDeleteAccount'],
    props: {
        shown: {
            type: Boolean,
            required: true,
        },
    },
    emits: ['hide'],
    data() {
        return {
            saving: false,
            errors: [],
            currentPassword: '',
            newEmail: '',
            newPassword: '',
            confirmNewPassword: '',
        };
    },
    computed: {
        username() {
            return this.$store.state.loggedIn;
        },
        sharedItemBubble() {
            const library = this.$store.state.library;
            return !!(library && library.preferences.sharedItemBubble);
        },
        wornQtyHint() {
            const library = this.$store.state.library;
            return !!(library && library.preferences.wornQtyHint);
        },
    },
    methods: {
        toggleSharedItemBubble() {
            this.$store.commit('togglePreference', 'sharedItemBubble');
        },
        toggleWornQtyHint() {
            this.$store.commit('togglePreference', 'wornQtyHint');
        },
        updateAccount() {
            this.errors = [];

            if (!this.currentPassword) {
                this.errors.push({ field: 'currentPassword', message: 'Please enter your current password.' });
            }

            if (this.newPassword && this.newPassword != this.confirmNewPassword) {
                this.errors.push({ field: 'newPassword', message: "Your passwords don't match." });
            }

            if (this.newPassword && (this.newPassword.length < 5 || this.newPassword.length > 60)) {
                this.errors.push({ field: 'newPassword', message: 'Please enter a password between 5 and 60 characters.' });
            }

            if (this.errors.length) return;

            const data = { username: this.username, currentPassword: this.currentPassword };
            let dirty = false;

            if (this.newPassword) { dirty = true; data.newPassword = this.newPassword; }
            if (this.newEmail) { dirty = true; data.newEmail = this.newEmail; }

            if (!dirty) return;

            this.currentPassword = '';
            this.saving = true;

            fetchJson('/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(data),
            })
                .then(() => {
                    this.saving = false;
                    this.$emit('hide');
                })
                .catch((err) => {
                    this.errors = err;
                    this.saving = false;
                });
        },
        showDeleteAccount() {
            this.$emit('hide');
            this.openDeleteAccount();
        },
    },
};
</script>

<style lang="scss">

.lpAccountPreferences label {
    display: block;

    & + label {
        margin-top: 6px;
    }
}

</style>
