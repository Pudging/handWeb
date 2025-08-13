import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  requiredRole 
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(120deg, #23234a 0%, #1a1a2a 100%)'
      }}>
        <div style={{
          background: 'rgba(40, 44, 52, 0.97)',
          borderRadius: 14,
          padding: 32,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          textAlign: 'center'
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid #3a3a7a',
            borderTop: '4px solid #2a7a3a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ color: '#fff', fontSize: 16 }}>Loading...</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If a specific role is required but user doesn't have it
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(120deg, #23234a 0%, #1a1a2a 100%)'
      }}>
        <div style={{
          background: 'rgba(40, 44, 52, 0.97)',
          borderRadius: 14,
          padding: 32,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          textAlign: 'center',
          maxWidth: 400
        }}>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Access Denied</h2>
          <p style={{ color: '#ccc', marginBottom: 24 }}>
            You don't have permission to access this page. 
            {requiredRole && ` Required role: ${requiredRole}`}
          </p>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              background: '#234a7a',
              color: '#fff',
              border: 'none',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // If all checks pass, render the children
  return <>{children}</>;
};

export default ProtectedRoute;
