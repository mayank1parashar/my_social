# my_social — A Tiny Social Playground

Welcome to my_social — a compact, human-sized social app for learning, hacking, and demoing social features.

This repo contains a lightweight Flask backend (with optional realtime features), static frontend assets, and simple SQLite schema for local development.

Why this exists
- Rapid prototyping: ship a feed, posts, comments, likes, stories, and DMs fast.
- Learn-by-doing: easy to extend, inspect, and adapt to production services.

Features
- User registration / JWT authentication
- Create posts with optional images
- Like, comment, bookmark, follow
- Stories with 24-hour expiry
- Conversations (messages) and basic presence
- Optional realtime using Socket.IO (can be disabled for serverless deploys)

Quick start (local)
1. Create and activate a virtualenv (recommended):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Initialize DB and run (simple):

```powershell
python init_db.py   # creates database.db locally
python app.py       # runs on http://localhost:5000
```

3. Use the frontend: open `static/index.html` in a browser or point to `http://localhost:5000`.

Notes for deployment
- This project was adapted to be serverless-friendly:
	- Socket.IO is optional. Set `ENABLE_SOCKETIO=1` when deploying to a socket-capable host.
	- For Vercel, use a remote DB and cloud storage; local uploads and SQLite are ephemeral. See `vercel.json` and `api/index.py`.

Environment variables (important)
- `SECRET_KEY` — your JWT secret
- `DATABASE` — path or full DB URL (use remote DB for production)
- `ENABLE_SOCKETIO` — set to `1` to enable Socket.IO on a long-running server
- `DISABLE_LOCAL_UPLOADS` — set to `1` to avoid writing uploads to local disk

Deployment suggestions
- Quick (keep current behavior): deploy to Render / Fly / Railway and set `ENABLE_SOCKETIO=1`.
- Serverless (Vercel): move DB to Supabase/PlanetScale, uploads to S3/GCS, and keep `ENABLE_SOCKETIO` unset.
- Hybrid: host realtime on a small instance and REST on serverless functions.

Creative closing
Think of this repo as a social sandbox — equal parts toy and ladder. Break it, learn how pieces fit, then swap each local part for a sturdy cloud muscle when you’re ready to scale.

If you want, I can:
- Add a guided `deploy.md` for Vercel or Render
- Replace local uploads with an S3-backed flow (example + code)
- Create a GitHub Release note summarizing changes

Enjoy building!
