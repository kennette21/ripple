import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/ui';
import { colors, spacing, typography } from '@constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideData {
  id: string;
  content: React.ReactNode;
}

// Styles must be defined before SLIDES since SLIDES references them
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  slideSubtitle: {
    fontSize: typography.fontSizes.lg,
    color: colors.gray[600],
    marginTop: spacing.md,
  },
  slideBoldText: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  slideBodyText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[700],
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  slideEmphasis: {
    fontSize: typography.fontSizes.md,
    fontStyle: 'italic',
    color: colors.primary[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  slideLargeEmphasis: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  boldInline: {
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  bulletItem: {
    width: '100%',
    marginBottom: spacing.lg,
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[300],
  },
  bulletTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.xs,
  },
  bulletSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary[500],
    fontWeight: typography.fontWeights.medium,
    marginBottom: spacing.xs,
  },
  bulletText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[600],
    lineHeight: 20,
  },
  closingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gratitude: {
    marginTop: spacing.lg,
  },
  thankYou: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  signature: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  signatureNames: {
    fontSize: typography.fontSizes.md,
    fontStyle: 'italic',
    color: colors.gray[600],
  },
  motto: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[500],
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[300],
  },
  dotActive: {
    backgroundColor: colors.primary[500],
    width: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  nextButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[500],
    marginRight: spacing.xs,
  },
  continueButton: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
});

const SLIDES: SlideData[] = [
  {
    id: '1',
    content: (
      <View style={styles.slide}>
        <Ionicons name="water" size={64} color={colors.primary[500]} />
        <Text style={styles.slideTitle}>The Ripple Manifesto</Text>
        <Text style={styles.slideBoldText}>Social media is broken.</Text>
        <Text style={styles.slideBodyText}>
          You feel it every time you open your feed: endless content engineered to keep you scrolling, ads disguised as posts, and algorithms that reward outrage, envy, and noise.
        </Text>
        <Text style={styles.slideBodyText}>
          Many of us have already abandoned our profiles in frustration. And yet - staying meaningfully connected to the people we love has never mattered more.
        </Text>
      </View>
    ),
  },
  {
    id: '2',
    content: (
      <View style={styles.slide}>
        <Ionicons name="sparkles" size={64} color={colors.primary[500]} />
        <Text style={styles.slideSubtitle}>That's why we made</Text>
        <Text style={styles.slideTitle}>Ripple</Text>
        <Text style={styles.slideBodyText}>
          Ripple is simple. It's clean. And it's intentionally focused.
        </Text>
        <Text style={styles.slideBodyText}>
          A place for real friends to share real life — without ads, without algorithms, and without the pressure to perform.
        </Text>
        <Text style={styles.slideEmphasis}>
          Ripple feels less like a stage and more like a quiet pond, where each post sends a gentle ripple outward to the people who care.
        </Text>
      </View>
    ),
  },
  {
    id: '3',
    content: (
      <View style={styles.slide}>
        <Ionicons name="heart" size={64} color={colors.primary[500]} />
        <Text style={styles.slideLargeEmphasis}>Connection is the heart of Ripple.</Text>
        <Text style={styles.slideLargeEmphasis}>Reflection is what gives it depth.</Text>
        <Text style={[styles.slideBodyText, { marginTop: spacing.lg }]}>
          Each post can include a private or shared journal-style reflection. This space is yours — to capture gratitude, context, or meaning beyond the image itself.
        </Text>
        <Text style={styles.slideBodyText}>
          Over time, Ripple becomes a living photo-journal of your life and friendships, preserved without distraction.
        </Text>
      </View>
    ),
  },
  {
    id: '4',
    content: (
      <View style={styles.slide}>
        <Text style={styles.slideTitle}>How Ripple Works</Text>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletTitle}>A subscription model</Text>
          <Text style={styles.bulletSubtitle}>$5/month or $50/year</Text>
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
      </View>
    ),
  },
  {
    id: '5',
    content: (
      <View style={styles.slide}>
        <Text style={styles.slideTitle}>Designed for Wellbeing</Text>
        <View style={styles.bulletItem}>
          <Text style={styles.bulletTitle}>Our currency is connection — not time spent</Text>
          <Text style={styles.bulletText}>
            Ripple is designed to be used about one hour per week. We encourage posting about once per week—enough to stay meaningfully in touch.
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
    ),
  },
  {
    id: '6',
    content: (
      <View style={styles.slide}>
        <Ionicons name="shield-checkmark" size={64} color={colors.primary[500]} />
        <Text style={styles.slideTitle}>Our Promise</Text>
        <Text style={styles.slideBodyText}>
          We will never sell your data. <Text style={styles.boldInline}>Ever.</Text> What you share on Ripple is private and will never be monetized.
        </Text>
        <Text style={styles.slideBodyText}>
          Ripple will never be sold to investors. Control will remain with the people who built it and use it.
        </Text>
        <Text style={styles.slideEmphasis}>
          These commitments aren't marketing language - they're embedded in Ripple's founding documents.
        </Text>
      </View>
    ),
  },
  {
    id: '7',
    content: (
      <View style={styles.slide}>
        <View style={styles.closingContent}>
          <Text style={styles.slideBodyText}>
            We want Ripple to be something that makes it easier to stay close.
          </Text>
          <Text style={styles.slideBodyText}>
            Something that gives far more than it takes.
          </Text>
          <Text style={styles.slideBodyText}>
            Something you trust.
          </Text>
          <Text style={[styles.slideBodyText, styles.gratitude]}>
            We're grateful you're here.
          </Text>
          <Text style={styles.thankYou}>
            Thank you for being a good friend.
          </Text>
        </View>
        <View style={styles.signature}>
          <Text style={styles.signatureNames}>Gator & Tom</Text>
          <Ionicons name="water" size={32} color={colors.primary[500]} style={{ marginVertical: spacing.sm }} />
          <Text style={styles.motto}>Connect {'<<<'}+{'>>>'} Reflect</Text>
        </View>
      </View>
    ),
  },
];

export default function ManifestoScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleContinue = () => {
    router.push('/(auth)/onboarding/profile-setup');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slideContainer}>
            {item.content}
          </View>
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Dot indicators */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Navigation footer */}
      <View style={styles.footer}>
        {currentIndex > 0 ? (
          <Pressable onPress={handlePrevious} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.gray[600]} />
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}

        {isLastSlide ? (
          <Button
            title="I'm Ready"
            onPress={handleContinue}
            style={styles.continueButton}
          />
        ) : (
          <Pressable onPress={handleNext} style={styles.nextButton}>
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary[500]} />
          </Pressable>
        )}

        {currentIndex > 0 && !isLastSlide ? (
          <Pressable onPress={handleNext} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.gray[600]} />
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
      </View>
    </SafeAreaView>
  );
}
