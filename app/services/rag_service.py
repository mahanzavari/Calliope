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
import logging

# Suppress noisy logs from the sentence-transformers library
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)


class RAGService:
    def __init__(self, search_provider_names: Optional[List[str]] = None):
        """
        Initialize RAG service with specified search providers
        Args:
            search_provider_names: list of provider names to use (e.g., ["tavily", "bing", "duckduckgo"])
        """
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.providers = []
        provider_names = search_provider_names or os.environ.get('SEARCH_PROVIDERS', 'tavily,bing,duckduckgo').split(',')
        provider_names = [p.strip().lower() for p in provider_names]
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

    def _scrape_url_content(self, url: str) -> Optional[str]:
        """
        Scrapes the main text content from a given URL.
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Decompose non-content tags
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                element.decompose()

            # A more robust heuristic to find the main content
            main_content = soup.find('main') or soup.find('article') or soup.find('body')
            
            if main_content:
                # Get text from all child elements, which is more comprehensive than just <p>
                text_content = main_content.get_text(separator=' ', strip=True)
            else:
                # Fallback to just getting all text if no main tag is found
                text_content = soup.get_text(separator=' ', strip=True)
            
            # Basic cleaning of whitespace
            cleaned_text = ' '.join(text_content.split())
            
            # Only return content if it's reasonably long, otherwise it's likely a blank or error page
            return cleaned_text if len(cleaned_text) > 300 else None

        except requests.HTTPError as e:
            # Specifically log 4xx/5xx errors but don't crash
            print(f"HTTP error for {url}: {e}")
            return None
        except requests.RequestException as e:
            print(f"Scraping request error for {url}: {e}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred while scraping {url}: {e}")
            return None

    def get_context(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """
        Run the query on all configured providers, scrape, rerank, and return structured context.
        """
        all_results = []
        for provider in self.providers:
            try:
                results = provider.search(query, num_results=3) 
                all_results.extend(results)
            except Exception as e:
                print(f"Search error with {provider.get_provider_name()}: {e}")
        
        if not all_results:
            return {"context": "", "sources": []}

        documents = self.extract_content_from_results(all_results)
        valid_documents = [doc for doc in documents if doc.page_content]

        if not valid_documents:
             print("Warning: Scraping failed for all URLs, and no fallback content was available.")
             return {"context": "", "sources": []}

        reranked_docs = self.rerank_documents(query, valid_documents, top_k=3)
        
        context_parts = []
        sources = []
        for i, doc in enumerate(reranked_docs):
            context_parts.append(f"Source [{i+1}]: {doc.page_content}")
            sources.append({
                "id": i + 1,
                "title": doc.metadata.get('title', 'Untitled'),
                "url": doc.metadata.get('url', '#')
            })
            
        context = "\n\n".join(context_parts)
        
        return {"context": context, "sources": sources}

    def extract_content_from_results(self, search_results: List[Dict[str, Any]]) -> List[Document]:
        """
        MODIFIED: Scrapes URLs with a polite delay and has better fallback logic.
        """
        documents = []
        urls_processed = set()

        for result in search_results:
            url = result.get('url')
            if not url or url in urls_processed:
                continue
            
            urls_processed.add(url)
            
            # FIX: Introduce a polite delay to respect rate limits
            # Random delay between 0.5 and 1.5 seconds
            delay = random.uniform(0.5, 1.5)
            print(f"Waiting for {delay:.2f}s before scraping...")
            time.sleep(delay)
            
            print(f"Scraping: {url}")
            scraped_content = self._scrape_url_content(url)
            
            if scraped_content:
                print(f"  -> Successfully scraped {len(scraped_content)} characters.")
                page_text = scraped_content
            else:
                # FIX: More explicit fallback to the snippet
                print(f"  -> Scraping failed. Falling back to snippet.")
                page_text = result.get('snippet', '')
            
            # Only proceed if we have some content (either scraped or from snippet)
            if page_text:
                full_content = f"Title: {result.get('title', '')}\nContent: {page_text}"

                doc = Document(
                    page_content=full_content,
                    metadata={
                        'title': result.get('title', ''),
                        'url': result.get('url', ''),
                        'source': result.get('provider', 'unknown') 
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