/* Search & Explore Module */
import { API, currentUser, icon, avatarHTML, showToast, navigate } from './app.js';
import { postCardHTML } from './feed.js';

let searchTimer = null;
let activeTab = 'people';

export function renderSearch() {
    return `<div class="page-container search-page">
        <div class="search-bar-wrapper">
            <span class="search-icon">${icon('search')}</span>
            <input class="search-bar" id="search-input" placeholder="Search people..." autocomplete="off">
        </div>
        <div class="profile-tabs" style="margin-bottom:16px">
            <div class="profile-tab ${activeTab==='people'?'active':''}" id="tab-people">${icon('users')} People</div>
            <div class="profile-tab ${activeTab==='trending'?'active':''}" id="tab-trending">${icon('trending-up')} Trending</div>
        </div>
        <div id="search-results"></div>
        <div id="suggestions-section">
            <div class="search-section"><div class="search-section-title">Suggested for You</div><div id="suggestions-list"><p class="no-results">Loading...</p></div></div>
        </div>
        <div id="trending-section" style="display:none"></div>
    </div>`;
}

export async function initSearch() {
    // Tab switching
    const tabPeople = document.getElementById('tab-people');
    const tabTrending = document.getElementById('tab-trending');

    tabPeople?.addEventListener('click', () => {
        activeTab = 'people';
        tabPeople.classList.add('active');
        tabTrending.classList.remove('active');
        document.getElementById('suggestions-section').style.display = 'block';
        document.getElementById('trending-section').style.display = 'none';
        document.getElementById('search-results').style.display = 'block';
        document.getElementById('search-input').placeholder = "Search people...";
    });

    tabTrending?.addEventListener('click', () => {
        activeTab = 'trending';
        tabTrending.classList.add('active');
        tabPeople.classList.remove('active');
        document.getElementById('suggestions-section').style.display = 'none';
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('trending-section').style.display = 'block';
        loadTrending();
    });

    // Load suggestions
    try {
        const users = await API.get('/users/suggestions');
        const el = document.getElementById('suggestions-list');
        if (el) el.innerHTML = users.length ? users.map(u => userCardHTML(u, false)).join('') : '<p class="no-results">No suggestions available</p>';
        attachFollowListeners();
    } catch (err) { console.error(err); }

    // Search input
    const input = document.getElementById('search-input');
    input?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = input.value.trim();
        if (q.length < 1) {
            document.getElementById('search-results').innerHTML = '';
            document.getElementById('suggestions-section').style.display = activeTab === 'people' ? '' : 'none';
            return;
        }
        searchTimer = setTimeout(() => doSearch(q), 300);
    });
}

async function loadTrending() {
    const el = document.getElementById('trending-section');
    if (!el) return;
    el.innerHTML = '<div class="empty-state"><p>Loading trending posts...</p></div>';
    try {
        const posts = await API.get('/trending');
        if (!posts.length) {
            el.innerHTML = '<p class="no-results">No trending posts right now</p>';
            return;
        }
        el.innerHTML = `<div class="search-section-title" style="margin-bottom:16px">Top Engaged Posts</div>` + posts.map(p => postCardHTML(p)).join('');
    } catch (err) { showToast(err.message, 'error'); }
}

async function doSearch(q) {
    try {
        const users = await API.get(`/search?q=${encodeURIComponent(q)}`);
        const results = document.getElementById('search-results');
        const suggestions = document.getElementById('suggestions-section');
        suggestions.style.display = 'none';
        if (!users.length) {
            results.innerHTML = '<p class="no-results">No users found</p>';
            return;
        }
        results.innerHTML = `<div class="search-section"><div class="search-section-title">Results</div>${users.map(u => userCardHTML(u, u.is_following)).join('')}</div>`;
        attachFollowListeners();
    } catch (err) { showToast(err.message, 'error'); }
}

function userCardHTML(u, isFollowing) {
    return `<div class="user-card" data-uid="${u.id}">
        <div onclick="window.location.hash='#/profile/${u.id}'">${avatarHTML(u)}</div>
        <div class="user-card-info" onclick="window.location.hash='#/profile/${u.id}'">
            <div class="user-card-name">${u.display_name || u.username}</div>
            <div class="user-card-username">@${u.username}</div>
            ${u.bio ? `<div class="user-card-bio">${u.bio}</div>` : ''}
        </div>
        <button class="follow-btn ${isFollowing ? 'following' : ''}" data-follow="${u.id}">${isFollowing ? 'Following' : 'Follow'}</button>
    </div>`;
}

function attachFollowListeners() {
    document.querySelectorAll('[data-follow]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const userId = btn.dataset.follow;
            try {
                const res = await API.post(`/users/${userId}/follow`);
                btn.classList.toggle('following', res.following);
                btn.textContent = res.following ? 'Following' : 'Follow';
            } catch (err) { showToast(err.message, 'error'); }
        });
    });
}
