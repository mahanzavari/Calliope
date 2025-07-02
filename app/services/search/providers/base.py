from abc import ABC, abstractmethod
from typing import List, Dict, Any

class SearchProvider(ABC):
    """Abstract base class for all search providers"""
    @abstractmethod
    def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Perform search and return standardized results"""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the name of the search provider"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is properly configured and available"""
        pass 