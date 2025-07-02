import os
import json
from flask import Blueprint, request, jsonify, stream_with_context, Response, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.services.chat_service import ChatService
from app.models import Chat, Message
from app.core.extensions import db

chat_bp = Blueprint('chat', __name__)
chat_service = ChatService()

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'py', 'js', 'html', 'css', 'java', 'cpp', 'c'}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@chat_bp.route('/chat', methods=['POST'])
@login_required
def chat():
    """Main chat endpoint with streaming response and memory."""
    data = request.json
    query = data.get('message', '').strip()
    use_search = data.get('use_search', False)
    # NEW: Get the research mode flag
    is_research_mode = data.get('is_research_mode', False)
    chat_id = data.get('chat_id')

    if not query and not data.get('is_file_upload_message'):
        return jsonify({"error": "Message is required"}), 400

    def generate():
        """Yields a stream of structured JSON events from the service."""
        try:
            # NEW: Pass the flag to the service
            for event in chat_service.get_response(query, chat_id, use_search, is_research_mode):
                yield f'data: {json.dumps(event)}\n\n'
        except Exception as e:
            current_app.logger.error(f"Error in chat stream: {e}", exc_info=True)
            yield f'data: {json.dumps({"type": "error", "message": "An unexpected error occurred on the server."})}\n\n'

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Handle file uploads"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request. Make sure the form field name is 'file'."}), 400

    file = request.files.get('file')

    if not file or not file.filename:
        return jsonify({"error": "No file selected or the file has no name."}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            upload_folder = os.path.join(current_app.root_path, '..', 'uploads')
            os.makedirs(upload_folder, exist_ok=True)
            file_path = os.path.join(upload_folder, filename)
            file.save(file_path)

            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                file_content = f.read()

            file_ext = filename.rsplit('.', 1)[1].lower()
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
        chat_list = [{
            'id': chat.id,
            'title': chat.title,
            'updated_at': chat.updated_at.isoformat()
        } for chat in chats]
        return jsonify({"chats": chat_list})
    except Exception as e:
        return jsonify({"error": f"Error retrieving chats: {str(e)}"}), 500

@chat_bp.route('/chats/<int:chat_id>', methods=['PUT'])
@login_required
def rename_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or you don't have permission"}), 404
    
    data = request.json
    new_title = data.get('title', '').strip()

    if not new_title:
        return jsonify({"error": "Title cannot be empty"}), 400
    
    try:
        chat.title = new_title
        db.session.commit()
        return jsonify({"success": True, "message": "Chat renamed successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to rename chat: {str(e)}"}), 500

@chat_bp.route('/chats/<int:chat_id>', methods=['DELETE'])
@login_required
def delete_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()
    if not chat:
        return jsonify({"error": "Chat not found or you don't have permission"}), 404

    try:
        db.session.delete(chat)
        db.session.commit()
        return jsonify({"success": True, "message": "Chat deleted successfully."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete chat: {str(e)}"}), 500


@chat_bp.route('/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_chat_messages(chat_id):
    """Get messages for a specific chat"""
    try:
        chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first()
        if not chat:
            return jsonify({"error": "Chat not found"}), 404

        messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at.asc()).all()
        message_list = [{'id': msg.id, 'role': msg.role, 'content': msg.content} for msg in messages]

        return jsonify({"messages": message_list})
    except Exception as e:
        return jsonify({"error": f"Error retrieving messages: {str(e)}"}), 500