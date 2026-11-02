// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    namespace NodeJS {
        interface Process {
            cronsRegistered?: boolean;
        }
    }
}

export {};
