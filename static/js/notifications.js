import { API, currentUser, icon, avatarHTML, timeAgo, showToast, navigate } from './app.js';

export function renderNotifications() {
    return `<div class="page-container notifications-page">
        <div class="notifications-header">
            <h1>Notifications</h1>
            <button class="mark-read-btn" id="mark-all-read">Mark all as read</button>
        </div>
        <div class="notification-list" id="notification-list">
            <div class="empty-state" style="padding:24px"><p>Loading notifications...</p></div>
        </div>
    </div>`;
}

export async function initNotifications() {
    try {
        const notifs = await API.get('/notifications');
        const list = document.getElementById('notification-list');
        if (!list) return;

        if (!notifs.length) {
            list.innerHTML = `<div class="empty-state">${icon('bell')}<h3>No notifications</h3><p>When someone interacts with your content, you'll see it here.</p></div>`;
            return;
        }

        list.innerHTML = notifs.map(n => {
            let text = '', iconType = '', iconName = '';
            switch(n.type) {
                case 'like': text = `<strong>${n.display_name||n.username}</strong> liked your post`; iconType = 'like'; iconName = 'heart'; break;
                case 'comment': text = `<strong>${n.display_name||n.username}</strong> commented on your post`; iconType = 'comment'; iconName = 'message-circle'; break;
                case 'follow': text = `<strong>${n.display_name||n.username}</strong> started following you`; iconType = 'follow'; iconName = 'users'; break;
                default: text = `<strong>${n.display_name||n.username}</strong> interacted with you`; iconType = 'like'; iconName = 'bell';
            }
            const clickTarget = n.post_id ? `#/home` : `#/profile/${n.from_user_id}`;
            return `<div class="notification-item ${n.read ? '' : 'unread'}" onclick="window.location.hash='${clickTarget}'">
                ${avatarHTML(n, 'avatar-sm')}
                <div class="notif-info">
                    <div class="notif-text">${text}</div>
                    <div class="notif-time">${timeAgo(n.created_at)}</div>
                </div>
                <div class="notif-icon ${iconType}">${icon(iconName)}</div>
            </div>`;
        }).join('');

        // Mark all as read
        document.getElementById('mark-all-read')?.addEventListener('click', async () => {
            try {
                await API.post('/notifications/read');
                document.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
                showToast('All notifications marked as read', 'success');
                // Update badge
                updateNotifBadge(0);
            } catch (err) { showToast(err.message, 'error'); }
        });
    } catch (err) { showToast(err.message, 'error'); }
}

export function updateNotifBadge(count) {
    document.querySelectorAll('.notif-badge-count').forEach(el => {
        if (count > 0) { el.textContent = count > 99 ? '99+' : count; el.style.display = 'inline-block'; }
        else { el.style.display = 'none'; }
    });
}

export async function fetchNotifCount() {
    try {
        const notifs = await API.get('/notifications');
        const unread = notifs.filter(n => !n.read).length;
        updateNotifBadge(unread);
        return unread;
    } catch { return 0; }
}
