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
    GOOGLE_CUSTOM_SEARCH_ID = os.environ.get('GOOGLE_CUSTOM_SEARCH_ID')
    TAVILY_API_KEY = os.environ.get('TAVILY_API_KEY')
    BING_API_KEY = os.environ.get('BING_API_KEY')
    
    # Search Configuration
    SEARCH_PROVIDER = os.environ.get('SEARCH_PROVIDER', 'duckduckgo')  # duckduckgo, google_custom, web_scraping, fallback

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