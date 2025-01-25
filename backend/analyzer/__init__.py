from .repo_analyzer import RepositoryAnalyzer
from .graph_processor import GraphProcessor

__all__ = ['RepositoryAnalyzer', 'GraphProcessor']

# Version information
__version__ = '1.0.0'

# Module level constants
DEFAULT_COMMIT_LIMIT = 50
MAX_COMMIT_LIMIT = 100
DEFAULT_BRANCH = 'main'

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