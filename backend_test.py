#!/usr/bin/env python3
"""
CartY Backend API Testing Suite
Tests all backend APIs as specified in the review request
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://whatsapp-commerce-10.preview.emergentagent.com/api"
TEST_PHONE = "09011112222"
TEST_PASSWORD = "test123"

class CartYAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.store_id = None
        self.store_slug = None
        self.product_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if not success and response_data:
            print(f"   Response: {response_data}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if self.token:
            default_headers["Authorization"] = f"Bearer {self.token}"
        
        if headers:
            default_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def test_auth_flow(self):
        """Test authentication flow: register, login, me"""
        print("\n=== Testing Auth Flow ===")
        
        # Test Registration
        register_data = {
            "phone": TEST_PHONE,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/register", register_data)
        if response is None:
            self.log_result("Auth Registration", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user_id" in data:
                self.token = data["token"]
                self.user_id = data["user_id"]
                self.log_result("Auth Registration", True, f"User registered successfully, ID: {self.user_id}")
            else:
                self.log_result("Auth Registration", False, "Missing token or user_id in response", data)
                return False
        elif response.status_code == 400:
            # User might already exist, try login instead
            self.log_result("Auth Registration", True, "User already exists (expected)")
        else:
            self.log_result("Auth Registration", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Login
        login_data = {
            "phone": TEST_PHONE,
            "password": TEST_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response is None:
            self.log_result("Auth Login", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user_id" in data:
                self.token = data["token"]
                self.user_id = data["user_id"]
                self.log_result("Auth Login", True, f"Login successful, token received")
            else:
                self.log_result("Auth Login", False, "Missing token or user_id in response", data)
                return False
        else:
            self.log_result("Auth Login", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Get Current User
        response = self.make_request("GET", "/auth/me")
        if response is None:
            self.log_result("Auth Get Me", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "user_id" in data and "phone" in data:
                self.log_result("Auth Get Me", True, f"User info retrieved: {data['phone']}")
                return True
            else:
                self.log_result("Auth Get Me", False, "Missing user info in response", data)
                return False
        else:
            self.log_result("Auth Get Me", False, f"Status {response.status_code}", response.text)
            return False
    
    def test_store_management(self):
        """Test store CRUD operations"""
        print("\n=== Testing Store Management ===")
        
        if not self.token:
            self.log_result("Store Management", False, "No auth token available")
            return False
        
        # Test Create Store
        store_data = {
            "name": "Test Store",
            "whatsapp_number": "09011112222",
            "email": "test@store.com"
        }
        
        response = self.make_request("POST", "/stores", store_data)
        if response is None:
            self.log_result("Store Create", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "store" in data and "slug" in data:
                self.store_slug = data["slug"]
                self.store_id = data["store"]["_id"]
                self.log_result("Store Create", True, f"Store created with slug: {self.store_slug}")
            else:
                self.log_result("Store Create", False, "Missing store or slug in response", data)
                return False
        elif response.status_code == 400:
            # Store might already exist
            self.log_result("Store Create", True, "Store already exists (expected)")
        else:
            self.log_result("Store Create", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Get My Store
        response = self.make_request("GET", "/stores/my-store")
        if response is None:
            self.log_result("Store Get", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "_id" in data and "name" in data:
                self.store_id = data["_id"]
                self.store_slug = data.get("slug")
                self.log_result("Store Get", True, f"Store retrieved: {data['name']}")
            else:
                self.log_result("Store Get", False, "Missing store data", data)
                return False
        else:
            self.log_result("Store Get", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Update Store
        update_data = {
            "name": "Updated Test Store"
        }
        
        response = self.make_request("PUT", "/stores/my-store", update_data)
        if response is None:
            self.log_result("Store Update", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if data.get("name") == "Updated Test Store":
                self.log_result("Store Update", True, "Store updated successfully")
            else:
                self.log_result("Store Update", False, "Store name not updated", data)
                return False
        else:
            self.log_result("Store Update", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Dashboard
        response = self.make_request("GET", "/stores/dashboard")
        if response is None:
            self.log_result("Store Dashboard", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["total_orders", "total_sales", "wallet_balance", "products_count"]
            if all(field in data for field in required_fields):
                self.log_result("Store Dashboard", True, f"Dashboard data retrieved: {len(data)} fields")
                return True
            else:
                self.log_result("Store Dashboard", False, "Missing dashboard fields", data)
                return False
        else:
            self.log_result("Store Dashboard", False, f"Status {response.status_code}", response.text)
            return False
    
    def test_product_management(self):
        """Test product CRUD operations"""
        print("\n=== Testing Product Management ===")
        
        if not self.token:
            self.log_result("Product Management", False, "No auth token available")
            return False
        
        # Test Create Product
        product_data = {
            "name": "Test Product",
            "description": "Test description",
            "price": 2500
        }
        
        response = self.make_request("POST", "/products", product_data)
        if response is None:
            self.log_result("Product Create", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "_id" in data and "name" in data:
                self.product_id = data["_id"]
                self.log_result("Product Create", True, f"Product created: {data['name']}")
            else:
                self.log_result("Product Create", False, "Missing product data", data)
                return False
        else:
            self.log_result("Product Create", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test List Products
        response = self.make_request("GET", "/products")
        if response is None:
            self.log_result("Product List", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Product List", True, f"Retrieved {len(data)} products")
                # Get a product ID if we don't have one
                if not self.product_id and len(data) > 0:
                    self.product_id = data[0]["_id"]
            else:
                self.log_result("Product List", False, "Response is not a list", data)
                return False
        else:
            self.log_result("Product List", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Update Product (toggle is_active)
        if self.product_id:
            update_data = {
                "is_active": False
            }
            
            response = self.make_request("PUT", f"/products/{self.product_id}", update_data)
            if response is None:
                self.log_result("Product Update", False, "Request failed - connection error")
                return False
            
            if response.status_code == 200:
                data = response.json()
                if data.get("is_active") == False:
                    self.log_result("Product Update", True, "Product deactivated successfully")
                else:
                    self.log_result("Product Update", False, "Product not deactivated", data)
                    return False
            else:
                self.log_result("Product Update", False, f"Status {response.status_code}", response.text)
                return False
            
            # Test Delete Product
            response = self.make_request("DELETE", f"/products/{self.product_id}")
            if response is None:
                self.log_result("Product Delete", False, "Request failed - connection error")
                return False
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_result("Product Delete", True, "Product deleted successfully")
                    return True
                else:
                    self.log_result("Product Delete", False, "No confirmation message", data)
                    return False
            else:
                self.log_result("Product Delete", False, f"Status {response.status_code}", response.text)
                return False
        else:
            self.log_result("Product Update/Delete", False, "No product ID available for testing")
            return False
    
    def test_public_storefront(self):
        """Test public storefront access"""
        print("\n=== Testing Public Storefront ===")
        
        if not self.store_slug:
            self.log_result("Public Storefront", False, "No store slug available")
            return False
        
        # Test Get Storefront by Slug
        response = self.make_request("GET", f"/storefront/{self.store_slug}")
        if response is None:
            self.log_result("Public Storefront", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if "store" in data and "products" in data:
                store_info = data["store"]
                products = data["products"]
                self.log_result("Public Storefront", True, f"Storefront retrieved: {store_info.get('name')} with {len(products)} products")
                return True
            else:
                self.log_result("Public Storefront", False, "Missing store or products data", data)
                return False
        else:
            self.log_result("Public Storefront", False, f"Status {response.status_code}", response.text)
            return False
    
    def test_orders(self):
        """Test orders listing"""
        print("\n=== Testing Orders ===")
        
        if not self.token:
            self.log_result("Orders", False, "No auth token available")
            return False
        
        # Test List Orders
        response = self.make_request("GET", "/orders")
        if response is None:
            self.log_result("Orders List", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Orders List", True, f"Retrieved {len(data)} orders")
                return True
            else:
                self.log_result("Orders List", False, "Response is not a list", data)
                return False
        else:
            self.log_result("Orders List", False, f"Status {response.status_code}", response.text)
            return False
    
    def test_wallet(self):
        """Test wallet functionality"""
        print("\n=== Testing Wallet ===")
        
        if not self.token:
            self.log_result("Wallet", False, "No auth token available")
            return False
        
        # Test Get Wallet
        response = self.make_request("GET", "/wallet")
        if response is None:
            self.log_result("Wallet Get", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["wallet_balance", "pending_balance", "total_earnings"]
            if all(field in data for field in required_fields):
                self.log_result("Wallet Get", True, f"Wallet info retrieved: Balance ₦{data['wallet_balance']}")
            else:
                self.log_result("Wallet Get", False, "Missing wallet fields", data)
                return False
        else:
            self.log_result("Wallet Get", False, f"Status {response.status_code}", response.text)
            return False
        
        # Test Get Banks
        response = self.make_request("GET", "/banks")
        if response is None:
            self.log_result("Banks List", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                self.log_result("Banks List", True, f"Retrieved {len(data)} banks")
                return True
            else:
                self.log_result("Banks List", False, "Response is not a list", data)
                return False
        else:
            self.log_result("Banks List", False, f"Status {response.status_code}", response.text)
            return False
    
    def test_error_cases(self):
        """Test error handling"""
        print("\n=== Testing Error Cases ===")
        
        # Test invalid credentials
        invalid_login = {
            "phone": "invalid_phone",
            "password": "wrong_password"
        }
        
        response = self.make_request("POST", "/auth/login", invalid_login)
        if response and response.status_code == 401:
            self.log_result("Invalid Credentials", True, "Correctly rejected invalid credentials")
        else:
            self.log_result("Invalid Credentials", False, f"Expected 401, got {response.status_code if response else 'None'}")
        
        # Test unauthorized access (no token)
        old_token = self.token
        self.token = None
        
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 401:
            self.log_result("Unauthorized Access", True, "Correctly rejected unauthorized request")
        else:
            self.log_result("Unauthorized Access", False, f"Expected 401, got {response.status_code if response else 'None'}")
        
        # Test invalid token
        self.token = "invalid_token"
        
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 401:
            self.log_result("Invalid Token", True, "Correctly rejected invalid token")
        else:
            self.log_result("Invalid Token", False, f"Expected 401, got {response.status_code if response else 'None'}")
        
        # Restore token
        self.token = old_token
        
        # Test not found
        response = self.make_request("GET", "/storefront/nonexistent-slug")
        if response and response.status_code == 404:
            self.log_result("Not Found", True, "Correctly returned 404 for nonexistent store")
            return True
        else:
            self.log_result("Not Found", False, f"Expected 404, got {response.status_code if response else 'None'}")
            return False
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting CartY Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 50)
        
        # Run test suites
        auth_success = self.test_auth_flow()
        store_success = self.test_store_management() if auth_success else False
        product_success = self.test_product_management() if auth_success else False
        storefront_success = self.test_public_storefront() if store_success else False
        orders_success = self.test_orders() if auth_success else False
        wallet_success = self.test_wallet() if auth_success else False
        error_success = self.test_error_cases()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Failed tests details
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Overall status
        critical_flows = [auth_success, store_success, product_success, storefront_success]
        if all(critical_flows):
            print("\n✅ ALL CRITICAL FLOWS WORKING")
        else:
            print("\n❌ SOME CRITICAL FLOWS FAILED")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "critical_flows_working": all(critical_flows),
            "auth_working": auth_success,
            "store_working": store_success,
            "products_working": product_success,
            "storefront_working": storefront_success,
            "orders_working": orders_success,
            "wallet_working": wallet_success,
            "error_handling_working": error_success
        }

if __name__ == "__main__":
    tester = CartYAPITester()
    results = tester.run_all_tests()