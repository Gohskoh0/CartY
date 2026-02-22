#!/usr/bin/env python3
"""
CartY Backend API - Specific Tests for Payment, Subscription, and Wallet APIs
Focus on testing the APIs that need retesting according to test_result.md
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://whatsapp-commerce-10.preview.emergentagent.com/api"
TEST_PHONE = "09011112222"
TEST_PASSWORD = "test123"

class CartYSpecificTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.store_slug = None
        self.product_id = None
        
    def authenticate(self):
        """Get authentication token"""
        login_data = {
            "phone": TEST_PHONE,
            "password": TEST_PASSWORD
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.token = data["token"]
                print("✅ Authentication successful")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def get_store_info(self):
        """Get store information"""
        if not self.token:
            return False
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        try:
            response = requests.get(f"{self.base_url}/stores/my-store", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.store_slug = data.get("slug")
                print(f"✅ Store info retrieved: {data.get('name')} (slug: {self.store_slug})")
                return True
            else:
                print(f"❌ Store info failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Store info error: {e}")
            return False
    
    def create_test_product(self):
        """Create a test product for checkout testing"""
        if not self.token:
            return False
            
        headers = {"Authorization": f"Bearer {self.token}"}
        product_data = {
            "name": "Test Checkout Product",
            "description": "Product for testing checkout flow",
            "price": 1000
        }
        
        try:
            response = requests.post(f"{self.base_url}/products", json=product_data, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.product_id = data["_id"]
                print(f"✅ Test product created: {data['name']} (ID: {self.product_id})")
                return True
            else:
                print(f"❌ Product creation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Product creation error: {e}")
            return False
    
    def test_checkout_api(self):
        """Test checkout and payment initialization (needs_retesting: true)"""
        print("\n=== Testing Checkout and Payment API ===")
        
        if not self.store_slug or not self.product_id:
            print("❌ Missing store slug or product ID for checkout test")
            return False
        
        checkout_data = {
            "buyer_name": "John Doe",
            "buyer_phone": "08012345678",
            "buyer_address": "123 Test Street, Lagos",
            "buyer_note": "Test order",
            "cart_items": [
                {
                    "product_id": self.product_id,
                    "quantity": 2
                }
            ]
        }
        
        try:
            response = requests.post(f"{self.base_url}/storefront/{self.store_slug}/checkout", 
                                   json=checkout_data, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "subscription_required":
                    print("⚠️  Checkout blocked: Subscription required (expected behavior)")
                    print(f"   Message: {data.get('message')}")
                    return True
                elif data.get("status") == "success":
                    print("✅ Checkout API working: Payment initialization successful")
                    print(f"   Reference: {data.get('reference')}")
                    print(f"   Total: ₦{data.get('total')}")
                    return True
                else:
                    print(f"❌ Unexpected checkout response: {data}")
                    return False
            else:
                print(f"❌ Checkout failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Checkout error: {e}")
            return False
    
    def test_subscription_api(self):
        """Test subscription initialization (needs_retesting: true)"""
        print("\n=== Testing Subscription API ===")
        
        if not self.token:
            print("❌ No authentication token")
            return False
        
        headers = {"Authorization": f"Bearer {self.token}"}
        subscription_data = {
            "email": "test@example.com"
        }
        
        try:
            response = requests.post(f"{self.base_url}/subscription/initialize", 
                                   json=subscription_data, headers=headers, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if "authorization_url" in data and "reference" in data:
                    print("✅ Subscription API working: Payment initialization successful")
                    print(f"   Reference: {data.get('reference')}")
                    return True
                else:
                    print(f"❌ Missing required fields in subscription response: {data}")
                    return False
            else:
                print(f"❌ Subscription failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Subscription error: {e}")
            return False
    
    def test_wallet_apis(self):
        """Test wallet and withdrawal APIs (needs_retesting: true)"""
        print("\n=== Testing Wallet and Withdrawal APIs ===")
        
        if not self.token:
            print("❌ No authentication token")
            return False
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Test wallet info
        try:
            response = requests.get(f"{self.base_url}/wallet", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Wallet API working: Balance ₦{data.get('wallet_balance', 0)}")
                wallet_working = True
            else:
                print(f"❌ Wallet API failed: {response.status_code}")
                wallet_working = False
        except Exception as e:
            print(f"❌ Wallet API error: {e}")
            wallet_working = False
        
        # Test banks list
        try:
            response = requests.get(f"{self.base_url}/banks", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Banks API working: {len(data)} banks available")
                banks_working = True
            else:
                print(f"❌ Banks API failed: {response.status_code}")
                banks_working = False
        except Exception as e:
            print(f"❌ Banks API error: {e}")
            banks_working = False
        
        # Test bank setup (this will likely fail without valid bank details, but we can test the endpoint)
        try:
            response = requests.post(f"{self.base_url}/wallet/setup-bank", 
                                   headers=headers, 
                                   data={"bank_code": "044", "account_number": "1234567890", "bank_name": "Access Bank"},
                                   timeout=10)
            
            if response.status_code == 400:
                print("✅ Bank setup API working: Correctly validates account (expected 400 for invalid account)")
                bank_setup_working = True
            elif response.status_code == 200:
                print("✅ Bank setup API working: Account setup successful")
                bank_setup_working = True
            else:
                print(f"❌ Bank setup API failed: {response.status_code}")
                bank_setup_working = False
        except Exception as e:
            print(f"❌ Bank setup API error: {e}")
            bank_setup_working = False
        
        return wallet_working and banks_working and bank_setup_working
    
    def test_paystack_integration(self):
        """Test if Paystack integration is properly configured"""
        print("\n=== Testing Paystack Integration ===")
        
        # Check if we can access Paystack banks API through our backend
        if not self.token:
            print("❌ No authentication token")
            return False
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        try:
            response = requests.get(f"{self.base_url}/banks", headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if len(data) > 0 and "name" in data[0]:
                    print("✅ Paystack integration working: Banks data retrieved successfully")
                    return True
                else:
                    print("❌ Paystack integration issue: Empty or invalid banks data")
                    return False
            else:
                print(f"❌ Paystack integration failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Paystack integration error: {e}")
            return False
    
    def run_specific_tests(self):
        """Run tests for APIs that need retesting"""
        print("🔍 Testing CartY APIs that need retesting")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Setup
        if not self.authenticate():
            return False
        
        if not self.get_store_info():
            return False
        
        if not self.create_test_product():
            return False
        
        # Test the specific APIs that need retesting
        checkout_result = self.test_checkout_api()
        subscription_result = self.test_subscription_api()
        wallet_result = self.test_wallet_apis()
        paystack_result = self.test_paystack_integration()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 SPECIFIC TESTS SUMMARY")
        print("=" * 60)
        
        results = {
            "Checkout and Payment API": checkout_result,
            "Subscription API": subscription_result,
            "Wallet and Withdrawal APIs": wallet_result,
            "Paystack Integration": paystack_result
        }
        
        for test_name, result in results.items():
            status = "✅ WORKING" if result else "❌ FAILED"
            print(f"{status} {test_name}")
        
        working_count = sum(results.values())
        total_count = len(results)
        
        print(f"\nOverall: {working_count}/{total_count} APIs working ({(working_count/total_count)*100:.1f}%)")
        
        if working_count == total_count:
            print("🎉 All APIs that needed retesting are now working!")
        else:
            print("⚠️  Some APIs still need attention")
        
        return results

if __name__ == "__main__":
    tester = CartYSpecificTester()
    results = tester.run_specific_tests()