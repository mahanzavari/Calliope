import logging
from app.core.extensions import db
from app.models import UserMemory, MemoryCategory, ChatSummary, MemorySource, Chat
from flask_login import current_user
from sqlalchemy.exc import IntegrityError
from langchain.schema import HumanMessage

logging.basicConfig(level=logging.INFO)

class UserMemoryService:
    """Service for managing a user's long-term memory."""

    def get_relevant_memories(self, user_id: int, top_k: int = 5):
        """
        Retrieve the most relevant long-term memories for a user.
        Currently uses importance and access time as a proxy for relevance.
        """
        return UserMemory.query.filter_by(
            user_id=user_id,
            is_active=True,
            is_verified=True # Prioritize verified memories
        ).order_by(
            UserMemory.importance_score.desc(),
            UserMemory.last_accessed_at.desc()
        ).limit(top_k).all()

    def get_memories_by_category(self, user_id: int, category_id: int, page: int = 1, per_page: int = 10):
        """Retrieve paginated memories for a user in a specific category."""
        return UserMemory.query.filter_by(
            user_id=user_id, 
            category_id=category_id,
            is_active=True
        ).order_by(
            UserMemory.importance_score.desc(), 
            UserMemory.last_accessed_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

    def get_all_memories(self, user_id: int, page: int = 1, per_page: int = 20):
        """Retrieve all of a user's memories, paginated."""
        return UserMemory.query.filter_by(
            user_id=user_id,
            is_active=True
        ).order_by(UserMemory.last_accessed_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    def create_memory(self, data: dict) -> UserMemory:
        """Create a new memory entry for the current user."""
        memory = UserMemory(
            user_id=current_user.id,
            category_id=data.get('category_id'),
            title=data.get('title'),
            content=data.get('content'),
            importance_score=data.get('importance_score', 0.5),
            source_type=data.get('source_type', 'user_provided')
        )
        db.session.add(memory)
        db.session.commit()
        return memory

    def update_memory(self, memory_id: int, data: dict) -> UserMemory:
        """Update an existing memory."""
        memory = UserMemory.query.get_or_404(memory_id)
        if memory.user_id != current_user.id:
            raise PermissionError("User does not have permission to edit this memory.")
        
        memory.title = data.get('title', memory.title)
        memory.content = data.get('content', memory.content)
        memory.category_id = data.get('category_id', memory.category_id)
        memory.importance_score = data.get('importance_score', memory.importance_score)
        db.session.commit()
        return memory

    def delete_memory(self, memory_id: int):
        """Delete a memory."""
        memory = UserMemory.query.get_or_404(memory_id)
        if memory.user_id != current_user.id:
            raise PermissionError("User does not have permission to delete this memory.")
        
        db.session.delete(memory)
        db.session.commit()

    def verify_memory(self, memory_id: int, is_verified: bool = True) -> UserMemory:
        """Mark a memory as verified by the user."""
        memory = UserMemory.query.get_or_404(memory_id)
        if memory.user_id != current_user.id:
            raise PermissionError("User does not have permission to verify this memory.")
        
        memory.is_verified = is_verified
        memory.confidence_score = 1.0 if is_verified else 0.4 
        db.session.commit()
        return memory

    def get_all_categories(self):
        """Get all available memory categories."""
        return MemoryCategory.query.filter_by(is_active=True).order_by(MemoryCategory.name).all()

class MemoryExtractionService:
    """Service for extracting long-term memories from chat conversations."""

    def __init__(self, llm):
        self.llm = llm

    def extract_memories_from_chat(self, chat: Chat):
        """
        Analyzes a chat summary to extract potential long-term memories,
        categorizes them, and saves them to the database.
        """
        logging.info(f"Starting memory extraction for chat {chat.id}")
        if not chat.summary or not chat.summary.extracted_facts:
            logging.warning(f"Chat {chat.id} has no new facts to extract.")
            return

        facts = chat.summary.extracted_facts
        if not isinstance(facts, list) or not facts:
            logging.info(f"No new facts to process for chat {chat.id}.")
            return
            
        categories = MemoryCategory.query.all()
        category_map = {cat.name: cat.id for cat in categories}
        category_prompt_list = "\n".join([f"- {cat.name}: {cat.description}" for cat in categories])

        for fact in facts:
            try:
                # Use the LLM to categorize the fact
                categorization_prompt = f"""
                Given the following fact about a user, which category does it best fit into?
                Fact: "{fact}"

                Categories:
                {category_prompt_list}

                Respond with ONLY the single, most appropriate category name from the list above.
                Category: 
                """
                response = self.llm.invoke([HumanMessage(content=categorization_prompt)])
                category_name = response.content.strip()

                if category_name in category_map:
                    category_id = category_map[category_name]
                    
                    # Create the UserMemory object
                    new_memory = UserMemory(
                        user_id=chat.user_id,
                        category_id=category_id,
                        title=fact[:150],  # Use the fact as a title, truncated
                        content=fact,
                        source_type='extracted',
                        confidence_score=0.6, # Initial confidence for extracted memories
                        importance_score=0.5  # Default importance
                    )
                    db.session.add(new_memory)
                    db.session.flush() # Flush to get the new_memory.id

                    # Link it to the source chat
                    new_source = MemorySource(memory_id=new_memory.id, chat_id=chat.id)
                    db.session.add(new_source)
                    db.session.commit()
                    logging.info(f"Successfully created and saved new memory: '{fact}' under category '{category_name}'")
                else:
                    logging.warning(f"LLM returned an invalid category '{category_name}' for fact '{fact}'")

            except IntegrityError:
                db.session.rollback()
                logging.warning(f"Memory for fact '{fact}' might already exist. Skipping.")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Failed to create memory for fact '{fact}'. Error: {e}")
