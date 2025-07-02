#!/usr/bin/env python3
"""
Test script to verify Calliope AI setup
"""

import os
import sys
import importlib
from pathlib import Path
from sqlalchemy import text

def test_imports():
    """Test if required packages can be imported"""
    print("🔍 Testing package imports...")
    
    required_packages = [
        'flask',
        'langchain',
        'langchain_google_genai',
        'langchain_community',
        'duckduckgo_search',
        'sentence_transformers',
        'torch',
        'transformers',
        'PIL',
        'requests',
        'psycopg2',
        'flask_sqlalchemy',
        'flask_migrate',
        'flask_login',
        'flask_mail',
        'bs4'
    ]
    
    failed_imports = []
    
    for package in required_packages:
        try:
            importlib.import_module(package)
            print(f"✅ {package}")
        except ImportError as e:
            print(f"❌ {package}: {e}")
            failed_imports.append(package)
    
    if failed_imports:
        print(f"\n❌ Failed to import: {', '.join(failed_imports)}")
        return False
    
    print("✅ All packages imported successfully")
    return True

def test_configuration():
    """Test configuration files and directories"""
    print("\n🔍 Testing configuration...")
    
    # Check .env file
    env_file = Path('.env')
    if not env_file.exists():
        print("❌ .env file not found")
        return False
    print("✅ .env file exists")
    
    # Check uploads directory
    uploads_dir = Path('uploads')
    if not uploads_dir.exists():
        print("❌ uploads directory not found")
        return False
    print("✅ uploads directory exists")
    
    # Check API keys
    from dotenv import load_dotenv
    load_dotenv()
    
    google_key = os.environ.get('GOOGLE_API_KEY')
    database_url = os.environ.get('DATABASE_URL')
    search_provider = os.environ.get('SEARCH_PROVIDER', 'duckduckgo')
    
    if not google_key or google_key == 'your-google-api-key-here':
        print("⚠️  Google API key not configured")
    else:
        print("✅ Google API key configured")
    
    if not database_url:
        print("❌ Database URL not configured")
        return False
    else:
        print("✅ Database URL configured")
    
    print(f"✅ Search provider configured: {search_provider}")
    
    return True

def test_app_import():
    """Test if Flask app can be imported"""
    print("\n🔍 Testing Flask app import...")
    
    try:
        from app import create_app
        print("✅ Flask app imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Failed to import Flask app: {e}")
        return False

def test_database():
    """Test database connection"""
    print("\n🔍 Testing database connection...")
    
    try:
        from app import create_app
        from app.core.extensions import db
        
        app = create_app()
        
        with app.app_context():
            # Test database connection
            with db.engine.connect() as connection:
                connection.execute(text('SELECT 1'))
            print("✅ Database connection successful")
            return True
            
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\n📋 PostgreSQL Setup Required:")
        print("1. Install PostgreSQL if not already installed")
        print("2. Create database: createdb calliope_ai")
        print("3. Update DATABASE_URL in .env file")
        print("4. Run: flask db init && flask db migrate && flask db upgrade")
        return False

def test_search_providers():
    """Test search provider functionality"""
    print("\n🔍 Testing search providers...")
    
    try:
        from app.services.rag_service import RAGService
        
        # Test DuckDuckGo (should work without API key)
        rag_service = RAGService(search_provider='duckduckgo')
        results = rag_service.search_duckduckgo("test query", 1)
        
        if results:
            print("✅ DuckDuckGo search working")
        else:
            print("⚠️  DuckDuckGo search returned no results (may be rate limited)")
        
        return True
        
    except Exception as e:
        print(f"❌ Search provider test failed: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing Calliope AI Setup")
    print("=" * 40)
    
    tests = [
        ("Package Imports", test_imports),
        ("Configuration", test_configuration),
        ("Flask App Import", test_app_import),
        ("Database Connection", test_database),
        ("Search Providers", test_search_providers)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 40)
    print("📊 Test Results Summary")
    print("=" * 40)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Your setup is ready.")
        print("\nNext steps:")
        print("1. Activate virtual environment")
        print("2. Run: python run.py")
        print("3. Open http://localhost:5000")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        print("\nCommon solutions:")
        print("- Install missing packages: pip install -r requirements.txt")
        print("- Configure PostgreSQL and update .env file")
        print("- Run database migrations: flask db upgrade")
        print("- Check search provider configuration")
    
    return passed == len(results)

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)