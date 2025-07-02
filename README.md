# Calliope AI Chat Application

A modern AI chat application built with Flask, Langchain, and Google's Gemini AI, featuring intelligent RAG (Retrieval-Augmented Generation) capabilities with multiple search provider options.

## 🌟 Features

### AI Capabilities
- **Google Gemini AI Integration**: Powered by Google's latest AI model
- **Intelligent RAG System**: Automatic decision-making for web search vs. direct answers
- **Multiple Search Providers**: DuckDuckGo, Google Custom Search, Web Scraping
- **Manual Search Toggle**: Force web search for every query
- **Real-time Streaming**: Live response generation with "Searching..." notifications
- **File Analysis**: Upload and analyze images, code files, and documents

### Chat Features
- **Message Quoting**: Quote AI responses in new messages
- **File Uploads**: Support for images, code files, and documents
- **Chat History**: Persistent conversation storage
- **Streaming Responses**: Real-time message generation
- **Search Modes**: Auto and manual web search options

### User Interface
- **Modern Design**: Clean, responsive interface
- **Dark/Light Themes**: User preference with localStorage
- **Real-time Features**: Character count, auto-resize, streaming
- **Mobile Responsive**: Works on all devices
- **Message Actions**: Quote, copy, and file upload capabilities

### Authentication & Security
- **User Registration/Login**: Secure authentication system
- **Profile Management**: Update username and email
- **Session Management**: Persistent login sessions
- **Password Security**: Hashed password storage

## 📁 Project Structure

```
/calliope-ai
├── app/
│   ├── api/                 # API endpoints (chat, auth)
│   ├── core/               # Configuration & extensions
│   ├── models/             # Database models (User, Chat, Message)
│   ├── services/           # Business logic (ChatService, RAGService)
│   ├── static/             # CSS, JS files
│   └── templates/          # HTML templates
├── uploads/               # File upload directory
├── .env                   # Environment configuration
├── requirements.txt       # Dependencies
├── run.py                # Application entry point
├── setup.py              # Automated setup script
├── test_setup.py         # Setup verification
└── README.md             # This file
```

## 🚀 Installation & Setup

### Prerequisites

- **Python 3.8+**
- **PostgreSQL 12+**
- **Google API Key** (for Gemini AI)
- **Google Custom Search ID** (optional, for enhanced search)

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mahanzavari/Calliope
   cd Calliope
   ```

2. **Run automated setup**:
   ```bash
   python setup.py
   ```

3. **Configure PostgreSQL**:
   ```bash
   # Create database
   createdb calliope_ai
   
   # Update .env file with your database credentials
   ```

4. **Update API keys** in `.env`:
   ```env
   GOOGLE_API_KEY=your-google-api-key-here
   GOOGLE_CUSTOM_SEARCH_ID=your-google-custom-search-id-here
   DATABASE_URL=postgresql://username:password@localhost:5432/calliope_ai
   SEARCH_PROVIDER=duckduckgo
   ```

5. **Initialize database**:
   ```bash
   python init_db.py
   ```

6. **Run the application**:
   ```bash
   python run.py
   ```

7. **Access the application**: Open http://localhost:5000

### Manual Setup

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install --upgrade -r requirements.txt
   pip install --upgrade langchain langchain-core langchain-google-genai langchain-community sentence-transformers torch transformers
   ```

3. **Install PostgreSQL**:
   - **Windows**: Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
   - **macOS**: `brew install postgresql`
   - **Ubuntu/Debian**: `sudo apt-get install postgresql postgresql-contrib`

4. **Create database**:
   ```bash
   createdb calliope_ai
   ```

5. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

6. **Initialize database**:
   ```bash
   python init_db.py
   ```

7. **Run the application**:
   ```bash
   python run.py
   ```

## 🔍 Search Provider Options

The application supports multiple search providers for web search functionality:

### 1. **DuckDuckGo** (Default)
- **Free**: No API key required
- **Privacy-focused**: No tracking
- **Rate limits**: Moderate usage limits
- **Configuration**: `SEARCH_PROVIDER=duckduckgo`

### 2. **Google Custom Search**
- **Enhanced results**: Better search quality
- **API key required**: Google API key + Custom Search ID
- **Quota limits**: 100 free queries/day
- **Configuration**: 
  ```env
  SEARCH_PROVIDER=google_custom
  GOOGLE_API_KEY=your-key
  GOOGLE_CUSTOM_SEARCH_ID=your-search-id
  ```

### 3. **Web Scraping**
- **Fallback option**: Simple HTML scraping
- **No API key**: Works without external services
- **Limited results**: Basic search functionality
- **Configuration**: `SEARCH_PROVIDER=web_scraping`

### 4. **Fallback Mode**
- **Automatic**: Tries multiple providers
- **Resilient**: Falls back if one fails
- **Best option**: For production use
- **Configuration**: `SEARCH_PROVIDER=fallback`

## 🎯 Usage

### Getting Started

1. **Register/Login**: Create an account or sign in
2. **Start Chatting**: Begin conversations with the AI
3. **Toggle Search**: Use the search button to enable/disable web search
4. **Upload Files**: Drag & drop or click to upload files
5. **Quote Messages**: Click "Quote" on any AI response

### Features

- **Auto-Search Mode**: AI decides when to search based on confidence
- **Manual Search Mode**: Force web search for every query
- **File Analysis**: Upload images, code, and documents for analysis
- **Message Quoting**: Reference previous responses in new messages
- **Theme Toggle**: Switch between dark and light themes
- **Dashboard**: View chat history and manage profile

## 🔧 RAG System Architecture

The application uses an intelligent RAG (Retrieval-Augmented Generation) system:

1. **Query Analysis**: AI analyzes if the query requires external information
2. **Confidence Check**: Determines if direct answer or web search is needed
3. **Search & Retrieval**: Performs web search using configured provider
4. **Document Reranking**: Uses semantic similarity for better results
5. **Response Generation**: Combines AI knowledge with search results

### Search Modes

- **Auto Mode**: AI automatically decides when to search
- **Manual Mode**: Force search for every query
- **Searching Indicator**: Real-time notification during RAG operations

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile

### Chat
- `POST /api/chat` - Send message (streaming response)
- `POST /api/upload` - Upload files
- `GET /api/chats` - Get chat history
- `GET /api/chats/<id>/messages` - Get chat messages

## ⚙️ Configuration

### Environment Variables

```env
# Required
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://username:password@localhost:5432/calliope_ai
GOOGLE_API_KEY=your-google-api-key-here

# Optional
GOOGLE_CUSTOM_SEARCH_ID=your-google-custom-search-id-here
SEARCH_PROVIDER=duckduckgo
FLASK_ENV=development
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### Database Configuration

The application uses PostgreSQL for data persistence:

- **Database**: `calliope_ai`
- **Tables**: `user`, `chat`, `message`
- **Migrations**: Flask-Migrate for schema management

### Search Provider Configuration

- **DuckDuckGo**: No additional configuration needed
- **Google Custom Search**: Requires Google API key and Custom Search ID
- **Web Scraping**: No additional configuration needed
- **Fallback**: Automatically tries all available providers

### Customization

- **Theme Colors**: Modify CSS variables in `app/static/css/style.css`
- **File Upload**: Adjust allowed extensions in `app/api/chat.py`
- **Search Settings**: Configure RAG parameters in `app/services/chat_service.py`

## 🛠️ Development

### Project Structure Benefits

- **Low Coupling**: Services are independent and easily testable
- **High Cohesion**: Related functionality is grouped together
- **Scalable**: Easy to add new features and services
- **Maintainable**: Clear separation of concerns

### Adding New Features

1. **Models**: Add database models in `app/models/`
2. **Services**: Create business logic in `app/services/`
3. **API**: Add endpoints in `app/api/`
4. **Templates**: Create views in `app/templates/`
5. **Static**: Add CSS/JS in `app/static/`

### Database Migrations

```bash
# Create migration
flask db migrate -m "Description of changes"

# Apply migration
flask db upgrade

# Rollback migration
flask db downgrade
```

### Testing

```bash
# Run setup tests
python test_setup.py

# Run application tests (if available)
python -m pytest
```

## 🛠️ RAG Provider Configuration

You can control which search providers are used by setting the `SEARCH_PROVIDERS` environment variable in your `.env` file:

```
SEARCH_PROVIDERS=tavily,bing,duckduckgo
```

Providers will be used in the order listed. Make sure you have the necessary API keys for each provider in your `.env` file if required.

## 🛠️ Troubleshooting

### Git Troubleshooting
If your Python files are not being staged by git, check your `.gitignore` for a `*.py` entry. Remove or comment it out to allow tracking of `.py` files.

### Langchain Import Errors
If you encounter errors such as `ModuleNotFoundError: No module named 'langchain_core.tracers.context'`, upgrade your langchain packages:

```
pip install --upgrade langchain langchain-core langchain-google-genai langchain-community
```

### Common Issues

1. **PostgreSQL Connection Error**:
   - Ensure PostgreSQL is running
   - Check database credentials in `.env`
   - Verify database exists: `createdb calliope_ai`

2. **API Key Errors**:
   - Verify Google API key is valid
   - Check Google Custom Search configuration
   - Ensure keys are properly set in `.env`

3. **Search Provider Issues**:
   - DuckDuckGo: May be rate limited, try fallback mode
   - Google Custom Search: Check API key and search ID
   - Web Scraping: May be blocked by some websites

4. **Import Errors**:
   - Activate virtual environment
   - Install dependencies: `pip install -r requirements.txt`
   - Check Python version (3.8+ required)

5. **Database Errors**:
   - Run migrations: `flask db upgrade`
   - Check database connection
   - Verify PostgreSQL installation

### Logs

Check application logs for detailed error information:
- Flask debug mode shows detailed errors
- Database connection issues appear in console
- API errors are returned in JSON format

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful language model capabilities
- **Langchain** for AI framework and tools
- **Flask** for the web framework
- **PostgreSQL** for reliable database storage
- **DuckDuckGo** for privacy-focused search
- **Font Awesome** for beautiful icons
- **Marked.js** for markdown rendering

---

**Calliope AI** - Intelligent conversations powered by modern AI technology. 