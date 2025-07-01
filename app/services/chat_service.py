import os
import logging
import re
from typing import Generator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.extensions import db
from app.models import Chat, Message
from flask_login import current_user

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ChatService:
    def __init__(self):
        # FIX 1: Removed the legacy `streaming=True` argument.
        # The .stream() method handles streaming automatically.
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.7
        )
        # A separate, non-streaming LLM for tasks like titling and summarizing
        self.utility_llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.3
        )

    def _get_or_create_chat(self, chat_id: int = None):
        # FIX 2: Removed memory management from this function. It now only handles the Chat object.
        chat = None
        if chat_id:
            chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()

        if not chat:
            chat = Chat(user_id=current_user.id, title="New Chat")
            db.session.add(chat)
            db.session.commit()
        
        return chat

    def get_response(self, query: str, chat_id: int = None, use_rag: bool = False) -> Generator[dict, None, None]:
        """
        Yields a stream of dictionary events: chat info, response chunks, and title updates.
        """
        full_bot_response = ""
        new_title_generated = None
        try:
            if not query or not query.strip():
                yield {"type": "error", "message": "Query cannot be empty"}
                return
                
            chat = self._get_or_create_chat(chat_id)
            yield {"type": "chat_info", "chat_id": chat.id}

            # Get history directly from the chat summary.
            history = chat.summary or "No previous conversation."
            
            messages = []
            if history and history != "No previous conversation.":
                messages.append(SystemMessage(content=f"You are a helpful AI assistant. Previous conversation context: {history}"))
            else:
                messages.append(SystemMessage(content="You are a helpful AI assistant. Be conversational and provide detailed, helpful responses."))
            
            messages.append(HumanMessage(content=query.strip()))
            
            for chunk in self.llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    content = chunk.content
                    full_bot_response += content
                    yield {"type": "response_chunk", "content": content}

            if full_bot_response.strip():
                is_new_chat = not chat.title or chat.title == "New Chat"
                self._save_chat_turn(chat, query, full_bot_response)
                
                if is_new_chat:
                    new_title_generated = self._generate_title_for_chat(chat, query, full_bot_response)
            else:
                yield {"type": "error", "message": "No response generated"}

        except Exception as e:
            logging.error(f"An unexpected error in ChatService: {e}", exc_info=True)
            yield {"type": "error", "message": f"An unexpected error occurred: {str(e)}"}
        finally:
            if new_title_generated:
                yield {"type": "title_update", "chat_id": chat.id, "title": new_title_generated}


    def _generate_title_for_chat(self, chat: Chat, user_message: str, bot_response: str) -> str:
        """Generates and saves a title for the chat."""
        try:
            prompt = f"""Based on the following conversation, create a very short, concise title (4-5 words max).
            
            User: "{user_message}"
            Assistant: "{bot_response[:200]}..."
            
            Title:"""
            
            response = self.utility_llm.invoke([HumanMessage(content=prompt)])
            title = re.sub(r'["\']', '', response.content).strip()

            if title:
                chat.title = title
                db.session.commit()
                return title
        except Exception as e:
            logging.error(f"Error generating chat title: {e}", exc_info=True)
            db.session.rollback()
        return None

    # NEW: Function to replace ConversationSummaryMemory
    def _update_summary(self, existing_summary: str, user_message: str, bot_response: str) -> str:
        """Explicitly updates the conversation summary."""
        try:
            prompt = f"""Please create a concise summary of the following new turn of a conversation,
            taking into account the existing summary.

            Existing Summary:
            "{existing_summary}"

            New Interaction:
            User: "{user_message}"
            Assistant: "{bot_response}"

            New, updated summary:"""
            
            response = self.utility_llm.invoke([HumanMessage(content=prompt)])
            return response.content.strip()
        except Exception as e:
            logging.error(f"Error updating summary: {e}", exc_info=True)
            # Fallback to a simpler summary if the LLM call fails
            return existing_summary + f"\nUser: {user_message}\nAssistant: {bot_response}"


    def _save_chat_turn(self, chat: Chat, user_message: str, bot_response: str):
        # FIX 2: Replaced memory object with explicit summary update.
        try:
            # Save messages to database first
            user_msg = Message(chat_id=chat.id, role='user', content=user_message)
            bot_msg = Message(chat_id=chat.id, role='assistant', content=bot_response)
            db.session.add_all([user_msg, bot_msg])
            
            # Update the chat summary
            chat.summary = self._update_summary(chat.summary or "", user_message, bot_response)
            db.session.commit()
            
        except Exception as e:
            logging.error(f"Error saving chat turn: {e}", exc_info=True)
            db.session.rollback()

    def process_file_content(self, file_content: str, file_type: str) -> str:
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"```{file_type}\n{file_content}\n```"
        else:
            return file_content