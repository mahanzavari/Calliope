from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from app.core.extensions import db, mail
from app.models import User
from flask_mail import Message as MailMessage
import re

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    data = request.json
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    # Validation
    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400
    
    # Password complexity policy
    password_policy = [
        (r'.{8,}', 'at least 8 characters'),
        (r'[A-Z]', 'an uppercase letter'),
        (r'[a-z]', 'a lowercase letter'),
        (r'\d', 'a digit'),
        (r'[^A-Za-z0-9]', 'a special character'),
    ]
    failed_rules = [desc for regex, desc in password_policy if not re.search(regex, password)]
    if failed_rules:
        return jsonify({
            "error": "Password must contain " + ', '.join(failed_rules)
        }), 400
    
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400
    
    try:
        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Log in the user
        login_user(user)
        
        return jsonify({
            "success": True,
            "message": "Registration successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.json
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    try:
        # Find user by username or email
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        if user and user.check_password(password):
            login_user(user, remember=True)
            
            return jsonify({
                "success": True,
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email
                }
            })
        else:
            return jsonify({"error": "Invalid username or password"}), 401
            
    except Exception as e:
        return jsonify({"error": f"Login failed: {str(e)}"}), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """User logout endpoint"""
    try:
        logout_user()
        return jsonify({"success": True, "message": "Logout successful"})
    except Exception as e:
        return jsonify({"error": f"Logout failed: {str(e)}"}), 500

@auth_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    """Get current user profile"""
    try:
        return jsonify({
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "created_at": current_user.created_at.isoformat()
            }
        })
    except Exception as e:
        return jsonify({"error": f"Error retrieving profile: {str(e)}"}), 500

@auth_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile"""
    data = request.json
    
    try:
        if 'username' in data:
            new_username = data['username'].strip()
            if new_username and new_username != current_user.username:
                # Check if username is already taken
                if User.query.filter_by(username=new_username).first():
                    return jsonify({"error": "Username already exists"}), 400
                current_user.username = new_username
        
        if 'email' in data:
            new_email = data['email'].strip()
            if new_email and new_email != current_user.email:
                # Check if email is already taken
                if User.query.filter_by(email=new_email).first():
                    return jsonify({"error": "Email already registered"}), 400
                current_user.email = new_email
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Profile update failed: {str(e)}"}), 500