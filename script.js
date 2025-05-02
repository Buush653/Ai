// Configuration
const API_KEY = 'AIzaSyB47bChStIEny3fvLOokITUMrL8Hqq5h0Q'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const webToggle = document.getElementById('web-toggle');
const newChatBtn = document.getElementById('new-chat-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const typingIndicator = document.getElementById('typing-indicator');
const welcomeMessage = document.getElementById('welcome-message');
const suggestionBtns = document.querySelectorAll('.suggestion-btn');

// State
let conversationHistory = [];
let webAccessEnabled = true;
let isDarkMode = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        enableDarkMode();
    }

    // Load conversation history from localStorage
    const savedHistory = localStorage.getItem('conversationHistory');
    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        renderConversationHistory();
    }
});

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

webToggle.addEventListener('click', toggleWebAccess);
newChatBtn.addEventListener('click', startNewChat);
darkModeToggle.addEventListener('click', toggleDarkMode);

suggestionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        userInput.value = e.target.textContent;
        userInput.focus();
    });
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
});

// Functions
function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage('user', message);
    userInput.value = '';
    userInput.style.height = 'auto';

    // Show typing indicator
    showTypingIndicator(true);
    welcomeMessage.style.display = 'none';

    // Prepare the request to Gemini API
    const requestData = {
        contents: [
            ...conversationHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            {
                role: 'user',
                parts: [{ text: message }]
            }
        ],
        generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
            stopSequences: []
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    };

    // Add web search instruction if enabled
    if (webAccessEnabled) {
        requestData.contents[requestData.contents.length - 1].parts[0].text += 
            "\n\n[Perform a web search if needed to provide up-to-date information.]";
    }

    // Call Gemini API
    fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        showTypingIndicator(false);
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            addMessage('ai', aiResponse, webAccessEnabled);
            
            // Update conversation history
            conversationHistory.push(
                { role: 'user', content: message },
                { role: 'ai', content: aiResponse }
            );
            
            // Save to localStorage
            localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
        } else {
            throw new Error('Invalid response from API');
        }
    })
    .catch(error => {
        showTypingIndicator(false);
        console.error('Error:', error);
        addMessage('ai', "Sorry, I encountered an error processing your request. Please try again later.");
    });
}

function addMessage(role, content, usedWeb = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `avatar ${role}-avatar`;
    avatarDiv.textContent = role === 'user' ? 'You' : 'AI';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = formatResponse(content);
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'message-info';
    infoDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (usedWeb && role === 'ai') {
        const webBadge = document.createElement('span');
        webBadge.className = 'web-badge';
        webBadge.textContent = 'Web Access';
        infoDiv.appendChild(webBadge);
    }
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(infoDiv);
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatResponse(text) {
    // Convert markdown links to HTML
    let formattedText = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Convert **bold** to <strong>
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert code blocks
    formattedText = formattedText.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    
    // Convert inline code
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert newlines to <br>
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

function showTypingIndicator(show) {
    typingIndicator.style.display = show ? 'flex' : 'none';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleWebAccess() {
    webAccessEnabled = !webAccessEnabled;
    webToggle.classList.toggle('active', webAccessEnabled);
    
    // Show notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = `Web access ${webAccessEnabled ? 'enabled' : 'disabled'}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function startNewChat() {
    if (conversationHistory.length === 0) return;
    
    if (confirm('Start a new chat? Your current conversation will be cleared.')) {
        conversationHistory = [];
        chatMessages.innerHTML = '';
        welcomeMessage.style.display = 'block';
        localStorage.removeItem('conversationHistory');
    }
}

function renderConversationHistory() {
    if (conversationHistory.length === 0) return;
    
    welcomeMessage.style.display = 'none';
    chatMessages.innerHTML = '';
    
    conversationHistory.forEach(msg => {
        const usedWeb = msg.role === 'ai' && msg.content.includes('[web search]');
        addMessage(msg.role, msg.content, usedWeb);
    });
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    
    if (isDarkMode) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
    
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function enableDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    isDarkMode = true;
}

function disableDarkMode() {
    document.documentElement.removeAttribute('data-theme');
    darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    isDarkMode = false;
}
