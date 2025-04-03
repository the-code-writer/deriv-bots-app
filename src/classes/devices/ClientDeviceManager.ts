/**
 * Interfaces representing the device components
 */

interface BrowserInfo {
    name: string;
    version: string;
    major: string;
    type: string | null;
}

interface CPUInfo {
    architecture: string | null;
}

interface DeviceInfo {
    type: string | null;
    model: string;
    vendor: string;
}

interface EngineInfo {
    name: string;
    version: string;
}

interface OSInfo {
    name: string;
    version: string;
}

interface NetworkInfo {
    ipAddress: string;
    isp: string | null;
    asn: string | null;
    location: GeoLocation | null;
}

interface GeoLocation {
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
}

interface EncryptionKeys {
    publicKey: string;
    privateKey: string; // Note: In real implementation, private key should be stored securely
    keyAlgorithm: string;
    keyExpiry: Date;
    lastRotated: Date;
}

interface DeviceRegistration {
    isRegistered: boolean;
    registrationDate: Date | null;
    deviceId: string | null;
    lastAuthenticated: Date | null;
}

interface OAuthInfo {
    clientId: string | null;
    token: string | null;
    tokenExpiry: Date | null;
    refreshToken: string | null;
    scopes: string[];
}

/**
 * Main interface representing a client device
 */
interface ClientDevice {
    userAgent: string;
    browser: BrowserInfo;
    cpu: CPUInfo;
    device: DeviceInfo;
    engine: EngineInfo;
    os: OSInfo;
    network: NetworkInfo;
    encryption: EncryptionKeys;
    registration: DeviceRegistration;
    oauth: OAuthInfo;
    lastSeen: Date;
    firstSeen: Date;
    isTrusted: boolean;
    isCompromised: boolean;
    metadata: Record<string, any>;
}

/**
 * Interface for device registration options
 */
interface RegisterDeviceOptions {
    generateKeys?: boolean;
    keyAlgorithm?: string;
    keyExpiryDays?: number;
    markAsTrusted?: boolean;
}

/**
 * Interface for device authentication options
 */
interface AuthenticateDeviceOptions {
    requireFreshKeys?: boolean;
    validateLocation?: boolean;
    minimumTrustLevel?: number;
}

/**
 * Main class for managing client devices
 */
class ClientDeviceManager {
    private device: ClientDevice;

    /**
     * Creates a new ClientDeviceManager instance
     * @param initialData Optional initial device data
     */
    constructor(initialData?: Partial<ClientDevice>) {
        const now = new Date();

        // Default values
        this.device = {
            userAgent: '',
            browser: { name: '', version: '', major: '', type: null },
            cpu: { architecture: null },
            device: { type: null, model: '', vendor: '' },
            engine: { name: '', version: '' },
            os: { name: '', version: '' },
            network: {
                ipAddress: '',
                isp: null,
                asn: null,
                location: {
                    country: null,
                    region: null,
                    city: null,
                    latitude: null,
                    longitude: null
                }
            },
            encryption: {
                publicKey: '',
                privateKey: '',
                keyAlgorithm: 'RSA-OAEP',
                keyExpiry: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year default
                lastRotated: now
            },
            registration: {
                isRegistered: false,
                registrationDate: null,
                deviceId: null,
                lastAuthenticated: null
            },
            oauth: {
                clientId: null,
                token: null,
                tokenExpiry: null,
                refreshToken: null,
                scopes: []
            },
            lastSeen: now,
            firstSeen: now,
            isTrusted: false,
            isCompromised: false,
            metadata: {},
            ...initialData
        };
    }

    /**
     * Gets the complete device information
     * @returns A deep copy of the device data
     */
    public getDeviceInfo(): ClientDevice {
        return JSON.parse(JSON.stringify(this.device));
    }

    /**
     * Updates the device information
     * @param updates Partial device data to update
     */
    public updateDeviceInfo(updates: Partial<ClientDevice>): void {
        this.device = { ...this.device, ...updates };
        this.device.lastSeen = new Date();
    }

    /**
     * Registers the device in the system
     * @param options Registration options
     * @returns The registration result
     */
    public async registerDevice(options: RegisterDeviceOptions = {}): Promise<DeviceRegistration> {
        const {
            generateKeys = true,
            keyAlgorithm = 'RSA-OAEP',
            keyExpiryDays = 365,
            markAsTrusted = false
        } = options;

        const now = new Date();

        if (generateKeys) {
            await this.generateKeyPair(keyAlgorithm, keyExpiryDays);
        }

        this.device.registration = {
            isRegistered: true,
            registrationDate: now,
            deviceId: this.generateDeviceId(),
            lastAuthenticated: now
        };

        this.device.isTrusted = markAsTrusted;
        this.device.lastSeen = now;

        return { ...this.device.registration };
    }

    /**
     * Authenticates the device
     * @param options Authentication options
     * @returns Authentication result
     */
    public async authenticateDevice(options: AuthenticateDeviceOptions = {}): Promise<boolean> {
        const {
            requireFreshKeys = true,
            validateLocation = false,
            minimumTrustLevel = 0
        } = options;

        // Check registration
        if (!this.device.registration.isRegistered) {
            throw new Error('Device is not registered');
        }

        // Check key validity
        if (requireFreshKeys && this.device.encryption.keyExpiry < new Date()) {
            throw new Error('Encryption keys have expired');
        }

        // Check trust level
        if (minimumTrustLevel > 0 && !this.device.isTrusted) {
            throw new Error('Device does not meet minimum trust level');
        }

        // Check if compromised
        if (this.device.isCompromised) {
            throw new Error('Device is marked as compromised');
        }

        // Validate location if required
        if (validateLocation && !this.validateLocationConsistency()) {
            throw new Error('Location validation failed');
        }

        this.device.registration.lastAuthenticated = new Date();
        this.device.lastSeen = new Date();

        return true;
    }

    /**
     * Generates a new key pair for the device
     * @param algorithm Key algorithm to use
     * @param expiryDays Number of days until key expiry
     */
    public async generateKeyPair(algorithm: string = 'RSA-OAEP', expiryDays: number = 365): Promise<void> {
        const now = new Date();
        const keyExpiry = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

        // In a real implementation, this would generate actual cryptographic keys
        const keys = {
            publicKey: `pk_${Math.random().toString(36).substring(2)}`,
            privateKey: `sk_${Math.random().toString(36).substring(2)}`,
            keyAlgorithm: algorithm,
            keyExpiry,
            lastRotated: now
        };

        this.device.encryption = keys;
    }

    /**
     * Rotates the encryption keys
     * @param keepPrevious Whether to keep the previous keys in metadata
     */
    public async rotateKeys(keepPrevious: boolean = false): Promise<void> {
        if (keepPrevious) {
            this.device.metadata.previousKeys = this.device.metadata.previousKeys || [];
            this.device.metadata.previousKeys.push({ ...this.device.encryption });
        }

        await this.generateKeyPair(this.device.encryption.keyAlgorithm);
    }

    /**
     * Encrypts data using the device's public key
     * @param data Data to encrypt
     * @returns Encrypted data
     */
    public async encryptData(data: string): Promise<string> {
        if (!this.device.encryption.publicKey) {
            throw new Error('No public key available for encryption');
        }

        // In a real implementation, this would use actual encryption
        return `encrypted_${data}_with_${this.device.encryption.publicKey.substring(0, 8)}`;
    }

    /**
     * Decrypts data using the device's private key
     * @param encryptedData Data to decrypt
     * @returns Decrypted data
     */
    public async decryptData(encryptedData: string): Promise<string> {
        if (!this.device.encryption.privateKey) {
            throw new Error('No private key available for decryption');
        }

        // In a real implementation, this would use actual decryption
        return encryptedData.replace(/^encrypted_/, '').replace(/_with_.*$/, '');
    }

    /**
     * Updates the network information
     * @param ipAddress New IP address
     * @param geoData Optional geographic data
     */
    public updateNetworkInfo(ipAddress: string, geoData?: Partial<GeoLocation>): void {
        this.device.network.ipAddress = ipAddress;

        if (geoData) {
            this.device.network.location = {
                ...this.device.network.location,
                ...geoData
            };
        }

        this.device.lastSeen = new Date();
    }

    /**
     * Marks the device as trusted or untrusted
     * @param trusted Whether to mark as trusted
     */
    public setTrustStatus(trusted: boolean): void {
        this.device.isTrusted = trusted;
    }

    /**
     * Marks the device as compromised
     * @param compromised Whether the device is compromised
     * @param reason Optional reason for marking
     */
    public markAsCompromised(compromised: boolean, reason?: string): void {
        this.device.isCompromised = compromised;

        if (reason) {
            this.device.metadata.compromiseReason = reason;
            this.device.metadata.compromiseDate = new Date();
        }
    }

    /**
     * Generates a unique device ID
     * @returns Generated device ID
     */
    private generateDeviceId(): string {
        return `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    }

    /**
     * Validates location consistency
     * @returns Whether location is consistent with previous data
     */
    private validateLocationConsistency(): boolean {
        // In a real implementation, this would compare with previous locations
        return true;
    }
}

// Example Usage:
// const deviceManager = new ClientDeviceManager({
//     userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
//     browser: {
//         name: "Chrome",
//         version: "134.0.0.0",
//         major: "134",
//         type: null
//     },
//     device: {
//         type: null,
//         model: "Macintosh",
//         vendor: "Apple"
//     },
//     os: {
//         name: "macOS",
//         version: "10.15.7"
//     }
// });

// // Set network information
// deviceManager.updateNetworkInfo('192.168.1.100', {
//     country: 'US',
//     city: 'New York'
// });

// // Register the device
// await deviceManager.registerDevice({
//     generateKeys: true,
//     markAsTrusted: true
// });

// // Authenticate the device
// try {
//     const isAuthenticated = await deviceManager.authenticateDevice();
//     console.log('Authentication successful:', isAuthenticated);
// } catch (error) {
//     console.error('Authentication failed:', error.message);
// }

// // Encrypt data
// const encrypted = await deviceManager.encryptData('sensitive data');
// console.log('Encrypted data:', encrypted);

// // Get device info
// const deviceInfo = deviceManager.getDeviceInfo();
// console.log('Device info:', deviceInfo);