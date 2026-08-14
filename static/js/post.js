/* Create Post Module */
import { API, currentUser, icon, avatarHTML, showToast, navigate } from './app.js';

export function renderCreatePost() {
    return `<div class="page-container create-post-page">
        <div class="create-post-card">
            <h2>Create Post</h2>
            <div class="create-post-body">
                ${avatarHTML(currentUser || {})}
                <textarea id="post-content" placeholder="What's on your mind?" maxlength="2000"></textarea>
            </div>
            <div id="image-preview" class="create-post-preview" style="display:none"></div>
            <div class="create-post-footer">
                <label class="image-upload-btn">${icon('image')} Add Photo<input type="file" id="post-image" accept="image/*"></label>
                <span class="char-count" id="char-count">0 / 2000</span>
                <button class="btn btn-primary" id="submit-post">Share Post</button>
            </div>
        </div>
    </div>`;
}

export function initCreatePost() {
    const content = document.getElementById('post-content');
    const imageInput = document.getElementById('post-image');
    const preview = document.getElementById('image-preview');
    const charCount = document.getElementById('char-count');
    const submitBtn = document.getElementById('submit-post');
    let selectedFile = null;

    content.addEventListener('input', () => {
        charCount.textContent = `${content.value.length} / 2000`;
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            preview.style.display = 'block';
            preview.innerHTML = `<img src="${ev.target.result}" alt="Preview"><button class="remove-image" onclick="document.getElementById('post-image').value='';document.getElementById('image-preview').style.display='none'">${icon('x')}</button>`;
        };
        reader.readAsDataURL(file);
    });

    // Listen for remove image click
    preview.addEventListener('click', (e) => {
        if (e.target.closest('.remove-image')) {
            selectedFile = null;
            imageInput.value = '';
            preview.style.display = 'none';
        }
    });

    submitBtn.addEventListener('click', async () => {
        const text = content.value.trim();
        if (!text && !selectedFile) { showToast('Add some text or an image', 'error'); return; }
        submitBtn.disabled = true; submitBtn.textContent = 'Posting...';
        try {
            const fd = new FormData();
            fd.append('content', text);
            if (selectedFile) fd.append('image', selectedFile);
            await API.upload('/posts', fd);
            showToast('Post shared! 🎉', 'success');
            navigate('/home');
        } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Share Post';
        }
    });
}
