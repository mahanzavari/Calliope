from app import create_app
from dotenv import load_dotenv

load_dotenv()

app = create_app()

if __name__ == '__main__':
    app.run(debug=True,use_reloader = True, exclude_patterns=['uploads/*'] ,  host='0.0.0.0', port=5000) 