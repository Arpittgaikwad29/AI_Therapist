from flask import Flask, render_template, request, jsonify
import os
from threading import Thread
import time

# Import your existing therapist modules
# The imports below should be adjusted to match your project structure
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import LLMChain, StuffDocumentsChain
from langchain_community.chat_message_histories import ChatMessageHistory

# Load environment variables
load_dotenv()
os.environ["HF_TOKEN"] = os.environ.get("your_actual_huggingface_token_here")

# Initialize embedding model
print("🔄 Loading embedding model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Load the persisted database
print("📁 Loading pre-calculated vector database...")
persist_directory = "chroma_db"
vectorstore = Chroma(persist_directory=persist_directory, embedding_function=embeddings)
retriever = vectorstore.as_retriever()

# Initialize Groq LLM
print("🤖 Initializing LLM...")
groq_api_key = os.environ.get("your_actual_groq_api_key_her")
llm = ChatGroq(groq_api_key=groq_api_key, model_name="Llama3-8b-8192")

# Define system prompt
system_prompt = (
    "You are a compassionate and knowledgeable AI therapist. "
    "Your role is to provide emotional support, practical guidance, and mental health insights "
    "based on the retrieved context. Respond with empathy and validation while offering helpful solutions. "
    "Your responses should be concise (3-5 sentences) and action-oriented.\n\n"
    "Balance these approaches in your responses:\n"
    "1. Brief validation of feelings (1 sentence)\n"
    "2. One relevant insight or perspective shift\n"
    "3. One practical technique or exercise when appropriate (breathing exercises, grounding techniques, etc.)\n\n"
    "Use the following retrieved context to answer the question. "
    "If needed, ask one focused follow-up question, but prioritize providing immediate value. "
    "Your responses should be warm yet direct, creating a supportive space without unnecessary length.\n\n"
    "{context}"
)

# Set up prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
    ("system", "Use the following context: {context}")
])

# Initialize chat history
chat_history = ChatMessageHistory()

# Create LLM chain
llm_chain = LLMChain(llm=llm, prompt=prompt)

# Create StuffDocumentsChain for document processing
stuff_chain = StuffDocumentsChain(
    llm_chain=llm_chain,
    document_variable_name="context",
    input_key="input_documents"
)

def chat_with_ai(user_input):
    """Process user input and generate AI response with RAG"""
    try:
        # Retrieve relevant documents
        retrieved_docs = retriever.invoke(user_input)
        print(f"\n🔍 Retrieved {len(retrieved_docs)} documents")
        
        if retrieved_docs:
            context = "\n\n".join([doc.page_content for doc in retrieved_docs])
        else:
            context = "No specific context available. Responding based on general knowledge."
        
        # Prepare input data with history and context
        input_data = {
            "input": user_input,
            "context": context,
            "history": chat_history.messages,
            "input_documents": retrieved_docs 
        }
        
        # Generate response
        response = stuff_chain.invoke(input_data)
        
        # Extract response text with proper error handling
        if isinstance(response, dict) and "text" in response:
            response_text = response["text"]
        elif isinstance(response, dict) and "output_text" in response:
            response_text = response["output_text"]
        elif isinstance(response, str):
            response_text = response
        else:
            print("⚠️ Unexpected response format:", response)
            response_text = "I'm here to listen and support you. Could you tell me more about what's on your mind?"
        
        # Add the interaction to chat history
        chat_history.add_user_message(user_input)
        chat_history.add_ai_message(response_text)
        
        return response_text
    
    except Exception as e:
        print(f"⚠️ Error: {str(e)}")
        # Fallback response in case of errors
        fallback_response = "I'm here to support you. Can you share more about how you're feeling today?"
        chat_history.add_user_message(user_input)
        chat_history.add_ai_message(fallback_response)
        return fallback_response

# Initialize the Flask app
app = Flask(__name__)

# Store conversation history for display
conversation = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_audio', methods=['POST'])
def process_audio():
    if 'text' in request.json:
        user_input = request.json['text']
        print(f"Received user input: {user_input}")
        
        # Check for exit command
        if user_input.lower() in ["exit", "quit", "bye"]:
            return jsonify({
                "response": "Goodbye! Take care. 💙",
                "exit": True
            })
        
        # Process with AI and get response
        response = chat_with_ai(user_input)
        
        # Add to conversation history
        conversation.append({"role": "user", "content": user_input})
        conversation.append({"role": "assistant", "content": response})
        
        return jsonify({
            "response": response,
            "exit": False
        })
    
    return jsonify({"error": "No text provided"}), 400

@app.route('/get_conversation', methods=['GET'])
def get_conversation():
    return jsonify({"conversation": conversation})

if __name__ == '__main__':
    app.run(debug=True)