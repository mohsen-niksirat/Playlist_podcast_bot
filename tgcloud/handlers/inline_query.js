import { api } from 'sdk';
import {
  searchContent,
  getRandomEpisode,
  getRandomTracksByTag,
  getEpisodes,
  getEpisodeByMid,
  TAGS,
} from 'lib/db';
import { formatTrackCaption, formatTrackFallback, formatEpisodeCard } from 'lib/formatters';
import { trackDeliveryKeyboard } from 'lib/keyboards';

export default async function (inlineQuery) {
  if (!inlineQuery || !inlineQuery.id) return;

  const qId = inlineQuery.id;
  const rawQuery = (inlineQuery.query || '').trim();
  const results = [];

  try {
    if (!rawQuery) {
      // 1. Random Tracks from popular tags
      const sampleTags = ['relax', 'instrumental', 'happy', 'sad', 'road', 'nostalgia'];
      for (const tKey of sampleTags) {
        const trs = await getRandomTracksByTag(tKey, 1);
        if (trs && trs.length > 0) {
          const t = trs[0];
          const ep = await getEpisodeByMid(t.episodeMid);
          const tObj = TAGS.find((x) => x.key === tKey);
          const moodTitle = tObj ? `${tObj.icon} آهنگ پیشنهادی (${tObj.name})` : '🎵 آهنگ پیشنهادی';

          if (t.fileId) {
            results.push({
              type: 'audio',
              id: `tr_${t.mid}_${tKey}`,
              audio_file_id: t.fileId,
              caption: formatTrackCaption(t, ep),
              parse_mode: 'HTML',
            });
          } else {
            results.push({
              type: 'article',
              id: `tr_art_${t.mid}_${tKey}`,
              title: `${moodTitle}: ${t.title}`,
              description: ep ? `اپیزود: ${ep.title} | ${t.status || ''}` : t.status || '',
              input_message_content: {
                message_text: formatTrackFallback(t, ep),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
              },
              reply_markup: trackDeliveryKeyboard(t, ep),
            });
          }
        }
      }

      // 2. Add latest episode
      const { episodes: latestEps } = await getEpisodes(1, 2);
      for (const ep of latestEps) {
        results.push({
          type: 'article',
          id: `ep_${ep.mid}`,
          title: `🎙️ آخرین اپیزود: ${ep.title}`,
          description: `${ep.trackCount} قطعه موسیقی | کست‌باکس`,
          input_message_content: {
            message_text: formatEpisodeCard(ep, ep.trackCount),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          },
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎧 مشاهده و دریافت قطعات', url: `https://t.me/Playlist_podcast_bot?start=ep_${ep.mid}` }],
              [{ text: '📢 کانال @MyLeitner', url: 'https://t.me/MyLeitner' }],
            ],
          },
        });
      }
    } else {
      // User typed a search term: search episodes & tracks
      const { episodes, tracks } = await searchContent(rawQuery, 20);

      // Add found tracks
      for (const t of tracks) {
        const ep = await getEpisodeByMid(t.episodeMid);
        if (t.fileId) {
          results.push({
            type: 'audio',
            id: `tr_${t.mid}`,
            audio_file_id: t.fileId,
            caption: formatTrackCaption(t, ep),
            parse_mode: 'HTML',
          });
        } else {
          results.push({
            type: 'article',
            id: `tr_art_${t.mid}`,
            title: `🎵 ${t.title}`,
            description: ep ? `اپیزود: ${ep.title} | ${t.status || ''}` : t.status || '',
            input_message_content: {
              message_text: formatTrackFallback(t, ep),
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            },
            reply_markup: trackDeliveryKeyboard(t, ep),
          });
        }
      }

      // Add found episodes
      for (const ep of episodes) {
        results.push({
          type: 'article',
          id: `ep_sr_${ep.mid}`,
          title: `🎙️ اپیزود: ${ep.title}`,
          description: `شامل ${ep.trackCount} قطعه موسیقی`,
          input_message_content: {
            message_text: formatEpisodeCard(ep, ep.trackCount),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          },
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎧 مشاهده و دریافت قطعات', url: `https://t.me/Playlist_podcast_bot?start=ep_${ep.mid}` }],
              [{ text: '📢 کانال @MyLeitner', url: 'https://t.me/MyLeitner' }],
            ],
          },
        });
      }
    }

    await api.answerInlineQuery({
      inline_query_id: qId,
      results: results.slice(0, 50),
      cache_time: 10,
      is_personal: true,
    });
  } catch (err) {
    console.error('Error answering inline query:', err);
    try {
      await api.answerInlineQuery({
        inline_query_id: qId,
        results: [],
        cache_time: 2,
      });
    } catch {}
  }
}
