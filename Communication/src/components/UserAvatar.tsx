import React, { useState } from 'react';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string;
  role?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showStatus?: boolean;
  isOnline?: boolean;
}

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%236366F1'/%3E%3Ccircle cx='64' cy='48' r='22' fill='%23FFFFFF'/%3E%3Cpath d='M28 106c0-19.88 16.12-36 36-36s36 16.12 36 36' fill='%23FFFFFF'/%3E%3C/svg%3E";

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = 'User',
  avatarUrl,
  role,
  size = 'md',
  className = '',
  showStatus = false,
  isOnline = false
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl'
  };

  const statusSizeClasses = {
    xs: 'w-1.5 h-1.5 ring-1',
    sm: 'w-2 h-2 ring-1.5',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-2'
  };

  const effectiveAvatar = (!imageError && avatarUrl && avatarUrl.trim().length > 0) ? avatarUrl : DEFAULT_AVATAR;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold font-heading text-white shadow-sm ring-1 ring-white/20 select-none bg-slate-800`}
      >
        <img
          src={effectiveAvatar}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>

      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-white ${statusSizeClasses[size]} ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
