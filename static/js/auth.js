/* Auth Module */
import { API, setCurrentUser, navigate, showToast, connectSocket } from './app.js';

export function renderLogin() {
    return `<div class="auth-page">
        <div class="auth-bg"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>
        <div class="auth-card">
            <div class="auth-logo"><span class="logo-icon">✦</span><h1>MySocial</h1><p>Welcome back! Sign in to continue.</p></div>
            <div id="auth-error"></div>
            <form class="auth-form" id="login-form">
                <div class="input-group"><label>Username or Email</label><input class="input-field" id="login-username" type="text" placeholder="Enter username or email" required></div>
                <div class="input-group"><label>Password</label><input class="input-field" id="login-password" type="password" placeholder="Enter password" required></div>
                <button class="btn btn-primary btn-block" type="submit">Sign In</button>
            </form>
            <div class="auth-divider">or</div>
            <div class="auth-switch">Don't have an account? <a onclick="window.location.hash='#/register'">Sign Up</a></div>
        </div>
    </div>`;
}

export function renderRegister() {
    return `<div class="auth-page">
        <div class="auth-bg"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>
        <div class="auth-card">
            <div class="auth-logo"><span class="logo-icon">✦</span><h1>MySocial</h1><p>Create your account and start sharing.</p></div>
            <div id="auth-error"></div>
            <form class="auth-form" id="register-form">
                <div class="input-group"><label>Display Name</label><input class="input-field" id="reg-displayname" type="text" placeholder="Your name" required></div>
                <div class="input-group"><label>Username</label><input class="input-field" id="reg-username" type="text" placeholder="Choose a username" required></div>
                <div class="input-group"><label>Email</label><input class="input-field" id="reg-email" type="email" placeholder="your@email.com" required></div>
                <div class="input-group"><label>Password</label><input class="input-field" id="reg-password" type="password" placeholder="Min 6 characters" required minlength="6"></div>
                <button class="btn btn-primary btn-block" type="submit">Create Account</button>
            </form>
            <div class="auth-divider">or</div>
            <div class="auth-switch">Already have an account? <a onclick="window.location.hash='#/login'">Sign In</a></div>
        </div>
    </div>`;
}

export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('auth-error');
            const btn = loginForm.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = 'Signing in...';
            try {
                const data = await API.post('/login', {
                    username: document.getElementById('login-username').value.trim(),
                    password: document.getElementById('login-password').value
                });
                localStorage.setItem('token', data.token);
                setCurrentUser(data.user);
                connectSocket();
                navigate('/');
            } catch (err) {
                errEl.innerHTML = `<div class="auth-error">${err.message}</div>`;
                btn.disabled = false; btn.textContent = 'Sign In';
            }
        });
    }

    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('auth-error');
            const btn = regForm.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = 'Creating account...';
            try {
                const data = await API.post('/register', {
                    display_name: document.getElementById('reg-displayname').value.trim(),
                    username: document.getElementById('reg-username').value.trim(),
                    email: document.getElementById('reg-email').value.trim(),
                    password: document.getElementById('reg-password').value
                });
                localStorage.setItem('token', data.token);
                setCurrentUser(data.user);
                connectSocket();
                navigate('/');
            } catch (err) {
                errEl.innerHTML = `<div class="auth-error">${err.message}</div>`;
                btn.disabled = false; btn.textContent = 'Create Account';
            }
        });
    }
}
