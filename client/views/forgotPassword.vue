<style lang="scss">

</style>

<template>
    <div class="lpDialog" id="forgotPassword">
        <div class="columns">
            <div class="lpHalf">
                <h3>
                    Forgot Your Password?
                </h3>

                <p>If you've forgotten your password we will email you a new one. Please enter your username.</p>
                <form class="forgotPassword">
                    <div class="lpError"></div>
                    <input type="text" placeholder="Username" name="username" class="username"/>
                    <input type="submit" value="Submit" class="lpButton" />
                    <span class="status"></span>
                    <a class="lpHref alternateAction" href="#signin">Return to sign in</a>
                </form>
            </div>
            <div class="lpHalf">
                <h3>
                    Forgot Your Username?
                </h3>

                <p>If you've forgotten your username we will email it to you. Please enter your email address.</p>
                <form class="forgotUsername">
                    <div class="lpError"></div>
                    <input type="text" placeholder="Email Address" name="email" class="email"/>
                    <input type="submit" value="Submit" class="lpButton" />
                    <span class="status"></span>
                    <a class="lpHref alternateAction" href="#signin">Return to sign in</a>
                </form>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "forgotPassword",
    mixins: [],
    data: function() {
        return {
        }
    },
    beforeMount: function() {
    }
}
</script>