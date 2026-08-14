import sqlite3
import os
import bcrypt
import datetime

DB_PATH = 'database.db'

def init_db():
    # Remove old database
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("Old database removed.")

    conn = sqlite3.connect(DB_PATH)

    # Run schema
    with open('schema.sql', 'r') as f:
        conn.executescript(f.read())

    # Create seed users
    cursor = conn.cursor()
    seed_users = [
        ('alex_dev', 'alex@example.com', 'password123', 'Alex Chen', 'Full-stack developer & coffee enthusiast ☕'),
        ('maya_art', 'maya@example.com', 'password123', 'Maya Johnson', 'Digital artist 🎨 | Creating worlds one pixel at a time'),
        ('sam_photo', 'sam@example.com', 'password123', 'Sam Rivera', 'Photographer 📷 | Capturing moments'),
        ('jordan_fit', 'jordan@example.com', 'password123', 'Jordan Blake', 'Fitness coach 💪 | Living the healthy life'),
        ('taylor_music', 'taylor@example.com', 'password123', 'Taylor Okafor', 'Musician 🎵 | Singer-songwriter'),
    ]

    for username, email, password, display_name, bio in seed_users:
        pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            'INSERT INTO users (username, email, password_hash, display_name, bio) VALUES (?, ?, ?, ?, ?)',
            (username, email, pw_hash, display_name, bio)
        )

    # Add some follow relationships
    follows = [(1,2),(1,3),(2,1),(2,3),(3,1),(3,4),(4,1),(4,5),(5,2),(5,3)]
    for follower, followed in follows:
        cursor.execute('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)', (follower, followed))

    # Add some seed posts
    posts = [
        (1, 'Just shipped a new feature! The feeling of clean code is unmatched. 🚀', ''),
        (2, 'New digital painting finished today. Spent 12 hours on this one!', ''),
        (3, 'Golden hour at the beach. Nature never disappoints. 🌅', ''),
        (4, 'Morning workout done! Remember: consistency beats intensity.', ''),
        (5, 'New song dropping next week! Stay tuned 🎶', ''),
        (1, 'Learning Flask-SocketIO for real-time features. This is powerful!', ''),
        (2, 'Color palette inspiration for my next project 🎨✨', ''),
    ]
    for user_id, content, image_url in posts:
        cursor.execute('INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)', (user_id, content, image_url))

    # Add some likes
    likes = [(1,3),(1,5),(2,1),(2,4),(3,1),(3,2),(4,5),(5,1),(5,7)]
    for user_id, post_id in likes:
        cursor.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', (user_id, post_id))

    # Add some comments
    comments = [
        (2, 1, 'Amazing work! Keep shipping! 🔥'),
        (3, 1, 'Clean code is the best code'),
        (1, 2, 'This is incredible Maya!'),
        (4, 3, 'What a beautiful shot!'),
        (5, 4, 'You inspire me every day 💪'),
    ]
    for user_id, post_id, content in comments:
        cursor.execute('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', (user_id, post_id, content))

    # Add some seed stories
    stories = [
        (1, 'Loving this new background!', '', 'linear-gradient(135deg, #8b5cf6, #ec4899)'),
        (2, 'Working on some new sketches 🎨', '', 'linear-gradient(135deg, #10b981, #3b82f6)'),
        (3, 'Quick update: prints available now!', '', 'linear-gradient(135deg, #f59e0b, #ef4444)'),
        (4, 'Don\'t skip leg day!', '', 'linear-gradient(135deg, #3b82f6, #8b5cf6)'),
        (5, 'Studio time 🎙️', '', 'linear-gradient(135deg, #ec4899, #f43f5e)')
    ]
    expires = (datetime.datetime.utcnow() + datetime.timedelta(hours=24)).isoformat()
    for user_id, content, image_url, bg_gradient in stories:
        cursor.execute('INSERT INTO stories (user_id, content, image_url, bg_gradient, expires_at) VALUES (?, ?, ?, ?, ?)', (user_id, content, image_url, bg_gradient, expires))

    conn.commit()
    conn.close()
    print("Database initialized with seed data!")

    # Create upload directories
    os.makedirs('uploads/avatars', exist_ok=True)
    os.makedirs('uploads/posts', exist_ok=True)
    os.makedirs('uploads/stories', exist_ok=True)
    print("Upload directories created.")

if __name__ == '__main__':
    init_db()