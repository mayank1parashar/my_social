from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from functools import wraps
from config import Config
from PIL import Image
import sqlite3, bcrypt, jwt, os, uuid, datetime, time

# ─── App Setup ────────────────────────────────────────────────
app = Flask(__name__, static_folder='static')
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

os.makedirs(app.config['UPLOAD_FOLDER'] + '/avatars', exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER'] + '/posts', exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER'] + '/stories', exist_ok=True)

online_users = {}  # socket_id -> user_id

# ─── DB Helper ────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def dict_row(row):
    return dict(row) if row else None

def dict_rows(rows):
    return [dict(r) for r in rows]

# ─── Auth Helpers ─────────────────────────────────────────────
def create_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({"error": "Token required"}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def save_image(file, subfolder, max_size=1080):
    if not file or not allowed_file(file.filename):
        return None
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], subfolder, filename)
    img = Image.open(file)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    if img.width > max_size:
        ratio = max_size / img.width
        img = img.resize((max_size, int(img.height * ratio)), Image.LANCZOS)
    img.save(filepath, quality=85)
    return f"/uploads/{subfolder}/{filename}"

# ─── Serve SPA ────────────────────────────────────────────────
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ─── AUTH ROUTES ──────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    username = (data.get('username') or '').strip().lower()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip() or username

    if not username or not email or len(password) < 6:
        return jsonify({"error": "Username, email required. Password min 6 chars."}), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = get_db()
    try:
        conn.execute('INSERT INTO users (username, email, password_hash, display_name) VALUES (?,?,?,?)',
                     (username, email, pw_hash, display_name))
        conn.commit()
        user_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        token = create_token(user_id)
        user = dict_row(conn.execute('SELECT id, username, email, display_name, bio, avatar_url FROM users WHERE id=?', (user_id,)).fetchone())
        return jsonify({"token": token, "user": user}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already taken"}), 409
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400
    username = (data.get('username') or '').strip().lower()
    password = data.get('password', '')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE username=? OR email=?', (username, username)).fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_token(user['id'])
    return jsonify({
        "token": token,
        "user": {"id": user['id'], "username": user['username'], "email": user['email'],
                 "display_name": user['display_name'], "bio": user['bio'], "avatar_url": user['avatar_url']}
    })

@app.route('/api/me', methods=['GET'])
@login_required
def get_me():
    conn = get_db()
    user = dict_row(conn.execute('SELECT id, username, email, display_name, bio, avatar_url, created_at FROM users WHERE id=?', (request.user_id,)).fetchone())
    conn.close()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user)

# ─── POST ROUTES ──────────────────────────────────────────────
@app.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    content = request.form.get('content', '').strip() if request.content_type and 'multipart' in request.content_type else (request.get_json() or {}).get('content', '').strip()
    image_url = ''
    if request.files.get('image'):
        image_url = save_image(request.files['image'], 'posts') or ''
    if not content and not image_url:
        return jsonify({"error": "Post must have text or image"}), 400

    conn = get_db()
    conn.execute('INSERT INTO posts (user_id, content, image_url) VALUES (?,?,?)', (request.user_id, content, image_url))
    conn.commit()
    post_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    post = dict_row(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        0 as liked
        FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?
    ''', (post_id,)).fetchone())
    conn.close()
    return jsonify(post), 201

@app.route('/api/feed', methods=['GET'])
@login_required
def get_feed():
    page = int(request.args.get('page', 1))
    limit = 20
    offset = (page - 1) * limit
    conn = get_db()
    posts = dict_rows(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked,
        EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?) as bookmarked
        FROM posts p JOIN users u ON p.user_id=u.id
        WHERE p.user_id IN (SELECT followed_id FROM follows WHERE follower_id=?) OR p.user_id=?
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    ''', (request.user_id, request.user_id, request.user_id, request.user_id, limit, offset)).fetchall())
    conn.close()
    return jsonify(posts)

@app.route('/api/explore', methods=['GET'])
@login_required
def explore():
    page = int(request.args.get('page', 1))
    limit = 20
    offset = (page - 1) * limit
    conn = get_db()
    posts = dict_rows(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked,
        EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?) as bookmarked
        FROM posts p JOIN users u ON p.user_id=u.id
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    ''', (request.user_id, request.user_id, limit, offset)).fetchall())
    conn.close()
    return jsonify(posts)

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@login_required
def toggle_like(post_id):
    conn = get_db()
    existing = conn.execute('SELECT id FROM likes WHERE user_id=? AND post_id=?', (request.user_id, post_id)).fetchone()
    if existing:
        conn.execute('DELETE FROM likes WHERE user_id=? AND post_id=?', (request.user_id, post_id))
        liked = False
    else:
        conn.execute('INSERT INTO likes (user_id, post_id) VALUES (?,?)', (request.user_id, post_id))
        liked = True
        post_owner = conn.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
        if post_owner and post_owner['user_id'] != request.user_id:
            conn.execute('INSERT INTO notifications (user_id, type, from_user_id, post_id) VALUES (?,?,?,?)',
                         (post_owner['user_id'], 'like', request.user_id, post_id))
            socketio.emit('new_notification', {'type': 'like', 'from_user_id': request.user_id, 'post_id': post_id}, room=f'user_{post_owner["user_id"]}')
    conn.commit()
    count = conn.execute('SELECT COUNT(*) as c FROM likes WHERE post_id=?', (post_id,)).fetchone()['c']
    conn.close()
    return jsonify({"liked": liked, "like_count": count})

@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
@login_required
def get_comments(post_id):
    conn = get_db()
    comments = dict_rows(conn.execute('''
        SELECT c.*, u.username, u.display_name, u.avatar_url
        FROM comments c JOIN users u ON c.user_id=u.id
        WHERE c.post_id=? ORDER BY c.created_at ASC
    ''', (post_id,)).fetchall())
    conn.close()
    return jsonify(comments)

@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def add_comment(post_id):
    data = request.get_json()
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({"error": "Comment cannot be empty"}), 400
    conn = get_db()
    conn.execute('INSERT INTO comments (user_id, post_id, content) VALUES (?,?,?)', (request.user_id, post_id, content))
    conn.commit()
    comment_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    comment = dict_row(conn.execute('''
        SELECT c.*, u.username, u.display_name, u.avatar_url
        FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?
    ''', (comment_id,)).fetchone())
    # notification
    post_owner = conn.execute('SELECT user_id FROM posts WHERE id=?', (post_id,)).fetchone()
    if post_owner and post_owner['user_id'] != request.user_id:
        conn.execute('INSERT INTO notifications (user_id, type, from_user_id, post_id) VALUES (?,?,?,?)',
                     (post_owner['user_id'], 'comment', request.user_id, post_id))
        conn.commit()
        socketio.emit('new_notification', {'type': 'comment', 'from_user_id': request.user_id, 'post_id': post_id}, room=f'user_{post_owner["user_id"]}')
    conn.close()
    return jsonify(comment), 201

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@login_required
def delete_post(post_id):
    conn = get_db()
    post = conn.execute('SELECT * FROM posts WHERE id=? AND user_id=?', (post_id, request.user_id)).fetchone()
    if not post:
        conn.close()
        return jsonify({"error": "Post not found or unauthorized"}), 404
    conn.execute('DELETE FROM posts WHERE id=?', (post_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Post deleted"})

# ─── USER / PROFILE ROUTES ───────────────────────────────────
@app.route('/api/search', methods=['GET'])
@login_required
def search_users():
    q = request.args.get('q', '').strip()
    if len(q) < 1:
        return jsonify([])
    conn = get_db()
    users = dict_rows(conn.execute('''
        SELECT id, username, display_name, avatar_url, bio,
        EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND followed_id=users.id) as is_following
        FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
        LIMIT 20
    ''', (request.user_id, f'%{q}%', f'%{q}%', request.user_id)).fetchall())
    conn.close()
    return jsonify(users)

@app.route('/api/users/suggestions', methods=['GET'])
@login_required
def user_suggestions():
    conn = get_db()
    users = dict_rows(conn.execute('''
        SELECT id, username, display_name, avatar_url, bio
        FROM users WHERE id != ? AND id NOT IN (SELECT followed_id FROM follows WHERE follower_id=?)
        ORDER BY RANDOM() LIMIT 5
    ''', (request.user_id, request.user_id)).fetchall())
    conn.close()
    return jsonify(users)

@app.route('/api/users/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    conn = get_db()
    user = dict_row(conn.execute('SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id=?', (user_id,)).fetchone())
    if not user:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    user['post_count'] = conn.execute('SELECT COUNT(*) as c FROM posts WHERE user_id=?', (user_id,)).fetchone()['c']
    user['follower_count'] = conn.execute('SELECT COUNT(*) as c FROM follows WHERE followed_id=?', (user_id,)).fetchone()['c']
    user['following_count'] = conn.execute('SELECT COUNT(*) as c FROM follows WHERE follower_id=?', (user_id,)).fetchone()['c']
    user['is_following'] = bool(conn.execute('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?', (request.user_id, user_id)).fetchone())
    conn.close()
    return jsonify(user)

@app.route('/api/users/<int:user_id>/posts', methods=['GET'])
@login_required
def get_user_posts(user_id):
    conn = get_db()
    posts = dict_rows(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked,
        EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?) as bookmarked
        FROM posts p JOIN users u ON p.user_id=u.id WHERE p.user_id=?
        ORDER BY p.created_at DESC
    ''', (request.user_id, request.user_id, user_id)).fetchall())
    conn.close()
    return jsonify(posts)

@app.route('/api/users/<int:user_id>/follow', methods=['POST'])
@login_required
def toggle_follow(user_id):
    if user_id == request.user_id:
        return jsonify({"error": "Cannot follow yourself"}), 400
    conn = get_db()
    existing = conn.execute('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?', (request.user_id, user_id)).fetchone()
    if existing:
        conn.execute('DELETE FROM follows WHERE follower_id=? AND followed_id=?', (request.user_id, user_id))
        following = False
    else:
        conn.execute('INSERT INTO follows (follower_id, followed_id) VALUES (?,?)', (request.user_id, user_id))
        following = True
        conn.execute('INSERT INTO notifications (user_id, type, from_user_id) VALUES (?,?,?)', (user_id, 'follow', request.user_id))
        socketio.emit('new_notification', {'type': 'follow', 'from_user_id': request.user_id}, room=f'user_{user_id}')
    conn.commit()
    follower_count = conn.execute('SELECT COUNT(*) as c FROM follows WHERE followed_id=?', (user_id,)).fetchone()['c']
    conn.close()
    return jsonify({"following": following, "follower_count": follower_count})

@app.route('/api/users/me', methods=['PUT'])
@login_required
def update_profile():
    conn = get_db()
    if request.content_type and 'multipart' in request.content_type:
        display_name = request.form.get('display_name')
        bio = request.form.get('bio')
        if request.files.get('avatar'):
            avatar_url = save_image(request.files['avatar'], 'avatars', max_size=400)
            if avatar_url:
                conn.execute('UPDATE users SET avatar_url=? WHERE id=?', (avatar_url, request.user_id))
    else:
        data = request.get_json() or {}
        display_name = data.get('display_name')
        bio = data.get('bio')

    if display_name is not None:
        conn.execute('UPDATE users SET display_name=? WHERE id=?', (display_name.strip(), request.user_id))
    if bio is not None:
        conn.execute('UPDATE users SET bio=? WHERE id=?', (bio.strip(), request.user_id))
    conn.commit()
    user = dict_row(conn.execute('SELECT id, username, email, display_name, bio, avatar_url FROM users WHERE id=?', (request.user_id,)).fetchone())
    conn.close()
    return jsonify(user)

@app.route('/api/users/me/password', methods=['PUT'])
@login_required
def change_password():
    data = request.get_json() or {}
    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')
    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    conn = get_db()
    user = conn.execute('SELECT password_hash FROM users WHERE id=?', (request.user_id,)).fetchone()
    if not bcrypt.checkpw(old_pw.encode(), user['password_hash'].encode()):
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 401
    new_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    conn.execute('UPDATE users SET password_hash=? WHERE id=?', (new_hash, request.user_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Password updated"})

@app.route('/api/users/me', methods=['DELETE'])
@login_required
def delete_account():
    conn = get_db()
    conn.execute('DELETE FROM users WHERE id=?', (request.user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Account deleted"})

# ─── CONVERSATION / MESSAGE ROUTES ────────────────────────────
@app.route('/api/conversations', methods=['GET'])
@login_required
def get_conversations():
    conn = get_db()
    convos = dict_rows(conn.execute('''
        SELECT c.id, c.last_message_at,
            CASE WHEN c.user1_id=? THEN c.user2_id ELSE c.user1_id END as other_user_id,
            u.username, u.display_name, u.avatar_url, u.is_online,
            (SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM messages WHERE conversation_id=c.id AND sender_id!=? AND read_at IS NULL) as unread_count
        FROM conversations c
        JOIN users u ON u.id = CASE WHEN c.user1_id=? THEN c.user2_id ELSE c.user1_id END
        WHERE c.user1_id=? OR c.user2_id=?
        ORDER BY c.last_message_at DESC
    ''', (request.user_id, request.user_id, request.user_id, request.user_id, request.user_id)).fetchall())
    conn.close()
    return jsonify(convos)

@app.route('/api/conversations', methods=['POST'])
@login_required
def start_conversation():
    data = request.get_json() or {}
    other_id = data.get('user_id')
    if not other_id or other_id == request.user_id:
        return jsonify({"error": "Invalid user"}), 400
    u1, u2 = min(request.user_id, other_id), max(request.user_id, other_id)
    conn = get_db()
    existing = conn.execute('SELECT id FROM conversations WHERE user1_id=? AND user2_id=?', (u1, u2)).fetchone()
    if existing:
        conn.close()
        return jsonify({"conversation_id": existing['id']})
    conn.execute('INSERT INTO conversations (user1_id, user2_id) VALUES (?,?)', (u1, u2))
    conn.commit()
    cid = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.close()
    return jsonify({"conversation_id": cid}), 201

@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET'])
@login_required
def get_messages(conv_id):
    conn = get_db()
    conv = conn.execute('SELECT * FROM conversations WHERE id=? AND (user1_id=? OR user2_id=?)', (conv_id, request.user_id, request.user_id)).fetchone()
    if not conv:
        conn.close()
        return jsonify({"error": "Conversation not found"}), 404
    # mark as read
    conn.execute('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id!=? AND read_at IS NULL',
                 (datetime.datetime.utcnow().isoformat(), conv_id, request.user_id))
    conn.commit()
    msgs = dict_rows(conn.execute('''
        SELECT m.*, u.username, u.display_name, u.avatar_url
        FROM messages m JOIN users u ON m.sender_id=u.id
        WHERE m.conversation_id=? ORDER BY m.created_at ASC
    ''', (conv_id,)).fetchall())
    conn.close()
    return jsonify(msgs)

# ─── NOTIFICATIONS ────────────────────────────────────────────
@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    conn = get_db()
    notifs = dict_rows(conn.execute('''
        SELECT n.*, u.username, u.display_name, u.avatar_url
        FROM notifications n JOIN users u ON n.from_user_id=u.id
        WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50
    ''', (request.user_id,)).fetchall())
    conn.close()
    return jsonify(notifs)

@app.route('/api/notifications/read', methods=['POST'])
@login_required
def mark_notifications_read():
    conn = get_db()
    conn.execute('UPDATE notifications SET read=1 WHERE user_id=?', (request.user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Marked as read"})

# ─── STORY ROUTES ─────────────────────────────────────────────
@app.route('/api/stories', methods=['POST'])
@login_required
def create_story():
    content = ''
    image_url = ''
    bg_gradient = 'linear-gradient(135deg, #8b5cf6, #ec4899)'
    if request.content_type and 'multipart' in request.content_type:
        content = request.form.get('content', '').strip()
        bg_gradient = request.form.get('bg_gradient', bg_gradient)
        if request.files.get('image'):
            image_url = save_image(request.files['image'], 'stories') or ''
    else:
        data = request.get_json() or {}
        content = data.get('content', '').strip()
        bg_gradient = data.get('bg_gradient', bg_gradient)
    if not content and not image_url:
        return jsonify({"error": "Story must have text or image"}), 400
    expires = (datetime.datetime.utcnow() + datetime.timedelta(hours=24)).isoformat()
    conn = get_db()
    conn.execute('INSERT INTO stories (user_id, content, image_url, bg_gradient, expires_at) VALUES (?,?,?,?,?)',
                 (request.user_id, content, image_url, bg_gradient, expires))
    conn.commit()
    story_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    story = dict_row(conn.execute('SELECT s.*, u.username, u.display_name, u.avatar_url FROM stories s JOIN users u ON s.user_id=u.id WHERE s.id=?', (story_id,)).fetchone())
    conn.close()
    return jsonify(story), 201

@app.route('/api/stories/feed', methods=['GET'])
@login_required
def get_stories_feed():
    conn = get_db()
    now = datetime.datetime.utcnow().isoformat()
    # Get stories from followed users + own, grouped by user
    stories = dict_rows(conn.execute('''
        SELECT s.*, u.username, u.display_name, u.avatar_url,
        EXISTS(SELECT 1 FROM story_views WHERE story_id=s.id AND viewer_id=?) as viewed
        FROM stories s JOIN users u ON s.user_id=u.id
        WHERE s.expires_at > ? AND (s.user_id IN (SELECT followed_id FROM follows WHERE follower_id=?) OR s.user_id=?)
        ORDER BY s.created_at DESC
    ''', (request.user_id, now, request.user_id, request.user_id)).fetchall())
    # Group by user
    user_stories = {}
    for s in stories:
        uid = s['user_id']
        if uid not in user_stories:
            user_stories[uid] = {'user_id': uid, 'username': s['username'], 'display_name': s['display_name'], 'avatar_url': s['avatar_url'], 'stories': [], 'has_unviewed': False}
        user_stories[uid]['stories'].append(s)
        if not s['viewed']:
            user_stories[uid]['has_unviewed'] = True
    # Put current user first
    result = []
    if request.user_id in user_stories:
        result.append(user_stories.pop(request.user_id))
    result.extend(user_stories.values())
    conn.close()
    return jsonify(result)

@app.route('/api/stories/<int:story_id>/view', methods=['POST'])
@login_required
def view_story(story_id):
    conn = get_db()
    try:
        conn.execute('INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?,?)', (story_id, request.user_id))
        conn.commit()
    except: pass
    finally: conn.close()
    return jsonify({"message": "Viewed"})

@app.route('/api/stories/<int:story_id>', methods=['DELETE'])
@login_required
def delete_story(story_id):
    conn = get_db()
    conn.execute('DELETE FROM stories WHERE id=? AND user_id=?', (story_id, request.user_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Story deleted"})

# ─── BOOKMARK ROUTES ──────────────────────────────────────────
@app.route('/api/posts/<int:post_id>/bookmark', methods=['POST'])
@login_required
def toggle_bookmark(post_id):
    conn = get_db()
    existing = conn.execute('SELECT id FROM bookmarks WHERE user_id=? AND post_id=?', (request.user_id, post_id)).fetchone()
    if existing:
        conn.execute('DELETE FROM bookmarks WHERE user_id=? AND post_id=?', (request.user_id, post_id))
        saved = False
    else:
        conn.execute('INSERT INTO bookmarks (user_id, post_id) VALUES (?,?)', (request.user_id, post_id))
        saved = True
    conn.commit()
    conn.close()
    return jsonify({"saved": saved})

@app.route('/api/bookmarks', methods=['GET'])
@login_required
def get_bookmarks():
    conn = get_db()
    posts = dict_rows(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked,
        1 as bookmarked
        FROM bookmarks b JOIN posts p ON b.post_id=p.id JOIN users u ON p.user_id=u.id
        WHERE b.user_id=? ORDER BY b.created_at DESC
    ''', (request.user_id, request.user_id)).fetchall())
    conn.close()
    return jsonify(posts)

# ─── TRENDING ROUTE ───────────────────────────────────────────
@app.route('/api/trending', methods=['GET'])
@login_required
def get_trending():
    conn = get_db()
    posts = dict_rows(conn.execute('''
        SELECT p.*, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked,
        EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?) as bookmarked,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) + (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as engagement
        FROM posts p JOIN users u ON p.user_id=u.id
        WHERE p.created_at > datetime('now', '-7 days')
        ORDER BY engagement DESC LIMIT 20
    ''', (request.user_id, request.user_id)).fetchall())
    conn.close()
    return jsonify(posts)

# ─── WEBSOCKET EVENTS ────────────────────────────────────────
@socketio.on('connect')
def handle_connect():
    token = request.args.get('token', '')
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = data['user_id']
        online_users[request.sid] = user_id
        join_room(f'user_{user_id}')
        conn = get_db()
        conn.execute('UPDATE users SET is_online=1 WHERE id=?', (user_id,))
        conn.commit()
        conn.close()
        emit('user_status', {'user_id': user_id, 'online': True}, broadcast=True)
    except:
        pass

@socketio.on('disconnect')
def handle_disconnect():
    user_id = online_users.pop(request.sid, None)
    if user_id:
        conn = get_db()
        conn.execute('UPDATE users SET is_online=0, last_seen=? WHERE id=?', (datetime.datetime.utcnow().isoformat(), user_id))
        conn.commit()
        conn.close()
        emit('user_status', {'user_id': user_id, 'online': False}, broadcast=True)

@socketio.on('send_message')
def handle_send_message(data):
    user_id = online_users.get(request.sid)
    if not user_id:
        return
    conv_id = data.get('conversation_id')
    content = (data.get('content') or '').strip()
    if not conv_id or not content:
        return
    conn = get_db()
    conv = conn.execute('SELECT * FROM conversations WHERE id=? AND (user1_id=? OR user2_id=?)', (conv_id, user_id, user_id)).fetchone()
    if not conv:
        conn.close()
        return
    conn.execute('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?,?,?)', (conv_id, user_id, content))
    conn.execute('UPDATE conversations SET last_message_at=? WHERE id=?', (datetime.datetime.utcnow().isoformat(), conv_id))
    conn.commit()
    msg_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    msg = dict_row(conn.execute('SELECT m.*, u.username, u.display_name, u.avatar_url FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.id=?', (msg_id,)).fetchone())
    other_id = conv['user2_id'] if conv['user1_id'] == user_id else conv['user1_id']
    conn.close()
    emit('receive_message', msg, room=f'user_{other_id}')
    emit('receive_message', msg, room=f'user_{user_id}')
    # Push notification via socket
    socketio.emit('new_notification', {'type': 'message', 'from_user_id': user_id, 'conversation_id': conv_id}, room=f'user_{other_id}')

@socketio.on('typing')
def handle_typing(data):
    user_id = online_users.get(request.sid)
    if not user_id:
        return
    conv_id = data.get('conversation_id')
    conn = get_db()
    conv = conn.execute('SELECT * FROM conversations WHERE id=?', (conv_id,)).fetchone()
    if conv:
        other_id = conv['user2_id'] if conv['user1_id'] == user_id else conv['user1_id']
        emit('user_typing', {'conversation_id': conv_id, 'user_id': user_id}, room=f'user_{other_id}')
    conn.close()

# ─── RUN ──────────────────────────────────────────────────────
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
