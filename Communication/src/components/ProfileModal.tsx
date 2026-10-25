import React, { useState, useRef } from 'react';
import { useAuth } from '../context/index.js';
import { authService } from '../services/api.js';
import { UserAvatar, DEFAULT_AVATAR } from './UserAvatar.js';
import {
  X,
  Upload,
  Check,
  Sparkles,
  Camera,
  Trash2,
  User,
  Shield,
  Mail,
  RefreshCw
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Creative preset developer avatars
const PRESET_AVATARS = [
  { id: 'dev-1', label: 'Cyber Ninja', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80' },
  { id: 'dev-2', label: 'AI Engineer', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80' },
  { id: 'dev-3', label: 'Code Architect', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80' },
  { id: 'dev-4', label: 'Fullstack Dev', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80' },
  { id: 'dev-5', label: 'Creative Designer', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=160&q=80' },
  { id: 'dev-6', label: 'Tech Lead', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=160&q=80' }
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [interests, setInterests] = useState(Array.isArray(user?.interests) ? user.interests.join(', ') : '');
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !user) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAvatarUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessNotice(null);

    try {
      const res = await authService.updateProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim(),
        dob: dob.trim(),
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean)
      });

      if (res.success && res.data?.user) {
        updateUser(res.data.user);
        setSuccessNotice('Profile successfully updated!');
        setTimeout(() => {
          setSuccessNotice(null);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };


  const handleRemoveAvatar = () => {
    setAvatarUrl(DEFAULT_AVATAR);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/40">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Camera className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold font-heading text-slate-900">
              User Profile & Avatar Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {successNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Current Avatar Preview & Actions */}
          <div className="flex items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <UserAvatar
              name={name || user.name}
              avatarUrl={avatarUrl}
              role={user.role}
              size="xl"
              className="ring-4 ring-indigo-500/20"
            />

            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-slate-900">{name || user.name}</h3>
              <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </p>
              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                {user.role} Account
              </span>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-indigo-600" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Reset to Default Profile Photo"
                >
                  <RefreshCw className="w-3 h-3 text-indigo-600" />
                  <span>Default Photo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Preset Avatars Gallery */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Or Choose a Preferred Preset Avatar</span>
            </label>

            <div className="grid grid-cols-6 gap-2 pt-1">
              {PRESET_AVATARS.map((p) => {
                const isSelected = avatarUrl === p.url;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setAvatarUrl(p.url)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition p-0.5 cursor-pointer hover:scale-105 ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    title={p.label}
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover rounded-lg" />
                    {isSelected && (
                      <span className="absolute bottom-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Avatar URL input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://example.com/my-photo.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Display Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Date of Birth & Interests */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interests / Tech Stack
              </label>
              <input
                type="text"
                placeholder="C++, Algorithms, AI"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>
          </div>


          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
