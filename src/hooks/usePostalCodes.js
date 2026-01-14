// src/hooks/usePostalCodes.js
import { useState, useEffect, useCallback } from 'react';

let cachedPostalData = null; // Global cache — app mein ek baar load hoga

export const usePostalCodes = () => {
  const [postalData, setPostalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPostalData = async () => {
      // Agar cache mein hai toh direct use kar
      if (cachedPostalData) {
        setPostalData(cachedPostalData);
        setLoading(false);
        return;
      }

      try {
        // Cache busting optional — agar zaroorat na ho toh hata sakta hai
        const response = await fetch('/postal_codes.json');

        if (!response.ok) {
          throw new Error('Failed to load postal_codes.json');
        }

        const data = await response.json();

        // Cache kar do for future use
        cachedPostalData = data;
        setPostalData(data);
        setLoading(false);
      } catch (err) {
        console.error('Postal codes load error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadPostalData();
  }, []);

  // Helper: Postal code (7 digits) se address details nikaal
  const findAddressByPostalCode = useCallback((postalCode) => {
    if (!postalData || !postalCode) return null;

    // Clean input: sirf numbers, 7 digits
    const cleanCode = postalCode.toString().replace(/[^0-9]/g, '');

    if (cleanCode.length !== 7) return null;

    // Exact match dhoondho (tere JSON mein field hai: "postal_code")
    return postalData.find(entry => entry.postal_code === cleanCode) || null;
  }, [postalData]);

  return {
    postalData,        // Poora array agar kahin iterate karna ho
    loading,
    error,
    findAddressByPostalCode
  };
};