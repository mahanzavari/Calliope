# In app/api/chat.py

import os
import json
from flask import Blueprint, request, jsonify, stream_with_context, Response, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.services.chat_service import ChatService
from app.core.extensions import db
from app.models import Chat, Message
from datetime import datetime

chat_bp = Blueprint('chat', __name__)
chat_service = ChatService()

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'py', 'js', 'html', 'css', 'java', 'cpp', 'c'}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_file(filename):
    """Check if file extension is allowed"""
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'py', 'js', 'html', 'css', 'java', 'cpp', 'c'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@chat_bp.route('/chat', methods=['POST'])
@login_required
def chat():
    """Main chat endpoint with streaming response"""
    data = request.json
    query = data.get('message', '').strip()
    use_search = data.get('use_search', False)
    quoted_text = data.get('quoted_text', '')

    if not query:
        return jsonify({"error": "Message is required"}), 400

    # Combine quoted text with query if present
    if quoted_text:
        query = f"Regarding: '{quoted_text}'\n\n{query}"

    def generate():
        try:
            # Send searching notification if RAG is enabled
            if use_search:
                yield f'data: {json.dumps({"status": "searching", "message": "Searching..."})}\n\n'

            # Get response from chat service
            response = chat_service.get_response(query, use_search)

            # Send the response
            yield f'data: {json.dumps({"response": response})}\n\n'

            # Save to database
            save_chat_to_db(query, response)

        except Exception as e:
            error_msg = f"An error occurred: {str(e)}"
            yield f'data: {json.dumps({"error": error_msg})}\n\n'

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Handle file uploads"""
    # --- MODIFICATION START ---
    # Use .get() for safer access and provide more specific error messages.
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request. Make sure the form field name is 'file'."}), 400

    file = request.files.get('file')

    if not file or not file.filename:
        return jsonify({"error": "No file selected or the file has no name."}), 400
    # --- MODIFICATION END ---

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)

            # Create uploads directory if it doesn't exist
            upload_folder = os.path.join(current_app.root_path, '..', 'uploads')
            os.makedirs(upload_folder, exist_ok=True)

            file_path = os.path.join(upload_folder, filename)
            file.save(file_path)

            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()

            # Get file extension
            file_ext = filename.rsplit('.', 1)[1].lower()

            # Process file content
            processed_content = chat_service.process_file_content(file_content, file_ext)

            return jsonify({
                "success": True,
                "filename": filename,
                "content": processed_content,
                "file_path": file_path
            })

        except Exception as e:
            return jsonify({"error": f"Error processing file: {str(e)}"}), 500

    supported_files_str = ", ".join(sorted(list(ALLOWED_EXTENSIONS)))
    return jsonify({
        "success": False,
        "error": f"File type not supported. Supported types are: {supported_files_str}"
    }), 400

@chat_bp.route('/chats', methods=['GET'])
@login_required
def get_chats():
    """Get user's chat history"""
    try:
        chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.updated_at.desc()).all()
        chat_list = []

        for chat in chats:
            messages = Message.query.filter_by(chat_id=chat.id).order_by(Message.created_at.asc()).all()
            chat_data = {
                'id': chat.id,
                'title': chat.title or f"Chat {chat.id}",
                'created_at': chat.created_at.isoformat(),
                'updated_at': chat.updated_at.isoformat(),
                'message_count': len(messages)
            }
            chat_list.append(chat_data)

        return jsonify({"chats": chat_list})

    except Exception as e:
        return jsonify({"error": f"Error retrieving chats: {str(e)}"}), 500

@chat_bp.route('/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_chat_messages(chat_id):
    """Get messages for a specific chat"""
    try:
        chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()
        if not chat:
            return jsonify({"error": "Chat not found"}), 404

        messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at.asc()).all()
        message_list = []

        for message in messages:
            message_data = {
                'id': message.id,
                'role': message.role,
                'content': message.content,
                'content_type': message.content_type,
                'created_at': message.created_at.isoformat()
            }
            message_list.append(message_data)

        return jsonify({"messages": message_list})

    except Exception as e:
        return jsonify({"error": f"Error retrieving messages: {str(e)}"}), 500

def save_chat_to_db(user_message: str, bot_response: str):
    """Save chat messages to database"""
    try:
        # Get or create chat session
        chat = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.updated_at.desc()).first()
        if not chat:
            chat = Chat(user_id=current_user.id, title="New Chat")
            db.session.add(chat)
            db.session.flush()  # Get the chat ID

        # Create messages
        user_msg = Message(
            chat_id=chat.id,
            role='user',
            content=user_message,
            content_type='text'
        )

        bot_msg = Message(
            chat_id=chat.id,
            role='assistant',
            content=bot_response,
            content_type='text'
        )

        db.session.add_all([user_msg, bot_msg])
        db.session.commit()

    except Exception as e:
        print(f"Error saving chat to database: {e}")
        db.session.rollback()