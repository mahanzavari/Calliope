import os
import requests
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import numpy as np
from langchain_community.utilities import GoogleSearchAPIWrapper
from langchain_core.documents import Document

class RAGService:
    def __init__(self):
        self.search = GoogleSearchAPIWrapper()
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
    def search_google(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Perform Google search and return results"""
        try:
            results = self.search.results(query, num_results)
            return results
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
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
                    'source': 'google_search'
                }
            )
            documents.append(doc)
        return documents
    
    def rerank_documents(self, query: str, documents: List[Document], top_k: int = 3) -> List[Document]:
        """Rerank documents using semantic similarity"""
        if not documents:
            return []
        
        # Encode query and documents
        query_embedding = self.embedder.encode([query])
        doc_embeddings = self.embedder.encode([doc.page_content for doc in documents])
        
        # Calculate similarities
        similarities = np.dot(doc_embeddings, query_embedding.T).flatten()
        
        # Sort by similarity
        sorted_indices = np.argsort(similarities)[::-1]
        
        # Return top-k documents
        reranked_docs = [documents[i] for i in sorted_indices[:top_k]]
        return reranked_docs
    
    def get_context(self, query: str, use_reranking: bool = True) -> str:
        """Get context from Google search with optional reranking"""
        # Perform search
        search_results = self.search_google(query)
        
        if not search_results:
            return ""
        
        # Extract documents
        documents = self.extract_content_from_results(search_results)
        
        # Apply reranking if requested
        if use_reranking:
            documents = self.rerank_documents(query, documents)
        
        # Combine documents into context
        context = "\n\n".join([doc.page_content for doc in documents])
 