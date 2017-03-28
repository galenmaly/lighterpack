import dashboard from "./views/dashboard.vue";
import welcome from "./views/welcome.vue";
import signin from "./views/signin.vue";
import register from "./views/register.vue";

module.exports = [
    { path: "/", component: dashboard },
    { path: "/welcome", component: welcome },
    { path: "/signin", component: signin },
    { path: "/register", component: register },
    { path: "*", component: dashboard }
];