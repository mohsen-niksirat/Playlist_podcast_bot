import { table, integer, text, boolean, index, sql } from 'sdk/db';

export const users = table('users', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  tgId:      integer('tg_id').unique().notNull(),
  name:      text('name'),
  username:  text('username'),
  state:     text('state'), // idle | search
  isAdmin:   boolean('is_admin').default(false),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  tgIdx: index('idx_users_tg').on(t.tgId),
}));

export const episodes = table('episodes', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  mid:         integer('mid').unique().notNull(), // Telegram message id in channel
  title:       text('title').notNull(),
  castboxUrl:  text('castbox_url'),
  tags:        text('tags'), // comma-separated tags e.g. "relax,instrumental"
  trackCount:  integer('track_count').default(0),
  orderIndex:  integer('order_index').default(0),
  createdAt:   integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  midIdx:   index('idx_episodes_mid').on(t.mid),
  orderIdx: index('idx_episodes_order').on(t.orderIndex),
}));

export const tracks = table('tracks', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  mid:        integer('mid').unique().notNull(), // Telegram message id in channel
  episodeMid: integer('episode_mid').notNull(),
  title:      text('title').notNull(),
  status:     text('status'), // e.g. "04:17, 9.8 MB"
  tags:       text('tags'), // comma-separated tags
  fileId:     text('file_id'), // Telegram cached file_id
  orderIndex: integer('order_index').default(0),
}, (t) => ({
  midIdx:   index('idx_tracks_mid').on(t.mid),
  epMidIdx: index('idx_tracks_ep_mid').on(t.episodeMid),
}));

export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value'),
});
