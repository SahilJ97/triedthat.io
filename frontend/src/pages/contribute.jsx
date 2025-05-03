import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import ExtractionResultPopup from '@/components/extraction-result-popup.jsx';

const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

function ContributeExperience() {
  const { token } = useAuth();
  const [experienceName, setExperienceName] = useState('');
  const [experience, setExperience] = useState('');
  const [anonymize, setAnonymize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fieldsExtracted, setFieldsExtracted] = useState(null);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setFieldsExtracted(null);
    setShowFieldsDialog(false);
    try {
      const response = await fetch(`${apiUrl}/api/experience/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ experienceName, experience, anonymize }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit experience');
      }
      const data = await response.json();
      if (data.fields_extracted) {
        setFieldsExtracted(data.fields_extracted);
        setShowFieldsDialog(true);
      }
      setSuccess(true);
      setExperienceName('');
      setExperience('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full flex flex-col items-center px-2 sm:px-0 mt-8 mb-8">
      <div style={{ maxWidth: 600, margin: '2rem auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.07)', position: 'relative' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Share an entrepreneurial experience</div>
          <div style={{ color: '#888', fontSize: 15 }}>
            This can be anything from a single battle to a long journey spanning multiple ventures.
          </div>
        </div>
        {error && (
          <Alert className="mb-4 border-red-500 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-500 bg-green-50">
            <AlertDescription className="text-green-800">
              Your experience has been submitted successfully!
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Give this entry a short and descriptive title</label>
            <Input
              id="experienceName"
              placeholder="e.g., 'Pivoting to D2C in EdTech', 'Starting a taco truck'"
              className="w-full"
              value={experienceName}
              onChange={(e) => setExperienceName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Tell the community about your experience</label>
            <Textarea
              className="min-h-[200px] w-full"
              placeholder="The more details you can provide, the better."
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="anonymize"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              disabled={loading}
            />
            <label htmlFor="anonymize" style={{ fontWeight: 500 }}>Make this post anonymous</label>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              type="submit"
              style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#0073b1', color: '#fff', fontWeight: 600 }}
              disabled={loading || !experienceName.trim() || !experience.trim()}
            >
              {loading ? 'Processing...' : 'Submit'}
            </button>
          </div>
        </form>
        <ExtractionResultPopup open={showFieldsDialog} onOpenChange={setShowFieldsDialog} fieldsExtracted={fieldsExtracted} />
      </div>
    </main>
  );
}

export default ContributeExperience;
