/* ═══════════════════════════════════════════════════════════
   MySocial — Core SPA Framework (app.js)
   ═══════════════════════════════════════════════════════════ */
import { renderLogin, renderRegister, initAuth } from './auth.js';
import { renderFeed, initFeed } from './feed.js';
import { renderCreatePost, initCreatePost } from './post.js';
import { renderChat, initChat } from './chat.js';
import { renderSearch, initSearch } from './search.js';
import { renderProfile, initProfile } from './profile.js';
import { renderSettings, initSettings } from './settings.js';
import { renderNotifications, initNotifications, fetchNotifCount } from './notifications.js';

// ─── API Client ──────────────────────────────────────────────
export const API = {
    async request(method, path, body = null, isForm = false) {
        const headers = {};
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!isForm && body) headers['Content-Type'] = 'application/json';
        const config = { method, headers };
        if (body) config.body = isForm ? body : JSON.stringify(body);
        const res = await fetch(`/api${path}`, config);
        if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); throw new Error('Unauthorized'); }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },
    get: (p) => API.request('GET', p),
    post: (p, b) => API.request('POST', p, b),
    put: (p, b) => API.request('PUT', p, b),
    del: (p) => API.request('DELETE', p),
    upload: (p, fd) => API.request('POST', p, fd, true),
    uploadPut: (p, fd) => API.request('PUT', p, fd, true),
};

// ─── State ───────────────────────────────────────────────────
export let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
export let socket = null;

export function setCurrentUser(u) {
    currentUser = u;
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
}

// ─── Icons Helper ────────────────────────────────────────────
export function icon(name, cls = '') {
    return `<svg class="${cls}"><use href="#icon-${name}"/></svg>`;
}

// ─── Avatar Helper ───────────────────────────────────────────
export function avatarHTML(user, size = '') {
    const cls = `avatar ${size}`;
    if (user.avatar_url) return `<div class="${cls}"><img src="${user.avatar_url}" alt="${user.display_name||user.username}"></div>`;
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();
    return `<div class="${cls}">${letter}</div>`;
}

// ─── Time Helper ─────────────────────────────────────────────
export function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date(), d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    const diff = (now - d) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    if (diff < 604800) return `${Math.floor(diff/86400)}d`;
    return d.toLocaleDateString();
}

// ─── Toast ───────────────────────────────────────────────────
export function showToast(msg, type = 'info') {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ─── Router ──────────────────────────────────────────────────
const routes = [
    { path: '/login', render: renderLogin, init: initAuth, auth: false },
    { path: '/register', render: renderRegister, init: initAuth, auth: false },
    { path: '/', render: renderFeed, init: initFeed, auth: true },
    { path: '/home', render: renderFeed, init: initFeed, auth: true },
    { path: '/create', render: renderCreatePost, init: initCreatePost, auth: true },
    { path: '/messages', render: renderChat, init: initChat, auth: true },
    { path: '/messages/:id', render: renderChat, init: initChat, auth: true },
    { path: '/notifications', render: renderNotifications, init: initNotifications, auth: true },
    { path: '/search', render: renderSearch, init: initSearch, auth: true },
    { path: '/profile', render: renderProfile, init: initProfile, auth: true },
    { path: '/profile/:id', render: renderProfile, init: initProfile, auth: true },
    { path: '/settings', render: renderSettings, init: initSettings, auth: true },
];

function matchRoute(path) {
    for (const route of routes) {
        const pp = route.path.split('/').filter(Boolean);
        const up = path.split('/').filter(Boolean);
        if (pp.length !== up.length) continue;
        const params = {};
        let match = true;
        for (let i = 0; i < pp.length; i++) {
            if (pp[i].startsWith(':')) params[pp[i].slice(1)] = up[i];
            else if (pp[i] !== up[i]) { match = false; break; }
        }
        if (match) return { route, params };
    }
    return null;
}

let currentPath = '';
export function navigate(path) { window.location.hash = '#' + path; }

function resolve() {
    const hash = window.location.hash.slice(1) || '/';
    if (hash === currentPath) return;
    currentPath = hash;
    const token = localStorage.getItem('token');
    const result = matchRoute(hash);

    if (!result) { navigate('/'); return; }
    const { route, params } = result;

    if (route.auth && !token) { navigate('/login'); return; }
    if (!route.auth && token && (hash === '/login' || hash === '/register')) { navigate('/'); return; }

    const app = document.getElementById('app');
    if (route.auth && token) {
        app.innerHTML = renderAppShell(hash) + `<div class="main-content"><div id="page-content" class="page-enter"></div></div>` + renderBottomNav(hash);
        document.getElementById('page-content').innerHTML = route.render(params);
    } else {
        app.innerHTML = route.render(params);
    }

    if (route.init) route.init(params);
    updateActiveNav(hash);

    // Hide loading screen
    const ls = document.getElementById('loading-screen');
    if (ls) ls.classList.add('hidden');
}

window.addEventListener('hashchange', resolve);

// ─── App Shell ───────────────────────────────────────────────
function renderAppShell(activePath) {
    const navItems = [
        { path: '/home', icon: 'home', label: 'Home' },
        { path: '/search', icon: 'search', label: 'Search' },
        { path: '/create', icon: 'plus-square', label: 'Create' },
        { path: '/messages', icon: 'message-circle', label: 'Messages' },
        { path: '/notifications', icon: 'bell', label: 'Notifications', badge: true },
        { path: '/profile', icon: 'user', label: 'Profile' },
    ];
    const user = currentUser || {};
    return `
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo"><span class="logo-icon">✦</span><span class="logo-text">MySocial</span></div>
        <nav class="sidebar-nav">
            ${navItems.map(n => `
                <a class="nav-item ${activePath.startsWith(n.path) || (n.path==='/home' && activePath==='/') ? 'active' : ''}" href="#${n.path}">
                    ${icon(n.icon)} <span>${n.label}</span>
                    ${n.badge ? `<span class="nav-badge notif-badge-count" style="display:none">0</span>` : ''}
                </a>
            `).join('')}
            <a class="nav-item ${activePath==='/settings'?'active':''}" href="#/settings">${icon('settings')} <span>Settings</span></a>
        </nav>
        <div class="sidebar-user">
            ${avatarHTML(user)} 
            <div class="user-info"><div class="user-name">${user.display_name||user.username||''}</div><div class="user-handle">@${user.username||''}</div></div>
        </div>
    </aside>
    <header class="topbar" id="topbar">
        <span class="topbar-title">MySocial</span>
        <div class="topbar-actions">
            <a class="topbar-btn" href="#/notifications">${icon('bell')}<span class="nav-badge notif-badge-count" style="display:none">0</span></a>
            <a class="topbar-btn" href="#/messages">${icon('message-circle')}</a>
        </div>
    </header>`;
}

function renderBottomNav(activePath) {
    const items = [
        { path: '/home', icon: 'home', label: 'Home' },
        { path: '/search', icon: 'search', label: 'Search' },
        { path: '/create', icon: 'plus-square', label: '', cls: 'create-btn' },
        { path: '/messages', icon: 'message-circle', label: 'Chat' },
        { path: '/profile', icon: 'user', label: 'Profile' },
    ];
    return `<nav class="bottom-nav"><div class="bottom-nav-inner">
        ${items.map(n => `
            <a class="bottom-nav-item ${n.cls||''} ${activePath.startsWith(n.path)||(n.path==='/home'&&activePath==='/')?'active':''}" href="#${n.path}">
                ${icon(n.icon)} ${n.label ? `<span>${n.label}</span>` : ''}
            </a>
        `).join('')}
    </div></nav>`;
}

function updateActiveNav(path) {
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
        const href = el.getAttribute('href')?.replace('#', '') || '';
        el.classList.toggle('active', path.startsWith(href) || (href==='/home' && path==='/'));
    });
}

// ─── Socket.IO ───────────────────────────────────────────────
export function connectSocket() {
    if (socket) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    socket = io({ query: { token } });
    socket.on('connect', () => {
        console.log('Socket connected');
        fetchNotifCount();
    });
    socket.on('user_status', (data) => {
        document.querySelectorAll(`[data-user-id="${data.user_id}"]`).forEach(el => {
            el.classList.toggle('avatar-online', data.online);
        });
    });
    socket.on('new_notification', (data) => {
        showToast('New activity on your profile!', 'info');
        fetchNotifCount();
    });
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) window.location.hash = '#/';
    resolve();
    if (localStorage.getItem('token')) {
        connectSocket();
        fetchNotifCount();
    }

    // Restore theme
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
});
