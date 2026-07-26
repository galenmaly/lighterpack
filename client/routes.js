import dashboard from './views/dashboard.vue';
import welcome from './views/welcome.vue';
import signin from './views/signin.vue';
import register from './views/register.vue';
import forgotPassword from './views/forgot-password.vue';
import resetPassword from './views/reset-password.vue';
import moderation from './views/moderation.vue';

export default [
    { path: '/', component: dashboard },
    { path: '/welcome', component: welcome },
    { path: '/signin', component: signin },
    { path: '/signin/reset-password', component: signin },
    { path: '/signin/forgot-username', component: signin },
    { path: '/register', component: register },
    { path: '/forgot-password', component: forgotPassword },
    { path: '/reset-password/:token', component: resetPassword },
    { path: '/moderation', component: moderation },
    { path: '/:pathMatch(.*)*', component: dashboard },
];
