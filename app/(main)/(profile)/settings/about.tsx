import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@constants/theme';

const MANIFESTO = `We believe social media can be different.

In a world of endless scrolling, manipulative algorithms, and digital noise, we're building something intentional. Something that respects your time, your attention, and your wellbeing.

Ripple is social media designed for humans, not engagement metrics.

Here's what we stand for:

INTENTION OVER ADDICTION
We don't use dark patterns to keep you scrolling. No infinite feeds engineered to steal your time. No notifications designed to trigger anxiety. We want you to use Ripple with purpose, then put it down and live your life.

REFLECTION OVER REACTION
Every post invites a moment of pause. Before you share, we encourage you to reflect on why. Not to police your thoughts, but to bring mindfulness to a space that usually rewards impulse. Quality over quantity. Depth over volume.

CONNECTION OVER PERFORMANCE
Social media became a stage where everyone performs for likes. We're building a space where real connection matters more than viral reach. Where your worth isn't measured in followers. Where you can be yourself without the pressure to be impressive.

TRANSPARENCY OVER MANIPULATION
No algorithm secretly deciding what you see based on what keeps you hooked. No engagement tricks borrowed from casinos. You're in control of your experience, and we'll always be honest about how Ripple works.

WELLBEING OVER GROWTH
We'd rather have users who feel better after using Ripple than users who can't stop using it. Our success is measured by the quality of connections we enable, not the time we capture. We're building a sustainable relationship with your attention.

This isn't about being anti-technology. It's about being pro-human.

We know we can't solve social media's problems overnight. But every ripple starts small. Every intentional choice matters. Every mindful moment adds up.

Join us in reimagining what social media can be.

Connect. Reflect. Ripple.`;

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>About Ripple</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Ionicons name="water" size={64} color={colors.primary[500]} />
          <Text style={styles.appName}>Ripple</Text>
          <Text style={styles.tagline}>Connect &lt;&lt;&lt;+&gt;&gt;&gt; Reflect</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.manifestoTitle}>Our Manifesto</Text>

        <Text style={styles.manifestoText}>{MANIFESTO}</Text>

        <View style={styles.footer}>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.copyright}>Made with intention</Text>
        </View>
      </ScrollView>
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
  },
  contentContainer: {
    padding: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appName: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginTop: spacing.md,
  },
  tagline: {
    fontSize: typography.fontSizes.md,
    color: colors.primary[500],
    fontWeight: typography.fontWeights.medium,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.lg,
  },
  manifestoTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  manifestoText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[700],
    lineHeight: 26,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginTop: spacing.xl,
  },
  version: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  copyright: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
});
