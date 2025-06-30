import os
import requests
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import numpy as np
from langchain_core.documents import Document
from bs4 import BeautifulSoup
import time
import random
from app.services.search.providers.tavily_provider import TavilySearchProvider
from app.services.search.providers.bing_provider import BingSearchProvider
from app.services.search.providers.duckduckgo_provider import DuckDuckGoSearchProvider

class RAGService:
    def __init__(self, search_provider_names: Optional[List[str]] = None):
        """
        Initialize RAG service with specified search providers
        Args:
            search_provider_names: list of provider names to use (e.g., ["tavily", "bing", "duckduckgo"])
        """
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.providers = []
        # Determine which providers to use
        provider_names = search_provider_names or os.environ.get('SEARCH_PROVIDERS', 'tavily,bing,duckduckgo').split(',')
        provider_names = [p.strip().lower() for p in provider_names]
        # Instantiate providers
        for name in provider_names:
            if name == 'tavily':
                provider = TavilySearchProvider()
            elif name == 'bing':
                provider = BingSearchProvider()
            elif name == 'duckduckgo':
                provider = DuckDuckGoSearchProvider()
            else:
                continue
            if provider.is_available():
                self.providers.append(provider)

    def get_context(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """
        Run the query on all configured providers and return merged results
        """
        all_results = []
        for provider in self.providers:
            try:
                results = provider.search(query, num_results=num_results)
                all_results.extend(results)
            except Exception as e:
                print(f"Search error with {provider.get_provider_name()}: {e}")
        return all_results

    def search_duckduckgo(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search using DuckDuckGo (free, no API key required)"""
        try:
            from duckduckgo_search import DDGS
            
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=num_results))
                
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'title': result.get('title', ''),
                    'snippet': result.get('body', ''),
                    'link': result.get('href', ''), # Corrected from 'link' to 'href'
                    'source': 'duckduckgo'
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"DuckDuckGo search error: {e}")
            return []
    
    def search_google_custom(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search using Google Custom Search API"""
        if not self.google_custom_search_id or not self.google_api_key:
            print("Google Custom Search not configured. Missing GOOGLE_CUSTOM_SEARCH_ID or GOOGLE_API_KEY")
            return []
        
        try:
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                'key': self.google_api_key,
                'cx': self.google_custom_search_id,
                'q': query,
                'num': min(num_results, 10)  # Google CSE max is 10
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = []
            
            if 'items' in data:
                for item in data['items']:
                    results.append({
                        'title': item.get('title', ''),
                        'snippet': item.get('snippet', ''),
                        'link': item.get('link', ''),
                        'source': 'google_custom'
                    })
            
            return results
            
        except Exception as e:
            print(f"Google Custom Search error: {e}")
            return []
    
    def search_web_scraping(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Simple web scraping search using DuckDuckGo HTML"""
        try:
            search_url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(search_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            results = []
            
            result_elements = soup.find_all('div', class_='result')[:num_results]
            
            for element in result_elements:
                title_elem = element.find('a', class_='result__title')
                snippet_elem = element.find('a', class_='result__snippet')
                
                if title_elem and snippet_elem:
                    results.append({
                        'title': title_elem.get_text(strip=True),
                        'snippet': snippet_elem.get_text(strip=True),
                        'link': title_elem.get('href', ''),
                        'source': 'web_scraping'
                    })
            
            return results
            
        except Exception as e:
            print(f"Web scraping search error: {e}")
            return []
    
    def search_fallback(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Fallback search that tries multiple providers"""
        providers = [
            ('duckduckgo', self.search_duckduckgo),
            ('google_custom', self.search_google_custom),
            ('web_scraping', self.search_web_scraping)
        ]
        
        for provider_name, search_func in providers:
            try:
                results = search_func(query, num_results)
                if results:
                    print(f"Using {provider_name} search provider")
                    return results
            except Exception as e:
                print(f"{provider_name} failed: {e}")
                continue
        
        print("All search providers failed")
        return []
    
    def search_google(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Main search method that routes to the appropriate provider"""
        if self.search_provider == "duckduckgo":
            return self.search_duckduckgo(query, num_results)
        elif self.search_provider == "google_custom":
            return self.search_google_custom(query, num_results)
        elif self.search_provider == "web_scraping":
            return self.search_web_scraping(query, num_results)
        elif self.search_provider == "fallback":
            return self.search_fallback(query, num_results)
        else:
            return self.search_fallback(query, num_results)
    
    def extract_content_from_results(self, search_results: List[Dict[str, Any]]) -> List[Document]:
        """Extract and format content from search results"""
        documents = []
        for result in search_results:
            content = f"Title: {result.get('title', '')}\n"
            content += f"Snippet: {result.get('snippet', '')}\n"
            content += f"URL: {result.get('link', '')}"
            
            doc = Document(
                page_content=content,
                metadata={
                    'title': result.get('title', ''),
                    'url': result.get('link', ''),
                    'source': result.get('source', 'unknown')
                }
            )
            documents.append(doc)
        return documents
    
    def rerank_documents(self, query: str, documents: List[Document], top_k: int = 3) -> List[Document]:
        """Rerank documents using semantic similarity"""
        if not documents:
            return []
        
        query_embedding = self.embedder.encode([query])
        doc_embeddings = self.embedder.encode([doc.page_content for doc in documents])
        
        similarities = np.dot(doc_embeddings, query_embedding.T).flatten()
        
        sorted_indices = np.argsort(similarities)[::-1]
        
        reranked_docs = [documents[i] for i in sorted_indices[:top_k]]
        return reranked_docs
    
    def get_context(self, query: str, use_reranking: bool = True) -> str:
        """Get context from search with optional reranking"""
        search_results = self.search_google(query)
        
        if not search_results:
            return "" # Return an empty string if there are no search results
        
        documents = self.extract_content_from_results(search_results)
        
        if use_reranking:
            documents = self.rerank_documents(query, documents)
        
        context = "\n\n".join([doc.page_content for doc in documents])
        
        return context