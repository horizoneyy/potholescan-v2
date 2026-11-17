from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter berbasis token-bucket (NFR-04)
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
