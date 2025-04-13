document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements
    const animationCircle = document.getElementById('animationCircle');
    const statusText = document.getElementById('statusText');
    const logo = document.getElementById('logo');
    const chatPanel = document.getElementById('chatPanel');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    
    // Speech recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else {
        console.error("Speech recognition not supported");
        statusText.textContent = "Speech recognition not supported in this browser";
    }
    
    // Speech synthesis setup
    const synth = window.speechSynthesis;
    
    // Application state
    let isListening = false;
    let isSpeaking = false;
    
    // Event listeners
    animationCircle.addEventListener('click', toggleListening);
    logo.addEventListener('click', toggleChatPanel);
    closeChat.addEventListener('click', toggleChatPanel);
    
    // Keyboard event for Enter key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !isSpeaking) {
            toggleListening();
        }
    });
    
    // Speech recognition events
    if (recognition) {
        recognition.onstart = function() {
            console.log('Voice recognition started');
            setListeningState(true);
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            console.log('Result received: ', transcript);
            
            statusText.textContent = "Processing...";
            
            // Check for exit commands directly here
            if (['exit', 'quit', 'bye'].includes(transcript.toLowerCase().trim())) {
                speak("Goodbye! Take care.");
                addMessageToChat('user', transcript);
                addMessageToChat('assistant', "Goodbye! Take care. 💙");
                setTimeout(() => {
                    setListeningState(false);
                    setSpeakingState(false);
                    statusText.textContent = "Press Enter to start";
                }, 2000);
                return;
            }
            
            // Send to server
            processUserInput(transcript);
        };
        
        recognition.onend = function() {
            console.log('Voice recognition ended');
            // Don't reset listening state here, as we might be processing or speaking
            if (!isSpeaking && isListening) {
                setListeningState(false);
                statusText.textContent = "Press Enter to start";
            }
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            statusText.textContent = "Error: " + event.error;
            setListeningState(false);
        };
    }
    
    // Functions
    function toggleListening() {
        if (recognition && !isListening && !isSpeaking) {
            startListening();
        } else if (recognition && isListening) {
            stopListening();
        }
    }
    
    function startListening() {
        if (recognition && !isListening && !isSpeaking) {
            recognition.start();
        }
    }
    
    function stopListening() {
        if (recognition && isListening) {
            recognition.stop();
            setListeningState(false);
            statusText.textContent = "Press Enter to start";
        }
    }
    
    function setListeningState(listening) {
        isListening = listening;
        if (listening) {
            animationCircle.classList.add('listening');
            animationCircle.classList.remove('speaking');
            statusText.textContent = "Listening...";
        } else {
            animationCircle.classList.remove('listening');
        }
    }
    
    function setSpeakingState(speaking) {
        isSpeaking = speaking;
        if (speaking) {
            animationCircle.classList.add('speaking');
            animationCircle.classList.remove('listening');
            statusText.textContent = "Speaking...";
        } else {
            animationCircle.classList.remove('speaking');
        }
    }
    
    function processUserInput(text) {
        fetch('/process_audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            
            // Add messages to chat
            addMessageToChat('user', text);
            addMessageToChat('assistant', data.response);
            
            // Speak the response
            speak(data.response);
            
            // Check if we need to exit
            if (data.exit) {
                setTimeout(() => {
                    setListeningState(false);
                    setSpeakingState(false);
                    statusText.textContent = "Press Enter to start";
                }, 2000);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            statusText.textContent = "Error processing request";
            setListeningState(false);
            setSpeakingState(false);
        });
    }
    
    function speak(text) {
        if (!synth) {
            console.error("Speech synthesis not supported");
            return;
        }
        
        // Stop any current speech
        synth.cancel();
        
        // Set speaking state
        setSpeakingState(true);
        
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Make the circle vibrate in sync with speech
        setupSpeechVisualization(utterance);
        
        // Speaking events
        utterance.onend = function() {
            console.log('Speech ended');
            setSpeakingState(false);
            
            // Start listening again after speaking is done
            setTimeout(() => {
                if (!['exit', 'quit', 'bye'].some(cmd => text.toLowerCase().includes(cmd))) {
                    startListening();
                }
            }, 500);
        };
        
        // Speak
        synth.speak(utterance);
    }
    
    // Setup speech visualization that makes the circle react to speech
    function setupSpeechVisualization(utterance) {
        // Create audio context for visualization
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // More frequent updates for smoother animation
        const speakingInterval = setInterval(() => {
            if (isSpeaking) {
                // Create more dramatic random intensity between 0.6 and 1.2
                const intensity = Math.random() * 0.6 + 0.6;
                animateCircleWithIntensity(intensity);
            } else {
                clearInterval(speakingInterval);
            }
        }, 100); // Faster interval for more responsive animation
        
        utterance.onend = function() {
            clearInterval(speakingInterval);
            setSpeakingState(false);
            
            // Reset circle to normal state
            animationCircle.style.transform = 'scale(1)';
            const waves = document.querySelectorAll('.wave');
            waves.forEach(wave => {
                wave.style.opacity = '';
            });
            
            // Start listening again after speaking is done
            setTimeout(() => {
                if (!['exit', 'quit', 'bye'].some(cmd => utterance.text.toLowerCase().includes(cmd))) {
                    startListening();
                }
            }, 500);
        };
    }
    
    function animateCircleWithIntensity(intensity) {
        // Enhanced scale factor for more pronounced effect
        // Increased from 0.05 to 0.1 for stronger vibration
        const scale = 1 + (intensity * 0.1);
        
        // Apply transformation with transition for smoother effect
        animationCircle.style.transform = `scale(${scale})`;
        
        // Apply random rotation for additional movement (-2 to 2 degrees)
        const rotation = (Math.random() * 4 - 2) * intensity;
        animationCircle.style.transform += ` rotate(${rotation}deg)`;
        
        // Add slight translation for more organic movement
        const translateX = (Math.random() * 6 - 3) * intensity;
        const translateY = (Math.random() * 6 - 3) * intensity;
        animationCircle.style.transform += ` translate(${translateX}px, ${translateY}px)`;
        
        // Adjust the wave animations
        const waves = document.querySelectorAll('.wave');
        waves.forEach((wave, index) => {
            // Different intensity for each wave
            const waveOpacity = 0.2 + (intensity * 0.4) - (index * 0.05);
            wave.style.opacity = waveOpacity;
            
            // Different animation speed based on intensity
            const animSpeed = 1 + (intensity * 0.5);
            wave.style.animationDuration = `${12/animSpeed}s`;
        });
        
        // Reset after a very short delay to create rapid pulsing effect
        setTimeout(() => {
            if (isSpeaking) {
                // Return closer to normal but not completely
                animationCircle.style.transform = 'scale(0.98) rotate(0deg)';
            }
        }, 50);
    }
    
    function toggleChatPanel() {
        chatPanel.classList.toggle('open');
        // When opening, fetch and display conversation
        if (chatPanel.classList.contains('open')) {
            fetchConversation();
        }
    }
    
    function fetchConversation() {
        fetch('/get_conversation')
            .then(response => response.json())
            .then(data => {
                displayConversation(data.conversation);
            })
            .catch(error => {
                console.error('Error fetching conversation:', error);
            });
    }
    
    function displayConversation(conversation) {
        chatContainer.innerHTML = '';
        conversation.forEach(message => {
            addMessageToChat(message.role, message.content);
        });
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
        messageDiv.textContent = content;
        chatContainer.appendChild(messageDiv);
        
        // Scroll to the bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Initialize the app to be ready for voice input
    statusText.textContent = "Press Enter to start";
});