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
import urllib.parse
import html as _html
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
SUBSCRIPTION_PRICE_NGN = int(os.environ.get('SUBSCRIPTION_PRICE_NGN', 750000))

resend.api_key = RESEND_API_KEY

app = FastAPI(title="CartY API", description="WhatsApp Storefront Builder API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    }).execute())
    user = result.data[0]
    return {"token": create_token(user['id']), "user_id": user['id'], "phone": user['phone']}

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
        "store_slug": store['slug'] if store else None
    }


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
        elif ref.startswith("sub_"):
            pending = one(await db(lambda: supabase.table('pending_subscriptions').select('*').eq('reference', ref).limit(1).execute()))
            if pending:
                end_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
                await db(lambda: supabase.table('stores').update({"subscription_status": "active", "subscription_end_date": end_date}).eq('id', pending['store_id']).execute())
                await db(lambda: supabase.table('pending_subscriptions').delete().eq('reference', ref).execute())

    elif event == "transfer.success":
        ref = data["data"].get("reference", "")
        await db(lambda: supabase.table('withdrawals').update({"status": "success", "completed_at": datetime.utcnow().isoformat()}).eq('reference', ref).execute())

    elif event == "transfer.failed":
        ref = data["data"].get("reference", "")
        w = one(await db(lambda: supabase.table('withdrawals').select('*').eq('reference', ref).limit(1).execute()))
        if w:
            cur = one(await db(lambda: supabase.table('stores').select('wallet_balance').eq('id', w['store_id']).limit(1).execute()))
            if cur:
                await db(lambda: supabase.table('stores').update({"wallet_balance": (cur['wallet_balance'] or 0) + w['amount']}).eq('id', w['store_id']).execute())
            await db(lambda: supabase.table('withdrawals').update({"status": "failed"}).eq('reference', ref).execute())

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
      <div class="fg"><label>Delivery Address *</label><textarea id="bAddr" rows="2" placeholder="Your delivery address"></textarea></div>
      <div class="fg"><label>Note (optional)</label><input id="bNote" type="text" placeholder="Any special instructions?"></div>
      <button class="pay-btn" id="payBtn" onclick="doCheckout()">Proceed to Payment</button>
    </div>
  </div>
  <script>
    var SLUG='CARTY_SLUG',prods=CARTY_PRODS_JSON,cart={};
    function N(n){return'\u20A6'+Number(n).toLocaleString()}
    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
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
        return'<div class="ci"><span class="ci-name">'+esc(p.name)+'</span>'
          +'<button class="qty-btn" onclick="chQty(\''+id+'\',-1)">-</button>'
          +'<span class="qty-n">'+cart[id]+'</span>'
          +'<button class="qty-btn" onclick="chQty(\''+id+'\',1)">+</button>'
          +'<span class="ci-price">'+N(p.price*cart[id])+'</span></div>';
      }).join('');
    }
    function openCart(){document.getElementById('overlay').classList.add('open');updateUI();}
    function closeCart(){document.getElementById('overlay').classList.remove('open');}
    document.addEventListener('DOMContentLoaded',function(){
      document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeCart();});
    });
    async function doCheckout(){
      var name=document.getElementById('bName').value.trim();
      var phone=document.getElementById('bPhone').value.trim();
      var addr=document.getElementById('bAddr').value.trim();
      var note=document.getElementById('bNote').value.trim();
      if(!name||!phone||!addr){alert('Please fill in Name, Phone and Address');return;}
      if(!Object.keys(cart).length){alert('Your cart is empty');return;}
      var btn=document.getElementById('payBtn');btn.disabled=true;btn.textContent='Processing...';
      try{
        var items=Object.keys(cart).map(function(id){return{product_id:id,quantity:cart[id]}});
        var r=await fetch('/api/storefront/'+SLUG+'/checkout',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({buyer_name:name,buyer_phone:phone,buyer_address:addr,buyer_note:note||undefined,cart_items:items})
        });
        var d=await r.json();
        if(d.status==='subscription_required'){alert('This store is not accepting payments. Contact seller via WhatsApp.');btn.disabled=false;btn.textContent='Proceed to Payment';return;}
        if(d.authorization_url){window.location.href=d.authorization_url;}
        else{throw new Error('Payment initialization failed');}
      }catch(e){alert('Error: '+e.message);btn.disabled=false;btn.textContent='Proceed to Payment';}
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

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
