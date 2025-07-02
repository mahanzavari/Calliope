from app.core.extensions import db
from datetime import datetime, timezone

class MemoryCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=True) # Add this line
    is_active = db.Column(db.Boolean, default=True, nullable=False) # Add this line
    memories = db.relationship('UserMemory', backref='category', lazy=True)

    def __repr__(self):
        return f'<MemoryCategory {self.name}>'
class UserMemory(db.Model):
    __tablename__ = 'user_memories'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('memory_category.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    importance_score = db.Column(db.Float, default=0.5)
    confidence_score = db.Column(db.Float, default=0.5) # Add this line
    is_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True) # Add this line
    source_type = db.Column(db.String(50), default='manual') # Add this line
    last_accessed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Add this line
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint('user_id', 'content', name='_user_content_uc'),) # Add this line
class ChatSummary(db.Model):
    __tablename__ = 'chat_summaries'
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), unique=True, nullable=False)
    short_summary = db.Column(db.String(500))
    detailed_summary = db.Column(db.Text)
    key_topics = db.Column(db.JSON)
    extracted_facts = db.Column(db.JSON)
    summary_version = db.Column(db.Integer, default=1, nullable=False)

class MemorySource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    memory_id = db.Column(db.Integer, db.ForeignKey('user_memory.id'), nullable=False)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    source_type = db.Column(db.String(50)) # e.g., 'chat', 'manual'