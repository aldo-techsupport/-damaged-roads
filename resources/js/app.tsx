import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { initializeTheme } from './hooks/use-appearance';
import { router } from '@inertiajs/react';
import GlobalLoading from './components/global-loading';

declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Global loading state
let isLoading = false;
let loadingTimeout: NodeJS.Timeout | null = null;

// Show loading screen on navigation start
router.on('start', () => {
    isLoading = true;
    // Show loading immediately
    const loadingEl = document.getElementById('global-loading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
});

// Hide loading screen on navigation finish
router.on('finish', () => {
    isLoading = false;
    // Keep loading visible for minimum 300ms for smooth transition
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
        const loadingEl = document.getElementById('global-loading');
        if (loadingEl && !isLoading) {
            loadingEl.style.display = 'none';
        }
    }, 300);
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <>
                <App {...props} />
                <div id="global-loading" style={{ display: 'none' }}>
                    <GlobalLoading />
                </div>
            </>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
