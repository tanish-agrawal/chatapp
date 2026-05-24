// Application State
let token = localStorage.getItem('jwt_token') || null;
let username = localStorage.getItem('chat_username') || null;
let stompClient = null;
let isSignUpMode = false;
let userList = [];
let activeRoom = 'public'; // 'public' or target username
let unreadCounts = {}; // { username: unreadCount }

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const authSubtitle = document.getElementById('auth-subtitle');
const authErrorMsg = document.getElementById('auth-error-msg');

const currentUsernameDisplay = document.getElementById('current-username');
const usersListContainer = document.getElementById('users-list');
const userCountDisplay = document.getElementById('user-count');
const wsStatusDot = document.getElementById('ws-status-dot');
const wsStatusText = document.getElementById('ws-status-text');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const chatForm = document.getElementById('chat-form');
const logoutBtn = document.getElementById('logout-btn');
const lobbyLink = document.getElementById('lobby-link');
const mobileBackBtn = document.getElementById('mobile-back-btn');

const headerTitle = document.querySelector('.chat-header .header-info h2');
const headerDesc = document.querySelector('.chat-header .header-info p');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    if (token && username) {
        showChatScreen();
        connectWebSocket();
    } else {
        showAuthScreen();
    }
    
    // Mobile Back Button Listener
    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            chatContainer.classList.remove('show-chat');
        });
    }
    
    // Auth Toggle Listener
    authToggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthMode();
    });

    // Auth Submission Listener
    authForm.addEventListener('submit', handleAuthSubmit);

    // Chat Submission Listener
    chatForm.addEventListener('submit', sendChatMessage);

    // Logout Listener
    logoutBtn.addEventListener('click', handleLogout);

    // Lobby Link Listener
    lobbyLink.addEventListener('click', () => {
        switchRoom('public');
    });
});

// Toggle between Login and Register Mode
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    authErrorMsg.classList.add('hidden');
    authForm.reset();
    
    if (isSignUpMode) {
        authSubtitle.textContent = 'Create your account to start chatting.';
        authSubmitBtn.querySelector('span').textContent = 'Sign Up';
        authSubmitBtn.querySelector('i').className = 'fa-solid fa-user-plus';
        authToggleText.textContent = 'Already have an account?';
        authToggleLink.textContent = 'Log In';
    } else {
        authSubtitle.textContent = 'Welcome back! Please enter your details.';
        authSubmitBtn.querySelector('span').textContent = 'Log In';
        authSubmitBtn.querySelector('i').className = 'fa-solid fa-right-to-bracket';
        authToggleText.textContent = "Don't have an account?";
        authToggleLink.textContent = 'Sign Up';
    }
}

// Show/Hide Screens
function showChatScreen() {
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    currentUsernameDisplay.textContent = username;
    switchRoom('public'); // Default to global lobby on login
}

function showAuthScreen() {
    chatContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
}

// Handle Login or Registration
async function handleAuthSubmit(e) {
    e.preventDefault();
    authErrorMsg.classList.add('hidden');

    const enteredUsername = usernameInput.value.trim();
    const enteredPassword = passwordInput.value;
    const endpoint = isSignUpMode ? '/api/auth/register' : '/api/auth/login';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: enteredUsername, password: enteredPassword })
        });

        const data = await response.json();

        if (response.ok) {
            token = data.token;
            username = data.username;
            localStorage.setItem('jwt_token', token);
            localStorage.setItem('chat_username', username);
            
            showChatScreen();
            connectWebSocket();
        } else {
            showError(data || 'Authentication failed');
        }
    } catch (err) {
        showError('Cannot connect to the server. Is it running?');
    }
}

function showError(message) {
    authErrorMsg.textContent = typeof message === 'string' ? message : JSON.stringify(message);
    authErrorMsg.classList.remove('hidden');
}

// ==================== WEBSOCKETS (STOMP) ====================

function connectWebSocket() {
    updateWSStatus(false, 'Connecting...');
    
    // Connect to Spring Boot WebSocket Endpoint
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    
    // Disable console logging of Stomp messages for a cleaner experience
    stompClient.debug = null;

    const headers = {
        'Authorization': 'Bearer ' + token
    };

    stompClient.connect(headers, onConnected, onConnectionError);
}

function onConnected() {
    updateWSStatus(true, 'Connected');
    
    // Load current user directory and history
    loadUsersDirectory();
    loadChatHistory();

    // Subscribe to public chat messages
    stompClient.subscribe('/topic/public', (payload) => {
        const message = JSON.parse(payload.body);
        if (message.deleted) {
            removeMessageFromDOM(message.id);
        } else {
            // Only render public messages if currently in the public lobby
            if (activeRoom === 'public') {
                renderChatMessage(message);
            }
        }
    });

    // Subscribe to private queue messages specifically addressed to this user
    stompClient.subscribe('/user/queue/private', (payload) => {
        const message = JSON.parse(payload.body);
        if (message.deleted) {
            removeMessageFromDOM(message.id);
        } else {
            handlePrivateMessage(message);
        }
    });

    // Subscribe to status updates of other users
    stompClient.subscribe('/topic/users', (payload) => {
        const statusMessage = JSON.parse(payload.body);
        handleUserStatusChange(statusMessage);
    });
}

function onConnectionError(error) {
    updateWSStatus(false, 'Disconnected');
    console.error('WebSocket connection error:', error);
    
    // Auto-retry connection after 5 seconds if still authenticated
    if (token) {
        setTimeout(connectWebSocket, 5000);
    }
}

function updateWSStatus(connected, text) {
    if (connected) {
        wsStatusDot.className = 'status-dot online';
        wsStatusText.textContent = text;
    } else {
        wsStatusDot.className = 'status-dot offline';
        wsStatusText.textContent = text;
    }
}

// Send message via WebSocket
function sendChatMessage(e) {
    e.preventDefault();
    const content = messageInput.value.trim();

    if (content && stompClient && stompClient.connected) {
        const isPrivate = activeRoom !== 'public';
        const chatMessage = {
            sender: username,
            recipient: isPrivate ? activeRoom : null,
            content: content
        };
        
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
        messageInput.value = '';
    }
}

// ==================== REST DATA LOADING ====================

async function loadChatHistory(recipient = null) {
    try {
        const url = recipient ? `/api/chat/history?recipient=${recipient}` : '/api/chat/history';
        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const messages = await response.json();
            chatMessages.innerHTML = ''; // Clear display
            messages.forEach(renderChatMessage);
        }
    } catch (err) {
        console.error('Failed to load chat history', err);
    }
}

async function loadUsersDirectory() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            userList = await response.json();
            renderUsersDirectory();
        }
    } catch (err) {
        console.error('Failed to load users directory', err);
    }
}

// ==================== ROOM SWITCHING ====================

function switchRoom(targetRoom) {
    activeRoom = targetRoom;
    
    // Update active highlight classes in sidebar
    if (activeRoom === 'public') {
        lobbyLink.classList.add('active');
        headerTitle.innerHTML = '<i class="fa-solid fa-earth-americas text-primary"></i>Global Lobby';
        headerDesc.textContent = 'Talk with anyone online in real-time';
        loadChatHistory(null);
    } else {
        lobbyLink.classList.remove('active');
        headerTitle.innerHTML = `<i class="fa-solid fa-user text-primary"></i> Chatting with ${activeRoom}`;
        headerDesc.textContent = 'Private 1-on-1 Conversation';
        
        // Clear unread counts for this private room
        unreadCounts[activeRoom] = 0;
        
        loadChatHistory(activeRoom);
    }
    
    // Re-render directory to update highlights and badges
    renderUsersDirectory();

    // Trigger sliding animation to show active conversation on mobile viewports
    chatContainer.classList.add('show-chat');
}

// Handle incoming private message
function handlePrivateMessage(message) {
    // Identify who the other participant in this conversation is
    const conversationPartner = (message.sender === username) ? message.recipient : message.sender;
    
    if (activeRoom === conversationPartner) {
        // If we are currently viewing this user's private room, display the message immediately
        renderChatMessage(message);
    } else {
        // Otherwise, increment the unread count and trigger a sidebar badge update
        unreadCounts[conversationPartner] = (unreadCounts[conversationPartner] || 0) + 1;
        renderUsersDirectory();
        
        // Play notification or system alert
        renderSystemMessage(`New private message from ${message.sender}`);
    }
}

// ==================== DOM RENDERING ====================

function renderChatMessage(message) {
    const isSentByMe = message.sender === username;
    
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', isSentByMe ? 'sent' : 'received');
    wrapper.id = `msg-${message.id}`;

    const meta = document.createElement('div');
    meta.classList.add('message-meta');
    
    const timeString = formatTime(message.timestamp);
    
    if (isSentByMe) {
        meta.innerHTML = `
            <span class="delete-btn" title="Delete Message" onclick="deleteMessage(${message.id})">
                <i class="fa-solid fa-trash-can"></i>
            </span>
            <span class="message-time">${timeString}</span>
        `;
    } else {
        meta.innerHTML = `<span class="sender-name">${message.sender}</span><span class="message-time">${timeString}</span>`;
    }

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.textContent = message.content;

    wrapper.appendChild(meta);
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    
    // Auto scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderUsersDirectory() {
    usersListContainer.innerHTML = '';
    
    // Filter out ourself from the active list to avoid confusion
    const activeUsers = userList.filter(u => u.username !== username);
    
    userCountDisplay.textContent = activeUsers.filter(u => u.online).length;

    activeUsers.forEach(user => {
        const item = document.createElement('div');
        item.classList.add('user-item');
        if (activeRoom === user.username) {
            item.classList.add('active');
        }
        item.id = `user-item-${user.username}`;
        
        // Handle click to switch to this private room
        item.addEventListener('click', () => {
            switchRoom(user.username);
        });

        const unreadCount = unreadCounts[user.username] || 0;
        
        let badgeOrDotHTML = '';
        if (unreadCount > 0) {
            badgeOrDotHTML = `<span class="unread-badge">${unreadCount}</span>`;
        } else {
            badgeOrDotHTML = `<span class="status-dot ${user.online ? 'online' : 'offline'}"></span>`;
        }

        item.innerHTML = `
            <div class="user-item-info">
                <i class="fa-solid fa-circle-user"></i>
                <span class="user-item-name">${user.username}</span>
            </div>
            ${badgeOrDotHTML}
        `;
        usersListContainer.appendChild(item);
    });
}

function handleUserStatusChange(statusMessage) {
    // Skip status broadcasts about ourself
    if (statusMessage.username === username) return;

    const existingUser = userList.find(u => u.username === statusMessage.username);
    if (existingUser) {
        existingUser.online = statusMessage.online;
    } else {
        userList.push({ username: statusMessage.username, online: statusMessage.online });
    }
    
    renderUsersDirectory();
    
    // Display temporary system message for connection joins/leaves
    renderSystemMessage(`${statusMessage.username} has gone ${statusMessage.online ? 'online' : 'offline'}`);
}

function renderSystemMessage(text) {
    const sysDiv = document.createElement('div');
    sysDiv.classList.add('system-message');
    sysDiv.textContent = text;
    chatMessages.appendChild(sysDiv);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Remove system message notification element after 5 seconds to prevent spam clutter
    setTimeout(() => {
        if (sysDiv.parentNode) {
            sysDiv.parentNode.removeChild(sysDiv);
        }
    }, 5000);
}

// Helper Utilities
function formatTime(timestampString) {
    if (!timestampString) return '';
    try {
        const date = new Date(timestampString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

// Message Deletion functions
async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            alert('Failed to delete message: ' + errorText);
        }
    } catch (err) {
        console.error('Error deleting message:', err);
    }
}

// Expose deleteMessage globally so inline onclick handler can call it
window.deleteMessage = deleteMessage;

function removeMessageFromDOM(messageId) {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
        el.style.transition = 'all 0.3s ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 300);
    }
}

function handleLogout() {
    // Set user offline on server before disconnecting socket
    if (stompClient && stompClient.connected) {
        stompClient.disconnect();
    }
    
    // Clean local storage tokens
    token = null;
    username = null;
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('chat_username');
    unreadCounts = {};
    activeRoom = 'public';
    
    // Reset mobile sliding state on logout
    chatContainer.classList.remove('show-chat');
    
    showAuthScreen();
}
