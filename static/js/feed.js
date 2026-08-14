/* Feed Module */
import { API, currentUser, icon, avatarHTML, timeAgo, showToast, navigate } from './app.js';
import { renderStoriesBar, initStories } from './stories.js';

export function renderFeed() {
    return `<div class="page-container">
        ${renderStoriesBar()}
        <div class="feed-header"><h1>Home</h1></div>
        <div id="feed-posts">
            <div class="skeleton-post">
                <div class="sk-header"><div class="skeleton skeleton-circle sk-avatar"></div><div class="sk-lines"><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div></div>
                <div class="skeleton sk-body"></div>
                <div class="sk-actions"><div class="skeleton sk-btn"></div><div class="skeleton sk-btn"></div></div>
            </div>
            <div class="skeleton-post">
                <div class="sk-header"><div class="skeleton skeleton-circle sk-avatar"></div><div class="sk-lines"><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div></div>
                <div class="skeleton sk-body"></div>
                <div class="sk-actions"><div class="skeleton sk-btn"></div><div class="skeleton sk-btn"></div></div>
            </div>
        </div>
    </div>`;
}

export async function initFeed() {
    initStories();
    try {
        const posts = await API.get('/feed');
        const container = document.getElementById('feed-posts');
        if (!container) return;
        if (!posts.length) {
            container.innerHTML = `<div class="empty-state">${icon('home')}<h3>Your feed is empty</h3><p>Follow people to see their posts here, or explore new content.</p><a href="#/search" class="btn btn-primary" style="margin-top:16px">Discover People</a></div>`;
            return;
        }
        container.innerHTML = posts.map(p => postCardHTML(p)).join('');
        attachPostListeners();
    } catch (err) { showToast(err.message, 'error'); }
}

export function postCardHTML(p) {
    const isOwner = currentUser && p.user_id === currentUser.id;
    return `<article class="post-card" data-post-id="${p.id}">
        <div class="post-header">
            ${avatarHTML(p)} 
            <div class="post-user-info">
                <div class="post-username" onclick="window.location.hash='#/profile/${p.user_id}'">${p.display_name || p.username}</div>
                <div class="post-time">${timeAgo(p.created_at)}</div>
            </div>
            ${isOwner ? `<button class="post-menu-btn" onclick="this.nextElementSibling.classList.toggle('hidden')">${icon('more-horizontal')}</button><div class="post-dropdown hidden"><button class="danger" onclick="deletePost(${p.id})">${icon('trash')} Delete Post</button></div>` : ''}
        </div>
        ${p.image_url ? `
        <div class="post-image-wrapper" data-double-tap="${p.id}">
            <img class="post-image" src="${p.image_url}" alt="Post image" loading="lazy">
            <div class="double-tap-heart">${icon('heart')}</div>
        </div>` : ''}
        ${p.content ? `<div class="post-content"><span class="content-username" onclick="window.location.hash='#/profile/${p.user_id}'">${p.username}</span>${escapeHTML(p.content)}</div>` : ''}
        <div class="post-actions">
            <button class="post-action-btn ${p.liked?'liked':''}" data-like-btn="${p.id}">${icon('heart')} <span>${p.like_count||''}</span></button>
            <button class="post-action-btn" data-comment-btn="${p.id}">${icon('message-circle')} <span>${p.comment_count||''}</span></button>
            <button class="post-action-btn" data-share-btn="${p.id}">${icon('share-2')}</button>
            <div class="post-actions-right">
                <button class="post-action-btn ${p.bookmarked?'bookmarked':''}" data-bookmark-btn="${p.id}">${icon('bookmark')}</button>
            </div>
        </div>
        <div class="post-comment-input">
            <input placeholder="Add a comment..." data-comment-input="${p.id}" maxlength="500">
            <button data-comment-submit="${p.id}" disabled>Post</button>
        </div>
    </article>`;
}

function escapeHTML(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

function attachPostListeners() {
    // Like buttons
    document.querySelectorAll('[data-like-btn]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postId = btn.dataset.likeBtn;
            try {
                const res = await API.post(`/posts/${postId}/like`);
                btn.classList.toggle('liked', res.liked);
                btn.querySelector('span').textContent = res.like_count || '';
            } catch (err) { showToast(err.message, 'error'); }
        });
    });

    // Double tap like on post image
    document.querySelectorAll('[data-double-tap]').forEach(wrapper => {
        let lastTap = 0;
        wrapper.addEventListener('click', async (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                const postId = wrapper.dataset.doubleTap;
                const heart = wrapper.querySelector('.double-tap-heart');
                if (heart) {
                    heart.classList.remove('show');
                    void heart.offsetWidth; // trigger reflow
                    heart.classList.add('show');
                }
                const btn = document.querySelector(`[data-like-btn="${postId}"]`);
                if (btn && !btn.classList.contains('liked')) {
                    try {
                        const res = await API.post(`/posts/${postId}/like`);
                        btn.classList.add('liked');
                        btn.querySelector('span').textContent = res.like_count || '';
                    } catch (err) { console.error(err); }
                }
            }
            lastTap = now;
        });
    });

    // Bookmark buttons
    document.querySelectorAll('[data-bookmark-btn]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postId = btn.dataset.bookmarkBtn;
            try {
                const res = await API.post(`/posts/${postId}/bookmark`);
                btn.classList.toggle('bookmarked', res.saved);
                showToast(res.saved ? 'Post saved to bookmarks' : 'Post removed from bookmarks', 'info');
            } catch (err) { showToast(err.message, 'error'); }
        });
    });

    // Share buttons
    document.querySelectorAll('[data-share-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.shareBtn;
            const url = `${window.location.origin}/#/home`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                showToast('Post link copied to clipboard!', 'success');
            } else {
                showToast('Link copied!', 'success');
            }
        });
    });

    // Comment inputs
    document.querySelectorAll('[data-comment-input]').forEach(input => {
        const postId = input.dataset.commentInput;
        const btn = document.querySelector(`[data-comment-submit="${postId}"]`);
        input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
        const submit = async () => {
            if (!input.value.trim()) return;
            try {
                await API.post(`/posts/${postId}/comments`, { content: input.value.trim() });
                input.value = ''; btn.disabled = true;
                const countEl = document.querySelector(`[data-comment-btn="${postId}"] span`);
                if (countEl) countEl.textContent = (parseInt(countEl.textContent)||0) + 1;
                showToast('Comment added', 'success');
            } catch (err) { showToast(err.message, 'error'); }
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    });

    // Comment view buttons
    document.querySelectorAll('[data-comment-btn]').forEach(btn => {
        btn.addEventListener('click', () => showCommentsModal(btn.dataset.commentBtn));
    });
}

async function showCommentsModal(postId) {
    try {
        const comments = await API.get(`/posts/${postId}/comments`);
        const html = `<div class="modal-overlay" onclick="if(event.target===this)this.remove()">
            <div class="modal">
                <div class="modal-header"><h2>Comments</h2><button onclick="this.closest('.modal-overlay').remove()">${icon('x')}</button></div>
                <div class="modal-body">
                    ${comments.length ? `<div class="comments-list">${comments.map(c => `
                        <div class="comment-item">
                            ${avatarHTML(c, 'avatar-sm')}
                            <div class="comment-body">
                                <span class="comment-user" onclick="window.location.hash='#/profile/${c.user_id}'">${c.display_name||c.username}</span>
                                <div class="comment-text">${escapeHTML(c.content)}</div>
                                <div class="comment-time">${timeAgo(c.created_at)}</div>
                            </div>
                        </div>`).join('')}</div>` : '<p style="color:var(--text-muted);text-align:center">No comments yet</p>'}
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (err) { showToast(err.message, 'error'); }
}

// Global delete function
window.deletePost = async function(postId) {
    if (!confirm('Delete this post?')) return;
    try {
        await API.del(`/posts/${postId}`);
        document.querySelector(`[data-post-id="${postId}"]`)?.remove();
        showToast('Post deleted', 'success');
    } catch (err) { showToast(err.message, 'error'); }
};
