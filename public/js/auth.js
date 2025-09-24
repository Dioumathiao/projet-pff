// Authentication utilities
class Auth {
    static getToken() {
        return localStorage.getItem('token');
    }
    
    static getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }
    
    static setToken(token) {
        localStorage.setItem('token', token);
    }
    
    static setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }
    
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
    
    static isAuthenticated() {
        return !!this.getToken();
    }
    
    static async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getToken();
        
        if (!token) {
            this.logout();
            return null;
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (response.status === 401 || response.status === 403) {
                this.logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('Request error:', error);
            throw error;
        }
    }
    
    static checkAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
}

// Initialize authentication check on page load
document.addEventListener('DOMContentLoaded', () => {
    // Skip auth check for login and register pages
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('register.html')) {
        return;
    }
    
    Auth.checkAuth();
});
