<style lang="scss">
#dashboard .hello-world {
    font-size: 15px;
    line-height: 1.8;
}
</style>

<template>
    <div class="lpDialog" id="accountSettings">
        <h2>Account Settings</h2>

        <form id="accountForm">
            <div class="lpError"></div>
            <input type="text" name="username" class="username" disabled />
            <input type="password" placeholder="Current Password" name="currentPassword" class="currentPassword"/>
            <hr>
            <input type="email" placeholder="New Email" name="newEmail" class="newEmail" />
            <hr>
            <input type="password" placeholder="New Password" name="newPassword" class="newPassword"/>
            <input type="password" placeholder="Confirm New Password" name="confirmNewPassword" class="confirmNewPassword"/>

            <input type="submit" value="Submit" class="lpButton" />
            <a href="#" class="lpHref close">Cancel</a>
            <span class="status"></span>
        </form>
    </div>
</template>

<script>

export default {
    name: "account",
    mixins: [],
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>