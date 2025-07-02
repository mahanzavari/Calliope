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

    def get_context(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """
        Run the query on all configured providers, rerank, and return structured context and sources.
        """
        all_results = []
        for provider in self.providers:
            try:
                results = provider.search(query, num_results=num_results)
                all_results.extend(results)
            except Exception as e:
                print(f"Search error with {provider.get_provider_name()}: {e}")
        
        if not all_results:
            return {"context": "", "sources": []}

        documents = self.extract_content_from_results(all_results)
        reranked_docs = self.rerank_documents(query, documents, top_k=4) # Use top 4 for more comprehensive answers
        
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
        """Extract and format content from search results"""
        documents = []
        for result in search_results:
            content = f"Title: {result.get('title', '')}\n"
            content += f"Snippet: {result.get('snippet', '')}\n"
            content += f"URL: {result.get('url', '')}" 
            
            doc = Document(
                page_content=content,
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