import { useState, useEffect } from 'react';
import { ApiClient } from '@/lib/api-migration';

interface ReferralCodeHook {
  referralCode: string | null;
  isValid: boolean | null;
  isValidating: boolean;
  referrerName: string | null;
  applyReferralCode: () => Promise<boolean>;
  clearReferralCode: () => void;
}

export function useReferralCode(): ReferralCodeHook {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    // First check URL parameters for referral code
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('ref');

    if (codeFromUrl) {
      // Store in sessionStorage for persistence across navigation
      sessionStorage.setItem('referralCode', codeFromUrl);
      sessionStorage.setItem('referralCodeTimestamp', Date.now().toString());
      setReferralCode(codeFromUrl);
      validateCode(codeFromUrl);
    } else {
      // Check sessionStorage for previously stored referral code
      const storedCode = sessionStorage.getItem('referralCode');
      const timestamp = sessionStorage.getItem('referralCodeTimestamp');

      // Only use stored code if it's less than 24 hours old
      if (storedCode && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (age < twentyFourHours) {
          setReferralCode(storedCode);
          // Also restore referrer name from storage
          const storedReferrerName = sessionStorage.getItem('referrerName');
          if (storedReferrerName) {
            setReferrerName(storedReferrerName);
            setIsValid(true); // Assume it's still valid if stored recently
          } else {
            validateCode(storedCode); // Re-validate if no name stored
          }
        } else {
          // Clear expired referral code
          sessionStorage.removeItem('referralCode');
          sessionStorage.removeItem('referralCodeTimestamp');
          sessionStorage.removeItem('referrerName');
        }
      }
    }
  }, []);

  const validateCode = async (code: string) => {
    setIsValidating(true);
    try {
      const result = await ApiClient.validateReferralCode(code);
      setIsValid(result.valid);
      setReferrerName(result.referrerName || null);

      // Store referrer name in sessionStorage for persistence
      if (result.valid && result.referrerName) {
        sessionStorage.setItem('referrerName', result.referrerName);
      }
    } catch (error) {
      console.error('Failed to validate referral code:', error);
      setIsValid(false);
      setReferrerName(null);
    } finally {
      setIsValidating(false);
    }
  };

  const applyReferralCode = async (): Promise<boolean> => {
    if (!referralCode || !isValid) {
      return false;
    }

    try {
      const result = await ApiClient.applyReferralCode(referralCode);
      if (result.success) {
        // Clear from storage after successful application
        sessionStorage.removeItem('referralCode');
        sessionStorage.removeItem('referralCodeTimestamp');
        sessionStorage.removeItem('referrerName');
      }
      return result.success;
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      return false;
    }
  };

  const clearReferralCode = () => {
    setReferralCode(null);
    setIsValid(null);
    setIsValidating(false);
    setReferrerName(null);

    // Clear from URL without causing navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  };

  return {
    referralCode,
    isValid,
    isValidating,
    referrerName,
    applyReferralCode,
    clearReferralCode
  };
}