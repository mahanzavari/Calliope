from app.core.extensions import db
from datetime import datetime, timezone

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200))
    # The 'summary' column is now removed and replaced by the ChatSummary relationship
    # summary = db.Column(db.Text, nullable=True) 
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    messages = db.relationship('Message', backref='chat', lazy=True, cascade='all, delete-orphan')
    # One-to-one relationship with ChatSummary
    summary = db.relationship('ChatSummary', backref='chat', uselist=False, lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Chat {self.id}>'

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default='text')  
    file_path = db.Column(db.String(500)) 
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def __repr__(self):
        return f'<Message {self.id}>'
