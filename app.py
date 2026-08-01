from flask import Flask, jsonify, request
import sqlite3

app = Flask(__name__)

# --- HELPER FUNCTION ---
# Why: We need a fresh database connection for every request to avoid locking errors.
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row # This lets us access columns by name (like dictionaries)
    return conn

# --- ROUTES ---
@app.route('/')
def home():
    return jsonify({"message": "System Online", "status": "success"})

# >>> NEW REGISTRATION ROUTE GOES HERE (See Step 2) <<<
@app.route('/register', methods=['POST'])
def register_user():

    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    # 1. Grab the JSON data sent by the client
    username = data.get('username')
    email = data.get('email')
    # Providing a default password hash for simple registration flows
    password_hash = data.get('password_hash', 'default_hash')

    # 2. Basic validation
    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400

    # 3. Connect to DB and insert the user
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # We use '?' placeholders instead of directly injecting variables (like f-strings).
        # WHY: This prevents SQL Injection attacks. If a malicious user tries to type
        # a drop table command into the username field, the '?' treats it strictly as a string.
        cursor.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        conn.commit() # Save the changes
        
        # Get the ID of the newly created user
        new_user_id = cursor.lastrowid 
        
        return jsonify({
            "message": f"User {username} created successfully!", 
            "user_id": new_user_id
        }), 201

    except sqlite3.IntegrityError:
        # WHY: In our schema.sql, we likely set username and email as UNIQUE. 
        # If they already exist, SQLite throws an IntegrityError. We catch it gracefully.
        return jsonify({"error": "Username or email already exists"}), 409
    
    finally:
        conn.close() # Always close the connection!

# 3. Create Post
@app.route('/posts', methods=['POST'])
def create_post():
    data = request.get_json()

    if not data or 'user_id' not in data or 'content' not in data:
        return jsonify({"error": "Missing user_id or content"}), 400

    user_id = data['user_id']
    content = str(data['content']).strip()

    if not content:
        return jsonify({"error": "Post content cannot be empty"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if the user exists first
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": f"User with ID {user_id} does not exist"}), 404

        # Insert post linked to user_id
        cursor.execute(
            "INSERT INTO posts (user_id, content) VALUES (?, ?)",
            (user_id, content)
        )
        conn.commit()
        new_post_id = cursor.lastrowid

        return jsonify({
            "status": "success",
            "message": "Post created successfully",
            "post": {
                "id": new_post_id,
                "user_id": user_id,
                "content": content
            }
        }), 201

    except sqlite3.Error as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)
