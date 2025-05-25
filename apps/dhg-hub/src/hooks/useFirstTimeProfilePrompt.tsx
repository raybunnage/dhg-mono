import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { profileService } from '../services/profile-service';

export function useFirstTimeProfilePrompt() {
  const { user } = useAuth();
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFirstTimeUser = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if user has already been prompted before
        const hasBeenPrompted = localStorage.getItem(`dhg_hub_profile_prompted_${user.id}`);
        if (hasBeenPrompted) {
          setShouldShowPrompt(false);
          setIsLoading(false);
          return;
        }

        // Check if user already has a profile
        const result = await profileService.getProfile(user.id);
        if (result.success && result.data) {
          // User has a profile, mark as prompted so they don't see it again
          localStorage.setItem(`dhg_hub_profile_prompted_${user.id}`, 'true');
          setShouldShowPrompt(false);
        } else {
          // User doesn't have a profile and hasn't been prompted - show prompt
          setShouldShowPrompt(true);
        }
      } catch (error) {
        console.error('Error checking first-time user status:', error);
        setShouldShowPrompt(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkFirstTimeUser();
  }, [user]);

  const dismissPrompt = () => {
    if (user) {
      localStorage.setItem(`dhg_hub_profile_prompted_${user.id}`, 'true');
    }
    setShouldShowPrompt(false);
  };

  return {
    shouldShowPrompt,
    isLoading,
    dismissPrompt
  };
}