import os
import logging
import re
import json
from typing import Generator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from app.core.extensions import db
from app.models import Chat, Message, ChatSummary
from flask_login import current_user
from app.services.rag_service import RAGService
from .memory_service import UserMemoryService, MemoryExtractionService

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
        # Instantiate services
        self.user_memory_service = UserMemoryService()
        self.memory_extractor = MemoryExtractionService(llm=self.utility_llm)
        self.rag_service = RAGService() # Initialize RAGService

    def _get_or_create_chat(self, chat_id: int = None):
        chat = None
        if chat_id:
            chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()

        if not chat:
            chat = Chat(user_id=current_user.id, title="New Chat")
            db.session.add(chat)
            chat.summary = ChatSummary(
                short_summary="Chat just started.",
                detailed_summary="This is the beginning of a new conversation.",
                key_topics=[],
                extracted_facts=[]
            )
            db.session.commit()
        
        return chat

    def get_response(self, query: str, chat_id: int = None, use_rag: bool = False, is_research_mode: bool = False) -> Generator[dict, None, None]:
        full_bot_response = ""
        new_title_generated = None
        sources_for_response = None
        try:
            if not query or not query.strip():
                yield {"type": "error", "message": "Query cannot be empty"}
                return
                
            chat = self._get_or_create_chat(chat_id)
            yield {"type": "chat_info", "chat_id": chat.id}

            messages = []
            
            if is_research_mode:
                yield {"type": "status", "message": "Performing research..."}
                rag_data = self.rag_service.get_context(query)
                rag_context = rag_data.get("context")
                sources_for_response = rag_data.get("sources")

                if not rag_context or not sources_for_response:
                    yield {"type": "error", "message": "Could not find relevant information for your query."}
                    return

                # FIX: New prompt for inline source tagging
                research_prompt = f"""
You are a meticulous Research Assistant. Your task is to answer the user's query based *only* on the provided research material.

**CRITICAL INSTRUCTION:**
You MUST wrap every piece of information you provide with special tags indicating its source. The format is `[s:id]text from the source[/s:id]`, where 'id' is the number of the source.

- **Example:** `[s:1]The sky is blue because of Rayleigh scattering.[/s:1] [s:2]The ocean also appears blue due to the reflection of the sky.[/s:2]`
- If a sentence combines information from multiple sources, wrap each part with its corresponding tag.
- **DO NOT** use Markdown footnotes like `[^1]`. Use **ONLY** the `[s:id]` and `[/s:id]` tags.
- Provide a direct, synthesized answer. Do not add any introductory or concluding text outside of the source tags.

**Provided Research Material:**
---
{rag_context}
---

Based on this material, answer the user's query using the specified tagging format.
"""
                messages.append(SystemMessage(content=research_prompt))
            
            else:
                messages.append(SystemMessage(content="You are a helpful AI assistant. Be conversational and provide detailed, helpful responses."))
                
                relevant_memories = self.user_memory_service.get_relevant_memories(user_id=current_user.id)
                if relevant_memories:
                    memory_context = "\n".join([f"- {mem.content}" for mem in relevant_memories])
                    messages.append(SystemMessage(content=f"To personalize your response, remember these key facts about the user:\n{memory_context}"))

                if use_rag:
                    yield {"type": "status", "message": "Searching the web..."}
                    rag_data = self.rag_service.get_context(query)
                    rag_context = rag_data.get("context")
                    sources_for_response = rag_data.get("sources") # Also get sources for regular RAG
                    if rag_context:
                        messages.append(SystemMessage(content=f"Here is some information from a web search to help you answer the user's query:\n{rag_context}"))
                
                if chat.summary and chat.summary.detailed_summary and chat.summary.detailed_summary != "This is the beginning of a new conversation.":
                    messages.append(SystemMessage(content=f"Here is a summary of the current conversation so far: {chat.summary.detailed_summary}"))

                recent_messages = Message.query.filter_by(chat_id=chat.id).order_by(Message.created_at.desc()).limit(10).all()
                recent_messages.reverse() 
                for msg in recent_messages:
                    if msg.role == 'user': messages.append(HumanMessage(content=msg.content))
                    elif msg.role == 'assistant': messages.append(AIMessage(content=msg.content))

            messages.append(HumanMessage(content=query.strip()))
            
            yield {"type": "status", "message": "Generating response..."}
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
                
                if not is_research_mode:
                    self.memory_extractor.extract_memories_from_chat(chat)
            else:
                yield {"type": "error", "message": "No response generated"}

        except Exception as e:
            logging.error(f"An unexpected error in ChatService: {e}", exc_info=True)
            yield {"type": "error", "message": f"An unexpected error occurred: {str(e)}"}
        finally:
            if sources_for_response:
                yield {"type": "sources", "data": sources_for_response}
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
        try:
            # We don't need to summarize research mode chats in the same way
            if '[s:' in bot_response:
                return

            summary_prompt = f"""
            Given the previous conversation summary and the latest interaction, please provide an updated, layered summary in JSON format.

            Previous Detailed Summary:
            "{chat.summary.detailed_summary if chat.summary else 'None'}"

            Latest Interaction:
            User: "{user_message}"
            Assistant: "{bot_response}"

            Respond ONLY with a valid JSON object containing these keys. Do not include any other text or markdown formatting.
            - "short_summary": A new, one-sentence summary of the entire conversation so far.
            - "detailed_summary": An updated, comprehensive summary of the entire conversation.
            - "key_topics": An array of 1-3 word strings representing the main topics of the latest interaction.
            - "extracted_facts": An array of strings, where each string is a potential long-term memory fact about the user (e.g., "User's favorite color is blue", "User is a software engineer"). Extract only from the latest interaction.

            JSON Response:
            """
            response = self.utility_llm.invoke([HumanMessage(content=summary_prompt)])
            
            raw_content = response.content
            summary_data = None

            try:
                start_index = raw_content.find('{')
                end_index = raw_content.rfind('}')
                
                if start_index != -1 and end_index != -1:
                    json_str = raw_content[start_index:end_index+1]
                    summary_data = json.loads(json_str)
                else:
                    logging.warning(f"No JSON object found in the LLM summary response. Raw content: '{raw_content}'")
                    return

            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse JSON from LLM summary response. Error: {e}")
                logging.error(f"Raw LLM content was: '{raw_content}'")
                return 

            if not summary_data:
                logging.warning("Could not extract summary data from LLM response.")
                return

            if not chat.summary:
                chat.summary = ChatSummary(chat_id=chat.id)
            
            chat.summary.short_summary = summary_data.get("short_summary", chat.summary.short_summary)
            chat.summary.detailed_summary = summary_data.get("detailed_summary", chat.summary.detailed_summary)
            chat.summary.key_topics = summary_data.get("key_topics", chat.summary.key_topics)
            chat.summary.extracted_facts = summary_data.get("extracted_facts", chat.summary.extracted_facts)
            chat.summary.summary_version += 1
            
            db.session.commit()

        except Exception as e:
            logging.error(f"An unexpected error occurred during chat summary update: {e}", exc_info=True)
            db.session.rollback()

    def _save_chat_turn(self, chat: Chat, user_message: str, bot_response: str):
        try:
            user_msg = Message(chat_id=chat.id, role='user', content=user_message)
            bot_msg = Message(chat_id=chat.id, role='assistant', content=bot_response)
            db.session.add_all([user_msg, bot_msg])
            db.session.commit()

            self._update_chat_summary(chat, user_message, bot_response)
            
        except Exception as e:
            logging.error(f"Error saving chat turn: {e}", exc_info=True)
            db.session.rollback()

    def process_file_content(self, file_content: str, file_type: str) -> str:
        if file_type in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
            return f"```{file_type}\n{file_content}\n```"
        else:
            return file_content