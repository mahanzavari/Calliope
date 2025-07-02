from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.services.memory_service import UserMemoryService

memory_bp = Blueprint('memory', __name__)
memory_service = UserMemoryService()

@memory_bp.route('/memories', methods=['GET'])
@login_required
def get_memories():
    """Get all of a user's memories, with optional category filtering."""
    category_id = request.args.get('category_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    if category_id:
        memories_pagination = memory_service.get_memories_by_category(current_user.id, category_id, page, per_page)
    else:
        memories_pagination = memory_service.get_all_memories(current_user.id, page, per_page)
    
    return jsonify({
        "memories": [{
            "id": mem.id,
            "title": mem.title,
            "content": mem.content,
            "category_id": mem.category_id,
            "category_name": mem.category.name,
            "importance_score": mem.importance_score,
            "is_verified": mem.is_verified,
            "last_accessed_at": mem.last_accessed_at.isoformat()
        } for mem in memories_pagination.items],
        "total": memories_pagination.total,
        "page": memories_pagination.page,
        "pages": memories_pagination.pages,
        "has_next": memories_pagination.has_next,
        "has_prev": memories_pagination.has_prev
    })

@memory_bp.route('/memories', methods=['POST'])
@login_required
def add_memory():
    """Add a new memory manually."""
    data = request.json
    if not data or 'title' not in data or 'content' not in data or 'category_id' not in data:
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        memory = memory_service.create_memory(data)
        return jsonify({"success": True, "memory_id": memory.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@memory_bp.route('/memories/<int:memory_id>', methods=['PUT'])
@login_required
def update_memory(memory_id):
    """Update an existing memory."""
    data = request.json
    try:
        memory_service.update_memory(memory_id, data)
        return jsonify({"success": True})
    except PermissionError:
        return jsonify({"error": "Unauthorized"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@memory_bp.route('/memories/<int:memory_id>', methods=['DELETE'])
@login_required
def delete_memory(memory_id):
    """Delete a memory."""
    try:
        memory_service.delete_memory(memory_id)
        return jsonify({"success": True})
    except PermissionError:
        return jsonify({"error": "Unauthorized"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@memory_bp.route('/memories/<int:memory_id>/verify', methods=['POST'])
@login_required
def verify_memory(memory_id):
    """Mark a memory as verified by the user."""
    try:
        memory_service.verify_memory(memory_id, is_verified=True)
        return jsonify({"success": True})
    except PermissionError:
        return jsonify({"error": "Unauthorized"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@memory_bp.route('/memories/categories', methods=['GET'])
@login_required
def get_memory_categories():
    """Get all available memory categories."""
    categories = memory_service.get_all_categories()
    return jsonify([{"id": cat.id, "name": cat.name, "description": cat.description} for cat in categories])
