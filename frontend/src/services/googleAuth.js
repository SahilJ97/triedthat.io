// Google OAuth configuration
const GOOGLE_CLIENT_ID = "329469468674-0t0liitqomq7308snn7l03q2soaggvh5.apps.googleusercontent.com";
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL;

export const initiateGoogleAuth = () => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${FRONTEND_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile'
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const handleGoogleCallback = async (code) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to authenticate with Google');
    }

    return await response.json();
  } catch (error) {
    console.error('Google callback error:', error);
    throw error;
  }
};
