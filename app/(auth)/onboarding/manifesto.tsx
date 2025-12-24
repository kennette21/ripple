import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/ui';
import { colors, spacing, typography } from '@constants/theme';

export default function ManifestoScreen() {
  const handleContinue = () => {
    router.push('/(auth)/onboarding/profile-setup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="water" size={48} color={colors.primary[500]} />
          <Text style={styles.title}>The Ripple Manifesto</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.boldText}>Social media is broken.</Text>
          <Text style={styles.bodyText}>
            You feel it every time you open your feed: endless content engineered to keep you scrolling, ads disguised as posts, and algorithms that reward outrage, envy, and noise. What started as a way to stay connected has become something that fragments our attention and quietly erodes our well-being.
          </Text>
          <Text style={styles.bodyText}>
            Many of us have already abandoned our profiles in frustration.
          </Text>
          <Text style={styles.bodyText}>
            And yet - staying meaningfully connected to the people we love has never mattered more.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.bodyText}>
            That's why we made <Text style={styles.boldText}>Ripple</Text>.
          </Text>
          <Text style={styles.bodyText}>
            Ripple is simple. It's clean. And it's intentionally focused.
          </Text>
          <Text style={styles.bodyText}>
            A place for real friends to share real life — without ads, without algorithms, and without the pressure to perform. Ripple feels less like a stage and more like a quiet pond, where each post sends a gentle ripple outward to the people who care.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.emphasizedText}>Connection is the heart of Ripple.</Text>
          <Text style={styles.emphasizedText}>Reflection is what gives it depth.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.bodyText}>
            For those who want it, each post can include a private or shared journal-style reflection. This space is yours — to capture gratitude, context, or meaning beyond the image itself. Over time, these reflections can turn Ripple into something cherished: a living photo-journal of your life and friendships, preserved without distraction.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Here's how Ripple works:</Text>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletTitle}>A subscription model — $5/month or $50/year.</Text>
            <Text style={styles.bulletText}>
              No ads means no incentives to hijack your attention. When you aren't the product, the experience can finally serve you.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletTitle}>Only real friends</Text>
            <Text style={styles.bulletText}>
              Connections require phone numbers and mutual consent. No companies. No influencers. Just people you actually know.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletTitle}>Our currency is connection — not time spent</Text>
            <Text style={styles.bulletText}>
              Ripple is designed to be used about one hour per week. We encourage posting about once per week—enough to stay meaningfully in touch, without turning the pond into choppy water.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletTitle}>No likes. No comments. No messaging.</Text>
            <Text style={styles.bulletText}>
              If something moves you, that's a reason to reach out directly. Text them. Call them. Have a real conversation.
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bulletTitle}>No AI</Text>
            <Text style={styles.bulletText}>
              Nothing here is generated, ranked, or optimized. Every post comes from a person, shared with intention.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our promise to you:</Text>

          <Text style={styles.bodyText}>
            We will never sell your data. <Text style={styles.boldText}>Ever.</Text> What you share on Ripple is private and will never be monetized.
          </Text>
          <Text style={styles.bodyText}>
            Ripple will never be sold to investors. Control will remain with the people who built it and use it.
          </Text>
          <Text style={styles.bodyText}>
            These commitments aren't marketing language - they're embedded in Ripple's founding documents, so they can't be quietly undone.
          </Text>
        </View>

        <View style={styles.closing}>
          <Text style={styles.bodyText}>
            We want Ripple to be something that makes it easier to stay close.
          </Text>
          <Text style={styles.bodyText}>
            Something that gives far more than it takes.
          </Text>
          <Text style={styles.bodyText}>
            Something you trust.
          </Text>
          <Text style={[styles.bodyText, styles.gratitude]}>
            We're grateful you're here.
          </Text>
          <Text style={styles.thankYou}>
            Thank you for being a good friend.
          </Text>
        </View>

        <View style={styles.signature}>
          <Text style={styles.signatureNames}>Gator & Tom</Text>
          <Text style={styles.signatureRipple}>Ripple</Text>
          <Text style={styles.motto}>Connect {'<<<'}+{'>>>'} Reflect</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="I'm Ready"
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  bodyText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[700],
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  boldText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  emphasizedText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bulletItem: {
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[200],
  },
  bulletTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  bulletText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[600],
    lineHeight: 22,
  },
  closing: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  gratitude: {
    marginTop: spacing.md,
  },
  thankYou: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginTop: spacing.sm,
  },
  signature: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  signatureNames: {
    fontSize: typography.fontSizes.md,
    fontStyle: 'italic',
    color: colors.gray[600],
  },
  signatureRipple: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
  motto: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary[400],
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
});
