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

let isDbSeeded = false;

export async function seedDatabaseIfNeeded(forceRefresh = false) {
  if (isDbSeeded && !forceRefresh) {
    return { seeded: false };
  }

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
    isDbSeeded = true;
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

  isDbSeeded = true;
  return { seeded: true, episodes: SEED_EPISODES.length, tracks: allTracks.length };
}

export function normalizeTrack(t) {
  if (!t) return null;
  const fid = t.fileId || t.file_id || null;
  return {
    ...t,
    fileId: fid,
    file_id: fid,
    episodeMid: t.episodeMid ?? t.episode_mid ?? 0,
    episode_mid: t.episode_mid ?? t.episodeMid ?? 0,
    orderIndex: t.orderIndex ?? t.order_index ?? 0,
    order_index: t.order_index ?? t.orderIndex ?? 0,
  };
}

export function normalizeEpisode(e) {
  if (!e) return null;
  const cb = e.castboxUrl || e.castbox_url || '';
  const tc = e.trackCount ?? e.track_count ?? 0;
  const oi = e.orderIndex ?? e.order_index ?? 0;
  return {
    ...e,
    castboxUrl: cb,
    castbox_url: cb,
    trackCount: tc,
    track_count: tc,
    orderIndex: oi,
    order_index: oi,
  };
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
    episodes: rows.map(normalizeEpisode),
    page: safePage,
    totalPages,
    totalCount,
  };
}

export async function getEpisodeByMid(mid) {
  const row = await db.select().from(episodes).where(eq(episodes.mid, mid)).get();
  return normalizeEpisode(row);
}

export async function getTracksByEpisodeMid(epMid) {
  const rows = await db
    .select()
    .from(tracks)
    .where(eq(tracks.episodeMid, epMid))
    .orderBy(asc(tracks.orderIndex))
    .all();
  const normalized = rows.map(normalizeTrack);
  for (const t of normalized) {
    if (!t.fileId && t.title) {
      const sibling = await getCachedSibling(t.title);
      if (sibling && sibling.fileId) {
        t.fileId = sibling.fileId;
        t.file_id = sibling.fileId;
        if (sibling.contributor) t.contributor = sibling.contributor;
      }
    }
  }
  return normalized;
}

export async function getTrackByMid(trackMid) {
  const row = await db.select().from(tracks).where(eq(tracks.mid, trackMid)).get();
  return normalizeTrack(row);
}

/**
 * Find if the same song title is already cached in another episode.
 * Over 682 songs appear across multiple episodes in the Playlist archive.
 */
export async function getCachedSibling(title) {
  if (!title) return null;
  const row = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.title, title), sql`file_id IS NOT NULL`))
    .limit(1)
    .get();
  return normalizeTrack(row);
}

/**
 * Smart track matcher: Fingerprints audio by MID, Artist, Title, Duration, and File Size.
 * Enables automatic caching even when posts were forwarded from a personal chat (e.g. Mokhtar Razmjoo)
 * or when Telegram strips the forward_from_message_id.
 */
export async function findMatchingTrack({ mid, performer, title, fileName, duration, fileSize }) {
  // 1. Direct MID match if forwarded directly from channel
  if (mid) {
    const direct = await db.select().from(tracks).where(eq(tracks.mid, mid)).get();
    if (direct) return direct;
  }

  // 2. Format duration and size fingerprints
  const durM = Math.floor((duration || 0) / 60);
  const durS = String((duration || 0) % 60).padStart(2, '0');
  const durStr1 = `${String(durM).padStart(2, '0')}:${durS}`; // e.g. "04:29"
  const durStr2 = `${durM}:${durS}`;                           // e.g. "4:29"
  const sizeMb = fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : '';

  const perfClean = (performer || '').trim();
  const titleClean = (title || '').trim();
  const fileClean = (fileName || '').replace(/\.[^/.]+$/, '').trim();

  // 3. Search database for candidates
  let candidates = [];
  if (perfClean && titleClean) {
    candidates = await db
      .select()
      .from(tracks)
      .where(and(like(tracks.title, `%${perfClean}%`), like(tracks.title, `%${titleClean}%`)))
      .all();
  }

  if (candidates.length === 0 && (titleClean || fileClean)) {
    const q = titleClean || fileClean;
    if (q.length >= 2) {
      candidates = await db
        .select()
        .from(tracks)
        .where(like(tracks.title, `%${q}%`))
        .all();
    }
  }

  if (candidates.length === 0 && perfClean && perfClean.length >= 2) {
    candidates = await db
      .select()
      .from(tracks)
      .where(like(tracks.title, `%${perfClean}%`))
      .all();
  }

  if (candidates.length === 0) return null;

  // 4. Score candidates
  const scored = candidates.map((t) => {
    let score = 0;
    const tTitle = (t.title || '').toLowerCase();
    const tStatus = t.status || '';

    // Duration match (+50)
    if (duration && (tStatus.includes(durStr1) || tStatus.includes(durStr2))) {
      score += 50;
    }
    // File size match (+30)
    if (sizeMb && tStatus.includes(sizeMb)) {
      score += 30;
    }
    // Exact or combined title match (+20)
    const combined1 = `${perfClean} – ${titleClean}`.toLowerCase();
    const combined2 = `${perfClean} - ${titleClean}`.toLowerCase();
    if (perfClean && titleClean && (tTitle === combined1 || tTitle === combined2)) {
      score += 20;
    } else if (titleClean && tTitle.includes(titleClean.toLowerCase())) {
      score += 10;
    }
    // Uncached preference: if not cached yet, prefer caching it (+5)
    if (!t.fileId) {
      score += 5;
    }
    // Recency tie-breaker
    score += (t.mid || 0) / 100000;

    return { track: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Require at least 25 points to guarantee precision
  if (best && best.score >= 25) {
    return normalizeTrack(best.track);
  }
  return null;
}

export async function updateTrackFileId(trackMid, fileId, contributor = null) {
  const existingRaw = await db.select().from(tracks).where(eq(tracks.mid, trackMid)).get();
  if (!existingRaw) return null;
  const existing = normalizeTrack(existingRaw);

  const patch = { fileId };
  let contributorSaved = false;
  // First-come-first-served: only save contributor if not already credited
  if (contributor && !existing.contributor) {
    patch.contributor = contributor;
    contributorSaved = true;
  }
  await db.update(tracks).set(patch).where(eq(tracks.mid, trackMid)).run();

  // Global cache propagation: update all sibling tracks with the same title across other episodes
  try {
    const siblingPatch = { fileId };
    const effectiveContributor = existing.contributor || contributor;
    if (effectiveContributor) {
      siblingPatch.contributor = effectiveContributor;
    }
    await db
      .update(tracks)
      .set(siblingPatch)
      .where(and(eq(tracks.title, existing.title), sql`file_id IS NULL`))
      .run();
  } catch (err) {
    console.error('Error propagating sibling cache:', err);
  }

  return {
    isNew: false,
    track: { ...existing, fileId, file_id: fileId },
    wasAlreadyCached: Boolean(existing.fileId),
    originalContributor: existing.contributor,
    contributorSaved,
  };
}

export async function addOrUpdateEpisode({ mid, title, castboxUrl = '', tags = '' }) {
  const existing = await db.select().from(episodes).where(eq(episodes.mid, mid)).get();
  if (existing) {
    await db.update(episodes).set({ title, castboxUrl, tags }).where(eq(episodes.mid, mid)).run();
    return { isNew: false, episode: normalizeEpisode(existing) };
  }

  const maxRow = await db.select({ max: sql`max(order_index)` }).from(episodes).get();
  const nextOrder = (maxRow && maxRow.max ? Number(maxRow.max) : 314) + 1;

  const [created] = await db
    .insert(episodes)
    .values({
      mid,
      title,
      castboxUrl,
      tags,
      trackCount: 0,
      orderIndex: nextOrder,
    })
    .returning()
    .run();

  return { isNew: true, episode: normalizeEpisode(created) };
}

export async function addOrUpdateTrack({ mid, title, status = '', fileId = null, contributor = null }) {
  const existingRaw = await db.select().from(tracks).where(eq(tracks.mid, mid)).get();
  if (existingRaw) {
    const existing = normalizeTrack(existingRaw);
    const patch = { fileId: fileId || existing.fileId };
    let contributorSaved = false;
    // First-come-first-served: only save contributor if not already credited
    if (contributor && !existing.contributor) {
      patch.contributor = contributor;
      contributorSaved = true;
    }
    await db.update(tracks).set(patch).where(eq(tracks.mid, mid)).run();
    return {
      isNew: false,
      track: { ...existing, fileId: patch.fileId, file_id: patch.fileId },
      wasAlreadyCached: Boolean(existing.fileId),
      originalContributor: existing.contributor,
      contributorSaved,
    };
  }

  // Find latest episode to attach to
  const latestEp = await db.select().from(episodes).orderBy(desc(episodes.orderIndex)).limit(1).get();
  const epMid = latestEp ? latestEp.mid : 0;
  const nextTrackOrder = (latestEp ? latestEp.trackCount : 0) + 1;

  const [created] = await db
    .insert(tracks)
    .values({
      mid,
      episodeMid: epMid,
      title,
      status,
      fileId,
      contributor,
      tags: latestEp ? latestEp.tags : '',
      orderIndex: nextTrackOrder,
    })
    .returning()
    .run();

  if (latestEp) {
    await db
      .update(episodes)
      .set({ trackCount: latestEp.trackCount + 1 })
      .where(eq(episodes.mid, epMid))
      .run();
  }

  return {
    isNew: true,
    track: created,
    episode: latestEp,
    wasAlreadyCached: false,
    originalContributor: null,
    contributorSaved: Boolean(contributor),
  };
}

export async function getRandomTracksByTag(tagKey, limit = 5) {
  const pattern = `%${tagKey}%`;
  const rows = await db
    .select()
    .from(tracks)
    .where(like(tracks.tags, pattern))
    .orderBy(sql`RANDOM()`)
    .limit(limit)
    .all();
  return rows.map(normalizeTrack);
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
    episodes: rows.map(normalizeEpisode),
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
    episodes: epResults.map(normalizeEpisode),
    tracks: trResults.map(normalizeTrack),
  };
}

export async function getRandomEpisode() {
  const rows = await db
    .select()
    .from(episodes)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .all();
  return rows && rows.length > 0 ? normalizeEpisode(rows[0]) : null;
}

export async function getRandomTrack() {
  const rows = await db
    .select()
    .from(tracks)
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .all();
  return rows && rows.length > 0 ? normalizeTrack(rows[0]) : null;
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
