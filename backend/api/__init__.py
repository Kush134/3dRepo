from .routes import router

__all__ = ['router']

# API Version
API_VERSION = '1.0.0'

# API Prefix
API_PREFIX = '/api/v1'

# Rate limiting settings
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
RATE_LIMIT_MAX_REQUESTS = 100

# Cache settings
CACHE_EXPIRE_TIME = 300  # 5 minutes in seconds

# Error messages
ERROR_MESSAGES = {
    'invalid_token': 'Invalid or missing authentication token',
    'rate_limit': 'Rate limit exceeded. Please try again later',
    'server_error': 'Internal server error occurred',
    'not_found': 'Requested resource not found',
    'bad_request': 'Invalid request parameters'
}

# Import middleware
from fastapi import Request
from fastapi.responses import JSONResponse
import time

async def add_process_time_header(request: Request, call_next):
    """Middleware to add processing time header to response"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Configure logging
import logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create console handler
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)

# Create formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(handler)