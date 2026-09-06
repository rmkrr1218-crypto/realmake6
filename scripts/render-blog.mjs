import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://realmake-okegawa.github.io/realmake6";
const lineUrl = "https://lin.ee/sEbKJ6O";
const phoneUrl = "tel:09014340189";
const contactUrl = "contact/";
const postsPath = path.join(root, "blog-posts.json");
const homePath = path.join(root, "index.html");
const duplicateReminderSlug = "2026-08-06-obon-inspection-deadline";
const legacyRedirects = [
  ["chalking", "2026-07-12-chalking-check"],
  ["caulking-deterioration", "2026-07-13-caulking-deterioration"],
  ["wall-crack", "2026-07-14-wall-crack-check"],
];
const defaultOgImage = "assets/og/default.webp";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const escapeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const indent = (value, spaces) => value.split("\n").map((line) => line ? `${" ".repeat(spaces)}${line}` : line).join("\n");
const displayDate = (date) => String(date).split("-").join(".");
const paragraphs = (body) => (Array.isArray(body) ? body : String(body || "").split(/\n{2,}/))
  .map((item) => String(item).trim()).filter(Boolean);
const renderBody = (body) => paragraphs(body)
  .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("\n");
const sourceImage = (relativePath, src) => /^(https?:)?\/\//.test(src) ? src : `${relativePath}${src}`;

function images(post) {
  const candidates = Array.isArray(post.images) && post.images.length ? post.images : post.image ? [{ src: post.image, alt: post.imageAlt }] : [];
  return candidates.map((image) => typeof image === "string" ? { src: image, alt: post.title } : image)
    .filter((image) => image?.src && (/^(https?:)?\/\//.test(image.src) || fs.existsSync(path.join(root, image.src))))
    .map((image) => ({
      src: image.src,
      thumbnail: image.thumbnail || image.src,
      alt: image.alt || post.title || "ブログ写真",
      loading: image.loading,
    }));
}

function excerpt(post, limit = 150) {
  const text = paragraphs(post.body).join("\n\n");
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const punctuation = [...head.matchAll(/[。！？!?]/g)].at(-1);
  return `${text.slice(0, punctuation ? punctuation.index + 1 : limit).trim()}...`;
}

function metaDescription(post, limit = 120) {
  const greeting = /^(?:おはようございます|こんにちは|こんばんは|いつもありがとうございます|本日もありがとうございます)[\s、,。！!]*/;
  const prelude = /^(?:さて[、,]?\s*|今日は[、,]?\s*|本日は[、,]?\s*)/;
  const emoji = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;
  const lines = paragraphs(post.body).map((line) => line.replace(emoji, "").replace(/\s+/g, " ").trim())
    .map((line) => line.replace(greeting, "").replace(prelude, "").trim()).filter(Boolean);
  const useful = lines.find((line) => !/^(?:梅雨|天気|暑い|寒い|昨日の夜|今日は良い)/.test(line)) || lines[0] || post.title;
  const text = [useful, ...lines.filter((line) => line !== useful)].join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const shortened = text.slice(0, limit);
  const punctuation = [...shortened.matchAll(/[。！？]/g)].at(-1);
  return `${shortened.slice(0, punctuation ? punctuation.index + 1 : Math.max(0, limit - 1)).trim()}…`;
}

async function makeOgImage(input, output) {
  const inputPath = path.join(root, input);
  const outputPath = path.join(root, output);
  if (!fs.existsSync(inputPath)) return false;
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).mtimeMs >= fs.statSync(inputPath).mtimeMs) return true;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath).rotate().resize({ width: 1200, height: 630, fit: "contain", background: "#f7f5f1" }).webp({ quality: 82, effort: 5 }).toFile(outputPath);
  return true;
}

function header(relativePath) {
  return `  <div class="trustbar">
    <div class="trustbar-in">
      <a class="trustbar-item" href="https://share.google/U1dqcpyOBwvAJcPx8" target="_blank" rel="noopener"><span class="trustbar-stars" aria-hidden="true">★★★★★</span><span class="trustbar-score">5.0</span><span>Googleクチコミ19件</span></a>
      <span class="trustbar-item">職人歴24年以上</span>
      <span class="trustbar-item is-optional">桶川市在住・職人直営</span>
      <span class="trustbar-item is-optional">現地調査・お見積り無料</span>
    </div>
  </div>
  <header class="sitehead">
    <div class="in">
      <div class="sitehead-row">
        <a class="logo" href="${relativePath}index.html"><img class="sitehead-logo-mark" src="${relativePath}assets/web/site/logo.webp" alt="" width="38" height="38"><span class="sitehead-logo-name">Real Make<span class="sitehead-logo-kana">（リアルメイク）</span></span></a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="menu-toggle-icon" aria-hidden="true">☰</span><span class="visually-hidden">メニューを開く</span></button>
        <a class="sitehead-phone" href="${phoneUrl}">電話する</a>
      </div>
      <nav class="site-nav" id="site-nav" aria-label="主要メニュー">
        <a href="${relativePath}services/exterior-painting/index.html">外壁塗装</a><a href="${relativePath}services/roof-painting/index.html">屋根塗装</a><a href="${relativePath}works/index.html">施工事例</a><a href="${relativePath}price/index.html">料金</a><a href="${relativePath}reason/index.html">選ばれる理由</a><a href="${relativePath}area/okegawa/index.html">桶川市</a><a href="${relativePath}company/index.html">代表・会社情報</a><a href="${relativePath}faq/index.html">よくある質問</a><a href="${relativePath}${contactUrl}">お問い合わせ</a>
      </nav>
    </div>
  </header>`;
}

function footer(relativePath) {
  return `  <footer class="sitefoot"><div class="wrap"><a href="${relativePath}index.html">ホーム</a><a href="${relativePath}services/exterior-painting/index.html">外壁塗装</a><a href="${relativePath}services/roof-painting/index.html">屋根塗装</a><a href="${relativePath}works/index.html">施工事例</a><a href="${relativePath}company/index.html">代表・会社情報</a><a href="${relativePath}faq/index.html">FAQ</a><a href="${relativePath}area/okegawa/index.html">桶川市</a><a href="${relativePath}free-support/">30分無料サポート</a><div class="cp">Real Make（リアルメイク）／埼玉県桶川市上日出谷南2-1-19／090-1434-0189</div></div></footer>`;
}

function head({ title, description, canonical, relativePath, data, ogImage = defaultOgImage, type = "website" }) {
  const absoluteOgImage = /^(https?:)?\/\//.test(ogImage) ? ogImage : `${siteUrl}/${ogImage}`;
  return `<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(absoluteOgImage)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:type" content="${type}"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="${relativePath}assets/css/site.css">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PCG1M6JXX0"></script>
  <script src="${relativePath}assets/js/site-analytics.js"></script>
  <script src="${relativePath}assets/js/nav.js" defer></script>${data ? `\n  <script type="application/ld+json">${escapeJson(data)}</script>` : ""}
</head>`;
}

function homeCard(post) {
  const image = images(post)[0];
  return `<a class="rm-blog-card" href="./blog/${escapeHtml(post.slug)}/" data-ga-location="home_blog">${image ? `\n  <img src="./${escapeHtml(image.thumbnail)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">` : ""}
  <div>
    <time datetime="${escapeHtml(post.date)}">${displayDate(post.date)}｜${escapeHtml(post.category || "お知らせ")}</time>
    <h3>${escapeHtml(post.title)}</h3>
    <span class="rm-blog-more">記事を読む →</span>
  </div>
</a>`;
}

function articlePage(post, older, newer) {
  const relativePath = "../../";
  const canonical = `${siteUrl}/blog/${post.slug}/`;
  const postImages = images(post);
  const blogPosting = {
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: post.title, datePublished: `${post.date}T00:00:00+09:00`,
    image: postImages.map((image) => `${siteUrl}/${image.src.replace(/^\/+/, "")}`),
    author: { "@type": "Organization", name: "Real Make" },
    publisher: { "@type": "Organization", name: "Real Make", url: `${siteUrl}/` },
  };
  const data = { "@context": "https://schema.org", "@graph": [blogPosting, {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "ブログ", item: `${siteUrl}/blog/` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  }] };
  const gallery = postImages.map((image) => `          <figure class="blog-article-image"><img src="${escapeHtml(sourceImage(relativePath, image.src))}" alt="${escapeHtml(image.alt)}" loading="${image.loading === "eager" ? "eager" : "lazy"}" decoding="async"></figure>`).join("\n");
  const olderLink = older ? `<a href="../${escapeHtml(older.slug)}/index.html" rel="prev">← 前の記事<br><strong>${escapeHtml(older.title)}</strong></a>` : "";
  const newerLink = newer ? `<a href="../${escapeHtml(newer.slug)}/index.html" rel="next">次の記事 →<br><strong>${escapeHtml(newer.title)}</strong></a>` : "";
  return `<!doctype html>
<html lang="ja">
${head({ title: `${post.title}｜Real Make`, description: metaDescription(post), canonical, relativePath, data, ogImage: post.ogImage, type: "article" })}
<body>
${header(relativePath)}
  <main>
    <div class="wrap"><nav class="crumb" aria-label="パンくず"><a href="${relativePath}index.html">ホーム</a> ＞ <a href="../index.html">ブログ</a> ＞ <span aria-current="page">${escapeHtml(post.title)}</span></nav></div>
    <article class="blog-article"><div class="narrow">
      <div class="label">${escapeHtml(post.category || "お知らせ")}</div><time class="blog-article-date" datetime="${escapeHtml(post.date)}">${displayDate(post.date)}</time>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="blog-article-body">
${indent(renderBody(post.body), 8)}
      </div>
${gallery}
      <nav class="blog-adjacent" aria-label="前後の記事">${olderLink}${newerLink}</nav>
    </div></article>
    <section class="finalcta blog-article-cta"><div class="narrow"><h2>住まいのことで気になることがあれば、ご相談ください。</h2><p>写真を送ってのご相談、電話でのご相談、概算費用の確認に対応しています。</p><div class="ctabtns"><a class="btn" href="${relativePath}${contactUrl}">フォームで相談する</a><a class="btn line" href="${lineUrl}" target="_blank" rel="noopener">LINEで無料相談</a><a class="btn ghost" href="${phoneUrl}">電話で相談</a><a class="btn ghost" href="${relativePath}painting_simulator.html">無料見積りを確認</a></div></div></section>
  </main>
${footer(relativePath)}
</body>
</html>
`;
}

function indexCard(post) {
  const image = images(post)[0];
  return `        <article class="blog-index-card" data-blog-category="${escapeHtml(post.category || "お知らせ")}"><a href="${escapeHtml(post.slug)}/index.html">${image ? `<img src="../${escapeHtml(image.thumbnail)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">` : ""}<div class="blog-index-card-body"><div class="blog-meta"><time datetime="${escapeHtml(post.date)}">${displayDate(post.date)}</time><span>${escapeHtml(post.category || "お知らせ")}</span></div><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(excerpt(post)).replaceAll("\n", "<br>")}</p><span>続きを読む</span></div></a></article>`;
}

function blogIndex(posts) {
  const relativePath = "../";
  const canonical = `${siteUrl}/blog/`;
  const categories = [...new Set(posts.map((post) => post.category || "お知らせ"))];
  const filters = ["すべて", ...categories].map((category, index) => `<button type="button" data-blog-filter="${escapeHtml(category === "すべて" ? "all" : category)}" aria-pressed="${index === 0}">${escapeHtml(category)}</button>`).join("");
  return `<!doctype html>
<html lang="ja">
${head({ title: "おしらせ・現場ブログ｜Real Make", description: "桶川市の塗装店 Real Make の現場記録と、住まいのメンテナンスに役立つ情報。", canonical, relativePath, data: { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "ホーム", item: `${siteUrl}/` }, { "@type": "ListItem", position: 2, name: "ブログ", item: canonical }] } })}
<body>
${header(relativePath)}
  <main><div class="wrap"><nav class="crumb" aria-label="パンくず"><a href="${relativePath}index.html">ホーム</a> ＞ <span aria-current="page">ブログ</span></nav></div>
    <section class="blog-index-page"><div class="wrap"><div class="label">Blog</div><h1>おしらせ・現場ブログ</h1><p class="lead">現場で見てきたことと、住まいのメンテナンスに役立つ情報を掲載しています。</p>
      <div class="blog-filter" aria-label="カテゴリで絞り込む">${filters}</div><p class="blog-result-count" aria-live="polite"></p>
      <div class="blog-index-grid">${posts.map(indexCard).join("\n")}</div>
      <nav class="blog-pagination" aria-label="記事一覧のページ送り"><button type="button" data-blog-prev>前へ</button><span data-blog-page></span><button type="button" data-blog-next>次へ</button></nav>
    </div></section>
  </main>
${footer(relativePath)}
  <script src="${relativePath}assets/js/blog-list.js" defer></script>
</body>
</html>
`;
}

function legacyRedirect(newSlug) {
  const relativePath = "../../";
  const target = `${siteUrl}/blog/${newSlug}/`;
  return `<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${target}"><title>記事のURLが変わりました｜Real Make</title><link rel="stylesheet" href="${relativePath}assets/css/site.css"><script src="${relativePath}assets/js/nav.js" defer></script></head>
<body>${header(relativePath)}<main><section><div class="narrow"><h1>記事のURLが変わりました</h1><p>新しいページへ移動します。移動しない場合は、<a href="../${newSlug}/index.html">こちらを選択してください。</a></p></div></section></main>${footer(relativePath)}</body></html>
`;
}

function collectHtml(directory, files = []) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "scripts", "docs", "_site", "_includes", "_layouts"].includes(item.name)) continue;
    const itemPath = path.join(directory, item.name);
    if (item.isDirectory()) collectHtml(itemPath, files);
    else if (item.name.endsWith(".html")) files.push(itemPath);
  }
  return files;
}

function sitemap(posts) {
  const postDates = new Map(posts.map((post) => [`blog/${post.slug}/index.html`, post.date]));
  const legacy = new Set(legacyRedirects.map(([oldSlug]) => `blog/${oldSlug}/index.html`));
  const excluded = new Set([
    "contact/thanks/index.html",
    "google324b4de955c06238.html",
    "okegawa.html",
  ]);
  const urls = collectHtml(root).map((file) => path.relative(root, file).split(path.sep).join("/"))
    .filter((file) => !legacy.has(file) && file !== "takeoff.html" && !excluded.has(file) && !file.startsWith("design-proposals/")).sort();
  const urlFor = (file) => file === "index.html" ? `${siteUrl}/` : file.endsWith("/index.html") ? `${siteUrl}/${file.slice(0, -"index.html".length)}` : `${siteUrl}/${file}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((file) => `  <url><loc>${escapeHtml(urlFor(file))}</loc>${postDates.has(file) ? `<lastmod>${postDates.get(file)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

const sourcePosts = JSON.parse(fs.readFileSync(postsPath, "utf8"));
if (!Array.isArray(sourcePosts)) throw new Error("blog-posts.json must contain an array.");
if (sourcePosts.some((post) => post.slug === duplicateReminderSlug)) throw new Error("Remove the duplicate reminder article before rendering.");
if (sourcePosts.some((post) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug || ""))) throw new Error("Every post needs a lowercase ASCII slug.");
if (new Set(sourcePosts.map((post) => post.slug)).size !== sourcePosts.length) throw new Error("Blog post slugs must be unique.");
if (sourcePosts.length !== 87) throw new Error(`Expected 87 canonical posts, received ${sourcePosts.length}.`);

const posts = [...sourcePosts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
await makeOgImage("assets/optimized/page/assets/img/works/okegawa-kamogawa-after-front.webp", defaultOgImage);
for (const post of posts) {
  const firstImage = images(post)[0];
  const output = `assets/og/blog/${post.slug}.webp`;
  post.ogImage = firstImage && await makeOgImage(firstImage.src, output) ? output : defaultOgImage;
}
const homeHtml = fs.readFileSync(homePath, "utf8");
const nextHomeHtml = homeHtml.replace(/          <!-- BLOG-POSTS START -->[\s\S]*?          <!-- BLOG-POSTS END -->/, `          <!-- BLOG-POSTS START -->\n${posts.slice(0, 3).map((post, index) => indent(homeCard(post, index === 0), 10)).join("\n")}\n          <!-- BLOG-POSTS END -->`);
if (nextHomeHtml === homeHtml && !homeHtml.includes("BLOG-POSTS START")) throw new Error("BLOG-POSTS markers were not found.");
fs.writeFileSync(homePath, nextHomeHtml);
fs.writeFileSync(path.join(root, "blog", "index.html"), blogIndex(posts));
for (let index = 0; index < posts.length; index += 1) {
  const post = posts[index];
  const output = path.join(root, "blog", post.slug, "index.html");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, articlePage(post, posts[index + 1], posts[index - 1]));
}
for (const [oldSlug, newSlug] of legacyRedirects) {
  const output = path.join(root, "blog", oldSlug, "index.html");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, legacyRedirect(newSlug));
}
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap(posts));
console.log(`Rendered ${posts.length} canonical blog posts, 3 legacy redirects, and sitemap.xml.`);
