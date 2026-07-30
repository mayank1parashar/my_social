from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/', methods=['GET'])
def system_status():
    return jsonify({
        "status": "success",
        "message": "System Online"
    }), 200


# >>> NEW REGISTRATION ROUTE GOES HERE (See Step 2) <<<
@app.route('/register', methods=['POST'])
def register_user():
    # 1. Grab the JSON data sent by the client
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')

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
            'INSERT INTO users (username, email) VALUES (?, ?)',
            (username, email)
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

if __name__ == '__main__':
    # debug=True automatically reloads the server when you save changes
    app.run(debug=True)
