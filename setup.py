"""
Setup script for Calliope AI Chat Application
"""

import os
import sys
import subprocess
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e.stderr}")
        return False

def create_env_file():
    """Create .env file with template values"""
    env_content = """# Calliope AI Configuration
SECRET_KEY=your-secret-key-change-this-in-production
DATABASE_URL=postgresql://postgres:13831377@localhost:5432/calliope_ai
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_CUSTOM_SEARCH_ID=your-google-custom-search-id-here
SEARCH_PROVIDER=duckduckgo
FLASK_ENV=development
"""
    
    env_file = Path('.env')
    if not env_file.exists():
        print("📝 Creating .env file...")
        with open(env_file, 'w') as f:
            f.write(env_content)
        print("✅ .env file created")
        print("⚠️  Please update the API keys and database credentials in .env file before running the application")
    else:
        print("✅ .env file already exists")

def create_uploads_directory():
    """Create uploads directory"""
    uploads_dir = Path('uploads')
    if not uploads_dir.exists():
        print("📁 Creating uploads directory...")
        uploads_dir.mkdir()
        print("✅ Uploads directory created")
    else:
        print("✅ Uploads directory already exists")

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        return False
    print(f"✅ Python version {sys.version.split()[0]} is compatible")
    return True

def check_postgresql():
    """Check if PostgreSQL is installed and running"""
    print("🔍 Checking PostgreSQL installation...")
    
    # Check if psql command is available
    try:
        result = subprocess.run(['psql', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ PostgreSQL found: {result.stdout.strip()}")
            return True
        else:
            print("❌ PostgreSQL not found or not accessible")
            return False
    except FileNotFoundError:
        print("❌ PostgreSQL not installed")
        return False

def setup_postgresql():
    """Guide user through PostgreSQL setup"""
    print("\n📋 PostgreSQL Setup Instructions:")
    print("=" * 40)
    
    print("1. Install PostgreSQL:")
    if os.name == 'nt':  # Windows
        print("   - Download from: https://www.postgresql.org/download/windows/")
        print("   - Run installer and follow setup wizard")
        print("   - Remember the password you set for 'postgres' user")
    elif sys.platform == 'darwin':  # macOS
        print("   - Install with Homebrew: brew install postgresql")
        print("   - Start service: brew services start postgresql")
    else:  # Linux
        print("   - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib")
        print("   - CentOS/RHEL: sudo yum install postgresql postgresql-server")
        print("   - Start service: sudo systemctl start postgresql")
    
    print("\n2. Create database:")
    print("   - Connect to PostgreSQL: psql -U postgres")
    print("   - Create database: CREATE DATABASE calliope_ai;")
    print("   - Or use command line: createdb -U postgres calliope_ai")
    
    print("\n3. Update .env file:")
    print("   - Edit DATABASE_URL with your credentials")
    print("   - Format: postgresql://username:password@localhost:5432/calliope_ai")
    
    print("\n4. Test connection:")
    print("   - Run: python test_setup.py")
    
    return True

def main():
    """Main setup function"""
    print("🚀 Setting up Calliope AI Chat Application")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Check PostgreSQL
    if not check_postgresql():
        setup_postgresql()
        print("\nContinue with setup? (y/n): ", end="")
        response = input().lower().strip()
        if response != 'y':
            sys.exit(1)
    
    # Install dependencies directly (no virtual environment)
    print("📦 Installing dependencies in current Python environment...")
    if not run_command('pip install -r requirements.txt', 'Installing dependencies'):
        sys.exit(1)
    
    # Create necessary directories and files
    create_env_file()
    create_uploads_directory()
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Configure PostgreSQL:")
    print("   - Create database: createdb calliope_ai")
    print("   - Update DATABASE_URL in .env file with your credentials")
    print("2. Configure Search Providers:")
    print("   - DuckDuckGo (default): No API key required")
    print("   - Google Custom Search: Get GOOGLE_CUSTOM_SEARCH_ID from Google")
    print("   - Update SEARCH_PROVIDER in .env file")
    print("3. Update the API keys in .env file:")
    print("   - Get Google API key from: https://makersuite.google.com/app/apikey")
    print("4. Initialize database:")
    print("   python init_db.py")
    print("5. Run the application:")
    print("   python run.py")
    print("6. Open http://localhost:5000 in your browser")
    
    print("\n🔍 Search Provider Options:")
    print("   - duckduckgo: Free, no API key required (default)")
    print("   - google_custom: Google Custom Search API")
    print("   - web_scraping: Simple web scraping fallback")
    print("   - fallback: Tries multiple providers automatically")
    
    print("\n📚 For more information, see README.md")

if __name__ == '__main__':
    main() 