import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, shadows, spacing } from '@/constants/theme';

const MENU_MAX_WIDTH = 220;
const MENU_ACTION_HEIGHT = 54;
const MENU_GAP = 8;
const SCREEN_MARGIN = 16;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

interface PostActionsMenuProps {
  postId: string;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function PostActionsMenu({
  postId,
  isDeleting = false,
  onEdit,
  onDelete,
}: PostActionsMenuProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const handleOpen = () => {
    if (isDeleting) return;

    void Haptics.selectionAsync().catch(() => {});
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = Math.min(
        MENU_MAX_WIDTH,
        windowWidth - SCREEN_MARGIN * 2
      );
      const preferredLeft = x + width - menuWidth;
      const latestVisibleLeft = windowWidth - menuWidth - SCREEN_MARGIN;
      const preferredTop = y + height + MENU_GAP;
      const latestVisibleTop = windowHeight - MENU_ACTION_HEIGHT * 2 - SCREEN_MARGIN;

      setMenuPosition({
        top: Math.max(
          SCREEN_MARGIN,
          Math.min(preferredTop, latestVisibleTop)
        ),
        left: Math.max(
          SCREEN_MARGIN,
          Math.min(preferredLeft, latestVisibleLeft)
        ),
        width: menuWidth,
      });
    });
  };

  const handleEditPress = () => {
    setMenuPosition(null);
    void Haptics.selectionAsync().catch(() => {});
    onEdit();
  };

  const handleDeletePress = () => {
    setMenuPosition(null);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    onDelete();
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          style={({ pressed }) => [
            styles.trigger,
            pressed && styles.triggerPressed,
          ]}
          onPress={handleOpen}
          disabled={isDeleting}
          testID={`post-actions-trigger-${postId}`}
          accessibilityRole="button"
          accessibilityLabel="Post actions"
          accessibilityState={{
            disabled: isDeleting,
            expanded: menuPosition !== null,
          }}
          hitSlop={8}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.gray[500]}
          />
        </Pressable>
      </View>

      <Modal
        visible={menuPosition !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuPosition(null)}
      >
        <View style={styles.menuLayer} accessibilityViewIsModal>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
            onPress={() => setMenuPosition(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss post actions"
          />
          {menuPosition && (
            <View style={[styles.menuShadow, menuPosition]}>
              <BlurView intensity={65} tint="light" style={styles.menu}>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuAction,
                    pressed && styles.editActionPressed,
                  ]}
                  onPress={handleEditPress}
                  testID={`post-edit-action-${postId}`}
                  accessibilityRole="button"
                  accessibilityLabel="Edit post"
                >
                  <Ionicons
                    name="pencil-outline"
                    size={22}
                    color={colors.gray[700]}
                  />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <View style={styles.menuSeparator} />
                <Pressable
                  style={({ pressed }) => [
                    styles.menuAction,
                    pressed && styles.deleteActionPressed,
                  ]}
                  onPress={handleDeletePress}
                  testID={`post-delete-action-${postId}`}
                  accessibilityRole="button"
                  accessibilityLabel="Delete post"
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={colors.error.main}
                  />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </BlurView>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  triggerPressed: {
    backgroundColor: colors.gray[100],
  },
  menuLayer: {
    flex: 1,
  },
  menuBackdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
  },
  menuShadow: {
    position: 'absolute',
    borderRadius: 18,
    ...shadows.lg,
  },
  menu: {
    minHeight: MENU_ACTION_HEIGHT * 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  menuAction: {
    minHeight: MENU_ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  editActionPressed: {
    backgroundColor: 'rgba(243, 244, 246, 0.84)',
  },
  editText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
    backgroundColor: 'rgba(156, 163, 175, 0.32)',
  },
  deleteActionPressed: {
    backgroundColor: 'rgba(254, 226, 226, 0.84)',
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error.main,
  },
});
