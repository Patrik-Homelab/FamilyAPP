import type { PageServerLoad } from './$types';
import fs from 'node:fs';

export const load = (async () => {
    const files = fs.readdirSync('./changelog').sort((a, b) => {
        // Extract version numbers from filenames (e.g., "0.0.10.md" -> [0, 0, 10])
        const versionA = a
            .replace('.md', '')
            .split('.')
            .map((n) => parseInt(n, 10) || 0);
        const versionB = b
            .replace('.md', '')
            .split('.')
            .map((n) => parseInt(n, 10) || 0);

        // Compare version numbers semantically
        for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
            const numA = versionA[i] || 0;
            const numB = versionB[i] || 0;
            if (numA !== numB) {
                return numA - numB;
            }
        }
        return 0;
    });

    const fileContents = files.map((file) =>
        fs.readFileSync(`./changelog/${file}`, 'utf-8')
    );

    return {
        changelog: fileContents.toReversed()
    };
}) satisfies PageServerLoad;
