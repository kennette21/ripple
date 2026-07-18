import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
} from 'react-native';

interface CommentComposerScrollResponder {
  scrollResponderScrollNativeHandleToKeyboard: (
    nodeHandle: View,
    additionalOffset?: number,
    preventNegativeScrollOffset?: boolean
  ) => void;
}

interface MeasurableScrollView {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
}

const COMPOSER_KEYBOARD_GAP = 16;

export function useCommentThreadController<ItemT>() {
  const listRef = useRef<FlatList<ItemT>>(null);
  const [activeCommentThreadId, setActiveCommentThreadId] = useState<
    string | null
  >(null);
  const activeComposerRef = useRef<View | null>(null);
  const currentListOffsetRef = useRef(0);
  const isKeyboardVisibleRef = useRef(false);

  const revealActiveComposer = useCallback((onPositioned?: () => void) => {
    const composer = activeComposerRef.current;
    const list = listRef.current;
    const finishPositioning = () => {
      if (onPositioned) {
        requestAnimationFrame(onPositioned);
      }
    };

    if (!composer || !list) {
      finishPositioning();
      return;
    }

    const nativeScrollView = list.getNativeScrollRef() as
      | MeasurableScrollView
      | undefined;
    if (!nativeScrollView?.measureInWindow) {
      finishPositioning();
      return;
    }

    nativeScrollView.measureInWindow((_listX, listY, _listWidth, listHeight) => {
      composer.measureInWindow((_x, composerY, _width, composerHeight) => {
        if (activeComposerRef.current !== composer) {
          finishPositioning();
          return;
        }

        const visibleTop = listY + COMPOSER_KEYBOARD_GAP;
        const visibleBottom = listY + listHeight - COMPOSER_KEYBOARD_GAP;
        const composerBottom = composerY + composerHeight;
        let offsetDelta = 0;

        if (composerBottom > visibleBottom) {
          offsetDelta = composerBottom - visibleBottom;
        } else if (composerY < visibleTop) {
          offsetDelta = composerY - visibleTop;
        }

        if (Math.abs(offsetDelta) >= 1) {
          list.scrollToOffset({
            offset: Math.max(0, currentListOffsetRef.current + offsetDelta),
            animated: false,
          });
        }

        finishPositioning();
      });
    });
  }, []);

  const positionActiveComposer = useCallback(() => {
    const composer = activeComposerRef.current;
    const list = listRef.current;
    if (!composer || !list) return;

    if (!isKeyboardVisibleRef.current) {
      revealActiveComposer();
      return;
    }

    const scrollResponder = list.getScrollResponder() as
      | CommentComposerScrollResponder
      | undefined;
    const nativeScrollView = list.getNativeScrollRef() as
      | MeasurableScrollView
      | undefined;

    if (!scrollResponder) return;

    const scrollWithListOffset = (listTop = 0) => {
      scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
        composer,
        listTop + COMPOSER_KEYBOARD_GAP,
        true
      );
    };

    if (nativeScrollView?.measureInWindow) {
      nativeScrollView.measureInWindow((_x, y) => scrollWithListOffset(y));
    } else {
      scrollWithListOffset();
    }
  }, [revealActiveComposer]);

  const scheduleComposerPosition = useCallback(() => {
    requestAnimationFrame(() => {
      positionActiveComposer();
    });
  }, [positionActiveComposer]);

  const scrollToCommentComposer = useCallback(
    (composer: View, onPositioned?: () => void) => {
      activeComposerRef.current = composer;

      if (!isKeyboardVisibleRef.current) {
        revealActiveComposer(onPositioned);
        return;
      }

      scheduleComposerPosition();
      if (onPositioned) {
        requestAnimationFrame(onPositioned);
      }
    },
    [revealActiveComposer, scheduleComposerPosition]
  );

  const handleCommentListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentListOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  useEffect(() => {
    const handleKeyboardShow = () => {
      isKeyboardVisibleRef.current = true;
      scheduleComposerPosition();
    };
    const handleKeyboardHide = () => {
      isKeyboardVisibleRef.current = false;
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
      Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
    ];

    return () =>
      subscriptions.forEach((subscription) => subscription.remove());
  }, [scheduleComposerPosition]);

  const handleActiveCommentThreadChange = useCallback(
    (postId: string | null) => {
      if (!postId) {
        activeComposerRef.current = null;
      }
      setActiveCommentThreadId(postId);
    },
    []
  );

  return {
    activeCommentThreadId,
    handleCommentListScroll,
    listRef,
    scrollToCommentComposer,
    setActiveCommentThreadId: handleActiveCommentThreadChange,
  };
}
