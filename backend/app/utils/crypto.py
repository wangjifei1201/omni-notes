"""
Cryptographic utilities for password hashing and encryption.
"""
import uuid
import base64
from datetime import datetime, timedelta

import bcrypt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import settings


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password string
    """
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12))
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        password: Plain text password
        hashed: Hashed password string

    Returns:
        True if password matches, False otherwise
    """
    password_bytes = password.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def _get_fernet_key(secret: str) -> bytes:
    """
    Derive a Fernet key from a secret string.

    Fernet requires a 32-byte base64-encoded key.
    We use PBKDF2 to derive a key from the user's secret.
    """
    # Ensure secret is at least 32 bytes
    secret_bytes = secret.encode('utf-8')
    if len(secret_bytes) < 32:
        secret_bytes = secret_bytes.ljust(32, b'\0')

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'omni-notes-salt-',  # Fixed salt for deterministic key derivation
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret_bytes))
    return key


def encrypt_data(data: str) -> str:
    """
    Encrypt data using Fernet (AES-128-CBC).

    Args:
        data: Plain text data to encrypt

    Returns:
        Base64-encoded encrypted data
    """
    key = _get_fernet_key(settings.cookie_encryption_key)
    f = Fernet(key)
    encrypted = f.encrypt(data.encode('utf-8'))
    return encrypted.decode('utf-8')


def decrypt_data(encrypted_data: str) -> str:
    """
    Decrypt data using Fernet (AES-128-CBC).

    Args:
        encrypted_data: Base64-encoded encrypted data

    Returns:
        Decrypted plain text
    """
    key = _get_fernet_key(settings.cookie_encryption_key)
    f = Fernet(key)
    decrypted = f.decrypt(encrypted_data.encode('utf-8'))
    return decrypted.decode('utf-8')


def generate_session_id() -> str:
    """Generate a unique session ID."""
    return str(uuid.uuid4())


def get_session_expiry() -> datetime:
    """Get session expiry datetime."""
    return datetime.utcnow() + timedelta(days=settings.session_expire_days)
