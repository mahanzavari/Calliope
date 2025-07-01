import os
import logging 
from typing import Generator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from .rag_service import RAGService

# --- MODIFICATION: Set up a basic logger ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ChatService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.7
        )
        self.rag_service = RAGService()

    def _create_confidence_check_chain(self):
        """Create a chain to check if the query requires external information"""
        prompt = ChatPromptTemplate.from_template(
            """Analyze the following query and determine if it requires external information,
            real-time data, or current events to answer accurately.

            Answer with ONLY 'yes' or 'no'.

            Query: {query}

            Answer:"""
        )
        return prompt | self.llm | StrOutputParser()

    def _create_direct_answer_chain(self):
        """Create a chain for direct answers without RAG"""
        prompt = ChatPromptTemplate.from_template(
            """You are a helpful AI assistant. Answer the following query based on your knowledge.
            If you're not sure about something, say so clearly.

            Query: {query}

            Answer:"""
        )
        return prompt | self.llm | StrOutputParser()

    def _create_rag_chain(self):
        """Create a chain that uses RAG to answer queries"""
        rag_prompt = ChatPromptTemplate.from_template(
            """Based on the following search results and your knowledge, answer the user's query.
            If the search results are not relevant or insufficient, rely on your knowledge.
            Always cite sources when using information from the search results.

            Search Results:
            {context}

            User Query: {query}

            Answer:"""
        )
        chain_input = {
            "context": lambda x: self.rag_service.get_context(x["query"]),
            "query": lambda x: x["query"]
        }
        return (
            chain_input
            | rag_prompt
            | self.llm
            | StrOutputParser()
        )

    # --- MODIFICATION START ---
    def get_response(self, query: str, use_rag: bool = False) -> Generator[str, None, None]:
        """
        Get a streaming response from the AI system with robust error handling.
        """
        try:
            chain_input = {"query": query}
            chain = None

            if use_rag:
                chain = self._create_rag_chain()
            else:
                confidence_chain = self._create_confidence_check_chain()
                confidence_response = confidence_chain.invoke(chain_input).strip().lower()

                if "no" in confidence_response:
                    chain = self._create_direct_answer_chain()
                else:
                    chain = self._create_rag_chain()

            yield from chain.stream(chain_input)

        except Exception as e:
            # Log the full, detailed error to the server console for debugging.
            logging.error(f"An unexpected error occurred in ChatService: {e}", exc_info=True)
            
            # Yield a generic, user-friendly error message.
            yield "I apologize, but I encountered an unexpected error. Please try again."
    # --- MODIFICATION END ---


    def process_file_content(self, file_content: str, file_type: str) -> str:
        """Process uploaded file content and return context, formatted for Markdown."""
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"```{file_type}\n{file_content}\n```"
        else:
            return file_content