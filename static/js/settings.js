/* Settings Module */
import { API, icon, showToast, navigate, setCurrentUser } from './app.js';

export function renderSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    return `<div class="page-container settings-page">
        <h1>Settings</h1>
        <div class="settings-section">
            <div class="settings-section-title">Appearance</div>
            <div class="settings-item" id="theme-toggle">
                ${icon(theme === 'dark' ? 'moon' : 'sun')}
                <div class="settings-item-info"><div class="settings-item-label">Dark Mode</div><div class="settings-item-desc">Toggle dark/light theme</div></div>
                <label class="toggle-switch"><input type="checkbox" id="theme-checkbox" ${theme==='dark'?'checked':''}><span class="toggle-slider"></span></label>
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-section-title">Account</div>
            <div class="settings-item" onclick="document.getElementById('password-section').style.display=document.getElementById('password-section').style.display==='none'?'block':'none'">
                ${icon('lock')}
                <div class="settings-item-info"><div class="settings-item-label">Change Password</div><div class="settings-item-desc">Update your password</div></div>
            </div>
            <div id="password-section" style="display:none">
                <form class="settings-form" id="password-form">
                    <div class="input-group"><label>Current Password</label><input class="input-field" id="old-pw" type="password" required></div>
                    <div class="input-group"><label>New Password</label><input class="input-field" id="new-pw" type="password" required minlength="6"></div>
                    <button class="btn btn-primary btn-sm" type="submit">Update Password</button>
                </form>
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-section-title">Session</div>
            <div class="settings-item" id="logout-btn">${icon('log-out')}<div class="settings-item-info"><div class="settings-item-label">Log Out</div><div class="settings-item-desc">Sign out of your account</div></div></div>
            <div class="settings-item danger" id="delete-btn">${icon('trash')}<div class="settings-item-info"><div class="settings-item-label">Delete Account</div><div class="settings-item-desc">Permanently delete your account and data</div></div></div>
        </div>
        <div class="settings-version">MySocial v1.0 — Made with ♥</div>
    </div>`;
}

export function initSettings() {
    // Theme toggle
    document.getElementById('theme-checkbox')?.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    // Change password
    document.getElementById('password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.put('/users/me/password', {
                old_password: document.getElementById('old-pw').value,
                new_password: document.getElementById('new-pw').value
            });
            showToast('Password updated!', 'success');
            document.getElementById('password-section').style.display = 'none';
            document.getElementById('password-form').reset();
        } catch (err) { showToast(err.message, 'error'); }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        navigate('/login');
        showToast('Logged out', 'info');
    });

    // Delete account
    document.getElementById('delete-btn')?.addEventListener('click', async () => {
        if (!confirm('Are you sure? This action cannot be undone.')) return;
        if (!confirm('Really delete your account and all data?')) return;
        try {
            await API.del('/users/me');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setCurrentUser(null);
            navigate('/login');
            showToast('Account deleted', 'info');
        } catch (err) { showToast(err.message, 'error'); }
    });
}
