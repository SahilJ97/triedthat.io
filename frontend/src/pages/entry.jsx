import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Pencil, Trash } from 'lucide-react';
import ExtractionResultPopup from '@/components/extraction-result-popup.jsx';

const Entry = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const { token } = useAuth();
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [fieldsExtracted, setFieldsExtracted] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState(null);
  const { experienceId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [anonymize, setAnonymize] = useState(false);
  const apiUrl = import.meta.env.VITE_BACKEND_API_URL;

  // Check if we should start in edit mode (from logs.jsx)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("edit") === "1") {
      setEditMode(true);
    }
  }, [location.search]);

  // Fetch experience details
  useEffect(() => {
    const fetchExperience = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/experience?experienceId=${experienceId}`, {
          headers: token ? { 'authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error("Failed to fetch experience");
        const data = await res.json();
        console.log('entry.jsx: backend data.results:', data.results);
        if (Array.isArray(data.results) && data.results.length === 1) {
          console.log('entry.jsx: using experience:', data.results[0]);
          setExperience(data.results[0]);
          setFormData(data.results[0]); // Pre-fill form for editing
          setAnonymize(data.results[0].anonymize || false); // Set initial anonymize value
        } else {
          throw new Error("Failed to fetch experience");
        }
      } catch (err) {
        setExperience(null);
      }
      setLoading(false);
    };
    fetchExperience();
  }, [experienceId]);

  if (loading) return <div>Loading...</div>;
  if (!experience) return <div>Entry not found.</div>;

  const canEdit = user && user.user_id === experience.user_id;

  const handleEditClick = () => setEditMode(true);
  const handleCancel = () => setEditMode(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };
  
  const handleAnonymizeChange = (e) => {
    setAnonymize(e.target.checked);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingEdit(true);
    setErrorEdit(null);
    setFieldsExtracted(null);
    setShowFieldsDialog(false);
    try {
      const response = await fetch(`${apiUrl}/api/experience/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          existingExperienceId: experienceId,
          experienceName: formData.name,
          experience: formData.raw_text,
          anonymize: anonymize,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update experience');
      }
      const data = await response.json();
      if (data.fields_extracted) {
        setFieldsExtracted(data.fields_extracted);
        setShowFieldsDialog(true);
      }
      setEditMode(false);
      setExperience({ ...experience, name: formData.name, raw_text: formData.raw_text });
    } catch (err) {
      setErrorEdit(err.message);
    } finally {
      setLoadingEdit(false);
    }
  };

  return (
    <div className="entry-container" style={{ maxWidth: 600, margin: "2rem auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.07)", position: 'relative' }}>
      {/* LinkedIn Profile section - always visible, top left */}
      <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
        {experience && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ccc',
            }}>
              {experience.profile_picture_url ? (
                <img
                  src={experience.profile_picture_url}
                  alt={((experience.first_name && experience.last_name) ? (experience.first_name + ' ' + experience.last_name) : 'Anonymous LinkedIn User') + ' profile'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ fontSize: 22, color: '#888' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="8" r="4" fill="#bbb" />
                    <rect x="4" y="16" width="16" height="6" rx="3" fill="#bbb" />
                  </svg>
                </div>
              )}
            </div>
            <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 16, color: '#333' }}>
              {(experience.first_name && experience.last_name) ? (experience.first_name + ' ' + experience.last_name) : 'Anonymous LinkedIn User'}
            </span>
          </div>
        )}
      </div>
      {canEdit && !editMode && (
        <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8 }}>
          <button
            aria-label="Edit Entry"
            style={{ background: "none", border: "none", cursor: "pointer" }}
            onClick={handleEditClick}
          >
            <Pencil className="w-5 h-5 text-muted-foreground opacity-60 hover:opacity-100 transition" />
          </button>
          <button
            aria-label="Delete Entry"
            style={{ background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash className="w-5 h-5 text-red-500 opacity-60 hover:opacity-100 transition" />
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 16 }}>Are you sure you would like to delete this entry?</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#d32f2f', color: '#fff', fontWeight: 600 }}
                onClick={async () => {
                  setDeleteStatus('pending');
                  try {
                    const res = await fetch(`${apiUrl}/api/experience?experienceId=${experienceId}`, {
                      method: 'DELETE',
                      credentials: 'include',
                      headers: {
                        ...(token ? { 'authorization': `Bearer ${token}` } : {}),
                      },
                    });
                    if (res.ok) {
                      setDeleteStatus('success');
                      window.location.href = '/';
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setDeleteStatus('error');
                      alert(data.detail || 'Failed to delete entry.');
                    }
                  } catch (err) {
                    setDeleteStatus('error');
                    alert('Failed to delete entry.');
                  } finally {
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={deleteStatus === 'pending'}
              >
                {deleteStatus === 'pending' ? 'Deleting...' : 'Yes'}
              </button>
              <button
                style={{ padding: '8px 20px', borderRadius: 4, border: 'none', background: '#eee', color: '#333' }}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteStatus === 'pending'}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {editMode ? (
        <form onSubmit={handleSubmit} style={{ marginTop: 52 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Title</label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              required
              disabled={loadingEdit}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 500 }}>Body</label>
            <textarea
              name="raw_text"
              value={formData.raw_text || ""}
              onChange={handleChange}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
              rows={8}
              required
              disabled={loadingEdit}
            />
          </div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="anonymize"
              checked={anonymize}
              onChange={handleAnonymizeChange}
              disabled={loadingEdit}
            />
            <label htmlFor="anonymize" style={{ fontWeight: 500 }}>Make this post anonymous</label>
          </div>
          {errorEdit && (
            <div style={{ color: 'red', marginBottom: 12 }}>{errorEdit}</div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" style={{ padding: "8px 20px", borderRadius: 4, border: "none", background: "#0073b1", color: "#fff", fontWeight: 600 }} disabled={loadingEdit}>{loadingEdit ? 'Saving...' : 'Submit'}</button>
            <button type="button" onClick={handleCancel} style={{ padding: "8px 20px", borderRadius: 4, border: "none", background: "#eee", color: "#333" }} disabled={loadingEdit}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ marginTop: 52 }}>
          <h3 style={{ margin: 0 }}>{experience.name}</h3>
          <div style={{ color: "#888", fontSize: 14, marginTop: 4, marginBottom: 12 }}>
            {experience.created_at ? new Date(experience.created_at).toLocaleString() : null}
          </div>
          <div style={{ color: "#222", fontSize: 16, whiteSpace: 'pre-line' }}>
            {experience.raw_text}
          </div>
        </div>
      )}
      <ExtractionResultPopup open={showFieldsDialog} onOpenChange={setShowFieldsDialog} fieldsExtracted={fieldsExtracted} />
    </div>
  );
};

export default Entry;
