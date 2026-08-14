/* Chat Module */
import { API, currentUser, socket, icon, avatarHTML, timeAgo, showToast, navigate } from './app.js';

let activeConvId = null;
let typingTimeout = null;

export function renderChat(params) {
    activeConvId = params?.id ? parseInt(params.id) : null;
    return `<div class="chat-layout" id="chat-layout">
        <div class="conversations-panel ${activeConvId ? 'hidden' : ''}" id="conv-panel">
            <div class="conversations-header">
                <h2>Messages</h2>
                <input class="conversations-search" placeholder="Search conversations..." id="conv-search">
            </div>
            <div class="conversations-list" id="conv-list"><div class="empty-state" style="padding:32px"><p>Loading...</p></div></div>
        </div>
        <div class="chat-panel ${!activeConvId ? 'hidden' : ''}" id="chat-panel">
            ${activeConvId ? '<div id="chat-area"></div>' : `<div class="chat-empty">${icon('message-circle')}<p>Select a conversation to start chatting</p></div>`}
        </div>
    </div>`;
}

export async function initChat(params) {
    activeConvId = params?.id ? parseInt(params.id) : null;
    await loadConversations();
    if (activeConvId) await openChat(activeConvId);

    // Socket listeners
    if (socket) {
        socket.off('receive_message');
        socket.on('receive_message', (msg) => {
            if (msg.conversation_id === activeConvId) {
                appendMessage(msg);
                scrollChatBottom();
            }
            loadConversations(); // refresh list
        });
        socket.off('user_typing');
        socket.on('user_typing', (data) => {
            if (data.conversation_id === activeConvId) {
                showTyping(data.user_id);
            }
        });
    }
}

async function loadConversations() {
    try {
        const convos = await API.get('/conversations');
        const list = document.getElementById('conv-list');
        if (!list) return;
        if (!convos.length) {
            list.innerHTML = `<div class="empty-state" style="padding:32px">${icon('message-circle')}<h3>No messages yet</h3><p>Start a conversation from someone's profile</p></div>`;
            return;
        }
        list.innerHTML = convos.map(c => `
            <div class="conversation-item ${c.id===activeConvId?'active':''}" onclick="window.location.hash='#/messages/${c.id}'">
                ${avatarHTML(c)}
                <div class="conv-info">
                    <div class="conv-name">${c.display_name || c.username}</div>
                    <div class="conv-preview">${c.last_message || 'No messages yet'}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">${c.last_message_at ? timeAgo(c.last_message_at) : ''}</div>
                    ${c.unread_count > 0 ? `<span class="conv-unread">${c.unread_count}</span>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function openChat(convId) {
    const chatPanel = document.getElementById('chat-panel');
    if (!chatPanel) return;
    chatPanel.classList.remove('hidden');
    
    try {
        const messages = await API.get(`/conversations/${convId}/messages`);
        const convos = await API.get('/conversations');
        const conv = convos.find(c => c.id === convId);
        if (!conv) return;

        chatPanel.innerHTML = `
            <div class="chat-header">
                <button class="chat-back-btn" onclick="document.getElementById('conv-panel').classList.remove('hidden');document.getElementById('chat-panel').classList.add('hidden');window.location.hash='#/messages'">${icon('arrow-left')}</button>
                ${avatarHTML(conv)}
                <div class="chat-user-info">
                    <div class="chat-username">${conv.display_name || conv.username}</div>
                    <div class="chat-status ${conv.is_online ? '' : 'offline'}">${conv.is_online ? 'Online' : 'Offline'}</div>
                </div>
            </div>
            <div class="chat-messages" id="chat-messages">
                ${messages.map(m => messageBubble(m)).join('')}
            </div>
            <div id="typing-indicator" class="typing-indicator" style="display:none"></div>
            <div class="chat-input-bar">
                <input id="chat-input" placeholder="Type a message..." maxlength="2000" autocomplete="off">
                <button class="chat-send-btn" id="chat-send">${icon('send')}</button>
            </div>
        `;
        scrollChatBottom();

        // Input handlers
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        const send = () => {
            const text = input.value.trim();
            if (!text || !socket) return;
            socket.emit('send_message', { conversation_id: convId, content: text });
            input.value = '';
        };
        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
        input.addEventListener('input', () => {
            if (socket) socket.emit('typing', { conversation_id: convId });
        });
    } catch (err) { showToast(err.message, 'error'); }
}

function messageBubble(m) {
    const isSent = currentUser && m.sender_id === currentUser.id;
    return `<div class="message-bubble ${isSent ? 'sent' : 'received'}">
        ${m.content}
        <div class="message-time">${timeAgo(m.created_at)}</div>
    </div>`;
}

function appendMessage(m) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', messageBubble(m));
}

function scrollChatBottom() {
    const c = document.getElementById('chat-messages');
    if (c) setTimeout(() => c.scrollTop = c.scrollHeight, 50);
}

function showTyping() {
    const el = document.getElementById('typing-indicator');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `typing<span class="typing-dots"><span></span><span></span><span></span></span>`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { el.style.display = 'none'; }, 2000);
}
