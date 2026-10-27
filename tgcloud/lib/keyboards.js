import { TAGS } from 'lib/db';

export function mainMenuKeyboard(isAdmin = false) {
  const keyboard = [
    [
      { text: '🎧 لیست تمام پادکست‌ها', callback_data: 'm:ep:1' },
    ],
    [
      { text: '🏷️ آهنگ بر اساس مود و سبک (تگ)', callback_data: 'm:tags' },
      { text: '🎛️ پنل کنترل اینلاین', callback_data: 'm:panel' },
    ],
    [
      { text: '🔍 جستجو (آهنگ یا اپیزود)', callback_data: 'm:search' },
      { text: '🎲 اپیزود پیشنهادی', callback_data: 'm:random' },
    ],
    [
      { text: '🌟 ۱۰ اپیزود اخیر', callback_data: 'm:latest' },
      { text: '🔗 کست‌باکس و کانال', callback_data: 'm:links' },
    ],
    [
      { text: '👨‍💻 درباره توسعه‌دهنده', callback_data: 'm:dev' },
    ],
  ];

  if (isAdmin) {
    keyboard.push([
      { text: '📊 آمار و وضعیت دیتابیس', callback_data: 'm:stats' },
    ]);
  }

  return { inline_keyboard: keyboard };
}

export function inlinePanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🎲 یک آهنگ تصادفی فوری', callback_data: 'panel:rand_track' },
        { text: '🎙️ اپیزود تصادفی', callback_data: 'm:random' },
      ],
      [
        { text: '🏷️ مودها و سبک‌ها', callback_data: 'm:tags' },
        { text: '🌟 ۱۰ اپیزود اخیر', callback_data: 'm:latest' },
      ],
      [
        { text: '🔍 جستجوی آهنگ و پادکست', callback_data: 'm:search' },
      ],
      [
        { text: '💬 جستجوی اینلاین در این چت', switch_inline_query_current_chat: '' },
      ],
      [
        { text: '📤 ارسال اینلاین برای دوستان یا گروه‌ها', switch_inline_query: '' },
      ],
      [
        { text: '📢 کانال @MyLeitner', url: 'https://t.me/MyLeitner' },
      ],
      [
        { text: '🏠 بازگشت به منوی اصلی', callback_data: 'm:menu' },
      ],
    ],
  };
}

export function mainReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: '🎲 آهنگ تصادفی فوری ⚡' },
        { text: '🏷️ مودها و سبک‌ها 🎧' },
      ],
      [
        { text: '🎙️ لیست پادکست‌ها' },
        { text: '🔍 جستجوی آهنگ' },
      ],
      [
        { text: '🌟 ۱۰ اپیزود اخیر' },
        { text: '📢 کانال @MyLeitner' },
      ],
      [
        { text: '👨‍💻 درباره توسعه‌دهنده' },
        { text: '🎛️ منوی شیشه‌ای کامل' },
      ],
    ],
    resize_keyboard: true,
    is_persistent: false,
    input_field_placeholder: 'انتخاب گزینه یا جستجوی آهنگ...',
  };
}

export function tagsMenuKeyboard() {
  const keyboard = [];

  for (let i = 0; i < TAGS.length; i += 2) {
    const row = [];
    const t1 = TAGS[i];
    row.push({ text: `${t1.icon} ${t1.name}`, callback_data: `tag:${t1.key}` });
    if (i + 1 < TAGS.length) {
      const t2 = TAGS[i + 1];
      row.push({ text: `${t2.icon} ${t2.name}`, callback_data: `tag:${t2.key}` });
    }
    keyboard.push(row);
  }

  keyboard.push([
    { text: '🏠 بازگشت به منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function tagRandomResultsKeyboard(tagKey, tracks) {
  const keyboard = [];

  for (const t of tracks) {
    const icon = t.fileId ? '📥' : '🎵';
    const cleanTitle = (t.title || 'قطعه موسیقی').slice(0, 36);
    const timeInfo = t.status ? ` [${t.status.split(',')[0].trim()}]` : '';
    keyboard.push([
      { text: `${icon} ${cleanTitle}${timeInfo}`, callback_data: `tr:${t.mid}` },
    ]);
  }

  keyboard.push([
    { text: '🎲 ۵ قطعه تصادفی دیگر از این سبک', callback_data: `tag:${tagKey}` },
  ]);

  keyboard.push([
    { text: '🏷️ سایر مودها و تگ‌ها', callback_data: 'm:tags' },
    { text: '🏠 منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function episodesListKeyboard(episodesList, currentPage, totalPages) {
  const keyboard = [];

  // Group episodes 1 per row for clear reading of Persian titles
  for (const ep of episodesList) {
    const label = `🎙️ ${ep.orderIndex}. ${ep.title} (${ep.trackCount} آهنگ)`;
    keyboard.push([
      { text: label, callback_data: `ep:${ep.mid}` },
    ]);
  }

  // Navigation row
  const navRow = [];
  if (currentPage > 1) {
    navRow.push({ text: '⬅️ صفحه قبل', callback_data: `p:${currentPage - 1}` });
  }
  navRow.push({ text: `📄 ${currentPage} / ${totalPages}`, callback_data: 'noop' });
  if (currentPage < totalPages) {
    navRow.push({ text: 'صفحه بعد ➡️', callback_data: `p:${currentPage + 1}` });
  }
  keyboard.push(navRow);

  // Quick jump & back
  keyboard.push([
    { text: '🏷️ مودها (تگ)', callback_data: 'm:tags' },
    { text: '🔍 جستجو', callback_data: 'm:search' },
    { text: '🔙 منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function episodeDetailKeyboard(ep, tracks, backPage = 1) {
  const keyboard = [];

  // Tracks buttons
  for (const t of tracks) {
    const icon = t.fileId ? '📥' : '🎵';
    const cleanTitle = (t.title || 'قطعه موسیقی').slice(0, 36);
    const timeInfo = t.status ? ` [${t.status.split(',')[0].trim()}]` : '';
    const label = `${icon} ${t.orderIndex}. ${cleanTitle}${timeInfo}`;
    keyboard.push([
      { text: label, callback_data: `tr:${t.mid}` },
    ]);
  }

  // Action buttons
  keyboard.push([
    { text: '📥 دریافت همه آهنگ‌ها', callback_data: `all:${ep.mid}` },
  ]);

  const linksRow = [];
  if (ep.castboxUrl && ep.castboxUrl.startsWith('http')) {
    linksRow.push({ text: '🎧 پخش کامل در Castbox', url: ep.castboxUrl });
  }
  linksRow.push({ text: '📢 پیام در تلگرام', url: `https://t.me/Playlistpodcas/${ep.mid}` });
  keyboard.push(linksRow);

  // Back button
  keyboard.push([
    { text: '🔙 بازگشت به لیست پادکست‌ها', callback_data: `p:${backPage}` },
    { text: '🏠 منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function trackDeliveryKeyboard(track, ep) {
  const keyboard = [];

  // Direct channel link
  keyboard.push([
    { text: '▶️ پخش آنلاین در تلگرام', url: `https://t.me/Playlistpodcas/${track.mid}` },
  ]);

  // Back to episode
  keyboard.push([
    { text: `🎙️ اپیزود: ${ep ? ep.title : 'بازگشت'}`, callback_data: `ep:${ep ? ep.mid : track.episodeMid}` },
    { text: '🏠 منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function searchResultsKeyboard(episodes, tracks) {
  const keyboard = [];

  if (episodes && episodes.length > 0) {
    for (const ep of episodes) {
      keyboard.push([
        { text: `🎙️ اپیزود: ${ep.title} (${ep.trackCount} قطعه)`, callback_data: `ep:${ep.mid}` },
      ]);
    }
  }

  if (tracks && tracks.length > 0) {
    for (const tr of tracks) {
      const cleanTitle = (tr.title || 'قطعه').slice(0, 36);
      keyboard.push([
        { text: `🎵 آهنگ: ${cleanTitle}`, callback_data: `tr:${tr.mid}` },
      ]);
    }
  }

  keyboard.push([
    { text: '🔍 جستجوی مجدد', callback_data: 'm:search' },
    { text: '🏠 منوی اصلی', callback_data: 'm:menu' },
  ]);

  return { inline_keyboard: keyboard };
}

export function myLeitnerKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🚀 عضویت در کانال @MyLeitner', url: 'https://t.me/MyLeitner' },
      ],
      [
        { text: '💬 ارتباط با ادمین', url: 'https://t.me/Mohsenniksirat' },
      ],
      [
        { text: '🏠 بازگشت به منوی اصلی', callback_data: 'm:menu' },
      ],
    ],
  };
}

export function developerKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💬 ارتباط مستقیم تلگرام', url: 'https://t.me/Mohsenniksirat' },
      ],
      [
        { text: '📢 کانال معرفی اپلیکیشن‌ها و اخبار', url: 'https://t.me/MyLeitner' },
      ],
      [
        { text: '🐙 پیج گیت‌هاب (GitHub)', url: 'https://github.com/mohsen-niksirat/' },
      ],
      [
        { text: '🔙 بازگشت به منوی اصلی', callback_data: 'm:menu' },
      ],
    ],
  };
}

export function backToMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'm:menu' }],
    ],
  };
}
