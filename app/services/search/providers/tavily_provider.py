import os
import requests
from typing import List, Dict, Any
from .base import SearchProvider

class TavilySearchProvider(SearchProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get('TAVILY_API_KEY')
        self.endpoint = 'https://api.tavily.com/search'

    def get_provider_name(self) -> str:
        return 'tavily'

    def is_available(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        if not self.is_available():
            raise RuntimeError('Tavily API key not configured')
        params = {
            'api_key': self.api_key,
            'query': query,
            'num_results': num_results
        }
        response = requests.get(self.endpoint, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        # Standardize results: title, content, url, score
        results = []
        for item in data.get('results', []):
            results.append({
                'title': item.get('title', ''),
                'content': item.get('content', ''),
                'url': item.get('url', ''),
                'score': item.get('score', None),
                'provider': self.get_provider_name()
            })
        return results 