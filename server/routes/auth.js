import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { validateRegistration, validateLogin } from '../middleware/validation.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmailOrUsername(email, username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.email, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { identifier, password } = req.body;

    // Find user by email or username
    const user = await User.findByEmailOrUsername(identifier);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.loginAttempts >= 5 && user.lockUntil > Date.now()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Try again in ${lockTime} minutes.`
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.email, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        profile: user.profile,
        stats: user.stats
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting profile'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  authenticateToken,
  body('username').optional().isLength({ min: 3, max: 30 }).trim(),
  body('profile.bio').optional().isLength({ max: 500 }).trim(),
  body('profile.location').optional().isLength({ max: 100 }).trim(),
  body('profile.website').optional().isURL().trim(),
  body('preferences.theme').optional().isIn(['light', 'dark', 'auto']),
  body('preferences.language').optional().isIn(['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    const updateFields = {};
    
    if (req.body.username && req.body.username !== user.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ username: req.body.username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      updateFields.username = req.body.username;
    }

    if (req.body.profile) {
      updateFields.profile = { ...user.profile, ...req.body.profile };
    }

    if (req.body.preferences) {
      updateFields.preferences = { ...user.preferences, ...req.body.preferences };
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // TODO: Send email with reset link
    // For now, just return the token (in production, send via email)
    res.json({
      success: true,
      message: 'Password reset email sent',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resetting password'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new token
    const token = generateToken(user._id, user.email, user.role);

    res.json({
      success: true,
      token
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing token'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update last active
    await User.findByIdAndUpdate(req.user.id, {
      lastActive: new Date()
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   GET /api/auth/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await User.getStats();
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting statistics'
    });
  }
});

export default router;
