<style lang="scss">
#deleteAccount {
    width: 400px;
}
</style>

<template>
    <modal id="deleteAccount" :shown="shown" @hide="shown = false">
        <h2>Delete account?</h2>

        <form id="accountForm" @submit.prevent="deleteAccount()">
            <p class="warning">
                <strong>This action is permanent and cannot be undone.</strong>
            </p>
            <p>If you want to delete your account, please enter your current password and the text <strong>delete my account</strong>:</p>
            <div class="lpFields">
                <input v-model="currentPassword" type="password" placeholder="Current password" name="currentPassword" class="currentPassword">

                <input v-model="confirmationText" type="text" name="confirmationText" placeholder="Confirmation text">
            </div>

            <errors :errors="errors" />

            <div class="lpButtons">
                <input type="submit" value="Permanently delete account" :class="{'lpButton': true, 'lpButtonDisabled': !isConfirmationComplete}">
                <a class="lpHref" @click="shown = false">Cancel</a>
            </div>
        </form>
    </modal>
</template>

<script>
import errors from './errors.vue';
import modal from './modal.vue';

export default {
    name: 'Account',
    components: {
        errors,
        modal,
    },
    data() {
        return {
            deleting: false,
            errors: [],
            confirmationText: '',
            currentPassword: '',
            shown: false,
        };
    },
    computed: {
        isConfirmationComplete() {
            return this.confirmationText.toLocaleLowerCase() === 'delete my account';
        },
    },
    beforeMount() {
        bus.$on('showDeleteAccount', () => {
            this.shown = true;
        });
    },
    methods: {
        deleteAccount() {
            this.errors = [];

            if (!this.currentPassword) {
                this.errors.push({ field: 'currentPassword', message: 'Please enter your current password.' });
            }

            if (!this.isConfirmationComplete) {
                this.errors.push({ field: 'confirmationText', message: 'Please enter the confirmation text.' });
            }

            if (this.errors.length) {
                return;
            }

            fetchJson('/delete-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ username: this.$store.state.loggedIn, password: this.currentPassword }),
            })
                .then((response) => {
                    this.deleting = false;
                    this.$store.commit('signout');
                    this.$router.push('/signin');
                })
                .catch((err) => {
                    this.errors = err;
                    this.deleting = false;
                });
        },
    },
};
</script>
