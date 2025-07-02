from typing import List, Dict, Any
from .base import SearchProvider

class DuckDuckGoSearchProvider(SearchProvider):
    def get_provider_name(self) -> str:
        return 'duckduckgo'

    def is_available(self) -> bool:
        try:
            from duckduckgo_search import DDGS
            return True
        except ImportError:
            return False

    def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for item in ddgs.text(query, max_results=num_results):
                results.append({
                    'title': item.get('title', ''),
                    'content': item.get('body', ''),
                    'url': item.get('href', ''),
                    'score': None,
                    'provider': self.get_provider_name()
                })
        return results 