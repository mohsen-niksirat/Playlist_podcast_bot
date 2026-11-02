import { api } from 'sdk';
import {
  getOrCreateUser,
  setUserState,
  seedDatabaseIfNeeded,
  getStats,
  updateTrackFileId,
  addOrUpdateEpisode,
  addOrUpdateTrack,
  findMatchingTrack,
  searchContent,
  getEpisodes,
  getRandomEpisode,
  getRandomTrack,
  getEpisodeByMid,
  getEpisodeTracksCount,
  getActiveEpisodeMid,
  setActiveEpisodeMid,
  ADMIN_ID,
  TAGS,
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
  myLeitnerKeyboard,
  backToMenuKeyboard,
  awaitingTracksKeyboard,
  cancelOnlyKeyboard,
} from 'lib/keyboards';
import {
  formatWelcome,
  formatDeveloperInfo,
  formatInlinePanel,
  formatTrackCaption,
  formatTrackFallback,
  formatMyLeitnerChannel,
  formatStats,
  formatLinks,
  escapeHtml,
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
  const isAdmin = user.isAdmin || from.id === ADMIN_ID;

  // Handle cancellation commands
  if (text === '❌ انصراف' || text === '/cancel') {
    if (user.state && user.state.startsWith('admin_')) {
      await setUserState(from.id, 'idle');
      await setActiveEpisodeMid(null);
      await api.sendMessage({
        chat_id: chat.id,
        text: '❌ عملیات مدیریت پادکست لغو شد و به حالت عادی بازگشتید.',
        reply_markup: mainReplyKeyboard(isAdmin),
      });
      return;
    }
    if (user.state === 'search') {
      await setUserState(from.id, 'idle');
      await api.sendMessage({
        chat_id: chat.id,
        text: '🔍 جستجو لغو شد.',
        reply_markup: mainReplyKeyboard(isAdmin),
      });
      return;
    }
  }

  // Admin Feature: Add New Episode via Menu or Command
  if (isAdmin && (text === '➕ افزودن پادکست جدید' || text === '/newpodcast' || text === '/addepisode')) {
    await setUserState(from.id, 'admin_awaiting_podcast_name');
    await api.sendMessage({
      chat_id: chat.id,
      text:
        `➕ <b>افزودن پادکست جدید (مخصوص ادمین)</b>\n\n` +
        `لطفاً <b>نام یا عنوان پادکست جدید</b> را وارد و ارسال کنید.\n\n` +
        `<i>💡 مثال‌ها:</i>\n` +
        `• فقط نام: <code>بیکلام گیتار 5</code>\n` +
        `• نام همراه لینک کست‌باکس:\n` +
        `<code>بیکلام گیتار 5 | https://castbox.fm/ep/1019948897</code>\n\n` +
        `<i>همچنین می‌توانید پست معرفی کانال را مستقیماً فوروارد کنید!</i>`,
      parse_mode: 'HTML',
      reply_markup: cancelOnlyKeyboard(),
    });
    return;
  }

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

  const captionLower = (message.caption || '').toLowerCase();

  const fwdSender =
    (message.forward_from && `${message.forward_from.first_name || ''} ${message.forward_from.username || ''}`) ||
    (message.forward_origin && message.forward_origin.sender_user && `${message.forward_origin.sender_user.first_name || ''} ${message.forward_origin.sender_user.username || ''}`) ||
    (message.forward_origin && message.forward_origin.sender_user_name) ||
    '';

  const isFromMokhtar =
    fwdSender.toLowerCase().includes('mokhtar') ||
    fwdSender.toLowerCase().includes('razmjoo') ||
    fwdSender.toLowerCase().includes('playlist');

  const isFromChannel =
    fwdChannel.toLowerCase().includes('playlistpodca') ||
    captionLower.includes('playlistpodca') ||
    isFromMokhtar;

  // Admin State: Awaiting podcast name
  if (isAdmin && user.state === 'admin_awaiting_podcast_name' && !message.audio) {
    let epTitle = '';
    let castboxUrl = '';
    const matchedMid = fwdMid || null;

    const mQuote = text.match(/["«“]([\s\S]+?)["»”]/);
    const cbMatch = text.match(/https?:\/\/castbox\.fm\/[^\s\n]+/i);
    if (cbMatch) castboxUrl = cbMatch[0];

    if (mQuote && mQuote[1].trim().length >= 2) {
      epTitle = mQuote[1].trim().replace(/\s+/g, ' ');
    } else if (text.includes('|')) {
      const parts = text.split('|');
      epTitle = parts[0].trim();
      if (!castboxUrl && parts[1]) {
        const p2Match = parts[1].match(/https?:\/\/castbox\.fm\/[^\s\n]+/i);
        if (p2Match) castboxUrl = p2Match[0];
      }
    } else {
      const firstLine = text.split('\n')[0].replace(/[🔥📌✨🎙️"«»”]/g, '').trim();
      epTitle = firstLine.slice(0, 60) || 'اپیزود جدید';
    }

    const matchedTags = [];
    const searchArea = (epTitle + ' ' + text).toLowerCase();
    for (const t of TAGS) {
      if (searchArea.includes(t.name) || searchArea.includes(t.key)) {
        matchedTags.push(t.key);
      }
    }
    if (searchArea.includes('گیتار') || searchArea.includes('guitar') || searchArea.includes('بیکلام') || searchArea.includes('ساز')) {
      if (!matchedTags.includes('instrumental')) matchedTags.push('instrumental');
    }
    if (matchedTags.length === 0) matchedTags.push('relax');

    const epRes = await addOrUpdateEpisode({
      mid: matchedMid,
      title: epTitle,
      castboxUrl,
      tags: matchedTags.join(','),
    });

    const epMid = epRes.episode.mid;
    await setActiveEpisodeMid(epMid);
    await setUserState(from.id, `admin_awaiting_tracks:${epMid}`);

    await api.sendMessage({
      chat_id: chat.id,
      text:
        `🎉 <b>پادکست جدید با موفقیت ثبت شد!</b>\n\n` +
        `🎙️ عنوان: <b>«${escapeHtml(epRes.episode.title)}»</b> (قسمت ${epRes.episode.orderIndex})\n` +
        `🔗 کست‌باکس: ${castboxUrl || 'ثبت نشده'}\n` +
        `🏷️ تگ‌ها: <code>${escapeHtml(matchedTags.join(', '))}</code>\n\n` +
        `📥 <b>حالت دریافت فایل‌های صوتی فعال شد:</b>\n` +
        `اکنون آهنگ‌های این پادکست را فوروارد یا ارسال نمایید.\n` +
        `هر آهنگی که بفرستید بلافاصله به این پادکست متصل و کش می‌شود.\n\n` +
        `پس از اتمام ارسال تمام قطعات، دکمه <b>«⏹️ اتمام دریافت آهنگ‌ها»</b> را بزنید.`,
      parse_mode: 'HTML',
      reply_markup: awaitingTracksKeyboard(),
    });
    return;
  }

  // Admin State: Awaiting tracks (Finish button)
  if (isAdmin && user.state && user.state.startsWith('admin_awaiting_tracks:')) {
    const targetMid = parseInt(user.state.replace('admin_awaiting_tracks:', ''), 10);

    if (text === '⏹️ اتمام دریافت آهنگ‌ها' || text === '/done' || text === '/finish') {
      const ep = await getEpisodeByMid(targetMid);
      const epTracksCount = await getEpisodeTracksCount(targetMid);

      await setUserState(from.id, 'idle');
      await setActiveEpisodeMid(null);

      await api.sendMessage({
        chat_id: chat.id,
        text:
          `🏁 <b>عملیات دریافت و کش آهنگ‌ها به پایان رسید!</b>\n\n` +
          `🎙️ پادکست: <b>«${escapeHtml(ep ? ep.title : 'جدید')}»</b>\n` +
          `🎵 تعداد کل آهنگ‌های ثبت و کش شده: <b>${epTracksCount} قطعه</b>\n\n` +
          `هم‌اکنون کاربران می‌توانند این پادکست و قطعات آن را در ربات بشنوند و دانلود کنند. ✨🎧`,
        parse_mode: 'HTML',
        reply_markup: mainReplyKeyboard(isAdmin),
      });
      return;
    }
  }

  // 1. Admin Feature: Add New Episode by forwarding announcement post from channel
  if (isAdmin && !message.audio) {
    const isEpPost =
      text.includes('پلی لیست') ||
      text.includes('پلی‌لیست') ||
      text.includes('اپیزود') ||
      text.includes('قسمت') ||
      text.toLowerCase().includes('castbox');

    if (isEpPost && (fwdMid || isFromChannel || text.includes('منتشر شد'))) {
      let epTitle = '';
      const mQuote = text.match(/["«“]([\s\S]+?)["»”]/);
      if (mQuote && mQuote[1].trim().length >= 2) {
        epTitle = mQuote[1].trim().replace(/\s+/g, ' ');
      } else {
        const firstLine = text.split('\n')[0].replace(/[🔥📌✨🎙️"«»”]/g, '').trim();
        epTitle = firstLine.slice(0, 50) || 'اپیزود جدید';
      }

      // Extract castbox url if present
      const cbMatch = text.match(/https?:\/\/castbox\.fm\/[^\s\n]+/i);
      const castboxUrl = cbMatch ? cbMatch[0] : '';

      // Determine tags
      const matchedTags = [];
      const lowerText = (epTitle + ' ' + text).toLowerCase();
      for (const t of TAGS) {
        if (lowerText.includes(t.name) || lowerText.includes(t.key)) {
          matchedTags.push(t.key);
        }
      }
      if (lowerText.includes('گیتار') || lowerText.includes('guitar') || lowerText.includes('بیکلام') || lowerText.includes('ساز')) {
        if (!matchedTags.includes('instrumental')) matchedTags.push('instrumental');
      }
      if (matchedTags.length === 0) matchedTags.push('relax');

      const epRes = await addOrUpdateEpisode({
        mid: fwdMid,
        title: epTitle,
        castboxUrl,
        tags: matchedTags.join(','),
      });

      const epMid = epRes.episode.mid;
      await setActiveEpisodeMid(epMid);
      await setUserState(from.id, `admin_awaiting_tracks:${epMid}`);

      await api.sendMessage({
        chat_id: chat.id,
        text:
          `🎉 <b>پست معرفی پادکست با هوشمندی تشخیص داده شد!</b>\n\n` +
          `🎙️ اپیزود: <b>«${escapeHtml(epRes.episode.title)}»</b> (قسمت ${epRes.episode.orderIndex})\n` +
          `🔗 کست‌باکس: ${castboxUrl || 'ثبت نشده'}\n` +
          `🏷️ تگ‌ها: <code>${escapeHtml(matchedTags.join(', '))}</code>\n\n` +
          `👇 <b>حالت دریافت و کش آهنگ‌ها فعال شد:</b>\n` +
          `اکنون آهنگ‌های این پادکست را فوروارد یا ارسال کنید تا مستقیماً به همین پادکست متصل و کش شوند.\n` +
          `پس از اتمام، روی دکمه <b>«⏹️ اتمام دریافت آهنگ‌ها»</b> بزنید.`,
        parse_mode: 'HTML',
        reply_markup: awaitingTracksKeyboard(),
      });
      return;
    }
  }

  // 2. Handle incoming/forwarded audio (File_ID caching & auto-add tracks)
  if (message.audio) {
    const audio = message.audio;
    const fileId = audio.file_id;
    const audioTitle = audio.title || audio.file_name || '';
    const contributor = from.username ? `@${from.username}` : (from.first_name || 'کاربر گرامی');

    let res = null;
    let trackTitle = audioTitle;
    let addedToEp = null;

    // Check if admin is currently in awaiting_tracks mode, or if active_episode_mid is set
    let targetEpisodeMid = null;
    if (isAdmin) {
      if (user.state && user.state.startsWith('admin_awaiting_tracks:')) {
        targetEpisodeMid = parseInt(user.state.replace('admin_awaiting_tracks:', ''), 10);
      } else {
        targetEpisodeMid = await getActiveEpisodeMid();
      }
    }

    if (targetEpisodeMid) {
      const durationStr = audio.duration
        ? `${Math.floor(audio.duration / 60)}:${String(audio.duration % 60).padStart(2, '0')}`
        : '';
      const sizeStr = audio.file_size
        ? `, ${(audio.file_size / (1024 * 1024)).toFixed(1)} MB`
        : '';
      const fullTitle = audio.performer && audio.title ? `${audio.performer} – ${audio.title}` : audioTitle;

      const ep = await getEpisodeByMid(targetEpisodeMid);
      const epTitle = ep ? ep.title : 'جدید';

      res = await addOrUpdateTrack({
        mid: fwdMid,
        episodeMid: targetEpisodeMid,
        title: fullTitle,
        status: durationStr ? `${durationStr}${sizeStr}` : '',
        fileId,
        contributor,
      });

      const currentTracksCount = await getEpisodeTracksCount(targetEpisodeMid);

      await api.sendMessage({
        chat_id: chat.id,
        text:
          `✅ <b>آهنگ کش و به پادکست متصل شد!</b>\n\n` +
          `🎵 <code>${escapeHtml(fullTitle)}</code>\n` +
          `🎙️ پادکست: <b>«${escapeHtml(epTitle)}»</b>\n` +
          `📊 تعداد قطعات ثبت‌شده تا اکنون: <b>${currentTracksCount} قطعه</b>\n\n` +
          `<i>آهنگ بعدی را بفرستید، یا در صورت پایان روی دکمه زیر بزنید:</i>`,
        parse_mode: 'HTML',
        reply_markup: awaitingTracksKeyboard(),
      });
      return;
    }

    // A) Smart Multi-Factor Matcher (Fingerprints by Title, Artist, Duration, Size, and MID)
    // Matches accurately even if forwarded from personal chats (e.g. Mokhtar Razmjoo PV)
    const matchedTrack = await findMatchingTrack({
      mid: fwdMid,
      performer: audio.performer,
      title: audio.title,
      fileName: audio.file_name,
      duration: audio.duration,
      fileSize: audio.file_size,
    });

    if (matchedTrack) {
      res = await updateTrackFileId(matchedTrack.mid, fileId, contributor);
      if (res && res.track && res.track.title) {
        trackTitle = res.track.title;
      }
    } else if (fwdMid && (isAdmin || isFromChannel)) {
      // B) If it's a new track from channel/admin not in the seed archive
      try {
        const durationStr = audio.duration
          ? `${Math.floor(audio.duration / 60)}:${String(audio.duration % 60).padStart(2, '0')}`
          : '';
        const sizeStr = audio.file_size
          ? `, ${(audio.file_size / (1024 * 1024)).toFixed(1)} MB`
          : '';

        const fullTitle = audio.performer && audio.title ? `${audio.performer} – ${audio.title}` : audioTitle;

        res = await addOrUpdateTrack({
          mid: fwdMid,
          title: fullTitle,
          status: durationStr ? `${durationStr}${sizeStr}` : '',
          fileId,
          contributor,
        });

        if (res) {
          if (res.track && res.track.title) {
            trackTitle = res.track.title;
          }
          if (res.isNew && res.episode) {
            addedToEp = res.episode;
          }
        }
      } catch (err) {
        console.error('addOrUpdateTrack error:', err);
      }
    }

    if (res) {
      const safeTrackTitle = escapeHtml(trackTitle);
      const safeContributor = escapeHtml(contributor);
      const playMarkup = {
        inline_keyboard: [
          [{ text: '📥 پخش / دریافت مستقیم این آهنگ', callback_data: `tr:${res.track.mid}` }],
        ],
      };

      if (addedToEp) {
        await api.sendMessage({
          chat_id: chat.id,
          text:
            `✨ <b>آهنگ جدید به اپیزود «${escapeHtml(addedToEp.title)}» اضافه و کش شد!</b>\n\n` +
            `🎵 عنوان: <code>${safeTrackTitle}</code>\n` +
            `❤️ حامی: <b>${safeContributor}</b>\n` +
            `📊 تعداد قطعات این اپیزود: <b>${addedToEp.trackCount + 1} آهنگ</b>`,
          parse_mode: 'HTML',
          reply_markup: playMarkup,
        });
      } else if (res.wasAlreadyCached && res.originalContributor && !res.contributorSaved) {
        // Track was already cached with an original contributor
        const safeOriginal = escapeHtml(res.originalContributor);
        if (res.originalContributor === contributor) {
          await api.sendMessage({
            chat_id: chat.id,
            text:
              `💡 <b>این قطعه قبلاً توسط خود شما ثبت و کش شده بود!</b>\n\n` +
              `🎵 عنوان: <code>${safeTrackTitle}</code>\n` +
              `❤️ ثبت‌شده با نام کاربری شما: <b>${safeContributor}</b>\n\n` +
              `پرچم بالاست! برای دریافت و شنیدن آن روی دکمه زیر بزنید: 🎧✨`,
            parse_mode: 'HTML',
            reply_markup: playMarkup,
          });
        } else {
          await api.sendMessage({
            chat_id: chat.id,
            text:
              `💡 <b>این قطعه قبلاً در آرشیو کش شده است!</b>\n\n` +
              `🎵 عنوان: <code>${safeTrackTitle}</code>\n` +
              `👑 اولین ثبت‌کننده (حامی اثر): <b>${safeOriginal}</b>\n\n` +
              `دمت گرم رفیق! با اینکه اعتبار این قطعه متعلق به اولین ارسال‌کننده (<b>${safeOriginal}</b>) است، ولی مشارکت شما برای ما بی‌نهایت ارزشمنده! 🌟\n` +
              `<i>پیشنهاد: آهنگ‌های جدیدتر یا بدون کش را فوروارد کنید تا تگ شما ثبت شود!</i> 😉`,
            parse_mode: 'HTML',
            reply_markup: playMarkup,
          });
        }
      } else {
        // First contributor!
        await api.sendMessage({
          chat_id: chat.id,
          text:
            `⚡ <b>فایل با موفقیت کش شد:</b> <code>${safeTrackTitle}</code>\n\n` +
            `❤️ <b>دمت گرم!</b> آیدی شما <b>${safeContributor}</b> به عنوان اولین حامی این قطعه در آرشیو ثبت شد و برای همیشه در کپشن آهنگ برای همه کاربران نمایش داده می‌شود. 🌟🎧`,
          parse_mode: 'HTML',
          reply_markup: playMarkup,
        });
      }
    } else if (isAdmin) {
      await api.sendMessage({
        chat_id: chat.id,
        text: `⚠️ فایل صوتی دریافت شد، اما در لیست قطعات تطبیق داده نشد.\n<i>پیشنهاد: آهنگ را مستقیماً از کانال @Playlistpodcas فوروارد فرمایید.</i>`,
        parse_mode: 'HTML',
      });
    } else {
      await api.sendMessage({
        chat_id: chat.id,
        text: `⚠️ ممنون از ارسال فایل صوتی!\nاما این قطعه در لیست پادکست پلی‌لیست پیدا نشد. لطفاً آهنگ‌ها را مستقیماً از کانال اصلی (@Playlistpodcas) فوروارد نمایید.`,
        parse_mode: 'HTML',
      });
    }
    return;
  }

  // 3. Handle /start command
  if (text.startsWith('/start')) {
    await setUserState(from.id, 'idle');

    // Send main interactive message with inline keyboard
    await api.sendMessage({
      chat_id: chat.id,
      text: formatWelcome(from.first_name),
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(isAdmin),
      disable_web_page_preview: true,
    });

    // Also activate the bottom persistent reply keyboard in chatbox
    await api.sendMessage({
      chat_id: chat.id,
      text: `👇 <b>کلیدهای دسترسی سریع</b> در نوار چت‌باکس شما فعال شد:`,
      parse_mode: 'HTML',
      reply_markup: mainReplyKeyboard(isAdmin),
    });
    return;
  }

  // 4. Handle Dedicated @MyLeitner Channel Button
  if (text.includes('@MyLeitner') || text.includes('MyLeitner') || text === '/channel') {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatMyLeitnerChannel(),
      parse_mode: 'HTML',
      reply_markup: myLeitnerKeyboard(),
      disable_web_page_preview: false,
    });
    return;
  }

  // 5. Handle Bottom Bar (Chatbox) Buttons
  if (text.includes('آهنگ تصادفی فوری') || text.includes('آهنگ تصادفی')) {
    const track = await getRandomTrack();
    if (!track) {
      await api.sendMessage({ chat_id: chat.id, text: 'قطعه‌ای پیدا نشد.' });
      return;
    }
    const ep = await getEpisodeByMid(track.episodeMid);

    const fileId = track.fileId || track.file_id;
    if (fileId) {
      try {
        await api.sendAudio({
          chat_id: chat.id,
          audio: fileId,
          caption: formatTrackCaption(track, ep),
          parse_mode: 'HTML',
        });
        return;
      } catch (err) {
        try {
          await api.sendAudio({
            chat_id: chat.id,
            audio: fileId,
            caption: `🎵 ${track.title || 'موسیقی'}\n📢 کانال: @MyLeitner`,
          });
          return;
        } catch {}
      }
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

  // 6. Handle /panel command (Inline Panel)
  if (text === '/panel' || text.includes('پنل اینلاین')) {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatInlinePanel(),
      parse_mode: 'HTML',
      reply_markup: inlinePanelKeyboard(),
    });
    return;
  }

  // 7. Handle /about or /links command
  if (text === '/about' || text === '/links') {
    await api.sendMessage({
      chat_id: chat.id,
      text: formatLinks(),
      parse_mode: 'HTML',
      reply_markup: backToMenuKeyboard(),
      disable_web_page_preview: true,
    });
    return;
  }

  // 8. Handle /stats command (Admin)
  if (text === '/stats' || text.includes('وضعیت دیتابیس')) {
    if (!isAdmin) return;
    const stats = await getStats();
    await api.sendMessage({
      chat_id: chat.id,
      text: formatStats(stats),
      parse_mode: 'HTML',
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }

  // 9. Handle /seed (Force refresh by Admin)
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

  // 10. Handle Search query if in 'search' state or plain text
  if (user.state === 'search' || (!text.startsWith('/') && text.length >= 2)) {
    const { episodes: foundEps, tracks: foundTracks } = await searchContent(text, 12);
    const totalFound = foundEps.length + foundTracks.length;
    const safeQuery = escapeHtml(text);

    if (totalFound === 0) {
      await api.sendMessage({
        chat_id: chat.id,
        text: `🔍 موردی برای عبارت «<b>${safeQuery}</b>» پیدا نشد.\n\nلطفاً کلمه کلیدی دیگری (بخشی از نام اپیزود یا خواننده یا آهنگ) را ارسال فرمایید:`,
        parse_mode: 'HTML',
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }

    await setUserState(from.id, 'idle');
    let summaryText = `🎯 <b>نتایج جستجو برای: «${safeQuery}»</b>\n\n`;
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
