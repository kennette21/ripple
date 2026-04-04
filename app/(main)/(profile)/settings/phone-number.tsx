import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/ui';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

export default function PhoneNumberScreen() {
  const { profile, refreshProfile, user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneInput = (text: string) => {
    // Strip non-digits
    const digits = text.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleChange = (text: string) => {
    setPhoneNumber(formatPhoneInput(text));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Extract just digits for storage
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await (supabase
        .from('profiles') as any)
        .update({ phone_number: digits })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Saved', 'Your phone number has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save phone number.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;

    Alert.alert(
      'Remove Phone Number',
      'Your friends won\'t be able to find you through their contacts anymore.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const { error } = await (supabase
                .from('profiles') as any)
                .update({ phone_number: null })
                .eq('id', user.id);
              if (error) throw error;
              await refreshProfile();
              setPhoneNumber('');
              Alert.alert('Removed', 'Your phone number has been removed.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Phone Number</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary[500]} />
          <Text style={styles.infoText}>
            Adding your phone number lets your contacts find you on Ripple. Only people who have your number in their phone can send you a friend request.
          </Text>
        </View>

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={handleChange}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.gray[400]}
          keyboardType="phone-pad"
          maxLength={14}
        />

        <Button
          title="Save"
          onPress={handleSave}
          loading={isLoading}
          disabled={phoneNumber.replace(/\D/g, '').length !== 10}
          style={styles.saveButton}
        />

        {profile?.phone_number && (
          <TouchableOpacity onPress={handleRemove} style={styles.removeButton}>
            <Text style={styles.removeText}>Remove Phone Number</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  info: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  input: {
    fontSize: typography.fontSizes.lg,
    color: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    letterSpacing: 1,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  removeButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  removeText: {
    fontSize: typography.fontSizes.sm,
    color: colors.error.main,
  },
});
