import routePaths from './route-paths.js';
import dashboard from './views/dashboard.vue';
import gear from './views/gear.vue';
import welcome from './views/welcome.vue';
import signin from './views/signin.vue';
import register from './views/register.vue';
import forgotPassword from './views/forgot-password.vue';
import resetPassword from './views/reset-password.vue';
import moderation from './views/moderation.vue';

const components = {
    '/': dashboard,
    '/gear': gear,
    '/welcome': welcome,
    '/signin': signin,
    '/signin/reset-password': signin,
    '/signin/forgot-username': signin,
    '/register': register,
    '/forgot-password': forgotPassword,
    '/reset-password/:token': resetPassword,
    '/moderation': moderation,
};

export default [
    ...routePaths.map((path) => {
        const component = components[path];
        if (!component) {
            throw new Error(`No component registered for route ${path}`);
        }
        return { path, component };
    }),
    { path: '/:pathMatch(.*)*', component: dashboard },
];
