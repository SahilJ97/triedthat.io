import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Pencil } from 'lucide-react';

const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

/**
 * Logs component
 * @param {Object} props
 * @param {number|null} props.experienceId - Filter logs by experienceId (null to get multiple experiences)
 * @param {number|null} props.userId - Filter logs by userId (null for all users)
 * @param {number|null} props.maxNumber - Limit the number of logs (null for unlimited)
 */
function Logs({ experienceId = null, userId = null, maxNumber = null }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (experienceId !== null) params.append('experienceId', experienceId);
    if (userId !== null) params.append('userId', userId);
    if (maxNumber !== null) params.append('maxNumber', maxNumber);
    const token = localStorage.getItem('access_token');
    fetch(`${apiUrl}/api/experience${params.toString() ? '?' + params.toString() : ''}`, {
      headers: token ? { 'authorization': `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
      })
      .then(data => {
        setLogs(Array.isArray(data.results) ? data.results : []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [experienceId, userId, maxNumber]);

  // Helper to truncate text to one line with ellipsis
  function truncateToOneLine(text, maxChars = 80) {
    if (!text) return '';
    let truncated = text.replace(/\n/g, ' ');
    if (truncated.length > maxChars) {
      truncated = truncated.slice(0, maxChars - 1) + '…';
    }
    return truncated;
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading logs…</div>;
  }
  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }
  if (!logs.length) {
    return <div className="text-center py-8 text-gray-400">No entries found.</div>;
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto px-2 sm:px-0">
      {logs.map(result => (
        <div key={result.id} className="relative">
          {user && result.user_id === user.user_id && (
            <Link
              to={`/entry/${result.id}?edit=1`}
              title="Edit"
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10"
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-block' }}
            >
              <Pencil className="w-5 h-5 text-muted-foreground opacity-60 hover:opacity-100 transition" />
            </Link>
          )}
          <Link
            to={`/entry/${result.id}`}
            className="block"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card className="flex flex-row items-center gap-4 p-4 sm:p-6 bg-white">
              <div className="flex-1 min-w-0">
                <CardHeader className="p-0 mb-1">
                  <CardTitle className="truncate max-w-full text-base sm:text-lg">
                    {result.name}
                  </CardTitle>
                </CardHeader>
                <CardDescription className="truncate max-w-full text-sm sm:text-base">
                  {truncateToOneLine(result.raw_text)}
                </CardDescription>
              </div>
            </Card>
          </Link>
        </div>
      ))}
    </div>
  );
}

export default Logs;
