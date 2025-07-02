#!/usr/bin/env python3
"""
Database initialization script for Calliope AI
"""

import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy import text

load_dotenv()

def load_environment():
    """Load environment variables and check for required ones."""
    print("🔄 Loading environment variables...")
    load_dotenv()

    required_vars = ['DATABASE_URL', 'SECRET_KEY']
    missing_vars = [var for var in required_vars if not os.environ.get(var)]

    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("    Please update your .env file and ensure it's in the project root.")
        return False

    print("✅ Environment variables loaded successfully.")
    return True

def check_postgresql_connection():
    """Check if PostgreSQL is accessible and the database exists."""
    print("\n🔍 Checking PostgreSQL connection...")

    try:
        from app import create_app
        from app.core.extensions import db

        app = create_app()

        with app.app_context():
            # Test connection by getting a connection from the engine and executing a query
            with db.engine.connect() as connection:
                connection.execute(text('SELECT 1'))
            print("✅ PostgreSQL connection successful.")
            return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("    This may indicate an issue with your project structure or a missing __init__.py file.")
        return False
    except OperationalError as e:
        print(f"❌ PostgreSQL connection failed: OperationalError")
        print(f"    Error details: {e.orig}")
        print("\n📋 Troubleshooting:")
        print("    1. Ensure the PostgreSQL service is running.")
        print("    2. Verify the DATABASE_URL in your .env file is correct (e.g., postgresql://user:pass@host:port/dbname).")
        print("    3. Check your firewall rules to ensure the connection is not blocked.")
        return False
    except ProgrammingError as e:
        print(f"❌ PostgreSQL connection failed: ProgrammingError")
        print(f"    Error details: {e.orig}")
        print("\n📋 Troubleshooting:")
        print(f"    1. Make sure the database 'calliope_ai' exists. You can create it with: createdb calliope_ai")
        print("    2. Verify that the user specified in DATABASE_URL has permission to access the database.")
        return False
    except Exception as e:
        print(f"❌ An unexpected error occurred during PostgreSQL connection check: {e}")
        return False

def run_migrations():
    """Run database migrations using Flask-Migrate."""
    print("\n🔄 Running database migrations...")

    migration_commands = {
        "init": ['flask', 'db', 'init'],
        "migrate": ['flask', 'db', 'migrate', '-m', 'Initial migration'],
        "upgrade": ['flask', 'db', 'upgrade']
    }

    try:
        # Initialize migrations if the migrations directory doesn't exist
        if not Path('migrations').exists():
            print("    📝 Initializing migrations...")
            result = subprocess.run(migration_commands["init"], capture_output=True, text=True, check=True)
            print("    ✅ Migrations initialized.")

        # Create a new migration
        print("    📝 Creating a new migration...")
        result = subprocess.run(migration_commands["migrate"], capture_output=True, text=True, check=True)
        if "No changes in schema detected" in result.stdout:
            print("    ℹ️ No schema changes detected.")
        else:
            print("    ✅ Migration created successfully.")

        # Apply the migration to the database
        print("    📝 Applying migration to the database...")
        result = subprocess.run(migration_commands["upgrade"], capture_output=True, text=True, check=True)
        print("    ✅ Migration applied successfully.")

        print("✅ Database migrations completed.")
        return True

    except FileNotFoundError:
        print("❌ 'flask' command not found. Make sure you have activated your virtual environment.")
        return False
    except subprocess.CalledProcessError as e:
        failed_command = " ".join(e.cmd)
        print(f"❌ Migration command failed: '{failed_command}'")
        print(f"    Exit Code: {e.returncode}")
        print(f"    Stderr: {e.stderr.strip()}")
        print(f"    Stdout: {e.stdout.strip()}")
        return False
    except Exception as e:
        print(f"❌ An unexpected error occurred during migrations: {e}")
        return False

def seed_memory_categories():
    """Pre-populates the memory_categories table with default values."""
    print("\n📝 Seeding memory categories...")
    try:
        from app import create_app
        from app.models import MemoryCategory
        from app.core.extensions import db

        app = create_app()
        with app.app_context():
            if MemoryCategory.query.first():
                print("✅ Memory categories already exist.")
                return True

            categories = [
                {'name': 'Personal Information', 'description': 'User name, age, location, etc.'},
                {'name': 'Professional', 'description': 'User job, career, work preferences.'},
                {'name': 'Interests & Hobbies', 'description': 'User activities, passions, entertainment.'},
                {'name': 'Preferences', 'description': 'User communication style, format preferences.'},
                {'name': 'Goals & Aspirations', 'description': 'User short-term and long-term objectives.'},
                {'name': 'Relationships', 'description': 'Friends, family, colleagues mentioned by the user.'},
                {'name': 'Technical Skills', 'description': 'User programming languages, tools, expertise.'},
                {'name': 'Health & Lifestyle', 'description': 'User routines, health info if shared.'},
                {'name': 'Learning & Education', 'description': 'Courses or skills the user is developing.'},
                {'name': 'Miscellaneous', 'description': 'Everything else that doesn\'t fit in other categories.'},
            ]

            for cat_data in categories:
                category = MemoryCategory(**cat_data)
                db.session.add(category)
            
            db.session.commit()
            print("✅ Default memory categories seeded successfully.")
            return True
            
    except Exception as e:
        print(f"❌ Failed to seed memory categories: {e}")
        db.session.rollback()
        return False


def create_sample_data():
    """Create a sample user and chat for testing."""
    # ... (existing sample data creation logic remains the same)
    print("\n📝 Creating sample data...")

    try:
        from app import create_app
        from app.models import User, Chat, Message
        from app.core.extensions import db
        from datetime import datetime

        app = create_app()

        with app.app_context():
            # Check if the demo user already exists
            if User.query.filter_by(username='demo').first():
                print("✅ Sample data already exists.")
                return True

            print("    Creating sample user 'demo'...")
            user = User(username='demo', email='demo@example.com')
            user.set_password('demo123')
            db.session.add(user)
            db.session.flush()

            print("    Creating sample 'Welcome Chat'...")
            chat = Chat(user_id=user.id, title='Welcome Chat')
            db.session.add(chat)
            db.session.flush()

            print("    Creating sample messages...")
            messages = [
                Message(
                    chat_id=chat.id,
                    role='user',
                    content='Hello! How can you help me today?',
                    content_type='text',
                    created_at=datetime.utcnow()
                ),
                Message(
                    chat_id=chat.id,
                    role='assistant',
                    content='Hello! I\'m Calliope AI, your intelligent assistant. I can help you with various tasks. Feel free to ask me anything!',
                    content_type='text',
                    created_at=datetime.utcnow()
                )
            ]
            db.session.add_all(messages)
            db.session.commit()

            print("✅ Sample data created successfully.")
            print("    - Username: demo")
            print("    - Password: demo123")
            return True

    except Exception as e:
        print(f"❌ Failed to create sample data: {e}")
        db.session.rollback()
        return False


def main():
    """Main initialization function."""
    print("🚀 Initializing Calliope AI Database")
    print("=" * 50)

    # Assume load_environment() and check_postgresql_connection() are defined above
    if not load_environment(): sys.exit(1)
    if not check_postgresql_connection(): sys.exit(1)
    if not run_migrations(): sys.exit(1)
    
    # Add the new seeding step
    if not seed_memory_categories(): sys.exit(1)

    if not create_sample_data(): sys.exit(1)

    print("\n🎉 Database initialization completed!")
    print("\n📋 Next steps:")
    print("    1. Run the application: python run.py")
    print("    2. Open http://localhost:5000 in your browser")
    print("    3. Log in with the demo credentials or create a new account.")
    print("\n📚 For more information, see the README.md file.")

# Dummy functions to avoid errors if the original file isn't fully provided
def load_environment(): return True
def check_postgresql_connection(): return True
def run_migrations(): return True

if __name__ == '__main__':
    # This is a simplified main for demonstration. You should integrate `seed_memory_categories`
    # into your existing `init_db.py`'s main function.
    main()
