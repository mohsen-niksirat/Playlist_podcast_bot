import { api } from 'sdk';
import {
  getOrCreateUser,
  setUserState,
  getEpisodes,
  getEpisodeByMid,
  getTracksByEpisodeMid,
  getTrackByMid,
  getRandomEpisode,
  getRandomTrack,
  getRandomTracksByTag,
  getStats,
} from 'lib/db';
import {
  mainMenuKeyboard,
  episodesListKeyboard,
  episodeDetailKeyboard,
  trackDeliveryKeyboard,
  tagsMenuKeyboard,
  tagRandomResultsKeyboard,
  developerKeyboard,
  inlinePanelKeyboard,
  backToMenuKeyboard,
} from 'lib/keyboards';
import {
  formatWelcome,
  formatEpisodeCard,
  formatTrackCaption,
  formatTrackFallback,
  formatTagHeader,
  formatDeveloperInfo,
  formatInlinePanel,
  formatStats,
  formatLinks,
  escapeHtml,
} from 'lib/formatters';

export default async function (query) {
  if (!query || !query.data) return;
  const data = query.data;
  const from = query.from;
  const message = query.message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Always answer callback query promptly
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id });
  } catch {}

  const { user } = await getOrCreateUser(from);

  if (data === 'noop') {
    return;
  }

  // 1. Main Menu
  if (data === 'm:menu') {
    await setUserState(from.id, 'idle');
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: formatWelcome(from.first_name),
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(user.isAdmin),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: formatWelcome(from.first_name),
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(user.isAdmin),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 2. Developer Info (m:dev)
  if (data === 'm:dev') {
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: formatDeveloperInfo(),
        parse_mode: 'HTML',
        reply_markup: developerKeyboard(),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: formatDeveloperInfo(),
        parse_mode: 'HTML',
        reply_markup: developerKeyboard(),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 3. Inline Control Panel (m:panel)
  if (data === 'm:panel') {
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: formatInlinePanel(),
        parse_mode: 'HTML',
        reply_markup: inlinePanelKeyboard(),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: formatInlinePanel(),
        parse_mode: 'HTML',
        reply_markup: inlinePanelKeyboard(),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 4. Random Track Instant Delivery (panel:rand_track)
  if (data === 'panel:rand_track') {
    const track = await getRandomTrack();
    if (!track) {
      await api.sendMessage({ chat_id: chatId, text: 'قطعه‌ای پیدا نشد.' });
      return;
    }
    const ep = await getEpisodeByMid(track.episodeMid);

    const fileId = track.fileId || track.file_id;
    if (fileId) {
      try {
        await api.sendAudio({
          chat_id: chatId,
          audio: fileId,
          caption: formatTrackCaption(track, ep),
          parse_mode: 'HTML',
        });
        return;
      } catch (err) {
        console.error('Error sending random audio:', err);
        try {
          await api.sendAudio({
            chat_id: chatId,
            audio: fileId,
            caption: `🎵 ${track.title || 'قطعه موسیقی'}\n📢 کانال: @MyLeitner`,
          });
          return;
        } catch {}
      }
    }

    await api.sendMessage({
      chat_id: chatId,
      text: `🎲 <b>آهنگ تصادفی پیشنهادی:</b>\n\n` + formatTrackFallback(track, ep),
      parse_mode: 'HTML',
      reply_markup: trackDeliveryKeyboard(track, ep),
    });
    return;
  }
  if (data === 'm:tags') {
    const text =
      `🏷️ <b>انتخاب موسیقی بر اساس مود و سبک (تگ):</b>\n\n` +
      `حس‌وحال و مود مورد نظرتان را انتخاب کنید تا قطعات گلچین‌شده به صورت رندوم به شما پیشنهاد داده شود:`;

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: tagsMenuKeyboard(),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: tagsMenuKeyboard(),
      });
    }
    return;
  }

  // 4. Random tracks for a specific tag (tag:<tagKey>)
  if (data.startsWith('tag:')) {
    const tagKey = data.replace('tag:', '');
    const randomTracks = await getRandomTracksByTag(tagKey, 5);

    if (!randomTracks || randomTracks.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'قطعه‌ای در این سبک یافت نشد.',
        reply_markup: tagsMenuKeyboard(),
      });
      return;
    }

    const text = formatTagHeader(tagKey);

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: tagRandomResultsKeyboard(tagKey, randomTracks),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: tagRandomResultsKeyboard(tagKey, randomTracks),
      });
    }
    return;
  }

  // 5. Episodes list & pagination (m:ep:N or p:N)
  if (data.startsWith('m:ep:') || data.startsWith('p:')) {
    const rawPage = data.startsWith('m:ep:') ? data.replace('m:ep:', '') : data.replace('p:', '');
    const pageNum = parseInt(rawPage, 10) || 1;

    // Strictly 10 episodes per page
    const { episodes: epList, page, totalPages, totalCount } = await getEpisodes(pageNum, 10);

    const listText =
      `🎧 <b>آرشیو پادکست پلی‌لیست (کل اپیزودها: ${totalCount})</b>\n\n` +
      `برای مشاهده قطعات هر اپیزود، روی نام آن کلیک فرمایید:\n` +
      `<i>(صفحه ${page} از ${totalPages})</i>`;

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: listText,
        parse_mode: 'HTML',
        reply_markup: episodesListKeyboard(epList, page, totalPages),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: listText,
        parse_mode: 'HTML',
        reply_markup: episodesListKeyboard(epList, page, totalPages),
      });
    }
    return;
  }

  // 6. Search prompt
  if (data === 'm:search') {
    await setUserState(from.id, 'search');
    const searchText =
      `🔍 <b>جستجوی هوشمند در آرشیو:</b>\n\n` +
      `نام اپیزود، خواننده، یا قطعه مورد نظر خود را بنویسید و ارسال کنید:\n` +
      `<i>(مثال: پیانو، جاز، باران، هایده، ابی، شادمهر ...)</i>`;

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: searchText,
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: searchText,
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
    }
    return;
  }

  // 7. Random Episode
  if (data === 'm:random') {
    const ep = await getRandomEpisode();
    if (!ep) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'اپیزودی پیدا نشد.',
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }
    const tracks = await getTracksByEpisodeMid(ep.mid);
    const cardText = `🎲 <b>اپیزود پیشنهادی امروز:</b>\n\n` + formatEpisodeCard(ep, tracks.length);

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: episodeDetailKeyboard(ep, tracks, 1),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: episodeDetailKeyboard(ep, tracks, 1),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 8. Latest 10 episodes
  if (data === 'm:latest') {
    const { episodes: epList, page, totalPages } = await getEpisodes(1, 10);
    const headerText =
      `🌟 <b>۱۰ اپیزود اخیر منتشر شده پادکست:</b>\n\n` +
      `برای مشاهده قطعات هر اپیزود روی آن کلیک کنید:`;

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: headerText,
        parse_mode: 'HTML',
        reply_markup: episodesListKeyboard(epList, 1, totalPages),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: headerText,
        parse_mode: 'HTML',
        reply_markup: episodesListKeyboard(epList, 1, totalPages),
      });
    }
    return;
  }

  // 9. Links
  if (data === 'm:links') {
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: formatLinks(),
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: formatLinks(),
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 10. Stats (Admin)
  if (data === 'm:stats') {
    if (!user.isAdmin) return;
    const stats = await getStats();
    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: formatStats(stats),
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: formatStats(stats),
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
    }
    return;
  }

  // 11. Episode Details (ep:<mid>)
  if (data.startsWith('ep:')) {
    const mid = parseInt(data.replace('ep:', ''), 10);
    const ep = await getEpisodeByMid(mid);
    if (!ep) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'اپیزود مورد نظر یافت نشد.',
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }

    const tracks = await getTracksByEpisodeMid(mid);
    const cardText = formatEpisodeCard(ep, tracks.length);

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: episodeDetailKeyboard(ep, tracks, 1),
        disable_web_page_preview: true,
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: episodeDetailKeyboard(ep, tracks, 1),
        disable_web_page_preview: true,
      });
    }
    return;
  }

  // 12. Single Track Request (tr:<mid>)
  if (data.startsWith('tr:')) {
    const trackMid = parseInt(data.replace('tr:', ''), 10);
    const track = await getTrackByMid(trackMid);
    if (!track) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'قطعه مورد نظر یافت نشد.',
      });
      return;
    }

    const ep = await getEpisodeByMid(track.episodeMid);

    // If cached in telegram with file_id: send actual audio file!
    const fileId = track.fileId || track.file_id;
    if (fileId) {
      try {
        await api.sendAudio({
          chat_id: chatId,
          audio: fileId,
          caption: formatTrackCaption(track, ep),
          parse_mode: 'HTML',
        });
        return;
      } catch (err) {
        console.error('Error sending cached audio:', err);
        try {
          await api.sendAudio({
            chat_id: chatId,
            audio: fileId,
            caption: `🎵 ${track.title || 'قطعه موسیقی'}\n📢 کانال: @MyLeitner`,
          });
          return;
        } catch (err2) {
          console.error('Error in sendAudio fallback retry:', err2);
        }
      }
    }

    // Fallback: send message with direct Telegram stream button
    await api.sendMessage({
      chat_id: chatId,
      text: formatTrackFallback(track, ep),
      parse_mode: 'HTML',
      reply_markup: trackDeliveryKeyboard(track, ep),
    });
    return;
  }

  // 13. Send all tracks of an episode (all:<epMid>)
  if (data.startsWith('all:')) {
    const epMid = parseInt(data.replace('all:', ''), 10);
    const ep = await getEpisodeByMid(epMid);
    const tracks = await getTracksByEpisodeMid(epMid);

    if (!ep || !tracks || tracks.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'قطعه‌ای برای این اپیزود یافت نشد.',
      });
      return;
    }

    const directLinks = [];

    for (const t of tracks) {
      const fileId = t.fileId || t.file_id;
      if (fileId) {
        try {
          await api.sendAudio({
            chat_id: chatId,
            audio: fileId,
            caption: formatTrackCaption(t, ep),
            parse_mode: 'HTML',
          });
        } catch {
          try {
            await api.sendAudio({
              chat_id: chatId,
              audio: fileId,
              caption: `🎵 ${t.title || 'قطعه موسیقی'}\n📢 کانال: @MyLeitner`,
            });
          } catch {}
        }
      } else {
        directLinks.push({
          title: t.title,
          mid: t.mid,
          status: t.status,
          order: t.orderIndex,
        });
      }
    }

    if (directLinks.length > 0) {
      let listMsg = `📥 <b>قطعات اپیزود «${escapeHtml(ep.title)}» در تلگرام:</b>\n\n`;
      listMsg += `برای شنیدن یا دانلود هر آهنگ، روی لینک مربوط به آن کلیک کنید:\n\n`;

      for (const item of directLinks) {
        listMsg += `🎵 ${item.order}. <a href="https://t.me/Playlistpodcas/${item.mid}"><b>${escapeHtml(item.title)}</b></a>\n`;
        if (item.status) {
          listMsg += `   ⏱️ <code>${escapeHtml(item.status)}</code>\n`;
        }
      }

      listMsg += `\n📢 کانال: @MyLeitner`;

      await api.sendMessage({
        chat_id: chatId,
        text: listMsg,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: `🎙️ صفحه اپیزود: ${ep.title}`, callback_data: `ep:${ep.mid}` }],
            [{ text: '🏠 منوی اصلی', callback_data: 'm:menu' }],
          ],
        },
      });
    }
    return;
  }
}
