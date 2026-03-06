from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import asyncio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError
import httpx
import resend
import hmac
import hashlib
import json
import re
import random
import urllib.parse
import html as _html
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── Logging first so startup errors are visible in Railway logs ──
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("CartY API starting up...")

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
SUBSCRIPTION_PRICE_NGN = int(os.environ.get('SUBSCRIPTION_PRICE_NGN', 750000))
TERMII_API_KEY = os.environ.get('TERMII_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
META_ACCESS_TOKEN = os.environ.get('META_ACCESS_TOKEN', '')
META_AD_ACCOUNT_ID = os.environ.get('META_AD_ACCOUNT_ID', '')
TIKTOK_ACCESS_TOKEN = os.environ.get('TIKTOK_ACCESS_TOKEN', '')
TIKTOK_ADVERTISER_ID = os.environ.get('TIKTOK_ADVERTISER_ID', '')
ADS_MARGIN_PERCENT = float(os.environ.get('ADS_MARGIN_PERCENT', '15'))

logger.info(f"SUPABASE_URL set: {bool(SUPABASE_URL)}")
logger.info(f"SUPABASE_SERVICE_KEY set: {bool(SUPABASE_SERVICE_KEY)}")
logger.info(f"JWT_SECRET custom: {JWT_SECRET != 'default_secret'}")
logger.info(f"PAYSTACK_SECRET_KEY set: {bool(PAYSTACK_SECRET_KEY)}")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.critical("CRITICAL: SUPABASE_URL and/or SUPABASE_SERVICE_KEY not set — check Railway Variables tab!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
resend.api_key = RESEND_API_KEY

app = FastAPI(title="CartY API", description="WhatsApp Storefront Builder API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logger.info("FastAPI app created successfully")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "CartY API"}


# ================== DB HELPERS ==================

async def db(fn):
    """Run a sync supabase call in a thread pool."""
    return await asyncio.to_thread(fn)

def one(result) -> Optional[dict]:
    """Return first row from a list result, or None."""
    if result and result.data:
        return result.data[0]
    return None

def many(result) -> list:
    """Return all rows from a list result."""
    return result.data if result and result.data else []


# ================== MODELS ==================

class UserRegister(BaseModel):
    phone: str
    password: str
    country: str = "NG"
    state: str = ""

class UserLogin(BaseModel):
    phone: str
    password: str

class StoreCreate(BaseModel):
    name: str
    whatsapp_number: str
    email: Optional[EmailStr] = None
    logo: Optional[str] = None

class StoreUpdate(BaseModel):
    name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email: Optional[EmailStr] = None
    logo: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    is_active: Optional[bool] = None

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CheckoutRequest(BaseModel):
    buyer_name: str
    buyer_phone: str
    buyer_address: str
    buyer_note: Optional[str] = None
    cart_items: List[CartItem]

class WithdrawalRequest(BaseModel):
    amount: float

class TransferRequest(BaseModel):
    bank_code: str
    account_number: str
    bank_name: str
    amount: float

class SubscribeRequest(BaseModel):
    email: str

class SubscriptionCardChargeRequest(BaseModel):
    card_number: str
    expiry_month: str
    expiry_year: str
    cvv: str

class OtpSubmitRequest(BaseModel):
    reference: str
    otp: str

class StorefrontCardChargeRequest(BaseModel):
    buyer_name: str
    buyer_phone: str
    buyer_address: str
    buyer_note: Optional[str] = None
    cart_items: List[CartItem]
    card_number: str
    expiry_month: str
    expiry_year: str
    cvv: str

class StorefrontOtpRequest(BaseModel):
    reference: str
    otp: str
    order_id: str

class SendOtpRequest(BaseModel):
    phone: str
    purpose: str  # 'verify_phone' or 'forgot_password'

class VerifyPhoneRequest(BaseModel):
    code: str

class ResetPasswordRequest(BaseModel):
    phone: str
    code: str
    new_password: str

class PushTokenRequest(BaseModel):
    push_token: str

class ChatMessage(BaseModel):
    role: str
    content: str

class SupportChatRequest(BaseModel):
    messages: List[ChatMessage]

class AdCampaignCreate(BaseModel):
    platform: str          # 'meta' or 'tiktok'
    objective: str         # 'traffic', 'awareness', 'sales'
    ad_headline: str
    ad_description: str
    ad_image: Optional[str] = None
    target_age_min: int = 18
    target_age_max: int = 55
    target_gender: str = 'all'
    target_locations: List[str] = []
    budget_ngn: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class AdCardChargeRequest(BaseModel):
    campaign_id: str
    card_number: str
    expiry_month: str
    expiry_year: str
    cvv: str

class AdOtpRequest(BaseModel):
    reference: str
    otp: str
    campaign_id: str

class MetaConnectRequest(BaseModel):
    access_token: str
    ad_account_id: str   # e.g. "act_123456789" or "123456789"

class TikTokConnectRequest(BaseModel):
    access_token: str
    advertiser_id: str


# ================== HELPERS ==================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = one(await db(lambda: supabase.table('users').select('*').eq('id', user_id).limit(1).execute()))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_slug(name: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug

async def send_order_email(seller_email: str, order_data: dict):
    try:
        items_html = "".join(
            f"<li>{item['name']} x{item['quantity']} - ₦{item['price']:,.2f}</li>"
            for item in order_data.get('items', [])
        )
        html_content = f"""
        <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#4F46E5;color:white;padding:20px;text-align:center;">
                <h1 style="margin:0;">New Order Received!</h1>
            </div>
            <div style="padding:20px;background:#f9f9f9;">
                <p><strong>Order:</strong> #{order_data.get('order_id','N/A')}</p>
                <p><strong>Customer:</strong> {order_data.get('buyer_name','N/A')}</p>
                <p><strong>Phone:</strong> {order_data.get('buyer_phone','N/A')}</p>
                <p><strong>Address:</strong> {order_data.get('buyer_address','N/A')}</p>
                {f"<p><strong>Note:</strong> {order_data.get('buyer_note')}</p>" if order_data.get('buyer_note') else ''}
                <h3>Items:</h3><ul>{items_html}</ul>
                <div style="background:#4F46E5;color:white;padding:15px;border-radius:8px;text-align:center;">
                    <h2 style="margin:0;">Total: ₦{order_data.get('total',0):,.2f}</h2>
                </div>
                <p style="color:green;font-weight:bold;margin-top:20px;">Payment Confirmed</p>
            </div>
        </body></html>
        """
        resend.Emails.send({
            "from": "CartY <orders@resend.dev>",
            "to": [seller_email],
            "subject": f"New Order #{order_data.get('order_id','')} - ₦{order_data.get('total',0):,.2f}",
            "html": html_content
        })
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

def get_public_base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "")
    return f"{proto}://{host}"

def generate_whatsapp_link(phone: str, order_data: dict) -> str:
    items_text = "".join(f"\n- {i['name']} x{i['quantity']}" for i in order_data.get('items', []))
    message = f"""NEW ORDER!

Customer: {order_data.get('buyer_name','N/A')}
Phone: {order_data.get('buyer_phone','N/A')}
Address: {order_data.get('buyer_address','N/A')}
{f"Note: {order_data.get('buyer_note')}" if order_data.get('buyer_note') else ''}
Items:{items_text}

Total: ₦{order_data.get('total',0):,.2f}
Order: #{order_data.get('order_id','N/A')}
Payment Confirmed"""
    clean = re.sub(r'[^0-9]', '', phone)
    if clean.startswith('0'):
        clean = '234' + clean[1:]
    elif not clean.startswith('234'):
        clean = '234' + clean
    return f"https://wa.me/{clean}?text={urllib.parse.quote(message)}"


# ================== OTP HELPERS ==================

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

async def store_otp(phone: str, code: str, purpose: str):
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    await db(lambda: supabase.table('otp_codes')
        .update({'used': True})
        .eq('phone', phone)
        .eq('purpose', purpose)
        .eq('used', False)
        .execute())
    await db(lambda: supabase.table('otp_codes').insert({
        'phone': phone, 'code': code, 'purpose': purpose,
        'expires_at': expires_at, 'used': False,
    }).execute())

async def verify_otp_code(phone: str, code: str, purpose: str) -> bool:
    result = await db(lambda: supabase.table('otp_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('purpose', purpose)
        .eq('used', False)
        .execute())
    if not result or not result.data:
        return False
    otp = result.data[0]
    try:
        expires_at = datetime.fromisoformat(otp['expires_at'].replace('Z', '+00:00'))
        if datetime.now(expires_at.tzinfo) > expires_at:
            return False
    except Exception:
        return False
    await db(lambda: supabase.table('otp_codes').update({'used': True}).eq('id', otp['id']).execute())
    return True

async def send_sms_otp(phone: str, code: str, purpose: str) -> bool:
    """Send OTP via SMS using Termii. Returns True on success, False on failure."""
    if purpose == 'verify_phone':
        message = f"Your CartY verification code is {code}. Valid for 10 minutes. Do not share."
    else:
        message = f"Your CartY password reset code is {code}. Valid for 10 minutes. Do not share."

    # Always log OTP to Railway so devs can use it even if SMS delivery fails
    logger.info(f"[OTP] Phone={phone} | Code={code} | Purpose={purpose}")

    if not TERMII_API_KEY:
        logger.error("[SMS] TERMII_API_KEY not set — add it to Railway environment variables.")
        return False

    # Normalise to international format (Nigeria: 0XXXXXXXXXX → 234XXXXXXXXXX)
    clean = re.sub(r'[^0-9]', '', phone)
    if clean.startswith('0'):
        clean = '234' + clean[1:]
    elif not clean.startswith('234') and len(clean) <= 10:
        clean = '234' + clean
    elif not clean.startswith('234') and len(clean) == 11 and clean.startswith('0'):
        clean = '234' + clean[1:]

    logger.info(f"[SMS] Attempting delivery to normalised number: {clean}")

    # (channel, sender_id) pairs to try in order:
    # - dnd + N-Alert: bypasses DND lists (requires DND route on Termii account)
    # - generic + N-Alert: standard Nigeria SMS with Termii's shared sender
    # - generic + CartY: fallback in case N-Alert is restricted on generic
    attempts = [
        ('dnd', 'N-Alert'),
        ('generic', 'N-Alert'),
        ('generic', 'CartY'),
    ]

    for channel, sender in attempts:
        try:
            payload = {
                "api_key": TERMII_API_KEY,
                "to": clean,
                "from": sender,
                "sms": message,
                "type": "plain",
                "channel": channel,
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post("https://api.ng.termii.com/api/sms/send", json=payload)

            try:
                result = resp.json()
            except Exception:
                result = {}

            logger.info(f"[SMS] Termii response ({channel}/{sender}): status={resp.status_code} body={result}")

            if resp.status_code == 200 and result.get("code") == "ok":
                logger.info(f"[SMS] OTP delivered via {channel}/{sender} to {clean}")
                return True

            # Log the specific Termii error code and message for easy debugging
            err_code = result.get("code", "unknown")
            err_msg  = result.get("message", resp.text)
            logger.warning(f"[SMS] {channel}/{sender} failed — Termii code={err_code}: {err_msg}")

        except Exception as e:
            logger.error(f"[SMS] Exception calling Termii ({channel}/{sender}): {e}")

    logger.error(f"[SMS] All delivery attempts failed for {clean}. Check Railway logs for Termii error details.")
    return False


# ================== PUSH NOTIFICATIONS ==================

async def send_push_notification(push_token: str, title: str, body: str, data: dict = {}):
    """Fire-and-forget Expo push notification."""
    if not push_token or not push_token.startswith('ExponentPushToken'):
        return
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={"to": push_token, "title": title, "body": body, "data": data, "sound": "default"},
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
    except Exception as e:
        logger.error(f"Push notification error: {e}")

async def get_store_push_token(store_id: str) -> Optional[str]:
    """Lookup push token for the user who owns a store."""
    store = one(await db(lambda: supabase.table('stores').select('user_id').eq('id', store_id).limit(1).execute()))
    if not store:
        return None
    user = one(await db(lambda: supabase.table('users').select('push_token').eq('id', store['user_id']).limit(1).execute()))
    return user.get('push_token') if user else None


# ================== OPENAI HELPER ==================

CARTY_SYSTEM_PROMPT = """You are CartY Support, a helpful and friendly AI assistant built into the CartY app — a mobile commerce platform for African vendors and small businesses.

Your role:
- Help sellers use the CartY app effectively
- Answer questions about managing their store, products, orders, payments, and withdrawals
- Explain CartY features in simple, clear language
- Be encouraging and professional

CartY features you can explain:
- Store creation and customization (name, logo, WhatsApp number)
- Product management (add, edit, delete products with photos and prices)
- Shareable storefront link customers can browse and purchase from
- Paystack payment processing (cards, bank transfer)
- Wallet: receive earnings, link bank account, withdraw funds
- Subscription: $7/month to accept online payments
- Phone OTP verification and account security
- Multi-country support across Africa and beyond

Rules:
- Only answer CartY-related questions
- If asked about unrelated topics, politely redirect to CartY topics
- Keep responses concise (2-4 sentences maximum unless a step-by-step is needed)
- Use emojis sparingly for friendliness
- Never make up features that don't exist
"""

async def openai_chat(messages: List[dict], system_context: str = "") -> str:
    if not OPENAI_API_KEY:
        return "I'm CartY Support. Our AI assistant is currently being set up. For help, please contact support via WhatsApp or email."
    try:
        system = CARTY_SYSTEM_PROMPT
        if system_context:
            system += f"\n\nCurrent seller context:\n{system_context}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": 400,
                    "temperature": 0.7,
                },
            )
            data = resp.json()
            if resp.status_code != 200:
                logger.error(f"OpenAI error: {data}")
                return "I'm having trouble connecting right now. Please try again in a moment."
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"OpenAI request error: {e}")
        return "I'm having trouble connecting right now. Please try again in a moment."


# ================== ADS HELPERS ==================

async def validate_meta_credentials(access_token: str, ad_account_id: str) -> dict:
    """Validate a Meta access token + ad account. Returns account info dict."""
    clean_id = ad_account_id if ad_account_id.startswith('act_') else f"act_{ad_account_id}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/v19.0/{clean_id}",
                params={"access_token": access_token, "fields": "name,account_status,currency"},
            )
            data = resp.json()
            if "error" in data:
                raise HTTPException(status_code=400, detail=f"Meta error: {data['error'].get('message', 'Invalid token or ad account ID')}")
            return {"name": data.get("name", "Meta Ad Account"), "ad_account_id": clean_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not reach Meta API: {str(e)}")

async def validate_tiktok_credentials(access_token: str, advertiser_id: str) -> dict:
    """Validate a TikTok access token + advertiser ID. Returns account info dict."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://business-api.tiktok.com/open_api/v1.3/advertiser/info/",
                headers={"Access-Token": access_token},
                params={"advertiser_ids": json.dumps([advertiser_id])},
            )
            data = resp.json()
            if data.get("code") != 0:
                raise HTTPException(status_code=400, detail=f"TikTok error: {data.get('message', 'Invalid token or advertiser ID')}")
            ads_list = data.get("data", {}).get("list", [])
            if not ads_list:
                raise HTTPException(status_code=400, detail="TikTok advertiser ID not found or no access")
            return {"name": ads_list[0].get("advertiser_name", "TikTok Ad Account")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not reach TikTok API: {str(e)}")

async def launch_meta_campaign(campaign_id: str, campaign: dict, store: dict = {}) -> Optional[str]:
    """Launch a campaign on Meta using store or global credentials."""
    access_token = store.get('meta_access_token') or META_ACCESS_TOKEN
    ad_account_id = store.get('meta_ad_account_id') or (f"act_{META_AD_ACCOUNT_ID}" if META_AD_ACCOUNT_ID else '')
    if not access_token or not ad_account_id:
        logger.info(f"[ADS STUB] Meta campaign {campaign_id} — no credentials configured")
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            cr = await client.post(
                f"https://graph.facebook.com/v19.0/{ad_account_id}/campaigns",
                params={"access_token": access_token},
                json={
                    "name": campaign.get("ad_headline", f"CartY-{campaign_id[:8]}"),
                    "objective": {"traffic": "LINK_CLICKS", "awareness": "REACH", "sales": "CONVERSIONS"}.get(campaign.get("objective", "traffic"), "LINK_CLICKS"),
                    "status": "ACTIVE",
                    "special_ad_categories": [],
                }
            )
            if cr.status_code != 200:
                logger.error(f"Meta campaign creation failed: {cr.text}")
                return None
            return cr.json().get("id")
    except Exception as e:
        logger.error(f"Meta launch error: {e}")
        return None

async def launch_tiktok_campaign(campaign_id: str, campaign: dict, store: dict = {}) -> Optional[str]:
    """Launch a campaign on TikTok using store or global credentials."""
    access_token = store.get('tiktok_access_token') or TIKTOK_ACCESS_TOKEN
    advertiser_id = store.get('tiktok_advertiser_id') or TIKTOK_ADVERTISER_ID
    if not access_token or not advertiser_id:
        logger.info(f"[ADS STUB] TikTok campaign {campaign_id} — no credentials configured")
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            cr = await client.post(
                "https://business-api.tiktok.com/open_api/v1.3/campaign/create/",
                headers={"Access-Token": access_token, "Content-Type": "application/json"},
                json={
                    "advertiser_id": advertiser_id,
                    "campaign_name": campaign.get("ad_headline", f"CartY-{campaign_id[:8]}"),
                    "objective_type": {"traffic": "TRAFFIC", "awareness": "REACH", "sales": "CONVERSIONS"}.get(campaign.get("objective", "traffic"), "TRAFFIC"),
                    "budget_mode": "BUDGET_MODE_TOTAL",
                    "budget": campaign.get("budget_ngn", 0) / 100,
                }
            )
            if cr.status_code != 200:
                logger.error(f"TikTok campaign creation failed: {cr.text}")
                return None
            return str(cr.json().get("data", {}).get("campaign_id", ""))
    except Exception as e:
        logger.error(f"TikTok launch error: {e}")
        return None

async def _finalize_ad_payment(campaign_id: str, reference: str):
    """Called after payment succeeds: update campaign status and attempt launch."""
    campaign = one(await db(lambda: supabase.table('ad_campaigns').select('*').eq('id', campaign_id).limit(1).execute()))
    if not campaign:
        return
    await db(lambda: supabase.table('ad_campaigns').update({
        "status": "paid", "payment_reference": reference
    }).eq('id', campaign_id).execute())

    platform = campaign.get('platform', 'meta')
    platform_id = None
    if platform == 'meta':
        platform_id = await launch_meta_campaign(campaign_id, campaign)
    elif platform == 'tiktok':
        platform_id = await launch_tiktok_campaign(campaign_id, campaign)

    if platform_id:
        await db(lambda: supabase.table('ad_campaigns').update({
            "status": "active", "platform_campaign_id": platform_id
        }).eq('id', campaign_id).execute())
    else:
        await db(lambda: supabase.table('ad_campaigns').update({"status": "paid"}).eq('id', campaign_id).execute())

async def _launch_campaign_bg(campaign_id: str, store: dict):
    """Background task: launch campaign using store's own ad account credentials."""
    campaign = one(await db(lambda: supabase.table('ad_campaigns').select('*').eq('id', campaign_id).limit(1).execute()))
    if not campaign:
        return
    platform = campaign.get('platform', 'meta')
    platform_id = None
    if platform == 'meta':
        platform_id = await launch_meta_campaign(campaign_id, campaign, store)
    elif platform == 'tiktok':
        platform_id = await launch_tiktok_campaign(campaign_id, campaign, store)

    if platform_id:
        await db(lambda: supabase.table('ad_campaigns').update({
            "status": "active", "platform_campaign_id": platform_id
        }).eq('id', campaign_id).execute())
        logger.info(f"[Ads] Campaign {campaign_id} launched on {platform}: {platform_id}")
    else:
        await db(lambda: supabase.table('ad_campaigns').update({"status": "failed"}).eq('id', campaign_id).execute())
        logger.error(f"[Ads] Campaign {campaign_id} failed to launch on {platform}")


# ================== AUTH ==================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = one(await db(lambda: supabase.table('users').select('id').eq('phone', data.phone).limit(1).execute()))
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    result = await db(lambda: supabase.table('users').insert({
        "phone": data.phone,
        "password_hash": hash_password(data.password),
        "country": data.country.upper(),
        "state": data.state,
        "is_phone_verified": False,
    }).execute())
    user = result.data[0]
    # Send OTP but never let failures block account creation
    sms_sent = False
    try:
        code = generate_otp()
        await store_otp(data.phone, code, 'verify_phone')
        sms_sent = await send_sms_otp(data.phone, code, 'verify_phone')
    except Exception as otp_err:
        logger.error(f"[register] OTP step failed for {data.phone}: {otp_err}")
    return {"token": create_token(user['id']), "user_id": user['id'], "phone": user['phone'], "sms_sent": sms_sent}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = one(await db(lambda: supabase.table('users').select('*').eq('phone', data.phone).limit(1).execute()))
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user['id']), "user_id": user['id'], "phone": user['phone']}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id,slug').eq('user_id', user['id']).limit(1).execute()))
    return {
        "user_id": user['id'],
        "phone": user['phone'],
        "country": user.get('country', 'NG'),
        "state": user.get('state', ''),
        "has_store": store is not None,
        "store_id": store['id'] if store else None,
        "store_slug": store['slug'] if store else None,
        "phone_verified": user.get('is_phone_verified', False),
    }


@api_router.post("/auth/send-otp")
async def send_otp_endpoint(req: SendOtpRequest):
    phone = req.phone.strip()
    if req.purpose not in ('verify_phone', 'forgot_password'):
        raise HTTPException(status_code=400, detail="Invalid purpose")
    if req.purpose == 'forgot_password':
        user = one(await db(lambda: supabase.table('users').select('id').eq('phone', phone).limit(1).execute()))
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this phone number")
    code = generate_otp()
    await store_otp(phone, code, req.purpose)
    sent = await send_sms_otp(phone, code, req.purpose)
    if not sent:
        raise HTTPException(status_code=503, detail="Could not send SMS. Check your phone number or try again later.")
    return {"message": "OTP sent successfully"}

@api_router.post("/auth/verify-phone")
async def verify_phone_endpoint(req: VerifyPhoneRequest, current_user=Depends(get_current_user)):
    valid = await verify_otp_code(current_user['phone'], req.code, 'verify_phone')
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await db(lambda: supabase.table('users').update({'is_phone_verified': True}).eq('id', current_user['id']).execute())
    return {"message": "Phone verified successfully"}

@api_router.post("/auth/reset-password")
async def reset_password_endpoint(req: ResetPasswordRequest):
    phone = req.phone.strip()
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    valid = await verify_otp_code(phone, req.code, 'forgot_password')
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user = one(await db(lambda: supabase.table('users').select('id').eq('phone', phone).limit(1).execute()))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db(lambda: supabase.table('users').update({'password_hash': hash_password(req.new_password)}).eq('id', user['id']).execute())
    return {"message": "Password reset successfully"}

@api_router.put("/notifications/register")
async def register_push_token(data: PushTokenRequest, user=Depends(get_current_user)):
    await db(lambda: supabase.table('users').update({'push_token': data.push_token}).eq('id', user['id']).execute())
    return {"status": "ok"}


# ================== SUPPORT CHAT ==================

@api_router.post("/support/chat")
async def support_chat(data: SupportChatRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))

    context_parts = [
        f"- Phone: {user.get('phone', 'N/A')}",
        f"- Country: {user.get('country', 'NG')}",
        f"- Phone verified: {'Yes' if user.get('is_phone_verified') else 'No'}",
    ]

    if store:
        # Fetch order count and product count for richer context
        orders_res = await db(lambda: supabase.table('orders').select('id', count='exact').eq('store_id', store['id']).execute())
        paid_orders_res = await db(lambda: supabase.table('orders').select('id', count='exact').eq('store_id', store['id']).eq('status', 'paid').execute())
        products_res = await db(lambda: supabase.table('products').select('id', count='exact').eq('store_id', store['id']).execute())
        active_products_res = await db(lambda: supabase.table('products').select('id', count='exact').eq('store_id', store['id']).eq('is_active', True).execute())

        sub_status = store.get('subscription_status', 'inactive')
        sub_expires = store.get('subscription_expires_at', 'N/A')
        bank_linked = bool(store.get('bank_recipient_code') or store.get('bank_account_number'))

        context_parts += [
            f"- Store name: {store.get('name', 'N/A')}",
            f"- Store slug: {store.get('slug', 'N/A')} (storefront URL: carty.app/{store.get('slug', '')})",
            f"- Subscription status: {sub_status}",
            f"- Subscription expires: {sub_expires}",
            f"- Wallet balance: ₦{store.get('wallet_balance', 0):,.2f}",
            f"- Pending balance (not yet withdrawable): ₦{store.get('pending_balance', 0):,.2f}",
            f"- Total lifetime earnings: ₦{store.get('total_earnings', 0):,.2f}",
            f"- Bank account linked: {'Yes' if bank_linked else 'No'}",
            f"- Bank name: {store.get('bank_name', 'Not linked')}",
            f"- Total orders: {orders_res.count or 0} ({paid_orders_res.count or 0} paid)",
            f"- Total products: {products_res.count or 0} ({active_products_res.count or 0} active)",
            f"- WhatsApp number: {store.get('whatsapp_number', 'Not set')}",
        ]
    else:
        context_parts.append("- Store: Not created yet")

    messages = [{"role": m.role, "content": m.content} for m in data.messages]
    reply = await openai_chat(messages, "\n".join(context_parts))
    return {"message": reply}


# ================== ADS ==================

@api_router.get("/ads/connected-accounts")
async def get_connected_ad_accounts(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('meta_ad_account_id,tiktok_advertiser_id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return {
        "meta": {"connected": bool(store.get('meta_ad_account_id')), "ad_account_id": store.get('meta_ad_account_id')},
        "tiktok": {"connected": bool(store.get('tiktok_advertiser_id')), "advertiser_id": store.get('tiktok_advertiser_id')},
    }

@api_router.post("/ads/connect/meta")
async def connect_meta_account(data: MetaConnectRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    account_info = await validate_meta_credentials(data.access_token, data.ad_account_id)
    clean_id = data.ad_account_id if data.ad_account_id.startswith('act_') else f"act_{data.ad_account_id}"
    await db(lambda: supabase.table('stores').update({
        'meta_access_token': data.access_token,
        'meta_ad_account_id': clean_id,
    }).eq('id', store['id']).execute())
    return {"connected": True, "account_name": account_info.get("name", "Meta Ad Account"), "ad_account_id": clean_id}

@api_router.delete("/ads/connect/meta")
async def disconnect_meta_account(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await db(lambda: supabase.table('stores').update({'meta_access_token': None, 'meta_ad_account_id': None}).eq('id', store['id']).execute())
    return {"connected": False}

@api_router.post("/ads/connect/tiktok")
async def connect_tiktok_account(data: TikTokConnectRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    account_info = await validate_tiktok_credentials(data.access_token, data.advertiser_id)
    await db(lambda: supabase.table('stores').update({
        'tiktok_access_token': data.access_token,
        'tiktok_advertiser_id': data.advertiser_id,
    }).eq('id', store['id']).execute())
    return {"connected": True, "account_name": account_info.get("name", "TikTok Ad Account"), "advertiser_id": data.advertiser_id}

@api_router.delete("/ads/connect/tiktok")
async def disconnect_tiktok_account(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await db(lambda: supabase.table('stores').update({'tiktok_access_token': None, 'tiktok_advertiser_id': None}).eq('id', store['id']).execute())
    return {"connected": False}

@api_router.post("/ads")
async def create_ad_campaign(data: AdCampaignCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if data.platform not in ('meta', 'tiktok'):
        raise HTTPException(status_code=400, detail="Platform must be 'meta' or 'tiktok'")
    if data.platform == 'meta' and not store.get('meta_access_token'):
        raise HTTPException(status_code=400, detail="Connect your Meta Ads account first in the Ads tab")
    if data.platform == 'tiktok' and not store.get('tiktok_access_token'):
        raise HTTPException(status_code=400, detail="Connect your TikTok Ads account first in the Ads tab")
    result = await db(lambda: supabase.table('ad_campaigns').insert({
        "store_id": store['id'],
        "platform": data.platform,
        "objective": data.objective,
        "status": "launching",
        "budget_ngn": data.budget_ngn,
        "actual_budget_ngn": data.budget_ngn,
        "ad_headline": data.ad_headline,
        "ad_description": data.ad_description,
        "ad_image": data.ad_image,
        "target_age_min": data.target_age_min,
        "target_age_max": data.target_age_max,
        "target_gender": data.target_gender,
        "target_locations": data.target_locations,
        "start_date": data.start_date,
        "end_date": data.end_date,
    }).execute())
    campaign = result.data[0]
    # Launch campaign via platform API in background
    background_tasks.add_task(_launch_campaign_bg, campaign['id'], dict(store))
    return {"campaign": campaign, "message": "Campaign is being launched on your ad account."}

@api_router.get("/ads")
async def list_ad_campaigns(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    campaigns = many(await db(lambda: supabase.table('ad_campaigns').select('*').eq('store_id', store['id']).order('created_at', desc=True).execute()))
    return campaigns

@api_router.get("/ads/{campaign_id}")
async def get_ad_campaign(campaign_id: str, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    campaign = one(await db(lambda: supabase.table('ad_campaigns').select('*').eq('id', campaign_id).eq('store_id', store['id']).limit(1).execute()))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    analytics = many(await db(lambda: supabase.table('ad_analytics').select('*').eq('campaign_id', campaign_id).order('date', desc=True).execute()))
    totals = {"impressions": sum(a.get('impressions', 0) for a in analytics),
              "clicks": sum(a.get('clicks', 0) for a in analytics),
              "reach": sum(a.get('reach', 0) for a in analytics),
              "spend_ngn": sum(a.get('spend_ngn', 0) for a in analytics)}
    totals["ctr"] = round((totals["clicks"] / totals["impressions"] * 100), 2) if totals["impressions"] > 0 else 0
    return {"campaign": campaign, "analytics": analytics, "totals": totals}

@api_router.post("/ads/charge-card")
async def charge_ad_card(data: AdCardChargeRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    campaign = one(await db(lambda: supabase.table('ad_campaigns').select('*').eq('id', data.campaign_id).eq('store_id', store['id']).limit(1).execute()))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.get('status') != 'draft':
        raise HTTPException(status_code=400, detail="Campaign already paid")
    reference = f"ad_{uuid.uuid4().hex[:12]}"
    phone = user.get('phone', 'user')
    email = f"{phone}@carty.store"
    amount_kobo = int(campaign['budget_ngn'] * 100)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"email": email, "amount": amount_kobo, "reference": reference,
                      "card": {"number": data.card_number.replace(" ", ""), "cvv": data.cvv,
                               "expiry_month": data.expiry_month, "expiry_year": data.expiry_year}},
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=400, detail=pdata.get("message", "Card charge failed"))
    charge_status = pdata["data"]["status"]
    if charge_status == "success":
        background_tasks.add_task(_finalize_ad_payment, data.campaign_id, reference)
        return {"status": "success", "message": "Ad campaign funded! Our team will launch it shortly."}
    if charge_status in ("send_otp", "send_pin", "send_phone"):
        return {"status": charge_status, "reference": reference, "campaign_id": data.campaign_id,
                "display_text": pdata["data"].get("display_text", "Enter the OTP sent to your phone")}
    if charge_status == "open_url":
        return {"status": "open_url", "url": pdata["data"].get("url"), "reference": reference}
    raise HTTPException(status_code=400, detail=pdata["data"].get("gateway_response", "Payment failed"))

@api_router.post("/ads/submit-otp")
async def submit_ad_otp(data: AdOtpRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge/submit_otp",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"otp": data.otp, "reference": data.reference},
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=400, detail=pdata.get("message", "OTP verification failed"))
    if pdata["data"]["status"] == "success":
        background_tasks.add_task(_finalize_ad_payment, data.campaign_id, data.reference)
        return {"status": "success", "message": "Ad campaign funded! Our team will launch it shortly."}
    return {"status": "failed", "message": pdata["data"].get("gateway_response", "OTP verification failed")}


# ================== STORE ==================

@api_router.post("/stores")
async def create_store(data: StoreCreate, user=Depends(get_current_user)):
    if one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute())):
        raise HTTPException(status_code=400, detail="You already have a store")

    base_slug = generate_slug(data.name)
    slug, counter = base_slug, 1
    while one(await db(lambda: supabase.table('stores').select('id').eq('slug', slug).limit(1).execute())):
        slug = f"{base_slug}-{counter}"
        counter += 1

    result = await db(lambda: supabase.table('stores').insert({
        "user_id": user['id'], "name": data.name, "slug": slug,
        "logo": data.logo, "whatsapp_number": data.whatsapp_number, "email": data.email,
        "wallet_balance": 0, "pending_balance": 0, "total_earnings": 0,
        "subscription_status": "inactive",
    }).execute())
    return {"store": result.data[0], "slug": slug}

@api_router.get("/stores/my-store")
async def get_my_store(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store

@api_router.put("/stores/my-store")
async def update_my_store(data: StoreUpdate, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        await db(lambda: supabase.table('stores').update(update_data).eq('id', store['id']).execute())
    updated = one(await db(lambda: supabase.table('stores').select('*').eq('id', store['id']).limit(1).execute()))
    return updated

@api_router.get("/stores/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    completed = many(await db(lambda: supabase.table('orders').select('total_amount').eq('store_id', store['id']).eq('status', 'completed').execute()))
    recent = many(await db(lambda: supabase.table('orders').select('*').eq('store_id', store['id']).order('created_at', desc=True).limit(5).execute()))
    prod_result = await db(lambda: supabase.table('products').select('id', count='exact').eq('store_id', store['id']).execute())
    return {
        "total_orders": len(completed),
        "total_sales": sum(o['total_amount'] for o in completed),
        "wallet_balance": store.get("wallet_balance", 0),
        "pending_balance": store.get("pending_balance", 0),
        "total_earnings": store.get("total_earnings", 0),
        "products_count": prod_result.count or 0,
        "subscription_status": store.get("subscription_status", "inactive"),
        "subscription_end_date": store.get("subscription_end_date"),
        "recent_orders": recent,
        "store_slug": store.get("slug")
    }


# ================== PRODUCTS ==================

@api_router.post("/products")
async def create_product(data: ProductCreate, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    result = await db(lambda: supabase.table('products').insert({
        "store_id": store['id'], "name": data.name, "description": data.description,
        "price": data.price, "image": data.image, "is_active": True,
    }).execute())
    return result.data[0]

@api_router.get("/products")
async def get_products(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return many(await db(lambda: supabase.table('products').select('*').eq('store_id', store['id']).order('created_at', desc=True).execute()))

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    product = one(await db(lambda: supabase.table('products').select('id').eq('id', product_id).eq('store_id', store['id']).limit(1).execute()))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        await db(lambda: supabase.table('products').update(update_data).eq('id', product_id).execute())
    return one(await db(lambda: supabase.table('products').select('*').eq('id', product_id).limit(1).execute()))

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await db(lambda: supabase.table('products').delete().eq('id', product_id).eq('store_id', store['id']).execute())
    return {"message": "Product deleted"}


# ================== STOREFRONT ==================

@api_router.get("/storefront/{slug}")
async def get_storefront(slug: str):
    store = one(await db(lambda: supabase.table('stores').select('id,name,slug,logo,whatsapp_number,subscription_status').eq('slug', slug).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    products = many(await db(lambda: supabase.table('products').select('*').eq('store_id', store['id']).eq('is_active', True).execute()))
    return {
        "store": {k: store[k] for k in ('name', 'slug', 'logo', 'whatsapp_number', 'subscription_status')},
        "products": products
    }

@api_router.post("/storefront/{slug}/checkout")
async def checkout(slug: str, data: CheckoutRequest, background_tasks: BackgroundTasks, request: Request):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('slug', slug).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.get("subscription_status") != "active":
        return {"status": "subscription_required", "message": "This store is not accepting payments.", "whatsapp_link": f"https://wa.me/{store.get('whatsapp_number','')}"}

    total_amount, order_items = 0, []
    for item in data.cart_items:
        product = one(await db(lambda: supabase.table('products').select('*').eq('id', item.product_id).eq('is_active', True).limit(1).execute()))
        if not product:
            raise HTTPException(status_code=400, detail=f"Product not found: {item.product_id}")
        item_total = product["price"] * item.quantity
        total_amount += item_total
        order_items.append({"product_id": product["id"], "name": product["name"], "quantity": item.quantity, "price": item_total})

    reference = f"carty_{uuid.uuid4().hex[:12]}"
    order_result = await db(lambda: supabase.table('orders').insert({
        "store_id": store["id"], "buyer_name": data.buyer_name, "buyer_phone": data.buyer_phone,
        "buyer_address": data.buyer_address, "buyer_note": data.buyer_note,
        "items": order_items, "total_amount": total_amount, "payment_reference": reference, "status": "pending",
    }).execute())
    order_id = order_result.data[0]['id']

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/transaction/initialize",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"email": f"{data.buyer_phone}@carty.store", "amount": int(total_amount * 100), "reference": reference,
                      "callback_url": f"{get_public_base_url(request)}/store/{slug}/payment"}
            )
            pdata = resp.json()
            if not pdata.get("status"):
                raise HTTPException(status_code=500, detail="Payment initialization failed")
            return {"status": "success", "authorization_url": pdata["data"]["authorization_url"], "reference": reference, "order_id": order_id, "total": total_amount}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail="Payment service unavailable")

@api_router.get("/storefront/{slug}/verify/{reference}")
async def verify_payment(slug: str, reference: str, background_tasks: BackgroundTasks):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('slug', slug).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    order = one(await db(lambda: supabase.table('orders').select('*').eq('payment_reference', reference).limit(1).execute()))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] == "completed":
        return {"status": "success", "message": "Payment already verified"}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.paystack.co/transaction/verify/{reference}", headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            data = resp.json()
            if data.get("status") and data["data"]["status"] == "success":
                await db(lambda: supabase.table('orders').update({"status": "completed", "paid_at": datetime.utcnow().isoformat()}).eq('id', order['id']).execute())
                cur = one(await db(lambda: supabase.table('stores').select('wallet_balance,total_earnings').eq('id', store['id']).limit(1).execute()))
                await db(lambda: supabase.table('stores').update({
                    "wallet_balance": (cur['wallet_balance'] or 0) + order["total_amount"],
                    "total_earnings": (cur['total_earnings'] or 0) + order["total_amount"]
                }).eq('id', store['id']).execute())
                notif = {"order_id": order['id'][-6:].upper(), "buyer_name": order["buyer_name"], "buyer_phone": order["buyer_phone"], "buyer_address": order["buyer_address"], "buyer_note": order.get("buyer_note"), "items": order["items"], "total": order["total_amount"]}
                if store.get("email"):
                    background_tasks.add_task(send_order_email, store["email"], notif)
                return {"status": "success", "message": "Payment verified", "order_id": order['id'], "whatsapp_link": generate_whatsapp_link(store.get("whatsapp_number", ""), notif)}
            return {"status": "failed", "message": "Payment verification failed"}
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail="Verification service unavailable")

async def _complete_storefront_order(store: dict, order_id: str, order: dict, background_tasks: BackgroundTasks):
    await db(lambda: supabase.table('orders').update({"status": "completed", "paid_at": datetime.utcnow().isoformat()}).eq('id', order_id).execute())
    cur = one(await db(lambda: supabase.table('stores').select('wallet_balance,total_earnings').eq('id', store['id']).limit(1).execute()))
    await db(lambda: supabase.table('stores').update({
        "wallet_balance": (cur['wallet_balance'] or 0) + order["total_amount"],
        "total_earnings": (cur['total_earnings'] or 0) + order["total_amount"]
    }).eq('id', store['id']).execute())
    notif = {"order_id": order_id[-6:].upper(), "buyer_name": order["buyer_name"], "buyer_phone": order["buyer_phone"],
             "buyer_address": order["buyer_address"], "buyer_note": order.get("buyer_note"),
             "items": order["items"], "total": order["total_amount"]}
    if store.get("email"):
        background_tasks.add_task(send_order_email, store["email"], notif)
    return notif

@api_router.post("/storefront/{slug}/charge-card")
async def storefront_charge_card(slug: str, data: StorefrontCardChargeRequest, background_tasks: BackgroundTasks):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('slug', slug).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if store.get("subscription_status") != "active":
        return {"status": "subscription_required", "message": "This store is not accepting payments.", "whatsapp_link": f"https://wa.me/{store.get('whatsapp_number','')}"}
    total_amount, order_items = 0, []
    for item in data.cart_items:
        product = one(await db(lambda: supabase.table('products').select('*').eq('id', item.product_id).eq('is_active', True).limit(1).execute()))
        if not product:
            raise HTTPException(status_code=400, detail=f"Product not found: {item.product_id}")
        item_total = product["price"] * item.quantity
        total_amount += item_total
        order_items.append({"product_id": product["id"], "name": product["name"], "quantity": item.quantity, "price": item_total})
    reference = f"carty_{uuid.uuid4().hex[:12]}"
    order_result = await db(lambda: supabase.table('orders').insert({
        "store_id": store["id"], "buyer_name": data.buyer_name, "buyer_phone": data.buyer_phone,
        "buyer_address": data.buyer_address, "buyer_note": data.buyer_note,
        "items": order_items, "total_amount": total_amount, "payment_reference": reference, "status": "pending",
    }).execute())
    order_id = order_result.data[0]['id']
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={
                    "email": f"{data.buyer_phone}@carty.store",
                    "amount": int(total_amount * 100),
                    "reference": reference,
                    "card": {
                        "number": data.card_number.replace(" ", ""),
                        "cvv": data.cvv,
                        "expiry_month": data.expiry_month,
                        "expiry_year": data.expiry_year,
                    },
                }
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=500, detail="Payment failed")
    charge_status = pdata["data"]["status"]
    if charge_status == "success":
        order = {"total_amount": total_amount, "buyer_name": data.buyer_name, "buyer_phone": data.buyer_phone,
                 "buyer_address": data.buyer_address, "buyer_note": data.buyer_note, "items": order_items}
        notif = await _complete_storefront_order(store, order_id, order, background_tasks)
        return {"status": "success", "message": "Payment successful!", "order_id": order_id,
                "whatsapp_link": generate_whatsapp_link(store.get("whatsapp_number", ""), notif)}
    if charge_status in ("send_otp", "send_pin", "send_phone"):
        return {"status": charge_status, "reference": reference, "order_id": order_id,
                "display_text": pdata["data"].get("display_text", "Enter the OTP sent to your phone")}
    if charge_status == "open_url":
        return {"status": "open_url", "url": pdata["data"].get("url"), "reference": reference}
    return {"status": "failed", "message": pdata["data"].get("gateway_response", "Payment failed")}

@api_router.post("/storefront/{slug}/submit-otp")
async def storefront_submit_otp(slug: str, data: StorefrontOtpRequest, background_tasks: BackgroundTasks):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('slug', slug).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    order = one(await db(lambda: supabase.table('orders').select('*').eq('id', data.order_id).limit(1).execute()))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge/submit_otp",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"otp": data.otp, "reference": data.reference}
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=400, detail=pdata.get("message", "OTP failed"))
    charge_status = pdata["data"]["status"]
    if charge_status == "success":
        notif = await _complete_storefront_order(store, data.order_id, order, background_tasks)
        return {"status": "success", "message": "Payment successful!",
                "whatsapp_link": generate_whatsapp_link(store.get("whatsapp_number", ""), notif)}
    return {"status": "failed", "message": pdata["data"].get("gateway_response", "OTP verification failed")}


# ================== SUBSCRIPTION ==================

CURRENCY_MAP = {
    "NG": ("NGN", "₦"), "GH": ("GHS", "GH₵"), "KE": ("KES", "KSh"),
    "ZA": ("ZAR", "R"), "UG": ("UGX", "USh"), "TZ": ("TZS", "TSh"),
    "RW": ("RWF", "FRw"), "ET": ("ETB", "Br"), "EG": ("EGP", "E£"),
    "SN": ("XOF", "CFA"), "CI": ("XOF", "CFA"), "CM": ("XAF", "FCFA"),
    "ZM": ("ZMW", "ZK"), "US": ("USD", "$"), "GB": ("GBP", "£"),
    "CA": ("CAD", "C$"), "AU": ("AUD", "A$"), "DE": ("EUR", "€"),
    "FR": ("EUR", "€"), "IT": ("EUR", "€"), "ES": ("EUR", "€"),
    "IN": ("INR", "₹"), "AE": ("AED", "AED"), "SA": ("SAR", "SAR"),
}

@api_router.get("/subscription/price")
async def get_subscription_price(country: str = "NG"):
    price_ngn = SUBSCRIPTION_PRICE_NGN // 100  # kobo → naira
    currency_code, symbol = CURRENCY_MAP.get(country.upper(), ("USD", "$"))
    if currency_code == "NGN":
        return {"ngn_price": price_ngn, "local_price": price_ngn, "currency": "NGN", "symbol": "₦"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/NGN")
            rates = resp.json().get("rates", {})
            rate = rates.get(currency_code, 1.0)
            local_price = round(price_ngn * rate, 2)
    except Exception:
        local_price = price_ngn
        currency_code, symbol = "NGN", "₦"
    return {"ngn_price": price_ngn, "local_price": local_price, "currency": currency_code, "symbol": symbol}

@api_router.post("/subscription/initialize")
async def initialize_subscription(data: SubscribeRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    reference = f"sub_{uuid.uuid4().hex[:12]}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/transaction/initialize",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"email": data.email, "amount": SUBSCRIPTION_PRICE_NGN, "reference": reference}
            )
            pdata = resp.json()
            if not pdata.get("status"):
                raise HTTPException(status_code=500, detail="Subscription initialization failed")
        await db(lambda: supabase.table('pending_subscriptions').insert({"store_id": store['id'], "reference": reference, "email": data.email}).execute())
        return {"authorization_url": pdata["data"]["authorization_url"], "reference": reference}
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Subscription service unavailable")

@api_router.get("/subscription/verify/{reference}")
async def verify_subscription(reference: str, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.paystack.co/transaction/verify/{reference}", headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            data = resp.json()
            if data.get("status") and data["data"]["status"] == "success":
                end_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
                await db(lambda: supabase.table('stores').update({"subscription_status": "active", "subscription_end_date": end_date}).eq('id', store['id']).execute())
                await db(lambda: supabase.table('pending_subscriptions').delete().eq('reference', reference).execute())
                return {"status": "success", "message": "Subscription activated!", "end_date": end_date}
            return {"status": "failed", "message": "Subscription verification failed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Verification service unavailable")

async def _activate_subscription(store_id: str, reference: str):
    end_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
    await db(lambda: supabase.table('stores').update({"subscription_status": "active", "subscription_end_date": end_date}).eq('id', store_id).execute())
    await db(lambda: supabase.table('pending_subscriptions').delete().eq('reference', reference).execute())
    return end_date

@api_router.post("/subscription/charge-card")
async def charge_subscription_card(data: SubscriptionCardChargeRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    # Convert $7 USD → NGN at real-time rate, then → kobo
    try:
        async with httpx.AsyncClient(timeout=5.0) as fx:
            fx_resp = await fx.get("https://open.er-api.com/v6/latest/USD")
            ngn_rate = fx_resp.json().get("rates", {}).get("NGN", 1600.0)
    except Exception:
        ngn_rate = 1600.0
    amount_kobo = int(7 * ngn_rate * 100)
    reference = f"sub_{uuid.uuid4().hex[:12]}"
    phone = user.get('phone', 'user')
    email = f"{phone}@carty.store"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={
                    "email": email,
                    "amount": amount_kobo,
                    "reference": reference,
                    "card": {
                        "number": data.card_number.replace(" ", ""),
                        "cvv": data.cvv,
                        "expiry_month": data.expiry_month,
                        "expiry_year": data.expiry_year,
                    },
                }
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=400, detail=pdata.get("message", "Card charge failed"))
    await db(lambda: supabase.table('pending_subscriptions').insert({"store_id": store['id'], "reference": reference, "email": email}).execute())
    charge_status = pdata["data"]["status"]
    if charge_status == "success":
        await _activate_subscription(store['id'], reference)
        return {"status": "success", "message": "Subscription activated!"}
    if charge_status in ("send_otp", "send_pin", "send_phone"):
        return {"status": charge_status, "reference": reference, "display_text": pdata["data"].get("display_text", "Enter the OTP sent to your phone or email")}
    if charge_status == "open_url":
        return {"status": "open_url", "url": pdata["data"].get("url"), "reference": reference}
    raise HTTPException(status_code=400, detail=pdata["data"].get("gateway_response", "Payment failed"))

@api_router.post("/subscription/submit-otp")
async def submit_subscription_otp(data: OtpSubmitRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.paystack.co/charge/submit_otp",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"otp": data.otp, "reference": data.reference}
            )
            pdata = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Payment service unavailable")
    if not pdata.get("status"):
        raise HTTPException(status_code=400, detail=pdata.get("message", "OTP verification failed"))
    charge_status = pdata["data"]["status"]
    if charge_status == "success":
        await _activate_subscription(store['id'], data.reference)
        return {"status": "success", "message": "Subscription activated!"}
    return {"status": "failed", "message": pdata["data"].get("gateway_response", "OTP verification failed")}


# ================== WALLET ==================

@api_router.get("/wallet")
async def get_wallet(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    withdrawals = many(await db(lambda: supabase.table('withdrawals').select('*').eq('store_id', store['id']).order('created_at', desc=True).limit(10).execute()))
    return {
        "wallet_balance": store.get("wallet_balance", 0),
        "pending_balance": store.get("pending_balance", 0),
        "total_earnings": store.get("total_earnings", 0),
        "bank_name": store.get("bank_name"),
        "bank_account_number": store.get("bank_account_number"),
        "withdrawals": withdrawals
    }

COUNTRY_CODE_MAP = {
    "NG": "nigeria", "GH": "ghana", "KE": "kenya", "ZA": "south africa",
    "CI": "ivory coast", "EG": "egypt", "UG": "uganda", "TZ": "tanzania",
    "RW": "rwanda", "ZM": "zambia", "SN": "senegal", "ET": "ethiopia",
}

@api_router.get("/banks")
async def get_banks(country: str = "NG"):
    country_name = COUNTRY_CODE_MAP.get(country.upper(), country.lower())
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.paystack.co/bank?country={country_name}&use_cursor=false&perPage=100", headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            return resp.json().get("data", [])
    except Exception as e:
        logger.error(f"Banks fetch error: {e}")
        return []

@api_router.get("/wallet/verify-account")
async def verify_bank_account(bank_code: str = "", account_number: str = "", user=Depends(get_current_user)):
    if not bank_code or not account_number:
        raise HTTPException(status_code=400, detail="bank_code and account_number are required")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}", headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            data = resp.json()
            if not data.get("status"):
                raise HTTPException(status_code=400, detail="Could not verify account. Check account number and bank.")
            return {"account_name": data["data"]["account_name"], "account_number": data["data"]["account_number"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Account verification service unavailable")

@api_router.post("/wallet/setup-bank")
async def setup_bank_account(user=Depends(get_current_user), bank_code: str = "", account_number: str = "", bank_name: str = ""):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    try:
        async with httpx.AsyncClient() as client:
            vr = await client.get(f"https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}", headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            vdata = vr.json()
            if not vdata.get("status"):
                raise HTTPException(status_code=400, detail="Invalid account number")
            account_name = vdata["data"]["account_name"]

            rr = await client.post("https://api.paystack.co/transferrecipient",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"type": "nuban", "name": account_name, "account_number": account_number, "bank_code": bank_code, "currency": "NGN"})
            rdata = rr.json()
            if not rdata.get("status"):
                raise HTTPException(status_code=400, detail="Failed to setup bank account")

        await db(lambda: supabase.table('stores').update({
            "bank_name": bank_name, "bank_code": bank_code,
            "bank_account_number": account_number, "bank_account_name": account_name,
            "recipient_code": rdata["data"]["recipient_code"]
        }).eq('id', store['id']).execute())
        return {"status": "success", "account_name": account_name, "bank_name": bank_name, "account_number": account_number}
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Bank setup service unavailable")

@api_router.post("/wallet/withdraw")
async def request_withdrawal(data: WithdrawalRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if not store.get("recipient_code"):
        raise HTTPException(status_code=400, detail="Please setup your bank account first")
    if data.amount > store.get("wallet_balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    if data.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is ₦100")

    reference = f"wd_{uuid.uuid4().hex[:12]}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://api.paystack.co/transfer",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"source": "balance", "amount": int(data.amount * 100), "recipient": store["recipient_code"], "reason": "CartY Withdrawal", "reference": reference})
            tdata = resp.json()

        await db(lambda: supabase.table('withdrawals').insert({"store_id": store['id'], "amount": data.amount, "reference": reference, "status": "pending"}).execute())

        if tdata.get("status"):
            await db(lambda: supabase.table('stores').update({"wallet_balance": store["wallet_balance"] - data.amount}).eq('id', store['id']).execute())
            token = user.get('push_token')
            if token:
                asyncio.create_task(send_push_notification(token, "Withdrawal Processing", f"₦{data.amount:,.0f} withdrawal is on its way to your bank.", {"screen": "wallet"}))
            return {"status": "success", "message": "Withdrawal initiated", "reference": reference}
        else:
            await db(lambda: supabase.table('withdrawals').update({"status": "failed"}).eq('reference', reference).execute())
            raise HTTPException(status_code=500, detail="Withdrawal failed")
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Withdrawal service unavailable")


@api_router.post("/wallet/unlink-bank")
async def unlink_bank(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await db(lambda: supabase.table('stores').update({
        "bank_name": None, "bank_code": None,
        "bank_account_number": None, "bank_account_name": None,
        "recipient_code": None
    }).eq('id', store['id']).execute())
    return {"status": "success"}

@api_router.post("/wallet/transfer")
async def transfer_to_bank(data: TransferRequest, user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('*').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if data.amount > store.get("wallet_balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    if data.amount < 100:
        raise HTTPException(status_code=400, detail="Minimum transfer is ₦100")

    reference = f"tr_{uuid.uuid4().hex[:12]}"
    try:
        async with httpx.AsyncClient() as client:
            # Verify account
            vr = await client.get(
                f"https://api.paystack.co/bank/resolve?account_number={data.account_number}&bank_code={data.bank_code}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"})
            vdata = vr.json()
            if not vdata.get("status"):
                raise HTTPException(status_code=400, detail="Invalid account number or bank")
            account_name = vdata["data"]["account_name"]

            # Create transfer recipient
            rr = await client.post("https://api.paystack.co/transferrecipient",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"type": "nuban", "name": account_name, "account_number": data.account_number,
                      "bank_code": data.bank_code, "currency": "NGN"})
            rdata = rr.json()
            if not rdata.get("status"):
                raise HTTPException(status_code=400, detail="Failed to create transfer recipient")
            recipient_code = rdata["data"]["recipient_code"]

            # Initiate transfer
            tr = await client.post("https://api.paystack.co/transfer",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"source": "balance", "amount": int(data.amount * 100), "recipient": recipient_code,
                      "reason": f"CartY Transfer to {account_name}", "reference": reference})
            tdata = tr.json()

        await db(lambda: supabase.table('withdrawals').insert({
            "store_id": store['id'], "amount": data.amount,
            "reference": reference, "status": "pending"
        }).execute())

        if tdata.get("status"):
            await db(lambda: supabase.table('stores').update({
                "wallet_balance": store["wallet_balance"] - data.amount
            }).eq('id', store['id']).execute())
            return {"status": "success", "account_name": account_name, "reference": reference}
        else:
            await db(lambda: supabase.table('withdrawals').update({"status": "failed"}).eq('reference', reference).execute())
            raise HTTPException(status_code=500, detail=tdata.get("message") or "Transfer failed")
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Transfer service unavailable")


# ================== ORDERS ==================

@api_router.get("/orders")
async def get_orders(user=Depends(get_current_user)):
    store = one(await db(lambda: supabase.table('stores').select('id').eq('user_id', user['id']).limit(1).execute()))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return many(await db(lambda: supabase.table('orders').select('*').eq('store_id', store['id']).order('created_at', desc=True).limit(100).execute()))


# ================== WEBHOOK ==================

@api_router.post("/webhooks/paystack")
async def paystack_webhook(request: Request):
    signature = request.headers.get("x-paystack-signature")
    body = await request.body()
    computed = hmac.new(PAYSTACK_SECRET_KEY.encode('utf-8'), body, hashlib.sha512).hexdigest()
    if signature != computed:
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = json.loads(body)
    event = data.get("event")
    logger.info(f"Webhook: {event}")

    if event == "charge.success":
        ref = data["data"].get("reference", "")
        if ref.startswith("carty_"):
            order = one(await db(lambda: supabase.table('orders').select('*').eq('payment_reference', ref).limit(1).execute()))
            if order and order["status"] != "completed":
                await db(lambda: supabase.table('orders').update({"status": "completed", "paid_at": datetime.utcnow().isoformat()}).eq('id', order['id']).execute())
                cur = one(await db(lambda: supabase.table('stores').select('wallet_balance,total_earnings').eq('id', order['store_id']).limit(1).execute()))
                if cur:
                    await db(lambda: supabase.table('stores').update({"wallet_balance": (cur['wallet_balance'] or 0) + order["total_amount"], "total_earnings": (cur['total_earnings'] or 0) + order["total_amount"]}).eq('id', order['store_id']).execute())
                # Push notification to seller
                token = await get_store_push_token(order['store_id'])
                if token:
                    asyncio.create_task(send_push_notification(token, "New Order Received!", f"{order['buyer_name']} paid ₦{order['total_amount']:,.0f}", {"screen": "orders"}))
        elif ref.startswith("sub_"):
            pending = one(await db(lambda: supabase.table('pending_subscriptions').select('*').eq('reference', ref).limit(1).execute()))
            if pending:
                end_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
                await db(lambda: supabase.table('stores').update({"subscription_status": "active", "subscription_end_date": end_date}).eq('id', pending['store_id']).execute())
                await db(lambda: supabase.table('pending_subscriptions').delete().eq('reference', ref).execute())
                token = await get_store_push_token(pending['store_id'])
                if token:
                    asyncio.create_task(send_push_notification(token, "Store Activated!", "Your store can now accept online payments.", {"screen": "dashboard"}))
        elif ref.startswith("ad_"):
            campaign = one(await db(lambda: supabase.table('ad_campaigns').select('*').eq('payment_reference', ref).limit(1).execute()))
            if campaign and campaign.get('status') == 'draft':
                await _finalize_ad_payment(campaign['id'], ref)

    elif event == "transfer.success":
        ref = data["data"].get("reference", "")
        w = one(await db(lambda: supabase.table('withdrawals').select('*').eq('reference', ref).limit(1).execute()))
        await db(lambda: supabase.table('withdrawals').update({"status": "success", "completed_at": datetime.utcnow().isoformat()}).eq('reference', ref).execute())
        if w:
            token = await get_store_push_token(w['store_id'])
            if token:
                asyncio.create_task(send_push_notification(token, "Withdrawal Successful!", f"₦{w['amount']:,.0f} has been sent to your bank.", {"screen": "wallet"}))

    elif event == "transfer.failed":
        ref = data["data"].get("reference", "")
        w = one(await db(lambda: supabase.table('withdrawals').select('*').eq('reference', ref).limit(1).execute()))
        if w:
            cur = one(await db(lambda: supabase.table('stores').select('wallet_balance').eq('id', w['store_id']).limit(1).execute()))
            if cur:
                await db(lambda: supabase.table('stores').update({"wallet_balance": (cur['wallet_balance'] or 0) + w['amount']}).eq('id', w['store_id']).execute())
            await db(lambda: supabase.table('withdrawals').update({"status": "failed"}).eq('reference', ref).execute())
            token = await get_store_push_token(w['store_id'])
            if token:
                asyncio.create_task(send_push_notification(token, "Withdrawal Failed", f"₦{w['amount']:,.0f} withdrawal failed. Funds returned to wallet.", {"screen": "wallet"}))

    return {"status": "ok"}


# ================== WEB STOREFRONT ==================

def _h(value) -> str:
    """HTML-escape a value for safe embedding in HTML."""
    return _html.escape(str(value or ''), quote=True)

_NOT_FOUND_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Store Not Found | CartY</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;color:#111827}
    .card{background:#fff;border-radius:20px;padding:40px 28px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
    .icon{font-size:64px;margin-bottom:14px}
    h1{font-size:22px;font-weight:700;margin-bottom:8px}
    p{font-size:14px;color:#6B7280;margin-bottom:24px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128683;</div>
    <h1>Store Not Found</h1>
    <p>This store does not exist or may have been removed.</p>
  </div>
</body>
</html>"""

_STOREFRONT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CARTY_STORE_NAME | CartY</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#111827}
    .header{background:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,.1);position:sticky;top:0;z-index:10}
    .logo-placeholder{width:46px;height:46px;border-radius:12px;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4F46E5;flex-shrink:0}
    .logo-img{width:46px;height:46px;border-radius:12px;object-fit:cover;flex-shrink:0}
    .store-name{font-size:18px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cart-btn{background:#4F46E5;color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;font-size:20px;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .cart-badge{position:absolute;top:-5px;right:-5px;background:#EF4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center}
    .inactive-banner{background:#FEF2F2;color:#B91C1C;padding:10px 18px;text-align:center;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:14px}
    @media(min-width:600px){.grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:900px){.grid{grid-template-columns:repeat(4,1fr)}}
    .card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07)}
    .prod-img{width:100%;aspect-ratio:1;object-fit:cover}
    .prod-ph{width:100%;aspect-ratio:1;background:#F3F4F6;display:flex;align-items:center;justify-content:center;font-size:40px}
    .prod-body{padding:10px}
    .prod-name{font-size:13px;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .prod-price{font-size:15px;font-weight:700;color:#4F46E5;margin-top:3px}
    .prod-desc{font-size:11px;color:#6B7280;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .add-btn{width:100%;padding:9px;background:#4F46E5;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;border-radius:0 0 12px 12px}
    .add-btn:active{background:#4338CA}
    .card-qty{display:none;align-items:center;justify-content:center;gap:16px;padding:10px 12px}
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50}
    .overlay.open{display:flex;align-items:flex-end}
    .sheet{background:#fff;border-radius:22px 22px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:20px}
    .sheet-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .sheet-title{font-size:19px;font-weight:700}
    .close-btn{background:none;border:none;font-size:22px;cursor:pointer;color:#9CA3AF;padding:4px}
    .ci{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #F3F4F6}
    .ci-name{flex:1;font-size:14px;font-weight:500}
    .ci-price{font-size:13px;color:#4F46E5;font-weight:600;white-space:nowrap}
    .qty-btn{background:#EEF2FF;color:#4F46E5;border:none;width:28px;height:28px;border-radius:50%;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .qty-n{font-size:14px;font-weight:600;min-width:18px;text-align:center}
    .total-row{display:flex;justify-content:space-between;padding:14px 0;border-top:2px solid #E5E7EB;font-size:17px;font-weight:700}
    .divider{border:none;border-top:1px solid #E5E7EB;margin:14px 0}
    .sec-title{font-size:15px;font-weight:700;margin-bottom:10px}
    .fg{margin-bottom:10px}
    .addr-row{display:flex;gap:10px}.addr-row>div{flex:1}
    label{font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;display:block}
    input,textarea{width:100%;padding:11px 13px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:15px;color:#111827;background:#F9FAFB;outline:none;font-family:inherit}
    input:focus,textarea:focus{border-color:#4F46E5;background:#fff}
    textarea{resize:none}
    .pay-btn{width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:6px}
    .pay-btn:disabled{background:#A5B4FC;cursor:not-allowed}
    .pay-btn:active{background:#4338CA}
    .empty{text-align:center;padding:60px 20px;color:#6B7280}
    .footer{text-align:center;color:#9CA3AF;font-size:11px;padding:20px}
  </style>
</head>
<body>
  CARTY_HEADER_HTML
  CARTY_INACTIVE_BANNER
  CARTY_GRID_HTML
  <div class="footer">Powered by CartY</div>
  <div class="overlay" id="overlay">
    <div class="sheet">
      <div class="sheet-header"><span class="sheet-title">Your Cart</span><button class="close-btn" onclick="closeCart()">&#x2715;</button></div>
      <div id="cartItems"></div>
      <div class="total-row"><span>Total</span><span id="cartTotal">&#x20A6;0</span></div>
      <hr class="divider">
      <div class="sec-title">Delivery Details</div>
      <div class="fg"><label>Full Name *</label><input id="bName" type="text" placeholder="Your full name"></div>
      <div class="fg"><label>Phone Number *</label><input id="bPhone" type="tel" placeholder="Your phone number"></div>
      <div class="fg"><label>Street Address *</label><input id="bStreet" type="text" placeholder="House no., street name"></div>
      <div class="fg addr-row"><div><label>City *</label><input id="bCity" type="text" placeholder="City"></div><div><label>State *</label><input id="bState" type="text" placeholder="State"></div></div>
      <div class="fg addr-row"><div><label>ZIP / Postal Code *</label><input id="bZip" type="text" placeholder="ZIP code"></div><div><label>Country *</label><input id="bCountry" type="text" placeholder="Country"></div></div>
      <div class="fg"><label>Note (optional)</label><input id="bNote" type="text" placeholder="Any special instructions?"></div>
      <hr class="divider">
      <div class="sec-title">Payment Details</div>
      <div class="fg"><label>Card Number *</label><input id="cNum" type="tel" placeholder="0000 0000 0000 0000" maxlength="19" oninput="fmtCard(this)"></div>
      <div class="fg addr-row"><div><label>Expiry *</label><input id="cExp" type="tel" placeholder="MM/YY" maxlength="5" oninput="fmtExp(this)"></div><div><label>CVV *</label><input id="cCvv" type="tel" placeholder="CVV" maxlength="4"></div></div>
      <button class="pay-btn" id="payBtn" onclick="doCheckout()">Pay Now</button>
    </div>
  </div>
  <script>
    var SLUG='CARTY_SLUG',prods=CARTY_PRODS_JSON,cart={};
    function N(n){return'\u20A6'+Number(n).toLocaleString()}
    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
    function fmtCard(el){var v=el.value.replace(/\D/g,'').slice(0,16);el.value=v.replace(/(\d{4})(?=\d)/g,'$1 ');}
    function fmtExp(el){var v=el.value.replace(/\D/g,'');if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2,4);el.value=v;}
    function add(id){cart[id]=(cart[id]||0)+1;updateUI();}
    function inc(id){cart[id]=(cart[id]||0)+1;updateUI();}
    function dec(id){if(cart[id]>1)cart[id]--;else delete cart[id];updateUI();}
    function chQty(id,d){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];updateUI();}
    function updateUI(){
      var tot=0,cnt=0;
      Object.keys(cart).forEach(function(id){var p=prods.find(function(x){return x.id===id});if(p){tot+=p.price*cart[id];cnt+=cart[id];}});
      var cb=document.getElementById('cb');
      if(cb){cb.style.display=cnt>0?'flex':'none';cb.textContent=cnt;}
      var te=document.getElementById('cartTotal');if(te)te.textContent=N(tot);
      prods.forEach(function(p){
        var card=document.querySelector('[data-pid="'+p.id+'"]');if(!card)return;
        var qty=cart[p.id]||0;
        var btn=card.querySelector('.add-btn');
        var qc=card.querySelector('.card-qty');
        var qn=card.querySelector('.card-qty-n');
        if(btn)btn.style.display=qty>0?'none':'';
        if(qc)qc.style.display=qty>0?'flex':'none';
        if(qn)qn.textContent=qty;
      });
      var ci=document.getElementById('cartItems');if(!ci)return;
      if(cnt===0){ci.innerHTML='<p style="color:#9CA3AF;text-align:center;padding:18px 0">Cart is empty</p>';return;}
      ci.innerHTML=Object.keys(cart).map(function(id){
        var p=prods.find(function(x){return x.id===id});if(!p)return'';
        return'<div class="ci" data-id="'+id+'">'
          +'<span class="ci-name">'+esc(p.name)+'</span>'
          +'<button class="qty-btn" data-a="-1">-</button>'
          +'<span class="qty-n">'+cart[id]+'</span>'
          +'<button class="qty-btn" data-a="1">+</button>'
          +'<span class="ci-price">'+N(p.price*cart[id])+'</span></div>';
      }).join('');
    }
    function openCart(){document.getElementById('overlay').classList.add('open');updateUI();}
    function closeCart(){document.getElementById('overlay').classList.remove('open');}
    function showSuccess(){
      document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb">'
        +'<div style="background:#fff;border-radius:20px;padding:40px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)">'
        +'<div style="font-size:64px">&#x2705;</div>'
        +'<h1 style="font-size:22px;font-weight:700;margin:14px 0 8px">Payment Successful!</h1>'
        +'<p style="color:#6B7280;margin-bottom:24px">Thank you! The seller will contact you soon.</p>'
        +'<a href="/store/'+SLUG+'" style="display:inline-block;padding:14px 28px;background:#4F46E5;color:#fff;border-radius:12px;text-decoration:none;font-weight:600">Continue Shopping</a>'
        +'</div></div>';
    }
    function showOtp(ref,orderId,msg){
      var sheet=document.querySelector('.sheet');
      sheet.innerHTML='<div style="padding:24px">'
        +'<h3 style="margin-bottom:8px;font-size:16px;font-weight:700">One More Step</h3>'
        +'<p style="color:#6B7280;margin-bottom:16px;font-size:14px">'+esc(msg)+'</p>'
        +'<input id="otpIn" type="tel" placeholder="Enter OTP" style="width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:12px 16px;font-size:16px;margin-bottom:12px;color:#111827;background:#F9FAFB;box-sizing:border-box">'
        +'<button onclick="submitOtp(\''+ref+'\',\''+orderId+'\')" style="width:100%;padding:15px;background:#4F46E5;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer">Submit OTP</button>'
        +'</div>';
    }
    async function submitOtp(ref,orderId){
      var otp=document.getElementById('otpIn').value.trim();
      if(!otp){alert('Please enter the OTP');return;}
      try{
        var r=await fetch('/api/storefront/'+SLUG+'/submit-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:ref,otp:otp,order_id:orderId})});
        var d=await r.json();
        if(d.status==='success'){showSuccess();}
        else{alert(d.message||'OTP verification failed. Please try again.');}
      }catch(e){alert('Error: '+e.message);}
    }
    document.addEventListener('DOMContentLoaded',function(){
      document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeCart();});
      document.getElementById('cartItems').addEventListener('click',function(e){
        var btn=e.target.closest('.qty-btn[data-a]');if(!btn)return;
        var ci=btn.closest('[data-id]');if(!ci)return;
        chQty(ci.dataset.id,parseInt(btn.dataset.a));
      });
    });
    async function doCheckout(){
      var name=document.getElementById('bName').value.trim();
      var phone=document.getElementById('bPhone').value.trim();
      var street=document.getElementById('bStreet').value.trim();
      var city=document.getElementById('bCity').value.trim();
      var state=document.getElementById('bState').value.trim();
      var zip=document.getElementById('bZip').value.trim();
      var country=document.getElementById('bCountry').value.trim();
      var note=document.getElementById('bNote').value.trim();
      var cardNum=document.getElementById('cNum').value.replace(/\s/g,'');
      var expRaw=document.getElementById('cExp').value;
      var cvv=document.getElementById('cCvv').value.trim();
      var expParts=expRaw.split('/');
      var expM=(expParts[0]||'').trim();
      var expY=(expParts[1]||'').trim();
      var expYFull=expY.length===2?'20'+expY:expY;
      if(!name||!phone||!street||!city||!state||!zip||!country){alert('Please fill in all delivery details');return;}
      if(cardNum.length<15||!expM||expY.length<2||cvv.length<3){alert('Please fill in all payment details');return;}
      if(!Object.keys(cart).length){alert('Your cart is empty');return;}
      var btn=document.getElementById('payBtn');btn.disabled=true;btn.textContent='Processing...';
      var addr=street+', '+city+', '+state+' '+zip+', '+country;
      try{
        var items=Object.keys(cart).map(function(id){return{product_id:id,quantity:cart[id]}});
        var r=await fetch('/api/storefront/'+SLUG+'/charge-card',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({buyer_name:name,buyer_phone:phone,buyer_address:addr,buyer_note:note||undefined,cart_items:items,card_number:cardNum,expiry_month:expM,expiry_year:expYFull,cvv:cvv})
        });
        var d=await r.json();
        if(d.status==='subscription_required'){alert('This store is not accepting payments. Contact seller via WhatsApp.');btn.disabled=false;btn.textContent='Pay Now';return;}
        if(d.status==='success'){showSuccess();return;}
        if(d.status==='send_otp'||d.status==='send_pin'||d.status==='send_phone'){showOtp(d.reference,d.order_id,d.display_text||'Enter the OTP sent to you');btn.disabled=false;btn.textContent='Pay Now';return;}
        if(d.status==='open_url'){window.location.href=d.url;return;}
        throw new Error(d.message||'Payment failed');
      }catch(e){alert('Error: '+e.message);btn.disabled=false;btn.textContent='Pay Now';}
    }
    updateUI();
  </script>
</body>
</html>"""

def _build_storefront_html(store: dict, products: list, slug: str) -> str:
    store_name_raw = (store.get('name') or '').strip() or 'Store'
    store_name_esc = _h(store_name_raw)
    logo_letter = _h(store_name_raw[0].upper())
    logo_html = (
        f'<img class="logo-img" src="{_h(store["logo"])}" alt="logo">'
        if store.get('logo')
        else f'<div class="logo-placeholder">{logo_letter}</div>'
    )
    header_html = (
        f'<div class="header">{logo_html}'
        f'<span class="store-name">{store_name_esc}</span>'
        f'<button class="cart-btn" onclick="openCart()">&#x1F6D2;'
        f'<span class="cart-badge" id="cb">0</span></button></div>'
    )
    inactive_banner = (
        '<div class="inactive-banner">&#9888;&#65039; This store is not currently accepting online payments.</div>'
        if store.get('subscription_status') != 'active'
        else ''
    )
    if products:
        cards = []
        for p in products:
            pid = str(p.get('id', ''))
            img_html = (
                f'<img class="prod-img" src="{_h(p["image"])}" alt="{_h(p.get("name", ""))}">'
                if p.get('image')
                else '<div class="prod-ph">&#x1F6CD;&#xFE0F;</div>'
            )
            desc_html = (
                f'<div class="prod-desc">{_h(p.get("description", ""))}</div>'
                if p.get('description') else ''
            )
            price_str = f"{p.get('price', 0):,.0f}"
            cards.append(
                f'<div class="card" data-pid="{pid}">{img_html}'
                f'<div class="prod-body">'
                f'<div class="prod-name">{_h(p.get("name", ""))}</div>'
                f'<div class="prod-price">&#x20A6;{price_str}</div>'
                f'{desc_html}</div>'
                f'<button class="add-btn" onclick="add(\'{pid}\')">Add to Cart</button>'
                f'<div class="card-qty">'
                f'<button class="qty-btn" onclick="dec(\'{pid}\')">&#8722;</button>'
                f'<span class="card-qty-n">1</span>'
                f'<button class="qty-btn" onclick="inc(\'{pid}\')">&#43;</button>'
                f'</div></div>'
            )
        grid_html = '<div class="grid">' + ''.join(cards) + '</div>'
    else:
        grid_html = '<div class="empty"><p style="font-size:40px">&#128230;</p><p style="font-weight:600;margin-top:12px">No products yet</p></div>'
    prods_data = [
        {'id': str(p.get('id', '')), 'name': p.get('name', ''), 'price': float(p.get('price', 0))}
        for p in products
    ]
    prods_json = json.dumps(prods_data, separators=(',', ':')).replace('</', r'<\/')
    return (
        _STOREFRONT_TEMPLATE
        .replace('CARTY_STORE_NAME', store_name_esc)
        .replace('CARTY_HEADER_HTML', header_html)
        .replace('CARTY_INACTIVE_BANNER', inactive_banner)
        .replace('CARTY_GRID_HTML', grid_html)
        .replace('CARTY_SLUG', slug)
        .replace('CARTY_PRODS_JSON', prods_json)
    )

PAYMENT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment | CartY</title>
  <style>
    *{{margin:0;padding:0;box-sizing:border-box}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}}
    .card{{background:#fff;border-radius:20px;padding:40px 28px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}}
    .icon{{font-size:64px;margin-bottom:14px}}
    h1{{font-size:22px;font-weight:700;margin-bottom:8px}}
    p{{font-size:14px;color:#6B7280;margin-bottom:24px;line-height:1.5}}
    a{{display:inline-block;padding:14px 28px;background:#4F46E5;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px}}
    .spinner{{width:36px;height:36px;border:4px solid #EEF2FF;border-top-color:#4F46E5;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px}}
    @keyframes spin{{to{{transform:rotate(360deg)}}}}
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="spinner"></div>
    <p>Verifying your payment...</p>
  </div>
  <script>
    var SLUG='{slug}',REF='{reference}';
    async function verify(){{
      if(!REF){{show('&#9888;&#65039;','Invalid Link','No payment reference found.','Back to Store');return;}}
      try{{
        var ctrl=new AbortController();
        var t=setTimeout(function(){{ctrl.abort();}},12000);
        var r=await fetch('/api/storefront/'+SLUG+'/verify/'+REF,{{signal:ctrl.signal}});
        clearTimeout(t);
        var d=await r.json();
        if(d.status==='success'){{show('&#x2705;','Payment Successful!','Thank you! The seller will contact you soon.','Continue Shopping');}}
        else{{show('&#x274C;','Payment Failed',d.message||'Something went wrong. Please try again.','Try Again');}}
      }}catch(e){{show('&#x274C;','Error',e.message||'Could not verify payment.','Try Again');}}
    }}
    function show(icon,title,msg,btn){{
      document.getElementById('card').innerHTML='<div class="icon">'+icon+'</div><h1>'+title+'</h1><p>'+msg+'</p>'
        +'<a href="/store/'+SLUG+'">'+btn+'</a>';
    }}
    verify();
  </script>
</body>
</html>"""

@app.get("/store/{slug}", response_class=HTMLResponse)
async def storefront_page(slug: str):
    store = one(await db(lambda: supabase.table('stores').select(
        'id,name,slug,logo,whatsapp_number,subscription_status'
    ).eq('slug', slug).limit(1).execute()))
    if not store:
        return HTMLResponse(_NOT_FOUND_HTML, status_code=404,
                            headers={"Cache-Control": "no-store"})
    products = many(await db(lambda: supabase.table('products').select('*').eq(
        'store_id', store['id']
    ).eq('is_active', True).execute()))
    html_content = _build_storefront_html(store, products, slug)
    return HTMLResponse(html_content,
                        headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

@app.get("/store/{slug}/payment", response_class=HTMLResponse)
async def payment_page(slug: str, reference: str = '', trxref: str = ''):
    ref = reference or trxref
    return HTMLResponse(PAYMENT_HTML.format(slug=slug, reference=ref),
                        headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


# ================== ROOT ==================

@api_router.get("/")
async def root():
    return {"message": "CartY API", "version": "1.0"}

@api_router.get("/version")
async def get_version():
    """Returns app version config from app_config table."""
    rows = many(await db(lambda: supabase.table('app_config').select('key,value').execute()))
    config = {r['key']: r['value'] for r in rows}
    return {
        "current_version": config.get("current_version", "1.0.0"),
        "min_version": config.get("min_version", "1.0.0"),
        "android_download_url": config.get("android_download_url", ""),
        "ios_download_url": config.get("ios_download_url", ""),
        "release_notes": config.get("release_notes", ""),
    }

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

@api_router.get("/support/test")
async def test_openai():
    """Diagnostic — open this URL in browser to verify OpenAI key works."""
    if not OPENAI_API_KEY:
        return {"ok": False, "reason": "OPENAI_API_KEY env var is not set on Railway"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Say: CartY test OK"}],
                    "max_tokens": 20,
                },
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"ok": True, "reply": data["choices"][0]["message"]["content"]}
            return {"ok": False, "http_status": resp.status_code, "error": data}
    except Exception as e:
        return {"ok": False, "reason": str(e)}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
