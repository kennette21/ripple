import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing } from '@/constants/theme';
import type { CommentWithAuthor } from '@/hooks/comments/useComments';

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId?: string;
  onReply?: (comment: CommentWithAuthor) => void;
  onDelete?: (commentId: string) => void;
  isReply?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const router = useRouter();
  const [showReplies, setShowReplies] = useState(true);

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const commentAuthorId = (comment as any).author_id;
  const isOwnComment = commentAuthorId === currentUserId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const handleProfilePress = () => {
    router.push(`/user/${commentAuthorId}`);
  };

  return (
    <View style={[styles.container, isReply && styles.replyContainer]}>
      <Pressable onPress={handleProfilePress}>
        <Avatar
          uri={comment.author.avatar_url}
          name={comment.author.display_name || comment.author.username}
          size={isReply ? 'sm' : 'md'}
        />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={handleProfilePress}>
            <Text style={styles.username}>
              {comment.author.display_name || comment.author.username}
            </Text>
          </Pressable>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        <Text style={styles.text}>{comment.content}</Text>

        <View style={styles.actions}>
          {!isReply && onReply && (
            <Pressable style={styles.actionButton} onPress={() => onReply(comment)}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
          )}

          {isOwnComment && onDelete && (
            <Pressable style={styles.actionButton} onPress={() => onDelete(comment.id)}>
              <Ionicons name="trash-outline" size={14} color={colors.error.main} />
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
            </Pressable>
          )}
        </View>

        {/* Replies */}
        {hasReplies && (
          <View style={styles.repliesSection}>
            {comment.replies!.length > 2 && (
              <Pressable onPress={() => setShowReplies(!showReplies)}>
                <Text style={styles.showReplies}>
                  {showReplies
                    ? 'Hide replies'
                    : `Show ${comment.replies!.length} replies`
                  }
                </Text>
              </Pressable>
            )}

            {showReplies && comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onDelete={onDelete}
                isReply
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  replyContainer: {
    marginLeft: spacing.xs,
    paddingTop: spacing.sm,
  },
  content: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[900],
  },
  time: {
    fontSize: 12,
    color: colors.gray[500],
  },
  text: {
    fontSize: 14,
    color: colors.gray[900],
    lineHeight: 20,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionText: {
    fontSize: 12,
    color: colors.gray[500],
  },
  deleteText: {
    color: colors.error.main,
  },
  repliesSection: {
    marginTop: spacing.xs,
  },
  showReplies: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '500',
    paddingVertical: spacing.xs,
  },
});
