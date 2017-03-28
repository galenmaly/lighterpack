<style lang="scss">
#dashboard .hello-world {
    font-size: 15px;
    line-height: 1.8;
}
</style>

<template>
    <div id="dashboard" >
        <h1 class="hello-world">Hello World.</h1>
    </div>
</template>

<script>
export default {
    name: "dashboard",
    mixins: [],
    data: function() {
        return {
            onboardingCompleted: false
        }
    },
    beforeMount: function() {
    }
}
</script>