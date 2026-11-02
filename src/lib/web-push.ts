import { PUBLIC_VAPI_KEY } from '$env/static/public';
import { API } from './api';
import { urlBase64ToUint8Array } from './functions';
/* eslint-disable no-console */

export enum Error {
    NOT_SUPPORTED = 'Váš prohlížeč nepodporuje notifikace',
    NO_NOTIFICATION = 'Pokud váš systém je IOS, je potřeba aplikaci stáhnout (přidat na plochu)'
}

const cleanupLegacyWorkers = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
            if (reg.scope.includes('/webworker/')) {
                console.log('Unregistering legacy webworker scope:', reg.scope);
                await reg.unregister();
            }
        }
    } catch (e) {
        console.warn('Error cleaning up legacy workers:', e);
    }
};

const getPwaRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;
    await cleanupLegacyWorkers();

    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
        try {
            registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
        } catch (e) {
            console.error('Failed to register /sw.js:', e);
        }
    }

    try {
        return await navigator.serviceWorker.ready;
    } catch {
        return registration ?? null;
    }
};

export const subscribePush = async () => {
    if (!('serviceWorker' in navigator || 'PushManager' in window)) {
        console.log('Service workers are not supported or push manager is not supported');
        return Error.NOT_SUPPORTED;
    }

    if (!('Notification' in window)) {
        return Error.NO_NOTIFICATION;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Notification permission denied');
            return false;
        }

        const registration = await getPwaRegistration();
        if (!registration) {
            console.error('No service worker registration available');
            return false;
        }

        const subscription = await registration.pushManager.getSubscription();
        console.log('Current subscription:', subscription);

        if (!subscription) {
            console.log('Subscribing to push notifications');
            const newSub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPI_KEY)
            });

            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await API.push.subscribe(newSub.toJSON() as any);
            if (!result.status) return false;
        }

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const unsubscribePush = async () => {
    if (!('serviceWorker' in navigator || 'PushManager' in window)) {
        console.log('Service workers are not supported or push manager is not supported');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            console.log('No service worker registration found');
            return false;
        }

        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            console.log('No push subscription found');
            return false;
        }

        const result = await API.push.unsubscribe({
            endpoint: subscription.endpoint
        });
        if (!result.status) return false;

        await subscription.unsubscribe();
        console.log('Unsubscribed from push notifications');
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};
