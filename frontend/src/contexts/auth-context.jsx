import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    
    // Set up periodic token validation (every 5 minutes)
    const tokenValidationInterval = setInterval(() => {
      // Only validate if we think we're logged in
      if (user || token) {
        checkAuth();
      }
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
    
    // Add visibility change listener to check auth when user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (user || token)) {
        checkAuth();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(tokenValidationInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/api/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setToken(token);
        return data;
      } else if (response.status === 401) {
        // Only try refresh token on unauthorized
        const newToken = await refreshToken();
        if (newToken) {
          // Retry the request with the new token
          const retryResponse = await fetch(`${apiUrl}/api/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
          });

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            setUser(data);
            setToken(newToken);
            return data;
          }
        }
        // If refresh failed or retry failed, clear everything
        handleLogout();
        return null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      handleLogout();
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to handle logout cleanup
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setToken(null);
  };

  const login = async (tokens) => {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    setToken(tokens.access_token);

    const userData = await checkAuth();

    if (userData) {
      setUser(userData);
      navigate('/');
    }
  };

  const logout = () => {
    handleLogout();
    navigate("/");
  };

  const refreshToken = async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      console.log("No refresh token found");
      handleLogout();
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/api/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refresh}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token", data.access_token);
        setToken(data.access_token);
        return data.access_token;
      } else {
        handleLogout();
        return null;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      handleLogout();
      return null;
    }
  };

  // LinkedIn OAuth login
  const initiateLinkedInLogin = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/linkedin/login`);
      if (response.ok) {
        const data = await response.json();
        // Redirect to LinkedIn authorization page
        window.location.href = data.auth_url;
      } else {
        console.error('Failed to initiate LinkedIn login');
      }
    } catch (error) {
      console.error('LinkedIn login error:', error);
    }
  };

  // Handle LinkedIn OAuth callback
  const handleLinkedInCallback = async (code) => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/linkedin/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const data = await response.json();
        // Use the existing login function to handle token storage and redirection
        await login(data);
        return true;
      } else {
        console.error('LinkedIn callback failed');
        return false;
      }
    } catch (error) {
      console.error('LinkedIn callback error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        refreshToken,
        checkAuth,
        initiateLinkedInLogin,
        handleLinkedInCallback
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return null;
  }

  return children;
};