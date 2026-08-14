from app import app

# Vercel Python builder will use this file to serve the Flask WSGI app.
# Ensure requirements are installed and `app` is importable.

# Expose the WSGI app as `app` for the builder.
__all__ = ["app"]
