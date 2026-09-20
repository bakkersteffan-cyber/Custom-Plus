#!/usr/bin/env node
/*
  scripts/build-blog.mjs — CUSTOM+ blogbuild (Node >= 18, geen dependencies).

  Doet drie dingen, allemaal idempotent (zelfde input -> byte-identieke output):
  1. content/blog/*.json lezen -> content/blog-index.json schrijven
     (gesorteerd op datum aflopend; readMin = ceil(words / 220); words =
     alle p/h2/h3/quote teksten + ul items + stat value/label samen).
  2. sitemap.xml: het blok tussen <!-- blog:start --> en <!-- blog:end -->
     verversen met een <url> entry voor #/blog + elk artikel (priority 0.6).
     Alles buiten de markers blijft onaangeraakt. Geen markers = warn + skip.
  3. feed.xml: RSS 2.0, kanaal "CUSTOM+ Field notes" (Nederlandstalig), nieuwste
     20 artikelen, link = DOMAIN/blog/<slug>, pubDate in RFC822.

  Het domein komt uit de Sitemap regel in robots.txt (zelfde placeholder als
  de rest van het project totdat het echte domein is ingevuld).

  Crasht niet bij 0 artikelen of een ontbrekende content/blog map: dan wordt
  een lege index + feed geschreven en bevat het sitemapblok alleen #/blog.

  Datums zijn deterministisch uit de artikeldata; alleen de generated datum
  van een LEGE index valt terug op de huidige datum (new Date()).
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
var BLOG_DIR = path.join(ROOT, 'content', 'blog');
var INDEX_FILE = path.join(ROOT, 'content', 'blog-index.json');
var FEED_FILE = path.join(ROOT, 'feed.xml');
var ROBOTS_FILE = path.join(ROOT, 'robots.txt');

var FALLBACK_DOMAIN = 'https://REPLACE-WITH-YOUR-DOMAIN.example';
var WORDS_PER_MIN = 220;
var FEED_MAX = 20;
var CATEGORIES = ['ontwerp', 'sourcing', 'sampling', 'productie', 'kwaliteit', 'logistiek', 'ondernemen'];

/* ---------- helpers ---------- */

function readFileSafe(file){
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { return null; }
}

function writeIfChanged(file, content){
  var rel = path.relative(ROOT, file);
  if(readFileSafe(file) === content){
    console.log('build-blog: ' + rel + ' ongewijzigd');
    return;
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('build-blog: ' + rel + ' geschreven');
}

function escXml(s){
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isNonEmptyString(v){
  return typeof v === 'string' && v.trim() !== '';
}

function isValidDate(v){
  if(typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  var y = parseInt(v.slice(0, 4), 10);
  var m = parseInt(v.slice(5, 7), 10);
  var d = parseInt(v.slice(8, 10), 10);
  var t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function todayIso(){
  return new Date().toISOString().slice(0, 10);
}

/* RFC822 datum voor RSS, altijd 00:00:00 +0000 zodat de output deterministisch
   uit de artikeldatum volgt (geen lokale tijdzone in het spel). */
function rfc822(dateStr){
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var y = parseInt(dateStr.slice(0, 4), 10);
  var m = parseInt(dateStr.slice(5, 7), 10);
  var d = parseInt(dateStr.slice(8, 10), 10);
  var t = new Date(Date.UTC(y, m - 1, d));
  var dd = (d < 10 ? '0' : '') + d;
  return days[t.getUTCDay()] + ', ' + dd + ' ' + months[m - 1] + ' ' + y + ' 00:00:00 +0000';
}

/* Woorden tellen over de tekstvelden die het contract voorschrijft:
   p/h2/h3/quote .text, ul .items, stat .value + .label. */
function countWords(body){
  if(!Array.isArray(body)) return 0;
  var parts = [];
  body.forEach(function(block){
    if(!block || typeof block !== 'object') return;
    if(block.type === 'p' || block.type === 'h2' || block.type === 'h3' || block.type === 'quote'){
      if(isNonEmptyString(block.text)) parts.push(block.text);
    } else if(block.type === 'ul'){
      if(Array.isArray(block.items)){
        block.items.forEach(function(item){
          if(isNonEmptyString(item)) parts.push(item);
        });
      }
    } else if(block.type === 'stat'){
      if(isNonEmptyString(block.value)) parts.push(block.value);
      if(isNonEmptyString(block.label)) parts.push(block.label);
    }
  });
  return parts.join(' ').split(/\s+/).filter(function(w){ return w !== ''; }).length;
}

/* Domein uit de Sitemap regel in robots.txt (zonder /sitemap.xml, zonder
   trailing slash). Valt terug op de projectbrede placeholder. */
function readDomain(){
  /* op Netlify staat het echte adres in de omgeving (eigen domein zodra dat
     gekoppeld is, anders de netlify.app URL) — dan hoeft niemand handmatig
     placeholders te vervangen */
  var fromEnv = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').trim().replace(/\/+$/, '');
  if(fromEnv) return fromEnv;
  var robots = readFileSafe(ROBOTS_FILE);
  if(robots !== null){
    var m = robots.match(/^Sitemap:\s*(\S+)/mi);
    if(m){
      var base = m[1].replace(/\/sitemap\.xml$/i, '').replace(/\/+$/, '');
      if(base) return base;
    }
  }
  console.warn('build-blog: geen Sitemap regel in robots.txt gevonden, placeholder domein gebruikt');
  return FALLBACK_DOMAIN;
}

/* robots.txt laten meelopen met het echte domein van de deploy */

/* ---------- 1. artikelen lezen + valideren ---------- */

function loadArticles(){
  var files;
  try {
    files = fs.readdirSync(BLOG_DIR);
  } catch (e) {
    console.warn('build-blog: map content/blog ontbreekt of is onleesbaar, 0 artikelen');
    return [];
  }
  var articles = [];
  files
    .filter(function(f){ return /\.json$/i.test(f); })
    .sort()
    .forEach(function(f){
      var raw = readFileSafe(path.join(BLOG_DIR, f));
      if(raw === null){
        console.warn('build-blog: kon content/blog/' + f + ' niet lezen, overgeslagen');
        return;
      }
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn('build-blog: ongeldige JSON in content/blog/' + f + ', overgeslagen');
        return;
      }
      if(!data || typeof data !== 'object' || Array.isArray(data)){
        console.warn('build-blog: content/blog/' + f + ' is geen object, overgeslagen');
        return;
      }
      var base = f.replace(/\.json$/i, '');
      if(!isNonEmptyString(data.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)){
        console.warn('build-blog: content/blog/' + f + ' heeft geen geldige slug, overgeslagen');
        return;
      }
      if(data.slug !== base){
        console.warn('build-blog: slug "' + data.slug + '" wijkt af van bestandsnaam ' + f + ' (de app fetcht op slug), overgeslagen');
        return;
      }
      if(!isNonEmptyString(data.title)){
        console.warn('build-blog: content/blog/' + f + ' heeft geen geldige title, overgeslagen');
        return;
      }
      if(!isValidDate(data.date)){
        console.warn('build-blog: content/blog/' + f + ' heeft geen geldige date (YYYY-MM-DD), overgeslagen');
        return;
      }
      var lang = (data.lang === 'nl' || data.lang === 'en') ? data.lang : 'nl';
      if(data.lang !== undefined && data.lang !== lang){
        console.warn('build-blog: content/blog/' + f + ' heeft onbekende lang "' + data.lang + '", "nl" gebruikt');
      }
      var category = isNonEmptyString(data.category) ? data.category.trim() : '';
      if(category && CATEGORIES.indexOf(category) === -1){
        console.warn('build-blog: content/blog/' + f + ' heeft onbekende category "' + category + '" (filter matcht niet)');
      }
      var words = countWords(data.body);
      articles.push({
        slug: data.slug,
        title: data.title.trim(),
        lang: lang,
        date: data.date,
        category: category,
        dek: isNonEmptyString(data.dek) ? data.dek.trim() : '',
        photo: isNonEmptyString(data.photo) ? data.photo.trim() : '',
        readMin: Math.max(1, Math.ceil(words / WORDS_PER_MIN)),
        words: words,
        series: isNonEmptyString(data.series) ? data.series.trim() : '',
        seriesPart: (typeof data.seriesPart === 'number' && isFinite(data.seriesPart)) ? data.seriesPart : 0
      });
    });
  articles.sort(function(a, b){
    if(a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.slug < b.slug ? -1 : (a.slug > b.slug ? 1 : 0);
  });
  return articles;
}

/* ---------- 2. content/blog-index.json ---------- */

function buildIndexJson(articles){
  var index = {
    generated: articles.length ? articles[0].date : todayIso(),
    articles: articles
  };
  return JSON.stringify(index, null, 2) + '\n';
}

/* ---------- 4. feed.xml (RSS 2.0) ---------- */

function buildFeedXml(articles, domain){
  var items = articles.slice(0, FEED_MAX);
  var newest = articles.length ? articles[0].date : todayIso();
  var blogUrl = domain + '/blog';
  var out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
  out.push('  <channel>');
  out.push('    <title>CUSTOM+ Field notes</title>');
  out.push('    <link>' + escXml(blogUrl) + '</link>');
  /* de feed is Nederlandstalig, net als de artikelen en de site zelf */
  out.push('    <description>' + escXml('Eerlijke notities over produceren in China: kosten, samples, onderhandelen over MOQ, kwaliteitscontrole en transport.') + '</description>');
  out.push('    <language>nl</language>');
  out.push('    <lastBuildDate>' + rfc822(newest) + '</lastBuildDate>');
  out.push('    <atom:link href="' + escXml(domain + '/feed.xml') + '" rel="self" type="application/rss+xml"/>');
  items.forEach(function(a){
    var link = domain + '/blog/' + a.slug;
    out.push('    <item>');
    out.push('      <title>' + escXml(a.title) + '</title>');
    out.push('      <link>' + escXml(link) + '</link>');
    out.push('      <guid isPermaLink="true">' + escXml(link) + '</guid>');
    out.push('      <pubDate>' + rfc822(a.date) + '</pubDate>');
    out.push('      <description>' + escXml(a.dek) + '</description>');
    out.push('    </item>');
  });
  out.push('  </channel>');
  out.push('</rss>');
  return out.join('\n') + '\n';
}

/* ---------- main ---------- */

/* robots.txt en sitemap.xml worden volledig door scripts/build-site.mjs
   geschreven, dat de complete routelijst kent. Dit script levert alleen nog de
   blogindex en de RSS feed. */
var domain = readDomain();
var articles = loadArticles();
console.log('build-blog: ' + articles.length + ' artikel(en) in de index');
writeIfChanged(INDEX_FILE, buildIndexJson(articles));
writeIfChanged(FEED_FILE, buildFeedXml(articles, domain));
