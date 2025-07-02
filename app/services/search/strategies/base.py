from abc import ABC, abstractmethod
from typing import List, Dict, Any
from app.services.search.providers.base import SearchProvider

class SearchStrategy(ABC):
    """Abstract base class for search strategies"""
    @abstractmethod
    def execute_search(self, query: str, providers: List[SearchProvider], num_results: int = 5) -> List[Dict[str, Any]]:
        """Execute search using specific strategy"""
        pass 