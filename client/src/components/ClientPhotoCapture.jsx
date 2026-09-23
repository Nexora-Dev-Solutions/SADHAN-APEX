import React, { useRef } from 'react';
import { Camera, Image, Trash2, RefreshCw, User } from 'lucide-react';

export default function ClientPhotoCapture({ photoUrl, onPhotoChange, label = 'Client KYC Photo' }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Compress & resize image to lightweight base64 JPEG (< 50KB)
  const processImageFile = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.75 gives high clarity face photo in ~35-45KB
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        onPhotoChange(compressedBase64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = ''; // Reset input so same file can be retaken
    }
  };

  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    onPhotoChange('');
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Camera size={15} color="var(--accent-primary)" />
        <span>{label} (Borrower Face Photo)</span>
      </label>

      {/* Hidden inputs: One for native Camera capture, One for Gallery upload */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={handleCameraCapture}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleGallerySelect}
      />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 14px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-md)'
      }}>
        {/* Photo Avatar Preview */}
        <div style={{
          width: '74px',
          height: '74px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '2px solid ' + (photoUrl ? 'var(--accent-primary)' : 'var(--surface-border)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: photoUrl ? '0 0 14px rgba(59, 130, 246, 0.35)' : 'none'
        }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Client Face"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={36} color="var(--text-muted)" />
          )}
        </div>

        {/* Action Controls */}
        <div style={{ flex: 1 }}>
          {photoUrl ? (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700', marginBottom: '6px' }}>
                ✓ Client KYC Photo Captured
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px', fontSize: '0.75rem', padding: '5px 10px' }}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <RefreshCw size={13} />
                  Retake Photo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '4px', fontSize: '0.75rem', padding: '5px 10px', color: '#f87171' }}
                  onClick={handleRemove}
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Take a live photo of the borrower or select from device gallery:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={15} />
                  Open Camera
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Image size={15} />
                  Choose from Gallery
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
