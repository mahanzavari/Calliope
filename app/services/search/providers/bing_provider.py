import os
import requests
from typing import List, Dict, Any
from .base import SearchProvider

class BingSearchProvider(SearchProvider):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get('BING_API_KEY')
        self.endpoint = 'https://api.bing.microsoft.com/v7.0/search'

    def get_provider_name(self) -> str:
        return 'bing'

    def is_available(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        if not self.is_available():
            raise RuntimeError('Bing API key not configured')
        headers = {
            'Ocp-Apim-Subscription-Key': self.api_key
        }
        params = {
            'q': query,
            'count': num_results
        }
        response = requests.get(self.endpoint, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        results = []
        for item in data.get('webPages', {}).get('value', []):
            results.append({
                'title': item.get('name', ''),
                'content': item.get('snippet', ''),
                'url': item.get('url', ''),
                'score': None,
                'provider': self.get_provider_name()
            })
        return results 