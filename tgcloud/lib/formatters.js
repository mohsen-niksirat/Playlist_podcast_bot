import { TAGS } from 'lib/db';

export function formatWelcome(name) {
  return (
    `سلام ${name || 'عزیز'}! 🎧\n\n` +
    `به ربات آرشیو <b>پادکست «پلی لیست» (Playlist)</b> خوش آمدید.\n\n` +
    `مجموعه‌ای از بهترین موسیقی‌های گلچین‌شده در سبک‌ها و حس‌وحال‌های مختلف به تهیه‌کنندگی مختار رزمجو.\n\n` +
    `🎙️ <b>۳۱۴ اپیزود پادکست</b>\n` +
    `🎶 <b>بیش از ۶,۸۰۰ قطعه موسیقی باکیفیت</b>\n` +
    `🏷️ <b>دسته‌بندی مودها: شاد، غمگین، بیکلام، جاز، نوستالژی، سفر و ...</b>\n\n` +
    `از دکمه‌های زیر برای دسترسی سریع به پادکست‌ها استفاده نمایید:`
  );
}

export function formatEpisodeCard(ep, trackCount) {
  let text = `🎙️ <b>پادکست پلی‌لیست — اپیزود ${ep.orderIndex}</b>\n`;
  text += `🔥 عنوان: <b>«${ep.title}»</b>\n\n`;
  text += `🎼 تعداد قطعات این اپیزود: <b>${trackCount} آهنگ</b>\n`;
  if (ep.castboxUrl && ep.castboxUrl.startsWith('http')) {
    text += `🔗 کست‌باکس: <a href="${ep.castboxUrl}">شنیدن کامل در Castbox</a>\n`;
  }
  text += `\n👇 برای دریافت یا پخش هر قطعه، روی دکمه‌های زیر کلیک کنید:`;
  return text;
}

export function formatTrackCaption(track, episode) {
  let caption = `🎵 <b>${track.title || 'قطعه موسیقی'}</b>\n`;
  if (episode) {
    caption += `🎙️ اپیزود: <b>«${episode.title}»</b> (قسمت ${episode.orderIndex})\n`;
    if (episode.castboxUrl && episode.castboxUrl.startsWith('http')) {
      caption += `🔗 <a href="${episode.castboxUrl}">شنیدن پادکست در Castbox</a>\n`;
    }
  }
  if (track.status) {
    caption += `⏱️ مشخصات: <code>${track.status}</code>\n`;
  }
  if (track.contributor) {
    caption += `❤️ ارسال‌شده توسط: <b>${track.contributor}</b>\n`;
  }
  caption += `\n📢 کانال: @MyLeitner\n`;
  caption += `🤖 ربات: @Playlist_podcast_bot`;
  return caption;
}

export function formatTrackFallback(track, episode) {
  let text = `🎵 <b>${track.title || 'قطعه موسیقی'}</b>\n`;
  if (episode) {
    text += `🎙️ متعلق به اپیزود: <b>«${episode.title}»</b> (قسمت ${episode.orderIndex})\n`;
  }
  if (track.status) {
    text += `⏱️ مشخصات: <code>${track.status}</code>\n`;
  }
  text += `\n👇 <i>با دکمه زیر می‌توانید این آهنگ را مستقیماً در کانال تلگرام بشنوید:</i>\n\n📢 کانال: @MyLeitner`;
  return text;
}

export function formatTagHeader(tagKey) {
  const tObj = TAGS.find((t) => t.key === tagKey);
  const title = tObj ? `${tObj.icon} ${tObj.name}` : 'این سبک';
  return (
    `🎧 <b>پیشنهاد تصادفی قطعات — ${title}</b>\n\n` +
    `تعدادی قطعه گلچین شده از این سبک برای شما انتخاب شد. با لمس هر کدام می‌توانید آن را دریافت کنید:`
  );
}

export function formatInlinePanel() {
  return (
    `🎛️ <b>پنل پیشرفته کنترل اینلاین:</b>\n\n` +
    `از کلیدهای زیر برای دسترسی سریع به آهنگ‌های تصادفی، مودها، یا فعال‌سازی جستجوی اینلاین در سایر چت‌ها و گروه‌ها استفاده کنید:\n\n` +
    `💡 <b>راهنمای حالت اینلاین:</b> با زدن روی دکمه «جستجوی اینلاین»، می‌توانید بدون نیاز به اضافه کردن ربات به گروه، در هر مکالمه‌ای موزیک‌های پادکست را پیدا کرده و برای دیگران بفرستید!`
  );
}

export function formatMyLeitnerChannel() {
  return (
    `📢 <b>کانال تلگرام مای لیتنر (@MyLeitner)</b>\n\n` +
    `مرجع تخصصی معرفی <b>برترین اپلیکیشن‌ها، ابزارهای هوش مصنوعی، بات‌ها و اخبار تکنولوژی</b> 📱🚀\n\n` +
    `🔹 معرفی کاربردی‌ترین برنامه‌ها و ابزارهای دنیای اینترنت\n` +
    `🔹 پروژه‌ها و ترفندهای هوش مصنوعی و تلگرام\n` +
    `🔹 اخبار و آموزش‌های تکنولوژی\n\n` +
    `👇 <b>برای عضویت در کانال روی لینک زیر کلیک کنید:</b>\n` +
    `👉 <a href="https://t.me/MyLeitner">@MyLeitner</a>`
  );
}

export function formatDeveloperInfo() {
  return (
    `👨‍💻 <b>درباره توسعه‌دهنده ربات:</b>\n\n` +
    `👤 <b>محسن نیک‌سیرت (Mohsen Niksirat)</b>\n\n` +
    `🔹 <b>ارتباط مستقیم تلگرام:</b>\n` +
    `👉 @Mohsenniksirat\n\n` +
    `🔹 <b>کانال معرفی اپلیکیشن‌ها، ابزارها و اخبار تکنولوژی:</b>\n` +
    `📢 <a href="https://t.me/MyLeitner">@MyLeitner</a>\n\n` +
    `🔹 <b>پروفایل گیت‌هاب:</b>\n` +
    `🐙 <a href="https://github.com/mohsen-niksirat/">github.com/mohsen-niksirat</a>\n\n` +
    `«طراحی و پیاده‌سازی شده با معماری مدرن تلگرام سرورلس (tgcloud)»`
  );
}

export function formatStats(stats) {
  return (
    `📊 <b>آمار و وضعیت سیستم ربات:</b>\n\n` +
    `👥 تعداد کاربران: <b>${stats.users}</b>\n` +
    `🎙️ اپیزودهای ثبت‌شده: <b>${stats.episodes}</b>\n` +
    `🎵 قطعات موسیقی: <b>${stats.tracks}</b>\n` +
    `⚡ آهنگ‌های کش‌شده برای ارسال مستقیم (File_ID): <b>${stats.cachedTracks}</b>\n\n` +
    `💡 <i>راهنمای ادمین: هر زمان فایلی از کانال به ربات فوروارد شود، file_id آن به طور خودکار کش می‌شود.</i>`
  );
}

export function formatLinks() {
  return (
    `🔗 <b>لینک‌های رسمی پادکست پلی‌لیست:</b>\n\n` +
    `📻 <b>کست‌باکس:</b> <a href="https://castbox.fm/va/2480138">کانال رسمی در Castbox</a>\n` +
    `📢 <b>کانال تلگرام:</b> <a href="https://t.me/Playlistpodcas">@Playlistpodcas</a>\n` +
    `📷 <b>اینستاگرام پادکستر:</b> <a href="https://instagram.com/MokhtarRazmjooo">MokhtarRazmjooo</a>\n` +
    `☕ <b>حمایت مالی از پادکست:</b> <a href="https://reymit.ir/playlistpodcast">reymit.ir/playlistpodcast</a>\n\n` +
    `«شنونده حرفه‌ای باشیم» 🎧`
  );
}
