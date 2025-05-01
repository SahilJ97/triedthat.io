// Vimeo OAuth configuration
const VIMEO_CLIENT_ID = import.meta.env.VITE_VIMEO_CLIENT_ID;
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL;

export const initiateVimeoAuth = () => {
  // Generate a random state value
  const state = Math.random().toString(36).substring(7);

  // Store the state in localStorage
  localStorage.setItem('vimeo_auth_state', state);

  const params = new URLSearchParams({
    client_id: VIMEO_CLIENT_ID,
    redirect_uri: `${FRONTEND_URL}/auth/vimeo/callback`,
    response_type: 'code',
    scope: 'public+private',
    state: state  // Add state parameter
  });

  const authUrl = 'https://api.vimeo.com/oauth/authorize?' + params.toString();
  window.location.href = authUrl;
};

export const handleVimeoCallback = async (code) => {
  try {
    // Verify the state matches
    const searchParams = new URLSearchParams(window.location.search);
    const returnedState = searchParams.get('state');
    const savedState = localStorage.getItem('vimeo_auth_state');

    if (returnedState !== savedState) {
      throw new Error('Invalid state parameter');
    }

    localStorage.removeItem('vimeo_auth_state'); // Clean up

    const token = localStorage.getItem('access_token');
    const response = await fetch(`${BACKEND_URL}/api/vimeo/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to authenticate with Vimeo');
    }

    return await response.json();
  } catch (error) {
    console.error('Vimeo callback error:', error);
    throw error;
  }
};
