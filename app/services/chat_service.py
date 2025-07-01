import os
import logging
from typing import Generator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.chains import ConversationChain
from langchain.memory import ConversationSummaryMemory
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.extensions import db
from app.models import Chat, Message
from flask_login import current_user

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ChatService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.7,
            streaming=True  # Enable streaming
        )

    def _get_or_create_chat_and_memory(self, chat_id: int = None):
        chat = None
        if chat_id:
            chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()

        if not chat:
            chat = Chat(user_id=current_user.id, title="New Chat")
            db.session.add(chat)
            db.session.commit()
        
        memory = ConversationSummaryMemory(llm=self.llm, memory_key="history", input_key="input")
        if chat.summary:
            memory.buffer = chat.summary
            
        return chat, memory

    def get_response(self, query: str, chat_id: int = None, use_rag: bool = False) -> Generator[dict, None, None]:
        """
        Yields a stream of dictionary events: chat info, then response chunks.
        """
        full_bot_response = ""
        try:
            # Validate query
            if not query or not query.strip():
                yield {"type": "error", "message": "Query cannot be empty"}
                return
                
            chat, memory = self._get_or_create_chat_and_memory(chat_id)
            # Immediately yield the chat ID
            yield {"type": "chat_info", "chat_id": chat.id}

            # Get conversation history
            history = memory.buffer or "No previous conversation."
            
            # Create messages list with proper content
            messages = []
            
            # Add system message if there's conversation history
            if history and history != "No previous conversation.":
                messages.append(SystemMessage(content=f"You are a helpful AI assistant. Previous conversation context: {history}"))
            else:
                messages.append(SystemMessage(content="You are a helpful AI assistant. Be conversational and provide detailed, helpful responses."))
            
            # Add the user's current message
            messages.append(HumanMessage(content=query.strip()))
            
            # Stream the response
            for chunk in self.llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    content = chunk.content
                    full_bot_response += content
                    yield {"type": "response_chunk", "content": content}

            # Save the conversation after streaming is complete
            if full_bot_response.strip():
                self._save_chat_turn(chat, memory, query, full_bot_response)
            else:
                yield {"type": "error", "message": "No response generated"}

        except Exception as e:
            logging.error(f"An unexpected error in ChatService: {e}", exc_info=True)
            yield {"type": "error", "message": f"An unexpected error occurred: {str(e)}"}

    def _save_chat_turn(self, chat: Chat, memory: ConversationSummaryMemory, user_message: str, bot_response: str):
        try:
            # Add messages to memory for future conversations
            memory.save_context({"input": user_message}, {"output": bot_response})
            
            # Save messages to database
            user_msg = Message(chat_id=chat.id, role='user', content=user_message)
            bot_msg = Message(chat_id=chat.id, role='assistant', content=bot_response)
            db.session.add_all([user_msg, bot_msg])
            
            # Update chat summary
            chat.summary = memory.buffer
            db.session.commit()
            
        except Exception as e:
            logging.error(f"Error saving chat turn: {e}", exc_info=True)
            db.session.rollback()

    def process_file_content(self, file_content: str, file_type: str) -> str:
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"```{file_type}\n{file_content}\n```"
        else:
            return file_content