import sqlite3

def init_db():
    # Connects to database.db (creates it if it doesn't exist)
    conn = sqlite3.connect('database.db')
    
    with open('schema.sql', 'r') as f:
        conn.executescript(f.read())
        
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

if __name__ == '__main__':
    init_db()