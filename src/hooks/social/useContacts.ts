import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Contacts from 'expo-contacts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from '@/types/database';

export interface ContactMatch extends Profile {
  contactName: string;
}

// Normalize phone number to digits only (strip formatting)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // If 11 digits starting with 1 (US), strip the leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  // If 10 digits, return as-is
  if (digits.length === 10) {
    return digits;
  }
  return digits;
}

// Fetch device contacts and find which ones are on Ripple
async function findContactsOnRipple(userId: string): Promise<ContactMatch[]> {
  // Queries (including retries and refetches) must never open a permission prompt.
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') {
    return [];
  }

  const { data: contacts } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  if (!contacts || contacts.length === 0) return [];

  // Build a map of normalized phone -> contact name
  const phoneToName = new Map<string, string>();
  for (const contact of contacts) {
    if (!contact.phoneNumbers) continue;
    const name = contact.name || 'Unknown';
    for (const phone of contact.phoneNumbers) {
      if (phone.number) {
        const normalized = normalizePhone(phone.number);
        if (normalized.length >= 10) {
          phoneToName.set(normalized, name);
        }
      }
    }
  }

  if (phoneToName.size === 0) return [];

  // Get all profiles with phone numbers (excluding self)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .not('phone_number', 'is', null)
    .neq('id', userId);

  if (error) throw error;
  if (!profiles) return [];

  // Match profiles against contacts
  const matches: ContactMatch[] = [];
  for (const profile of profiles as Profile[]) {
    if (!profile.phone_number) continue;
    const normalizedProfilePhone = normalizePhone(profile.phone_number);
    const contactName = phoneToName.get(normalizedProfilePhone);
    if (contactName) {
      matches.push({ ...profile, contactName });
    }
  }

  return matches;
}

export function useContactsOnRipple(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.friends.contacts(userId || ''),
    queryFn: () => findContactsOnRipple(userId!),
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRequestContactsPermission() {
  const [permission, setPermission] = useState<Contacts.ContactsPermissionResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requesting = useRef(false);

  const checkPermission = useCallback(async () => {
    try {
      const next = await Contacts.getPermissionsAsync();
      setPermission(next);
      setError(null);
      return next.status === 'granted';
    } catch (error) {
      setError(error);
      // Do not keep displaying cached contacts if access cannot be verified.
      setPermission(null);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (requesting.current) return false;
    requesting.current = true;
    setIsRequesting(true);
    try {
      const next = await Contacts.requestPermissionsAsync();
      setPermission(next);
      setError(null);
      return next.status === 'granted';
    } catch (error) {
      setError(error);
      return false;
    } finally {
      requesting.current = false;
      setIsRequesting(false);
    }
  }, []);

  useEffect(() => {
    // State changes follow the asynchronous native permission read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkPermission();
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && previousState !== 'active') void checkPermission();
      previousState = state;
    });
    return () => subscription.remove();
  }, [checkPermission]);

  return { permission, isChecking, isRequesting, error, requestPermission, checkPermission };
}
