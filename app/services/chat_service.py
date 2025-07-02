import os
import logging
import re
import json
from typing import Generator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.extensions import db
from app.models import Chat, Message, ChatSummary
from flask_login import current_user
from .memory_service import MemoryExtractionService

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ChatService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.7
        )
        self.utility_llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ.get("GOOGLE_API_KEY"),
            temperature=0.3
        )
        self.memory_extractor = MemoryExtractionService(llm=self.utility_llm)

    def _get_or_create_chat(self, chat_id: int = None):
        chat = None
        if chat_id:
            chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()

        if not chat:
            chat = Chat(user_id=current_user.id, title="New Chat")
            db.session.add(chat)
            # Create an initial empty summary object
            chat.summary = ChatSummary(
                short_summary="Chat just started.",
                detailed_summary="This is the beginning of a new conversation.",
                key_topics=[],
                extracted_facts=[]
            )
            db.session.commit()
        
        return chat

    def get_response(self, query: str, chat_id: int = None, use_rag: bool = False) -> Generator[dict, None, None]:
        full_bot_response = ""
        new_title_generated = None
        try:
            if not query or not query.strip():
                yield {"type": "error", "message": "Query cannot be empty"}
                return
                
            chat = self._get_or_create_chat(chat_id)
            yield {"type": "chat_info", "chat_id": chat.id}

            # Get history from the detailed summary
            history = chat.summary.detailed_summary if chat.summary else "No previous conversation."
            
            messages = [
                SystemMessage(content=f"You are a helpful AI assistant. Previous conversation context: {history}"),
                HumanMessage(content=query.strip())
            ]
            
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
                
                # Asynchronously extract memories (in a real app, this would be a background task)
                self.memory_extractor.extract_memories_from_chat(chat)

            else:
                yield {"type": "error", "message": "No response generated"}

        except Exception as e:
            logging.error(f"An unexpected error in ChatService: {e}", exc_info=True)
            yield {"type": "error", "message": f"An unexpected error occurred: {str(e)}"}
        finally:
            if new_title_generated:
                yield {"type": "title_update", "chat_id": chat.id, "title": new_title_generated}

    def _generate_title_for_chat(self, chat: Chat, user_message: str, bot_response: str) -> str:
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

    def _update_chat_summary(self, chat: Chat, user_message: str, bot_response: str):
        """Generates and saves layered summaries for the chat."""
        try:
            summary_prompt = f"""
            Given the previous conversation summary and the latest interaction, please provide an updated, layered summary in JSON format.

            Previous Detailed Summary:
            "{chat.summary.detailed_summary if chat.summary else 'None'}"

            Latest Interaction:
            User: "{user_message}"
            Assistant: "{bot_response}"

            Respond with a JSON object containing these keys:
            - "short_summary": A new, one-sentence summary of the entire conversation so far.
            - "detailed_summary": An updated, comprehensive summary of the entire conversation.
            - "key_topics": An array of 1-3 word strings representing the main topics of the latest interaction.
            - "extracted_facts": An array of strings, where each string is a potential long-term memory fact about the user (e.g., "User's favorite color is blue", "User is a software engineer"). Extract only from the latest interaction.

            JSON Response:
            """
            response = self.utility_llm.invoke([HumanMessage(content=summary_prompt)])
            summary_data = json.loads(response.content)

            if not chat.summary:
                chat.summary = ChatSummary(chat_id=chat.id)
            
            chat.summary.short_summary = summary_data.get("short_summary", chat.summary.short_summary)
            chat.summary.detailed_summary = summary_data.get("detailed_summary", chat.summary.detailed_summary)
            chat.summary.key_topics = summary_data.get("key_topics", chat.summary.key_topics)
            chat.summary.extracted_facts = summary_data.get("extracted_facts", chat.summary.extracted_facts)
            chat.summary.summary_version += 1
            
            db.session.commit()

        except Exception as e:
            logging.error(f"Error updating chat summary: {e}", exc_info=True)
            db.session.rollback()

    def _save_chat_turn(self, chat: Chat, user_message: str, bot_response: str):
        try:
            user_msg = Message(chat_id=chat.id, role='user', content=user_message)
            bot_msg = Message(chat_id=chat.id, role='assistant', content=bot_response)
            db.session.add_all([user_msg, bot_msg])
            db.session.commit()

            # Now, update the layered summary
            self._update_chat_summary(chat, user_message, bot_response)
            
        except Exception as e:
            logging.error(f"Error saving chat turn: {e}", exc_info=True)
            db.session.rollback()

    def process_file_content(self, file_content: str, file_type: str) -> str:
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"```{file_type}\n{file_content}\n```"
        else:
            return file_content
