import CryptoJS from 'crypto-js';
import NodeRSA from 'node-rsa';

export class Encryption {
    /**
     * Encodes a string to Base64.
     * @param {string} data - The string to encode.
     * @returns {string} The Base64 encoded string.
     */
    static base64Encode(data: string): string {
        return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
    }

    /**
     * Decodes a Base64 encoded string.
     * @param {string} data - The Base64 encoded string.
     * @returns {string} The decoded string.
     */
    static base64Decode(data: string): string {
        return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
    }

    /**
     * Encrypts a string using AES encryption.
     * @param {string} data - The string to encrypt.
     * @param {string} key - The encryption key.
     * @returns {string} The AES encrypted string in Base64 format.
     */
    static encryptAES(data: string, key: string): string {
        const encrypted = CryptoJS.AES.encrypt(data, key);
        return encrypted.toString();
    }

    /**
     * Decrypts an AES encrypted string.
     * @param {string} encryptedData - The AES encrypted string in Base64 format.
     * @param {string} key - The encryption key.
     * @returns {string} The decrypted string.
     */
    static decryptAES(encryptedData: string, key: string): string {
        const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
        return decrypted.toString(CryptoJS.enc.Utf8);
    }

    /**
     * Generates a SHA-1 hash of the input string.
     * @param {string} data - The string to hash.
     * @returns {string} The SHA-1 hash in hexadecimal format.
     */
    static sha1(data: string): string {
        return CryptoJS.SHA1(data).toString();
    }

    /**
     * Generates a SHA-256 hash of the input string.
     * @param {string} data - The string to hash.
     * @returns {string} The SHA-256 hash in hexadecimal format.
     */
    static sha256(data: string): string {
        return CryptoJS.SHA256(data).toString();
    }

    /**
     * Generates a SHA-512 hash of the input string.
     * @param {string} data - The string to hash.
     * @returns {string} The SHA-512 hash in hexadecimal format.
     */
    static sha512(data: string): string {
        return CryptoJS.SHA512(data).toString();
    }

    /**
     * Generates an MD5 hash of the input string.
     * @param {string} data - The string to hash.
     * @returns {string} The MD5 hash in hexadecimal format.
     */
    static md5(data: string): string {
        return CryptoJS.MD5(data).toString();
    }

    /**
     * Generates a random password of the specified length.
     * @param {number} length - The length of the password. Default is 16.
     * @returns {string} The generated password.
     */
    static generatePassword(length: number = 16): string {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }
        return password;
    }

    /**
     * Hashes a password using SHA-256 and a salt.
     * @param {string} password - The password to hash.
     * @param {string | null} salt - The salt to use. If null, a random salt is generated.
     * @returns {string} The hashed password in the format "salt:hash".
     */
    static hashPassword(password: string, salt: string | null = null): string {
        if (!salt) {
            salt = CryptoJS.lib.WordArray.random(16).toString();
        }
        const hashedPassword = CryptoJS.SHA256(salt + password).toString();
        return `${salt}:${hashedPassword}`;
    }

    /**
     * Compares a password with a hashed password.
     * @param {string} password - The password to compare.
     * @param {string} hashedPassword - The hashed password in the format "salt:hash".
     * @returns {boolean} True if the password matches the hashed password, false otherwise.
     */
    static passwordCompare(password: string, hashedPassword: string): boolean {
        const [salt, hash] = hashedPassword.split(':');
        const newHash = CryptoJS.SHA256(salt + password).toString();
        return newHash === hash;
    }

    /**
     * Generates a random key of the specified length.
     * @param {number} length - The length of the key. Default is 32.
     * @returns {string} The generated random key.
     */
    static generateRandomKey(length: number = 32): string {
        return CryptoJS.lib.WordArray.random(length).toString();
    }

    /**
     * Generates an RSA key pair.
     * @returns {{ privateKey: string, publicKey: string }} An object containing the private and public keys in PEM format.
     */
    static generateRSAKeyPair(): { privateKey: string; publicKey: string } {
        const key = new NodeRSA({ b: 2048 }); // Generate a 2048-bit key pair
        const privateKey = key.exportKey('private'); // Export private key in PEM format
        const publicKey = key.exportKey('public'); // Export public key in PEM format
        return { privateKey, publicKey };
    }

    /**
     * Encrypts a message using RSA public key.
     * @param {string} message - The message to encrypt.
     * @param {string} publicKey - The public key in PEM format.
     * @returns {string} The encrypted message in Base64 format.
     */
    static encryptRSA(message: string, publicKey: string): string {
        const key = new NodeRSA(publicKey); // Load the public key
        return key.encrypt(message, 'base64'); // Encrypt the message and return in Base64
    }

    /**
     * Decrypts a message using RSA private key.
     * @param {string} encryptedMessage - The encrypted message in Base64 format.
     * @param {string} privateKey - The private key in PEM format.
     * @returns {string} The decrypted message.
     */
    static decryptRSA(encryptedMessage: string, privateKey: string): string {
        const key = new NodeRSA(privateKey); // Load the private key
        return key.decrypt(encryptedMessage, 'utf8'); // Decrypt the message and return as UTF-8 string
    }
}
