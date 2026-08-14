import { API, currentUser, icon, avatarHTML, timeAgo, showToast } from './app.js';

let storiesData = [];

export function renderStoriesBar() {
    return `<div class="stories-bar" id="stories-bar"><div class="story-bubble" onclick="document.getElementById('story-create-trigger').click()">
        <div class="story-ring add-story">${avatarHTML(currentUser||{}, '')} <span class="add-icon">+</span></div>
        <span class="story-username">Your Story</span>
    </div></div><button id="story-create-trigger" style="display:none"></button>`;
}

export async function initStories() {
    try {
        storiesData = await API.get('/stories/feed');
        const bar = document.getElementById('stories-bar');
        if (!bar) return;
        // Add user story bubbles after the "Your Story" bubble
        const bubbles = storiesData.map((userGroup, idx) => {
            if (userGroup.user_id === currentUser?.id && userGroup.stories.length === 0) return '';
            const allViewed = !userGroup.has_unviewed;
            return `<div class="story-bubble" data-story-group="${idx}">
                <div class="story-ring ${allViewed ? 'viewed' : ''}">
                    ${userGroup.avatar_url ? `<img src="${userGroup.avatar_url}" alt="${userGroup.display_name}">` : `<div class="avatar" style="width:100%;height:100%;font-size:24px">${(userGroup.display_name||userGroup.username||'?')[0].toUpperCase()}</div>`}
                </div>
                <span class="story-username">${userGroup.user_id === currentUser?.id ? 'Your Story' : (userGroup.display_name||userGroup.username)}</span>
            </div>`;
        }).join('');
        // Insert after the first child (Your Story bubble)
        bar.insertAdjacentHTML('beforeend', bubbles);

        // Click handlers for story bubbles
        bar.querySelectorAll('[data-story-group]').forEach(el => {
            el.addEventListener('click', () => openStoryViewer(parseInt(el.dataset.storyGroup)));
        });

        // Create story trigger
        document.getElementById('story-create-trigger')?.addEventListener('click', () => showStoryCreator());
    } catch (err) { console.error('Stories load error:', err); }
}

function openStoryViewer(groupIdx) {
    const group = storiesData[groupIdx];
    if (!group || !group.stories.length) return;
    let currentIdx = 0;

    function renderViewer() {
        const story = group.stories[currentIdx];
        const hasImage = story.image_url;
        const bgStyle = hasImage ? '' : `style="background:${story.bg_gradient}"`;

        const html = `<div class="story-viewer" id="story-viewer">
            <div class="story-viewer-content">
                <div class="story-progress">
                    ${group.stories.map((_, i) => `<div class="story-progress-bar ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}"><div class="fill"></div></div>`).join('')}
                </div>
                <div class="story-viewer-header">
                    ${group.avatar_url ? `<img class="story-v-avatar" src="${group.avatar_url}">` : `<div class="avatar avatar-sm">${(group.display_name||'?')[0].toUpperCase()}</div>`}
                    <span class="story-v-name">${group.display_name||group.username}</span>
                    <span class="story-v-time">${timeAgo(story.created_at)}</span>
                    <button class="story-viewer-close" onclick="document.getElementById('story-viewer').remove()">${icon('x')}</button>
                </div>
                <div class="story-viewer-bg" ${bgStyle}>
                    ${hasImage ? `<img src="${story.image_url}" alt="Story">` : `<div class="story-text-content">${story.content}</div>`}
                </div>
                <div class="story-viewer-nav">
                    <div class="story-prev"></div>
                    <div class="story-next"></div>
                </div>
            </div>
        </div>`;

        // Remove existing viewer
        document.getElementById('story-viewer')?.remove();
        document.body.insertAdjacentHTML('beforeend', html);

        // Mark as viewed
        API.post(`/stories/${story.id}/view`).catch(() => {});

        // Navigation
        document.querySelector('.story-prev')?.addEventListener('click', () => {
            if (currentIdx > 0) { currentIdx--; renderViewer(); }
            else { document.getElementById('story-viewer')?.remove(); }
        });
        document.querySelector('.story-next')?.addEventListener('click', () => {
            if (currentIdx < group.stories.length - 1) { currentIdx++; renderViewer(); }
            else if (groupIdx < storiesData.length - 1) { groupIdx++; currentIdx = 0; openStoryViewer(groupIdx); }
            else { document.getElementById('story-viewer')?.remove(); }
        });

        // Auto-advance after 5s
        const timer = setTimeout(() => {
            if (currentIdx < group.stories.length - 1) { currentIdx++; renderViewer(); }
            else { document.getElementById('story-viewer')?.remove(); }
        }, 5000);

        // Close on escape
        const escHandler = (e) => { if (e.key === 'Escape') { document.getElementById('story-viewer')?.remove(); clearTimeout(timer); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);
    }

    renderViewer();
}

export function showStoryCreator() {
    const gradients = [
        'linear-gradient(135deg, #8b5cf6, #ec4899)',
        'linear-gradient(135deg, #06b6d4, #8b5cf6)',
        'linear-gradient(135deg, #f97316, #ef4444)',
        'linear-gradient(135deg, #22c55e, #06b6d4)',
        'linear-gradient(135deg, #ec4899, #f97316)',
        'linear-gradient(135deg, #1e293b, #334155)',
    ];
    let selectedGradient = gradients[0];

    const html = `<div class="story-create-modal" id="story-create-modal" onclick="if(event.target===this)this.remove()">
        <div class="story-create-card">
            <div class="story-create-preview" id="story-preview" style="background:${selectedGradient}">
                <textarea id="story-text" placeholder="Type your story..." rows="4" maxlength="200"></textarea>
            </div>
            <div class="story-gradients" id="gradient-picker">
                ${gradients.map((g, i) => `<button class="story-gradient-btn ${i===0?'active':''}" style="background:${g}" data-gradient="${g}"></button>`).join('')}
            </div>
            <div class="story-create-actions">
                <button class="btn btn-secondary" onclick="document.getElementById('story-create-modal').remove()">Cancel</button>
                <button class="btn btn-primary" id="share-story-btn">Share Story</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Gradient picker
    document.getElementById('gradient-picker')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.story-gradient-btn');
        if (!btn) return;
        selectedGradient = btn.dataset.gradient;
        document.getElementById('story-preview').style.background = selectedGradient;
        document.querySelectorAll('.story-gradient-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    // Share
    document.getElementById('share-story-btn')?.addEventListener('click', async () => {
        const text = document.getElementById('story-text')?.value.trim();
        if (!text) { showToast('Write something for your story', 'error'); return; }
        try {
            await API.post('/stories', { content: text, bg_gradient: selectedGradient });
            document.getElementById('story-create-modal')?.remove();
            showToast('Story shared! ✨', 'success');
            // Refresh stories bar
            initStories();
        } catch (err) { showToast(err.message, 'error'); }
    });
}
