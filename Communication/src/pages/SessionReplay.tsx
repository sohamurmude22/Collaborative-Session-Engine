import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SessionReplay removed as requested.
 * Automatically redirects to Dashboard.
 */
export const SessionReplay: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return null;
};
