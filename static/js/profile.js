/* Profile Module */
import { API, currentUser, icon, avatarHTML, timeAgo, showToast, navigate, setCurrentUser } from './app.js';
import { postCardHTML } from './feed.js';

let currentProfileTab = 'posts';

export function renderProfile(params) {
    return `<div class="page-container" id="profile-page"><div class="empty-state"><p>Loading profile...</p></div></div>`;
}

export async function initProfile(params) {
    const userId = params?.id ? parseInt(params.id) : (currentUser?.id);
    if (!userId) { navigate('/login'); return; }
    const isOwn = currentUser && userId === currentUser.id;
    currentProfileTab = 'posts';

    try {
        const [user, posts] = await Promise.all([API.get(`/users/${userId}`), API.get(`/users/${userId}/posts`)]);
        const page = document.getElementById('profile-page');
        if (!page) return;

        page.innerHTML = `
            <div class="profile-header">
                ${isOwn ? `<button class="btn btn-ghost btn-sm profile-edit-btn" id="edit-profile-btn">${icon('edit')} Edit</button>` : ''}
                <div class="profile-avatar">${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.display_name}">` : `<div class="avatar avatar-xl">${(user.display_name||user.username||'?')[0].toUpperCase()}</div>`}</div>
                <div class="profile-display-name">${user.display_name || user.username}</div>
                <div class="profile-username">@${user.username}</div>
                ${user.bio ? `<div class="profile-bio">${user.bio}</div>` : ''}
                <div class="profile-stats">
                    <div class="profile-stat"><div class="stat-count">${user.post_count}</div><div class="stat-label">Posts</div></div>
                    <div class="profile-stat"><div class="stat-count" id="follower-count">${user.follower_count}</div><div class="stat-label">Followers</div></div>
                    <div class="profile-stat"><div class="stat-count">${user.following_count}</div><div class="stat-label">Following</div></div>
                </div>
                ${!isOwn ? `<div class="profile-actions">
                    <button class="btn ${user.is_following ? 'btn-secondary' : 'btn-primary'}" id="follow-btn">${user.is_following ? 'Following' : 'Follow'}</button>
                    <button class="btn btn-secondary" id="message-btn">${icon('message-circle')} Message</button>
                </div>` : ''}
            </div>

            ${isOwn ? `
            <div class="profile-tabs">
                <div class="profile-tab active" id="p-tab-posts">${icon('grid')} Posts</div>
                <div class="profile-tab" id="p-tab-saved">${icon('bookmark')} Saved</div>
            </div>` : ''}

            <div class="profile-posts-grid" id="profile-posts">
                ${renderPostsGrid(posts)}
            </div>
            <div id="saved-posts-container" style="display:none"></div>
        `;

        // Tab switching for own profile
        if (isOwn) {
            const tabPosts = document.getElementById('p-tab-posts');
            const tabSaved = document.getElementById('p-tab-saved');

            tabPosts?.addEventListener('click', () => {
                tabPosts.classList.add('active');
                tabSaved?.classList.remove('active');
                document.getElementById('profile-posts').style.display = 'grid';
                document.getElementById('saved-posts-container').style.display = 'none';
            });

            tabSaved?.addEventListener('click', async () => {
                tabSaved.classList.add('active');
                tabPosts?.classList.remove('active');
                document.getElementById('profile-posts').style.display = 'none';
                const savedContainer = document.getElementById('saved-posts-container');
                savedContainer.style.display = 'block';
                savedContainer.innerHTML = '<div class="empty-state"><p>Loading saved posts...</p></div>';
                try {
                    const savedPosts = await API.get('/bookmarks');
                    if (!savedPosts.length) {
                        savedContainer.innerHTML = '<div class="empty-state"><p>No saved posts yet</p></div>';
                        return;
                    }
                    savedContainer.innerHTML = `<div class="profile-posts-grid">${renderPostsGrid(savedPosts)}</div>`;
                } catch (err) { showToast(err.message, 'error'); }
            });
        }

        // Follow button
        const followBtn = document.getElementById('follow-btn');
        if (followBtn) {
            followBtn.addEventListener('click', async () => {
                try {
                    const res = await API.post(`/users/${userId}/follow`);
                    followBtn.textContent = res.following ? 'Following' : 'Follow';
                    followBtn.className = `btn ${res.following ? 'btn-secondary' : 'btn-primary'}`;
                    document.getElementById('follower-count').textContent = res.follower_count;
                } catch (err) { showToast(err.message, 'error'); }
            });
        }

        // Message button
        const msgBtn = document.getElementById('message-btn');
        if (msgBtn) {
            msgBtn.addEventListener('click', async () => {
                try {
                    const res = await API.post('/conversations', { user_id: userId });
                    navigate(`/messages/${res.conversation_id}`);
                } catch (err) { showToast(err.message, 'error'); }
            });
        }

        // Edit profile
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) editBtn.addEventListener('click', () => showEditProfileModal(user));

    } catch (err) { showToast(err.message, 'error'); }
}

function renderPostsGrid(posts) {
    if (!posts.length) return '<div class="empty-state" style="grid-column:1/-1"><p>No posts yet</p></div>';
    return posts.map(p => {
        if (p.image_url) return `<div class="profile-post-item" onclick="window.location.hash='#/home'"><img src="${p.image_url}" alt="Post" loading="lazy"><div class="post-overlay"><span class="overlay-stat">${icon('heart')} ${p.like_count}</span><span class="overlay-stat">${icon('message-circle')} ${p.comment_count}</span></div></div>`;
        return `<div class="profile-post-text" onclick="window.location.hash='#/home'">${p.content?.substring(0, 100)}${p.content?.length > 100 ? '...' : ''}</div>`;
    }).join('');
}

function showEditProfileModal(user) {
    const html = `<div class="modal-overlay" id="edit-modal" onclick="if(event.target===this)this.remove()">
        <div class="modal">
            <div class="modal-header"><h2>Edit Profile</h2><button onclick="document.getElementById('edit-modal').remove()">${icon('x')}</button></div>
            <div class="modal-body">
                <div class="edit-avatar-wrapper">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" id="edit-avatar-preview">` : `<div class="avatar avatar-xl">${(user.display_name||'?')[0].toUpperCase()}</div>`}
                    <label class="avatar-upload-btn">${icon('camera')}<input type="file" id="edit-avatar-input" accept="image/*" style="display:none"></label>
                </div>
                <div class="input-group" style="margin-bottom:16px"><label>Display Name</label><input class="input-field" id="edit-display-name" value="${user.display_name||''}"></div>
                <div class="input-group"><label>Bio</label><textarea class="input-field" id="edit-bio" rows="3">${user.bio||''}</textarea></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('edit-modal').remove()">Cancel</button><button class="btn btn-primary" id="save-profile-btn">Save Changes</button></div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    let avatarFile = null;
    document.getElementById('edit-avatar-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        avatarFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('edit-avatar-preview');
            if (preview) preview.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        try {
            const fd = new FormData();
            fd.append('display_name', document.getElementById('edit-display-name').value);
            fd.append('bio', document.getElementById('edit-bio').value);
            if (avatarFile) fd.append('avatar', avatarFile);
            const updated = await API.uploadPut('/users/me', fd);
            setCurrentUser(updated);
            document.getElementById('edit-modal').remove();
            showToast('Profile updated!', 'success');
            navigate('/profile');
        } catch (err) { showToast(err.message, 'error'); }
    });
}
