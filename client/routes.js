import dashboard from "./views/dashboard.vue";
import welcome from "./views/welcome.vue";
import signin from "./views/signin.vue";
import register from "./views/register.vue";
import forgotPassword from "./views/forgotPassword.vue";

module.exports = [
    { path: "/", component: dashboard },
    { path: "/welcome", component: welcome },
    { path: "/signin", component: signin },
    { path: "/signin/reset-password", component: signin },
    { path: "/signin/forgot-username", component: signin },
    { path: "/register", component: register },
    { path: "/forgotPassword", component: forgotPassword },
    { path: "*", component: dashboard }
];