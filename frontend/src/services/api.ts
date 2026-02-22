const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    if (!BASE_URL) {
      throw new Error('Backend URL is not configured. Please set EXPO_PUBLIC_BACKEND_URL.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error('Network error. Please check your internet connection.');
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(`Server error (${response.status}). Please try again.`);
      }
      throw new Error('Unexpected server response. Please try again.');
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
    }

    return data;
  }

  // Auth
  async login(phone: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
  }

  async register(phone: string, password: string, country: string = 'NG', state: string = '') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, password, country, state }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Store
  async createStore(data: { name: string; whatsapp_number: string; email?: string; logo?: string }) {
    return this.request('/stores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyStore() {
    return this.request('/stores/my-store');
  }

  async updateStore(data: any) {
    return this.request('/stores/my-store', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getDashboard() {
    return this.request('/stores/dashboard');
  }

  // Products
  async createProduct(data: { name: string; description?: string; price: number; image?: string }) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProducts() {
    return this.request('/products');
  }

  async updateProduct(id: string, data: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Orders
  async getOrders() {
    return this.request('/orders');
  }

  // Wallet
  async getWallet() {
    return this.request('/wallet');
  }

  async getBanks(country: string = 'NG') {
    return this.request(`/banks?country=${country}`);
  }

  async verifyAccount(bankCode: string, accountNumber: string) {
    return this.request(`/wallet/verify-account?bank_code=${bankCode}&account_number=${accountNumber}`);
  }

  async setupBank(bank_code: string, account_number: string, bank_name: string) {
    return this.request(`/wallet/setup-bank?bank_code=${bank_code}&account_number=${account_number}&bank_name=${encodeURIComponent(bank_name)}`, {
      method: 'POST',
    });
  }

  async withdraw(amount: number) {
    return this.request('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getSubscriptionPrice(country: string = 'NG') {
    return this.request(`/subscription/price?country=${country}`);
  }

  // Subscription
  async initializeSubscription(email: string) {
    return this.request('/subscription/initialize', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifySubscription(reference: string) {
    return this.request(`/subscription/verify/${reference}`);
  }

  // Storefront (public)
  async getStorefront(slug: string) {
    return this.request(`/storefront/${slug}`);
  }

  async checkout(slug: string, data: {
    buyer_name: string;
    buyer_phone: string;
    buyer_address: string;
    buyer_note?: string;
    cart_items: { product_id: string; quantity: number }[];
  }) {
    return this.request(`/storefront/${slug}/checkout`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyPayment(slug: string, reference: string) {
    return this.request(`/storefront/${slug}/verify/${reference}`);
  }
}

export const api = new ApiService();
