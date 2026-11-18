import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(secretOverride?: string): Buffer {
    const secret =
        secretOverride || process.env.HA_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            'Missing encryption key: set HA_ENCRYPTION_KEY or JWT_SECRET in environment'
        );
    }
    return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string, secretOverride?: string): string {
    const key = getEncryptionKey(secretOverride);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string, secretOverride?: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted secret format');
    }

    const [ivB64, tagB64, dataB64] = parts;
    const key = getEncryptionKey(secretOverride);
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
