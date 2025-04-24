import { pino } from 'pino';
import { Encryption } from '@/classes/cryptography/EncryptionClass';

// Logger
const logger = pino({ name: "TelegramServiceExample" });

(async () => {
    
// Testing the Encryption class
const encoded = Encryption.base64Encode("Hello, World!");
console.log("Base64 Encoded:", encoded);

const decoded = Encryption.base64Decode(encoded);
console.log("Base64 Decoded:", decoded);

const encrypted = Encryption.encryptAES("Hello, World!", "mysecretkey");
console.log("AES Encrypted:", encrypted);

const decrypted = Encryption.decryptAES(encrypted, "mysecretkey");
console.log("AES Decrypted:", decrypted);

const hashed = Encryption.sha256("Hello, World!");
console.log("SHA-256 Hash:", hashed);

const password = Encryption.generatePassword();
console.log("Generated Password:", password);

const hashedPassword = Encryption.hashPassword(password);
console.log("Hashed Password:", hashedPassword);

const isMatch = Encryption.passwordCompare(password, hashedPassword);
console.log("Password Compare Result:", isMatch);

const randomKey = Encryption.generateRandomKey();

console.log("Generated Random Key:", randomKey);


// Step-by-step test: Mimicking userA and userB
console.log("=== RSA Key Exchange and Message Encryption Test ===");

// Step 1: UserA generates RSA key pair
const userAKeys = Encryption.generateRSAKeyPair();
//console.log("UserA Private Key:", userAKeys.privateKey);
//console.log("UserA Public Key:", userAKeys.publicKey);

// Step 2: UserB generates RSA key pair
const userBKeys = Encryption.generateRSAKeyPair();
//console.log("UserB Private Key:", userBKeys.privateKey);
//console.log("UserB Public Key:", userBKeys.publicKey);

// Step 3: UserA and UserB exchange public keys
const userAPublicKey = userAKeys.publicKey;
const userBPublicKey = userBKeys.publicKey;

// Step 4: UserA sends a message encrypted with UserB's public key
const messageFromUserA = "Hello UserB, this is a secret message!";
const encryptedMessage = Encryption.encryptRSA(messageFromUserA, userBPublicKey);
console.log("Encrypted Message from UserA:", encryptedMessage);

// Step 5: UserB decrypts the message using their private key
const decryptedMessage = Encryption.decryptRSA(encryptedMessage, userBKeys.privateKey);
console.log("Decrypted Message by UserB:", decryptedMessage);

// Step 6: Verify the decrypted message matches the original
console.log("Does the decrypted message match the original?", decryptedMessage === messageFromUserA);

})();
