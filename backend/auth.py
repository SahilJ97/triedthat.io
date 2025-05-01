from fastapi import APIRouter, Request, HTTPException
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import json
import uuid
import os
from jose.exceptions import JWTError
from oauthlib.oauth2 import WebApplicationClient
from sqlalchemy.orm import Session
from jose import jwt
from dotenv import load_dotenv
import requests

from backend import (
    log_message, JWT_SECRET_KEY, JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS,
    db_context
)
from backend.models import User

router = APIRouter()

load_dotenv()

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI")

# LinkedIn OAuth endpoints
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USER_INFO_URL = "https://api.linkedin.com/v2/userinfo"  # Updated for OpenID Connect
LINKEDIN_EMAIL_URL = "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))"

linkedin_client = WebApplicationClient(LINKEDIN_CLIENT_ID)

credentials_exception = HTTPException(
    status_code=401,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
        request: Request,
        db: Session,
        optional: bool = False
) -> Optional[User]:
    """Get current user from JWT token"""
    if 'authorization' not in request.headers and optional:
        log_message("No authorization header found")
        return None

    auth = request.headers.get('authorization', '')
    log_message(f"Authorization header: {auth}")
    
    if not auth.startswith('Bearer '):
        if optional:
            log_message("No Bearer token found")
            return None
        raise credentials_exception

    token = auth.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            if optional:
                return None
            raise credentials_exception
    except JWTError:
        if optional:
            return None
        raise credentials_exception

    user = db.query(User).get(user_id)
    if user is None and not optional:
        raise credentials_exception

    return user


def create_tokens(user_id: int) -> Dict[str, str]:
    """Create access and refresh tokens"""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    access_token = jwt.encode(
        claims={
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) + access_token_expires
        },
        key=JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )

    refresh_token = jwt.encode(
        claims={
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) + refresh_token_expires
        },
        key=JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }

@router.get("/api/auth/linkedin/login")
async def api_linkedin_login():
    """Generate LinkedIn authorization URL"""
    auth_url = linkedin_client.prepare_request_uri(
        LINKEDIN_AUTH_URL,
        redirect_uri=LINKEDIN_REDIRECT_URI,
        scope=["openid", "profile", "email"],
        state=str(uuid.uuid4())
    )
    return {"auth_url": auth_url}

@router.post("/api/auth/linkedin/callback")
async def api_linkedin_callback(request: Request):
    """Handle LinkedIn OAuth callback"""
    with db_context() as db:
        # Get request data
        data = await request.json()
        code = data.get("code")
        
        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")
        
        # Exchange code for access token - manual approach to avoid parameter conflicts
        token_url = LINKEDIN_TOKEN_URL
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        body = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': LINKEDIN_REDIRECT_URI,
            'client_id': LINKEDIN_CLIENT_ID,
            'client_secret': LINKEDIN_CLIENT_SECRET
        }
        
        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            timeout=30
        )
        
        if token_response.status_code != 200:
            log_message(f"LinkedIn token error: {token_response.text}")
            raise HTTPException(status_code=400, detail="Failed to obtain access token")
        
        # Parse token response
        token_data = token_response.json()
        try:
            access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 0)  # in seconds
            log_message(f"Access token: {access_token}")
            log_message(f"Expires in: {expires_in}")
        except KeyError as e:
            log_message(f"Failed to parse token response: {str(e)}", error=True)
            log_message(f"Token response: {token_data}", error=True)
            raise HTTPException(status_code=500, detail="An error occurred on our end.")
        
        # Get user profile information
        user_info = get_linkedin_user_info(access_token)
        
        # Extract email directly from user info with OpenID Connect
        email = extract_linkedin_email(user_info)
        
        # Get LinkedIn ID (sub is the user identifier in OpenID Connect)
        linkedin_id = user_info.get("sub")
        user = db.query(User).filter(User.linkedin_id == linkedin_id).first()
        
        if not user:
            # Check if user exists by email
            if email:
                user = db.query(User).filter(User.email == email).first()
            
            # Create new user if not found
            if not user:
                # Set LinkedIn profile URL if vanity name is available
                linkedin_profile_url = f"https://www.linkedin.com/in/{user_info.get('vanityName')}" if user_info.get('vanityName') else None
                
                user = User(
                    linkedin_id=linkedin_id,
                    email=email,
                    first_name=user_info.get("given_name"),
                    last_name=user_info.get("family_name"),
                    user_json=json.dumps(user_info),
                    access_token=access_token,
                    profile_picture_url=user_info.get("picture"),
                    linkedin_profile_url=linkedin_profile_url,
                    token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                )
        else:
            # Update user information
            user.linkedin_id = linkedin_id
            if email:
                user.email = email
            user.first_name = user_info.get("given_name")
            user.last_name = user_info.get("family_name")
            user.access_token = access_token
            user.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            user.profile_picture_url = user_info.get("picture")
            
            # Update LinkedIn profile URL if vanity name is available
            if user_info.get('vanityName'):
                user.linkedin_profile_url = f"https://www.linkedin.com/in/{user_info.get('vanityName')}"
            
            user_data = user.user_data()
            for key, value in user_info.items():
                user_data[key] = value
            user.user_json = json.dumps(user_data)

        try:
            db.add(user)
            db.commit()
        except Exception as e:
            db.rollback()
            log_message(f"Failed to save user information: {str(e)}", error=True)
            raise HTTPException(status_code=500, detail="Failed to save user information")

        
        # Create JWT tokens
        tokens = create_tokens(user.id)
        
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        }

@router.post("/api/refresh")
async def api_refresh(
        request: Request,
):
    with db_context() as db:
        current_user = await get_current_user(request=request, db=db)
        tokens = create_tokens(current_user.id)
        return {"access_token": tokens["access_token"]}

@router.get("/api/me")
async def api_get_me(
        request: Request,
):
    with db_context() as db:
        log_message("api_get_me called")
        current_user = await get_current_user(request=request, db=db, optional=True)
        log_message(f"get_current_user returned: {current_user}")
        
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")


        return {
            'user_id': current_user.id,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'profile_picture_url': current_user.profile_picture_url,
            'linkedin_id': current_user.linkedin_id
        }

def get_linkedin_user_info(access_token: str) -> Dict[str, Any]:
    """Get LinkedIn user profile information"""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    # Get basic profile info from OpenID Connect endpoint
    response = requests.get(LINKEDIN_USER_INFO_URL, headers=headers, timeout=30)
    
    if response.status_code != 200:
        log_message(f"LinkedIn user info error: {response.text}")
        raise HTTPException(status_code=400, detail="Failed to retrieve user information")
    
    user_info = response.json()
    
    # Get additional profile data including vanity name
    # This is expected to fail, unfortunately, as LinkedIn has restricted access to vanityName
    """try:
        profile_response = requests.get(
            "https://api.linkedin.com/v2/me",
            headers=headers,
            timeout=30
        )
        
        if profile_response.status_code == 200:
            profile_data = profile_response.json()
            # Log the full profile data to understand its structure
            log_message(f"LinkedIn profile data: {profile_data}")
            
            # Extract vanity name from the response - should be directly in the response as shown in docs
            if "vanityName" in profile_data:
                user_info["vanityName"] = profile_data.get("vanityName")
                log_message(f"Found vanityName directly in response: {user_info['vanityName']}")
        else:
            log_message(f"Failed to get LinkedIn vanity name: {profile_response.text}", error=True)

    except Exception as e:
        log_message(f"Error retrieving LinkedIn vanity name: {str(e)}", error=True)"""
    
    return user_info

def extract_linkedin_email(user_info: Dict[str, Any]) -> Optional[str]:
    """Extract email from LinkedIn OpenID Connect userinfo response"""
    try:
        # In OpenID Connect, the email is directly in the userinfo response
        return user_info.get("email")
    except Exception as e:
        log_message(f"Error extracting LinkedIn email: {str(e)}")
    
    return None

@router.post('/api/delete-account')
async def api_delete_account(
        request: Request,
):
    with db_context() as db:
        current_user = await get_current_user(request=request, db=db, optional=False)
        log_message(f"api_delete_account called with current_user: {current_user}")

        try:
            db.delete(current_user)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete account: {str(e)}"
            )

        return {
            "message": "Account deleted successfully"
        }
