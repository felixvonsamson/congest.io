import bcrypt


def hash_password(password: str) -> str:
    # bcrypt hashes at most 72 bytes; longer input is truncated (matching the
    # previous passlib default) so hashing never errors on a long password.
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hash_: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8")[:72], hash_.encode("utf-8"))
