from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
import hashlib

class SearchCache(ABC):
    """Abstract base class for search result caching"""
    @abstractmethod
    def get(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Retrieve cached search results"""
        pass

    @abstractmethod
    def set(self, cache_key: str, results: List[Dict[str, Any]], ttl: int = 3600) -> None:
        """Store search results in cache"""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clear all cached results"""
        pass

    def generate_cache_key(self, query: str, provider: str, num_results: int) -> str:
        """Generate consistent cache key"""
        key_string = f"{query}:{provider}:{num_results}"
        return hashlib.md5(key_string.encode()).hexdigest() 