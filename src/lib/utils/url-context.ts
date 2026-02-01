/**
 * URL Context Extraction Utility
 * Extracts meaningful context from URL structure without external requests.
 * All metadata is derived from the URL string itself.
 */

import type { UrlContext } from './url-context-types';
import {
	extractGoogleMaps,
	extractAppleMaps,
	extractOpenStreetMap,
	extractWaze
} from './map-url-parsers';

/**
 * Extract contextual metadata from a URL
 * Returns null for fallback (use default display)
 */
export function extractUrlContext(url: string): UrlContext | null {
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.toLowerCase();
		const pathname = parsed.pathname;

		// Google Maps
		if (hostname.includes('google.') && pathname.includes('/maps')) {
			return extractGoogleMaps(parsed);
		}

		// Google Maps short links
		if (hostname === 'maps.app.goo.gl' || hostname === 'goo.gl') {
			return {
				icon: '📍',
				label: 'Google Maps',
			};
		}

		// Apple Maps
		if (hostname === 'maps.apple.com' || hostname === 'maps.apple') {
			return extractAppleMaps(parsed);
		}

		// OpenStreetMap
		if (hostname.includes('openstreetmap.org')) {
			return extractOpenStreetMap(parsed);
		}

		// Waze
		if (hostname.includes('waze.com')) {
			return extractWaze(parsed);
		}

		// Try to get icon for known domains
		return getKnownDomainIcon(hostname);
	} catch {
		// Invalid URL - return null for fallback
		return null;
	}
}

/**
 * Domain lists grouped by broad categories
 */

// Maps/Location 🗺️
const MAP_DOMAINS = [
	'google.com/maps', 'maps.app.goo.gl', 'goo.gl', 'maps.apple.com',
	'here.com', 'wego.here.com', 'bing.com/maps', 'azure.com/maps',
	'mapbox.com', 'mapquest.com', 'mapy.cz', 'moovit.com', 'tomtom.com',
	'waze.com', 'openstreetmap.org', 'wikimapia.org', 'yandex.com/maps',
	'yandex.ru/maps', 'petalmaps.com', 'fosm.org', 'earth.google.com'
];

// News 📰
const NEWS_DOMAINS = [
	'bbc.com', 'bbc.co.uk', 'nytimes.com', 'msn.com', 'cnn.com', 'news.google.com',
	'theguardian.com', 'indiatimes.com', 'foxnews.com', 'dailymail.co.uk',
	'finance.yahoo.com', 'people.com', 'news.yahoo.com', 'ndtv.com', 'usatoday.com',
	'substack.com', 'hindustantimes.com', 'news18.com', 'nypost.com', 'cnbc.com',
	'forbes.com', 'apnews.com', 'indianexpress.com', 'cbsnews.com', 'nbcnews.com',
	'washingtonpost.com', 'wsj.com', 'reuters.com', 'news.com.au', 'thehindu.com',
	'businessinsider.com', 'buzzfeed.com', 'abc.net.au', 'independent.co.uk',
	'telegraph.co.uk', 'oneindia.com', 'newsweek.com', 'abcnews.go.com',
	'indiatoday.in', 'thesun.co.uk', 'india.com', 'cbc.ca', 'rediff.com',
	'news.sky.com', 'politico.com', 'mirror.co.uk', 'express.co.uk',
	'drudgereport.com', 'bloomberg.com', 'thehill.com', 'rt.com'
];

// Social Media 👥
const SOCIAL_DOMAINS = [
	'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'reddit.com',
	'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net', 'tumblr.com',
	'twitter.com', 'x.com', 'weibo.com', 'quora.com', 'xiaohongshu.com', 'xhs.com',
	'kuaishou.com', 'douyin.com'
];

// Messaging 💬
const MESSAGING_DOMAINS = [
	'discord.com', 'discord.gg', 'whatsapp.com', 'wa.me', 'telegram.org', 't.me',
	'line.me', 'wechat.com', 'weixin.qq.com', 'messenger.com', 'm.me', 'viber.com',
	'slack.com', 'teams.microsoft.com', 'qq.com'
];

// Video 📹
const VIDEO_DOMAINS = [
	'youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com',
	'bilibili.com', 'rumble.com', 'bitchute.com', 'odysee.com', 'nebula.tv',
	'nebula.app', 'iqiyi.com', 'youku.com', 'niconico.jp', 'nicovideo.jp',
	'acfun.cn', 'rutube.ru', 'aparat.com', 'dlive.tv', 'vbox7.com'
];

// Music 🎵
const MUSIC_DOMAINS = [
	'spotify.com', 'music.apple.com', 'soundcloud.com', 'music.youtube.com',
	'music.amazon.', 'amazon.com/music', 'pandora.com', 'deezer.com', 'tidal.com',
	'iheart.com', 'iheartradio.com', 'bandcamp.com', 'napster.com', 'qobuz.com',
	'tunein.com', 'siriusxm.com', 'anghami.com', 'audiomack.com', 'boomplay.com',
	'gaana.com', 'jiosaavn.com', 'music.163.com', 'y.qq.com', 'idagio.com'
];

// Images 📸
const IMAGE_DOMAINS = [
	'imgur.com', 'flickr.com', 'unsplash.com', '500px.com', 'deviantart.com'
];

// Cloud/Storage ☁️
const CLOUD_DOMAINS = [
	'dropbox.com', 'drive.google.com', 'icloud.com',
	'onedrive.live.com', 'onedrive.com'
];

// Code/Dev 💻
const CODE_DOMAINS = [
	'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com'
];

// Docs/Productivity 📄
const PRODUCTIVITY_DOMAINS = [
	'docs.google.com', 'sheets.google.com', 'slides.google.com',
	'notion.so', 'notion.site', 'trello.com', 'asana.com', 'monday.com',
	'zoom.us', 'medium.com', 'dev.to', 'hashnode.', 'developer.mozilla.org',
	'readthedocs.', 'wikipedia.org'
];

// Shopping 🛍️
const SHOPPING_DOMAINS = [
	'amazon.', 'ebay.', 'etsy.com', 'aliexpress.com', 'shopify.com',
	'walmart.com', 'target.com', 'booking.com', 'expedia.com', 'kayak.com',
	'airbnb.com', 'hotels.com', 'tripadvisor.com', 'ubereats.com',
	'doordash.com', 'grubhub.com', 'deliveroo.'
];

// Finance/Payment 💳
const FINANCE_DOMAINS = ['paypal.com', 'venmo.com', 'cash.app', 'stripe.com'];

// Education 🎓
const EDUCATION_DOMAINS = ['coursera.org', 'udemy.com', 'khanacademy.org'];

// Design 🎨
const DESIGN_DOMAINS = ['figma.com', 'canva.com', 'dribbble.com', 'behance.net', 'adobe.com'];

/**
 * Helper function to check if domain matches any pattern in a list
 */
function matchesDomain(domain: string, patterns: string[]): boolean {
	return patterns.some(p => domain.includes(p));
}

/**
 * Get icon for known domains
 */
function getKnownDomainIcon(hostname: string): UrlContext | null {
	// Remove www. prefix for matching
	const domain = hostname.replace(/^www\./, '');

	// Check each category
	if (matchesDomain(domain, MAP_DOMAINS)) return { icon: '🗺️' };
	if (matchesDomain(domain, NEWS_DOMAINS)) return { icon: '📰' };
	if (matchesDomain(domain, SOCIAL_DOMAINS)) return { icon: '👥' };
	if (matchesDomain(domain, MESSAGING_DOMAINS)) return { icon: '💬' };
	if (matchesDomain(domain, VIDEO_DOMAINS)) return { icon: '📹' };
	if (matchesDomain(domain, MUSIC_DOMAINS)) return { icon: '🎵' };
	if (matchesDomain(domain, IMAGE_DOMAINS)) return { icon: '📸' };
	if (matchesDomain(domain, CLOUD_DOMAINS)) return { icon: '☁️' };
	if (matchesDomain(domain, CODE_DOMAINS)) return { icon: '💻' };
	if (matchesDomain(domain, PRODUCTIVITY_DOMAINS)) return { icon: '📄' };
	if (matchesDomain(domain, SHOPPING_DOMAINS)) return { icon: '🛍️' };
	if (matchesDomain(domain, FINANCE_DOMAINS)) return { icon: '💳' };
	if (matchesDomain(domain, EDUCATION_DOMAINS)) return { icon: '🎓' };
	if (matchesDomain(domain, DESIGN_DOMAINS)) return { icon: '🎨' };

	// No match - return null to show default
	return null;
}
