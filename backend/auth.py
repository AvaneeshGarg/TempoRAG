"""
OAuth2 authentication routes for Google and GitHub.
Uses Authlib for the OAuth dance and python-jose for JWT cookie sessions.
"""

import os
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Config ──────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION_USE_A_LONG_RANDOM_STRING")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7
COOKIE_NAME = "crag_session"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8000")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")  # set in Render env

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "")  # set in Render env


# ── JWT helpers ──────────────────────────────────────────────────────────────
def create_jwt(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def set_auth_cookie(response: Response, user_data: dict) -> None:
    token = create_jwt(user_data)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,           # HTTPS only in production
        samesite="lax",
        max_age=JWT_EXPIRE_DAYS * 86400,
    )


def get_current_user(request: Request) -> Optional[dict]:
    """Dependency: reads JWT from cookie. Returns None if missing/invalid."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return decode_jwt(token)


def require_user(request: Request) -> dict:
    """Dependency: raises 401 if not authenticated."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user


# ── /auth/me ─────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    name: str
    email: str
    avatar: Optional[str] = None
    role: str = "physician"
    provider: str = "unknown"


@router.get("/me")
def get_me(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "avatar": user.get("avatar"),
        "role": user.get("role", "physician"),
        "provider": user.get("provider", "unknown"),
        "isGuest": False,
    }


# ── /auth/logout ─────────────────────────────────────────────────────────────
@router.get("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, httponly=True, secure=True, samesite="lax")
    return RedirectResponse(url=f"{FRONTEND_URL}/", status_code=302)


# ── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google")
def google_login(request: Request):
    """Redirect user to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured.")
    state = secrets.token_urlsafe(16)
    request.session["oauth_state"] = state  # type: ignore[attr-defined]
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query}", status_code=302)


@router.get("/google/callback")
async def google_callback(request: Request, code: str, state: str):
    """Exchange code for token, fetch user info, set JWT cookie."""
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        userinfo_resp.raise_for_status()
        info = userinfo_resp.json()

    user_data = {
        "name": info.get("name", info.get("email", "User")),
        "email": info.get("email", ""),
        "avatar": info.get("picture"),
        "role": "physician",
        "provider": "google",
    }

    redirect = RedirectResponse(url=f"{FRONTEND_URL}/", status_code=302)
    set_auth_cookie(redirect, user_data)
    return redirect


# ── GitHub OAuth ─────────────────────────────────────────────────────────────
GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USERINFO_URL = "https://api.github.com/user"


@router.get("/github")
def github_login(request: Request):
    """Redirect user to GitHub OAuth consent screen."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured.")
    state = secrets.token_urlsafe(16)
    request.session["oauth_state"] = state  # type: ignore[attr-defined]
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GITHUB_AUTH_URL}?{query}", status_code=302)


@router.get("/github/callback")
async def github_callback(request: Request, code: str, state: str):
    """Exchange code for token, fetch user info, set JWT cookie."""
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "code": code,
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")

        userinfo_resp = await client.get(
            GITHUB_USERINFO_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        userinfo_resp.raise_for_status()
        info = userinfo_resp.json()

        # GitHub may not expose email publicly; fetch from /user/emails
        email = info.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if emails_resp.is_success:
                primary = next(
                    (e["email"] for e in emails_resp.json() if e.get("primary")), None
                )
                email = primary or f"{info.get('login')}@github"

    user_data = {
        "name": info.get("name") or info.get("login", "GitHub User"),
        "email": email or f"{info.get('login')}@github",
        "avatar": info.get("avatar_url"),
        "role": "physician",
        "provider": "github",
    }

    redirect = RedirectResponse(url=f"{FRONTEND_URL}/", status_code=302)
    set_auth_cookie(redirect, user_data)
    return redirect
