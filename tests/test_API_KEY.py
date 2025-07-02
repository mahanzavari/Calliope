from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

# Replace with your real API key
API_KEY = "AIzaSyAQnfFczNsZH5kqebcjT0iEOWe9Hhs5WnQ"

# Initialize the Gemini chat model with explicit key
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=API_KEY,  # directly passes your key
    temperature=0.7,
    max_retries=3,
)

# Prepare a chat request using LangChain messages
messages = [
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="Translate this sentence to French: 'LangChain simplifies API use.'"),
]

# Invoke the model
response = llm.invoke(messages)
print("💬 Response:", response.content)
response = llm.invoke("What is langchain provide a intro")
print(response.content)
