from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Main chat interface"""
    if current_user.is_authenticated:
        return render_template('index.html')
    return redirect(url_for('main.login'))

@main_bp.route('/login')
def login():
    """Login page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/login.html')

@main_bp.route('/register')
def register():
    """Registration page"""
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    return render_template('auth/register.html')

@main_bp.route('/dashboard')
@login_required
def dashboard():
    """User dashboard with integrated memory management."""
    return render_template('auth/dashboard.html')
