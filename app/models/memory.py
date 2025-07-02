# app/models/memory.py
from app.core.extensions import db
from datetime import datetime, timezone

class MemoryCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    memories = db.relationship('UserMemory', backref='category', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='_user_category_uc'),)

class UserMemory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('memory_category.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    importance_score = db.Column(db.Float, default=0.5)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class ChatSummary(db.Model):
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