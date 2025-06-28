import os
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.chains import LLMChain
from langchain_core.runnables import RunnablePassthrough
from .rag_service import RAGService

class ChatService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-pro",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.7,
            convert_system_message_to_human=True
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
        return LLMChain(llm=self.llm, prompt=prompt, output_parser=StrOutputParser())

    def _create_direct_answer_chain(self):
        """Create a chain for direct answers without RAG"""
        prompt = ChatPromptTemplate.from_template(
            """You are a helpful AI assistant. Answer the following query based on your knowledge.
            If you're not sure about something, say so clearly.
            
            Query: {query}
            
            Answer:"""
        )
        return LLMChain(llm=self.llm, prompt=prompt, output_parser=StrOutputParser())

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

        return (
            {"context": lambda x: self.rag_service.get_context(x["query"]), "query": RunnablePassthrough()}
            | rag_prompt
            | self.llm
            | StrOutputParser()
        )

    def get_response(self, query: str, use_rag: bool = False) -> str:
        """
        Get response from the AI system with intelligent RAG decision making
        
        Args:
            query: User's query
            use_rag: Whether to force RAG usage
            
        Returns:
            AI response
        """
        try:
            if use_rag:
                # RAG is force-enabled by the user
                rag_chain = self._create_rag_chain()
                return rag_chain.invoke({"query": query})
            else:
                # Check LLM confidence first
                confidence_chain = self._create_confidence_check_chain()
                confidence_response = confidence_chain.invoke({"query": query})
                
                # Clean the response
                confidence = confidence_response.strip().lower()
                
                if "no" in confidence:
                    # LLM is confident, answer directly
                    direct_answer_chain = self._create_direct_answer_chain()
                    return direct_answer_chain.invoke({"query": query})
                else:
                    # LLM is not confident, perform RAG
                    rag_chain = self._create_rag_chain()
                    return rag_chain.invoke({"query": query})
                    
        except Exception as e:
            return f"I apologize, but I encountered an error: {str(e)}. Please try again."

    def process_file_content(self, file_content: str, file_type: str) -> str:
        """Process uploaded file content and return context"""
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"Code file content:\n```{file_type}\n{file_content}\n```"
        else:
            return f"File content:\n{file_content}" 