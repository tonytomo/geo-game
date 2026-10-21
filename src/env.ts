import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
    WS_URL: {
        public: true,
        static: true,
    },
    GOOGLE_MAPS_API_KEY: {
        public: true,
        static: true,
    }
});