import { api } from 'sdk';
import {
  getOrCreateUser,
  setUserState,
  seedDatabaseIfNeeded,
  getStats,
  updateTrackFileId,
  searchContent,
  getEpisodes,
  getRandomEpisode,
  getRandomTrack,
  getEpisodeByMid,
  ADMIN_ID,
} from 'lib/db';
import {
  mainMenuKeyboard,
  mainReplyKeyboard,
  tagsMenuKeyboard,
  episodesListKeyboard,
  searchResultsKeyboard,
  developerKeyboard,
  inlinePanelKeyboard,
  trackDeliveryKeyboard,
  backToMenuKeyboard,
} from 'lib/keyboards';
import {
  formatWelcome,
  formatDeveloperInfo,
  formatInlinePanel,
  formatTrackCaption,
  formatTrackFallback,
  formatStats,
  formatLinks,
} from 'lib/formatters';

export default async function (message) {
  if (!message || !message.chat) return;
  const chat = message.chat;
  const from = message.from;
  if (!from || from.is_bot) return;

  const text = (message.text || message.caption || '').trim();

  // Auto-seed/refresh on incoming message if DB empty or needs refresh
  try {
    await seedDatabaseIfNeeded();
  } catch (err) {
    console.error('Seed error:', err);
  }

  const { user } = await getOrCreateUser(from);

  // 1. Handle incoming/forwarded audio (File_ID caching)
  if (message.audio) {
    const audio = message.audio;
    const fileId = audio.file_id;
    const audioTitle = audio.title || audio.file_name || '';

    // Support both legacy and modern Bot API 7.0+ forward fields
    const fwdMid =
      message.forward_from_message_id ||
      (message.forward_origin && message.forward_origin.type === 'channel'
        ? message.forward_origin.message_id
        : null);

    const fwdChannel =
      (message.forward_from_chat && message.forward_from_chat.username) ||
      (message.forward_origin && message.forward_origin.chat && message.forward_origin.chat.username) ||
      '';

    const isFromChannel = fwdChannel.toLowerCase().includes('playlistpodca');
    const isAdmin = user.isAdmin || from.id === ADMIN_ID;

    let matched = false;
    let trackTitle = audioTitle;

    // A) If forwarded from the podcast channel, ANY user or admin can trigger cache
    if (fwdMid) {
      try {
        await updateTrackFileId(fwdMid, fileId);
        matched = true;
      } catch {}
    }

    // B) If not matched by forward_id, allow Admin to match by title
    if (!matched && audioTitle && (isAdmin || isFromChannel)) {
      try {
        const { tracks: foundTracks } = await searchContent(audioTitle, 1);
        if (foundTracks && foundTracks.length > 0) {
          await updateTrackFileId(foundTracks[0].mid, fileId);
          matched = true;
          trackTitle = foundTracks[0].title;
        }
      } catch {}
    }

    if (matched) {
      await api.sendMessage({
        chat_id: chat.id,
        text: `⚡ <b>فایل کش شد:</b> <code>${trackTitle}</code>\n✅ شناسه تلگرام ذخیره شد و اکنون مستقیماً با تگ @MyLeitner ارسال می‌شود.`,
        parse_mode: 'HTML',
      });
    } else if (isAdmin) {
      await api.sendMessage({
        chat_id: chat.id,
        text: `⚠️ فایل صوتی دریافت شد، اما در لیست ۶,۸۰۰ قطعه تطبیق داده نشد.\n<i>پیشنهاد: آهنگ را مستقیماً از کانال @Playlistpodcas فوروارد فرمایید.</i>`,
        parse_mode: 'HTML',
      });
    }
    return;
  }

  // 2. Handle /start command
  if (text.startsWith('/start')) {
    await setUserState(from.id, 'idle');

    // Send main interactive message with inline keyboard
    await api.sendMessage({
      chat_id: chat.id,
      text: formatWelcome(from.first_name),
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(user.isAdmin),
      disable_web_page_preview: true,
    });

    // Also activate the bottom persistent reply keyboard in chatbox
    await api.sendMessage({
      chat_id: chat.id,
      text: `👇 <b>کلیدهای دسترسی سریع</b> در نوار چت‌باکس شما فعال شد:`,
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  // 3. Handle Bottom Bar (Chatbox) Buttons
  if (text.includes('آهنگ تصادفی فوری') || text.includes('آهنگ تصادفی')) {
    const track = await getRandomTrack();
    if (!track) {
      await api.sendMessage({ chat_id: chat.id, text: 'قطعه‌ای پیدا نشد.' });
      return;
    }
    const ep = await getEpisodeByMid(track.episodeMid);

    if (track.fileId) {
      try {
        await api.sendAudio({
          chat_id: chat.id,
          audio: track.fileId,
          caption: formatTrackCaption(track, ep),
          parse_mode: 'HTML',
        });
        return;
      } catch {}
    }

    await api.sendMessage({
      chat_id: chat.id,
      text: `🎲 <b>آهنگ تصادفی پیشنهادی:</b>\n\n` + formatTrackFallback(track, ep),
      parse_mode: 'HTML',
      reply_markup: trackDeliveryKeyboard(track, ep),
    });
    return;
  }

  if (text.includes('مودها و سبک‌ها') || text.includes('سبک‌ها') || text === '/tags') {
    await api.sendMessage({
      chat_id: chat.id,
      text: `🏷️ <b>انتخاب موسیقی بر اساس مود و سبک (تگ):</b>\n\nحس و حال مورد نظر خود را انتخاب کنید تا آهنگ‌های متناسب برای شما گلچین شود:`,
      parse_mode: 'HTML',
      reply_markup: tagsMenuKeyboard(),
    });
    return;
  }

  if (text.includes('لیست پادکست') || text === '/episodes') {
    const { episodes: epList, page, totalPages, totalCount } = await getEpisodes(1, 10);
    await api.sendMessage({
      chat_id: chat.id,
      text: `🎧 <b>آرشیو پادکست پلی‌لیست (کل اپیزودها: ${totalCount})</b>\n\nبرای مشاهده قطعات هر اپیزود، روی نام آن کلیک فرمایید:\n<i>(صفحه ${page} از ${totalPages})</i>`,
      parse_mode: 'HTML',
      reply_markup: episodesListKeyboard(epList, page, totalPages),
    });
    return;
  }

  if (text.includes('جستجوی آهنگ') || text === '/search') {
    await setUserState(from.id, 'search');
    await api.sendMessage({
      chat_id: chat.id,
      text: `🔍 <b>جستجوی هوشمند در آرشیو:</b>\n\nلطفاً نام اپیزود، خواننده، یا قطعه مورد نظر خود را بنویسید و ارسال کنید:`,
      parse_mode: 'HTML',
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }

  if (text.includes('۱۰ اپیزود اخیر') || text === '/latest') {
    const { episodes: epList, page, totalPages } = await getEpisodes(1, 10);
    await api.sendMessage({
      chat_id: chat.id,
      text: `🌟 <b>۱۰ اپیزود اخیر منتشر شده پادکست:</b>\n\nبرای مشاهده قطعات هر اپیزود روی آن کلیک کنید:`,
      parse_mode: 'HTML',
      reply_markup: episodesListKeyboard(epList, 1, totalPages),
    });
    return;
  }

  if (text.includes('درباره توسعه‌دهنده') || text === '/dev' || text === '/developer') {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatDeveloperInfo(),
      parse_mode: 'HTML',
      reply_markup: developerKeyboard(),
      disable_web_page_preview: true,
    });
    return;
  }

  if (text.includes('منوی شیشه‌ای کامل') || text.includes('منوی اصلی') || text === '/menu') {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatWelcome(from.first_name),
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(user.isAdmin),
      disable_web_page_preview: true,
    });
    return;
  }

  // 4. Handle /panel command (Inline Panel)
  if (text === '/panel' || text.includes('پنل اینلاین')) {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatInlinePanel(),
      parse_mode: 'HTML',
      reply_markup: inlinePanelKeyboard(),
    });
    return;
  }

  // 5. Handle /about or /links command
  if (text === '/about' || text === '/links' || text.includes('کانال @MyLeitner')) {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatLinks(),
      parse_mode: 'HTML',
      reply_markup: backToMenuKeyboard(),
      disable_web_page_preview: true,
    });
    return;
  }

  // 6. Handle /stats command (Admin)
  if (text === '/stats') {
    if (!user.isAdmin && from.id !== ADMIN_ID) return;
    const stats = await getStats();
    await api.sendMessage({
      chat_id: chat.id,
      text: formatStats(stats),
      parse_mode: 'HTML',
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }

  // 7. Handle /seed (Force refresh by Admin)
  if (text === '/seed') {
    if (!user.isAdmin && from.id !== ADMIN_ID) return;
    await api.sendMessage({ chat_id: chat.id, text: '⏳ در حال به‌روزرسانی اطلاعات اپیزودها و تگ‌ها...' });
    const res = await seedDatabaseIfNeeded(true);
    await api.sendMessage({
      chat_id: chat.id,
      text: `✅ دیتابیس با موفقیت نوسازی شد!\nتعداد اپیزودها: ${res.episodes}\nتعداد قطعات: ${res.tracks}`,
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }

  // 8. Handle Search query if in 'search' state or plain text
  if (user.state === 'search' || (!text.startsWith('/') && text.length >= 2)) {
    const { episodes: foundEps, tracks: foundTracks } = await searchContent(text, 12);
    const totalFound = foundEps.length + foundTracks.length;

    if (totalFound === 0) {
      await api.sendMessage({
        chat_id: chat.id,
        text: `🔍 موردی برای عبارت «<b>${text}</b>» پیدا نشد.\n\nلطفاً کلمه کلیدی دیگری (بخشی از نام اپیزود یا خواننده یا آهنگ) را ارسال فرمایید:`,
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }

    await setUserState(from.id, 'idle');
    let summaryText = `🎯 <b>نتایج جستجو برای: «${text}»</b>\n\n`;
    if (foundEps.length > 0) {
      summaryText += `🎙️ <b>اپیزودها (${foundEps.length}):</b>\n`;
    }
    if (foundTracks.length > 0) {
      summaryText += `🎵 <b>آهنگ‌ها (${foundTracks.length}):</b>\n`;
    }
    summaryText += `\nبرای مشاهده یا دریافت، روی دکمه مربوطه کلیک کنید:`;

    await api.sendMessage({
      chat_id: chat.id,
      text: summaryText,
      parse_mode: 'HTML',
      reply_markup: searchResultsKeyboard(foundEps, foundTracks),
    });
    return;
  }

  // Fallback
  await api.sendMessage({
    chat_id: chat.id,
    text: `دستور نامشخص است. لطفاً از گزینه‌های منوی زیر استفاده کنید:`,
    reply_markup: mainMenuKeyboard(user.isAdmin),
  });
}
