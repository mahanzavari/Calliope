import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-secret-key-change-this-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql://postgres:13831377@localhost:5432/calliope_ai'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Langchain and API Keys
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    SERPAPI_API_KEY = os.environ.get('SERPAPI_API_KEY')

    # Session configuration
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = 'uploads'
    
    # Mail settings
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') 