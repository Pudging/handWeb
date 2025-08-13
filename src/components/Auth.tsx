import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
  };
}

interface AuthProps {
  onAuthChange: (user: User | null) => void;
  currentUser: User | null;
}

const Auth: React.FC<AuthProps> = ({ onAuthChange, currentUser }) => {
  const { login: contextLogin, updateUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: currentUser?.profile?.bio || '',
    location: currentUser?.profile?.location || '',
    website: currentUser?.profile?.website || ''
  });

  const API_BASE = 'http://localhost:5000/api';

  // Check for existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      fetchUserProfile(token);
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        onAuthChange(data.user);
        toast.success('Welcome back!');
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('jwt_token');
        onAuthChange(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('jwt_token');
      onAuthChange(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isLogin ? 'login' : 'register';
      const payload = isLogin 
        ? { identifier: formData.email, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('jwt_token', data.token);
        contextLogin(data.token, data.user);
        toast.success(isLogin ? 'Login successful!' : 'Registration successful!');
        
        if (!isLogin) {
          setIsLogin(true);
        }
        
        setFormData({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        toast.error(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    // The logout will be handled by the context when the token is removed
    window.location.reload();
    toast.success('Logged out successfully');
  };

  const handleProfileUpdate = async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: profileData
        })
      });

      if (response.ok) {
        const data = await response.json();
        updateUser(data.user);
        toast.success('Profile updated successfully!');
        setShowProfile(false);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (!isLogin && formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    if (!isLogin && formData.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    if (!validateForm()) return;
    handleSubmit(e);
  };

  if (currentUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-container"
        style={{
          background: 'rgba(40, 44, 52, 0.97)',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          marginBottom: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Welcome, {currentUser.username}!</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: '#234a7a',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {showProfile ? 'Hide Profile' : 'Edit Profile'}
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: '#7a2a2a',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(30,30,40,0.5)', borderRadius: 8 }}>
                <h4 style={{ color: '#fff', marginBottom: 12 }}>Edit Profile</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>Bio:</label>
                    <textarea
                      value={profileData.bio}
                      onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #555',
                        background: '#23234a',
                        color: '#fff',
                        fontSize: 12,
                        resize: 'vertical'
                      }}
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>Location:</label>
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #555',
                        background: '#23234a',
                        color: '#fff',
                        fontSize: 12
                      }}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>Website:</label>
                    <input
                      type="url"
                      value={profileData.website}
                      onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #555',
                        background: '#23234a',
                        color: '#fff',
                        fontSize: 12
                      }}
                      placeholder="https://example.com"
                    />
                  </div>
                  <button
                    onClick={handleProfileUpdate}
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: '#2a7a3a',
                      color: '#fff',
                      border: 'none',
                      fontSize: 12,
                      cursor: 'pointer',
                      alignSelf: 'flex-start'
                    }}
                  >
                    {isLoading ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Role: {currentUser.role} • Email: {currentUser.email}
          {!currentUser.isEmailVerified && (
            <span style={{ color: '#ffa500', marginLeft: 8 }}>• Email not verified</span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="auth-container"
      style={{
        background: 'rgba(40, 44, 52, 0.97)',
        borderRadius: 14,
        padding: 24,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        marginBottom: 20
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
          {isLogin ? 'Login' : 'Create Account'}
        </h3>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            background: 'none',
            border: 'none',
            color: '#4a9eff',
            fontSize: 14,
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isLogin ? 'Need an account?' : 'Already have an account?'}
        </button>
      </div>

      <form onSubmit={handleFormSubmit}>
        {!isLogin && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 6 }}>Username:</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 6,
                border: '1px solid #555',
                background: '#23234a',
                color: '#fff',
                fontSize: 14
              }}
              placeholder="Enter username"
              required
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 6 }}>
            {isLogin ? 'Email or Username:' : 'Email:'}
          </label>
          <input
            type={isLogin ? 'text' : 'email'}
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 6,
              border: '1px solid #555',
              background: '#23234a',
              color: '#fff',
              fontSize: 14
            }}
            placeholder={isLogin ? 'Enter email or username' : 'Enter email'}
            required
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 6 }}>Password:</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 6,
              border: '1px solid #555',
              background: '#23234a',
              color: '#fff',
              fontSize: 14
            }}
            placeholder="Enter password"
            required
          />
        </div>

        {!isLogin && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 6 }}>Confirm Password:</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 6,
                border: '1px solid #555',
                background: '#23234a',
                color: '#fff',
                fontSize: 14
              }}
              placeholder="Confirm password"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 6,
            background: '#2a7a3a',
            color: '#fff',
            border: 'none',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 12, color: '#888', textAlign: 'center' }}>
        {isLogin ? (
          <span>Don't have an account? <button onClick={() => setIsLogin(false)} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', textDecoration: 'underline' }}>Sign up here</button></span>
        ) : (
          <span>Already have an account? <button onClick={() => setIsLogin(true)} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', textDecoration: 'underline' }}>Login here</button></span>
        )}
      </div>
    </motion.div>
  );
};

export default Auth;
