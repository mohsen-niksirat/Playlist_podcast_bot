import { db } from 'sdk';
import { eq, and, desc, asc, like, sql } from 'sdk/db';
import { users, episodes, tracks, settings } from 'schema';
import { SEED_EPISODES } from 'lib/seed_data';

export const ADMIN_ID = 65807806;

export const TAGS = [
  { key: 'instrumental', name: 'بیکلام و سازی', icon: '🎸' },
  { key: 'relax',        name: 'آرامش‌بخش و ملو', icon: '🧘' },
  { key: 'sad',          name: 'غمگین و دلتنگی', icon: '🍂' },
  { key: 'happy',        name: 'شاد و پرانرژی', icon: '🕺' },
  { key: 'road',         name: 'جاده‌ای و سفر', icon: '🚗' },
  { key: 'jazz',         name: 'جاز و بلوز', icon: '🎷' },
  { key: 'nostalgia',    name: 'نوستالژی و اصیل', icon: '📻' },
  { key: 'international',name: 'خارجی و ملل', icon: '🌍' },
];

export async function getOrCreateUser(tgUser) {
  let user = await db.select().from(users).where(eq(users.tgId, tgUser.id)).get();
  if (user) {
    if (tgUser.id === ADMIN_ID && !user.isAdmin) {
      await db.update(users).set({ isAdmin: true }).where(eq(users.tgId, tgUser.id)).run();
      user.isAdmin = true;
    }
    return { user, isNew: false };
  }

  const isAdmin = tgUser.id === ADMIN_ID;
  const [created] = await db
    .insert(users)
    .values({
      tgId: tgUser.id,
      name: tgUser.first_name || '',
      username: tgUser.username || '',
      state: 'idle',
      isAdmin: isAdmin,
    })
    .returning()
    .run();

  return { user: created, isNew: true };
}

export async function setUserState(tgId, state) {
  await db.update(users).set({ state }).where(eq(users.tgId, tgId)).run();
}

export async function getUser(tgId) {
  return db.select().from(users).where(eq(users.tgId, tgId)).get();
}

export async function seedDatabaseIfNeeded(forceRefresh = false) {
  const row = await db.select({ count: sql`count(*)` }).from(episodes).get();
  const currentCount = row ? Number(row.count) : 0;

  // Check if we need to refresh titles or tags
  let needsTitleUpdate = false;
  if (currentCount > 0) {
    const sample = await db.select().from(episodes).where(eq(episodes.mid, 8521)).get();
    if (sample && (sample.title.includes('پلی') || !sample.tags)) {
      needsTitleUpdate = true;
    }
  }

  if (currentCount >= SEED_EPISODES.length && !forceRefresh && !needsTitleUpdate) {
    return { seeded: false, count: currentCount };
  }

  if (needsTitleUpdate || forceRefresh) {
    // Delete existing records to re-seed cleanly with tags and clean titles
    await db.delete(episodes).run();
    await db.delete(tracks).run();
  }

  // Insert episodes in chunks of 50
  for (let i = 0; i < SEED_EPISODES.length; i += 50) {
    const chunk = SEED_EPISODES.slice(i, i + 50);
    const epValues = chunk.map((ep) => ({
      mid: ep.mid,
      title: ep.title,
      castboxUrl: ep.castboxUrl || '',
      tags: ep.tags ? ep.tags.join(',') : '',
      trackCount: ep.tracks ? ep.tracks.length : 0,
      orderIndex: ep.orderIndex,
    }));
    await db.insert(episodes).values(epValues).run();
  }

  // Insert tracks in chunks of 100
  const allTracks = [];
  for (const ep of SEED_EPISODES) {
    if (ep.tracks && ep.tracks.length > 0) {
      for (const t of ep.tracks) {
        allTracks.push({
          mid: t.mid,
          episodeMid: ep.mid,
          title: t.title,
          status: t.status || '',
          tags: t.tags ? t.tags.join(',') : '',
          orderIndex: t.orderIndex || 0,
        });
      }
    }
  }

  for (let i = 0; i < allTracks.length; i += 100) {
    const chunk = allTracks.slice(i, i + 100);
    await db.insert(tracks).values(chunk).run();
  }

  return { seeded: true, episodes: SEED_EPISODES.length, tracks: allTracks.length };
}

export async function getEpisodes(page = 1, limit = 10) {
  const countRow = await db.select({ count: sql`count(*)` }).from(episodes).get();
  const totalCount = countRow ? Number(countRow.count) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * limit;

  const rows = await db
    .select()
    .from(episodes)
    .orderBy(desc(episodes.orderIndex))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    episodes: rows,
    page: safePage,
    totalPages,
    totalCount,
  };
}

export async function getEpisodeByMid(mid) {
  return db.select().from(episodes).where(eq(episodes.mid, mid)).get();
}

export async function getTracksByEpisodeMid(epMid) {
  return db
    .select()
    .from(tracks)
    .where(eq(tracks.episodeMid, epMid))
    .orderBy(asc(tracks.orderIndex))
    .all();
}

export async function getTrackByMid(trackMid) {
  return db.select().from(tracks).where(eq(tracks.mid, trackMid)).get();
}

export async function updateTrackFileId(trackMid, fileId) {
  await db.update(tracks).set({ fileId }).where(eq(tracks.mid, trackMid)).run();
}

export async function getRandomTracksByTag(tagKey, limit = 5) {
  const pattern = `%${tagKey}%`;
  return db
    .select()
    .from(tracks)
    .where(like(tracks.tags, pattern))
    .orderBy(sql`RANDOM()`)
    .limit(limit)
    .all();
}

export async function getEpisodesByTag(tagKey, page = 1, limit = 10) {
  const pattern = `%${tagKey}%`;
  const countRow = await db
    .select({ count: sql`count(*)` })
    .from(episodes)
    .where(like(episodes.tags, pattern))
    .get();

  const totalCount = countRow ? Number(countRow.count) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * limit;

  const rows = await db
    .select()
    .from(episodes)
    .where(like(episodes.tags, pattern))
    .orderBy(desc(episodes.orderIndex))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    episodes: rows,
    page: safePage,
    totalPages,
    totalCount,
  };
}

export async function searchContent(query, limit = 10) {
  if (!query || !query.trim()) return { episodes: [], tracks: [] };
  const pattern = `%${query.trim()}%`;

  const epResults = await db
    .select()
    .from(episodes)
    .where(like(episodes.title, pattern))
    .orderBy(desc(episodes.orderIndex))
    .limit(limit)
    .all();

  const trResults = await db
    .select()
    .from(tracks)
    .where(like(tracks.title, pattern))
    .limit(limit)
    .all();

  return {
    episodes: epResults,
    tracks: trResults,
  };
}

export async function getRandomEpisode() {
  const rows = await db
    .select()
    .from(episodes)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .all();
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function getRandomTrack() {
  const rows = await db
    .select()
    .from(tracks)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .all();
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function getStats() {
  const uRow = await db.select({ count: sql`count(*)` }).from(users).get();
  const eRow = await db.select({ count: sql`count(*)` }).from(episodes).get();
  const tRow = await db.select({ count: sql`count(*)` }).from(tracks).get();
  const cRow = await db
    .select({ count: sql`count(*)` })
    .from(tracks)
    .where(sql`file_id IS NOT NULL`)
    .get();

  return {
    users: uRow ? Number(uRow.count) : 0,
    episodes: eRow ? Number(eRow.count) : 0,
    tracks: tRow ? Number(tRow.count) : 0,
    cachedTracks: cRow ? Number(cRow.count) : 0,
  };
}
