import { Plus, RefreshCw } from 'lucide-react';
import type { Post } from '../../types';
import PostCard from '../../features/community/PostCard';
import { ScreenHeading } from './shared';
export type FeedFilter = 'all' | 'following' | 'video' | 'mine';
export default function Community({
  posts,
  userId,
  busy,
  filter,
  following,
  onFilter,
  onCompose,
  onRefresh,
  onLike,
  onComment,
  onDelete,
  onShare,
  onFollow,
  focusedId,
}: {
  posts: Post[];
  userId: string;
  busy: boolean;
  filter: FeedFilter;
  following: string[];
  focusedId?: string;
  onFilter: (filter: FeedFilter) => void;
  onCompose: () => void;
  onRefresh: () => void;
  onLike: (post: Post) => void;
  onComment: (post: Post, text: string) => Promise<boolean>;
  onDelete: (post: Post) => void;
  onShare: (post: Post) => void;
  onFollow: (id: string) => void;
}) {
  const visible = posts
    .filter(
      (p) =>
        (!focusedId || p.id === focusedId) &&
        (filter !== 'mine' || p.userId === userId) &&
        (filter !== 'video' || p.mediaType?.startsWith('video/')) &&
        (filter !== 'following' || following.includes(p.userId)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="ascend-community">
      <div className="ascend-heading-row">
        <ScreenHeading title="커뮤니티" />
        <button className="ascend-round-button dark" aria-label="게시글 작성" onClick={onCompose}>
          <Plus size={24} />
        </button>
      </div>
      <div className="ascend-feed-tabs">
        <div className="ascend-pills">
          {[
            { id: 'all', label: '전체' },
            { id: 'following', label: '팔로잉' },
            ...(filter === 'mine' ? [{ id: 'mine', label: '내 글' }] : []),
          ].map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? 'selected' : ''}
              aria-pressed={filter === item.id}
              onClick={() => onFilter(item.id as FeedFilter)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          aria-label="피드 새로고침"
          onClick={onRefresh}
          disabled={busy}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {userId === 'local-demo' && <p className="ascend-local-note">이 기기에 저장하는 데모 피드</p>}
      {focusedId && (
        <button className="text-button" onClick={() => onFilter('all')}>
          전체 피드로 돌아가기
        </button>
      )}
      {visible.length ? (
        visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userId={userId}
            busy={busy}
            onLike={() => onLike(post)}
            onComment={(text) => onComment(post, text)}
            onDelete={() => onDelete(post)}
            onShare={() => onShare(post)}
            following={following.includes(post.userId)}
            onFollow={() => onFollow(post.userId)}
          />
        ))
      ) : (
        <section className="ascend-card empty-state">
          <Plus size={30} />
          <h2>
            {filter === 'following' ? '팔로우한 사람의 기록을 모아요' : '첫 번째 이야기를 기다려요'}
          </h2>
          <p>
            {filter === 'following'
              ? '전체 피드에서 함께할 사람을 팔로우해 보세요.'
              : '오늘의 재활 활동과 작은 변화를 나눠 보세요.'}
          </p>
          <button
            className="primary"
            onClick={filter === 'following' ? () => onFilter('all') : onCompose}
          >
            {filter === 'following' ? '전체 피드 보기' : '이야기 나누기'}
          </button>
        </section>
      )}
    </div>
  );
}
