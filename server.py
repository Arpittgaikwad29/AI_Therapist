from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Initialize Flask app and CORS
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load pre-trained DialoGPT model and tokenizer
print("Loading DialoGPT model...")
tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")

# Initialize Sentiment Analyzer
sentiment_analyzer = SentimentIntensityAnalyzer()

# Generate AI response
def get_ai_response(user_message):
    # Tokenize user input
    new_user_input_ids = tokenizer.encode(user_message + tokenizer.eos_token, return_tensors="pt")
    # Get the AI's response
    bot_output = model.generate(new_user_input_ids, max_length=1000, pad_token_id=tokenizer.eos_token_id, temperature=0.7)
    # Decode the AI's response
    bot_message = tokenizer.decode(bot_output[:, new_user_input_ids.shape[-1]:][0], skip_special_tokens=True)
    return bot_message

# Route to serve index.html (Home page)
@app.route('/')
def home():
    return render_template('index.html')  # Serve the HTML page

# Route for the chat endpoint
@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')
    
    # Sentiment Analysis
    sentiment_score = sentiment_analyzer.polarity_scores(user_message)['compound']
    if sentiment_score < -0.3:
        mood = "negative"
    elif sentiment_score > 0.3:
        mood = "positive"
    else:
        mood = "neutral"
    
    # Get AI response
    ai_response = get_ai_response(user_message)
    
    # Return AI response and mood
    return jsonify({
        "message": ai_response,
        "mood": mood
    })

if __name__ == '__main__':
    print("AI Therapist is running! Use /chat endpoint to communicate.")
    app.run(debug=True)
