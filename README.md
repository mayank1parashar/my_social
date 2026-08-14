# my_social

A full-featured social networking web app built with Flask, SQLite, and real-time Socket.IO. The project includes user authentication, posts, likes, comments, follows, stories, bookmarks, notifications, and direct messaging.

## Features

- User registration and login with JWT authentication
- Profile management and password updates
- Create and delete posts with optional image uploads
- Like, comment, bookmark, and explore content
- Follow/unfollow users and view profile statistics
- Stories with expiration and view tracking
- Real-time notifications and chat via Socket.IO
- Conversation and message system between users
- Responsive single-page frontend served from the static directory

## Tech Stack

- Python 3
- Flask
- Flask-SocketIO
- SQLite
- JWT authentication
- Pillow for image processing
- bcrypt for password hashing
- python-dotenv for environment variables

## Project Structure

```text
my_social/
├── app.py                 # Flask application and API routes
├── config.py              # Application configuration
├── init_db.py             # Database initialization and seed data
├── schema.sql             # SQLite schema definition
├── requirements.txt       # Python dependencies
├── test_api.py            # Example API test script
├── database.db            # SQLite database (created after initialization)
├── README.md              # Project documentation
├── static/                # Frontend HTML/CSS/JS assets
│   ├── index.html
│   ├── css/
│   └── js/
├── uploads/
│   ├── avatars/
│   ├── posts/
│   └── stories/
└── .env                   # Optional local environment settings
```

## Prerequisites

Before running the project, make sure you have:

- Python 3.9+ installed
- pip installed
- A terminal or command prompt

## Quick Start

1. Clone or open the project folder.
2. Create and activate a virtual environment:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Initialize the database and seed sample data:

```bash
python init_db.py
```

This creates the SQLite database file and required upload folders.

5. Start the app:

```bash
python app.py
```

The app runs by default on:

```text
http://127.0.0.1:5000
```

## Environment Configuration

The app uses environment variables with sensible defaults if they are not set. You can optionally create a `.env` file in the project root:

```env
SECRET_KEY=your_super_secret_key_here
DATABASE=database.db
```

If you do not provide a `SECRET_KEY`, the app falls back to a development value.

## Authentication

The app uses JWT bearer tokens.

- Register: `POST /api/register`
- Login: `POST /api/login`
- Get current user: `GET /api/me`

Example payload for registration:

```json
{
  "username": "alex",
  "email": "alex@example.com",
  "password": "password123",
  "display_name": "Alex"
}
```

Example payload for login:

```json
{
  "username": "alex",
  "password": "password123"
}
```

Use the token returned from login/register in the Authorization header:

```http
Authorization: Bearer <token>
```

## Main API Endpoints

### Auth

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`

### Posts

- `GET /api/feed`
- `GET /api/explore`
- `POST /api/posts`
- `POST /api/posts/<post_id>/like`
- `GET /api/posts/<post_id>/comments`
- `POST /api/posts/<post_id>/comments`
- `DELETE /api/posts/<post_id>`
- `POST /api/posts/<post_id>/bookmark`
- `GET /api/bookmarks`
- `GET /api/trending`

### Users and Profiles

- `GET /api/search`
- `GET /api/users/suggestions`
- `GET /api/users/<user_id>`
- `GET /api/users/<user_id>/posts`
- `POST /api/users/<user_id>/follow`
- `PUT /api/users/me`
- `PUT /api/users/me/password`
- `DELETE /api/users/me`

### Messaging and Notifications

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/<conv_id>/messages`
- `GET /api/notifications`
- `POST /api/notifications/read`

### Stories

- `POST /api/stories`
- `GET /api/stories/feed`
- `POST /api/stories/<story_id>/view`
- `DELETE /api/stories/<story_id>`

## Real-Time Features

The app uses Socket.IO for live behavior such as:

- online/offline user status
- message delivery
- typing indicators
- notifications

Clients connect with the JWT token as a query parameter named `token`.

## Database

The database is SQLite and is created from `schema.sql`.

Core tables include:

- `users`
- `posts`
- `likes`
- `comments`
- `follows`
- `conversations`
- `messages`
- `notifications`
- `stories`
- `story_views`
- `bookmarks`

## File Uploads

Uploaded media is stored in the `uploads/` folder:

- avatars
- posts
- stories

Supported image extensions:

- png
- jpg
- jpeg
- gif
- webp

## Sample Data

Running `python init_db.py` populates the database with example users, follow relationships, posts, likes, comments, and stories. This is useful for testing the UI and API without needing to create your own data first.

## Running in Development

The app starts in debug mode by default when run with:

```bash
python app.py
```

This enables Flask debug output and the app will reload on source changes.

## Production Notes

This project is designed for development/demo use. For production deployment, consider:

- using a stronger production secret key
- running behind a proper web server and reverse proxy
- replacing SQLite with PostgreSQL or MySQL
- enabling HTTPS and secure cookie/session policies
- adding proper logging, monitoring, and backup strategy
- validating file uploads more strictly

## Common Troubleshooting

### Database errors

If the database is missing or corrupt, remove the old file and rerun:

```bash
python init_db.py
```

### Upload folder issues

The app will create upload folders automatically on startup for `avatars`, `posts`, and `stories`, but you can also create them manually if needed.

### Port already in use

If port 5000 is already taken, update the socketio run configuration in `app.py`.

## License

This project is provided as a learning/demo project and does not include a formal license unless specified elsewhere.

## Credits

Built as a social media application prototype with Flask and real-time web features.
