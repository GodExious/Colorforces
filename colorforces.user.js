// ==UserScript==
// @name         Colorforces
// @name:zh-CN   Colorforces 算法竞赛视觉增强
// @namespace    https://github.com/GodExious/Colorforces
// @version      1.5.9
// @description  Reimagining the Codeforces UI. A next-generation userscript that breathes life into your competitive programming experience with dynamic rating colors, modern badges, and a premium, highly customizable interface.
// @description:zh-CN 重塑 Codeforces 视觉体验的新一代增强插件。通过动态的评分色彩、现代化的标签引擎和极高自由度的定制面板，为你的算法竞赛之旅注入全新的生命力。
// @author       GodExious & Antigravity
// @supportURL   https://github.com/GodExious/Colorforces/issues
// @match        *://codeforces.com/*
// @match        *://*.codeforces.com/*
// @icon         https://codeforces.com/favicon.ico
// @updateURL    https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js
// @downloadURL  https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/pickr.min.js
// @license      MIT
// @connect      clist.by
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

/*
 * GitHub Repository: https://github.com/GodExious/Colorforces
 * If you have any suggestions or find any bugs, please feel free to open an issue!
 * 如果你对本插件有改进建议，欢迎通过 GitHub Issue 提出建议或反馈！
 *
 * Inspired by Codeforces-Helper (https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj)
 * 灵感来源于 Codeforces-Helper，由于其不支持 status 页面，故仿写并实现了本项目。
 *
 * Mainly implemented by Antigravity 2.5.5
 * 主要由 Antigravity 2.5.5 完成实现
 */

(function () {
    'use strict';

    const CACHE_KEY = 'cf_problems_ratings';
    const CACHE_TIME_KEY = 'cf_problems_ratings_time';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    const PARALLEL_CONTESTS_KEY = 'cf_parallel_contests';
    const CLIST_STORAGE_KEY = 'cf_clist_problems';
    const CLIST_LAST_SYNC_KEY = 'cf_clist_last_sync_time';
    const CLIST_SYNC_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds
    const AVATAR_CACHE_KEY = 'cf_user_avatars_v2';
    const UPDATE_CHECK_KEY = 'cf_update_check_state';
    const UPDATE_CHECK_COOLDOWN = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const SCRIPT_UPDATE_URL = 'https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js';
    const CURRENT_VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.5.9';

    // Settings Management
    const SETTINGS_KEY = 'cf_submissions_settings';

    // =========================================================================
    // Tampermonkey (GM) Storage Engine
    // =========================================================================
    const appStorage = {
        getItem(key) {
            try {
                return GM_getValue(key, null);
            } catch (e) {
                console.error('Colorforces: GM_getValue failed', e);
                return null;
            }
        },
        setItem(key, value) {
            try {
                GM_setValue(key, value);
            } catch (e) {
                console.error('Colorforces: GM_setValue failed', e);
            }
        },
        removeItem(key) {
            try {
                GM_deleteValue(key);
            } catch (e) {
                console.error('Colorforces: GM_deleteValue failed', e);
            }
        },
        getJSON(key, defaultVal = null) {
            const raw = this.getItem(key);
            if (raw === null || raw === undefined) return defaultVal;
            if (typeof raw === 'object') return raw;
            try {
                return JSON.parse(raw);
            } catch (e) {
                return defaultVal;
            }
        },
        setJSON(key, obj) {
            const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
            this.setItem(key, str);
        }
    };
    const DEFAULT_SETTINGS = {
        disableAutoCheckUpdate: false,
        acBgColor: '#d4edc9',
        colorRatings: true,
        tagFillCell: true,
        show: {
            submissions: true,
            status: true,
            hacks: true,
            problemset: true,
            contestProblems: true,
            standings: true,
            problemTags: true,
            userAvatar: true,
            formatTeams: true,
            langIcon: true,
            shortVerdict: true
        },
        avatarSize: 1.6,
        langIconSize: 1.6,
        timeFormat: {
            enabled: true,
            format: 'YYYY/MM/DD HH:mm'
        },
        displayStyle: 'tag',
        hideTags: false,
        hideRatingTag: false,
        notHideAcTags: false,
        lang: 'en',
        clist: {
            enabled: false,
            authMode: 'cookie',
            isLoggedIn: true,
            apiKey: '',
            lastSyncTime: 0
        },
        shortcuts: {
            hideTags: 'Shift+H',
            langIcon: 'Shift+L',
            shortVerdict: 'Shift+S',
            timeFormat: 'Shift+T',
            clistEnabled: 'Shift+C',
            colorRatings: 'Shift+R',
            displayStyle: 'Shift+F',
            userAvatar: 'Shift+A'
        }
    };

    function hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return hex || DEFAULT_SETTINGS.acBgColor;
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function saveSettings(settings) {
        appStorage.setJSON(SETTINGS_KEY, settings);
    }

    function getSettings() {
        const parsed = appStorage.getJSON(SETTINGS_KEY, null);
        let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // deep clone
        if (parsed) {
            try {
                // Migrate from split hex+alpha to unified format
                if (parsed.acBgAlpha !== undefined && parsed.acBgColor && parsed.acBgColor.startsWith('#')) {
                    if (parsed.acBgAlpha < 1) {
                        parsed.acBgColor = hexToRgba(parsed.acBgColor, parsed.acBgAlpha);
                    }
                    delete parsed.acBgAlpha;
                }

                settings.acBgColor = parsed.acBgColor || settings.acBgColor;
                if (parsed.show) Object.assign(settings.show, parsed.show);
                settings.avatarSize = parsed.avatarSize !== undefined ? parsed.avatarSize : settings.avatarSize;
                settings.langIconSize = parsed.langIconSize !== undefined ? parseFloat(parsed.langIconSize) : settings.langIconSize;
                if (settings.langIconSize >= 5) {
                    settings.langIconSize = parseFloat((settings.langIconSize / 14).toFixed(1));
                }
                if (settings.langIconSize < 0.8) settings.langIconSize = 0.8;
                if (settings.langIconSize > 3.0) settings.langIconSize = 3.0;
                if (parsed.timeFormat) Object.assign(settings.timeFormat, parsed.timeFormat);
                settings.hideTags = parsed.hideTags !== undefined ? !!parsed.hideTags : settings.hideTags;
                settings.hideRatingTag = parsed.hideRatingTag !== undefined ? !!parsed.hideRatingTag : settings.hideRatingTag;
                settings.notHideAcTags = parsed.notHideAcTags !== undefined ? !!parsed.notHideAcTags : settings.notHideAcTags;
                settings.colorRatings = parsed.colorRatings !== undefined ? !!parsed.colorRatings : settings.colorRatings;
                settings.tagFillCell = parsed.tagFillCell !== undefined ? !!parsed.tagFillCell : settings.tagFillCell;
                settings.disableAutoCheckUpdate = parsed.disableAutoCheckUpdate !== undefined ? !!parsed.disableAutoCheckUpdate : settings.disableAutoCheckUpdate;
                settings.lang = parsed.lang || settings.lang;
                settings.displayStyle = parsed.displayStyle || settings.displayStyle;
                if (parsed.clist) {
                    if (!settings.clist) settings.clist = { ...DEFAULT_SETTINGS.clist };
                    Object.assign(settings.clist, parsed.clist);
                }
                if (parsed.shortcuts) {
                    if (!settings.shortcuts) settings.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
                    Object.assign(settings.shortcuts, parsed.shortcuts);
                    if (settings.shortcuts.timeFormat === undefined) {
                        settings.shortcuts.timeFormat = DEFAULT_SETTINGS.shortcuts.timeFormat;
                    }
                    if (settings.shortcuts.displayStyle === undefined) {
                        settings.shortcuts.displayStyle = DEFAULT_SETTINGS.shortcuts.displayStyle;
                    }
                    // Migrate legacy Alt+ defaults to new Shift+ defaults
                    const legacyAltDefaults = {
                        hideTags: 'Alt+H',
                        shortVerdict: 'Alt+S',
                        timeFormat: 'Alt+T',
                        langIcon: 'Alt+L',
                        clistEnabled: 'Alt+C',
                        colorRatings: 'Alt+R',
                        displayStyle: 'Alt+F',
                        userAvatar: 'Alt+A'
                    };
                    for (const [k, oldVal] of Object.entries(legacyAltDefaults)) {
                        if (settings.shortcuts[k] === oldVal) {
                            settings.shortcuts[k] = DEFAULT_SETTINGS.shortcuts[k];
                        }
                    }
                }

                saveSettings(settings);
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
        return settings;
    }

    function getLanguageIconName(langStr) {
        langStr = langStr.toLowerCase();
        if (langStr.includes('c++') || langStr.includes('g++')) return 'cplusplus';
        if (langStr.includes('c#')) return 'csharp';
        if (langStr.includes('python') || langStr.includes('pypy')) return 'python';
        if (langStr.includes('java') && !langStr.includes('javascript')) return 'java';
        if (langStr.includes('rust')) return 'rust';
        if (/\bgo\b/.test(langStr)) return 'go';
        if (langStr.includes('kotlin')) return 'kotlin';
        if (langStr.includes('ruby')) return 'ruby';
        if (langStr.includes('node.js') || langStr.includes('nodejs')) return 'nodejs';
        if (langStr.includes('javascript') || langStr.includes('v8')) return 'javascript';
        if (langStr.includes('php')) return 'php';
        if (langStr.includes('haskell')) return 'haskell';
        if (langStr.includes('scala')) return 'scala';
        if (langStr.includes('ocaml')) return 'ocaml';
        if (langStr.includes('perl')) return 'perl';
        if (langStr.includes('f#')) return 'fsharp';
        if (langStr.includes('delphi')) return 'delphi';
        if (/\bd\b/.test(langStr) || langStr.includes('dmd')) return 'd';
        if (langStr.includes('gcc') || langStr.includes('clang') || /\bc(?:89|99|11|17|18|23|2x)?\b/.test(langStr)) return 'c';
        if (/\bio\b/.test(langStr)) return 'io';
        return null;
    }

    const appSettings = getSettings();

    function customFormatTime(d, formatStr) {
        if (!formatStr || typeof formatStr !== 'string') return '';
        if (!(d instanceof Date) || isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = d.getMonth(); // 0-indexed
        const date = d.getDate();
        const day = d.getDay();
        const hours24 = d.getHours();
        const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        const ms = d.getMilliseconds();
        const isPM = hours24 >= 12;

        const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const pad = (n, len = 2) => String(n).padStart(len, '0');

        const tokens = {
            YYYY: String(year),
            YY: String(year).slice(-2),
            MMMM: MONTH_NAMES_FULL[month],
            MMM: MONTH_NAMES_SHORT[month],
            MM: pad(month + 1),
            M: String(month + 1),
            DD: pad(date),
            D: String(date),
            dddd: DAY_NAMES_FULL[day],
            ddd: DAY_NAMES_SHORT[day],
            d: String(day),
            HH: pad(hours24),
            H: String(hours24),
            hh: pad(hours12),
            h: String(hours12),
            mm: pad(minutes),
            m: String(minutes),
            ss: pad(seconds),
            s: String(seconds),
            SSS: pad(ms, 3),
            A: isPM ? 'PM' : 'AM',
            a: isPM ? 'pm' : 'am'
        };

        const regex = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|d|HH|H|hh|h|mm|m|ss|s|SSS|A|a/g;

        return formatStr.replace(regex, (match, escaped) => {
            if (escaped !== undefined) return escaped;
            return tokens[match] !== undefined ? tokens[match] : match;
        });
    }

    function safeAppendStyle(el) {
        if (document.head) document.head.appendChild(el);
        else document.documentElement.appendChild(el);
    }

    // Inject dynamic style for real-time updates
    const dynamicStyle = document.createElement('style');
    dynamicStyle.id = 'cf-dynamic-style';
    safeAppendStyle(dynamicStyle);

    function updateDynamicStyle() {
        dynamicStyle.innerHTML = `
            :root {
                --cf-avatar-size: ${parseFloat(appSettings.avatarSize) || 1.6}em;
                --cf-lang-icon-size: ${(parseFloat(appSettings.langIconSize) || 1.6) * 14}px;
            }
            html:root body table.problems tr.accepted-problem td.act,
            html:root body table.problems tr.accepted-problem td.id,
            html:root body table.problems tr.accepted-problem td,
            html:root body .problems .accepted-problem td.act,
            html:root body tr.accepted-problem td {
                background-color: ${appSettings.acBgColor} !important;
            }
            html:root body table.problems tr.accepted-problem td.id,
            html:root body .problems .accepted-problem td.id {
                border-left-color: ${appSettings.acBgColor} !important;
            }
            :root.cf-hide-submissions .cf-table-submissions .cf-rating-col,
            :root.cf-hide-status .cf-table-status .cf-rating-col,
            :root.cf-hide-hacks .cf-table-hacks .cf-rating-col,
            :root.cf-hide-problemset .cf-table-problemset .cf-rating-col,
            :root.cf-hide-contestProblems .cf-table-contestProblems .cf-rating-col,
            :root.cf-hide-standings .cf-rating-standings-row {
                display: none !important;
            }
            :root.cf-hide-timeFormat .cf-time-timezone-label {
                display: none !important;
            }
            :root.cf-hide-problemset .cf-table-problemset tr th:nth-last-child(2),
            :root.cf-hide-problemset .cf-table-problemset tr td:nth-last-child(2),
            :root.cf-hide-contestProblems .cf-table-contestProblems tr th:nth-last-child(2),
            :root.cf-hide-contestProblems .cf-table-contestProblems tr td:nth-last-child(2) {
                border-right: none !important;
            }
            :root.cf-hide-userAvatar .cf-avatar-container,
            :root.cf-hide-userAvatar .cf-user-avatar {
                display: none !important;
            }
            :root.cf-hide-langIcon .cf-lang-icon {
                display: none !important;
            }
        `;
        const isRatingsActive = appSettings.colorRatings !== false;
        const classMap = {
            'cf-hide-submissions': !isRatingsActive || !appSettings.show.submissions,
            'cf-hide-status': !isRatingsActive || !appSettings.show.status,
            'cf-hide-hacks': !isRatingsActive || !appSettings.show.hacks,
            'cf-hide-problemset': !isRatingsActive || !appSettings.show.problemset,
            'cf-hide-contestProblems': !isRatingsActive || !appSettings.show.contestProblems,
            'cf-hide-standings': !isRatingsActive || !appSettings.show.standings,
            'cf-hide-userAvatar': !appSettings.show.userAvatar,
            'cf-hide-langIcon': !appSettings.show.langIcon,
            'cf-hide-timeFormat': !appSettings.timeFormat.enabled
        };
        for (const [cls, add] of Object.entries(classMap)) {
            document.documentElement.classList.toggle(cls, add);
        }
        if (typeof syncSecondLevelMenuLava === 'function') {
            syncSecondLevelMenuLava();
        }
    }
    updateDynamicStyle();

    // Inject Global Custom CSS
    const customStyle = document.createElement('style');
    customStyle.innerHTML = `
        @import url('https://cdn.jsdelivr.net/npm/@fontsource/kaushan-script@5.0.18/index.css');
        @import url('https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.0.18/index.css');
        @import url('https://fonts.loli.net/css2?family=Kaushan+Script&family=Outfit:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Kaushan+Script&family=Outfit:wght@600;700;800&display=swap');

        .cf-version-tag {
            background-color: #e6f7ff;
            color: #1890ff;
            border: 1px solid #91d5ff;
            font-size: 12px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            margin-left: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            letter-spacing: 0.5px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .pcr-app {
            z-index: 9999999 !important;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .pcr-app.visible {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        /* Widen the Pickr nano theme and adjust interaction layout */
        .pcr-app[data-theme="nano"] {
            width: 240px !important;
        }
        .pcr-app[data-theme="nano"] .pcr-interaction {
            flex-wrap: wrap !important;
        }
        .pcr-app[data-theme="nano"] .pcr-interaction .pcr-result {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 100% !important;
            margin-top: 8px !important;
        }

        /* Custom Toggle Switch */
        .cf-toggle-switch {
            position: relative;
            display: inline-block;
            width: 34px;
            height: 18px;
            flex-shrink: 0;
            vertical-align: middle;
        }
        .cf-toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .cf-toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #ccc;
            transition: .2s;
            border-radius: 18px;
        }
        .cf-toggle-slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .2s;
            border-radius: 50%;
        }
        .cf-toggle-switch input:checked + .cf-toggle-slider {
            background-color: #1890ff;
        }
        .cf-toggle-switch input:checked + .cf-toggle-slider:before {
            transform: translateX(16px);
        }

        /* Colorforces Settings Modal Styles */
        .cf-settings-modal {
            position: absolute;
            top: 55px;
            right: 0;
            width: 680px;
            height: 56vh;
            max-height: 56vh;
            min-height: 440px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 12px 35px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.04);
            display: none;
            flex-direction: column;
            color: #1e293b;
            box-sizing: border-box;
            overflow: hidden;
            overscroll-behavior: contain;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            animation: cf-fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes cf-fadeIn {
            from { opacity: 0; transform: translateY(-6px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cf-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #edf2f7;
            background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }
        .cf-header-left {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 13px;
        }
        @keyframes cf-title-rainbow-roll {
            0% {
                background-position: 0% center;
            }
            100% {
                background-position: 200% center;
            }
        }
        .cf-header-title {
            font-family: 'Kaushan Script', 'Satisfy', 'Segoe Script', 'Brush Script MT', cursive, sans-serif;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.6px;
            background: linear-gradient(
                90deg,
                #ff8e9e 0%,
                #ffd166 16.6%,
                #69db7c 33.3%,
                #48cae4 50%,
                #91a7ff 66.6%,
                #f783ac 83.3%,
                #ff8e9e 100%,
                #ffd166 116.6%,
                #69db7c 133.3%,
                #48cae4 150%,
                #91a7ff 166.6%,
                #f783ac 183.3%,
                #ff8e9e 200%
            );
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            animation: cf-title-rainbow-roll 4s linear infinite;
            display: inline-flex;
            align-items: baseline;
            gap: 8px;
            line-height: 1.15;
            user-select: none;
            margin: 0;
            padding: 0;
        }
        .cf-title-version {
            font-family: inherit;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.5px;
            opacity: 0.95;
            padding-right: 6px;
            display: inline-block;
        }
        .cf-header-subtitle,
        .cf-header-badge {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 14.5px;
            font-weight: 700;
            border-radius: 999px;
            padding: 3px 12px 3px 9px;
            user-select: none;
            letter-spacing: 0.4px;
            line-height: 1.25;
            margin: 0;
            border: 1.5px solid transparent;
            background:
                linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)) padding-box,
                linear-gradient(
                    110deg,
                    #ff8e9e 0%,
                    #ffd166 16.6%,
                    #69db7c 33.3%,
                    #48cae4 50%,
                    #91a7ff 66.6%,
                    #f783ac 83.3%,
                    #ff8e9e 100%,
                    #ffd166 116.6%,
                    #69db7c 133.3%,
                    #48cae4 150%,
                    #91a7ff 166.6%,
                    #f783ac 183.3%,
                    #ff8e9e 200%
                ) border-box;
            background-size: 100% 100%, 200% auto;
            animation: cf-title-rainbow-roll 4s linear infinite;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
        }
        .cf-header-badge-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            background-image: linear-gradient(
                110deg,
                #ff8e9e 0%,
                #ffd166 16.6%,
                #69db7c 33.3%,
                #48cae4 50%,
                #91a7ff 66.6%,
                #f783ac 83.3%,
                #ff8e9e 100%,
                #ffd166 116.6%,
                #69db7c 133.3%,
                #48cae4 150%,
                #91a7ff 166.6%,
                #f783ac 183.3%,
                #ff8e9e 200%
            );
            background-size: 200% auto;
            animation: cf-title-rainbow-roll 4s linear infinite;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cpath d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/%3E%3C/svg%3E") no-repeat center / contain;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cpath d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/%3E%3C/svg%3E") no-repeat center / contain;
        }
        .cf-header-badge-icon svg {
            display: none;
        }
        .cf-header-badge-text {
            display: inline-block;
            white-space: nowrap;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
            background-image: linear-gradient(
                110deg,
                #ff8e9e 0%,
                #ffd166 16.6%,
                #69db7c 33.3%,
                #48cae4 50%,
                #91a7ff 66.6%,
                #f783ac 83.3%,
                #ff8e9e 100%,
                #ffd166 116.6%,
                #69db7c 133.3%,
                #48cae4 150%,
                #91a7ff 166.6%,
                #f783ac 183.3%,
                #ff8e9e 200%
            );
            background-size: 200% auto;
            animation: cf-title-rainbow-roll 4s linear infinite;
        }
        .cf-close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 8px;
            color: #94a3b8;
            cursor: pointer;
            transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
            padding: 0;
            line-height: 1;
            box-shadow: none;
            flex-shrink: 0;
        }
        .cf-close-btn:hover {
            background: #f1f5f9;
            color: #334155;
            transform: scale(1.06);
        }
        .cf-modal-body {
            display: flex;
            flex: 1;
            min-height: 0;
            overflow: hidden;
            background: #ffffff;
            overscroll-behavior: contain;
        }
        .cf-sidebar-nav {
            width: 200px;
            min-width: 200px;
            max-width: 200px;
            flex-shrink: 0;
            background: #f8fafc;
            border-right: 1px solid #edf2f7;
            padding: 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-sizing: border-box;
            overflow-y: auto;
            overflow-y: overlay;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
            overscroll-behavior: contain;
            position: relative;
        }
        .cf-sidebar-nav::-webkit-scrollbar {
            width: 4px;
        }
        .cf-sidebar-nav::-webkit-scrollbar-track {
            background: transparent;
        }
        .cf-sidebar-nav::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .cf-sidebar-nav::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        .cf-nav-indicator {
            position: absolute;
            left: 8px;
            width: calc(100% - 16px);
            height: 36px;
            background: #e6f4ff;
            border-radius: 8px;
            pointer-events: none;
            z-index: 1;
            box-sizing: border-box;
            transition: top 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
            opacity: 0;
        }
        .cf-nav-indicator::before {
            content: '';
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            width: 3.5px;
            height: 18px;
            background: #1677ff;
            border-radius: 3px;
        }
        .cf-nav-tab {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #475569;
            cursor: pointer;
            position: relative;
            z-index: 2;
            transition: color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                        background-color 0.18s ease,
                        transform 0.12s ease;
            user-select: none;
            border: none;
            background: transparent;
            width: 100%;
            text-align: left;
            box-sizing: border-box;
            white-space: nowrap;
            overflow: hidden;
        }
        .cf-nav-tab:not(.active):hover {
            background: rgba(0, 0, 0, 0.035);
            color: #0f172a;
        }
        .cf-nav-tab:active {
            transform: scale(0.98);
        }
        .cf-nav-tab.active {
            color: #1677ff;
            font-weight: 600;
        }
        .cf-tab-icon {
            font-size: 14px;
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: inherit;
            transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cf-nav-tab.active .cf-tab-icon {
            transform: scale(1.08);
        }
        .cf-tab-icon svg {
            width: 16px;
            height: 16px;
            display: block;
            flex-shrink: 0;
        }
        .cf-section-title-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #1677ff;
            width: 18px;
            height: 18px;
            flex-shrink: 0;
        }
        .cf-section-title-icon svg {
            width: 18px;
            height: 18px;
            display: block;
        }
        .cf-tab-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
        }
        .cf-content-area {
            flex: 1;
            min-width: 0;
            padding: 14px 18px;
            overflow-x: hidden !important;
            overflow-y: auto;
            overflow-y: overlay;
            scrollbar-gutter: stable;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
            overscroll-behavior: contain;
            box-sizing: border-box;
            position: relative;
        }
        .cf-content-area::-webkit-scrollbar {
            width: 5px;
        }
        .cf-content-area::-webkit-scrollbar-track {
            background: transparent;
        }
        .cf-content-area::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .cf-content-area::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        .cf-tab-panel {
            display: none;
            flex-direction: column;
            gap: 12px;
            will-change: transform, opacity;
            transform-origin: center top;
        }
        .cf-tab-panel.active {
            display: flex;
        }
        /* Shortcuts Tab */
        .cf-shortcuts-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .cf-shortcuts-header {
            margin-bottom: 2px;
        }
        .cf-shortcuts-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-shortcuts-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        .cf-shortcuts-subtitle + .cf-shortcuts-subtitle {
            margin-top: 8px;
        }
        .cf-shortcuts-note {
            margin-top: 10px;
            padding: 8px 12px;
            background: #f0f7ff;
            border: 1px solid #d0e2ff;
            border-left: 3.5px solid #1677ff;
            border-radius: 6px;
            display: flex;
            align-items: flex-start;
            gap: 7px;
            box-sizing: border-box;
            font-size: 12px;
            line-height: 1.5;
        }
        .cf-shortcuts-note-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 15px;
            height: 15px;
            color: #1677ff;
            flex-shrink: 0;
            margin-top: 1.5px;
        }
        .cf-shortcuts-note-icon svg {
            width: 15px;
            height: 15px;
            display: block;
        }
        .cf-shortcuts-note-body {
            flex: 1 1 auto;
            color: #1e40af;
        }
        .cf-shortcuts-note-label {
            font-weight: 700;
            color: #1d4ed8;
            margin-right: 2px;
        }
        .cf-shortcuts-note-text {
            color: #1e40af;
            font-weight: 500;
        }
        .cf-shortcuts-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cf-shortcut-group {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .cf-shortcut-group-header {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            padding-left: 6px;
            user-select: none;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .cf-shortcut-group-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            color: #1677ff;
            flex-shrink: 0;
        }
        .cf-shortcut-group-icon svg {
            width: 14px;
            height: 14px;
            display: block;
        }
        .cf-shortcut-group-box {
            background: #f8fafc;
            border-radius: 10px;
            padding: 3px 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            border: 1px solid #f1f5f9;
        }
        .cf-shortcut-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 34px;
            padding: 3px 8px;
            border-radius: 6px;
            background: transparent;
            gap: 10px;
            box-sizing: border-box;
            overflow: hidden;
            transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cf-shortcut-item:hover {
            background: #ffffff;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .cf-shortcut-title {
            font-size: 13px;
            font-weight: 600;
            color: #1e293b;
            user-select: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1 1 auto;
            min-width: 0;
            margin-right: 4px;
            cursor: default;
        }
        .cf-shortcut-controls {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            flex-shrink: 0;
            margin-left: auto;
        }
        .cf-shortcut-key-btn {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: nowrap;
            white-space: nowrap;
            gap: 3px;
            padding: 2px 4px;
            min-height: 26px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            color: #0f172a;
            transition: all 0.15s ease;
            user-select: none;
            box-sizing: border-box;
            outline: none;
            flex-shrink: 0;
        }
        .cf-shortcut-key-btn:hover {
            background: rgba(241, 245, 249, 0.7);
        }
        .cf-shortcut-key-btn.recording {
            justify-content: center;
            background: #eff6ff;
            border: 1px solid #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
            color: #1d4ed8;
            font-weight: 600;
            padding: 2px 10px;
            min-height: 26px;
            animation: cf-pulse-recording 1.2s infinite;
        }
        @keyframes cf-pulse-recording {
            0% { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
            50% { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.35); }
            100% { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        }
        .cf-shortcut-key-btn kbd {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 22px;
            padding: 0 5px;
            font-size: 11px;
            font-weight: 600;
            line-height: 1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #334155;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #cbd5e1;
            border-bottom: 2px solid #94a3b8;
            border-radius: 4px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            box-sizing: border-box;
            transition: all 0.15s ease;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .cf-shortcut-key-btn:hover kbd {
            border-color: #93c5fd;
            border-bottom-color: #3b82f6;
            color: #1d4ed8;
            background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
            box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
            transform: translateY(-1px);
        }
        .cf-shortcut-key-btn:active kbd {
            transform: translateY(1px);
            border-bottom-width: 1px;
            box-shadow: none;
        }
        .cf-shortcut-plus {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: #94a3b8;
            margin: 0 0.5px;
            user-select: none;
            flex-shrink: 0;
        }
        .cf-shortcut-key-btn .cf-shortcut-empty {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 22px;
            padding: 0 6px;
            border-radius: 4px;
            border: 1px dashed #cbd5e1;
            background: #f8fafc;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1;
            box-sizing: border-box;
            font-style: normal;
            font-weight: 500;
            transition: all 0.15s ease;
        }
        .cf-shortcut-key-btn:hover .cf-shortcut-empty {
            border-color: #94a3b8;
            color: #475569;
            background: #f1f5f9;
        }
        .cf-shortcut-clear-btn,
        .cf-shortcut-reset-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border: 1px solid transparent;
            background: transparent;
            color: #94a3b8;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.15s ease;
            flex-shrink: 0;
            box-sizing: border-box;
            padding: 0;
        }
        .cf-shortcut-clear-btn:hover {
            background: #fef2f2;
            color: #ef4444;
            border-color: #fee2e2;
        }
        .cf-shortcut-reset-btn:hover {
            background: #f1f5f9;
            color: #0284c7;
            border-color: #e2e8f0;
        }
        .cf-shortcut-reset-all-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            padding: 6px 12px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
            border-radius: 6px;
            cursor: pointer;
            align-self: flex-start;
            transition: all 0.15s ease;
        }
        .cf-shortcut-reset-all-btn:hover {
            background: #ffffff;
            color: #0f172a;
            border-color: #cbd5e1;
        }
        /* Storage & Cache Management Tab */
        .cf-storage-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .cf-storage-header {
            margin-bottom: 2px;
        }
        .cf-storage-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-storage-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        .cf-storage-overview {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
            box-sizing: border-box;
        }
        .cf-storage-overview-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .cf-storage-overview-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }
        .cf-storage-overview-label {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .cf-storage-overview-val {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            letter-spacing: -0.2px;
        }
        .cf-storage-clear-all-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 11px;
            font-size: 11.5px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid #fecdd3;
            background: #ffffff;
            color: #e11d48;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.15s ease;
        }
        .cf-storage-clear-all-btn:hover {
            background: #ffe4e6;
            border-color: #fda4af;
            color: #be123c;
        }
        .cf-storage-bar-track {
            height: 10px;
            background: #e2e8f0;
            border-radius: 5px;
            overflow: hidden;
            display: flex;
            width: 100%;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
        }
        .cf-storage-bar-seg {
            height: 100%;
            transition: width 0.3s ease;
        }
        .cf-storage-bar-seg.seg-clist { background: #0284c7; }
        .cf-storage-bar-seg.seg-cf { background: #10b981; }
        .cf-storage-bar-seg.seg-avatar { background: #8b5cf6; }
        .cf-storage-bar-seg.seg-solved { background: #06b6d4; }
        .cf-storage-bar-seg.seg-settings { background: #f59e0b; }
        .cf-storage-bar-seg.seg-legacy { background: #94a3b8; }
        .cf-storage-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 11px;
            color: #475569;
        }
        .cf-storage-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .cf-storage-legend-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
        }
        .cf-storage-legend-dot.seg-clist { background: #0284c7; }
        .cf-storage-legend-dot.seg-cf { background: #10b981; }
        .cf-storage-legend-dot.seg-avatar { background: #8b5cf6; }
        .cf-storage-legend-dot.seg-solved { background: #06b6d4; }
        .cf-storage-legend-dot.seg-settings { background: #f59e0b; }
        .cf-storage-legend-dot.seg-legacy { background: #94a3b8; }
        .cf-storage-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cf-storage-item {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 7px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
            box-sizing: border-box;
        }
        .cf-storage-item:hover {
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
        }
        .cf-storage-item-main {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }
        .cf-storage-icon-box {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }
        .cf-storage-icon-box svg,
        .cf-storage-icon-box img {
            width: 17px;
            height: 17px;
            display: block;
            flex-shrink: 0;
            object-fit: contain;
        }
        .cf-storage-icon-box.icon-settings { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
        .cf-storage-icon-box.icon-cf { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
        .cf-storage-icon-box.icon-clist { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
        .cf-storage-icon-box.icon-avatar { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }
        .cf-storage-icon-box.icon-solved { background: #ecfeff; color: #0891b2; border: 1px solid #a5f3fc; }
        .cf-storage-icon-box.icon-legacy { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
        .cf-storage-item-body {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
            flex: 1;
        }
        .cf-storage-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 0;
            gap: 8px;
        }
        .cf-storage-item-title {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cf-storage-item-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .cf-storage-size-val {
            font-size: 12px;
            font-weight: 600;
            color: #334155;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            white-space: nowrap;
        }
        .cf-storage-meta-dot {
            color: #cbd5e1;
            font-size: 11px;
            line-height: 1;
            user-select: none;
        }
        .cf-storage-count-tag {
            font-size: 10.5px;
            font-weight: 500;
            padding: 1px 6px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .cf-storage-item-desc {
            font-size: 11px;
            color: #64748b;
            line-height: 1.45;
            margin: 0;
            white-space: normal;
            word-break: break-word;
        }
        .cf-storage-btn-group {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }
        .cf-storage-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all 0.15s ease;
        }
        .cf-storage-btn.btn-view {
            color: #0284c7;
            background: #f0f9ff;
            border: 1px solid #bae6fd;
        }
        .cf-storage-btn.btn-view:hover {
            background: #e0f2fe;
            color: #0369a1;
            border-color: #7dd3fc;
        }
        .cf-storage-btn.btn-reset {
            color: #d97706;
            background: #fffbeb;
            border: 1px solid #fde68a;
        }
        .cf-storage-btn.btn-reset:hover {
            background: #fef3c7;
            color: #b45309;
            border-color: #fcd34d;
        }
        .cf-storage-btn.btn-clear {
            color: #e11d48;
            background: #fff1f2;
            border: 1px solid #fecdd3;
        }
        .cf-storage-btn.btn-clear:hover {
            background: #ffe4e6;
            color: #be123c;
            border-color: #fda4af;
        }
        /* Storage JSON Viewer Scrollbars */
        .cf-storage-json-pre {
            scrollbar-width: thin;
            scrollbar-color: #334155 #0f172a;
            overscroll-behavior: contain;
        }
        .cf-storage-json-pre::-webkit-scrollbar {
            width: 7px;
            height: 7px;
        }
        .cf-storage-json-pre::-webkit-scrollbar-track {
            background: #0f172a;
            border-radius: 6px;
        }
        .cf-storage-json-pre::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 4px;
            border: 1px solid #1e293b;
            transition: background 0.15s ease;
        }
        .cf-storage-json-pre::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }
        .cf-storage-json-pre::-webkit-scrollbar-corner {
            background: #0f172a;
        }
        /* JSON Syntax Highlighting */
        .cf-json-key {
            color: #38bdf8;
            font-weight: 500;
        }
        .cf-json-string {
            color: #4ade80;
        }
        .cf-json-number {
            color: #fb923c;
            font-weight: 500;
        }
        .cf-json-boolean {
            color: #c084fc;
            font-weight: 600;
        }
        .cf-json-null {
            color: #94a3b8;
            font-style: italic;
        }
        .cf-json-punct {
            color: #94a3b8;
        }
        .cf-storage-copy-json-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 4px 11px;
            border-radius: 6px;
            font-size: 11.5px;
            font-weight: 600;
            cursor: pointer;
            background: #f0f9ff;
            color: #0284c7;
            border: 1px solid #bae6fd;
            transition: all 0.15s ease;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
            align-self: flex-start;
            user-select: none;
            box-sizing: border-box;
        }
        .cf-storage-copy-json-btn:hover {
            background: #e0f2fe;
            color: #0369a1;
            border-color: #7dd3fc;
        }
        .cf-storage-copy-json-btn .copy-btn-text {
            white-space: nowrap !important;
            display: inline-block;
        }
        /* Storage Confirm Pop Modal */
        .cf-confirm-pop-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.48);
            backdrop-filter: blur(4px);
            z-index: 10000005;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            overscroll-behavior: contain;
        }
        .cf-confirm-pop-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            width: 420px;
            max-width: 92vw;
            overflow: hidden;
            box-sizing: border-box;
            overscroll-behavior: contain;
            animation: cf-fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cf-confirm-btn-cancel:hover {
            background: #f1f5f9 !important;
            border-color: #94a3b8 !important;
            color: #0f172a !important;
        }
        .cf-confirm-btn-primary:hover {
            filter: brightness(0.92);
        }
        /* Changelog Tab & Accordion */
        .cf-changelog-header {
            margin-bottom: 8px;
        }
        .cf-changelog-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-changelog-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        .cf-changelog-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .cf-changelog-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cf-changelog-card:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .cf-changelog-card.expanded {
            border-color: #cbd5e1;
        }
        .cf-changelog-card-header {
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
            background: #fcfdfe;
            transition: background 0.15s ease;
        }
        .cf-changelog-card-header:hover {
            background: #f8fafc;
        }
        .cf-changelog-card-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .cf-changelog-card-right {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-left: auto;
        }
        .cf-changelog-version {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            letter-spacing: -0.01em;
            line-height: 1.3;
        }
        .cf-changelog-badge-latest {
            font-size: 11px;
            font-weight: 600;
            color: #0284c7;
            background: #e0f2fe;
            border: 1px solid #bae6fd;
            border-radius: 4px;
            padding: 1px 6px;
            line-height: 1.3;
        }
        .cf-changelog-date {
            font-size: 11.5px;
            color: #94a3b8;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            white-space: nowrap;
            font-feature-settings: 'tnum';
        }
        .cf-changelog-chevron {
            color: #94a3b8;
            transition: transform 0.2s ease;
            display: flex;
            align-items: center;
        }
        .cf-changelog-card.expanded .cf-changelog-chevron {
            transform: rotate(180deg);
        }
        .cf-changelog-card-body {
            display: none;
            padding: 12px 16px 14px 16px;
            border-top: 1px solid #f1f5f9;
            background: #ffffff;
            font-size: 12.5px;
            color: #334155;
            line-height: 1.6;
        }
        .cf-changelog-card.expanded .cf-changelog-card-body {
            display: block;
        }
        .cf-changelog-section {
            margin-bottom: 14px;
        }
        .cf-changelog-section:last-child {
            margin-bottom: 0;
        }
        .cf-changelog-section-badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            margin-bottom: 8px;
            line-height: 1.4;
            letter-spacing: 0.2px;
        }
        .cf-changelog-section-badge.added {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
        }
        .cf-changelog-section-badge.optimized {
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
        }
        .cf-changelog-section-badge.fixed {
            background: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
        }
        .cf-changelog-section-badge.announcement {
            background: #f3e8ff;
            color: #7e22ce;
            border: 1px solid #e9d5ff;
        }
        .cf-changelog-items {
            margin: 0 !important;
            padding: 0 0 0 6px !important;
            list-style: none !important;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cf-changelog-item {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            font-size: 12.5px;
            color: #334155;
            line-height: 1.6;
        }
        .cf-changelog-item-index {
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            min-width: 18px;
            text-align: right;
            flex-shrink: 0;
            user-select: none;
            line-height: 1.6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-feature-settings: 'tnum';
        }
        .cf-changelog-item-content {
            flex: 1;
            word-break: break-word;
            line-height: 1.6;
        }
        .cf-changelog-link {
            color: #0284c7 !important;
            text-decoration: none !important;
            font-weight: 500;
        }
        .cf-changelog-link:hover {
            text-decoration: underline !important;
        }
        .cf-changelog-code {
            background: #f1f5f9;
            padding: 1px 5px;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            color: #0f172a;
            border: 1px solid #e2e8f0;
        }
        /* Roadmap Tab & Cards */
        .cf-roadmap-header {
            margin-bottom: 12px;
        }
        .cf-roadmap-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-roadmap-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        .cf-roadmap-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .cf-roadmap-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cf-roadmap-group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 4px;
            border-bottom: 1px solid #f1f5f9;
        }
        .cf-roadmap-group-title {
            font-size: 12px;
            font-weight: 700;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-roadmap-group-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 10px;
            line-height: 1.3;
        }
        .cf-roadmap-group-badge.planned {
            background: #eff6ff;
            color: #0284c7;
            border: 1px solid #bae6fd;
        }
        .cf-roadmap-group-badge.completed {
            background: #ecfdf5;
            color: #059669;
            border: 1px solid #a7f3d0;
        }
        .cf-roadmap-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cf-roadmap-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cf-roadmap-card:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
        }
        .cf-roadmap-card.completed {
            background: #fafcfb;
            border-color: #e5ede8;
        }
        .cf-roadmap-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        .cf-roadmap-card-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .cf-roadmap-status-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .cf-roadmap-status-icon.completed {
            background: #10b981;
            color: #ffffff;
        }
        .cf-roadmap-status-icon.planned {
            background: transparent;
            color: #0284c7;
            border: none;
        }
        .cf-roadmap-item-title-text {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            line-height: 1.4;
        }
        .cf-roadmap-card.completed .cf-roadmap-item-title-text {
            color: #1e293b;
        }
        .cf-roadmap-item-desc {
            font-size: 11.5px;
            color: #64748b;
            margin: 0;
            line-height: 1.55;
        }
        .cf-roadmap-tag {
            font-size: 10.5px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .cf-roadmap-tag.planned {
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
        }
        .cf-roadmap-tag.completed {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
        }
        /* Roadmap Proposal Box (Warm Golden / Amber Theme) */
        .cf-roadmap-proposal-card {
            background: linear-gradient(135deg, rgba(254, 252, 232, 0.85) 0%, rgba(254, 243, 199, 0.65) 100%);
            border: 1px dashed rgba(245, 158, 11, 0.45);
            border-radius: 9px;
            padding: 11px 14px;
            display: flex;
            flex-direction: column;
            gap: 7px;
            margin-top: 4px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .cf-roadmap-proposal-card:hover {
            border-color: #f59e0b;
            box-shadow: 0 3px 12px rgba(245, 158, 11, 0.12);
        }
        .cf-roadmap-proposal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .cf-roadmap-proposal-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .cf-roadmap-proposal-icon {
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: #fef3c7;
            color: #d97706;
        }
        .cf-roadmap-proposal-title-text {
            font-size: 13px;
            font-weight: 700;
            color: #78350f;
            line-height: 1.4;
        }
        .cf-roadmap-proposal-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            font-size: 11.5px;
            font-weight: 600;
            color: #b45309;
            background: #ffffff;
            border: 1px solid #fde68a;
            border-radius: 6px;
            text-decoration: none;
            flex-shrink: 0;
            line-height: 1.35;
            transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
            box-shadow: 0 1px 2px rgba(217, 119, 6, 0.08);
        }
        .cf-roadmap-proposal-btn:hover {
            background: #d97706;
            color: #ffffff;
            border-color: #d97706;
            box-shadow: 0 2px 8px rgba(217, 119, 6, 0.28);
            transform: translateY(-1px);
        }
        .cf-roadmap-proposal-btn svg {
            transition: transform 0.15s ease;
        }
        .cf-roadmap-proposal-btn:hover svg {
            transform: translate(1px, -1px);
        }
        .cf-roadmap-proposal-desc {
            font-size: 11.5px;
            color: #713f12;
            margin: 0;
            line-height: 1.55;
            padding-left: 30px;
            opacity: 0.9;
        }
        /* Acknowledgments Tab & Cards */
        .cf-ack-header {
            margin-bottom: 2px;
        }
        .cf-ack-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .cf-ack-subtitle {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        .cf-ack-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 13px 15px;
            display: flex;
            flex-direction: column;
            gap: 9px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
            box-sizing: border-box;
        }
        .cf-ack-card:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }
        .cf-ack-card.helper-card:hover {
            border-color: #60a5fa;
            box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.4), 0 4px 16px rgba(59, 130, 246, 0.16);
        }
        .cf-ack-card.clist-card:hover {
            border-color: #38bdf8;
            box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.4), 0 4px 16px rgba(14, 165, 233, 0.18);
        }
        .cf-ack-card.ojbetter-card:hover {
            border-color: #a78bfa;
            box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.4), 0 4px 16px rgba(124, 58, 237, 0.16);
        }
        .cf-ack-card.carrot-card:hover {
            border-color: #fb923c;
            box-shadow: 0 0 0 1px rgba(251, 146, 60, 0.4), 0 4px 16px rgba(249, 115, 22, 0.16);
        }
        .cf-ack-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .cf-ack-project-info {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
        }
        .cf-ack-icon-box {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
        }
        .cf-ack-icon-img {
            width: 22px;
            height: 22px;
            object-fit: contain;
            border-radius: 3px;
            display: block;
        }
        .cf-ack-card.carrot-card .cf-ack-icon-img {
            image-rendering: pixelated;
        }
        .cf-ack-card.helper-card .cf-ack-icon-box {
            background: #eff6ff;
            border: 1px solid #dbeafe;
        }
        .cf-ack-card.clist-card .cf-ack-icon-box {
            background: #f0f9ff;
            border: 1px solid #e0f2fe;
        }
        .cf-ack-card.ojbetter-card .cf-ack-icon-box {
            background: #f1f5f9;
            color: #1e293b;
            border: 1px solid #e2e8f0;
        }
        .cf-ack-card.carrot-card .cf-ack-icon-box {
            background: #fff7ed;
            border: 1px solid #ffedd5;
        }
        .cf-ack-project-name {
            font-size: 13.5px;
            font-weight: 700;
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cf-ack-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 9999px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .cf-ack-badge.blue {
            background: #e0f2fe;
            color: #0284c7;
            border: 1px solid #bae6fd;
        }
        .cf-ack-badge.sky {
            background: #e0f2fe;
            color: #0284c7;
            border: 1px solid #bae6fd;
        }
        .cf-ack-badge.purple {
            background: #f3e8ff;
            color: #7e22ce;
            border: 1px solid #e9d5ff;
        }
        .cf-ack-badge.amber {
            background: #fef3c7;
            color: #d97706;
            border: 1px solid #fde68a;
        }
        .cf-ack-badge.teal {
            background: #ccfbf1;
            color: #0f766e;
            border: 1px solid #99f6e4;
        }
        .cf-ack-desc {
            font-size: 12.5px;
            color: #475569;
            line-height: 1.6;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .cf-ack-desc p {
            margin: 0;
            line-height: 1.6;
        }
        .cf-ack-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-top: 2px;
        }
        .cf-ack-link-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none !important;
            transition: all 0.15s ease;
            cursor: pointer;
            border: 1px solid transparent;
        }
        .cf-ack-link-btn.helper-btn {
            background: #f1f5f9;
            color: #2563eb;
            border-color: #e2e8f0;
        }
        .cf-ack-link-btn.helper-btn:hover {
            background: #2563eb;
            color: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
        }
        .cf-ack-link-btn.clist-btn {
            background: #f1f5f9;
            color: #0284c7;
            border-color: #e2e8f0;
        }
        .cf-ack-link-btn.clist-btn:hover {
            background: #0284c7;
            color: #ffffff;
            border-color: #0284c7;
            box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);
        }
        .cf-ack-link-btn.ojbetter-btn {
            background: #f1f5f9;
            color: #7c3aed;
            border-color: #e2e8f0;
        }
        .cf-ack-link-btn.ojbetter-btn:hover {
            background: #7c3aed;
            color: #ffffff;
            border-color: #7c3aed;
            box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
        }
        .cf-ack-link-btn.carrot-btn {
            background: #f1f5f9;
            color: #ea580c;
            border-color: #e2e8f0;
        }
        .cf-ack-link-btn.carrot-btn:hover {
            background: #ea580c;
            color: #ffffff;
            border-color: #ea580c;
            box-shadow: 0 2px 8px rgba(234, 88, 12, 0.25);
        }
        .cf-setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-height: 32px;
        }
        .cf-setting-label {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            user-select: none;
        }
        .cf-setting-sublabel {
            font-size: 12px;
            color: #64748b;
            user-select: none;
        }
        .roundbox.cf-tags-hidden-notice,
        span.tag-box.cf-tags-hidden-notice {
            background: linear-gradient(135deg, rgba(255, 222, 238, 0.75) 0%, rgba(255, 245, 215, 0.75) 25%, rgba(220, 255, 230, 0.75) 50%, rgba(210, 245, 255, 0.75) 75%, rgba(235, 220, 255, 0.75) 100%) padding-box,
                        linear-gradient(135deg, #ff78cb 0%, #ffa502 25%, #2ed573 50%, #70a1ff 75%, #a55eea 100%) border-box !important;
            border: 1px solid transparent !important;
            user-select: none;
            cursor: default;
        }
        .roundbox.cf-tags-hidden-notice .tag-box,
        span.tag-box.cf-tags-hidden-notice {
            background: linear-gradient(90deg, #c0392b 0%, #d35400 24%, #1b8a5a 52%, #1b62b3 78%, #5f27cd 100%) !important;
            -webkit-background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            background-clip: text !important;
            color: transparent !important;
            font-weight: 600;
            user-select: none;
            cursor: default;
        }
        #cf-ratings-settings-btn {
            width: 44px !important;
            height: 44px !important;
            background: conic-gradient(
                from -45deg,
                #ffb3ba 0deg,
                #ffd1b3 51.4deg,
                #ffe8a1 102.8deg,
                #baffc9 154.3deg,
                #a3e8e4 205.7deg,
                #b5d2ff 257.1deg,
                #d8bbff 308.6deg,
                #ffb3ba 360deg
            ) padding-box,
            conic-gradient(
                from -45deg,
                #ff78cb 0deg,
                #ffa502 51.4deg,
                #ffdd59 102.8deg,
                #2ed573 154.3deg,
                #00d2d3 205.7deg,
                #54a0ff 257.1deg,
                #9b59b6 308.6deg,
                #ff78cb 360deg
            ) border-box !important;
            border: 2px solid transparent !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(216, 187, 255, 0.45), 0 2px 8px rgba(163, 232, 228, 0.4) !important;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            user-select: none !important;
            box-sizing: border-box !important;
        }
        #cf-ratings-settings-btn:hover {
            transform: scale(1.12) rotate(45deg) !important;
            box-shadow: 0 6px 22px rgba(255, 179, 186, 0.6), 0 0 20px rgba(181, 210, 255, 0.55) !important;
        }
        #cf-ratings-settings-btn:active {
            transform: scale(0.95) rotate(45deg) !important;
        }
        #cf-ratings-settings-btn svg {
            width: 26px !important;
            height: 26px !important;
            display: block !important;
            fill: #ffffff !important;
            filter: drop-shadow(0 1px 3px rgba(80, 70, 110, 0.35)) !important;
        }
        .cf-modal-footer {
            border-top: 1px solid #edf2f7;
            padding: 10px 18px 8px 18px;
            background: #fafbfc;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cf-footer-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        .cf-footer-status {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #64748b;
            font-size: 12px;
            user-select: none;
        }
        .cf-status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #10b981;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
            display: inline-block;
        }
        /* Modal Link Isolation - Prevent external a:link { color: #0000cc; } penetration */
        .cf-settings-modal a,
        .cf-settings-modal a:link,
        .cf-settings-modal a:visited {
            text-decoration: none !important;
        }
        .cf-footer-links {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cf-footer-link,
        .cf-footer-link:link,
        .cf-footer-link:visited {
            color: #64748b !important;
            text-decoration: none !important;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            transition: color 0.15s ease;
            cursor: pointer;
            user-select: none;
        }
        .cf-footer-link:hover,
        .cf-footer-link:active {
            color: #1677ff !important;
            text-decoration: none !important;
        }
        .cf-footer-divider {
            color: #cbd5e1;
            font-size: 12px;
            user-select: none;
        }
        .cf-footer-bottom-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #edf2f7;
            padding-top: 5px;
            font-size: 11px;
            color: #94a3b8;
            user-select: none;
        }
        .cf-footer-motto {
            color: #94a3b8;
        }
        .cf-footer-author {
            color: #94a3b8;
            display: inline-flex;
            align-items: center;
        }
        .cf-footer-author a,
        .cf-footer-author a:link,
        .cf-footer-author a:visited {
            color: #64748b !important;
            text-decoration: none !important;
            font-weight: 600;
            transition: color 0.15s ease;
            display: inline-flex;
            align-items: center;
            vertical-align: middle;
            margin: 0 2px;
        }
        .cf-footer-author a:hover,
        .cf-footer-author a:active {
            color: #1677ff !important;
            text-decoration: none !important;
        }
        .cf-author-avatar {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            object-fit: cover;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
            margin: 0 4px;
            flex-shrink: 0;
            display: inline-block;
        }
        .cf-author-logo {
            width: 14px;
            height: 14px;
            border-radius: 3px;
            object-fit: contain;
            margin: 0 4px;
            flex-shrink: 0;
            display: inline-block;
        }

        /* Clist Ratings Extension Styles */
        .cf-clist-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .cf-clist-section-title {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cf-clist-subgroup {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-left: 12px;
            transition: all 0.25s ease;
        }
        .cf-clist-icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            cursor: pointer;
            user-select: none;
            position: relative;
            flex-shrink: 0;
            margin-left: 6px;
            font-size: 10px;
            font-weight: 700;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1;
            box-sizing: border-box;
            transition: all 0.2s ease;
            vertical-align: middle;
        }
        .cf-clist-icon-help {
            background: #e0f2fe;
            color: #0284c7;
            border: 1px solid #bae6fd;
        }
        .cf-clist-icon-help:hover {
            background: #0284c7;
            color: #ffffff;
            box-shadow: 0 0 6px rgba(2, 132, 199, 0.4);
        }
        .cf-clist-icon-warn {
            background: #fef3c7;
            color: #d97706;
            border: 1px solid #fde68a;
        }
        .cf-clist-icon-warn:hover {
            background: #d97706;
            color: #ffffff;
            box-shadow: 0 0 6px rgba(217, 119, 6, 0.4);
        }
        /* IViewUI Style Floating Tooltip */
        .cf-floating-tooltip {
            position: fixed;
            z-index: 10000030;
            max-width: 280px;
            padding: 7px 11px;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            color: #ffffff;
            font-size: 11.5px;
            font-weight: normal;
            line-height: 1.5;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
            pointer-events: none;
            white-space: normal;
            word-break: break-word;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s ease, transform 0.15s ease;
            transform: translateY(4px);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: none;
        }
        .cf-floating-tooltip.visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        .cf-floating-tooltip::after {
            content: '';
            position: absolute;
            border: 4px solid transparent;
            left: var(--arrow-left, 50%);
            transform: translateX(-50%);
        }
        .cf-floating-tooltip.cf-tip-top::after {
            top: 100%;
            border-top-color: rgba(15, 23, 42, 0.92);
        }
        .cf-floating-tooltip.cf-tip-bottom::after {
            bottom: 100%;
            border-bottom-color: rgba(15, 23, 42, 0.92);
        }
        .cf-clist-input-box {
            width: 100%;
            box-sizing: border-box;
            padding: 6px 10px;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            outline: none;
            background: #f8fafc;
            color: #334155;
            transition: all 0.2s ease;
        }
        .cf-clist-input-box:focus {
            background: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }
        .cf-clist-sync-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #334155;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
        }
        .cf-clist-sync-btn:hover {
            background: #3b82f6;
            color: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }
        button:disabled,
        .cf-clist-sync-btn.cooldown,
        .cf-clist-sync-btn.syncing,
        .cf-clist-sync-btn:disabled {
            background: #f8fafc !important;
            color: #94a3b8 !important;
            border-color: #e2e8f0 !important;
            cursor: not-allowed !important;
            box-shadow: none !important;
        }
        .cf-clist-sync-btn.cooldown *,
        .cf-clist-sync-btn.syncing *,
        .cf-clist-sync-btn:disabled * {
            cursor: not-allowed !important;
        }
        .cf-clist-sync-btn svg {
            transition: transform 0.3s ease;
        }
        .cf-clist-sync-btn:not(.cooldown):not(.syncing):not(:disabled):hover svg {
            transform: rotate(90deg);
        }
        @keyframes cfSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .cf-spin,
        .cf-clist-sync-btn.syncing svg {
            animation: cfSpin 1s linear infinite !important;
        }
        .cf-footer-mini-progress {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 2px 7px;
            margin: -2px -7px;
            border-radius: 6px;
            font-size: 12px;
            user-select: none;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.15s ease;
        }
        .cf-footer-mini-progress:hover {
            background: rgba(59, 130, 246, 0.08);
        }
        .cf-footer-mini-progress:active {
            transform: scale(0.98);
        }
        .cf-mini-progress-bar {
            width: 76px;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
            transition: box-shadow 0.2s ease;
        }
        .cf-footer-mini-progress:hover .cf-mini-progress-bar {
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
        }
        .cf-mini-progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #06b6d4);
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .cf-mini-progress-text {
            font-size: 11px;
            font-weight: 600;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #334155;
            transition: color 0.2s ease;
        }
        .cf-footer-mini-progress:hover .cf-mini-progress-text {
            color: #1d4ed8;
        }
        /* Clist Guide & Spec Modals */
        .cf-clist-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(3px);
            z-index: 10000002;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: cfFadeIn 0.2s ease;
            overscroll-behavior: contain;
        }
        .cf-clist-modal-card {
            background: #ffffff;
            border-radius: 12px;
            width: 580px;
            max-width: 92vw;
            max-height: 88vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            border: 1px solid rgba(226, 232, 240, 0.8);
            overscroll-behavior: contain;
        }
        .cf-clist-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        .cf-clist-modal-title {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cf-clist-modal-body {
            padding: 20px;
            overflow-y: auto;
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
            overscroll-behavior: contain;
        }
        .cf-clist-modal-footer {
            padding: 12px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
        }
        .cf-clist-mock-panel {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
            margin: 12px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }
        .cf-clist-code-block {
            background: #0f172a;
            color: #38bdf8;
            border-radius: 6px;
            padding: 10px 14px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
            overflow-x: auto;
            margin: 8px 0;
            border: 1px solid #1e293b;
            user-select: all;
        }
        .cf-clist-popover-demo {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05);
            padding: 12px;
            margin-top: 10px;
            position: relative;
        }
        .cf-clist-popover-demo::before {
            content: '';
            position: absolute;
            top: -6px;
            left: 28px;
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-top: 1px solid #cbd5e1;
            border-left: 1px solid #cbd5e1;
            transform: rotate(45deg);
        }
        .cf-clist-progress-track {
            width: 100%;
            height: 10px;
            background: #e2e8f0;
            border-radius: 5px;
            overflow: hidden;
            margin: 12px 0 8px;
            position: relative;
        }
        .cf-clist-progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #3b82f6, #6366f1);
            border-radius: 5px;
            transition: width 0.3s ease;
        }

        /* Segmented Switch */
        .cf-segmented-switch {
            display: flex;
            position: relative;
            background: #f0f0f0;
            border-radius: 12px;
            padding: 2px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            user-select: none;
            box-sizing: border-box;
        }
        .cf-segmented-slider {
            position: absolute;
            top: 2px;
            bottom: 2px;
            width: calc(50% - 2px);
            border-radius: 10px;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            box-sizing: border-box;
            background: white;
        }
        .cf-segmented-btn {
            flex: 1;
            text-align: center;
            padding: 3px 0;
            font-size: 12px;
            z-index: 1;
            transition: color 0.25s;
            box-sizing: border-box;
            margin: 1px;
            color: #888;
        }

        /* ------------------------------------------------------------- */
        /* Status & Submissions Table Layout                             */
        /* ------------------------------------------------------------- */
        .datatable > div[style*="background-color: white"],
        .datatable > div[style*="background-color:white"],
        .datatable > div:has(> table.status-frame-datatable) {
            overflow-x: auto !important;
            max-width: 100% !important;
        }

        table.cf-status-table,
        table.status-frame-datatable {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
        }

        table.cf-status-table th,
        table.cf-status-table td,
        table.status-frame-datatable th,
        table.status-frame-datatable td {
            padding: 5px 6px !important;
            box-sizing: border-box !important;
            vertical-align: middle !important;
        }

        /* 1) # Column - Compact fixed width */
        .id-cell,
        table.status-frame-datatable th:first-child {
            white-space: nowrap !important;
            width: 70px !important;
            min-width: 65px !important;
            vertical-align: middle !important;
        }

        /* 2) When Column - Preserves timezone */
        .cf-table-time-cell,
        th.cf-table-time-header {
            white-space: nowrap !important;
            width: 120px !important;
            min-width: 110px !important;
            vertical-align: middle !important;
        }

        /* 3) Who Column & Team Formatting */
        .status-party-cell {
            white-space: nowrap !important;
            text-align: left !important;
            vertical-align: middle !important;
            width: 140px !important;
            max-width: 155px !important;
        }
        .status-party-cell.cf-team-formatted,
        .status-party-cell.cf-team-unformatted {
            white-space: normal !important;
            word-break: break-word !important;
            width: auto !important;
            min-width: 140px !important;
            max-width: 240px !important;
            vertical-align: middle !important;
        }
        .cf-team-formatted {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
        }
        .cf-team-header {
            word-break: break-word;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: bold;
            line-height: 1.4;
        }
        .cf-team-members {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-left: 2px;
        }
        .cf-team-header sup,
        .cf-team-formatted sup {
            display: inline-block !important;
            vertical-align: super !important;
            font-size: 9px !important;
            line-height: 1 !important;
            margin-left: 2px !important;
        }
        .cf-avatar-line-wrapper {
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            max-width: 100% !important;
            white-space: nowrap !important;
        }
        a.cf-avatar-container {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
            flex-grow: 0 !important;
            width: auto !important;
            min-width: auto !important;
            max-width: none !important;
            overflow: visible !important;
            line-height: 1 !important;
        }
        img.cf-user-avatar {
            flex-shrink: 0 !important;
            display: inline-block !important;
            vertical-align: middle !important;
            margin-right: 5px !important;
            object-fit: cover !important;
        }
        :root:not(.cf-hide-userAvatar) .cf-author-icon-hidden,
        :root:not(.cf-hide-userAvatar) .right-meta li > a:has(> img[src*="user_16x16"]),
        :root:not(.cf-hide-userAvatar) .right-meta li > a > img[src*="user_16x16"] {
            display: none !important;
        }
        :root:not(.cf-hide-userAvatar) .cf-avatar-inline-user {
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            line-height: 1 !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .meta {
            display: flow-root !important;
            height: auto !important;
            min-height: 2.5em !important;
            box-sizing: border-box !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .meta br[style*="clear"] {
            display: none !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .left-meta {
            float: left !important;
            display: flex !important;
            align-items: center !important;
            min-height: 2.5em !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .left-meta ul {
            display: flex !important;
            align-items: center !important;
            margin: 0.35em 0.75em !important;
            padding: 0 !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta {
            float: right !important;
            display: flex !important;
            align-items: center !important;
            min-height: 2.5em !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta ul {
            display: flex !important;
            align-items: center !important;
            margin: 0.35em 0.75em !important;
            padding: 0 !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta ul li {
            display: inline-flex !important;
            align-items: center !important;
            float: none !important;
            margin: 0 0.8rem !important;
            line-height: 1 !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta ul li > a {
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            line-height: 1 !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta img.cf-user-avatar {
            width: var(--cf-avatar-size) !important;
            height: var(--cf-avatar-size) !important;
            aspect-ratio: 1 / 1 !important;
            object-fit: cover !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        }
        :root:not(.cf-hide-userAvatar) .topic .right-meta ul li > img,
        :root:not(.cf-hide-userAvatar) .topic .right-meta ul li > a > img:not(.cf-user-avatar) {
            vertical-align: middle !important;
            position: relative !important;
            top: 0 !important;
            margin-right: 4px !important;
        }
        :root:not(.cf-hide-userAvatar) .topic .info a.cf-avatar-inline-user {
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            line-height: 1 !important;
        }
        :root:not(.cf-hide-userAvatar) .second-level-menu-list {
            overflow: visible !important;
        }
        :root:not(.cf-hide-userAvatar) .second-level-menu-list li a.cf-avatar-inline-user {
            overflow: visible !important;
            display: inline-flex !important;
            align-items: center !important;
        }
        :root:not(.cf-hide-userAvatar) .second-level-menu-list li a.cf-avatar-inline-user img.cf-user-avatar {
            width: var(--cf-avatar-size) !important;
            height: var(--cf-avatar-size) !important;
            aspect-ratio: 1 / 1 !important;
            object-fit: cover !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
        }
        .status-party-cell:not(.cf-team-formatted):not(.cf-team-unformatted) a:not(.cf-avatar-container)[href*="/profile/"] {
            display: inline-block !important;
            vertical-align: middle !important;
            max-width: 105px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            flex: 0 1 auto !important;
            min-width: 0 !important;
            line-height: 1.3 !important;
        }
        .status-party-cell.cf-team-formatted a:not(.cf-avatar-container)[href*="/profile/"],
        .status-party-cell.cf-team-unformatted a:not(.cf-avatar-container)[href*="/profile/"],
        .status-party-cell.cf-team-unformatted a.rated-user {
            display: inline-block !important;
            vertical-align: middle !important;
            max-width: 180px !important;
            white-space: nowrap !important;
            flex: 0 1 auto !important;
            min-width: 0 !important;
            line-height: 1.3 !important;
        }
        .status-party-cell sup,
        .cf-avatar-line-wrapper sup {
            display: inline-block !important;
            align-self: flex-start !important;
            vertical-align: super !important;
            flex-shrink: 0 !important;
            margin-left: 2px !important;
            font-size: 9px !important;
            line-height: 1.1 !important;
            padding-top: 1px !important;
        }
        .status-party-cell sup a,
        .cf-avatar-line-wrapper sup a {
            vertical-align: top !important;
            line-height: 1 !important;
        }

        /* 4) Lang Column */
        td[data-cf-lang-icon-processed],
        th.cf-table-lang-header {
            white-space: nowrap !important;
            text-align: left !important;
            vertical-align: middle !important;
            width: 110px !important;
            max-width: 115px !important;
        }
        .cf-lang-icon {
            flex-shrink: 0 !important;
            display: inline-block !important;
            vertical-align: middle !important;
            margin-right: 4px !important;
            width: var(--cf-lang-icon-size, 14px) !important;
            height: var(--cf-lang-icon-size, 14px) !important;
            object-fit: contain !important;
        }
        .cf-lang-text {
            display: inline-block !important;
            max-width: calc(100px - var(--cf-lang-icon-size, 14px)) !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
        }
        :root.cf-hide-langIcon .cf-lang-text {
            max-width: 96px !important;
        }

        /* 5) Verdict Column */
        .status-verdict-cell {
            white-space: normal !important;
            word-break: normal !important;
            line-height: 1.25 !important;
            min-width: 75px !important;
            max-width: 110px !important;
            vertical-align: middle !important;
        }

        /* 6) Time & Memory Consumed Columns */
        .time-consumed-cell,
        th.cf-time-consumed-header {
            white-space: nowrap !important;
            text-align: right !important;
            vertical-align: middle !important;
            width: 55px !important;
        }
        .memory-consumed-cell,
        th.cf-memory-consumed-header {
            white-space: nowrap !important;
            text-align: right !important;
            vertical-align: middle !important;
            width: 60px !important;
        }

        /* 7) Ratings Column */
        .cf-rating-col {
            width: 52px !important;
            min-width: 52px !important;
            max-width: 52px !important;
            white-space: nowrap !important;
            text-align: center !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
        }
    `;
    safeAppendStyle(customStyle);

    // Inject Pickr CSS
    const pickrCss = document.createElement('link');
    pickrCss.rel = 'stylesheet';
    pickrCss.href = 'https://cdn.jsdelivr.net/npm/@simonwep/pickr/dist/themes/nano.min.css';
    safeAppendStyle(pickrCss);

    // Auto dark theme detection
    const isDarkTheme = () => {
        // Dark Reader will handle inverting our light colors automatically as long as we don't use !important
        if (document.querySelector('.darkreader') || document.querySelector('meta[name="darkreader"]')) return false;
        if (document.documentElement.getAttribute('data-theme') === 'dark' || (document.body && document.body.classList.contains('dark'))) return true;
        try {
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            const match = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const brightness = (parseInt(match[1]) * 299 + parseInt(match[2]) * 587 + parseInt(match[3]) * 114) / 1000;
                if (brightness < 128) return true;
            }
        } catch (e) { }
        return false;
    };

    // Fine-grained background colors matching Codeforces Analytics / extended rating systems
    function getRatingBgColor(rating) {
        if (isDarkTheme()) {
            if (rating < 1200) return '#444444'; // Gray
            if (rating < 1400) return '#1A4D1A'; // Green
            if (rating < 1600) return '#1A4D4D'; // Cyan
            if (rating < 1900) return '#1A1A4D'; // Blue
            if (rating < 2100) return '#4D1A4D'; // Violet
            if (rating < 2300) return '#705300'; // Yellow (Master)
            if (rating < 2400) return '#804000'; // Orange (International Master)
            if (rating < 2600) return '#661414'; // Light Red (Grandmaster)
            if (rating < 3000) return '#851515'; // Red (International Grandmaster)
            return '#800000'; // Dark Red
        }
        if (rating < 1200) return '#CCCCCC'; // Gray (Newbie)
        if (rating < 1400) return '#77FF77'; // Green (Pupil)
        if (rating < 1600) return '#77DDBB'; // Cyan (Specialist)
        if (rating < 1900) return '#AAAAFF'; // Blue (Expert)
        if (rating < 2100) return '#FF88FF'; // Violet (Candidate Master)
        if (rating < 2300) return '#FFCC88'; // Light Orange (Master)
        if (rating < 2400) return '#FFBB55'; // Orange (International Master)
        if (rating < 2600) return '#FF7777'; // Light Red (Grandmaster)
        if (rating < 3000) return '#FF3333'; // Red (International Grandmaster)
        return '#CC2222'; // Dark Red (Legendary Grandmaster+)
    }

    // Darker border colors for the roundbox tags
    function getRatingBorderColor(rating) {
        if (rating < 1200) return '#AAAAAA'; // Gray
        if (rating < 1400) return '#44CC44'; // Green
        if (rating < 1600) return '#44AA88'; // Cyan
        if (rating < 1900) return '#7777CC'; // Blue
        if (rating < 2100) return '#CC55CC'; // Violet
        if (rating < 2300) return '#CC9955'; // Light Orange
        if (rating < 2400) return '#CC8822'; // Orange
        if (rating < 2600) return '#CC4444'; // Light Red
        if (rating < 3000) return '#CC0000'; // Red
        return '#990000'; // Dark Red
    }

    // Fine-grained text colors when appending rating as text next to standalone links
    function getRatingTextColor(rating) {
        if (rating < 1200) return '#808080';
        if (rating < 1400) return '#008000';
        if (rating < 1600) return '#03A89E';
        if (rating < 1900) return '#0000FF';
        if (rating < 2100) return '#AA00AA';
        if (rating < 2300) return '#FF8C00';
        if (rating < 2400) return '#FF8C00';
        if (rating < 2600) return '#FF5555'; // Light Red (Grandmaster)
        if (rating < 3000) return '#FF0000'; // Red (International Grandmaster)
        return '#AA0000';
    }

    // IViewUI / Ant Design style aesthetic tags
    function getRatingTagStyle(rating) {
        let bg, border, text;
        const isDark = isDarkTheme();
        if (rating < 1200) { bg = isDark ? '#444444' : '#f7f7f7'; border = isDark ? '#666666' : '#cccccc'; text = isDark ? '#e6e6e6' : '#808080'; } // Gray
        else if (rating < 1400) { bg = isDark ? '#135200' : '#f6ffed'; border = isDark ? '#237804' : '#a8e67a'; text = isDark ? '#73d13d' : '#389e0d'; } // Green
        else if (rating < 1600) { bg = isDark ? '#00474f' : '#e6fffb'; border = isDark ? '#006d75' : '#76ded3'; text = isDark ? '#36cfc9' : '#08979c'; } // Cyan
        else if (rating < 1900) { bg = isDark ? '#002c8c' : '#e6f7ff'; border = isDark ? '#003eb3' : '#80c8f8'; text = isDark ? '#40a9ff' : '#096dd9'; } // Blue
        else if (rating < 2100) { bg = isDark ? '#531dab' : '#f9f0ff'; border = isDark ? '#722ed1' : '#c79cf0'; text = isDark ? '#b37feb' : '#531dab'; } // Violet
        else if (rating < 2300) { bg = isDark ? '#8c6900' : '#feffe6'; border = isDark ? '#d4b106' : '#fffb8f'; text = isDark ? '#fffb8f' : '#d4b106'; } // Yellow (Master)
        else if (rating < 2400) { bg = isDark ? '#994d00' : '#fffbe6'; border = isDark ? '#fa8c16' : '#ffe58f'; text = isDark ? '#ffe58f' : '#d48806'; } // Orange (International Master)
        else if (rating < 2600) { bg = isDark ? '#a8071a' : '#fff7f7'; border = isDark ? '#ff4d4f' : '#ffccc7'; text = isDark ? '#ffd8d6' : '#db2734'; } // Light Red (Grandmaster)
        else if (rating < 3000) { bg = isDark ? '#820014' : '#fff1f0'; border = isDark ? '#cf1322' : '#ffa39e'; text = isDark ? '#ff7875' : '#cf1322'; } // Deep Red (International Grandmaster)
        else { bg = isDark ? '#780650' : '#fff0f6'; border = isDark ? '#c41d7f' : '#ff9ec7'; text = isDark ? '#ffadd2' : '#c41d7f'; } // Dark Red / Magenta (Legendary)
        return { bg, border, text };
    }

    // -------------------------------------------------------------
    // Clist.by Ratings Data & Sync Module
    // -------------------------------------------------------------
    let clistProblemsCache = null;
    let latestRatingsMap = {};

    const naturalCollator = (typeof Intl !== 'undefined' && Intl.Collator)
        ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
        : null;
    const naturalCompare = naturalCollator
        ? naturalCollator.compare.bind(naturalCollator)
        : (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    function sortProblemKeys(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const sorted = {};
        const sortedKeys = Object.keys(obj).sort(naturalCompare);
        for (const k of sortedKeys) {
            sorted[k] = obj[k];
        }
        return sorted;
    }

    function sortProblemIds(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.slice().sort(naturalCompare);
    }

    // -------------------------------------------------------------
    // Parallel / Concurrent Contests (并赛分组) Module
    // -------------------------------------------------------------
    let parallelContestsCache = null;
    let contestToPeersMap = null;
    let contestProblemsIndex = null;

    function buildParallelContestLookup(groups) {
        contestToPeersMap = new Map();
        if (!Array.isArray(groups)) return;
        for (const group of groups) {
            if (!Array.isArray(group) || group.length <= 1) continue;
            for (const cid of group) {
                const numCid = typeof cid === 'number' ? cid : parseInt(cid, 10);
                if (!isNaN(numCid)) {
                    const peers = group.map(x => typeof x === 'number' ? x : parseInt(x, 10)).filter(id => id !== numCid && !isNaN(id));
                    contestToPeersMap.set(numCid, peers);
                }
            }
        }
    }

    function getParallelContests() {
        if (parallelContestsCache) return parallelContestsCache;
        try {
            parallelContestsCache = appStorage.getJSON(PARALLEL_CONTESTS_KEY, null) || [];
            buildParallelContestLookup(parallelContestsCache);
        } catch (e) {
            parallelContestsCache = [];
        }
        return parallelContestsCache;
    }

    function getPeerContests(contestId) {
        if (!contestToPeersMap) {
            getParallelContests();
        }
        const numId = typeof contestId === 'number' ? contestId : parseInt(contestId, 10);
        return (contestToPeersMap && contestToPeersMap.get(numId)) || [];
    }

    function invalidateContestProblemsIndex() {
        contestProblemsIndex = null;
    }

    function getProblemsByContest(cid) {
        if (!contestProblemsIndex) {
            contestProblemsIndex = new Map();
            const map = latestRatingsMap || {};
            for (const k in map) {
                const m = k.match(/^(\d+)/);
                if (m) {
                    const c = parseInt(m[1], 10);
                    if (!contestProblemsIndex.has(c)) {
                        contestProblemsIndex.set(c, []);
                    }
                    contestProblemsIndex.get(c).push({
                        key: k,
                        item: map[k]
                    });
                }
            }
        }
        const numId = typeof cid === 'number' ? cid : parseInt(cid, 10);
        return contestProblemsIndex.get(numId) || [];
    }

    function cleanProblemTitle(title) {
        if (!title || typeof title !== 'string') return '';
        let s = title.trim();
        // Remove prefixes like "C1. ", "C1 - ", "C1: ", "Problem C1. ", "1831C - ", etc.
        s = s.replace(/^(?:problem\s*)?(?:[0-9]+[a-z0-9]*|[a-z0-9]+)\s*[\.\-\–\—\:]\s*/i, '');
        return s.trim();
    }

    function getClistProblems() {
        if (clistProblemsCache) return clistProblemsCache;
        try {
            const parsed = appStorage.getJSON(CLIST_STORAGE_KEY, null);
            if (parsed) {
                // Auto-clean any legacy 'NAME:' keys from old cache
                let hasDirty = false;
                const cleaned = {};
                for (const k in parsed) {
                    if (k.startsWith('NAME:')) {
                        hasDirty = true;
                    } else {
                        cleaned[k] = parsed[k];
                    }
                }
                if (hasDirty) {
                    const sortedCleaned = sortProblemKeys(cleaned);
                    appStorage.setJSON(CLIST_STORAGE_KEY, sortedCleaned);
                    clistProblemsCache = sortedCleaned;
                } else {
                    clistProblemsCache = parsed;
                }
            }
        } catch (e) {
            console.error('Colorforces: Failed to read Clist problems cache', e);
        }
        return clistProblemsCache;
    }

    function setClistProblems(data) {
        const sorted = sortProblemKeys(data);
        clistProblemsCache = sorted;
        try {
            appStorage.setJSON(CLIST_STORAGE_KEY, sorted);
        } catch (e) {
            console.error('Colorforces: Failed to write Clist problems cache', e);
        }
    }

    function normalizeProblemName(name) {
        if (!name || typeof name !== 'string') return '';
        let s = name.trim();
        // Remove prefixes like "1831C - ", "1831C. ", "C - ", "C. ", "Problem C. "
        s = s.replace(/^(?:problem\s*)?(?:\d+[a-z0-9]*|[a-z0-9]+)\s*[\.\-\–\—\:]\s*/i, '');
        // Normalize multiple spaces and lowercase
        s = s.replace(/\s+/g, ' ').trim().toLowerCase();
        return s;
    }

    function normalizeClistApiKey(rawKey) {
        if (!rawKey) return '';
        let k = rawKey.trim();
        if (k.toLowerCase().startsWith('authorization:')) {
            k = k.substring('authorization:'.length).trim();
        }
        if (k.toLowerCase().startsWith('apikey ')) {
            k = 'ApiKey ' + k.substring('apikey '.length).trim();
        } else {
            k = 'ApiKey ' + k;
        }
        return k;
    }

    function getClistCooldownRemaining() {
        const lastSync = parseInt(appStorage.getItem(CLIST_LAST_SYNC_KEY) || (appSettings.clist && appSettings.clist.lastSyncTime) || '0', 10);
        if (!lastSync) return 0;
        const elapsed = Date.now() - lastSync;
        return Math.max(0, CLIST_SYNC_COOLDOWN - elapsed);
    }

    let globalFloatingTooltipEl = null;

    function ensureFloatingTooltip() {
        if (!globalFloatingTooltipEl) {
            globalFloatingTooltipEl = document.createElement('div');
            globalFloatingTooltipEl.className = 'cf-floating-tooltip';
            document.body.appendChild(globalFloatingTooltipEl);
            window.addEventListener('scroll', hideFloatingTooltip, true);
        }
        return globalFloatingTooltipEl;
    }

    function hideFloatingTooltip() {
        if (globalFloatingTooltipEl) {
            globalFloatingTooltipEl.classList.remove('visible');
            globalFloatingTooltipEl.style.opacity = '0';
            globalFloatingTooltipEl.style.visibility = 'hidden';
            globalFloatingTooltipEl.style.display = 'none';
        }
    }

    function showFloatingTooltip(el, text) {
        if (!el || !text) return;
        const tip = ensureFloatingTooltip();
        tip.textContent = text;
        tip.className = 'cf-floating-tooltip';
        tip.style.display = 'block';
        tip.style.opacity = '0';
        tip.style.visibility = 'hidden';

        const tipRect = tip.getBoundingClientRect();
        const rect = el.getBoundingClientRect();

        let top = rect.top - tipRect.height - 7;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        let placement = 'top';

        if (top < 8) {
            top = rect.bottom + 7;
            placement = 'bottom';
        }

        const padding = 10;
        if (left < padding) left = padding;
        else if (left + tipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tipRect.width - padding;
        }

        const arrowLeft = Math.max(10, Math.min(tipRect.width - 10, (rect.left + rect.width / 2) - left));
        tip.style.setProperty('--arrow-left', `${arrowLeft}px`);

        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.className = `cf-floating-tooltip cf-tip-${placement} visible`;
        tip.style.opacity = '1';
        tip.style.visibility = 'visible';
    }

    // ==========================================
    // Unified Internationalization (i18n) Module
    // ==========================================
    const I18N = {
        zh: {
            // Settings Panel - General & Navigation
            title: '插件设置',
            tabGeneral: '通用',
            tabAppearance: '界面',
            tabRatings: '难度分',
            tabUser: '用户',
            tabShortcuts: '快捷键',
            tabStorage: '存储',
            tabChangelog: '更新日志',
            tabRoadmap: '开发计划',
            tabAcknowledgments: '致谢',
            changelogTitle: '更新日志',
            changelogSubtitle: '记录 Colorforces 的所有版本演进与重要更新',
            changelogLatestBadge: '最新',
            changelogBadgeAdded: '新增',
            changelogBadgeOptimized: '优化',
            changelogBadgeFixed: '修复',
            changelogBadgeAnnouncement: '公告',
            roadmapTitle: '开发计划',
            roadmapSubtitle: '功能演进路线与开发进展规划，共同见证插件成长',
            roadmapSectionPlanned: '计划中',
            roadmapSectionCompleted: '已实现',
            roadmapStatusPlanned: '计划中',
            roadmapStatusCompleted: '已完成',
            roadmapItemCount: (count) => `${count} 项`,
            roadmapProposalTitle: '有新的功能提议？',
            roadmapProposalDesc: '如果您有更棒的创意、功能想法或优化建议，非常欢迎随时在 GitHub Issue 中发起提议，共同见证插件成长！',
            roadmapProposalBtn: '前往 Issue 提建议',
            langLabel: '菜单语言',
            langZhName: '简体中文',
            langEnName: 'English',
            locHideTags: '隐藏算法标签',
            locHideRatingTag: '隐藏难度分标签',
            locNotHideAcTags: '不隐藏已AC题目标签',
            locAutoCheckUpdate: '禁用自动更新',
            btnCheckUpdateNow: '检查更新',
            statusCheckingUpdate: '检查中...',
            statusUpdateLatest: '已是最新',
            statusUpdatePreview: '当前为预览版',
            statusUpdateFailed: '检查失败',
            updateModalTitle: '🔔 发现新版本',
            updateModalDesc: (remoteVer, curVer) => `检测到 Colorforces 有新的可用版本 <span style="font-weight: 700; color: #1890ff;">v${remoteVer}</span>（当前安装版本为 v${curVer}）。`,
            updateModalSubDesc: '建议及时更新以体验最新的功能优化和问题修复。',
            updateModalStopCheck: '不再自动检测更新',
            updateModalBtnUpdate: '立即更新',
            updateModalBtnLater: '稍后提醒 (3小时后)',
            shortcutsSectionTitle: '快捷键设置',
            shortcutsSectionSubtitle: '自定义常用操作的快捷热键，点击按键徽标后直接按下新按键即可修改。',
            shortcutsSectionTip: '默认快捷键为 Shift 加上对应功能英文单词的首字母（如 Hidden、Status、Time、Format 等）。',
            shortcutsSectionNoteLabel: '提示：',
            shortcutsSectionNote: '若某项功能无需快捷键切换，直接清空其快捷键即可。',
            shortcutHideTagsTitle: '显示/隐藏算法标签',
            shortcutHideTagsDesc: '在题目详情页或侧边栏快速切换算法分类标签的可见性。',
            shortcutShortVerdictTitle: '显示/隐藏状态缩写',
            shortcutShortVerdictDesc: '快速切换提交记录中状态文本与简写（AC / WA 等）。',
            shortcutTimeFormatTitle: '启用/关闭时间格式化',
            shortcutTimeFormatDesc: '快速切换全站竞赛、提交与评测时间的格式化显示。',
            shortcutLangIconTitle: '显示/隐藏语言图标',
            shortcutLangIconDesc: '快速切换提交列表中编程语言图标的显示状态。',
            shortcutClistEnabledTitle: '启用/关闭 CList 分数',
            shortcutClistEnabledDesc: '一键切换是否启用第三方 CList 精细难度评分。',
            shortcutColorRatingsTitle: '启用/关闭色彩展示难度分',
            shortcutColorRatingsDesc: '总开关：快速开启或关闭全站题目的段位彩色渲染。',
            shortcutDisplayStyleTitle: '切换难度分展示形式',
            shortcutDisplayStyleDesc: '在色块（Block）与标签（Tag）两种难度分显示样式间快速切换。',
            shortcutUserAvatarTitle: '显示/隐藏用户头像',
            shortcutUserAvatarDesc: '快速切换榜单和提交列表中用户头像的展示状态。',
            shortcutRecording: '请按下按键...',
            shortcutEditTooltip: '点击修改快捷键',
            shortcutEmpty: '(未设置)',
            shortcutClearBtn: '清空快捷键',
            shortcutResetBtn: '恢复默认',
            shortcutResetAllBtn: '恢复默认快捷键',
            masterColorRatings: '色彩展示难度分',
            displayStyleTitle: '难度分展示形式',
            locTagFillCell: '表格内标签铺满单元格',
            styleBlock: '色块',
            styleTag: '标签',
            acColor: 'AC 背景色',
            locationsTitle: '难度分展示区域',
            locSubmissions: '提交',
            locStatus: '状态',
            locHacks: 'Hack',
            locProblemset: '题单',
            locContestProblems: '比赛题单',
            locStandings: '比赛榜单',
            locProblemTags: '题目页标签',
            locUserAvatar: '显示用户头像',
            locAvatarSize: '头像大小',
            locFormatTeams: '队伍信息格式化',
            locLangIcon: '显示语言图标',
            locLangIconSize: '语言图标大小',
            locShortVerdict: '显示判题状态缩写',
            verdictHelpTooltip: '将 Accepted 等显示为 AC 等缩写，点击查看详情',
            verdictGuideModalTitle: '判题状态缩写对照表',
            verdictGuideDesc: '开启后，将提交记录中较长的判题状态替换为紧凑的标准缩写：',
            verdictGuideColStatus: '判题状态',
            verdictGuideColAbbr: '缩写',
            verdictGuideColMeaning: '说明',
            verdictGuideColRaw: '原始判题状态文本',
            verdictGuideColExample: '预览效果',
            verdictGuideCloseBtn: '我知道了',
            verdictGuideTipTitle: '保留说明：',
            verdictGuideTipDesc: '仅替换状态核心关键字，原有的测试点信息（如 on test 3 等）将被完整保留。',
            verdictAcMeaning: '通过 / 正确',
            verdictWaMeaning: '答案错误',
            verdictTleMeaning: '超出时间限制',
            verdictMleMeaning: '超出内存限制',
            verdictReMeaning: '运行时错误',
            verdictCeMeaning: '编译错误',
            verdictIleMeaning: '超出闲置时间',
            verdictPeMeaning: '格式错误',
            verdictSkMeaning: '跳过评测',
            timeFormatTitle: '自定义时间格式',
            timeFormatPreview: '预览: ',
            timeFormatDisabled: '格式化已关闭',
            timeFormatHelpTooltip: '点击显示时间格式串格式',
            timeGuideModalTitle: '时间格式串语法文档',
            timeGuideSectionTokens: '常用时间格式标识符',
            timeGuideSectionExamples: '常用格式示例',
            timeGuideColToken: '标识符',
            timeGuideColMeaning: '说明',
            timeGuideColExample: '示例',
            timeGuideCloseBtn: '我知道了',
            tokenYear4: '4位年份',
            tokenYear2: '2位年份 (如 26)',
            tokenMonth: '月份 (补零 / 不补零)',
            tokenDay: '日期 (补零 / 不补零)',
            tokenHour24: '24小时制 (补零 / 不补零)',
            tokenHour12: '12小时制 (补零 / 不补零)',
            tokenMinute: '分钟 (补零 / 不补零)',
            tokenSecond: '秒数 (补零 / 不补零)',
            tokenAmPm: '上午/下午 (大写 / 小写)',
            tokenWeekday: '星期全称 / 简称',
            tokenMonthName: '英文月份全称 / 简称',
            tokenEscape: '转义文本 (原样输出字符)',
            tokenEscapeExample: '[年], [at]',
            saveBtn: '保存并刷新',

            // Footer & Metadata
            footerRatingStatus: (timeStr) => `上次难度分更新时间（${timeStr}）`,
            footerRatingNeverSynced: '未同步',
            footerMotto: 'Colorforces · 算法竞赛视觉增强',
            footerGithub: 'GitHub',
            footerIssue: '问题反馈',
            footerMiniProgressTooltip: '点击查看同步详情',
            authorAttribution: (exiousLink, antigravityLink) => `由 ${exiousLink} & ${antigravityLink} 为❤️发电`,

            // CList Settings UI
            clistSectionTitle: 'CList 分数扩展',
            clistEnable: '启用 CList 分数',
            clistAuthMode: '认证方式',
            clistLoginHelpTooltip: '请前往 clist.by 进行登录',
            clistAuthLogin: '登录',
            clistAuthApi: 'API',
            clistApiKeyLabel: 'CList API Key',
            clistApiKeyPlaceholder: '格式 Authorization: ApiKey Username:Key',
            clistHelpTooltip: '点击查看详细指引',
            clistSyncTitle: '立即同步 CList 分数',
            clistSyncTooltip: 'CList 请求有频率限制（8秒/次），全量同步仅需 3 次请求（约 24 秒），点击查看说明',
            clistSyncBtn: '立即同步',
            clistSyncBtnSyncing: (pct) => `同步中 (${pct}%)`,
            clistSyncBtnCooldown: (min, sec) => `冷却中 (${min}:${sec})`,
            clistNeedKeyOrLogin: '请先填写 CList API Key 或在浏览器中登录 CList',
            clistInCooldown: (min, sec) => `同步仍在冷却中，请在 ${min}分${sec}秒 后再试`,

            // CList API Key Guide Modal
            guideModalTitle: 'CList API Key 获取指引',
            guideStep1Title: '第一步：注册并登录 CList 官网',
            guideStep1Desc: '请确保您已经在浏览器中登录了 CList 账号：',
            guideStep2Title: '第二步：打开 API 文档页面',
            guideStep2Desc: '在当前浏览器中直接访问 API v4 文档：',
            guideStep3Title: '第三步：定位文档说明并直接左键点击 "here"',
            guideStep3Desc: '在文档开头的说明文字中找到如下引用：',
            guideNoteLabel: '注意：',
            guideStep3Note: '必须在文档页面中<strong>直接鼠标左键单击</strong>蓝色的 <strong>here</strong>。<br>请勿在新标签页中打开，否则由于缺乏 CSRF 会提示 403 错误。',
            guideStep4Title: '第四步：完整复制弹出的 Request Header',
            guideStep4Desc: '左键点击后，页面将在原位弹出一个原生浮层（Popover），如下图模拟演示：',
            guideNoticeLabel: '提醒：',
            guideStep4Notice: '上方为格式示例。请将您在 CList 文档中点击后弹出的真实整行代码复制，并粘贴到插件设置的「CList API Key」输入框中。',
            guideConfirmBtn: '我知道了',

            // CList Sync Specification Modal
            specModalTitle: 'CList API 同步机制说明',
            specRateLimitTitle: '1. 接口频率限制',
            specRateLimitLabel: '频率限制：',
            specRateLimitDesc: 'CList API 限制为每 60 秒最多允许 10 次请求，超出将返回 429 错误。',
            specPageLimitLabel: '单次上限：',
            specPageLimitDesc: '单次请求最多返回 1,000 场比赛（携带比赛内全量内嵌题目数据）。',
            specBatchStrategyTitle: '2. 分批同步策略',
            specDatasetLabel: '数据规模：',
            specDatasetDesc: 'Codeforces 历史共约 2,100+ 场比赛（覆盖 1.3 万+ 道题目），插件仅需 3 次请求即可拉取全量数据。',
            specPacemakerLabel: '平稳请求：',
            specPacemakerDesc: '每次请求间隔 8 秒，总耗时仅约 24 秒，完全在频率限制以内。',
            specProgressLabel: '实时进度：',
            specProgressDesc: '同步期间会显示当前页码、已拉取题数与剩余时间预估。',
            specCooldownTitle: '3. 冷却保护机制',
            specCooldownLabel: '10 分钟冷却：',
            specCooldownDesc: '全部题目同步成功后进入 10 分钟冷却，避免频繁请求。',
            specErrorCooldownLabel: '失败不触发冷却：',
            specErrorCooldownDesc: '若因网络或凭证错误中途退出，不会触发冷却，可直接重新同步。',
            specConfirmBtn: '我知道了',

            // CList Sync Progress Modal
            syncModalTitle: '同步 CList 分数',
            syncInitConnecting: '正在初始化连接...',
            syncLabelTotal: '题目总量',
            syncApproxCount: (count) => `约 ${count}`,
            syncLabelPulled: '已拉取',
            syncLabelEta: '预估剩余',
            syncNoticeTip: '💡 提示：为确保数据抓取安全可靠，插件采用 8 秒/次的平稳节拍调度，全量仅需 3 次请求（约 24 秒），期间请保持本页面开启。',
            syncBtnBackground: '后台运行',
            syncBtnDone: '完成',
            syncBtnClose: '关闭',
            syncBtnRetry: '重试',
            syncStatusSuccess: (count) => `同步成功！已更新并缓存 ${count} 道题目`,
            syncStatusFinished: '已完成',
            syncStatusInterrupted: '同步中断',

            // CList Sync Execution & Errors
            syncNeedApiKey: '请先填写 CList API Key',
            syncApiKeyMissingNote: '💡 请先在设置面板中填写您的 API Key，或切换为 Cookie 登录模式。',
            syncStatusFetching: (pulled, total, page, totalPages = 3) => `正在拉取题目数据 (${pulled} / 约 ${total} 题，第 ${page}/${totalPages} 页)...`,
            syncNetworkError: '网络请求失败，请检查网络连接或 CList 状态',
            syncApiKeyInvalid: 'API Key 无效或未授权，请检查填写的凭证',
            syncLoginRequired: '未检测到 CList 登录状态，请在浏览器中登录 clist.by，或切换至「API」模式填写 Key',
            syncRateLimitedStatus: (s) => `遇到频控限制 (429)，自动等待重试（剩余 ${s} 秒）...`,
            syncRateLimitedEta: (s) => `约 ${s + 15} 秒`,
            syncWaitIntervalStatus: (s) => `正在等待请求间隔（8s/次，剩余 ${s} 秒）...`,
            syncEtaMinutesSeconds: (min, sec) => `约 ${min} 分 ${sec} 秒`,
            syncEtaSeconds: (sec) => `约 ${sec} 秒`,

            // Storage & Cache Management Panel
            storageSectionTitle: '油猴存储与缓存管理',
            storageSectionSubtitle: '查看插件在油猴脚本管理器中占用的存储数据与缓存，支持分项清空或重置出厂配置。',
            storageTotalTitle: '油猴存储占用',
            storageLimitText: (used) => `${used}`,
            storageBarClist: 'CList 题库',
            storageBarCf: 'CF 官方',
            storageBarAvatar: '头像缓存',
            storageBarSolved: '已AC题库',
            storageBarSettings: '插件配置',
            storageBarLegacy: '已弃用的缓存',
            storageClearAllBtn: '清空全部并重置',
            storageClearAllConfirm: '确定要清空所有本地题库、头像等缓存，并将插件配置恢复为出厂默认设置吗？\n\n此操作不可撤销！',
            storageSettingsTitle: '插件配置',
            storageSettingsDesc: '包含界面外观、评分颜色、语言与展示位置等设置（重置将恢复出厂默认值）。',
            storageSettingsResetBtn: '恢复默认',
            storageSettingsResetConfirm: '确定要将所有插件配置项恢复为默认出厂设置吗？已拉取的题目数据不受影响。',
            storageSettingsResetSuccess: '已恢复出厂默认设置',
            storageCfTitle: 'CF 官方题库',
            storageCfDesc: 'Codeforces 官方公开题库难度分与题名索引缓存（清空后下次进入页面自动静默拉取）。',
            storageCfClearBtn: '清空缓存',
            storageCfClearConfirm: '确定要清空 Codeforces 官方题目数据缓存吗？清空后下次打开页面时将重新从 CF 官方 API 获取。',
            storageCfClearSuccess: 'CF 官方题目缓存已清空',
            storageClistTitle: 'CList 题库数据',
            storageClistDesc: '全量同步的 CList 精细难度分、AC 题数与总提交数缓存（清空后若需使用可重新「立即同步」）。',
            storageClistClearBtn: '清空缓存',
            storageClistClearConfirm: '确定要清空 CList 题库数据缓存吗？清空后若要重新使用，需点击「立即同步」。',
            storageClistClearSuccess: 'CList 题库数据已清空',
            storageAvatarTitle: '用户头像缓存',
            storageAvatarDesc: '榜单与提交列表中已解析的用户头像地址及 503 节点异常自愈降级缓存。',
            storageAvatarClearBtn: '清空缓存',
            storageAvatarClearConfirm: '确定要清空已缓存的用户头像数据吗？清空后再次浏览比赛榜单将重新解析头像。',
            storageAvatarClearSuccess: '用户头像缓存已清空',
            storageSolvedTitle: '用户已通过题目缓存',
            storageSolvedDesc: '缓存当前登录用户已解决 (AC) 的题目记录，用于题目详情页和题库列表中不隐藏已 AC 题目标签。',
            storageSolvedClearBtn: '清空缓存',
            storageSolvedClearConfirm: '确定要清空用户已解决 (AC) 题目的本地缓存吗？清空后若开启了不隐藏已 AC 标签功能，将自动重新向官方拉取。',
            storageSolvedClearSuccess: '已通过题目缓存已清空',
            storageSolvedNoneTip: '暂无已通过题目的本地缓存记录。',
            storageSolvedCount: (count) => `${count.toLocaleString()} 道`,
            storageLegacyTitle: '已弃用的缓存',
            storageLegacyDesc: '包含旧版头像缓存 (v1)、已弃用的别名映射及早期遗留的历史键值，可放心清理释放空间。',
            storageLegacyClearBtn: '清空缓存',
            storageLegacyClearConfirm: (count) => `确定要清空这 ${count} 项旧版本已弃用的历史缓存数据吗？\n\n清理后不会影响当前插件的正常使用。`,
            storageLegacyNoneTip: '当前本地没有检测到任何弃用的缓存数据。',
            storageItemCount: (count) => `${count.toLocaleString()} 项`,
            storageProblemCount: (count) => `${count.toLocaleString()} 题`,
            storageAvatarCount: (count) => `${count.toLocaleString()} 个头像`,
            storageClearedBadge: '已清空',
            storageDefaultBadge: '出厂默认',
            storageViewBtn: '查看',
            storageViewTitle: '查看存储数据',
            storageCopyBtn: '复制 JSON',
            storageCopiedBtn: '已复制!',
            storageCloseBtn: '关闭',
            storageEmptyData: '(当前暂无缓存数据 / 缓存已清空)',
            storageViewFooterTip: '只读数据展示 · 不会更改任何油猴存储内容',
            storageKeyPrefix: '当前预览的油猴存储 Key',
            storageTruncatedTip: '已截取部分预览以保障流畅，点击右上角「复制 JSON」可获取完整数据',
            popConfirmBtn: '确定',
            popCancelBtn: '取消',
            popGotItBtn: '知道了',

            // Acknowledgments Panel
            ackSectionTitle: '致谢',
            ackSectionSubtitle: '向开源先驱与卓越社区项目致敬，共同构建更极致的竞赛体验。',
            ackHelperTitle: 'Codeforces-Helper',
            ackHelperBadge: '灵感起源',
            ackHelperDesc: '<p>Codeforces-Helper 是一款经典的竞赛辅助扩展，支持提交难度查看与算法标签隐藏，具备比赛记录对比及题目收藏功能。</p><p>本插件最初受其启发，补充了全局 status 页面展示，并扩展了更丰富的自定义功能。</p>',
            ackHelperLinkText: '访问 Chrome 网上应用店',
            ackClistTitle: 'CList',
            ackClistBadge: '统计数据源',
            ackClistDesc: '<p>CList 是知名的算法竞赛聚合平台，汇集各大 OJ 赛事日程，提供全面的赛事与题目数据。</p><p>感谢 CList 提供更详细的题目统计数据，本插件接入其数据以展示题目难度。</p>',
            ackClistLinkText: '访问 CList 官网',
            ackOjBetterTitle: 'OJ Better',
            ackOjBetterBadge: '功能启发',
            ackOjBetterDesc: '<p>OJ Better 是一款现代化的 OJ 增强脚本，支持多家主流竞赛平台，提供界面美化与辅助拓展。</p><p>感谢 OJ Better 对 CList 分数集成功能的启发，为本插件实现该功能提供了参考。</p>',
            ackOjBetterLinkText: '访问 GitHub 仓库',
            ackCarrotTitle: 'Carrot-Plus',
            ackCarrotBadge: '预测功能即将集成',
            ackCarrotDesc: '<p>Carrot-Plus 是一款经典的竞赛预测扩展，支持实时榜单测算，动态估算选手的 Rating 变动。</p><p>本插件计划在后续版本集成其预测算法，提供内置的比赛 Rating 预测功能。</p>',
            ackCarrotLinkText: '访问 GitHub 仓库'
        },
        en: {
            // Settings Panel - General & Navigation
            title: 'Plugin Settings',
            tabGeneral: 'General',
            tabAppearance: 'Appearance',
            tabRatings: 'Ratings',
            tabUser: 'Users',
            tabShortcuts: 'Shortcuts',
            tabStorage: 'Storage',
            tabChangelog: 'Changelog',
            tabRoadmap: 'Roadmap',
            tabAcknowledgments: 'Acknowledgments',
            changelogTitle: 'Changelog',
            changelogSubtitle: 'Notable changes and release history for Colorforces',
            changelogLatestBadge: 'Latest',
            changelogBadgeAdded: 'Added',
            changelogBadgeOptimized: 'Optimized',
            changelogBadgeFixed: 'Fixed',
            changelogBadgeAnnouncement: 'Announcement',
            roadmapTitle: 'Development Roadmap',
            roadmapSubtitle: 'Upcoming feature plans and development milestones for Colorforces',
            roadmapSectionPlanned: 'Planned',
            roadmapSectionCompleted: 'Completed',
            roadmapStatusPlanned: 'Planned',
            roadmapStatusCompleted: 'Done',
            roadmapItemCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
            roadmapProposalTitle: 'Have a Feature Proposal?',
            roadmapProposalDesc: 'Got an awesome idea, feature request, or optimization tip? Feel free to open an issue on GitHub and build Colorforces together!',
            roadmapProposalBtn: 'Propose on GitHub',
            langLabel: 'Menu Language',
            langZhName: '简体中文',
            langEnName: 'English',
            locHideTags: 'Hide Algorithm Tags',
            locHideRatingTag: 'Hide Difficulty Rating Tag',
            locNotHideAcTags: 'Keep Tags for Solved Problems',
            locAutoCheckUpdate: 'Disable Auto Updates',
            btnCheckUpdateNow: 'Check Updates',
            statusCheckingUpdate: 'Checking...',
            statusUpdateLatest: 'Up to date',
            statusUpdatePreview: 'Preview version',
            statusUpdateFailed: 'Check failed',
            updateModalTitle: '🔔 New Version Available',
            updateModalDesc: (remoteVer, curVer) => `A new version of Colorforces is available: <span style="font-weight: 700; color: #1890ff;">v${remoteVer}</span> (current installed version is v${curVer}).`,
            updateModalSubDesc: 'Updating is recommended to experience the latest features and improvements.',
            updateModalStopCheck: 'Do not check for updates automatically',
            updateModalBtnUpdate: 'Update Now',
            updateModalBtnLater: 'Remind Later (in 3h)',
            shortcutsSectionTitle: 'Keyboard Shortcuts',
            shortcutsSectionSubtitle: 'Customize hotkeys for frequent actions. Click a shortcut badge and press the new key combination to record.',
            shortcutsSectionTip: 'Default shortcuts follow Shift + the feature\'s initial letter (e.g. Hidden, Status, Time, Format, etc.).',
            shortcutsSectionNoteLabel: 'Tip: ',
            shortcutsSectionNote: 'If you do not wish to use a shortcut for a feature, simply clear its shortcut key.',
            shortcutHideTagsTitle: 'Toggle Problem Tags',
            shortcutHideTagsDesc: 'Quickly toggle visibility of algorithm tags on problem pages.',
            shortcutShortVerdictTitle: 'Toggle Verdict Abbreviations',
            shortcutShortVerdictDesc: 'Switch between full verdict text and compact abbreviations (AC / WA).',
            shortcutTimeFormatTitle: 'Toggle Time Formatting',
            shortcutTimeFormatDesc: 'Quickly toggle custom formatting of dates and times across the site.',
            shortcutLangIconTitle: 'Toggle Language Icons',
            shortcutLangIconDesc: 'Toggle display of programming language icons in submission lists.',
            shortcutClistEnabledTitle: 'Toggle CList Ratings',
            shortcutClistEnabledDesc: 'Quickly turn on or off CList fine-grained difficulty ratings.',
            shortcutColorRatingsTitle: 'Toggle Colored Ratings',
            shortcutColorRatingsDesc: 'Master switch to toggle rank-color difficulty styling across the site.',
            shortcutDisplayStyleTitle: 'Toggle Ratings Display Format',
            shortcutDisplayStyleDesc: 'Switch between Block and Tag difficulty rating display formats.',
            shortcutUserAvatarTitle: 'Toggle User Avatars',
            shortcutUserAvatarDesc: 'Toggle visibility of user avatars in standings and status tables.',
            shortcutRecording: 'Press keys...',
            shortcutEditTooltip: 'Click to edit shortcut',
            shortcutEmpty: '(None)',
            shortcutClearBtn: 'Clear shortcut',
            shortcutResetBtn: 'Reset to default',
            shortcutResetAllBtn: 'Reset All to Defaults',
            masterColorRatings: 'Colored Ratings',
            displayStyleTitle: 'Ratings Display Format',
            locTagFillCell: 'Fill Table Cells with Tag Style',
            styleBlock: 'Block',
            styleTag: 'Tag',
            acColor: 'AC Background',
            locationsTitle: 'Ratings Display Locations',
            locSubmissions: 'Submissions',
            locStatus: 'Status',
            locHacks: 'Hacks',
            locProblemset: 'ProblemSet',
            locContestProblems: 'Contest Problems',
            locStandings: 'Contest Standings',
            locProblemTags: 'Problem Tags',
            locUserAvatar: 'User Avatars',
            locAvatarSize: 'Avatar Size',
            locFormatTeams: 'Format Teams',
            locLangIcon: 'Language Icons',
            locLangIconSize: 'Icon Size',
            locShortVerdict: 'Compact Verdict Statuses',
            verdictHelpTooltip: 'Abbreviate Accepted to AC, etc. Click to view details',
            verdictGuideModalTitle: 'Verdict Abbreviations Reference',
            verdictGuideDesc: 'When enabled, lengthy verdict texts in submissions are replaced with compact standard acronyms:',
            verdictGuideColStatus: 'Verdict Status',
            verdictGuideColAbbr: 'Abbr.',
            verdictGuideColMeaning: 'Meaning',
            verdictGuideColRaw: 'Original Verdict Text',
            verdictGuideColExample: 'Preview',
            verdictGuideCloseBtn: 'Got it',
            verdictGuideTipTitle: 'Notice:',
            verdictGuideTipDesc: 'Only the verdict keywords are abbreviated; test case details (such as "on test 3") are preserved.',
            verdictAcMeaning: 'Passed / Accepted',
            verdictWaMeaning: 'Wrong Answer',
            verdictTleMeaning: 'Time Limit Exceeded',
            verdictMleMeaning: 'Memory Limit Exceeded',
            verdictReMeaning: 'Runtime Error',
            verdictCeMeaning: 'Compilation Error',
            verdictIleMeaning: 'Idleness Limit Exceeded',
            verdictPeMeaning: 'Presentation Error',
            verdictSkMeaning: 'Skipped',
            timeFormatTitle: 'Custom Time Format',
            timeFormatPreview: 'Preview: ',
            timeFormatDisabled: 'Disabled',
            timeFormatHelpTooltip: 'Click to view time format syntax',
            timeGuideModalTitle: 'Time Format Syntax Guide',
            timeGuideSectionTokens: 'Format Tokens',
            timeGuideSectionExamples: 'Common Examples',
            timeGuideColToken: 'Token',
            timeGuideColMeaning: 'Meaning',
            timeGuideColExample: 'Example',
            timeGuideCloseBtn: 'Got it',
            tokenYear4: '4-digit year',
            tokenYear2: '2-digit year (e.g. 26)',
            tokenMonth: 'Month (padded / unpadded)',
            tokenDay: 'Day of month (padded / unpadded)',
            tokenHour24: '24-hour format (padded / unpadded)',
            tokenHour12: '12-hour format (padded / unpadded)',
            tokenMinute: 'Minute (padded / unpadded)',
            tokenSecond: 'Second (padded / unpadded)',
            tokenAmPm: 'AM / PM (uppercase / lowercase)',
            tokenWeekday: 'Full / short weekday',
            tokenMonthName: 'Full / short English month',
            tokenEscape: 'Escaped literal text',
            tokenEscapeExample: '[at], [T]',
            saveBtn: 'Save & Reload',

            // Footer & Metadata
            footerRatingStatus: (timeStr) => `Ratings Last Updated (${timeStr})`,
            footerRatingNeverSynced: 'Not synced',
            footerMotto: 'Colorforces · Reimagining Codeforces',
            footerGithub: 'GitHub',
            footerIssue: 'Feedback',
            footerMiniProgressTooltip: 'Click to view sync details',
            authorAttribution: (exiousLink, antigravityLink) => `Crafted with ❤️ by ${exiousLink} & ${antigravityLink}`,

            // CList Settings UI
            clistSectionTitle: 'CList Ratings Extension',
            clistEnable: 'Enable CList Ratings',
            clistAuthMode: 'Auth Mode',
            clistLoginHelpTooltip: 'Please log in at clist.by',
            clistAuthLogin: 'Login',
            clistAuthApi: 'API',
            clistApiKeyLabel: 'CList API Key',
            clistApiKeyPlaceholder: 'Format Authorization: ApiKey Username:Key',
            clistHelpTooltip: 'Click to view detailed guide',
            clistSyncTitle: 'Sync CList Ratings Now',
            clistSyncTooltip: 'CList API rate limits apply (8s/req, ~24s total across 3 requests). Click for details',
            clistSyncBtn: 'Sync Now',
            clistSyncBtnSyncing: (pct) => `Syncing (${pct}%)`,
            clistSyncBtnCooldown: (min, sec) => `Cooldown (${min}:${sec})`,
            clistNeedKeyOrLogin: 'Please provide a CList API Key or log in to CList in your browser',
            clistInCooldown: (min, sec) => `Sync is on cooldown. Please wait ${min}m ${sec}s.`,

            // CList API Key Guide Modal
            guideModalTitle: 'CList API Key Guide',
            guideStep1Title: 'Step 1: Log in to clist.by',
            guideStep1Desc: 'Make sure you are logged in to your account at:',
            guideStep2Title: 'Step 2: Navigate to the API Documentation',
            guideStep2Desc: 'Visit the API v4 documentation:',
            guideStep3Title: 'Step 3: Click the "here" link with left mouse button',
            guideStep3Desc: 'Find the following sentence at the top of the documentation:',
            guideNoteLabel: 'Note:',
            guideStep3Note: 'Please <strong>left-click the blue "here" directly</strong> on the page.<br>Do not open in a new tab to avoid a 403 error.',
            guideStep4Title: 'Step 4: Copy the entire Request Header',
            guideStep4Desc: 'Upon clicking, a popover dialog will appear as simulated below:',
            guideNoticeLabel: 'Notice:',
            guideStep4Notice: 'The code block above is an example. Please copy your personal header from the CList popover and paste it into the plugin settings.',
            guideConfirmBtn: 'Got it',

            // CList Sync Specification Modal
            specModalTitle: 'CList API Sync Specifications',
            specRateLimitTitle: '1. API Rate Limits',
            specRateLimitLabel: 'Rate Limit: ',
            specRateLimitDesc: 'CList API allows up to 10 requests per 60 seconds; exceeding triggers HTTP 429.',
            specPageLimitLabel: 'Page Limit: ',
            specPageLimitDesc: 'Up to 1,000 contests per request (with with_problems returning embedded problem datasets).',
            specBatchStrategyTitle: '2. Batch Sync Strategy',
            specDatasetLabel: 'Data Scope: ',
            specDatasetDesc: 'Codeforces has ~2,100+ contests (covering 13,000+ problems), fully fetched across only 3 requests.',
            specPacemakerLabel: 'Pacemaker: ',
            specPacemakerDesc: 'Requests are sent every 8 seconds (~24s total across 3 requests), well within rate limits.',
            specProgressLabel: 'Progress: ',
            specProgressDesc: 'Displays current page, pulled count, and estimated time remaining.',
            specCooldownTitle: '3. Cooldown Protection',
            specCooldownLabel: '10-Min Cooldown: ',
            specCooldownDesc: 'Enters a 10-minute cooldown after successful full sync to avoid frequent requests.',
            specErrorCooldownLabel: 'No Cooldown on Error: ',
            specErrorCooldownDesc: 'If aborted due to network or invalid credentials, cooldown is not applied.',
            specConfirmBtn: 'Got it',

            // CList Sync Progress Modal
            syncModalTitle: 'Sync CList Ratings',
            syncInitConnecting: 'Connecting to CList API...',
            syncLabelTotal: 'Total Problems',
            syncApproxCount: (count) => `~${count}`,
            syncLabelPulled: 'Fetched',
            syncLabelEta: 'Estimated Time',
            syncNoticeTip: '💡 Notice: To ensure safe syncing, the script runs at 8s per request (~24s total across 3 requests). Please keep this page open.',
            syncBtnBackground: 'Run in Background',
            syncBtnDone: 'Done',
            syncBtnClose: 'Close',
            syncBtnRetry: 'Retry',
            syncStatusSuccess: (count) => `Sync complete! Cached ${count} problems`,
            syncStatusFinished: 'Finished',
            syncStatusInterrupted: 'Sync Interrupted',

            // CList Sync Execution & Errors
            syncNeedApiKey: 'Please provide a CList API Key',
            syncApiKeyMissingNote: '💡 Please configure your API Key or switch to Cookie mode first.',
            syncStatusFetching: (pulled, total, page, totalPages = 3) => `Fetching problems (${pulled} / ~${total}, page ${page}/${totalPages})...`,
            syncNetworkError: 'Network request failed, please check connection.',
            syncApiKeyInvalid: 'Invalid API Key or unauthorized, please check your credentials.',
            syncLoginRequired: 'No active CList login detected. Please log in at clist.by or switch to "API" mode.',
            syncRateLimitedStatus: (s) => `Rate limited (429), auto-waiting (${s}s)...`,
            syncRateLimitedEta: (s) => `~${s + 15}s`,
            syncWaitIntervalStatus: (s) => `Waiting 8s request interval (${s}s remaining)...`,
            syncEtaMinutesSeconds: (min, sec) => `~${min}m ${sec}s`,
            syncEtaSeconds: (sec) => `~${sec}s`,

            // Storage & Cache Management Panel
            storageSectionTitle: 'Tampermonkey Storage & Cache Management',
            storageSectionSubtitle: 'Inspect Tampermonkey script storage usage, clear cached problem/avatar data, or restore factory default settings.',
            storageTotalTitle: 'Tampermonkey Storage Used',
            storageLimitText: (used) => `${used}`,
            storageBarClist: 'CList Problems',
            storageBarCf: 'CF Official',
            storageBarAvatar: 'Avatars',
            storageBarSolved: 'Solved',
            storageBarSettings: 'Settings',
            storageBarLegacy: 'Deprecated Cache',
            storageClearAllBtn: 'Clear All & Reset',
            storageClearAllConfirm: 'Are you sure you want to clear all local caches and reset plugin settings to factory defaults?\n\nThis action cannot be undone!',
            storageSettingsTitle: 'Plugin Settings',
            storageSettingsDesc: 'User preferences including appearance, language, and display locations (resets to defaults).',
            storageSettingsResetBtn: 'Restore Defaults',
            storageSettingsResetConfirm: 'Reset all plugin settings to factory defaults? Cached problem ratings will not be affected.',
            storageSettingsResetSuccess: 'Factory default settings restored',
            storageCfTitle: 'CF Official Problems',
            storageCfDesc: 'Official rating and problem title index cache (will automatically re-fetch on next page visit).',
            storageCfClearBtn: 'Clear Cache',
            storageCfClearConfirm: 'Clear Codeforces official problem ratings cache? It will be re-fetched automatically on next page load.',
            storageCfClearSuccess: 'Codeforces problem cache cleared',
            storageClistTitle: 'CList Problem Data',
            storageClistDesc: 'Fully synced CList fine-grained ratings, accepted counts, and submission totals.',
            storageClistClearBtn: 'Clear Cache',
            storageClistClearConfirm: 'Clear CList problem ratings cache? You will need to click "Sync Now" to download again.',
            storageClistClearSuccess: 'CList problem data cleared',
            storageAvatarTitle: 'User Avatars Cache',
            storageAvatarDesc: 'Cached user avatar URLs and 503 error self-healing fallback records for standings and status lists.',
            storageAvatarClearBtn: 'Clear Cache',
            storageAvatarClearConfirm: 'Clear cached user avatar data? Avatars will be re-resolved when viewing standings.',
            storageAvatarClearSuccess: 'User avatar cache cleared',
            storageSolvedTitle: 'User Solved Problems Cache',
            storageSolvedDesc: 'Cached list of solved problem records for logged-in users, used for status matching and keeping tags on solved problems.',
            storageSolvedClearBtn: 'Clear Cache',
            storageSolvedClearConfirm: 'Clear local cache of user solved problems? It will be re-fetched from Codeforces when needed.',
            storageSolvedClearSuccess: 'User solved problems cache cleared',
            storageSolvedNoneTip: 'No solved problem cache records found.',
            storageSolvedCount: (count) => `${count.toLocaleString()} solved`,
            storageLegacyTitle: 'Deprecated Cache',
            storageLegacyDesc: 'Includes legacy avatar cache (v1), deprecated alias mappings, and leftover keys from older versions. Safe to clean up.',
            storageLegacyClearBtn: 'Clear Cache',
            storageLegacyClearConfirm: (count) => `Clear these ${count} deprecated storage item(s)?\n\nRemoving them will not affect current plugin features.`,
            storageLegacyNoneTip: 'No deprecated storage data detected.',
            storageItemCount: (count) => count === 1 ? '1 item' : `${count.toLocaleString()} items`,
            storageProblemCount: (count) => `${count.toLocaleString()} problems`,
            storageAvatarCount: (count) => `${count.toLocaleString()} avatars`,
            storageClearedBadge: 'Cleared',
            storageDefaultBadge: 'Default',
            storageViewBtn: 'View',
            storageViewTitle: 'Storage JSON Data',
            storageCopyBtn: 'Copy JSON',
            storageCopiedBtn: 'Copied!',
            storageCloseBtn: 'Close',
            storageEmptyData: '(No cached data available / Cache cleared)',
            storageViewFooterTip: 'Read-only inspection · Tampermonkey storage unmodified',
            storageKeyPrefix: 'Current Preview Tampermonkey Key',
            storageTruncatedTip: 'Preview truncated for performance, click "Copy JSON" to get full data',
            popConfirmBtn: 'Confirm',
            popCancelBtn: 'Cancel',
            popGotItBtn: 'Got it',

            // Acknowledgments Panel
            ackSectionTitle: 'Acknowledgments',
            ackSectionSubtitle: 'Honoring pioneering open-source projects and community services that inspire an elevated competitive programming experience.',
            ackHelperTitle: 'Codeforces-Helper',
            ackHelperBadge: 'Original Inspiration',
            ackHelperDesc: '<p>Codeforces-Helper is a classic contest helper extension, supporting submission rating views and tag hiding, along with contest comparison and problem bookmarking.</p><p>Colorforces was initially inspired by it, adding global status page rating coverage and richer customization options.</p>',
            ackHelperLinkText: 'Visit Chrome Web Store',
            ackClistTitle: 'CList',
            ackClistBadge: 'Statistics Provider',
            ackClistDesc: '<p>CList is a renowned competitive programming platform, aggregating contest schedules, and offering comprehensive contest and problem data.</p><p>Thanks to CList for providing detailed problem statistics, which Colorforces integrates to display problem ratings.</p>',
            ackClistLinkText: 'Visit CList Website',
            ackOjBetterTitle: 'OJ Better',
            ackOjBetterBadge: 'Feature Inspiration',
            ackOjBetterDesc: '<p>OJ Better is a modern online judge userscript, supporting multiple platforms, and offering UI enhancements and tools.</p><p>Thanks to OJ Better for inspiring our CList rating integration, providing valuable ideas for this feature.</p>',
            ackOjBetterLinkText: 'Visit GitHub Repository',
            ackCarrotTitle: 'Carrot-Plus',
            ackCarrotBadge: 'Integration Coming Soon',
            ackCarrotDesc: '<p>Carrot-Plus is a classic contest prediction extension, tracking live standings, and dynamically estimating rating deltas.</p><p>Colorforces plans to integrate its prediction model in upcoming updates to provide built-in rating forecasts.</p>',
            ackCarrotLinkText: 'Visit GitHub Repository'
        }
    };

    function getLangDict(lang) {
        const targetLang = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
        const dict = I18N[targetLang] || I18N['zh'] || I18N['en'] || {};
        return new Proxy(dict, {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (I18N['en'] && prop in I18N['en']) return I18N['en'][prop];
                if (I18N['zh'] && prop in I18N['zh']) return I18N['zh'][prop];
                return undefined;
            }
        });
    }

    function tGlobal(key, lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh', ...args) {
        if (!key) {
            return getLangDict(lang);
        }
        const dict = getLangDict(lang);
        const val = dict[key];
        if (typeof val === 'function') {
            return val(...args);
        }
        return val !== undefined ? val : key;
    }
    const t = tGlobal;

    function preventScrollChaining(element) {
        if (!element) return;

        // 1. Prevent middle-click (wheel button) autoscroll on background page
        const preventMiddleClick = (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        };
        element.addEventListener('mousedown', preventMiddleClick);
        element.addEventListener('auxclick', preventMiddleClick);

        // 2. Prevent mouse wheel scroll penetration to background page
        element.addEventListener('wheel', (e) => {
            let target = e.target;
            let scrollableY = null;
            let scrollableX = null;

            while (target) {
                if (target.nodeType === 1) {
                    const style = window.getComputedStyle(target);
                    if (!scrollableY && (style.overflowY === 'auto' || style.overflowY === 'scroll') && target.scrollHeight > target.clientHeight) {
                        scrollableY = target;
                    }
                    if (!scrollableX && (style.overflowX === 'auto' || style.overflowX === 'scroll') && target.scrollWidth > target.clientWidth) {
                        scrollableX = target;
                    }
                    if (scrollableY && scrollableX) break;
                }
                if (target === element) break;
                target = target.parentElement;
            }

            const deltaY = e.deltaY;
            const deltaX = e.deltaX;

            let canScrollY = false;
            if (scrollableY && deltaY !== 0) {
                const isUp = deltaY < 0;
                const isDown = deltaY > 0;
                const isAtTop = scrollableY.scrollTop <= 0;
                const isAtBottom = Math.ceil(scrollableY.scrollTop + scrollableY.clientHeight) >= scrollableY.scrollHeight - 1;
                if ((isUp && !isAtTop) || (isDown && !isAtBottom)) {
                    canScrollY = true;
                }
            }

            let canScrollX = false;
            if (scrollableX && deltaX !== 0) {
                const isLeft = deltaX < 0;
                const isRight = deltaX > 0;
                const isAtLeft = scrollableX.scrollLeft <= 0;
                const isAtRight = Math.ceil(scrollableX.scrollLeft + scrollableX.clientWidth) >= scrollableX.scrollWidth - 1;
                if ((isLeft && !isAtLeft) || (isRight && !isAtRight)) {
                    canScrollX = true;
                }
            }

            if (!canScrollY && !canScrollX) {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
    }

    function createGuideModal({ className, width = '580px', maxWidth = '92vw', iconSvg, title, bodyHtml, confirmText, btnColor = '#0284c7' }) {
        document.querySelectorAll(`.${className}`).forEach(m => m.remove());

        const overlay = document.createElement('div');
        overlay.className = `cf-clist-modal-overlay ${className}`;
        preventScrollChaining(overlay);

        const card = document.createElement('div');
        card.className = 'cf-clist-modal-card';
        card.style.width = width;
        if (maxWidth) card.style.maxWidth = maxWidth;

        card.innerHTML = `
            <div class="cf-clist-modal-header">
                <div class="cf-clist-modal-title">
                    ${iconSvg}
                    <span>${title}</span>
                </div>
                <button type="button" class="cf-modal-close-btn" style="background:none; border:none; font-size:18px; cursor:pointer; color:#64748b;">&times;</button>
            </div>
            <div class="cf-clist-modal-body">
                ${bodyHtml}
            </div>
            <div class="cf-clist-modal-footer">
                <button type="button" class="cf-clist-sync-btn cf-guide-confirm-btn" style="background:${btnColor}; color:#fff; border-color:${btnColor}; padding:6px 18px; font-weight:600;">${confirmText}</button>
            </div>
        `;

        const close = () => overlay.remove();
        card.querySelector('.cf-modal-close-btn').onclick = close;
        card.querySelector('.cf-guide-confirm-btn').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function showConfirmPop({
        title = '',
        message = '',
        note = '',
        confirmText = '',
        cancelText = '',
        type = 'danger',
        lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh',
        onConfirm = null
    } = {}) {
        document.querySelectorAll('.cf-confirm-pop-overlay').forEach(m => m.remove());

        const overlay = document.createElement('div');
        overlay.className = 'cf-confirm-pop-overlay';
        preventScrollChaining(overlay);

        const isInfo = type === 'info';
        const isWarning = type === 'warning';
        const isAlertOnly = isInfo || typeof onConfirm !== 'function';

        let iconSvg = '';
        let iconBg = '#fee2e2';
        let iconColor = '#ef4444';
        let confirmBtnBg = '#e11d48';
        let confirmBtnBorder = '#e11d48';
        let defaultConfirmText = t('popConfirmBtn', lang);

        if (isWarning) {
            iconBg = '#fef3c7';
            iconColor = '#d97706';
            confirmBtnBg = '#d97706';
            confirmBtnBorder = '#d97706';
            iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        } else if (isInfo) {
            iconBg = '#e0f2fe';
            iconColor = '#0284c7';
            confirmBtnBg = '#0284c7';
            confirmBtnBorder = '#0284c7';
            iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        } else {
            iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
        }

        let mainMsg = message || '';
        let subNote = note || '';
        if (!subNote && mainMsg.includes('\n\n')) {
            const parts = mainMsg.split('\n\n');
            mainMsg = parts[0];
            subNote = parts.slice(1).join('\n\n');
        }

        const noteBg = isWarning ? '#fffbeb' : (isInfo ? '#f0f9ff' : '#fff1f2');
        const noteBorder = isWarning ? '#fde68a' : (isInfo ? '#bae6fd' : '#fecdd3');
        const noteColor = isWarning ? '#b45309' : (isInfo ? '#0369a1' : '#9f1239');

        const noteBoxHtml = subNote ? `
            <div style="background: ${noteBg}; border: 1px solid ${noteBorder}; border-radius: 6px; padding: 7px 10px; font-size: 11.5px; color: ${noteColor}; line-height: 1.45; margin-top: 10px;">
                ${subNote.replace(/\n/g, '<br>')}
            </div>
        ` : '';

        const footerButtonsHtml = isAlertOnly ? `
            <button type="button" class="cf-confirm-btn-primary" style="background:${confirmBtnBg}; color:#fff; border:1px solid ${confirmBtnBorder}; padding:6px 18px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
                ${confirmText || t('popGotItBtn', lang)}
            </button>
        ` : `
            <button type="button" class="cf-confirm-btn-cancel" style="background:#fff; color:#475569; border:1px solid #cbd5e1; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; margin-right:8px; transition:all 0.15s ease;">
                ${cancelText || t('popCancelBtn', lang)}
            </button>
            <button type="button" class="cf-confirm-btn-primary" style="background:${confirmBtnBg}; color:#fff; border:1px solid ${confirmBtnBorder}; padding:6px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s ease;">
                ${confirmText || defaultConfirmText}
            </button>
        `;

        const card = document.createElement('div');
        card.className = 'cf-confirm-pop-card';
        card.innerHTML = `
            <div style="display: flex; gap: 14px; align-items: flex-start; padding: 18px 20px 14px 20px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${iconSvg}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 5px; line-height: 1.3;">
                        ${title}
                    </div>
                    <div style="font-size: 12.5px; color: #475569; line-height: 1.5; word-break: break-word;">
                        ${mainMsg.replace(/\n/g, '<br>')}
                    </div>
                    ${noteBoxHtml}
                </div>
            </div>
            <div style="padding: 10px 18px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; align-items: center; border-radius: 0 0 12px 12px;">
                ${footerButtonsHtml}
            </div>
        `;

        const close = () => {
            window.removeEventListener('keydown', handleKeydown);
            overlay.remove();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', handleKeydown);

        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        const cancelBtn = card.querySelector('.cf-confirm-btn-cancel');
        if (cancelBtn) cancelBtn.onclick = close;

        const primaryBtn = card.querySelector('.cf-confirm-btn-primary');
        if (primaryBtn) {
            primaryBtn.onclick = () => {
                close();
                if (typeof onConfirm === 'function') onConfirm();
            };
        }

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function showClistKeyGuideModal(lang) {
        createGuideModal({
            className: 'cf-clist-guide-modal',
            width: '620px',
            iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            title: t('guideModalTitle', lang),
            confirmText: t('guideConfirmBtn', lang),
            bodyHtml: `
                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:4px;">${t('guideStep1Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep1Desc', lang)} <a href="https://clist.by/" target="_blank" style="color:#0284c7; text-decoration:none; font-weight:500;">https://clist.by/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:4px;">${t('guideStep2Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep2Desc', lang)} <a href="https://clist.by/api/v4/doc/" target="_blank" style="color:#0284c7; text-decoration:none; font-weight:500;">https://clist.by/api/v4/doc/</a></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:4px;">${t('guideStep3Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep3Desc', lang)}</div>
                    <div class="cf-clist-mock-panel" style="margin: 6px 0; background:#f8fafc; font-style:italic; color:#334155; font-size:12.5px;">
                        "Accessing the API requires an API key, available to authenticated users <span style="color:#0284c7; font-weight:bold; text-decoration:underline;">here</span>."
                    </div>
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:8px 12px; font-size:12px; color:#b45309; line-height:1.5;">
                        <strong>${t('guideNoteLabel', lang)}</strong> ${t('guideStep3Note', lang)}
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:4px;">${t('guideStep4Title', lang)}</div>
                    <div style="color:#64748b;">${t('guideStep4Desc', lang)}</div>

                    <div class="cf-clist-popover-demo">
                        <div style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px;">Request header:</div>
                        <div class="cf-clist-code-block" style="margin:0;">Authorization: ApiKey YourUsername:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b</div>
                    </div>

                    <div style="font-size:12px; color:#475569; margin-top:8px; line-height:1.5;">
                        <strong>${t('guideNoticeLabel', lang)}</strong> ${t('guideStep4Notice', lang)}
                    </div>
                </div>
            `
        });
    }

    function showClistSyncSpecModal(lang) {
        createGuideModal({
            className: 'cf-clist-spec-modal',
            width: '580px',
            iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            title: t('specModalTitle', lang),
            confirmText: t('specConfirmBtn', lang),
            bodyHtml: `
                <div class="cf-clist-mock-panel" style="margin-top:0;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:6px;">${t('specRateLimitTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specRateLimitLabel', lang)}</strong>${t('specRateLimitDesc', lang)}<br>
                        • <strong>${t('specPageLimitLabel', lang)}</strong>${t('specPageLimitDesc', lang)}
                    </div>
                </div>

                <div class="cf-clist-mock-panel">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:6px;">${t('specBatchStrategyTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specDatasetLabel', lang)}</strong>${t('specDatasetDesc', lang)}<br>
                        • <strong>${t('specPacemakerLabel', lang)}</strong>${t('specPacemakerDesc', lang)}<br>
                        • <strong>${t('specProgressLabel', lang)}</strong>${t('specProgressDesc', lang)}
                    </div>
                </div>

                <div class="cf-clist-mock-panel" style="margin-bottom:0;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:6px;">${t('specCooldownTitle', lang)}</div>
                    <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                        • <strong>${t('specCooldownLabel', lang)}</strong>${t('specCooldownDesc', lang)}<br>
                        • <strong>${t('specErrorCooldownLabel', lang)}</strong>${t('specErrorCooldownDesc', lang)}
                    </div>
                </div>
            `
        });
    }

    function showTimeFormatGuideModal(lang) {
        const l = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
        const badge = (tok) => `<code style="display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 1.5px 6px; line-height: 1.3; box-shadow: 0 1px 1px rgba(2, 132, 199, 0.06); letter-spacing: 0.2px;">${tok}</code>`;
        const slash = `<span style="color: #94a3b8; font-size: 11px; margin: 0 3px; user-select: none;">/</span>`;
        const pair = (a, b) => `${badge(a)}${slash}${badge(b)}`;

        createGuideModal({
            className: 'cf-time-guide-modal',
            width: '620px',
            maxWidth: '95vw',
            iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
            title: t('timeGuideModalTitle', l),
            confirmText: t('timeGuideCloseBtn', l),
            btnColor: '#0284c7',
            bodyHtml: `
                <div style="margin-bottom: 14px;">
                    <div style="font-weight:600; color:#1e293b; margin-bottom:8px; font-size: 13px; display:flex; align-items:center; gap:6px;">
                        <span>🔤</span><span>${t('timeGuideSectionTokens', l)}</span>
                    </div>
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600; width: 140px;">${t('timeGuideColToken', l)}</th>
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600;">${t('timeGuideColMeaning', l)}</th>
                                    <th style="padding: 7px 12px; text-align: left; font-weight: 600; width: 140px;">${t('timeGuideColExample', l)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('YYYY')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenYear4', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">2026</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('YY')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenYear2', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">26</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('MM', 'M')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMonth', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">09<span style="color: #94a3b8; margin: 0 3px;">/</span>9</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('DD', 'D')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenDay', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">06<span style="color: #94a3b8; margin: 0 3px;">/</span>6</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('HH', 'H')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenHour24', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">14<span style="color: #94a3b8; margin: 0 3px;">/</span>14</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('hh', 'h')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenHour12', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">02<span style="color: #94a3b8; margin: 0 3px;">/</span>2</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('mm', 'm')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMinute', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">05<span style="color: #94a3b8; margin: 0 3px;">/</span>5</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('ss', 's')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenSecond', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">08<span style="color: #94a3b8; margin: 0 3px;">/</span>8</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('A', 'a')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenAmPm', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">PM<span style="color: #94a3b8; margin: 0 3px;">/</span>pm</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('dddd', 'ddd')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenWeekday', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">Sunday<span style="color: #94a3b8; margin: 0 3px;">/</span>Sun</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 6px 12px; white-space: nowrap;">${pair('MMMM', 'MMM')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenMonthName', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #475569;">September<span style="color: #94a3b8; margin: 0 3px;">/</span>Sep</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 12px; white-space: nowrap;">${badge('[...]')}</td>
                                    <td style="padding: 6px 12px; color: #334155;">${t('tokenEscape', l)}</td>
                                    <td style="padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #64748b;">${t('tokenEscapeExample', l)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <div style="font-weight:600; color:#1e293b; margin-bottom:8px; font-size: 13px; display:flex; align-items:center; gap:6px;">
                        <span>💡</span><span>${t('timeGuideSectionExamples', l)}</span>
                    </div>
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YY/MM/DD HH:mm')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">26/09/06 14:30</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YYYY-MM-DD HH:mm:ss')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">2026-09-06 14:30:08</td>
                                </tr>
                                <tr>
                                    <td style="padding: 7px 12px; width: 210px; white-space: nowrap;">${badge('YYYY/M/D h:mm A')}</td>
                                    <td style="padding: 7px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #334155; font-weight: 500;">2026/9/6 2:30 PM</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `
        });
    }

    function showVerdictGuideModal(lang) {
        const l = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
        createGuideModal({
            className: 'cf-verdict-guide-modal',
            width: '680px',
            maxWidth: '96vw',
            iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            title: t('verdictGuideModalTitle', l),
            confirmText: t('verdictGuideCloseBtn', l),
            btnColor: '#10b981',
            bodyHtml: `
                <div style="margin-bottom: 12px; font-size: 13px; color: #475569; line-height: 1.5;">
                    ${t('verdictGuideDesc', l)}
                </div>

                <div style="margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColStatus', l)}</th>
                                <th style="padding: 7px 10px; text-align: center; font-weight: 600;">${t('verdictGuideColAbbr', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColMeaning', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColRaw', l)}</th>
                                <th style="padding: 7px 10px; text-align: left; font-weight: 600;">${t('verdictGuideColExample', l)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Accepted</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">AC</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictAcMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #00aa00; font-weight: bold;">Accepted</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #00aa00; font-weight: bold;">AC</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Wrong answer</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #fee2e2; color: #b91c1c; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">WA</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictWaMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Wrong answer on test 3</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>WA</b> on test 3</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Time limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #ffedd5; color: #c2410c; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">TLE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictTleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Time limit exceeded on test 5</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>TLE</b> on test 5</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Memory limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #fef3c7; color: #b45309; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">MLE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictMleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Memory limit exceeded on test 2</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>MLE</b> on test 2</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Runtime error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #f3e8ff; color: #7e22ce; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">RE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictReMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Runtime error on test 1</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>RE</b> on test 1</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Compilation error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #f1f5f9; color: #475569; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">CE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictCeMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;">Compilation error</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;"><b>CE</b></span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Idleness limit exceeded</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #e0e7ff; color: #4338ca; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">ILE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictIleMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Idleness limit exceeded on test 4</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>ILE</b> on test 4</span></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9; background: #fbfcfe;">
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Presentation error</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #e0f2fe; color: #0369a1; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">PE</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictPeMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;">Presentation error on test 1</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #0000aa;"><b>PE</b> on test 1</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 10px; font-weight: 500; color: #334155;">Skipped</td>
                                <td style="padding: 6px 10px; text-align: center;"><code style="background: #f1f5f9; color: #64748b; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11.5px;">SK</code></td>
                                <td style="padding: 6px 10px; color: #475569;">${t('verdictSkMeaning', l)}</td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;">Skipped</span></td>
                                <td style="padding: 6px 10px;"><span style="color: #000000;"><b>SK</b></span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #475569; line-height: 1.5;">
                    <strong style="color: #0f172a;">${t('verdictGuideTipTitle', l)}</strong> ${t('verdictGuideTipDesc', l)}
                </div>
            `
        });
    }

    let activeSyncModalInstance = null;

    function showClistSyncProgressModal(lang) {
        if (activeSyncModalInstance) {
            if (lang) activeSyncModalInstance.updateLanguage(lang);
            activeSyncModalInstance.show();
            return activeSyncModalInstance;
        }

        let currentLang = lang || (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
        let currentStatusType = 'connecting';
        let currentStatusData = {};
        let currentPercent = 0;
        let currentPulled = 0;
        let currentTotal = 11614;
        let currentEtaSec = 96;
        let currentSuccessCount = 0;
        let currentErrorMsg = '';
        let currentRetryCallback = null;

        const overlay = document.createElement('div');
        overlay.className = 'cf-clist-modal-overlay cf-clist-progress-modal';
        preventScrollChaining(overlay);

        const card = document.createElement('div');
        card.className = 'cf-clist-modal-card';
        card.style.width = '520px';

        card.innerHTML = `
            <div class="cf-clist-modal-header">
                <div class="cf-clist-modal-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span class="cf-progress-modal-title"></span>
                </div>
                <button type="button" class="cf-modal-close-btn" style="background:none; border:none; font-size:18px; cursor:pointer; color:#64748b;">&times;</button>
            </div>
            <div class="cf-clist-modal-body">
                <div class="cf-progress-status" style="font-size: 13px; font-weight: 500; color: #1e293b; margin-bottom: 8px;">
                </div>

                <div class="cf-clist-progress-track">
                    <div class="cf-clist-progress-fill" style="width: 0%;"></div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #64748b; margin-top: 6px;">
                    <div><span class="cf-label-pulled"></span>: <strong class="cf-val-pulled" style="color:#0f172a;">0</strong> / <span class="cf-val-total"></span></div>
                    <div><span class="cf-label-eta"></span>: <strong class="cf-val-eta" style="color:#0f172a;"></strong></div>
                </div>

                <div class="cf-progress-tip" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #1d4ed8; margin-top: 14px; line-height: 1.5;">
                </div>

                <div class="cf-progress-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #b91c1c; margin-top: 12px; line-height: 1.5;"></div>
            </div>
            <div class="cf-clist-modal-footer" style="gap: 8px;">
                <button type="button" class="cf-clist-sync-btn cf-btn-bg" style="font-size: 12px;"></button>
                <button type="button" class="cf-clist-sync-btn cf-btn-action" style="display: none; background: #3b82f6; color: #fff; border-color: #3b82f6; font-weight: 600;"></button>
            </div>
        `;

        const titleEl = card.querySelector('.cf-progress-modal-title');
        const statusEl = card.querySelector('.cf-progress-status');
        const fillEl = card.querySelector('.cf-clist-progress-fill');
        const labelPulledEl = card.querySelector('.cf-label-pulled');
        const pulledEl = card.querySelector('.cf-val-pulled');
        const totalEl = card.querySelector('.cf-val-total');
        const labelEtaEl = card.querySelector('.cf-label-eta');
        const etaEl = card.querySelector('.cf-val-eta');
        const errorEl = card.querySelector('.cf-progress-error');
        const tipEl = card.querySelector('.cf-progress-tip');
        const btnBg = card.querySelector('.cf-btn-bg');
        const btnAction = card.querySelector('.cf-btn-action');
        const closeBtn = card.querySelector('.cf-modal-close-btn');

        const refreshModalTexts = () => {
            const l = currentLang;
            if (titleEl) titleEl.textContent = t('syncModalTitle', l);
            if (closeBtn) closeBtn.title = t('syncBtnBackground', l);
            if (labelPulledEl) labelPulledEl.textContent = t('syncLabelPulled', l);
            if (labelEtaEl) labelEtaEl.textContent = t('syncLabelEta', l);
            if (tipEl) tipEl.textContent = t('syncNoticeTip', l);
            if (totalEl) totalEl.textContent = t('syncApproxCount', l, currentTotal.toLocaleString());

            // Format ETA
            if (etaEl) {
                if (currentStatusType === 'success') {
                    etaEl.textContent = t('syncStatusFinished', l);
                } else if (currentStatusType === 'rate_limited') {
                    etaEl.textContent = t('syncRateLimitedEta', l, currentStatusData.seconds || 0);
                } else if (currentEtaSec > 0) {
                    const min = Math.floor(currentEtaSec / 60);
                    const sec = currentEtaSec % 60;
                    etaEl.textContent = min > 0 ? t('syncEtaMinutesSeconds', l, min, sec) : t('syncEtaSeconds', l, sec);
                } else {
                    etaEl.textContent = '';
                }
            }

            // Format Status
            if (statusEl) {
                if (currentStatusType === 'connecting') {
                    statusEl.textContent = t('syncInitConnecting', l);
                } else if (currentStatusType === 'fetching') {
                    statusEl.textContent = t('syncStatusFetching', l, currentPulled, currentTotal, currentStatusData.page || 1, currentStatusData.totalPages || 3);
                } else if (currentStatusType === 'waiting') {
                    statusEl.textContent = t('syncWaitIntervalStatus', l, currentStatusData.seconds || 8);
                } else if (currentStatusType === 'rate_limited') {
                    statusEl.textContent = t('syncRateLimitedStatus', l, currentStatusData.seconds || 60);
                } else if (currentStatusType === 'success') {
                    statusEl.innerHTML = `<span style="color:#16a34a; font-weight:600;">✓ ${t('syncStatusSuccess', l, currentSuccessCount)}</span>`;
                } else if (currentStatusType === 'error') {
                    statusEl.innerHTML = `<span style="color:#dc2626; font-weight:600;">✗ ${t('syncStatusInterrupted', l)}</span>`;
                } else if (currentStatusData.rawStatus) {
                    statusEl.textContent = currentStatusData.rawStatus;
                }
            }

            // Buttons
            if (currentStatusType === 'success') {
                btnBg.style.display = 'none';
                btnAction.style.display = 'inline-flex';
                btnAction.textContent = t('syncBtnDone', l);
            } else if (currentStatusType === 'error') {
                btnBg.style.display = 'inline-flex';
                btnBg.textContent = t('syncBtnClose', l);
                if (currentRetryCallback) {
                    btnAction.style.display = 'inline-flex';
                    btnAction.textContent = t('syncBtnRetry', l);
                } else {
                    btnAction.style.display = 'none';
                }
            } else {
                btnBg.style.display = 'inline-flex';
                btnBg.textContent = t('syncBtnBackground', l);
                btnAction.style.display = 'none';
            }
        };

        const hideModal = () => {
            overlay.style.display = 'none';
        };

        const destroyModal = () => {
            overlay.remove();
            activeSyncModalInstance = null;
        };

        btnBg.onclick = hideModal;
        closeBtn.onclick = hideModal;

        refreshModalTexts();

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const instance = {
            show: () => {
                if (appSettings && appSettings.lang && appSettings.lang !== currentLang) {
                    currentLang = appSettings.lang;
                    refreshModalTexts();
                }
                overlay.style.display = 'flex';
            },
            hide: hideModal,
            destroy: destroyModal,
            getEtaText: () => etaEl ? etaEl.textContent : '',
            updateLanguage: (newLang) => {
                currentLang = newLang || (appSettings && appSettings.lang) || 'zh';
                refreshModalTexts();
            },
            update: (info) => {
                if (appSettings && appSettings.lang && appSettings.lang !== currentLang) {
                    currentLang = appSettings.lang;
                }
                if (info.statusType) {
                    currentStatusType = info.statusType;
                    currentStatusData = info.statusData || {};
                } else if (info.status) {
                    currentStatusType = 'custom';
                    currentStatusData = { rawStatus: info.status };
                }
                if (info.etaSeconds !== undefined) {
                    currentEtaSec = info.etaSeconds;
                } else if (info.eta) {
                    currentStatusData.rawEta = info.eta;
                }
                if (info.percent !== undefined) {
                    currentPercent = Math.min(100, Math.max(0, info.percent));
                    fillEl.style.width = `${currentPercent}%`;
                }
                if (info.pulled !== undefined) {
                    currentPulled = info.pulled;
                    pulledEl.textContent = currentPulled.toLocaleString();
                }
                if (info.total !== undefined) {
                    currentTotal = info.total;
                }
                refreshModalTexts();
            },
            setSuccess: (count) => {
                if (appSettings && appSettings.lang && appSettings.lang !== currentLang) {
                    currentLang = appSettings.lang;
                }
                currentStatusType = 'success';
                currentSuccessCount = count;
                fillEl.style.width = '100%';
                fillEl.style.background = '#16a34a';
                tipEl.style.display = 'none';
                btnAction.onclick = destroyModal;
                refreshModalTexts();
            },
            setError: (msg, retryCallback) => {
                if (appSettings && appSettings.lang && appSettings.lang !== currentLang) {
                    currentLang = appSettings.lang;
                }
                currentStatusType = 'error';
                currentErrorMsg = msg;
                currentRetryCallback = retryCallback;
                errorEl.style.display = 'block';
                errorEl.textContent = msg;
                tipEl.style.display = 'none';
                btnBg.onclick = destroyModal;
                if (retryCallback) {
                    btnAction.onclick = () => {
                        errorEl.style.display = 'none';
                        tipEl.style.display = 'block';
                        currentStatusType = 'connecting';
                        currentRetryCallback = null;
                        refreshModalTexts();
                        retryCallback();
                    };
                }
                refreshModalTexts();
            }
        };

        activeSyncModalInstance = instance;
        return instance;
    }

    // Cross-origin request wrapper for Clist API (supporting GM_xmlhttpRequest for session cookies)
    function clistRequest(url, headers = {}) {
        return new Promise((resolve, reject) => {
            const gmXhr = (typeof GM_xmlhttpRequest === 'function')
                ? GM_xmlhttpRequest
                : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);

            if (gmXhr) {
                gmXhr({
                    method: 'GET',
                    url: url,
                    headers: headers,
                    withCredentials: true,
                    onload: (response) => {
                        resolve({
                            ok: response.status >= 200 && response.status < 300,
                            status: response.status,
                            statusText: response.statusText,
                            json: () => Promise.resolve(JSON.parse(response.responseText)),
                            text: () => Promise.resolve(response.responseText)
                        });
                    },
                    onerror: (err) => {
                        reject(new Error(err && err.error ? err.error : 'Network error (GM_xmlhttpRequest)'));
                    },
                    ontimeout: () => {
                        reject(new Error('Request timeout'));
                    }
                });
            } else {
                fetch(url, { headers, credentials: 'include' })
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }
        });
    }

    let isClistSyncing = false;
    let currentClistSyncProgress = null;
    const clistSyncListeners = new Set();

    function notifyClistSyncProgress(progress) {
        currentClistSyncProgress = progress;
        clistSyncListeners.forEach(listener => {
            try { listener(progress); } catch (e) { }
        });
    }

    async function syncClistRatings(tFunc, onStatusChange) {
        if (isClistSyncing) {
            if (activeSyncModalInstance) activeSyncModalInstance.show();
            return;
        }

        const getLang = () => (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';

        const cooldownRemaining = getClistCooldownRemaining();
        if (cooldownRemaining > 0) {
            // Disabled in cooldown: silent return, no alert prompt
            return;
        }

        const authMode = (appSettings.clist && appSettings.clist.authMode) || (appSettings.clist && appSettings.clist.apiKey ? 'api' : 'cookie');
        const rawKey = (appSettings.clist && appSettings.clist.apiKey) || '';

        if (authMode === 'api' && !rawKey) {
            const l = getLang();
            showConfirmPop({
                title: t('clistSyncTitle', l),
                type: 'warning',
                message: t('syncNeedApiKey', l),
                note: t('syncApiKeyMissingNote', l),
                confirmText: t('popGotItBtn', l),
                lang: l
            });
            return;
        }

        const normalizedKey = (authMode === 'api' && rawKey) ? normalizeClistApiKey(rawKey) : '';

        isClistSyncing = true;
        let modal = showClistSyncProgressModal(getLang());

        const updateProgress = (info) => {
            modal.update(info);
            notifyClistSyncProgress({
                percent: info.percent,
                pulled: info.pulled,
                total: info.total,
                eta: modal.getEtaText ? modal.getEtaText() : ''
            });
        };

        const limit = 1000;
        let offset = 0;
        let totalContests = 2150;
        let estimatedTotalProblems = 13500;
        const problemMap = {};
        let page = 1;
        let uniqueProblemsPulled = 0;

        const initialTotalPages = Math.max(1, Math.ceil(totalContests / limit));
        const initialEtaSec = Math.max(8, initialTotalPages * 8);
        updateProgress({ statusType: 'connecting', etaSeconds: initialEtaSec, percent: 0, pulled: 0, total: estimatedTotalProblems });

        const executeSync = async () => {
            try {
                while (true) {
                    const totalPages = Math.max(1, Math.ceil(totalContests / limit));
                    const remainingPagesEstimate = Math.max(1, Math.ceil((totalContests - offset) / limit));
                    const currentEtaSec = Math.max(8, remainingPagesEstimate * 8);

                    updateProgress({
                        statusType: 'fetching',
                        statusData: { page, totalPages },
                        etaSeconds: currentEtaSec,
                        percent: Math.min(96, Math.round((offset / totalContests) * 100)),
                        pulled: uniqueProblemsPulled,
                        total: Math.max(uniqueProblemsPulled, estimatedTotalProblems)
                    });

                    const headers = {};
                    if (normalizedKey) {
                        headers['Authorization'] = normalizedKey;
                    }

                    const url = `https://clist.by/api/v4/contest/?resource=codeforces.com&limit=${limit}&offset=${offset}&with_problems=true&total_count=true`;
                    let res;
                    try {
                        res = await clistRequest(url, headers);
                    } catch (netErr) {
                        throw new Error(t('syncNetworkError', getLang()));
                    }

                    if (res.status === 401 || res.status === 403) {
                        if (authMode === 'api') {
                            throw new Error(t('syncApiKeyInvalid', getLang()));
                        } else {
                            throw new Error(t('syncLoginRequired', getLang()));
                        }
                    }
                    if (res.status === 429) {
                        for (let s = 60; s > 0; s--) {
                            updateProgress({
                                statusType: 'rate_limited',
                                statusData: { seconds: s }
                            });
                            await new Promise(r => setTimeout(r, 1000));
                        }
                        continue;
                    }
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }

                    const data = await res.json();

                    if (data.meta && typeof data.meta.total_count === 'number') {
                        totalContests = data.meta.total_count;
                        estimatedTotalProblems = Math.max(estimatedTotalProblems, Math.round(totalContests * 6.3));
                    }

                    const contests = data.objects || [];
                    for (const c of contests) {
                        if (!c.problems || !Array.isArray(c.problems)) continue;
                        for (const p of c.problems) {
                            let contestId = null;
                            let index = '';
                            let key = '';

                            if (p.url) {
                                const match = p.url.match(/(?:contest|gym|problemset\/problem)\/(\d+)(?:\/problem)?\/([a-zA-Z0-9_]+)/i);
                                if (match) {
                                    contestId = parseInt(match[1], 10);
                                    index = match[2].toUpperCase();
                                    key = `${match[1]}${match[2]}`.toUpperCase();
                                }
                            }
                            if (!key && c.href && p.short) {
                                const matchC = c.href.match(/(?:contest|contests|gym)\/(\d+)/i);
                                if (matchC) {
                                    contestId = parseInt(matchC[1], 10);
                                    index = p.short.toUpperCase();
                                    key = `${matchC[1]}${p.short}`.toUpperCase();
                                }
                            }
                            if (key) {
                                const item = {
                                    contestId: isNaN(contestId) ? contestId : contestId,
                                    index: index,
                                    name: p.name || '',
                                    rating: typeof p.rating === 'number' ? p.rating : null,
                                    n_accepted: p.n_accepted || 0,
                                    n_total: p.n_total || p.n_teams || 0,
                                    id: p.id || p.code || key
                                };
                                if (!problemMap[key]) {
                                    uniqueProblemsPulled++;
                                }
                                problemMap[key] = item;

                                if (p.code && typeof p.code === 'string') {
                                    const altKey = p.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                    if (altKey && !problemMap[altKey]) {
                                        uniqueProblemsPulled++;
                                        problemMap[altKey] = item;
                                    }
                                }
                            }
                        }
                    }

                    updateProgress({
                        pulled: uniqueProblemsPulled,
                        total: Math.max(uniqueProblemsPulled, estimatedTotalProblems),
                        percent: Math.min(99, Math.round(((offset + contests.length) / totalContests) * 100))
                    });

                    if (!data.meta || !data.meta.next || contests.length < limit) {
                        break;
                    }

                    offset += contests.length;
                    page++;

                    // 8-second pacemaker interval between requests
                    const remainingPages = Math.max(1, Math.ceil((totalContests - offset) / limit));
                    for (let s = 8; s > 0; s--) {
                        const totalRemainingSec = (remainingPages - 1) * 8 + s;
                        updateProgress({
                            statusType: 'waiting',
                            statusData: { seconds: s },
                            etaSeconds: totalRemainingSec,
                            percent: Math.min(98, Math.round((offset / totalContests) * 100)),
                            pulled: uniqueProblemsPulled,
                            total: Math.max(uniqueProblemsPulled, estimatedTotalProblems)
                        });
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                // 100% COMPLETE SUCCESS
                const sortedProblemMap = sortProblemKeys(problemMap);
                const finalCount = Object.keys(sortedProblemMap).length;
                setClistProblems(sortedProblemMap);

                const now = Date.now();
                appStorage.setItem(CLIST_LAST_SYNC_KEY, String(now));
                if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
                appSettings.clist.lastSyncTime = now;
                saveSettings(appSettings);

                modal.setSuccess(finalCount);

                if (onStatusChange) onStatusChange();

                // Dynamically re-evaluate ratings on the entire page
                refreshRatingsOnPage();
            } catch (err) {
                console.error('Colorforces: Clist sync error', err);
                modal.setError(err.message || String(err), () => {
                    executeSync();
                });
            } finally {
                isClistSyncing = false;
                notifyClistSyncProgress(null);
                if (onStatusChange) onStatusChange();
            }
        };

        executeSync();
    }

    // Fetch ratings from CF API or appStorage cache
    async function getRatings() {
        const cached = appStorage.getJSON(CACHE_KEY, null);
        const cachedTimeStr = appStorage.getItem(CACHE_TIME_KEY);
        const cachedTime = cachedTimeStr ? parseInt(cachedTimeStr, 10) : 0;
        const now = Date.now();

        // Check if cached data already contains the 'name' field and parallel contest data exists
        const sampleKey = cached ? Object.keys(cached)[0] : null;
        const hasNameField = sampleKey && cached[sampleKey] && typeof cached[sampleKey].name === 'string';
        const hasParallelContests = !!appStorage.getItem(PARALLEL_CONTESTS_KEY);

        // Use cache if it's fresh and has required name and parallel contest fields
        if (cached && cachedTime && (now - cachedTime < CACHE_EXPIRY) && hasNameField && hasParallelContests) {
            // Auto-clean any legacy 'NAME:' keys from old cache
            let hasDirty = false;
            const cleaned = {};
            for (const k in cached) {
                if (k.startsWith('NAME:')) {
                    hasDirty = true;
                } else {
                    cleaned[k] = cached[k];
                }
            }
            if (hasDirty) {
                const sortedCleaned = sortProblemKeys(cleaned);
                appStorage.setJSON(CACHE_KEY, sortedCleaned);
                latestRatingsMap = sortedCleaned;
                getParallelContests();
                return sortedCleaned;
            }
            latestRatingsMap = cached;
            getParallelContests();
            return cached;
        }

        // Fetch new ratings: Request 1 (contest.list) & Request 2 (problemset.problems)
        try {
            console.log('Codeforces Rating Helper: Fetching contest list and problem ratings...');
            const [contestListRes, problemsRes] = await Promise.all([
                fetch('https://codeforces.com/api/contest.list?gym=false').catch(e => {
                    console.warn('Codeforces Rating Helper: Failed to fetch contest.list', e);
                    return null;
                }),
                fetch('https://codeforces.com/api/problemset.problems').catch(e => {
                    console.warn('Codeforces Rating Helper: Failed to fetch problemset.problems', e);
                    return null;
                })
            ]);

            // 1. Process Request 1: Group concurrent contests by startTimeSeconds
            if (contestListRes && contestListRes.ok) {
                try {
                    const contestData = await contestListRes.json();
                    if (contestData.status === 'OK' && Array.isArray(contestData.result)) {
                        const byTime = {};
                        for (const c of contestData.result) {
                            if (c && c.id && c.startTimeSeconds) {
                                if (!byTime[c.startTimeSeconds]) {
                                    byTime[c.startTimeSeconds] = [];
                                }
                                byTime[c.startTimeSeconds].push(c.id);
                            }
                        }
                        const parallelGroups = Object.values(byTime)
                            .filter(g => g.length > 1)
                            .map(g => g.sort((a, b) => a - b))
                            .sort((a, b) => a[0] - b[0]);

                        appStorage.setJSON(PARALLEL_CONTESTS_KEY, parallelGroups);
                        parallelContestsCache = parallelGroups;
                        buildParallelContestLookup(parallelGroups);
                        console.log(`Codeforces Rating Helper: Grouped ${parallelGroups.length} parallel contest sets.`);
                    }
                } catch (cErr) {
                    console.warn('Codeforces Rating Helper: Error parsing contest.list', cErr);
                }
            } else {
                getParallelContests();
            }

            // 2. Process Request 2: Problemset problems and statistics
            if (problemsRes && problemsRes.ok) {
                const data = await problemsRes.json();
                if (data.status === 'OK' && data.result) {
                    const statsMap = {};
                    if (Array.isArray(data.result.problemStatistics)) {
                        for (const s of data.result.problemStatistics) {
                            if (s && s.contestId && s.index) {
                                statsMap[`${s.contestId}${s.index}`.toUpperCase()] = s.solvedCount || 0;
                            }
                        }
                    }

                    // Preserve existing cached items so dynamically matched parallel items are retained
                    const ratingsMap = Object.assign({}, cached || {});
                    if (Array.isArray(data.result.problems)) {
                        for (const p of data.result.problems) {
                            if (!p || !p.contestId || !p.index) continue;
                            const key = `${p.contestId}${p.index}`.toUpperCase();
                            ratingsMap[key] = {
                                name: p.name || '',
                                rating: typeof p.rating === 'number' ? p.rating : null,
                                tags: Array.isArray(p.tags) ? p.tags : [],
                                solvedCount: statsMap[key] || 0
                            };
                        }
                    }

                    // Save to appStorage sorted by key
                    const sortedRatingsMap = sortProblemKeys(ratingsMap);
                    appStorage.setJSON(CACHE_KEY, sortedRatingsMap);
                    appStorage.setItem(CACHE_TIME_KEY, String(now));
                    latestRatingsMap = sortedRatingsMap;
                    invalidateContestProblemsIndex();

                    console.log('Codeforces Rating Helper: Ratings and problem names fetched and cached successfully.');
                    return sortedRatingsMap;
                } else {
                    console.error('Codeforces Rating Helper: API returned status', data ? data.status : 'unknown');
                }
            }
        } catch (e) {
            console.error('Codeforces Rating Helper: Failed to fetch ratings API', e);
        }

        // Fallback to cached if fetch failed but we have something
        if (cached) {
            latestRatingsMap = cached;
            getParallelContests();
            return cached;
        }

        return {};
    }

    function unformatTeamCell(cell) {
        if (cell.hasAttribute('data-original-html')) {
            cell.innerHTML = cell.getAttribute('data-original-html');
        }
        cell.classList.remove('cf-team-formatted');
        cell.classList.add('cf-team-unformatted');
        cell.style.removeProperty('padding-top');
        cell.style.removeProperty('padding-bottom');
        cell.style.setProperty('word-break', 'break-word', 'important');
    }

    function formatStandingsCells() {
        if (!appSettings.show.userAvatar) return;
        const formatTeams = appSettings.show.formatTeams !== false;
        const cells = document.querySelectorAll(`
            table.standings .contestant-cell:not(.cf-avatar-processed-cell),
            .status-party-cell:not(.cf-avatar-processed-cell)
        `);
        cells.forEach(cell => {
            cell.classList.add('cf-avatar-processed-cell');

            if (!cell.hasAttribute('data-original-html')) {
                cell.setAttribute('data-original-html', cell.innerHTML);
            }

            const ghostImg = cell.querySelector('img[src*="ghost.png"]');
            if (ghostImg) {
                if (!formatTeams) {
                    unformatTeamCell(cell);
                    return;
                }
                const span = cell.querySelector('span[title="Ghost participant"]');
                if (span) {
                    cell.classList.remove('cf-team-unformatted');
                    cell.classList.add('cf-team-formatted');
                    const text = span.textContent.trim();
                    let school = '', team = '', members = '';

                    if (text.includes(': ')) {
                        // Pattern: School: Team (Members) or School: Team
                        const parts = text.split(': ');
                        school = parts[0].trim();
                        let rest = parts.slice(1).join(': ').trim();
                        const parenMatch = rest.match(/^(.*?)\s*\((.*?)\)$/);
                        if (parenMatch) {
                            team = parenMatch[1].trim();
                            members = parenMatch[2].trim();
                        } else {
                            team = rest;
                        }
                    } else if (text.includes(' - ') && text.split(' - ').length >= 3) {
                        // Pattern: School - Team - Members
                        const parts = text.split(' - ');
                        school = parts[0].trim();
                        team = parts[1].trim();
                        members = parts.slice(2).join(' - ').trim();
                    } else if (text.includes(' - ') && text.split(' - ').length === 2) {
                        // Pattern: School - Team
                        const parts = text.split(' - ');
                        school = parts[0].trim();
                        team = parts[1].trim();
                    } else if (text.match(/^(.*?)\s*\((.*?)\)$/)) {
                        // Pattern: Team (School)
                        const match = text.match(/^(.*?)\s*\((.*?)\)$/);
                        team = match[1].trim();
                        school = match[2].trim();
                    } else {
                        // Fallback
                        team = text;
                    }

                    cell.innerHTML = '';

                    const size = appSettings.avatarSize || 1.6;
                    ghostImg.style.cssText = `width: ${size}em; height: ${size}em; vertical-align: middle; margin-right: 4px; display: inline-block; object-fit: cover;`;

                    const teamHeader = document.createElement('div');
                    teamHeader.className = 'cf-team-header';
                    teamHeader.style.cssText = 'margin-bottom: 6px; line-height: 1.4;';

                    if (school) {
                        const schoolLine = document.createElement('div');
                        schoolLine.style.cssText = 'word-break: break-word; margin-bottom: 2px; display: inline-block;';
                        schoolLine.appendChild(ghostImg);
                        const schoolSpan = document.createElement('span');
                        schoolSpan.style.cssText = 'font-weight: bold; color: #777; margin-left: 4px; vertical-align: middle;';
                        schoolSpan.textContent = school;
                        schoolLine.appendChild(schoolSpan);
                        teamHeader.appendChild(schoolLine);
                    } else {
                        const ghostLine = document.createElement('div');
                        ghostLine.style.cssText = 'word-break: break-word; margin-bottom: 2px; display: inline-block;';
                        ghostLine.appendChild(ghostImg);
                        teamHeader.appendChild(ghostLine);
                    }

                    if (team) {
                        const teamLine = document.createElement('div');
                        teamLine.style.cssText = 'word-break: break-word; font-weight: bold; margin-bottom: 8px; margin-left: 2px; font-size: 13px;';
                        teamLine.textContent = team;
                        teamHeader.appendChild(teamLine);
                    }

                    cell.appendChild(teamHeader);

                    if (members) {
                        const memberNames = members.split(',').map(m => m.trim());
                        const membersContainer = document.createElement('div');
                        membersContainer.className = 'cf-team-members';
                        membersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';
                        memberNames.forEach(name => {
                            const memberLine = document.createElement('div');
                            memberLine.className = 'cf-member-line';
                            memberLine.style.cssText = 'white-space: nowrap; color: #888; font-size: 11px; display: flex; align-items: center;';
                            memberLine.textContent = name;
                            membersContainer.appendChild(memberLine);
                        });
                        cell.appendChild(membersContainer);
                    }
                }
                return;
            }

            const userLinks = Array.from(cell.querySelectorAll('a[href*="/profile/"]'));
            if (userLinks.length > 1 || cell.querySelector('a[href*="/team/"]')) {
                if (!formatTeams) {
                    unformatTeamCell(cell);
                    return;
                }
                cell.classList.remove('cf-team-unformatted');
                cell.classList.add('cf-team-formatted');

                const membersContainer = document.createElement('div');
                membersContainer.className = 'cf-team-members';
                membersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';

                userLinks.forEach(link => {
                    const memberLine = document.createElement('div');
                    memberLine.className = 'cf-member-line';
                    memberLine.style.cssText = 'white-space: nowrap; display: flex; align-items: center; font-size: 11px;';
                    memberLine.appendChild(link);
                    membersContainer.appendChild(memberLine);
                });

                const removePunct = (parentNode) => {
                    Array.from(parentNode.childNodes).forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE) {
                            child.textContent = child.textContent.replace(/^[\s,:]+|[\s,:]+$/g, '');
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            removePunct(child);
                        }
                    });
                };
                removePunct(cell);

                const teamHeader = document.createElement('div');
                teamHeader.className = 'cf-team-header';
                teamHeader.style.cssText = 'word-break: break-word; margin-bottom: 8px; font-size: 13px; font-weight: bold; line-height: 1.4;';

                while (cell.firstChild) {
                    teamHeader.appendChild(cell.firstChild);
                }

                const flag = teamHeader.querySelector('.standings-flag');
                if (flag) {
                    flag.style.margin = '0 4px 0 0';
                    flag.style.verticalAlign = 'middle';
                }

                Array.from(teamHeader.querySelectorAll('span, a')).forEach(el => {
                    if (el.style.fontSize) {
                        el.style.fontSize = '';
                    }
                });

                cell.appendChild(teamHeader);
                cell.appendChild(membersContainer);
                return;
            }
        });
    }

    function refreshUserAvatarsAndStandings() {
        const cells = document.querySelectorAll('table.standings .contestant-cell, .status-party-cell');
        cells.forEach(cell => {
            if (cell.hasAttribute('data-original-html')) {
                cell.innerHTML = cell.getAttribute('data-original-html');
                cell.classList.remove('cf-team-formatted');
                cell.classList.remove('cf-team-unformatted');
            }
            cell.classList.remove('cf-avatar-processed-cell');
            cell.querySelectorAll('a[href*="/profile/"]').forEach(a => a.removeAttribute('data-cf-avatar-processed'));
            cell.querySelectorAll('.cf-avatar-container').forEach(el => el.remove());
            cell.querySelectorAll('.cf-avatar-line-wrapper').forEach(wrap => {
                while (wrap.firstChild) {
                    wrap.parentNode.insertBefore(wrap.firstChild, wrap);
                }
                wrap.remove();
            });
        });
        formatStandingsCells();
        applyUserAvatars();
    }

    function applyRatingStyle(cell, rating) {
        cell.dataset.rating = rating;
        cell.style.textAlign = 'center';
        cell.style.verticalAlign = 'middle';

        if (!appSettings.colorRatings) {
            cell.textContent = rating;
            cell.style.setProperty('background-color', 'transparent', 'important');
            cell.style.setProperty('color', isDarkTheme() ? '#EEEEEE' : 'inherit', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
            cell.style.removeProperty('border');
            cell.style.removeProperty('box-shadow');
            cell.style.removeProperty('position');
            return;
        }

        if (appSettings.displayStyle === 'tag') {
            const tagStyle = getRatingTagStyle(rating);
            if (appSettings.tagFillCell !== false) {
                cell.textContent = rating;
                cell.style.setProperty('background-color', tagStyle.bg, 'important');
                cell.style.removeProperty('border');
                cell.style.removeProperty('box-shadow');
                cell.style.removeProperty('position');
                cell.style.setProperty('color', tagStyle.text, 'important');
                cell.style.setProperty('font-weight', '500', 'important');
            } else {
                cell.textContent = '';
                cell.style.setProperty('background-color', 'transparent', 'important');
                cell.style.removeProperty('border');
                cell.style.removeProperty('box-shadow');
                cell.style.removeProperty('position');
                const tagSpan = document.createElement('span');
                tagSpan.textContent = rating;
                tagSpan.style.cssText = `
                    display: inline-block !important;
                    padding: 1px 6px !important;
                    border-radius: 4px !important;
                    border: 1px solid ${tagStyle.border} !important;
                    background-color: ${tagStyle.bg} !important;
                    color: ${tagStyle.text} !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                `;
                cell.appendChild(tagSpan);
            }
        } else {
            cell.textContent = rating;
            cell.style.removeProperty('border');
            cell.style.removeProperty('box-shadow');
            cell.style.removeProperty('position');
            cell.style.setProperty('background-color', getRatingBgColor(rating), 'important');
            cell.style.setProperty('color', isDarkTheme() ? '#EEEEEE' : (rating >= 1600 ? 'white' : 'black'), 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        }
    }

    function getCleanCssText(el) {
        if (!el || !el.style) return '';
        return (el.style.cssText || '')
            .replace(/display\s*:\s*none\s*!important\s*;?/gi, '')
            .replace(/display\s*:\s*none\s*;?/gi, '')
            .trim();
    }

    function applyProblemTagStyle(box, tag, rating) {
        const isBoxHidden = box && (box.getAttribute('data-cf-tag-hidden') === 'true' || box.style.display === 'none');
        const isTagHidden = tag && (tag.getAttribute('data-cf-tag-hidden') === 'true' || tag.style.display === 'none');
        const shouldHideScoreTag = !!appSettings.hideTags && !!appSettings.hideRatingTag && !(appSettings.notHideAcTags && isCurrentPageProblemAccepted());

        if (!appSettings.show.problemTags || !appSettings.colorRatings) {
            if (box && box.hasAttribute('data-original-css')) box.style.cssText = box.dataset.originalCss;
            else if (box) {
                box.style.removeProperty('background-color');
                box.style.removeProperty('border-color');
                box.style.removeProperty('color');
            }
            if (tag.hasAttribute('data-original-css')) tag.style.cssText = tag.dataset.originalCss;
            else {
                tag.style.removeProperty('background-color');
                tag.style.removeProperty('color');
            }
            if (shouldHideScoreTag || isBoxHidden) {
                if (box) {
                    box.style.setProperty('display', 'none', 'important');
                    box.setAttribute('data-cf-tag-hidden', 'true');
                }
            }
            if (shouldHideScoreTag || isTagHidden) {
                if (tag) {
                    tag.style.setProperty('display', 'none', 'important');
                    tag.setAttribute('data-cf-tag-hidden', 'true');
                }
            }
            return;
        }

        if (box && box.hasAttribute('data-original-css')) box.style.cssText = box.dataset.originalCss;
        if (tag.hasAttribute('data-original-css')) tag.style.cssText = tag.dataset.originalCss;

        tag.style.setProperty('background-color', 'transparent', 'important');
        if (appSettings.displayStyle === 'tag') {
            const tagStyle = getRatingTagStyle(rating);
            if (box) {
                box.style.setProperty('background-color', tagStyle.bg, 'important');
                box.style.setProperty('border-color', tagStyle.border, 'important');
                box.style.setProperty('color', tagStyle.text, 'important');
            }
            tag.style.setProperty('color', tagStyle.text, 'important');
        } else {
            const isWhite = rating >= 1600;
            if (box) {
                box.style.setProperty('background-color', getRatingBgColor(rating), 'important');
                box.style.setProperty('border-color', getRatingBorderColor(rating), 'important');
                if (isWhite) box.style.setProperty('color', 'white', 'important');
                else box.style.removeProperty('color');
            }
            tag.style.setProperty('color', isWhite ? 'white' : '#000', 'important');
        }

        if (shouldHideScoreTag || isBoxHidden) {
            if (box) {
                box.style.setProperty('display', 'none', 'important');
                box.setAttribute('data-cf-tag-hidden', 'true');
            }
        }
        if (shouldHideScoreTag || isTagHidden) {
            if (tag) {
                tag.style.setProperty('display', 'none', 'important');
                tag.setAttribute('data-cf-tag-hidden', 'true');
            }
        }
    }

    // -------------------------------------------------------------
    // Problem Solved Status & Tags Visibility Module
    // -------------------------------------------------------------
    let userSolvedCache = null;
    let isFetchingUserSolved = false;

    function getCurrentUserHandle() {
        const userLink = document.querySelector('#header .lang-chooser a[href^="/profile/"], #header a[href^="/profile/"]');
        return userLink ? userLink.textContent.trim() : null;
    }

    function extractProblemKey(url) {
        if (!url) return null;
        const match = url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i) ||
            url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i) ||
            url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i);
        if (match) {
            return `${match[1]}${match[2]}`.toUpperCase();
        }
        return null;
    }

    function getUserSolvedProblems() {
        const handle = getCurrentUserHandle();
        if (!handle) return new Set();
        if (userSolvedCache && userSolvedCache.handle === handle.toLowerCase()) {
            return userSolvedCache.set;
        }
        const storageKey = 'cf_user_solved_' + handle.toLowerCase();
        const cached = appStorage.getJSON(storageKey, null);
        if (cached && Array.isArray(cached.solved)) {
            userSolvedCache = {
                handle: handle.toLowerCase(),
                time: cached.time || 0,
                set: new Set(cached.solved)
            };
            return userSolvedCache.set;
        }
        return new Set();
    }

    function saveUserSolvedProblems(handle, solvedSet) {
        if (!handle) return;
        const storageKey = 'cf_user_solved_' + handle.toLowerCase();
        const solvedArr = sortProblemIds(Array.from(solvedSet));
        appStorage.setJSON(storageKey, {
            time: Date.now(),
            solved: solvedArr
        });
        userSolvedCache = {
            handle: handle.toLowerCase(),
            time: Date.now(),
            set: new Set(solvedArr)
        };
    }

    function checkAndFetchUserSolved() {
        const handle = getCurrentUserHandle();
        if (!handle || isFetchingUserSolved) return;

        const storageKey = 'cf_user_solved_' + handle.toLowerCase();
        const cached = appStorage.getJSON(storageKey, null);
        const now = Date.now();
        // 15 minutes TTL
        if (cached && cached.time && (now - cached.time < 15 * 60 * 1000) && Array.isArray(cached.solved)) {
            return;
        }

        isFetchingUserSolved = true;
        const apiUrl = `/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`;
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data && data.status === 'OK' && Array.isArray(data.result)) {
                    const solvedSet = getUserSolvedProblems();
                    data.result.forEach(sub => {
                        if (sub.verdict === 'OK' && sub.problem && sub.problem.contestId && sub.problem.index) {
                            solvedSet.add(`${sub.problem.contestId}${sub.problem.index}`.toUpperCase());
                        }
                    });
                    saveUserSolvedProblems(handle, solvedSet);
                    applyProblemTagsVisibility();
                }
            })
            .catch(err => {
                console.warn('Failed to fetch user solved status:', err);
            })
            .finally(() => {
                isFetchingUserSolved = false;
            });
    }

    function isCurrentPageProblemAccepted() {
        const curKey = extractProblemKey(window.location.href);

        // 1. Direct DOM checks for accepted problem on this page
        const acceptedRows = document.querySelectorAll('table.problems tr.accepted-problem, #sidebar tr.accepted-problem');
        for (const row of acceptedRows) {
            const links = row.querySelectorAll('a[href*="/problem/"]');
            for (const link of links) {
                const linkKey = extractProblemKey(link.href);
                if (linkKey && curKey && linkKey === curKey) {
                    return true;
                }
            }
        }

        // 2. Check sidebar or status table submissions specific to current problem
        const verdictEls = document.querySelectorAll('.verdict-accepted, span.verdict-accepted');
        for (const v of verdictEls) {
            const tr = v.closest('tr');
            if (tr) {
                const links = tr.querySelectorAll('a[href*="/problem/"]');
                for (const link of links) {
                    const linkKey = extractProblemKey(link.href);
                    if (linkKey && curKey && linkKey === curKey) {
                        return true;
                    }
                }
            }
        }

        // 3. Check cached solved set
        if (curKey) {
            const solvedSet = getUserSolvedProblems();
            if (solvedSet && solvedSet.has(curKey)) {
                return true;
            }
        }

        return false;
    }

    function applyProblemTagsVisibility() {
        const isHide = !!appSettings.hideTags;
        const hideRating = !!appSettings.hideRatingTag;
        const notHideAc = !!appSettings.notHideAcTags;

        if (notHideAc) {
            checkAndFetchUserSolved();
        }

        // ---------------------------------------------------------
        // 1. Sidebar Problem Tags Container (Problem Details Page)
        // ---------------------------------------------------------
        let container = null;
        let tagSidebox = Array.from(document.querySelectorAll('.roundbox.sidebox, #sidebar .roundbox')).find(box => {
            if (box.closest('.cf-settings-modal')) return false;
            const caption = box.querySelector('.caption');
            return caption && /tags|标签|теги/i.test(caption.textContent);
        });

        if (!tagSidebox) {
            const firstTag = document.querySelector('span.tag-box');
            if (firstTag && !firstTag.closest('.cf-settings-modal') && !firstTag.closest('table.problems')) {
                tagSidebox = firstTag.closest('.roundbox.sidebox, #sidebar .roundbox');
            }
        }

        if (tagSidebox) {
            container = tagSidebox.querySelector('div[style*="padding"]') || tagSidebox.querySelector('.caption')?.nextElementSibling || tagSidebox;
        } else {
            const allSpans = Array.from(document.querySelectorAll('span.tag-box')).filter(t => !t.closest('.cf-settings-modal') && !t.closest('table.problems'));
            if (allSpans.length > 0) {
                let p = allSpans[0].parentElement;
                while (p && p !== document.body) {
                    if (allSpans.every(span => p.contains(span))) {
                        container = p;
                        break;
                    }
                    p = p.parentElement;
                }
            }
        }

        if (container) {
            const isAc = notHideAc && isCurrentPageProblemAccepted();

            if (isHide && !isAc) {
                const tagSpans = Array.from(container.querySelectorAll('span.tag-box')).filter(t => !t.closest('.cf-tags-hidden-notice'));
                if (tagSpans.length > 0 || container.querySelector('.cf-tags-hidden-notice')) {
                    let isWrapped = false;
                    let sampleFontSize = '1.2rem';

                    tagSpans.forEach(span => {
                        const text = span.textContent.trim();
                        const title = span.getAttribute('title') || '';
                        const isScore = /^\*\s*\d+/.test(text) || !!span.dataset.rating || span.getAttribute('data-cf-clist-tag') === 'true' || span.getAttribute('data-cf-rating-tag') === 'true' || /difficulty|难度/i.test(title);

                        if (span.style.fontSize) sampleFontSize = span.style.fontSize;

                        const item = (span.parentElement && span.parentElement !== container && span.parentElement.classList.contains('roundbox'))
                            ? span.parentElement
                            : span;

                        if (item.tagName === 'DIV') isWrapped = true;

                        const shouldHide = hideRating ? true : !isScore;
                        if (shouldHide) {
                            item.style.setProperty('display', 'none', 'important');
                            item.setAttribute('data-cf-tag-hidden', 'true');
                            if (item !== span) {
                                span.style.setProperty('display', 'none', 'important');
                                span.setAttribute('data-cf-tag-hidden', 'true');
                            }
                        } else {
                            item.style.removeProperty('display');
                            item.removeAttribute('data-cf-tag-hidden');
                            if (item !== span) {
                                span.style.removeProperty('display');
                                span.removeAttribute('data-cf-tag-hidden');
                            }
                        }
                    });

                    // Add ONE hidden tag as the first item if not already present, or ensure it's visible
                    const existingNotice = container.querySelector('.cf-tags-hidden-notice');
                    if (existingNotice) {
                        existingNotice.style.removeProperty('display');
                        existingNotice.removeAttribute('data-cf-tag-hidden');
                    } else {
                        let hiddenItem;
                        if (isWrapped) {
                            hiddenItem = document.createElement('div');
                            hiddenItem.className = 'roundbox borderTopRound borderBottomRound cf-tags-hidden-notice';
                            hiddenItem.style.cssText = 'margin:2px; padding:0 3px 2px 3px; float:left;';
                            const hiddenSpan = document.createElement('span');
                            hiddenSpan.className = 'tag-box cf-tags-hidden-notice';
                            hiddenSpan.style.fontSize = sampleFontSize;
                            hiddenSpan.textContent = 'tags hidden';
                            hiddenSpan.title = 'Tags hidden';
                            hiddenItem.appendChild(hiddenSpan);
                        } else {
                            hiddenItem = document.createElement('span');
                            hiddenItem.className = 'tag-box cf-tags-hidden-notice';
                            hiddenItem.style.fontSize = sampleFontSize;
                            hiddenItem.textContent = 'tags hidden';
                            hiddenItem.title = 'Tags hidden';
                        }
                        container.insertBefore(hiddenItem, container.firstElementChild);
                    }
                }
            } else {
                // Restore all tags and remove notice
                container.querySelectorAll('.cf-tags-hidden-notice').forEach(n => n.remove());
                container.querySelectorAll('[data-cf-tag-hidden="true"]').forEach(item => {
                    item.style.removeProperty('display');
                    item.removeAttribute('data-cf-tag-hidden');
                });
            }
        }

        // ---------------------------------------------------------
        // 2. Problemset & Contest Tables (table.problems tr)
        // ---------------------------------------------------------
        const tableRows = document.querySelectorAll('table.problems tr');
        if (tableRows.length > 0) {
            const solvedSet = notHideAc ? getUserSolvedProblems() : null;

            tableRows.forEach(row => {
                const isRowAc = row.classList.contains('accepted-problem');
                let isAc = isRowAc;

                if (isRowAc) {
                    const probLink = row.querySelector('a[href*="/problem/"]');
                    if (probLink) {
                        const k = extractProblemKey(probLink.href);
                        if (k && solvedSet) solvedSet.add(k);
                    }
                } else if (notHideAc && solvedSet) {
                    const probLink = row.querySelector('a[href*="/problem/"]');
                    if (probLink) {
                        const k = extractProblemKey(probLink.href);
                        if (k && solvedSet.has(k)) {
                            isAc = true;
                        }
                    }
                }

                const tagsInRow = row.querySelectorAll('div[style*="float: left"] a.notice, span.tag-box');
                if (tagsInRow.length === 0) return;

                if (isHide && !(notHideAc && isAc)) {
                    tagsInRow.forEach(tag => {
                        const text = tag.textContent.trim();
                        const title = tag.getAttribute('title') || '';
                        const isScore = /^\*\s*\d+/.test(text) || !!tag.dataset.rating || tag.getAttribute('data-cf-clist-tag') === 'true' || tag.getAttribute('data-cf-rating-tag') === 'true' || /difficulty|难度/i.test(title);
                        const shouldHide = hideRating ? true : !isScore;
                        if (shouldHide) {
                            tag.style.setProperty('display', 'none', 'important');
                            tag.setAttribute('data-cf-tag-hidden', 'true');
                        } else {
                            tag.style.removeProperty('display');
                            tag.removeAttribute('data-cf-tag-hidden');
                        }
                    });
                } else {
                    tagsInRow.forEach(tag => {
                        tag.style.removeProperty('display');
                        tag.removeAttribute('data-cf-tag-hidden');
                    });
                }
            });
        }
    }

    // Physical Shift key state tracking for handling Windows Numpad Shift suppression
    let isShiftPhysicallyDown = false;
    let lastShiftKeyUpTime = 0;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            isShiftPhysicallyDown = true;
        }
    }, true);

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            isShiftPhysicallyDown = false;
            lastShiftKeyUpTime = Date.now();
        }
    }, true);

    window.addEventListener('blur', () => {
        isShiftPhysicallyDown = false;
    });

    function isShiftActive(e) {
        if (!e) return false;
        if (e.shiftKey) return true;
        if (typeof e.getModifierState === 'function' && e.getModifierState('Shift')) return true;
        if (isShiftPhysicallyDown) return true;

        // Specific detection for Numpad keys on Windows where OS suppresses shiftKey
        if (e.code && e.code.startsWith('Numpad')) {
            const isDigitOrDot = ['Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4',
                'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadDecimal'].includes(e.code);
            if (isDigitOrDot) {
                if (typeof e.getModifierState === 'function') {
                    const numlock = e.getModifierState('NumLock');
                    const isNumberChar = /^[0-9.]$/.test(e.key);
                    // With NumLock ON, Shift turns digits into navigation keys (e.key is non-digit like Clear/End)
                    // With NumLock OFF, Shift turns navigation keys into digits (e.key is digit)
                    if (numlock && !isNumberChar) return true;
                    if (!numlock && isNumberChar) return true;
                }
                if (Date.now() - lastShiftKeyUpTime < 150 && !/^[0-9.]$/.test(e.key)) {
                    return true;
                }
            } else {
                if (Date.now() - lastShiftKeyUpTime < 150) return true;
            }
        }
        return false;
    }

    const CODE_TO_BASE_KEY = {
        // Punctuations (maps physical key code to unshifted base symbol)
        'Quote': "'",
        'Backquote': '`',
        'Minus': '-',
        'Equal': '=',
        'BracketLeft': '[',
        'BracketRight': ']',
        'Backslash': '\\',
        'Semicolon': ';',
        'Comma': ',',
        'Period': '.',
        'Slash': '/',

        // Numpad keys
        'Numpad0': 'Num0',
        'Numpad1': 'Num1',
        'Numpad2': 'Num2',
        'Numpad3': 'Num3',
        'Numpad4': 'Num4',
        'Numpad5': 'Num5',
        'Numpad6': 'Num6',
        'Numpad7': 'Num7',
        'Numpad8': 'Num8',
        'Numpad9': 'Num9',
        'NumpadAdd': 'Num+',
        'NumpadSubtract': 'Num-',
        'NumpadMultiply': 'Num*',
        'NumpadDivide': 'Num/',
        'NumpadDecimal': 'Num.',
        'NumpadEnter': 'NumEnter',

        // Navigation and editing keys
        'Backspace': 'Backspace',
        'Delete': 'Del',
        'Insert': 'Ins',
        'PageUp': 'PgUp',
        'PageDown': 'PgDn',
        'Home': 'Home',
        'End': 'End',
        'Space': 'Space',
        'Tab': 'Tab',
        'Enter': 'Enter',
        'Escape': 'Esc',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→'
    };

    function matchesShortcut(e, shortcutStr) {
        if (!shortcutStr || typeof shortcutStr !== 'string') return false;
        const parts = shortcutStr.split('+').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return false;

        const reqCtrl = parts.includes('Ctrl');
        const reqAlt = parts.includes('Alt');
        const reqShift = parts.includes('Shift');
        const reqMeta = parts.includes('Meta');

        if (e.ctrlKey !== reqCtrl) return false;
        if (e.altKey !== reqAlt) return false;
        if (isShiftActive(e) !== reqShift) return false;
        if (e.metaKey !== reqMeta) return false;

        const mainKey = parts[parts.length - 1];
        const mainUpper = mainKey.toUpperCase();
        const eventKey = (e.key || '').toUpperCase();
        const eventCode = (e.code || '').toUpperCase();

        // 1. Numpad keys: strictly match Numpad code
        if (mainUpper.startsWith('NUM')) {
            const sub = mainKey.slice(3);
            if (/^[0-9]$/.test(sub)) return e.code === 'Numpad' + sub;
            if (sub === '+') return e.code === 'NumpadAdd';
            if (sub === '-') return e.code === 'NumpadSubtract';
            if (sub === '*') return e.code === 'NumpadMultiply';
            if (sub === '/') return e.code === 'NumpadDivide';
            if (sub === '.') return e.code === 'NumpadDecimal';
            if (sub.toUpperCase() === 'ENTER') return e.code === 'NumpadEnter';
            return false;
        }

        // 2. Top-row digit: must match Digit[0-9] and NOT Numpad
        if (/^[0-9]$/.test(mainKey)) {
            return e.code === 'Digit' + mainKey;
        }

        // 3. Punctuation base key mapping
        const codeBase = CODE_TO_BASE_KEY[e.code];
        if (codeBase && codeBase.toUpperCase() === mainUpper) {
            return true;
        }

        // 4. Letter keys
        if (/^[A-Z]$/.test(mainUpper)) {
            if (e.code === 'Key' + mainUpper) return true;
            if (eventKey === mainUpper) return true;
            return false;
        }

        // 5. Special / navigation keys
        if (mainUpper === 'SPACE' && (e.key === ' ' || eventCode === 'SPACE')) return true;
        if (mainUpper === 'BACKSPACE' && (eventKey === 'BACKSPACE' || eventCode === 'BACKSPACE')) return true;
        if ((mainUpper === 'DEL' || mainUpper === 'DELETE') && (eventKey === 'DELETE' || eventCode === 'DELETE')) return true;
        if ((mainUpper === 'INS' || mainUpper === 'INSERT') && (eventKey === 'INSERT' || eventCode === 'INSERT')) return true;
        if ((mainUpper === 'ESC' || mainUpper === 'ESCAPE') && (eventKey === 'ESCAPE' || eventCode === 'ESCAPE')) return true;
        if ((mainUpper === 'PGUP' || mainUpper === 'PAGEUP') && (eventKey === 'PAGEUP' || eventCode === 'PAGEUP')) return true;
        if ((mainUpper === 'PGDN' || mainUpper === 'PAGEDOWN') && (eventKey === 'PAGEDOWN' || eventCode === 'PAGEDOWN')) return true;
        if ((mainUpper === 'UP' || mainKey === '↑') && (eventKey === 'ARROWUP' || eventCode === 'ARROWUP')) return true;
        if ((mainUpper === 'DOWN' || mainKey === '↓') && (eventKey === 'ARROWDOWN' || eventCode === 'ARROWDOWN')) return true;
        if ((mainUpper === 'LEFT' || mainKey === '←') && (eventKey === 'ARROWLEFT' || eventCode === 'ARROWLEFT')) return true;
        if ((mainUpper === 'RIGHT' || mainKey === '→') && (eventKey === 'ARROWRIGHT' || eventCode === 'ARROWRIGHT')) return true;

        if (eventKey === mainUpper || eventCode === mainUpper) return true;

        return false;
    }

    let updateFooterRatingStatus = () => { };

    // Global configurable hotkeys dispatcher
    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            return;
        }
        const sc = (appSettings && appSettings.shortcuts) ? appSettings.shortcuts : DEFAULT_SETTINGS.shortcuts;

        // 1. 显示/隐藏算法标签 (hideTags)
        if (matchesShortcut(e, sc.hideTags)) {
            e.preventDefault();
            appSettings.hideTags = !appSettings.hideTags;
            saveSettings(appSettings);
            applyProblemTagsVisibility();
            const cb = document.querySelector('.cf-toggle-hide-tags');
            if (cb) {
                cb.checked = !!appSettings.hideTags;
                document.querySelectorAll('.cf-sub-setting-item').forEach(item => {
                    item.style.display = appSettings.hideTags ? 'flex' : 'none';
                });
            }
            return;
        }

        // 2. 显示/隐藏状态缩写 (shortVerdict)
        if (matchesShortcut(e, sc.shortVerdict)) {
            e.preventDefault();
            if (!appSettings.show) appSettings.show = { ...DEFAULT_SETTINGS.show };
            appSettings.show.shortVerdict = !appSettings.show.shortVerdict;
            saveSettings(appSettings);
            document.querySelectorAll('.cf-verdict-text').forEach(span => {
                span.innerHTML = appSettings.show.shortVerdict ? span.dataset.short : span.dataset.original;
            });
            const cb = document.querySelector('.cf-toggle-short-verdict');
            if (cb) cb.checked = !!appSettings.show.shortVerdict;
            return;
        }

        // 3. 启用/关闭时间格式化 (timeFormat)
        if (matchesShortcut(e, sc.timeFormat)) {
            e.preventDefault();
            if (!appSettings.timeFormat || typeof appSettings.timeFormat !== 'object') {
                appSettings.timeFormat = { ...DEFAULT_SETTINGS.timeFormat };
            }
            appSettings.timeFormat.enabled = !appSettings.timeFormat.enabled;
            saveSettings(appSettings);
            updateDynamicStyle();
            applyTimeFormatting();
            const timeToggle = document.querySelector('.cf-toggle-time-format');
            if (timeToggle) {
                timeToggle.checked = !!appSettings.timeFormat.enabled;
                timeToggle.dispatchEvent(new Event('change'));
            }
            return;
        }

        // 4. 显示/隐藏语言图标 (langIcon)
        if (matchesShortcut(e, sc.langIcon)) {
            e.preventDefault();
            if (!appSettings.show) appSettings.show = { ...DEFAULT_SETTINGS.show };
            appSettings.show.langIcon = !appSettings.show.langIcon;
            saveSettings(appSettings);
            updateDynamicStyle();
            const cb = document.querySelector('.cf-toggle-lang-icon');
            if (cb) {
                cb.checked = !!appSettings.show.langIcon;
                const rowLangIconSize = document.querySelector('.cf-row-lang-icon-size');
                if (rowLangIconSize) rowLangIconSize.style.display = cb.checked ? 'flex' : 'none';
            }
            return;
        }

        // 4. 启用/关闭CList分数 (clistEnabled)
        if (matchesShortcut(e, sc.clistEnabled)) {
            e.preventDefault();
            if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
            appSettings.clist.enabled = !appSettings.clist.enabled;
            saveSettings(appSettings);
            const cb = document.querySelector('.cf-toggle-clist-enabled');
            if (cb) {
                cb.checked = !!appSettings.clist.enabled;
                const clistSubgroup = document.querySelector('.cf-clist-subgroup');
                if (clistSubgroup) clistSubgroup.style.display = cb.checked ? 'flex' : 'none';
            }
            if (typeof updateFooterRatingStatus === 'function') updateFooterRatingStatus();
            refreshRatingsOnPage();
            return;
        }

        // 5. 启用/关闭色彩展示难度分 (colorRatings)
        if (matchesShortcut(e, sc.colorRatings)) {
            e.preventDefault();
            appSettings.colorRatings = !appSettings.colorRatings;
            saveSettings(appSettings);
            const cb = document.querySelector('.cf-toggle-color-ratings');
            if (cb) {
                cb.checked = !!appSettings.colorRatings;
                const rowStyle = document.querySelector('.cf-row-display-style');
                if (rowStyle) rowStyle.style.display = appSettings.colorRatings ? 'flex' : 'none';
                const showGroup = document.querySelector('.cf-show-group');
                if (showGroup) showGroup.style.display = appSettings.colorRatings ? 'flex' : 'none';
                const rowTagFillCell = document.querySelector('.cf-row-tag-fill-cell');
                if (rowTagFillCell) {
                    rowTagFillCell.style.display = (appSettings.colorRatings && (appSettings.displayStyle || 'tag') === 'tag') ? 'flex' : 'none';
                }
            }
            updateDynamicStyle();
            refreshRatingsOnPage();
            return;
        }

        // 6. 切换难度分展示形式 (displayStyle)
        if (matchesShortcut(e, sc.displayStyle)) {
            e.preventDefault();
            appSettings.displayStyle = (appSettings.displayStyle === 'block') ? 'tag' : 'block';
            saveSettings(appSettings);
            updateDynamicStyle();
            refreshRatingsOnPage();
            const targetBtn = document.querySelector(appSettings.displayStyle === 'block' ? '.cf-btn-style-block' : '.cf-btn-style-tag');
            if (targetBtn) targetBtn.click();
            const rowTagFillCell = document.querySelector('.cf-row-tag-fill-cell');
            if (rowTagFillCell) {
                rowTagFillCell.style.display = (appSettings.colorRatings && (appSettings.displayStyle || 'tag') === 'tag') ? 'flex' : 'none';
            }
            return;
        }

        // 7. 显示/隐藏用户头像 (userAvatar)
        if (matchesShortcut(e, sc.userAvatar)) {
            e.preventDefault();
            if (!appSettings.show) appSettings.show = { ...DEFAULT_SETTINGS.show };
            appSettings.show.userAvatar = !appSettings.show.userAvatar;
            saveSettings(appSettings);
            updateDynamicStyle();
            refreshUserAvatarsAndStandings();
            const cb = document.querySelector('.cf-toggle-user-avatar');
            if (cb) {
                cb.checked = !!appSettings.show.userAvatar;
                const rowAvatarSize = document.querySelector('.cf-row-avatar-size');
                if (rowAvatarSize) rowAvatarSize.style.display = cb.checked ? 'flex' : 'none';
                const rowFormatTeams = document.querySelector('.cf-row-format-teams');
                if (rowFormatTeams) rowFormatTeams.style.display = cb.checked ? 'flex' : 'none';
            }
            return;
        }
    });

    // Helper: Determine effective rating for a problem URL or problem key
    function getProblemRating(hrefOrKey, probName) {
        if (!hrefOrKey) return null;
        const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
        const clistData = clistEnabled ? getClistProblems() : null;
        const safeRatingsMap = latestRatingsMap || {};

        let key = '';
        let contestId = null;
        let index = '';
        if (typeof hrefOrKey === 'string' && hrefOrKey.includes('/')) {
            const regexes = [
                /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
                /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
                /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i
            ];
            for (const regex of regexes) {
                const match = hrefOrKey.match(regex);
                if (match) {
                    contestId = parseInt(match[1], 10);
                    index = match[2].toUpperCase();
                    key = `${match[1]}${match[2]}`.toUpperCase();
                    break;
                }
            }
        } else if (typeof hrefOrKey === 'string') {
            key = hrefOrKey.toUpperCase();
            const match = key.match(/^(\d+)([A-Za-z0-9_]+)$/);
            if (match) {
                contestId = parseInt(match[1], 10);
                index = match[2];
            }
        }

        if (!key) return null;

        // 1. PRIORITY: When Clist is enabled, check direct Clist hit with key
        if (clistEnabled && clistData && clistData[key]) {
            const clistItem = clistData[key];
            const clistRating = typeof clistItem === 'number' ? clistItem : (clistItem && typeof clistItem.rating === 'number' ? clistItem.rating : null);
            if (typeof clistRating === 'number') {
                return clistRating;
            }
        }

        // 2. FALLBACK: Codeforces official problem rating
        // 2.1 Direct hit by key (e.g. 2202A)
        const officialItem = safeRatingsMap[key] || safeRatingsMap[key.toLowerCase()];
        if (officialItem !== undefined && officialItem !== null) {
            const officialRating = typeof officialItem === 'number' ? officialItem : (typeof officialItem.rating === 'number' ? officialItem.rating : null);
            if (typeof officialRating === 'number') {
                return officialRating;
            }
        }

        // 2.2 Parallel contest fallback: find peer contests in the same concurrent group and match by problem name
        if (contestId) {
            const peers = getPeerContests(contestId);
            if (peers && peers.length > 0) {
                let targetName = '';
                if (probName && typeof probName === 'string') {
                    targetName = cleanProblemTitle(probName);
                }
                if (!targetName && officialItem && officialItem.name) {
                    targetName = cleanProblemTitle(officialItem.name);
                }

                if (targetName) {
                    const lowerTarget = targetName.toLowerCase();
                    for (const peerId of peers) {
                        const peerProblems = getProblemsByContest(peerId);
                        for (const pEntry of peerProblems) {
                            const pItem = pEntry.item;
                            if (pItem && pItem.name) {
                                const peerName = cleanProblemTitle(pItem.name).toLowerCase();
                                if (peerName === lowerTarget) {
                                    const peerRating = typeof pItem.rating === 'number' ? pItem.rating : (typeof pItem === 'number' ? pItem : null);
                                    if (typeof peerRating === 'number') {
                                        return peerRating;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    // Helper to only modify the score portion in a rating span (preserving tags, text emojis, and other plugins)
    function updateSpanRatingText(span, newRating) {
        if (!span) return;
        let found = false;
        for (const node of span.childNodes) {
            if (node.nodeType === 3 /* Node.TEXT_NODE */ && /\*\s*\d+/.test(node.nodeValue)) {
                node.nodeValue = node.nodeValue.replace(/\*\s*\d+/, `*${newRating}`);
                found = true;
                break;
            }
        }
        if (!found) {
            span.insertBefore(document.createTextNode(`*${newRating}`), span.firstChild);
        }
    }

    function getProblemRatingFromHref(href, title) {
        if (!href) return null;
        const regexes = [
            /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
            /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
            /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i
        ];
        for (const regex of regexes) {
            const match = href.match(regex);
            if (match) {
                const rating = getProblemRating(href, title);
                return { contestId: match[1], index: match[2], rating: rating };
            }
        }
        return null;
    }

    // Unified handler for Problem Page difficulty tags (adapting existing or appending at the end)
    function updateProblemPageRatingTag(ratingsMap) {
        let sidebox = Array.from(document.querySelectorAll('.roundbox.sidebox, #sidebar .roundbox')).find(box => {
            if (box.closest('.cf-settings-modal')) return false;
            const caption = box.querySelector('.caption');
            return caption && /tags|标签|теги/i.test(caption.textContent);
        });
        if (!sidebox) {
            const firstTag = document.querySelector('span.tag-box');
            if (firstTag && !firstTag.closest('.cf-settings-modal') && !firstTag.closest('table.problems')) {
                sidebox = firstTag.closest('.roundbox.sidebox, #sidebar .roundbox');
            }
        }
        if (!sidebox) return;

        const container = sidebox.querySelector('div[style*="padding"]') || sidebox.querySelector('.caption')?.nextElementSibling || sidebox;
        if (!container) return;

        const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
        let problemPageTitle = '';
        const titleEl = document.querySelector('.problem-statement .header .title');
        if (titleEl) {
            problemPageTitle = titleEl.textContent;
        }

        const tagSpans = Array.from(container.querySelectorAll('span.tag-box')).filter(s => !s.classList.contains('cf-tags-hidden-notice'));

        // Find existing official rating tag and existing clist-created tags
        let officialTagSpan = null;
        const clistTags = [];

        tagSpans.forEach(span => {
            if (span.getAttribute('data-cf-clist-tag') === 'true') {
                clistTags.push(span);
                return;
            }
            const text = span.textContent.trim();
            const title = span.getAttribute('title') || '';
            if (span.hasAttribute('data-original-rating') || /^\*\s*\d+/.test(text) || /difficulty|难度/i.test(title)) {
                if (!officialTagSpan) {
                    officialTagSpan = span;
                }
            }
        });

        const cleanClistTags = () => {
            clistTags.forEach(ct => {
                const parent = ct.parentElement;
                if (parent && parent.classList.contains('roundbox') && parent !== container) {
                    parent.remove();
                } else {
                    ct.remove();
                }
            });
        };

        let targetRating = null;
        let isClist = false;
        if (clistEnabled) {
            const clistRating = getProblemRating(window.location.href, problemPageTitle);
            if (typeof clistRating === 'number') {
                targetRating = clistRating;
                isClist = true;
            }
        }

        // Case 1: Problem has an official rating tag (e.g. Ref/problem)
        if (officialTagSpan) {
            cleanClistTags();

            // Store original values once
            if (!officialTagSpan.hasAttribute('data-original-rating')) {
                const m = officialTagSpan.textContent.trim().match(/^\*\s*(\d+)/);
                if (m) {
                    officialTagSpan.setAttribute('data-original-rating', m[1]);
                }
                officialTagSpan.setAttribute('data-original-text', officialTagSpan.textContent.trim());
                officialTagSpan.setAttribute('data-original-title', officialTagSpan.getAttribute('title') || 'Difficulty');
            }
            if (!officialTagSpan.hasAttribute('data-original-css')) {
                officialTagSpan.dataset.originalCss = getCleanCssText(officialTagSpan);
            }

            const parentBox = (officialTagSpan.parentElement && officialTagSpan.parentElement.classList.contains('roundbox') && !officialTagSpan.parentElement.classList.contains('sidebox')) ? officialTagSpan.parentElement : null;
            if (parentBox && !parentBox.hasAttribute('data-original-css')) {
                parentBox.dataset.originalCss = getCleanCssText(parentBox);
            }

            let effectiveRating = targetRating;
            if (typeof effectiveRating !== 'number') {
                const origRatingStr = officialTagSpan.getAttribute('data-original-rating');
                if (origRatingStr !== null && origRatingStr !== undefined && origRatingStr !== '') {
                    effectiveRating = parseInt(origRatingStr, 10);
                }
            }

            if (typeof effectiveRating === 'number') {
                updateSpanRatingText(officialTagSpan, effectiveRating);
                officialTagSpan.title = isClist ? `Difficulty: ${effectiveRating} (CList)` : (officialTagSpan.getAttribute('data-original-title') || 'Difficulty');
                officialTagSpan.dataset.rating = effectiveRating;
                officialTagSpan.setAttribute('data-cf-rating-tag', 'true');
                officialTagSpan.setAttribute('data-cf-rating-added', 'true');
                if (parentBox) {
                    parentBox.dataset.rating = effectiveRating;
                    parentBox.setAttribute('data-cf-rating-tag', 'true');
                    parentBox.setAttribute('data-cf-rating-added', 'true');
                }
                applyProblemTagStyle(parentBox, officialTagSpan, effectiveRating);
            }
            applyProblemTagsVisibility();
            return;
        }

        // Case 2: No official rating tag exists (e.g. Ref/pro2)
        let effectiveRating = targetRating;
        if (typeof effectiveRating !== 'number') {
            const info = getProblemRatingFromHref(window.location.href, problemPageTitle);
            if (info && typeof info.rating === 'number') {
                effectiveRating = info.rating;
            }
        }

        const existingClistSpan = clistTags[0];

        if (typeof effectiveRating === 'number') {
            if (existingClistSpan) {
                updateSpanRatingText(existingClistSpan, effectiveRating);
                existingClistSpan.title = isClist ? `Difficulty: ${effectiveRating} (CList)` : 'Difficulty';
                existingClistSpan.dataset.rating = effectiveRating;
                const parent = (existingClistSpan.parentElement && existingClistSpan.parentElement.classList.contains('roundbox') && existingClistSpan.parentElement !== container) ? existingClistSpan.parentElement : null;
                if (parent) {
                    parent.dataset.rating = effectiveRating;
                    parent.setAttribute('data-cf-rating-tag', 'true');
                    parent.setAttribute('data-cf-rating-added', 'true');
                }
                applyProblemTagStyle(parent, existingClistSpan, effectiveRating);
            } else {
                // Find all existing tag items in container to determine insertion point at the end
                const allTagItems = Array.from(container.children).filter(child => {
                    if (child.classList.contains('cf-tags-hidden-notice')) return false;
                    if (child.matches('span.tag-box')) return true;
                    if (child.querySelector('span.tag-box')) return true;
                    return false;
                });

                const firstTag = container.querySelector('span.tag-box');
                const isWrapped = firstTag && firstTag.parentElement && firstTag.parentElement !== container && firstTag.parentElement.classList.contains('roundbox');
                const sampleFontSize = firstTag?.style?.fontSize || '1.2rem';

                const span = document.createElement('span');
                span.className = 'tag-box';
                span.style.fontSize = sampleFontSize;
                span.textContent = `*${effectiveRating}`;
                span.title = isClist ? `Difficulty: ${effectiveRating} (CList)` : 'Difficulty';
                span.setAttribute('data-cf-rating-tag', 'true');
                span.setAttribute('data-cf-clist-tag', 'true');
                span.setAttribute('data-cf-rating-added', 'true');
                span.dataset.rating = effectiveRating;

                let tagItem;
                if (isWrapped) {
                    tagItem = document.createElement('div');
                    tagItem.className = 'roundbox borderTopRound borderBottomRound';
                    tagItem.style.cssText = 'margin:2px; padding:0 3px 2px 3px; float:left;';
                    tagItem.setAttribute('data-cf-rating-tag', 'true');
                    tagItem.setAttribute('data-cf-clist-tag', 'true');
                    tagItem.setAttribute('data-cf-rating-added', 'true');
                    tagItem.dataset.rating = effectiveRating;
                    tagItem.appendChild(span);
                    tagItem.dataset.originalCss = getCleanCssText(tagItem);
                } else {
                    tagItem = span;
                }
                span.dataset.originalCss = getCleanCssText(span);

                // Append at the end of all tags (before clear:both or notice, or append to container)
                if (allTagItems.length > 0) {
                    const lastTagItem = allTagItems[allTagItems.length - 1];
                    lastTagItem.insertAdjacentElement('afterend', tagItem);
                } else {
                    const clearDiv = Array.from(container.children).find(c => {
                        if (c.tagName === 'DIV' && (c.style.clear === 'both' || c.getAttribute('style')?.includes('clear'))) return true;
                        if (c.id === 'addTagForm') return true;
                        return false;
                    });
                    if (clearDiv) {
                        container.insertBefore(tagItem, clearDiv);
                    } else {
                        container.appendChild(tagItem);
                    }
                }

                applyProblemTagStyle(isWrapped ? tagItem : null, span, effectiveRating);
            }
        } else {
            cleanClistTags();
        }
        applyProblemTagsVisibility();
    }

    // Dynamic re-evaluation of ratings on all page tables and tags
    function refreshRatingsOnPage() {
        const ratingsMap = latestRatingsMap || {};

        // 1. Refresh all rating cells in tables
        const ratingCols = document.querySelectorAll('td.cf-rating-col');
        ratingCols.forEach(td => {
            const row = td.closest('tr');
            if (!row) return;

            const link = row.querySelector('td.id a') || row.querySelector('a[href*="/problem/"]');
            if (link) {
                const titleLink = row.querySelector('td:nth-child(2) a') || row.querySelector('a[href*="/problem/"]:not([href$="' + link.getAttribute('href') + '"])');
                const probName = titleLink ? titleLink.textContent : (link.getAttribute('title') || link.textContent);
                const rating = getProblemRating(link.href, probName);
                if (typeof rating === 'number') {
                    applyRatingStyle(td, rating);
                } else {
                    td.textContent = '';
                    td.style.removeProperty('background-color');
                    td.style.removeProperty('border');
                    td.style.removeProperty('box-shadow');
                    td.style.removeProperty('position');
                    td.style.removeProperty('color');
                }
            }
        });

        // 2. Refresh Standings tables rating row
        const standingsRows = document.querySelectorAll('tr.cf-rating-standings-row');
        standingsRows.forEach(ratingRow => {
            const table = ratingRow.closest('table.standings');
            if (!table) return;
            const headerRow = table.querySelector('tr:first-child');
            if (!headerRow) return;

            Array.from(headerRow.cells).forEach((th, idx) => {
                const ratingCell = ratingRow.cells[idx];
                if (!ratingCell) return;
                const link = th.querySelector('a[href*="/problem/"]');
                if (link) {
                    const probName = link.getAttribute('title') || th.getAttribute('title') || link.textContent;
                    const rating = getProblemRating(link.href, probName);
                    if (typeof rating === 'number') {
                        applyRatingStyle(ratingCell, rating);
                        if (appSettings.displayStyle === 'block') {
                            ratingCell.style.setProperty('font-size', '0.9em', 'important');
                            ratingCell.style.setProperty('padding', '0.2em', 'important');
                        }
                    } else {
                        ratingCell.textContent = '';
                        ratingCell.style.removeProperty('background-color');
                        ratingCell.style.removeProperty('border');
                        ratingCell.style.removeProperty('color');
                    }
                }
            });
        });

        // 3. Refresh Problem Page sidebar tags
        updateProblemPageRatingTag(ratingsMap);
        applyProblemTagsVisibility();
    }

    // Apply ratings to tables and standalone links
    function applyRatings(ratingsMap) {
        const clistEnabled = !!(appSettings.clist && appSettings.clist.enabled);
        const clistData = clistEnabled ? getClistProblems() : null;
        const hasOfficial = ratingsMap && Object.keys(ratingsMap).length > 0;
        if (!hasOfficial && !clistData) return;
        const safeRatingsMap = ratingsMap || {};


        // Walk through nodes to replace verdict text with abbreviations
        function walkAndReplaceVerdict(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                let txt = node.textContent;
                if (!txt.trim()) return;

                const map = {
                    'Accepted': 'AC',
                    'Wrong answer': 'WA',
                    'Time limit exceeded': 'TLE',
                    'Memory limit exceeded': 'MLE',
                    'Runtime error': 'RE',
                    'Compilation error': 'CE',
                    'Idleness limit exceeded': 'ILE',
                    'Presentation error': 'PE',
                    'Skipped': 'SK'
                };

                let matched = false;
                let htmlStr = txt;
                for (let key in map) {
                    const regex = new RegExp(key, 'gi');
                    if (regex.test(htmlStr)) {
                        matched = true;
                        htmlStr = htmlStr.replace(regex, `<b>${map[key]}</b>`);
                    }
                }

                if (matched) {
                    const span = document.createElement('span');
                    span.className = 'cf-verdict-text';
                    span.dataset.original = txt;
                    span.dataset.short = htmlStr;
                    span.innerHTML = appSettings.show.shortVerdict ? htmlStr : txt;
                    node.parentNode.replaceChild(span, node);
                }
            } else {
                const children = Array.from(node.childNodes);
                for (let i = 0; i < children.length; i++) {
                    walkAndReplaceVerdict(children[i]);
                }
            }
        }

        // 1. Handle Status Tables and Hacks Tables by adding a new Rating column
        const statusTables = document.querySelectorAll('table.status-frame-datatable, div.datatable table:not(.standings):not(.problems)');
        statusTables.forEach(table => {
            const headerRow = table.querySelector('tr');
            if (!headerRow) return;

            // Find column indexes
            let idColIdx = -1;
            let timeColIdx = -1;
            let whoColIdx = -1;
            let problemColIdx = -1;
            let langColIdx = -1;
            let verdictColIdx = -1;
            let timeConsumedColIdx = -1;
            let memoryConsumedColIdx = -1;
            let isHacks = window.location.href.includes('/hacks');
            let isStatusOrHacks = false;

            const path = window.location.pathname.toLowerCase();
            const isSubmissionsPage = path.includes('/my') || path.includes('/submissions');

            table.classList.add('cf-status-table');
            if (isHacks) table.classList.add('cf-table-hacks');
            else if (isSubmissionsPage) table.classList.add('cf-table-submissions');
            else table.classList.add('cf-table-status');

            Array.from(headerRow.cells).forEach((th, idx) => {
                const text = th.textContent.toLowerCase();
                if (idColIdx === -1 && (idx === 0 || text === '#' || text.startsWith('#') || th.classList.contains('id-cell'))) {
                    idColIdx = idx;
                }
                if (timeColIdx === -1 && (text.includes('when') || text.includes('提交时间') || text.includes('когда') || text.includes('date') || ((text.includes('time') || text.includes('时间')) && idx < 3))) {
                    timeColIdx = idx;
                }
                if (whoColIdx === -1 && (text.includes('who') || text.includes('author') || text.includes('提交者') || text.includes('автор'))) {
                    whoColIdx = idx;
                }
                if (problemColIdx === -1 && (text.includes('problem') || text.includes('题目') || text.includes('问题') || text.includes('задача'))) {
                    problemColIdx = idx;
                    isStatusOrHacks = true;
                }
                if (langColIdx === -1 && (text.includes('lang') || text.includes('语言') || text.includes('язык'))) {
                    langColIdx = idx;
                }
                if (verdictColIdx === -1 && (text.includes('verdict') || text.includes('判题状态') || text.includes('结果') || text.includes('вердикт'))) {
                    verdictColIdx = idx;
                }
                if (timeConsumedColIdx === -1 && idx !== timeColIdx && (text.includes('time') || text.includes('时间') || text.includes('время')) && idx >= 3) {
                    timeConsumedColIdx = idx;
                }
                if (memoryConsumedColIdx === -1 && (text.includes('memory') || text.includes('内存') || text.includes('память'))) {
                    memoryConsumedColIdx = idx;
                }
                if (text.includes('hacker') || text.includes('defender')) {
                    isHacks = true;
                    isStatusOrHacks = true;
                }
            });

            if (!isStatusOrHacks) return; // Skip if it's not a status or hacks table (e.g., contest list)

            let shouldShowRating = false;
            if (isHacks) {
                shouldShowRating = appSettings.show.hacks;
            } else if (isSubmissionsPage) {
                shouldShowRating = appSettings.show.submissions;
            } else {
                shouldShowRating = appSettings.show.status;
            }

            if (!shouldShowRating && !appSettings.timeFormat.enabled && langColIdx === -1) return;

            // Process Header (Rating Column and Time)
            if (!headerRow.hasAttribute('data-cf-rating-processed')) {
                headerRow.setAttribute('data-cf-rating-processed', 'true');

                // 1) # Column - Never wrap, compact width
                if (idColIdx !== -1 && headerRow.cells[idColIdx]) {
                    headerRow.cells[idColIdx].classList.add('id-cell');
                }

                // 2) Append timezone to Time column header
                if (timeColIdx !== -1 && headerRow.cells[timeColIdx]) {
                    const th = headerRow.cells[timeColIdx];
                    th.classList.add('cf-table-time-header');
                    let tzStr = 'UTC+3'; // Codeforces default server time (MSK)

                    const firstDataRow = table.querySelector('tr:not(:first-child)');
                    if (firstDataRow && firstDataRow.cells[timeColIdx]) {
                        const tzMatch = firstDataRow.cells[timeColIdx].textContent.match(/UTC[+-]?\d*(:\d+)?/i);
                        if (tzMatch) {
                            tzStr = tzMatch[0].toUpperCase();
                        }
                    }
                    th.innerHTML = `${th.innerHTML}<br><span class="cf-time-timezone-label" style="font-size: 0.85em; opacity: 0.8;">(${tzStr})</span>`;
                }

                // 3) Who Column
                if (whoColIdx !== -1 && headerRow.cells[whoColIdx]) {
                    headerRow.cells[whoColIdx].classList.add('status-party-cell');
                }

                // 4) Lang Column
                if (langColIdx !== -1 && headerRow.cells[langColIdx]) {
                    headerRow.cells[langColIdx].classList.add('cf-table-lang-header');
                }

                // 5) Verdict Column - Allow controlled wrapping, do NOT set white-space: nowrap
                if (verdictColIdx !== -1 && headerRow.cells[verdictColIdx]) {
                    headerRow.cells[verdictColIdx].classList.add('status-verdict-cell');
                }

                // 6) Time & Memory Consumed
                if (timeConsumedColIdx !== -1 && headerRow.cells[timeConsumedColIdx]) {
                    headerRow.cells[timeConsumedColIdx].classList.add('cf-time-consumed-header');
                }
                if (memoryConsumedColIdx !== -1 && headerRow.cells[memoryConsumedColIdx]) {
                    headerRow.cells[memoryConsumedColIdx].classList.add('cf-memory-consumed-header');
                }

                // 7) Rating Column
                if (shouldShowRating) {
                    // Remove 'right' class from the previous last header cell
                    const prevTh = headerRow.querySelector('th.right');
                    if (prevTh) prevTh.classList.remove('right');

                    // Create new Rating header
                    const th = document.createElement('th');
                    th.className = 'top right cf-rating-col';
                    th.textContent = 'Rating';
                    headerRow.appendChild(th);
                }
            }

            // Process data rows
            const dataRows = table.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                // 1) # Column
                if (idColIdx !== -1 && row.cells[idColIdx]) {
                    row.cells[idColIdx].classList.add('id-cell');
                }

                // 2) Time Formatting
                if (timeColIdx !== -1 && row.cells[timeColIdx]) {
                    const timeCell = row.cells[timeColIdx];
                    if (!timeCell.hasAttribute('data-cf-time-processed')) {
                        timeCell.setAttribute('data-cf-time-processed', 'true');
                        timeCell.classList.add('cf-table-time-cell');
                        timeCell.setAttribute('data-original-time', timeCell.innerHTML);
                    }
                }

                // 3) Who Column
                if (whoColIdx !== -1 && row.cells[whoColIdx]) {
                    const partyCell = row.cells[whoColIdx];
                    partyCell.classList.add('status-party-cell');
                    if (!partyCell.hasAttribute('data-original-html')) {
                        partyCell.setAttribute('data-original-html', partyCell.innerHTML);
                    }
                    const isTeam = partyCell.querySelector('img[src*="ghost.png"]') ||
                        partyCell.querySelectorAll('a[href*="/profile/"]').length > 1 ||
                        partyCell.querySelector('a[href*="/team/"]') ||
                        partyCell.classList.contains('cf-team-formatted') ||
                        partyCell.classList.contains('cf-team-unformatted');

                    if (isTeam) {
                        partyCell.style.setProperty('word-break', 'break-word', 'important');
                        if (!partyCell.classList.contains('cf-team-formatted')) {
                            partyCell.classList.add('cf-team-unformatted');
                        }
                    }
                }

                // 4) Language Icon Formatting
                if (langColIdx !== -1 && row.cells[langColIdx]) {
                    const langCell = row.cells[langColIdx];
                    const langText = (langCell.title || langCell.textContent).trim();
                    const iconName = getLanguageIconName(langText);
                    const needsProcessing = !langCell.hasAttribute('data-cf-lang-icon-processed') || (iconName && !langCell.querySelector('.cf-lang-icon'));

                    if (needsProcessing) {
                        langCell.setAttribute('data-cf-lang-icon-processed', 'true');
                        langCell.title = langText;

                        const textSpan = langCell.querySelector('.cf-lang-text') || document.createElement('span');
                        textSpan.className = 'cf-lang-text';
                        textSpan.textContent = langText;

                        if (iconName) {
                            let img = langCell.querySelector('.cf-lang-icon');
                            if (!img) {
                                img = document.createElement('img');
                                let svgName = `${iconName}-original.svg`;
                                let customSrc = null;
                                if (iconName === 'go') svgName = 'go-original-wordmark.svg';
                                if (iconName === 'c') {
                                    customSrc = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjMmM5YTQyIiBkPSJNMTE4Ljc2NiA5NS44MmMuODktMS41NDMgMS40NDEtMy4yOCAxLjQ0MS00Ljg0M1YzNi43OGMwLTEuNTU4LS41NS0zLjI5Ny0xLjQ0MS00Ljg0bC01NS4zMiAzMS45NFptMCAwIi8+PHBhdGggZmlsbD0iIzFiNmQyZSIgZD0ibTY4LjM2IDEyNi41ODYgNDYuOTMzLTI3LjA5NGMxLjM1Mi0uNzgxIDIuNTgyLTIuMTI5IDMuNDczLTMuNjcybC01NS4zMi0zMS45NEw4LjEyIDk1LjgyYy44OSAxLjU0MyAyLjEyMSAyLjg5IDMuNDczIDMuNjcybDQ2LjkzMyAyNy4wOTRjMi43MDMgMS41NjIgNy4xMyAxLjU2MiA5LjgzMiAwWm0wIDAiLz48cGF0aCBmaWxsPSIjNWNjYjc0IiBkPSJNMTE4Ljc2NiAzMS45NDFjLS44OTEtMS41NDYtMi4xMjEtMi44OTQtMy40NzMtMy42NzFMNjguMzU5IDEuMTcyYy0yLjcwMy0xLjU2My03LjEyOS0xLjU2My05LjgzMiAwTDExLjU5NCAyOC4yN0M4Ljg5IDI5LjgyOCA2LjY4IDMzLjY2IDYuNjggMzYuNzh2NTQuMTk2YzAgMS41NjIuNTUgMy4zIDEuNDQxIDQuODQzTDYzLjQ0NSA2My44OFptMCAwIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTYzLjQ0NSAyNi4wMzVjLTIwLjg2NyAwLTM3Ljg0MyAxNi45NzctMzcuODQzIDM3Ljg0NHMxNi45NzYgMzcuODQ0IDM3Ljg0MyAzNy44NDRjMTMuNDY1IDAgMjYuMDI0LTcuMjQ3IDMyLjc3LTE4LjkxTDc5Ljg0IDczLjMzNWMtMy4zOCA1Ljg0LTkuNjYgOS40NjUtMTYuMzk1IDkuNDY1LTEwLjQzMyAwLTE4LjkyMi04LjQ4OC0xOC45MjItMTguOTIyIDAtMTAuNDM0IDguNDktMTguOTIyIDE4LjkyMi0xOC45MjIgNi43MyAwIDEzLjAxNyAzLjYyOSAxNi4zOSA5LjQ2NWwxNi4zOC05LjQ3N2MtNi43NS0xMS42NjQtMTkuMzA1LTE4LjkxLTMyLjc3LTE4LjkxeiIvPjwvc3ZnPg==';
                                }
                                if (iconName === 'd') {
                                    customSrc = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjYjAxYzJlIiBkPSJNMTE4Ljc2NiA5NS44MmMuODktMS41NDMgMS40NDEtMy4yOCAxLjQ0MS00Ljg0M1YzNi43OGMwLTEuNTU4LS41NS0zLjI5Ny0xLjQ0MS00Ljg0bC01NS4zMiAzMS45NFptMCAwIi8+PHBhdGggZmlsbD0iIzhhMTIyMSIgZD0ibTY4LjM2IDEyNi41ODYgNDYuOTMzLTI3LjA5NGMxLjM1Mi0uNzgxIDIuNTgyLTIuMTI5IDMuNDczLTMuNjcybC01NS4zMi0zMS45NEw4LjEyIDk1LjgyYy44OSAxLjU0MyAyLjEyMSAyLjg5IDMuNDczIDMuNjcybDQ2LjkzMyAyNy4wOTRjMi43MDMgMS41NjIgNy4xMyAxLjU2MiA5LjgzMiAwWm0wIDAiLz48cGF0aCBmaWxsPSIjZDkzODRkIiBkPSJNMTE4Ljc2NiAzMS45NDFjLS44OTEtMS41NDYtMi4xMjEtMi44OTQtMy40NzMtMy42NzFMNjguMzU5IDEuMTcyYy0yLjcwMy0xLjU2My03LjEyOS0xLjU2My05LjgzMiAwTDExLjU5NCAyOC4yN0M4Ljg5IDI5LjgyOCA2LjY4IDMzLjY2IDYuNjggMzYuNzh2NTQuMTk2YzAgMS41NjIuNTUgMy4zIDEuNDQxIDQuODQzTDYzLjQ0NSA2My44OFptMCAwIi8+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMzUgMjYuMyB2NzUuNCBoMjAgYSAzNy43IDM3LjcgMCAwIDAgMCAtNzUuNCB6IE01MCA0MS4zIGg1IGEgMjIuNyAyMi43IDAgMCAxIDAgNDUuNCBoLTUgeiIvPjwvc3ZnPg==';
                                }
                                if (iconName === 'io') {
                                    customSrc = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNTEuMDA4ODg1LC0xLjI0NDExOTEpIj48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLjAxMDkzODMsMCwwLDAuOTg5MTgwMDMsMCwwLjg2NDM4NDUyKSIgZmlsbD0iI2E5MTg4ZCIgZD0ibSAtMzkuNzgzMDA0LDUxLjcwOTkzNyAxLjY3ODcxMiwwIGMgMS42NTIwNjIsMWUtNiAyLjY0MjQxMiwtMC4zOTk2OTIgMi45NzEwNTUsLTEuMTk5MDgxIDAuMzI4NjMsLTAuNzk5MzgzIDAuNDkyOTQ4LC00LjYyNzU1NCAwLjQ5Mjk1NSwtMTEuNDg0NTI1IGwgMCwtOS4wMzMwNzIgYyAtN2UtNiwtNy4xMDU2MzEgLTAuMTQyMTIsLTExLjAyMjYyMyAtMC40MjYzNCwtMTEuNzUwOTg4IC0wLjI4NDIzMiwtMC43MjgyOTQgLTEuMTM2OTExLC0xLjA5MjQ1OSAtMi41NTgwMzgsLTEuMDkyNDk1IGwgLTIuMTU4MzQ0LDAgMCwtMS42Nzg3MTMgYyAyLjk0ODg0NSwwLjEyNDM4NyA1Ljg2MjE2MywwLjE4NjU2MiA4LjczOTk2MywwLjE4NjUyNCAyLjM5ODE0OCwzLjhlLTUgNC41NzQyNTUsLTAuMDYyMTQgNi41MjgzMjcsLTAuMTg2NTI0IGwgMCwxLjY3ODcxMyAtMi4wNTE3NiwwIGMgLTEuMjYxMjY5LDMuNmUtNSAtMi4wNTE3NzMsMC4xNTEwMzEgLTIuMzcxNTE1LDAuNDUyOTg2IC0wLjMxOTc2NiwwLjMwMjAyNiAtMC41MDYyOSwxLjA2NTg4NCAtMC41NTk1NywyLjI5MTU3NiAtMC4wODg4MywxLjkwMDc5NSAtMC4xMzMyNDMsNS4yODQ4NjMgLTAuMTMzMjMyLDEwLjE1MjIxMyBsIDAsOS4xOTI5NSBjIC0xLjFlLTUsNi45MTAyNjMgMC4xNTA5ODQsMTAuNzE2MjI5IDAuNDUyOTg2LDExLjQxNzkxIDAuMzAxOTc4LDAuNzAxNjg1IDEuMjcwMTI0LDEuMDUyNTI3IDIuOTA0NDM5LDEuMDUyNTI2IGwgMS43NTg2NTIsMCAwLDEuNjc4NzEyIGMgLTIuMTg1MDA2LC0wLjEyNDM0OSAtNC41NjU0LC0wLjE4NjUyMyAtNy4xNDExOSwtMC4xODY1MjMgLTMuMDAyMTQ5LDAgLTUuNzExMTc5LDAuMDYyMTcgLTguMTI3MSwwLjE4NjUyMyB6Ii8+PHBhdGggZmlsbD0iI2E5MTg4ZCIgZD0ibSAtMjMuMjYyNTg0LDM4LjAzMzg2NyBjIDAuMzAxNDY2LC0yLjUzNzE0NCAxLjExMDIzOCwtNC43NTA1OTIgMi40MjYzMTksLTYuNjQwMzQ5IDEuMzE2MDY4LC0xLjg4OTcyIDMuMDEwNjgsLTMuMjY5MTU1IDUuMDgzODM4LC00LjEzODMxMiAyLjA3MzEzNywtMC44NjkxMTIgNC4zNDE0MDYsLTEuMTE5Njg3IDYuODA0ODEzOCwtMC43NTE3MjQgMy41NjkzODQsMC41MzMyMzEgNi4yODg5NTQsMi4xMTgzMTQgOC4xNTg3MTcwNCw0Ljc1NTI1MiAxLjg2OTcxMjk2LDIuNjM2OTggMi41NzUyMDE5Niw1Ljg4NTkwNSAyLjExNjQ3MTk2LDkuNzQ2Nzg3IC0wLjU0MTc5ODk2LDQuNTU5NTM5IC0yLjM3MTQyOSw3Ljk3MjM5OCAtNS40ODg4OTcsMTAuMjM4NTgzIC0yLjc4MzEwNiwyLjAzNTQ2NyAtNS45MTc0NTI4LDIuNzkyODU3IC05LjQwMzA1MjgsMi4yNzIxNzEgLTMuMzUxNTYzLC0wLjUwMDY2NyAtNS45MzE5NzUsLTIuMTQ0NDg0IC03Ljc0MTI0NSwtNC45MzE0NjIgLTEuODA5MjgxLC0yLjc4Njk3NCAtMi40NjE2MDIsLTYuMzAzOTUxIC0xLjk1Njk2NSwtMTAuNTUwOTQ2IHogbSA0Ljk1ODM0NywtMS4yNTIwOTEgYyAtMC40NTAwMjcsMy43ODczNjYgLTAuMTI3MDQxLDcuMTMzNTIzIDAuOTY4OTYxLDEwLjAzODQ3OSAxLjA5NTk4MiwyLjkwNDk2NSAyLjk3NjIyLDQuNTU2NDYgNS42NDA3MTgsNC45NTQ0ODggMi4wMjc2NzI4LDAuMzAyOSAzLjc2NjIzMzgsLTAuMjk4MTIgNS4yMTU2ODU4LC0xLjgwMzA2MiAxLjQ0OTQxMiwtMS41MDQ5NCAyLjM3ODM4NCwtMy45NzY0MjcgMi43ODY5MiwtNy40MTQ0NjggMC4zMjk4NDUsLTIuNzc2MTU3IDAuMjQ2ODA2LC01LjIzNTA5NCAtMC4yNDkxMTgsLTcuMzc2ODIxIC0wLjQ5NTk3MSwtMi4xNDE2OTMgLTEuMjkyMDY0LC0zLjc2Njg5NCAtMi4zODgyOCwtNC44NzU2MDcgLTEuMDk2MjU5LC0xLjEwODY3IC0yLjM5MDA5NywtMS43NzQ0MTQgLTMuODgxNTIxOCwtMS45OTcyMzEgLTEuMzIzODgsLTAuMTk3NzQgLTIuNTYxNTYsLTAuMDA4NCAtMy43MTMwNDcsMC41NjgwMyAtMS4xNTE1MTMsMC41NzY0NjkgLTIuMDUxODExLDEuNDQzMDQ3IC0yLjcwMDksMi41OTk3MzcgLTAuODg1ODcyLDEuNTcwNDM3IC0xLjQ0NTY3OCwzLjMzOTI1NCAtMS42Nzk0MTgsNS4zMDY0NTUgeiIvPjwvZz48L3N2Zz4=';
                                }
                                img.src = customSrc || `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${svgName}`;
                                img.className = 'cf-lang-icon';
                            }
                            langCell.innerHTML = '';
                            langCell.appendChild(img);
                            langCell.appendChild(textSpan);
                        } else {
                            langCell.innerHTML = '';
                            langCell.appendChild(textSpan);
                        }
                    }
                }

                // 5) Verdict Abbreviation
                if (verdictColIdx !== -1) {
                    const verdictCell = row.cells[verdictColIdx];
                    if (verdictCell && !verdictCell.hasAttribute('data-cf-verdict-processed')) {
                        verdictCell.setAttribute('data-cf-verdict-processed', 'true');
                        verdictCell.classList.add('status-verdict-cell');
                        walkAndReplaceVerdict(verdictCell);
                    }
                }

                // 6) Time & Memory Consumed
                if (timeConsumedColIdx !== -1 && row.cells[timeConsumedColIdx]) {
                    row.cells[timeConsumedColIdx].classList.add('time-consumed-cell');
                }
                if (memoryConsumedColIdx !== -1 && row.cells[memoryConsumedColIdx]) {
                    row.cells[memoryConsumedColIdx].classList.add('memory-consumed-cell');
                }

                if (row.hasAttribute('data-cf-rating-processed')) return;
                row.setAttribute('data-cf-rating-processed', 'true');

                // Skip empty/info rows (like "No submissions found")
                if (row.cells.length <= 1) {
                    if (row.cells.length === 1 && shouldShowRating) {
                        row.cells[0].colSpan = (parseInt(row.cells[0].colSpan) || 1) + 1;
                    }
                    return;
                }

                if (!shouldShowRating) return;

                // Remove 'right' class from the previous last data cell
                const prevTd = row.querySelector('td.right');
                if (prevTd) prevTd.classList.remove('right');

                // Find rating from links in the row
                let problemRating = null;
                const links = row.querySelectorAll('a[href*="/problem/"]');
                for (const link of links) {
                    const info = getProblemRatingFromHref(link.href, link.textContent);
                    if (info && typeof info.rating === 'number') {
                        problemRating = info.rating;
                    }
                    // Mark ALL problem links in the datatable so the standalone logic ignores them
                    link.setAttribute('data-cf-rating-added', 'true');
                }

                // Create new Rating cell
                const td = document.createElement('td');
                td.className = 'right cf-rating-col';
                td.style.textAlign = 'center';
                td.style.verticalAlign = 'middle';
                td.style.width = '52px';
                td.style.minWidth = '52px';
                td.style.maxWidth = '52px';
                td.style.setProperty('white-space', 'nowrap', 'important');

                if (typeof problemRating === 'number') {
                    applyRatingStyle(td, problemRating);
                } else {
                    td.textContent = '';
                }
                row.appendChild(td);
            });
            formatStandingsCells();
        });

        // 1.5 Handle Standings tables specifically (adding a whole new row under the header)
        const standingsTables = document.querySelectorAll('table.standings:not([data-cf-rating-standings-processed])');
        standingsTables.forEach(table => {
            table.setAttribute('data-cf-rating-standings-processed', 'true');

            const headerRow = table.querySelector('tr');
            if (!headerRow) return;

            const ratingRow = document.createElement('tr');
            ratingRow.className = 'cf-rating-standings-row';

            let hasRatings = false;

            Array.from(headerRow.cells).forEach(cell => {
                const newCell = document.createElement('th');
                newCell.style.padding = '0.3em'; // minimal padding

                const link = cell.querySelector('a[href*="/problem/"]');
                if (link) {
                    const probName = link.getAttribute('title') || cell.getAttribute('title') || link.textContent;
                    const info = getProblemRatingFromHref(link.href, probName);
                    if (info && typeof info.rating === 'number') {
                        hasRatings = true;
                        applyRatingStyle(newCell, info.rating);
                        if (appSettings.displayStyle === 'block') {
                            newCell.style.setProperty('font-size', '0.9em', 'important');
                            newCell.style.setProperty('padding', '0.2em', 'important');
                        }

                        // Mark the link so it's skipped by standalone processor
                        link.setAttribute('data-cf-rating-added', 'true');
                    }
                }
                ratingRow.appendChild(newCell);
            });

            if (hasRatings) {
                // Insert the new rating row right below the header row
                headerRow.parentNode.insertBefore(ratingRow, headerRow.nextSibling);
            }
        });

        // 1.8 Handle Problemset & Contest Problems tables specifically (adding a new column to the last column)
        const problemsTables = document.querySelectorAll('table.problems:not([data-cf-rating-problems-processed])');
        problemsTables.forEach(table => {
            const isProblemset = window.location.pathname.toLowerCase().includes('/problemset');
            const shouldShowRating = isProblemset ? appSettings.show.problemset : appSettings.show.contestProblems;

            if (isProblemset) table.classList.add('cf-table-problemset');
            else table.classList.add('cf-table-contestProblems');

            table.setAttribute('data-cf-rating-problems-processed', 'true');

            const headerRow = table.querySelector('tr');
            if (headerRow) {
                const prevTh = headerRow.querySelector('th.right') || headerRow.lastElementChild;
                if (prevTh && prevTh.classList.contains('right')) {
                    prevTh.classList.remove('right');
                }

                const th = document.createElement('th');
                th.className = 'top right cf-rating-col';
                th.style.width = '4.5em';
                th.style.textAlign = 'center';
                th.textContent = 'Rating';

                headerRow.appendChild(th);
            }

            const dataRows = table.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                if (row.cells.length < 2) return;

                const idCell = row.querySelector('td.id');

                const prevTd = row.querySelector('td.right') || row.lastElementChild;
                if (prevTd && prevTd.classList.contains('right')) {
                    prevTd.classList.remove('right');
                }

                const td = document.createElement('td');
                td.className = 'right cf-rating-col';
                td.style.textAlign = 'center';
                td.style.verticalAlign = 'middle';

                const link = idCell ? idCell.querySelector('a') : row.querySelector('a[href*="/problem/"]');

                if (link) {
                    const titleLink = row.querySelector('td:nth-child(2) a') || row.querySelector('a[href*="/problem/"]:not([href$="' + link.getAttribute('href') + '"])');
                    const probName = titleLink ? titleLink.textContent : row.textContent;
                    const info = getProblemRatingFromHref(link.href, probName);
                    if (info && typeof info.rating === 'number') {
                        applyRatingStyle(td, info.rating);
                    }

                    const rowLinks = row.querySelectorAll('a[href*="/problem/"]');
                    rowLinks.forEach(l => l.setAttribute('data-cf-rating-added', 'true'));
                }

                row.appendChild(td);

                // Fix the CF accepted/rejected status styling
                if (row.classList.contains('accepted-problem') || row.classList.contains('rejected-problem')) {
                    Array.from(row.cells).forEach(cell => {
                        if (cell === td) return;
                        if (row.classList.contains('rejected-problem')) {
                            cell.style.setProperty('background-color', '#ffdddd', 'important');
                        }
                    });
                }
            });
        });

        // 3. Handle actual Problem Page tags (sidebar tags)
        updateProblemPageRatingTag(safeRatingsMap);
    }

    function formatTimeStr(text) {
        if (!appSettings.timeFormat.enabled) return null;

        // Extract any UTC suffix (e.g. "UTC+8", "UTC-5", "UTC+3")
        let tzSuffix = '';
        const tzMatch = text.match(/UTC[+-]?\d*(:\d+)?/i);
        if (tzMatch) {
            tzSuffix = tzMatch[0].toUpperCase();
        }

        // Clean text for parsing
        let cleanText = text.replace(/UTC.*$/i, '').trim();

        let d = new Date(cleanText);
        if (isNaN(d.getTime())) {
            // Try parsing Codeforces format: MMM/DD/YYYY HH:MM
            const cfMatch = cleanText.match(/([A-Za-z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?/);
            if (cfMatch) {
                const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
                const m = months[cfMatch[1].toLowerCase()];
                if (m) {
                    const hh = cfMatch[4].padStart(2, '0');
                    const mm = cfMatch[5].padStart(2, '0');
                    const ss = (cfMatch[7] || '00').padStart(2, '0');
                    d = new Date(`${cfMatch[3]}-${String(m).padStart(2, '0')}-${String(cfMatch[2]).padStart(2, '0')}T${hh}:${mm}:${ss}`);
                }
            }

            // Try parsing Russian format: DD.MM.YYYY HH:MM:SS
            const ruMatch = cleanText.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?/);
            if (ruMatch) {
                const hh = ruMatch[4].padStart(2, '0');
                const mm = ruMatch[5].padStart(2, '0');
                const ss = (ruMatch[7] || '00').padStart(2, '0');
                d = new Date(`${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}T${hh}:${mm}:${ss}`);
            }
        }

        if (!isNaN(d.getTime())) {
            return customFormatTime(d, appSettings.timeFormat.format);
        }
        return null;
    }

    function wrapVirtualParticipationTime() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        const dateRegex = /([A-Za-z]{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i;
        while (walker.nextNode()) {
            if (walker.currentNode.parentElement && walker.currentNode.parentElement.closest('.format-time, .format-date, .cf-formatted-time, .cf-table-time-cell')) {
                continue; // Skip already formatted text
            }
            if (dateRegex.test(walker.currentNode.nodeValue)) {
                nodes.push(walker.currentNode);
            }
        }
        nodes.forEach(node => {
            const match = node.nodeValue.match(dateRegex);
            if (match) {
                const timeStr = match[1];
                const timeIndex = node.nodeValue.indexOf(timeStr);
                const afterTime = node.nodeValue.substring(timeIndex + timeStr.length);

                node.nodeValue = node.nodeValue.substring(0, timeIndex);

                const span = document.createElement('span');
                span.className = 'cf-formatted-time';
                span.textContent = timeStr;

                const afterNode = document.createTextNode(afterTime);

                node.parentNode.insertBefore(span, node.nextSibling);
                node.parentNode.insertBefore(afterNode, span.nextSibling);
            }
        });
    }

    function applyTimeFormatting() {
        const timeSpans = document.querySelectorAll('.format-time, .format-date, .cf-formatted-time, .cf-table-time-cell');
        timeSpans.forEach(span => {
            span.classList.add('cf-formatted-time');
            let origHTML = span.getAttribute('data-original-time');
            if (!origHTML) {
                origHTML = span.innerHTML;
                span.setAttribute('data-original-time', origHTML);
            }
            if (origHTML.length < 8) return;

            if (appSettings.timeFormat.enabled) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = origHTML;
                const textContent = tempDiv.textContent.trim();
                const newTime = formatTimeStr(textContent);
                if (newTime) {
                    span.innerHTML = newTime;
                    span.classList.remove('format-time', 'format-date');
                } else {
                    span.innerHTML = origHTML;
                }
            } else {
                span.innerHTML = origHTML;
            }
        });
    }

    // Observe DOM changes to apply ratings to newly loaded elements (e.g. via AJAX/PJAX)
    let isMutationProcessing = false;
    let observerDebounceTimer = null;
    const PLUGIN_IGNORE_SELECTOR = '.cf-settings-modal, .cf-clist-modal-overlay, .cf-storage-json-modal, .cf-confirm-modal-overlay, .cf-guide-modal-overlay, .cf-toast-notification, .cf-floating-tooltip, #cf-ratings-settings-btn, .pcr-app, .roundbox.sidebox, #sidebar';

    function isPluginIgnoredElement(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.id && el.id.startsWith('cf-')) return true;
        if (el.className && typeof el.className === 'string') {
            if (el.className.includes('cf-json-') || el.className.includes('cf-storage-') || el.className.includes('cf-modal-') || el.className.includes('cf-tab-')) return true;
        }
        return !!el.closest?.(PLUGIN_IGNORE_SELECTOR);
    }

    function setupObserver(ratingsMap) {
        const observer = new MutationObserver((mutations) => {
            if (isMutationProcessing) return;
            let shouldApply = false;
            for (const mutation of mutations) {
                if (mutation.target && isPluginIgnoredElement(mutation.target)) {
                    continue;
                }
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && !isPluginIgnoredElement(node) && !node.classList?.contains('cf-tags-hidden-notice')) {
                        shouldApply = true;
                        break;
                    }
                }
                if (shouldApply) break;
            }
            if (shouldApply) {
                clearTimeout(observerDebounceTimer);
                observerDebounceTimer = setTimeout(() => {
                    if (isMutationProcessing) return;
                    isMutationProcessing = true;
                    try {
                        applyRatings(ratingsMap);
                        formatStandingsCells();
                        applyUserAvatars();
                        applyProblemTagsVisibility();
                        wrapVirtualParticipationTime();
                        setTimeout(applyTimeFormatting, 300);
                    } finally {
                        setTimeout(() => { isMutationProcessing = false; }, 200);
                    }
                }, 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    const DEFAULT_AVATAR_URL = 'https://codeforces.com/userpic.codeforces.org/no-avatar.jpg';

    function normalizeAvatarUrl(url) {
        if (!url) return '';
        // 核心修复：直连 userpic.codeforces.org 返回 503 Service Unavailable，必须走 codeforces.com 反代路径
        if (url.includes('userpic.codeforces.org')) {
            return url.replace(/^(?:https?:)?\/\/userpic\.codeforces\.org\//, 'https://codeforces.com/userpic.codeforces.org/');
        }
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return 'https://codeforces.com' + url;
        return url;
    }

    function updateAvatarCacheUrl(handle, workingUrl) {
        if (!handle || !workingUrl) return;
        try {
            const cache = appStorage.getJSON(AVATAR_CACHE_KEY, null);
            if (cache && cache[handle]) {
                cache[handle].url = workingUrl;
                appStorage.setJSON(AVATAR_CACHE_KEY, cache);
            }
        } catch (e) { }
    }

    async function applyUserAvatars() {
        if (!appSettings.show.userAvatar) return;

        // 兼容相对路径与绝对路径 (/profile/xxx 与 https://codeforces.com/profile/xxx)
        const userLinks = document.querySelectorAll('a[href*="/profile/"]:not([data-cf-avatar-processed])');
        const handlesToFetch = new Set();
        const handleToElements = {};

        userLinks.forEach(link => {
            // Skip if it already has an img (like titlePhoto or similar icon)
            if (link.querySelector('img')) return;

            // Skip if it's inside a native CF avatar container or profile main-info
            if (link.closest('.avatar, .main-info')) return;

            // Skip if it's a comment author (comments already have native CF avatar box on the left)
            // Mentions inside the text body (.ttypography) and topic authors should receive avatars.
            if (link.closest('.comment') && !link.closest('.ttypography')) return;

            const href = link.getAttribute('href');
            if (!href) return;
            const match = href.match(/\/profile\/([^/?#]+)(?:[?#]|$)/i);
            if (!match) return;

            const handle = decodeURIComponent(match[1]);
            if (link.textContent.trim().toLowerCase() === handle.toLowerCase()) {
                link.setAttribute('data-cf-avatar-processed', 'true');
                handlesToFetch.add(handle);
                if (!handleToElements[handle]) handleToElements[handle] = [];
                handleToElements[handle].push(link);
            }
        });

        if (handlesToFetch.size === 0) return;

        let avatarCache = appStorage.getJSON(AVATAR_CACHE_KEY, {}) || {};

        const now = Date.now();
        let missingHandles = [];

        for (const handle of handlesToFetch) {
            const cachedData = avatarCache[handle];
            if (cachedData && (now - cachedData.time < CACHE_EXPIRY)) {
                injectAvatar(handleToElements[handle], cachedData.url, cachedData.fallbackUrl, handle);
            } else {
                missingHandles.push(handle);
            }
        }

        if (missingHandles.length > 0) {
            try {
                const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.includes('codeforces'))
                    ? `${window.location.origin}/api/user.info`
                    : 'https://codeforces.com/api/user.info';

                while (missingHandles.length > 0) {
                    const url = `${apiBase}?handles=${missingHandles.map(encodeURIComponent).join(';')}`;
                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.status === 'OK') {
                        for (const user of data.result) {
                            const handle = user.handle;
                            const avatarUrl = normalizeAvatarUrl(user.avatar);
                            const titlePhotoUrl = normalizeAvatarUrl(user.titlePhoto);
                            avatarCache[handle] = { url: avatarUrl, fallbackUrl: titlePhotoUrl, time: now };
                            injectAvatar(handleToElements[handle] || [], avatarUrl, titlePhotoUrl, handle);
                        }
                        appStorage.setJSON(AVATAR_CACHE_KEY, avatarCache);
                        break;
                    } else if (data.status === 'FAILED' && data.comment) {
                        const match = data.comment.match(/User with handle (.*?) not found/i);
                        if (match) {
                            const missing = match[1];
                            missingHandles = missingHandles.filter(h => h.toLowerCase() !== missing.toLowerCase());
                            avatarCache[missing] = { url: DEFAULT_AVATAR_URL, fallbackUrl: '', time: now };
                            injectAvatar(handleToElements[missing] || [], DEFAULT_AVATAR_URL, '', missing);
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            } catch (e) {
                console.error('Codeforces Rating Helper: Failed to fetch user avatars', e);
            }
        }
    }

    function injectAvatar(elements, url, fallbackUrl, handle) {
        url = normalizeAvatarUrl(url) || DEFAULT_AVATAR_URL;
        fallbackUrl = normalizeAvatarUrl(fallbackUrl);

        elements.forEach(el => {
            const td = el.closest('td, th');
            const img = document.createElement('img');
            img.src = url;
            img.className = 'cf-user-avatar-container cf-user-avatar';
            img.style.cssText = `width: var(--cf-avatar-size); height: var(--cf-avatar-size); border-radius: 50%; vertical-align: middle; margin-right: 4px; border: 1px solid rgba(0,0,0,0.1); display: inline-block; object-fit: cover;`;

            // Auto-heal on 503 / 404 / broken avatar load errors
            img.onerror = function () {
                if (fallbackUrl && this.src !== fallbackUrl) {
                    this.src = fallbackUrl;
                } else if (this.src !== DEFAULT_AVATAR_URL) {
                    this.src = DEFAULT_AVATAR_URL;
                } else {
                    this.style.display = 'none';
                }
            };

            const isTableLayout = td && el.closest('table.status-frame-datatable, div.datatable table, table.rtable') && !el.closest('.ttypography');

            if (isTableLayout) {
                td.style.setProperty('text-align', 'left', 'important');
                td.style.setProperty('vertical-align', 'middle', 'important');

                const anchor = document.createElement('a');
                anchor.href = el.href;
                anchor.title = el.textContent.trim();
                anchor.className = 'cf-avatar-container';
                anchor.appendChild(img);

                const wrapper = document.createElement('span');
                wrapper.className = 'cf-avatar-line-wrapper';

                let currentStart = el;
                let nodesToWrap = [el];

                while (currentStart.previousSibling) {
                    let prev = currentStart.previousSibling;
                    if (prev.tagName === 'BR') break;

                    if (prev.nodeType === Node.TEXT_NODE) {
                        if (/^[\s*]*$/.test(prev.textContent)) {
                            nodesToWrap.unshift(prev);
                            currentStart = prev;
                        } else {
                            break;
                        }
                    } else if (prev.nodeType === Node.ELEMENT_NODE) {
                        const isInlineAndEmpty = ['SPAN', 'SMALL', 'SUP', 'SUB', 'I', 'B', 'EM', 'STRONG'].includes(prev.tagName) && /^[\s*]*$/.test(prev.textContent);
                        const isFlagOrImg = prev.tagName === 'IMG' || prev.classList.contains('standings-flag');

                        if (isInlineAndEmpty || isFlagOrImg) {
                            nodesToWrap.unshift(prev);
                            currentStart = prev;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                // Also collect trailing elements attached to the user (e.g. <sup title="Virtual participant">, badges, or trailing marks)
                let currentEnd = el;
                while (currentEnd.nextSibling) {
                    let next = currentEnd.nextSibling;
                    if (next.tagName === 'BR') break;

                    if (next.nodeType === Node.TEXT_NODE) {
                        if (/^[\s*]*$/.test(next.textContent)) {
                            nodesToWrap.push(next);
                            currentEnd = next;
                        } else {
                            break;
                        }
                    } else if (next.nodeType === Node.ELEMENT_NODE) {
                        const isSupOrSymbol = ['SUP', 'SUB', 'SPAN', 'I', 'SMALL'].includes(next.tagName);
                        if (isSupOrSymbol) {
                            nodesToWrap.push(next);
                            currentEnd = next;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                el.parentNode.insertBefore(wrapper, currentStart);
                wrapper.appendChild(anchor);
                nodesToWrap.forEach(node => wrapper.appendChild(node));

                if (td.classList.contains('status-party-cell') || td.closest('.status-party-cell')) {
                    const isTeamTd = td.classList.contains('cf-team-formatted') ||
                        td.classList.contains('cf-team-unformatted') ||
                        td.querySelector('img[src*="ghost.png"]') ||
                        td.querySelectorAll('a[href*="/profile/"]').length > 1 ||
                        td.querySelector('a[href*="/team/"]');

                    if (isTeamTd) {
                        el.style.setProperty('max-width', '180px', 'important');
                    }
                }
            } else {
                el.classList.add('cf-avatar-inline-user');
                el.style.setProperty('white-space', 'nowrap', 'important');
                el.insertBefore(img, el.firstChild);

                if (el.closest('.right-meta')) {
                    const prevA = el.previousElementSibling;
                    if (prevA && prevA.matches('a') && prevA.querySelector('img[src*="user_16x16"]')) {
                        prevA.classList.add('cf-author-icon-hidden');
                    }
                }

                if (el.closest('.second-level-menu-list')) {
                    syncSecondLevelMenuLava();
                    img.addEventListener('load', syncSecondLevelMenuLava);
                    setTimeout(syncSecondLevelMenuLava, 150);
                }
            }
        });
    }

    function syncSecondLevelMenuLava() {
        const menu = document.querySelector('.second-level-menu-list');
        const active = menu?.querySelector('li.selectedLava, li.current');
        const lava = menu?.querySelector('li.backLava');
        if (active && lava && active.offsetWidth > 0) {
            lava.style.width = active.offsetWidth + 'px';
            lava.style.left = active.offsetLeft + 'px';
        }
    }

    // Initialization
    async function init() {
        applyProblemTagsVisibility();
        applyUserAvatars();
        setTimeout(syncSecondLevelMenuLava, 150);
        const ratingsMap = await getRatings();
        latestRatingsMap = ratingsMap;
        applyRatings(ratingsMap);
        formatStandingsCells();
        applyProblemTagsVisibility();
        wrapVirtualParticipationTime();
        setTimeout(applyTimeFormatting, 500);
        setupObserver(ratingsMap);
    }

    function createSettingsUI() {
        if (document.getElementById('cf-ratings-settings-btn')) return;

        let selectedColor = appSettings.acBgColor;
        let applySettingsRealTime = () => {
            appSettings.acBgColor = selectedColor;
            if (typeof cbHideTags !== 'undefined') {
                appSettings.hideTags = cbHideTags.checked;
            }
            if (typeof cbHideRatingTag !== 'undefined') {
                appSettings.hideRatingTag = cbHideRatingTag.checked;
            }
            if (typeof cbNotHideAcTags !== 'undefined') {
                appSettings.notHideAcTags = cbNotHideAcTags.checked;
            }
            saveSettings(appSettings);
            applyProblemTagsVisibility();
        };
        let isSyncingInputs = false;
        let checkIfChanged = () => {
            if (isSyncingInputs) return;
            applySettingsRealTime();
        };
        updateFooterRatingStatus = () => { };
        let refreshStorageUI = () => { };
        let pickr = null;

        let currentLang = appSettings.lang || 'en';
        const t = (key, ...args) => {
            if (!key) return getLangDict(currentLang);
            if (args.length > 0 && (args[0] === 'zh' || args[0] === 'en')) {
                return tGlobal(key, args[0], ...args.slice(1));
            }
            return tGlobal(key, currentLang, ...args);
        };

        const CLIST_ICON_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAB3klEQVR4nNWZy1XDMBBFr1wNoRGogONOzA5lRzrh0ICpJKYTlmKBh5CPE400Ix/eMsd5c6+dWP6ARfox8vTxatKlTFfd0I+RFF4IDGtI1AkIvGQFiXKBU3hJY4kygSV4SUMJvcAteEkjCZ1ALrykgUS+gBZe4iyRJ1AKL3GUuC1QCy9xkrguYAUvcZBYFrCGlxhLXBbQwqcQCTxnb28ocS5QAv/+sOXtcbeGxLFAKbxkBYmDQC28pLHEj4AVvKShRGcOL2kk0UH4yt46F16ildCwzOmyh2jhJc79XdaQUniJY//hLLQ0pBbeuf94HTgdYgXfqv83/Rjpx2hf3KhfmzQR0yduNy2u/WkipomUJpLHENf+o3KHITn9xc+F0kQEzlfwxGAhkdtfJLBYvjDEsz+Yl/9NYBfuNJcS+n79EUgorp10R0IFP7OoBcI9O5Jir2ZKqOEhhg3bov+AtUQpPFSchawkauCh8v1ArUQtPBSchS5y6UEEQvWdsCGefmgiAJD2DAS366GzPS+pf0c2R/1zys8iPBgKgIvEVXgwFgBTiZvw4CAAJhJZ8OAkAFUS2fDgKABFEip4cBYAlYQaHhoIQJZEEXzzpD3D2S3ipFqN18+JxP+Cl8w369Gi6xvAY35uBNY3xAAAAABJRU5ErkJggg==';
        const CF_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align: -2px; flex-shrink: 0; display: inline-block;"><rect x="2" y="9" width="4.5" height="13" rx="1.5" fill="#ffd200"/><rect x="9.5" y="2" width="4.5" height="20" rx="1.5" fill="#2487e6"/><rect x="17" y="6" width="4.5" height="16" rx="1.5" fill="#ee3424"/></svg>';

        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        `;

        const btn = document.createElement('div');
        btn.id = 'cf-ratings-settings-btn';
        btn.title = 'Colorforces Settings';
        btn.innerHTML = `
            <svg viewBox="0 0 1024 1024" width="26" height="26" fill="#ffffff">
                <path d="M967.1 426.6l50.9-67.5c-10.6-35.6-24.7-69.6-42.2-101.7l-83.7-11.8C831 237.1 782.9 189 774.3 127.8l-11.8-83.7c-32-17.4-66.1-31.6-101.7-42.2l-67.5 50.9c-24.7 18.6-54 27.9-83.4 27.9s-58.7-9.3-83.4-27.9L359.1 2c-35.6 10.6-69.6 24.7-101.7 42.2l-11.8 83.7C237.1 189 189 237.1 127.8 245.7l-83.7 11.8c-17.4 32-31.6 66.1-42.2 101.7l50.9 67.5C90 476 90 544 52.9 593.4L2 660.9c10.6 35.6 24.7 69.6 42.2 101.7l83.7 11.8c61.2 8.6 109.3 56.7 117.9 117.9l11.8 83.7c32 17.4 66.1 31.6 101.7 42.2l67.5-50.9c24.7-18.6 54-27.9 83.4-27.9s58.7 9.3 83.4 27.9l67.5 50.9c35.6-10.6 69.6-24.7 101.7-42.2l11.8-83.7c8.6-61.2 56.7-109.3 117.9-117.9l83.7-11.8c17.4-32 31.6-66.1 42.2-101.7l-50.9-67.5C930 544 930 476 967.1 426.6zM511.5 710C401.9 710 313 621.1 313 511.5S401.9 313 511.5 313 710 401.9 710 511.5 621.1 710 511.5 710z"></path>
            </svg>
        `;

        const modal = document.createElement('div');
        modal.className = 'cf-settings-modal';
        modal.style.display = 'none';
        preventScrollChaining(modal);

        // 1. Top Header
        const header = document.createElement('div');
        header.className = 'cf-modal-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'cf-header-left';

        const headerTitle = document.createElement('div');
        headerTitle.className = 'cf-header-title';
        headerTitle.innerHTML = `Colorforces <span class="cf-title-version">v${CURRENT_VERSION}</span>`;

        const pluginSubtitle = document.createElement('div');
        pluginSubtitle.className = 'cf-header-subtitle cf-header-badge';

        const pluginSubtitleIcon = document.createElement('span');
        pluginSubtitleIcon.className = 'cf-header-badge-icon';
        pluginSubtitleIcon.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

        const pluginSubtitleText = document.createElement('span');
        pluginSubtitleText.className = 'cf-header-badge-text';

        pluginSubtitle.appendChild(pluginSubtitleIcon);
        pluginSubtitle.appendChild(pluginSubtitleText);

        headerLeft.appendChild(headerTitle);
        headerLeft.appendChild(pluginSubtitle);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'cf-close-btn';
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.title = 'Close';
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            hideFloatingTooltip();
            if (typeof activeTransitionCleanup === 'function') {
                activeTransitionCleanup();
            }
        };

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // 2. Modal Body (Two columns: Sidebar + Content Area)
        const modalBody = document.createElement('div');
        modalBody.className = 'cf-modal-body';

        const sidebar = document.createElement('div');
        sidebar.className = 'cf-sidebar-nav';

        const contentArea = document.createElement('div');
        contentArea.className = 'cf-content-area';

        modalBody.appendChild(sidebar);
        modalBody.appendChild(contentArea);
        modal.appendChild(modalBody);

        // Sidebar Navigation Tabs Setup
        const TAB_ICONS = {
            general: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            appearance: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r="1" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r="1" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r="1" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 9.5 10c.8 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.4-.4-.8-.4-1.4 0-1.1.9-2 2-2h2.4c4.1 0 7.4-3.3 7.4-7.4C24 6.2 18.6 2 12 2z"></path></svg>',
            ratings: '<svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor"><path d="M240 640a64.192 64.192 0 0 1 63.68 57.728 62.912 62.912 0 0 1 0.32 6.272v192a64.896 64.896 0 0 1-10.816 35.584 62.272 62.272 0 0 1-20.288 19.328A64.192 64.192 0 0 1 240 960h-96a64.192 64.192 0 0 1-62.08-48.448A65.664 65.664 0 0 1 80 896v-192a64.384 64.384 0 0 1 28.416-53.248 70.848 70.848 0 0 1 14.08-7.04 68.928 68.928 0 0 1 15.232-3.392A64 64 0 0 1 144 640h96z m0 64h-96v192h96v-192z m320-192a65.024 65.024 0 0 1 35.584 10.752A64.128 64.128 0 0 1 624 576v320a64.896 64.896 0 0 1-10.816 35.584 62.272 62.272 0 0 1-20.288 19.328 63.36 63.36 0 0 1-32.896 9.088h-96a64.192 64.192 0 0 1-62.08-48.448A64.064 64.064 0 0 1 400 896V576a65.024 65.024 0 0 1 10.816-35.584 65.472 65.472 0 0 1 23.04-20.864A63.488 63.488 0 0 1 464 512h96z m0 64h-96v320h96V576z m320-256a65.152 65.152 0 0 1 32.896 9.088 65.92 65.92 0 0 1 18.56 16.768 62.272 62.272 0 0 1 11.328 25.6 63.424 63.424 0 0 1 1.216 12.544v512a64.064 64.064 0 0 1-64 64h-96a64.384 64.384 0 0 1-53.248-28.416 63.616 63.616 0 0 1-10.752-35.584V384a64.192 64.192 0 0 1 48.448-62.08A65.664 65.664 0 0 1 784 320h96z m0 64h-96v512h96V384z m-2.56-314.048a29.632 29.632 0 0 1 9.92-5.12 31.744 31.744 0 0 1 32.448 8.32 32.64 32.64 0 0 1 8.768 18.496 26.688 26.688 0 0 1 0.128 6.4 26.624 26.624 0 0 1-1.152 6.272 25.92 25.92 0 0 1-2.368 5.952 29.952 29.952 0 0 1-6.848 8.832 30.08 30.08 0 0 1-3.776 2.944L587.456 355.712a45.632 45.632 0 0 1-25.792 8.32 44.736 44.736 0 0 1-31.872-13.056L429.632 250.88l-297.6 238.08a31.552 31.552 0 0 1-24.832 6.656 30.08 30.08 0 0 1-11.712-4.224 30.336 30.336 0 0 1-4.48-3.264l-3.968-4.16a30.528 30.528 0 0 1-6.144-12.608 32.192 32.192 0 0 1 11.136-32.32l311.04-248.896a45.696 45.696 0 0 1 24.32-9.6 44.288 44.288 0 0 1 33.856 11.52 45.888 45.888 0 0 1 1.472 1.408l100.736 100.736 313.92-224.256h0.064z" fill="currentColor"></path></svg>',
            user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            shortcuts: '<svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor"><path d="M128 42.666667h768c46.933333 0 85.333333 38.4 85.333333 85.333333v768c0 46.933333-38.4 85.333333-85.333333 85.333333H128c-46.933333 0-85.333333-38.4-85.333333-85.333333V128c0-46.933333 38.4-85.333333 85.333333-85.333333z m0 64c-12.8 0-21.333333 8.533333-21.333333 21.333333v768c0 12.8 8.533333 21.333333 21.333333 21.333333h768c12.8 0 21.333333-8.533333 21.333333-21.333333V128c0-12.8-8.533333-21.333333-21.333333-21.333333H128z m328.533333 520.533333v64c0 34.133333-12.8 59.733333-34.133333 85.333333-25.6 21.333333-51.2 34.133333-85.333333 34.133334s-59.733333-12.8-85.333334-34.133334-38.4-55.466667-38.4-85.333333c0-34.133333 12.8-59.733333 34.133334-85.333333s51.2-34.133333 85.333333-34.133334h64v-115.2H332.8c-34.133333 0-59.733333-12.8-85.333333-34.133333S213.333333 366.933333 213.333333 332.8s12.8-59.733333 34.133334-85.333333S298.666667 213.333333 332.8 213.333333s59.733333 12.8 85.333333 34.133334c25.6 21.333333 34.133333 51.2 34.133334 85.333333v64h115.2V332.8c0-34.133333 12.8-59.733333 34.133333-85.333333 25.6-21.333333 51.2-34.133333 85.333333-34.133334s64 12.8 85.333334 34.133334c25.6 25.6 38.4 51.2 38.4 85.333333s-12.8 59.733333-34.133334 85.333333c-21.333333 25.6-51.2 34.133333-85.333333 34.133334h-64v115.2h64c34.133333 0 59.733333 12.8 85.333333 34.133333 21.333333 25.6 34.133333 51.2 34.133334 85.333333s-12.8 64-34.133334 85.333334c-21.333333 25.6-51.2 34.133333-85.333333 34.133333s-59.733333-12.8-85.333333-34.133333c-25.6-21.333333-34.133333-51.2-34.133334-85.333334v-64h-115.2z m0-59.733333h115.2v-115.2h-115.2v115.2z m-59.733333-170.666667V332.8c0-17.066667-4.266667-34.133333-17.066667-46.933333-12.8-8.533333-29.866667-17.066667-46.933333-17.066667-17.066667 0-34.133333 4.266667-46.933333 17.066667-8.533333 17.066667-17.066667 29.866667-17.066667 46.933333s4.266667 34.133333 17.066667 46.933333c12.8 12.8 25.6 17.066667 46.933333 17.066667h64z m0 230.4H332.8c-17.066667 0-34.133333 4.266667-46.933333 17.066667-12.8 12.8-17.066667 25.6-17.066667 46.933333 0 17.066667 4.266667 34.133333 17.066667 46.933333 12.8 12.8 25.6 17.066667 46.933333 17.066667 17.066667 0 34.133333-4.266667 46.933333-17.066667 12.8-12.8 17.066667-25.6 17.066667-46.933333v-64z m230.4-230.4h64c17.066667 0 34.133333-4.266667 46.933333-17.066667 12.8-12.8 17.066667-25.6 17.066667-46.933333s-4.266667-34.133333-17.066667-46.933333c-12.8-12.8-25.6-17.066667-46.933333-17.066667-17.066667 0-34.133333 4.266667-46.933333 17.066667-12.8 12.8-17.066667 25.6-17.066667 46.933333v64z m0 230.4v64c0 17.066667 4.266667 34.133333 17.066667 46.933333 12.8 12.8 25.6 17.066667 46.933333 17.066667 17.066667 0 34.133333-4.266667 46.933333-17.066667 12.8-12.8 17.066667-25.6 17.066667-46.933333 0-17.066667-4.266667-34.133333-17.066667-46.933333-12.8-12.8-25.6-17.066667-46.933333-17.066667h-64z" fill="currentColor"></path></svg>',
            storage: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
            changelog: '<svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor"><path d="M512 0L39.765333 495.786667H336.213333v317.354666H687.786667v-317.44h296.533333L512 0z m117.162667 437.162667v317.44H394.837333v-317.44H176.469333L512 84.906667l335.616 352.256h-218.453333z m-292.864 422.826666H687.786667v58.538667H336.213333v-58.538667z m0 105.472H687.786667V1024H336.213333v-58.624z" fill="currentColor"></path></svg>',
            roadmap: '<svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor"><path d="M268.8 524.8a166.4 166.4 0 1 1 0 332.8 166.4 166.4 0 0 1 0-332.8z m678.4 204.8a25.6 25.6 0 0 1 25.6 25.6v25.6a25.6 25.6 0 0 1-25.6 25.6h-358.4a25.6 25.6 0 0 1-25.6-25.6v-25.6a25.6 25.6 0 0 1 25.6-25.6h358.4z m-678.4-128a89.6 89.6 0 1 0 0 179.2 89.6 89.6 0 0 0 0-179.2z m678.4-128a25.6 25.6 0 0 1 25.6 25.6v25.6a25.6 25.6 0 0 1-25.6 25.6h-358.4a25.6 25.6 0 0 1-25.6-25.6v-25.6a25.6 25.6 0 0 1 25.6-25.6h358.4zM454.2976 119.552a25.6 25.6 0 0 1 1.536 1.2288l18.688 16.6912a25.6 25.6 0 0 1 3.072 34.9696l-203.3152 257.536a25.6 25.6 0 0 1-37.888 2.56L120.7296 320.3584a25.6 25.6 0 0 1-0.512-36.1984l17.8176-18.3808a25.6 25.6 0 0 1 36.1984-0.512L231.936 321.2288a25.6 25.6 0 0 0 38.1952-2.816l148.224-194.0992a25.6 25.6 0 0 1 35.8912-4.8128zM947.2 217.6a25.6 25.6 0 0 1 25.6 25.6v25.6a25.6 25.6 0 0 1-25.6 25.6h-358.4a25.6 25.6 0 0 1-25.6-25.6v-25.6a25.6 25.6 0 0 1 25.6-25.6h358.4z" fill="currentColor"></path></svg>',
            acknowledgments: '<svg viewBox="0 0 1025 1024" width="16" height="16" fill="currentColor"><path d="M475.8 974.9c-77 0-174-35.1-225-56C232 911.2 210.3 906 197 906L79.1 906c-57 0-78.6-47-79.1-78.6l0-173c0-42.6 40.2-65 80.1-68.4l167.9-0.1c13.2 0 41.5 7.5 53.6 11.7 40.3 14 108.4 36.5 126 42.2 1.1 0.2 2.2 0.5 3.4 0.9 31.4 9 40 9.6 41.4 9.6l136.7 0c17.3 1.3 37.5 4.3 49.1 11.8 18.3 11.8 31 27.8 37.3 46.5 63.4-11.9 199.6-37.1 224.6-39.3 67.6-6 92.5 32.6 101.5 66 15.9 59.4-43.5 94.7-81 106.2C927.4 846.2 582.7 974.9 475.8 974.9zM247.2 646l-164.6 0c-8.4 0.9-20.5 5.8-22.7 9l0.3 171.8c1 18.9 14.5 18.9 18.9 18.9L197 845.7c25.2 0 56.1 9 76.6 17.4 46.9 19.3 135.6 51.6 202.2 51.6 79.8 0 348.4-94.1 445.1-130.3 13.3-4.2 46-19.5 42.2-33.7-4.6-17.1-10.9-23.9-38-21.6-19.8 1.7-142.9 24.3-231.1 40.9-13.3 36.2-46.9 55.7-71.7 55.7L332.8 825.7c-16.6 0-30.1-13.5-30.1-30.1 0-16.6 13.5-30.1 30.1-30.1l289.5 0c-0.7 0 17.3-4.5 17.3-28.8 0-6.4-1.5-15.8-14.1-24 0 0-0.1 0-0.1 0-1.1 0-11-1.6-18.9-2.3l-134.3 0.1c-11.6 0-28.9-3.6-58-11.9 2.1 0.6 4.2 0.6 6.5 0.8-2.3-0.4-4.9-0.8-7.9-1.5l-0.2 0.5c-1.3-0.4-2.5-0.9-3.6-1.4-20.6-5.2-57.1-17.9-127.3-42.4C270.8 650.7 252 646.4 247.2 646z" fill="currentColor"></path><path d="M546.2 596c-2.8 0-5.6-0.4-8.4-1.2-120.7-34.9-282.4-194.5-303.5-299.5-12.1-60.3-1.5-118.4 29.8-163.7 29.6-42.7 75.6-71 129.5-79.7 74.5-11.9 124.7 23.7 152.6 53.4 27.9-29.5 78-64.9 152.3-53.4 0 0 0 0 0 0 54 8.4 100 36.4 129.5 78.7 31.6 45.3 42.2 103.8 30 164.7-21.1 105-182.8 264.6-303.5 299.5C551.9 595.6 549 596 546.2 596zM421.7 109.8c-5.9 0-12 0.5-18.5 1.5-37.6 6.1-69.4 25.5-89.6 54.6-22 31.7-29.2 73.4-20.3 117.5 14.9 74.3 148.3 215.3 252.8 250.9 104.5-35.6 237.9-176.6 252.9-250.9 9-44.7 1.8-86.8-20.3-118.4-20.3-29.1-51.3-47.7-89.4-53.6l0 0c-78-12-116.3 57.1-116.7 57.8-5.3 9.7-15.4 15.7-26.5 15.7l0 0c-11 0-21.2-6.1-26.5-15.8C518.3 166.6 486 109.8 421.7 109.8z" fill="currentColor"></path></svg>'
        };

        const tabDefs = [
            { id: 'general', icon: TAB_ICONS.general, labelKey: 'tabGeneral' },
            { id: 'appearance', icon: TAB_ICONS.appearance, labelKey: 'tabAppearance' },
            { id: 'ratings', icon: TAB_ICONS.ratings, labelKey: 'tabRatings' },
            { id: 'user', icon: TAB_ICONS.user, labelKey: 'tabUser' },
            { id: 'shortcuts', icon: TAB_ICONS.shortcuts, labelKey: 'tabShortcuts' },
            { id: 'storage', icon: TAB_ICONS.storage, labelKey: 'tabStorage' },
            { id: 'changelog', icon: TAB_ICONS.changelog, labelKey: 'tabChangelog' },
            { id: 'roadmap', icon: TAB_ICONS.roadmap, labelKey: 'tabRoadmap' },
            { id: 'acknowledgments', icon: TAB_ICONS.acknowledgments, labelKey: 'tabAcknowledgments' }
        ];

        const tabButtons = {};
        const tabPanels = {};
        let activeTab = 'general';
        let resetChangelogExpansion = null;
        let activeTransitionCleanup = null;

        const navIndicator = document.createElement('div');
        navIndicator.className = 'cf-nav-indicator';
        sidebar.appendChild(navIndicator);

        const updateNavIndicator = (animate = true) => {
            const targetBtn = tabButtons[activeTab];
            if (!targetBtn || !navIndicator) return;
            if (!animate) {
                navIndicator.style.transition = 'none';
            } else {
                navIndicator.style.transition = 'top 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
            }
            navIndicator.style.top = `${targetBtn.offsetTop}px`;
            navIndicator.style.height = `${targetBtn.offsetHeight}px`;
            navIndicator.style.opacity = '1';
            if (!animate) {
                navIndicator.offsetHeight;
                navIndicator.style.transition = 'top 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
            }
        };

        const switchTab = (tabId) => {
            if (activeTab === tabId && tabPanels[tabId] && tabPanels[tabId].classList.contains('active')) {
                return;
            }
            hideFloatingTooltip();
            if (typeof recordingCleanupFn === 'function') {
                recordingCleanupFn();
            }
            if (typeof activeTransitionCleanup === 'function') {
                activeTransitionCleanup();
            }

            const prevTab = activeTab;
            const oldPanel = tabPanels[prevTab];
            const newPanel = tabPanels[tabId];
            const oldIndex = tabDefs.findIndex(d => d.id === prevTab);
            const newIndex = tabDefs.findIndex(d => d.id === tabId);
            const isDown = newIndex >= oldIndex;

            activeTab = tabId;
            tabDefs.forEach(def => {
                if (tabButtons[def.id]) {
                    tabButtons[def.id].classList.toggle('active', def.id === tabId);
                }
            });
            updateNavIndicator(true);

            if (oldPanel && newPanel && oldPanel !== newPanel && typeof newPanel.animate === 'function' && contentArea && oldPanel.offsetWidth > 0) {
                const oldRect = oldPanel.getBoundingClientRect();
                const areaRect = contentArea.getBoundingClientRect();
                const topOffset = oldRect.top - areaRect.top;
                const areaStyle = window.getComputedStyle(contentArea);
                const padLeft = areaStyle.paddingLeft || '18px';
                const padRight = areaStyle.paddingRight || '18px';

                oldPanel.style.position = 'absolute';
                oldPanel.style.top = `${topOffset}px`;
                oldPanel.style.left = padLeft;
                oldPanel.style.right = padRight;
                oldPanel.style.pointerEvents = 'none';
                oldPanel.style.zIndex = '1';

                newPanel.classList.add('active');
                newPanel.style.position = 'relative';
                newPanel.style.zIndex = '2';
                contentArea.scrollTop = 0;

                const exitShift = isDown ? -16 : 16;
                const enterShift = isDown ? 18 : -18;

                const oldAnim = oldPanel.animate([
                    { opacity: 1, transform: 'translateY(0) scale(1)' },
                    { opacity: 0, transform: `translateY(${exitShift}px) scale(0.99)` }
                ], {
                    duration: 180,
                    easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
                    fill: 'both'
                });

                const newAnim = newPanel.animate([
                    { opacity: 0, transform: `translateY(${enterShift}px) scale(0.99)` },
                    { opacity: 1, transform: 'translateY(0) scale(1)' }
                ], {
                    duration: 250,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'both'
                });

                let cleaned = false;
                const cleanup = () => {
                    if (cleaned) return;
                    cleaned = true;
                    activeTransitionCleanup = null;
                    try { oldAnim.cancel(); } catch (e) { }
                    try { newAnim.cancel(); } catch (e) { }
                    oldPanel.classList.remove('active');
                    oldPanel.style.position = '';
                    oldPanel.style.top = '';
                    oldPanel.style.left = '';
                    oldPanel.style.right = '';
                    oldPanel.style.width = '';
                    oldPanel.style.pointerEvents = '';
                    oldPanel.style.zIndex = '';
                    oldPanel.style.opacity = '';
                    oldPanel.style.transform = '';
                    newPanel.style.position = '';
                    newPanel.style.zIndex = '';
                    newPanel.style.opacity = '';
                    newPanel.style.transform = '';
                };

                activeTransitionCleanup = cleanup;
                newAnim.onfinish = cleanup;
            } else {
                tabDefs.forEach(def => {
                    if (tabPanels[def.id]) {
                        tabPanels[def.id].classList.toggle('active', def.id === tabId);
                    }
                });
                if (contentArea) {
                    contentArea.scrollTop = 0;
                }
            }

            if (tabId === 'storage' && typeof refreshStorageUI === 'function') {
                refreshStorageUI();
            }
            if (tabId === 'appearance' && pickr) {
                try { pickr.setColor(appSettings.acBgColor, true); } catch (e) { }
            }
            if (typeof resetChangelogExpansion === 'function') {
                resetChangelogExpansion();
            }
        };

        tabDefs.forEach(def => {
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.className = `cf-nav-tab ${def.id === activeTab ? 'active' : ''}`;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'cf-tab-icon';
            iconSpan.innerHTML = def.icon;

            const textSpan = document.createElement('span');
            textSpan.className = 'cf-tab-text';
            def.textSpan = textSpan;

            tabBtn.appendChild(iconSpan);
            tabBtn.appendChild(textSpan);

            tabBtn.onclick = () => switchTab(def.id);

            sidebar.appendChild(tabBtn);
            tabButtons[def.id] = tabBtn;

            const panel = document.createElement('div');
            panel.className = `cf-tab-panel ${def.id === activeTab ? 'active' : ''}`;
            contentArea.appendChild(panel);
            tabPanels[def.id] = panel;
        });

        requestAnimationFrame(() => updateNavIndicator(false));

        contentArea.addEventListener('scroll', hideFloatingTooltip, { passive: true });

        // -------------------------------------------------------------
        // PANEL 1: 通用 (General)
        // -------------------------------------------------------------
        const rowLang = document.createElement('div');
        rowLang.className = 'cf-setting-item';

        const labelLang = document.createElement('span');
        labelLang.className = 'cf-setting-label';

        const langSwitch = document.createElement('div');
        langSwitch.className = 'cf-segmented-switch';
        langSwitch.style.width = '140px';

        const langSlider = document.createElement('div');
        langSlider.className = 'cf-segmented-slider';

        const langZhBtn = document.createElement('div');
        langZhBtn.className = 'cf-segmented-btn';
        const langEnBtn = document.createElement('div');
        langEnBtn.className = 'cf-segmented-btn';

        const updateLangSwitchUI = () => {
            const isZh = currentLang === 'zh';
            langSlider.style.left = isZh ? '2px' : '50%';
            langZhBtn.style.color = isZh ? '#1890ff' : '#888';
            langZhBtn.style.fontWeight = isZh ? 'bold' : 'normal';
            langEnBtn.style.color = isZh ? '#888' : '#1890ff';
            langEnBtn.style.fontWeight = isZh ? 'normal' : 'bold';
        };
        updateLangSwitchUI();

        langZhBtn.onclick = () => { currentLang = 'zh'; appSettings.lang = 'zh'; updateLangSwitchUI(); updateTexts(); checkIfChanged(); };
        langEnBtn.onclick = () => { currentLang = 'en'; appSettings.lang = 'en'; updateLangSwitchUI(); updateTexts(); checkIfChanged(); };

        langSwitch.appendChild(langSlider);
        langSwitch.appendChild(langZhBtn);
        langSwitch.appendChild(langEnBtn);

        rowLang.appendChild(labelLang);
        rowLang.appendChild(langSwitch);
        tabPanels.general.appendChild(rowLang);

        // 2) Hide Problem Tags (Keep Rating)
        const rowHideTags = document.createElement('label');
        rowHideTags.className = 'cf-setting-item';
        rowHideTags.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelHideTags = document.createElement('span');
        labelHideTags.className = 'cf-setting-label';

        const toggleContainerHideTags = document.createElement('div');
        toggleContainerHideTags.className = 'cf-toggle-switch';
        const cbHideTags = document.createElement('input');
        cbHideTags.type = 'checkbox';
        cbHideTags.className = 'cf-toggle-hide-tags';
        cbHideTags.checked = !!appSettings.hideTags;
        const sliderHideTags = document.createElement('span');
        sliderHideTags.className = 'cf-toggle-slider';
        toggleContainerHideTags.appendChild(cbHideTags);
        toggleContainerHideTags.appendChild(sliderHideTags);

        rowHideTags.appendChild(labelHideTags);
        rowHideTags.appendChild(toggleContainerHideTags);
        tabPanels.general.appendChild(rowHideTags);

        // 2a) Sub-item 1: Hide Rating Tag
        const rowHideRatingTag = document.createElement('label');
        rowHideRatingTag.className = 'cf-setting-item cf-sub-setting-item';
        rowHideRatingTag.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; user-select: none; min-height: 28px; margin: 0; padding-left: 14px;';

        const labelHideRatingTag = document.createElement('span');
        labelHideRatingTag.className = 'cf-setting-sublabel';

        const toggleContainerHideRatingTag = document.createElement('div');
        toggleContainerHideRatingTag.className = 'cf-toggle-switch';
        const cbHideRatingTag = document.createElement('input');
        cbHideRatingTag.type = 'checkbox';
        cbHideRatingTag.checked = !!appSettings.hideRatingTag;
        const sliderHideRatingTag = document.createElement('span');
        sliderHideRatingTag.className = 'cf-toggle-slider';
        toggleContainerHideRatingTag.appendChild(cbHideRatingTag);
        toggleContainerHideRatingTag.appendChild(sliderHideRatingTag);

        rowHideRatingTag.appendChild(labelHideRatingTag);
        rowHideRatingTag.appendChild(toggleContainerHideRatingTag);
        tabPanels.general.appendChild(rowHideRatingTag);

        // 2b) Sub-item 2: Do Not Hide Solved (AC) Tags
        const rowNotHideAcTags = document.createElement('label');
        rowNotHideAcTags.className = 'cf-setting-item cf-sub-setting-item';
        rowNotHideAcTags.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; user-select: none; min-height: 28px; margin: 0; padding-left: 14px;';

        const labelNotHideAcTags = document.createElement('span');
        labelNotHideAcTags.className = 'cf-setting-sublabel';

        const toggleContainerNotHideAcTags = document.createElement('div');
        toggleContainerNotHideAcTags.className = 'cf-toggle-switch';
        const cbNotHideAcTags = document.createElement('input');
        cbNotHideAcTags.type = 'checkbox';
        cbNotHideAcTags.checked = !!appSettings.notHideAcTags;
        const sliderNotHideAcTags = document.createElement('span');
        sliderNotHideAcTags.className = 'cf-toggle-slider';
        toggleContainerNotHideAcTags.appendChild(cbNotHideAcTags);
        toggleContainerNotHideAcTags.appendChild(sliderNotHideAcTags);

        rowNotHideAcTags.appendChild(labelNotHideAcTags);
        rowNotHideAcTags.appendChild(toggleContainerNotHideAcTags);
        tabPanels.general.appendChild(rowNotHideAcTags);

        const updateHideTagsSubItemsVisibility = () => {
            const isVisible = cbHideTags.checked ? 'flex' : 'none';
            rowHideRatingTag.style.display = isVisible;
            rowNotHideAcTags.style.display = isVisible;
        };

        cbHideTags.onchange = () => {
            updateHideTagsSubItemsVisibility();
            checkIfChanged();
        };

        cbHideRatingTag.onchange = () => {
            checkIfChanged();
        };

        cbNotHideAcTags.onchange = () => {
            checkIfChanged();
        };

        updateHideTagsSubItemsVisibility();

        // 3) Auto Check Script Update
        const rowAutoCheckUpdate = document.createElement('div');
        rowAutoCheckUpdate.className = 'cf-setting-item';
        rowAutoCheckUpdate.style.cssText = 'display: flex; align-items: center; justify-content: space-between; user-select: none; margin: 0;';

        const labelAutoCheckUpdate = document.createElement('span');
        labelAutoCheckUpdate.className = 'cf-setting-label';

        const rightAutoCheckUpdate = document.createElement('div');
        rightAutoCheckUpdate.style.cssText = 'display: inline-flex; align-items: center; gap: 10px;';

        const btnCheckUpdateNow = document.createElement('button');
        btnCheckUpdateNow.className = 'cf-btn-secondary';
        btnCheckUpdateNow.style.cssText = 'padding: 3px 10px; font-size: 11.5px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; cursor: pointer; transition: all 0.2s; font-weight: 500; height: 26px; display: inline-flex; align-items: center; justify-content: center;';
        btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;

        btnCheckUpdateNow.onmouseenter = () => {
            btnCheckUpdateNow.style.background = '#f1f5f9';
            btnCheckUpdateNow.style.borderColor = '#94a3b8';
        };
        btnCheckUpdateNow.onmouseleave = () => {
            btnCheckUpdateNow.style.background = '#f8fafc';
            btnCheckUpdateNow.style.borderColor = '#cbd5e1';
        };

        let isCheckingUpdateManually = false;
        btnCheckUpdateNow.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isCheckingUpdateManually) return;
            isCheckingUpdateManually = true;
            btnCheckUpdateNow.textContent = t().statusCheckingUpdate;
            btnCheckUpdateNow.style.opacity = '0.7';
            btnCheckUpdateNow.style.cursor = 'wait';

            try {
                const result = await checkScriptUpdate(true);
                if (result && result.hasUpdate) {
                    btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;
                } else if (result && result.success) {
                    if (result.isPreview) {
                        btnCheckUpdateNow.textContent = `${t().statusUpdatePreview} (v${CURRENT_VERSION})`;
                        btnCheckUpdateNow.style.color = '#0284c7';
                        btnCheckUpdateNow.style.borderColor = '#38bdf8';
                    } else {
                        btnCheckUpdateNow.textContent = `${t().statusUpdateLatest} (v${CURRENT_VERSION})`;
                        btnCheckUpdateNow.style.color = '#10b981';
                        btnCheckUpdateNow.style.borderColor = '#86efac';
                    }
                    setTimeout(() => {
                        btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;
                        btnCheckUpdateNow.style.color = '#475569';
                        btnCheckUpdateNow.style.borderColor = '#cbd5e1';
                    }, 2500);
                } else {
                    btnCheckUpdateNow.textContent = t().statusUpdateFailed;
                    btnCheckUpdateNow.style.color = '#ef4444';
                    btnCheckUpdateNow.style.borderColor = '#fca5a5';
                    setTimeout(() => {
                        btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;
                        btnCheckUpdateNow.style.color = '#475569';
                        btnCheckUpdateNow.style.borderColor = '#cbd5e1';
                    }, 2500);
                }
            } catch (err) {
                btnCheckUpdateNow.textContent = t().statusUpdateFailed;
                btnCheckUpdateNow.style.color = '#ef4444';
                setTimeout(() => {
                    btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;
                    btnCheckUpdateNow.style.color = '#475569';
                    btnCheckUpdateNow.style.borderColor = '#cbd5e1';
                }, 2500);
            } finally {
                isCheckingUpdateManually = false;
                btnCheckUpdateNow.style.opacity = '1';
                btnCheckUpdateNow.style.cursor = 'pointer';
            }
        };

        const toggleContainerAutoCheckUpdate = document.createElement('label');
        toggleContainerAutoCheckUpdate.className = 'cf-toggle-switch';
        toggleContainerAutoCheckUpdate.style.cssText = 'margin: 0; cursor: pointer;';
        const cbAutoCheckUpdate = document.createElement('input');
        cbAutoCheckUpdate.type = 'checkbox';
        cbAutoCheckUpdate.className = 'cf-toggle-auto-check';
        cbAutoCheckUpdate.checked = !!appSettings.disableAutoCheckUpdate;
        const sliderAutoCheckUpdate = document.createElement('span');
        sliderAutoCheckUpdate.className = 'cf-toggle-slider';
        toggleContainerAutoCheckUpdate.appendChild(cbAutoCheckUpdate);
        toggleContainerAutoCheckUpdate.appendChild(sliderAutoCheckUpdate);

        cbAutoCheckUpdate.onchange = () => {
            if (!cbAutoCheckUpdate.checked) {
                resetUpdateCooldown();
            }
            checkIfChanged();
        };

        rightAutoCheckUpdate.appendChild(btnCheckUpdateNow);
        rightAutoCheckUpdate.appendChild(toggleContainerAutoCheckUpdate);

        rowAutoCheckUpdate.appendChild(labelAutoCheckUpdate);
        rowAutoCheckUpdate.appendChild(rightAutoCheckUpdate);
        tabPanels.general.appendChild(rowAutoCheckUpdate);

        // -------------------------------------------------------------
        // PANEL 2: 界面 (Appearance)
        // -------------------------------------------------------------
        // 1) AC Background Color
        const rowAcColor = document.createElement('div');
        rowAcColor.className = 'cf-setting-item';

        const labelAcColor = document.createElement('span');
        labelAcColor.className = 'cf-setting-label';

        const colorPickerContainer = document.createElement('div');

        rowAcColor.appendChild(labelAcColor);
        rowAcColor.appendChild(colorPickerContainer);
        tabPanels.appearance.appendChild(rowAcColor);

        if (window.Pickr) {
            pickr = Pickr.create({
                el: colorPickerContainer,
                theme: 'nano',
                default: appSettings.acBgColor,
                position: 'bottom-end',
                components: {
                    preview: true,
                    opacity: true,
                    hue: true,
                    interaction: {
                        hex: true,
                        rgba: true,
                        input: true,
                        clear: false,
                        save: false
                    }
                }
            });

            pickr.on('init', () => {
                try { pickr.setColor(appSettings.acBgColor, true); } catch (e) { }
            }).on('change', (color) => {
                selectedColor = color.toRGBA().toString(0);
                pickr.applyColor(true);
                checkIfChanged();
            }).on('save', () => {
                checkIfChanged();
            });
        }

        // 2) Show Language Icon
        const rowLangIcon = document.createElement('label');
        rowLangIcon.className = 'cf-setting-item';
        rowLangIcon.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelLangIcon = document.createElement('span');
        labelLangIcon.className = 'cf-setting-label';

        const toggleContainerLangIcon = document.createElement('div');
        toggleContainerLangIcon.className = 'cf-toggle-switch';
        const cbLangIcon = document.createElement('input');
        cbLangIcon.type = 'checkbox';
        cbLangIcon.className = 'cf-toggle-lang-icon';
        cbLangIcon.checked = appSettings.show.langIcon !== false;
        const sliderLangIcon = document.createElement('span');
        sliderLangIcon.className = 'cf-toggle-slider';
        toggleContainerLangIcon.appendChild(cbLangIcon);
        toggleContainerLangIcon.appendChild(sliderLangIcon);

        rowLangIcon.appendChild(labelLangIcon);
        rowLangIcon.appendChild(toggleContainerLangIcon);
        tabPanels.appearance.appendChild(rowLangIcon);

        // 2b) Language Icon Size
        const rowLangIconSize = document.createElement('div');
        rowLangIconSize.className = 'cf-setting-item cf-row-lang-icon-size';
        rowLangIconSize.style.paddingLeft = '12px';

        const labelLangIconSize = document.createElement('span');
        labelLangIconSize.className = 'cf-setting-sublabel';

        const langIconSizeInput = document.createElement('input');
        langIconSizeInput.type = 'range';
        langIconSizeInput.min = '0.8';
        langIconSizeInput.max = '3.0';
        langIconSizeInput.step = '0.1';
        langIconSizeInput.value = appSettings.langIconSize || 1.6;
        langIconSizeInput.style.cssText = 'width: 100px; cursor: pointer;';

        const langIconSizeVal = document.createElement('span');
        langIconSizeVal.style.cssText = 'font-size: 12px; width: 28px; text-align: right; display: inline-block; color: #64748b; font-weight: 500;';
        langIconSizeVal.textContent = parseFloat(langIconSizeInput.value).toFixed(1) + 'x';

        langIconSizeInput.oninput = () => {
            langIconSizeVal.textContent = parseFloat(langIconSizeInput.value).toFixed(1) + 'x';
            checkIfChanged();
        };

        const sizeWrapperLang = document.createElement('div');
        sizeWrapperLang.style.display = 'flex';
        sizeWrapperLang.style.alignItems = 'center';
        sizeWrapperLang.style.gap = '5px';
        sizeWrapperLang.appendChild(langIconSizeInput);
        sizeWrapperLang.appendChild(langIconSizeVal);

        rowLangIconSize.appendChild(labelLangIconSize);
        rowLangIconSize.appendChild(sizeWrapperLang);
        tabPanels.appearance.appendChild(rowLangIconSize);

        cbLangIcon.onchange = () => {
            rowLangIconSize.style.display = cbLangIcon.checked ? 'flex' : 'none';
            checkIfChanged();
        };
        rowLangIconSize.style.display = cbLangIcon.checked ? 'flex' : 'none';

        // 3) Show Short Verdicts
        const rowShortVerdict = document.createElement('label');
        rowShortVerdict.className = 'cf-setting-item';
        rowShortVerdict.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; margin: 0;';

        const shortVerdictLeft = document.createElement('div');
        shortVerdictLeft.style.cssText = 'display: flex; align-items: center; margin: 0;';

        const labelShortVerdict = document.createElement('span');
        labelShortVerdict.className = 'cf-setting-label';
        labelShortVerdict.textContent = t().locShortVerdict;

        const btnShortVerdictHelp = document.createElement('span');
        btnShortVerdictHelp.className = 'cf-clist-icon-btn cf-clist-icon-help';
        btnShortVerdictHelp.setAttribute('data-tooltip', t().verdictHelpTooltip);
        btnShortVerdictHelp.textContent = '?';

        btnShortVerdictHelp.addEventListener('mouseenter', () => showFloatingTooltip(btnShortVerdictHelp, btnShortVerdictHelp.getAttribute('data-tooltip')));
        btnShortVerdictHelp.addEventListener('mouseleave', hideFloatingTooltip);
        btnShortVerdictHelp.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideFloatingTooltip();
            showVerdictGuideModal(currentLang);
        };
        btnShortVerdictHelp.addEventListener('mousedown', (e) => e.stopPropagation());

        shortVerdictLeft.appendChild(labelShortVerdict);
        shortVerdictLeft.appendChild(btnShortVerdictHelp);

        const toggleContainerShortVerdict = document.createElement('div');
        toggleContainerShortVerdict.className = 'cf-toggle-switch';
        toggleContainerShortVerdict.style.margin = '0';

        const cbShortVerdict = document.createElement('input');
        cbShortVerdict.type = 'checkbox';
        cbShortVerdict.className = 'cf-toggle-short-verdict';
        cbShortVerdict.checked = !!appSettings.show.shortVerdict;
        const sliderShortVerdict = document.createElement('span');
        sliderShortVerdict.className = 'cf-toggle-slider';
        toggleContainerShortVerdict.appendChild(cbShortVerdict);
        toggleContainerShortVerdict.appendChild(sliderShortVerdict);

        rowShortVerdict.appendChild(shortVerdictLeft);
        rowShortVerdict.appendChild(toggleContainerShortVerdict);
        tabPanels.appearance.appendChild(rowShortVerdict);

        cbShortVerdict.onchange = () => {
            checkIfChanged();
        };

        // 4) Custom Time Format
        const timeGroup = document.createElement('div');
        timeGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const timeTitleRow = document.createElement('label');
        timeTitleRow.className = 'cf-setting-item';
        timeTitleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; margin: 0;';

        const timeTitleLeft = document.createElement('div');
        timeTitleLeft.style.cssText = 'display: flex; align-items: center; margin: 0;';

        const timeTitleTextNode = document.createElement('span');
        timeTitleTextNode.className = 'cf-setting-label';
        timeTitleTextNode.textContent = t().timeFormatTitle;

        const btnTimeHelp = document.createElement('span');
        btnTimeHelp.className = 'cf-clist-icon-btn cf-clist-icon-help';
        btnTimeHelp.setAttribute('data-tooltip', t().timeFormatHelpTooltip);
        btnTimeHelp.textContent = '?';

        btnTimeHelp.addEventListener('mouseenter', () => showFloatingTooltip(btnTimeHelp, btnTimeHelp.getAttribute('data-tooltip')));
        btnTimeHelp.addEventListener('mouseleave', hideFloatingTooltip);
        btnTimeHelp.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideFloatingTooltip();
            showTimeFormatGuideModal(currentLang);
        };
        btnTimeHelp.addEventListener('mousedown', (e) => e.stopPropagation());

        timeTitleLeft.appendChild(timeTitleTextNode);
        timeTitleLeft.appendChild(btnTimeHelp);

        const timeToggleContainer = document.createElement('div');
        timeToggleContainer.className = 'cf-toggle-switch';
        timeToggleContainer.style.margin = '0';
        const timeToggle = document.createElement('input');
        timeToggle.type = 'checkbox';
        timeToggle.className = 'cf-toggle-time-format';
        timeToggle.checked = appSettings.timeFormat.enabled;
        const timeSlider = document.createElement('span');
        timeSlider.className = 'cf-toggle-slider';
        timeToggleContainer.appendChild(timeToggle);
        timeToggleContainer.appendChild(timeSlider);

        timeTitleRow.appendChild(timeTitleLeft);
        timeTitleRow.appendChild(timeToggleContainer);
        timeGroup.appendChild(timeTitleRow);

        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = appSettings.timeFormat.format;
        timeInput.placeholder = 'YYYY/MM/DD HH:mm';
        timeInput.style.cssText = 'width: 100%; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; font-family: inherit;';
        timeInput.onfocus = () => { timeInput.style.borderColor = '#1890ff'; };
        timeInput.onblur = () => { timeInput.style.borderColor = '#e2e8f0'; };

        const timePreview = document.createElement('div');
        timePreview.style.cssText = 'font-size: 12px; color: #64748b; font-family: inherit; text-align: right;';

        const updatePreview = () => {
            if (timeToggle.checked) {
                const d = new Date();
                timePreview.textContent = t().timeFormatPreview + customFormatTime(d, timeInput.value || 'YYYY/MM/DD HH:mm');
                timeInput.disabled = false;
                timeInput.style.opacity = '1';
            } else {
                timePreview.textContent = t().timeFormatDisabled;
                timeInput.disabled = true;
                timeInput.style.opacity = '0.5';
            }
        };

        timeInput.addEventListener('input', () => { updatePreview(); checkIfChanged(); });
        timeToggle.addEventListener('change', () => { updatePreview(); checkIfChanged(); });

        timeGroup.appendChild(timeInput);
        timeGroup.appendChild(timePreview);
        updatePreview();

        tabPanels.appearance.appendChild(timeGroup);

        // -------------------------------------------------------------
        // PANEL 3: 难度分 (Ratings)
        // -------------------------------------------------------------
        // 1) Clist Ratings Extension Section (First item in Ratings tab)
        const clistSection = document.createElement('div');
        clistSection.className = 'cf-clist-section';

        // 1.1 Master switch row: 启用 Clist 分数
        const clistHeaderRow = document.createElement('label');
        clistHeaderRow.className = 'cf-setting-item';
        clistHeaderRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; cursor: pointer; user-select: none; margin: 0;';

        const clistEnableLabel = document.createElement('span');
        clistEnableLabel.className = 'cf-setting-label';
        clistEnableLabel.textContent = t().clistEnable;

        const clistToggleContainer = document.createElement('div');
        clistToggleContainer.className = 'cf-toggle-switch';
        const cbClistEnabled = document.createElement('input');
        cbClistEnabled.type = 'checkbox';
        cbClistEnabled.className = 'cf-toggle-clist-enabled';
        cbClistEnabled.checked = !!(appSettings.clist && appSettings.clist.enabled);
        const clistSlider = document.createElement('span');
        clistSlider.className = 'cf-toggle-slider';
        clistToggleContainer.appendChild(cbClistEnabled);
        clistToggleContainer.appendChild(clistSlider);

        clistHeaderRow.appendChild(clistEnableLabel);
        clistHeaderRow.appendChild(clistToggleContainer);
        clistSection.appendChild(clistHeaderRow);

        // 1.2 Sub-items container
        const clistSubgroup = document.createElement('div');
        clistSubgroup.className = 'cf-clist-subgroup';
        clistSubgroup.style.display = cbClistEnabled.checked ? 'flex' : 'none';

        // Sub-item 1: 认证方式 (登录 / API segmented switch)
        const rowAuthMode = document.createElement('div');
        rowAuthMode.className = 'cf-setting-item';
        rowAuthMode.style.cssText = 'display: flex; align-items: center; justify-content: space-between; min-height: 28px; margin: 0;';

        const labelClistAuthMode = document.createElement('span');
        labelClistAuthMode.className = 'cf-setting-sublabel';
        labelClistAuthMode.textContent = t().clistAuthMode;

        const authSwitch = document.createElement('div');
        authSwitch.className = 'cf-segmented-switch';
        authSwitch.style.width = '110px';

        const authSlider = document.createElement('div');
        authSlider.className = 'cf-segmented-slider';

        const authLoginBtn = document.createElement('div');
        authLoginBtn.className = 'cf-segmented-btn';
        authLoginBtn.setAttribute('data-tooltip', t().clistLoginHelpTooltip);
        const authApiBtn = document.createElement('div');
        authApiBtn.className = 'cf-segmented-btn';
        let currentAuthMode = (appSettings.clist && appSettings.clist.authMode) || (appSettings.clist && appSettings.clist.apiKey ? 'api' : 'cookie');

        const updateAuthSwitchUI = () => {
            const isCookie = currentAuthMode === 'cookie';
            authSlider.style.left = isCookie ? '2px' : '50%';
            authLoginBtn.style.color = isCookie ? '#1890ff' : '#888';
            authLoginBtn.style.fontWeight = isCookie ? 'bold' : 'normal';
            authApiBtn.style.color = isCookie ? '#888' : '#1890ff';
            authApiBtn.style.fontWeight = isCookie ? 'normal' : 'bold';
            rowClistApiKey.style.display = isCookie ? 'none' : 'flex';
        };

        authLoginBtn.onclick = () => {
            currentAuthMode = 'cookie';
            if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
            appSettings.clist.authMode = 'cookie';
            appSettings.clist.isLoggedIn = true;
            updateAuthSwitchUI();
            checkIfChanged();
        };

        authApiBtn.onclick = () => {
            currentAuthMode = 'api';
            if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
            appSettings.clist.authMode = 'api';
            appSettings.clist.isLoggedIn = false;
            updateAuthSwitchUI();
            checkIfChanged();
        };

        authSwitch.appendChild(authSlider);
        authSwitch.appendChild(authLoginBtn);
        authSwitch.appendChild(authApiBtn);

        rowAuthMode.appendChild(labelClistAuthMode);
        rowAuthMode.appendChild(authSwitch);
        clistSubgroup.appendChild(rowAuthMode);

        // Sub-item 2: Clist API Key (Shown only when authMode === 'api')
        const rowClistApiKey = document.createElement('div');
        rowClistApiKey.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const apiKeyHeader = document.createElement('div');
        apiKeyHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

        const apiKeyLabelContainer = document.createElement('div');
        apiKeyLabelContainer.style.cssText = 'display: flex; align-items: center; font-size: 12px;';
        const labelClistApiKey = document.createElement('span');
        labelClistApiKey.className = 'cf-setting-sublabel';
        labelClistApiKey.textContent = t().clistApiKeyLabel;

        const btnKeyHelp = document.createElement('span');
        btnKeyHelp.className = 'cf-clist-icon-btn cf-clist-icon-help';
        btnKeyHelp.setAttribute('data-tooltip', t().clistHelpTooltip);
        btnKeyHelp.textContent = '?';

        apiKeyLabelContainer.appendChild(labelClistApiKey);
        apiKeyLabelContainer.appendChild(btnKeyHelp);
        apiKeyHeader.appendChild(apiKeyLabelContainer);

        const inputClistApiKey = document.createElement('input');
        inputClistApiKey.type = 'text';
        inputClistApiKey.className = 'cf-clist-input-box';
        inputClistApiKey.placeholder = t().clistApiKeyPlaceholder;
        inputClistApiKey.value = (appSettings.clist && appSettings.clist.apiKey) || '';

        rowClistApiKey.appendChild(apiKeyHeader);
        rowClistApiKey.appendChild(inputClistApiKey);
        clistSubgroup.appendChild(rowClistApiKey);

        // Initialize UI according to current auth mode
        updateAuthSwitchUI();

        // Sub-item 3: 立即同步 Clist 分数
        const rowClistSync = document.createElement('div');
        rowClistSync.style.cssText = 'display: flex; align-items: center; justify-content: space-between; min-height: 32px;';

        const syncLabelContainer = document.createElement('div');
        syncLabelContainer.style.cssText = 'display: inline-flex; align-items: center;';

        const labelClistSync = document.createElement('span');
        labelClistSync.className = 'cf-setting-sublabel';
        labelClistSync.textContent = t().clistSyncTitle;

        const btnSyncWarn = document.createElement('span');
        btnSyncWarn.className = 'cf-clist-icon-btn cf-clist-icon-warn';
        btnSyncWarn.setAttribute('data-tooltip', t().clistSyncTooltip);
        btnSyncWarn.textContent = '!';

        syncLabelContainer.appendChild(labelClistSync);
        syncLabelContainer.appendChild(btnSyncWarn);

        const btnSync = document.createElement('button');
        btnSync.className = 'cf-clist-sync-btn';
        btnSync.type = 'button';
        btnSync.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>${t().clistSyncBtn}</span>`;
        const syncBtnText = btnSync.querySelector('span');

        rowClistSync.appendChild(syncLabelContainer);
        rowClistSync.appendChild(btnSync);
        clistSubgroup.appendChild(rowClistSync);

        clistSection.appendChild(clistSubgroup);
        tabPanels.ratings.appendChild(clistSection);

        // Clist Event Listeners
        cbClistEnabled.onchange = () => {
            clistSubgroup.style.display = cbClistEnabled.checked ? 'flex' : 'none';
            if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
            appSettings.clist.enabled = cbClistEnabled.checked;
            updateFooterRatingStatus();
            checkIfChanged();
            refreshRatingsOnPage();
        };

        inputClistApiKey.oninput = () => {
            if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
            appSettings.clist.apiKey = inputClistApiKey.value.trim();
            checkIfChanged();
        };

        authLoginBtn.addEventListener('mouseenter', () => showFloatingTooltip(authLoginBtn, authLoginBtn.getAttribute('data-tooltip')));
        authLoginBtn.addEventListener('mouseleave', hideFloatingTooltip);

        btnKeyHelp.addEventListener('mouseenter', () => showFloatingTooltip(btnKeyHelp, btnKeyHelp.getAttribute('data-tooltip')));
        btnKeyHelp.addEventListener('mouseleave', hideFloatingTooltip);
        btnKeyHelp.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideFloatingTooltip();
            showClistKeyGuideModal(currentLang);
        };

        btnSyncWarn.addEventListener('mouseenter', () => showFloatingTooltip(btnSyncWarn, btnSyncWarn.getAttribute('data-tooltip')));
        btnSyncWarn.addEventListener('mouseleave', hideFloatingTooltip);
        btnSyncWarn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideFloatingTooltip();
            showClistSyncSpecModal(currentLang);
        };

        const updateSyncBtnState = () => {
            if (isClistSyncing) {
                btnSync.classList.add('syncing');
                btnSync.disabled = true;
                const pct = (currentClistSyncProgress && currentClistSyncProgress.percent !== undefined) ? currentClistSyncProgress.percent : 0;
                syncBtnText.textContent = t('clistSyncBtnSyncing', pct);
                return;
            }
            btnSync.classList.remove('syncing');

            const cooldown = getClistCooldownRemaining();
            if (cooldown > 0) {
                btnSync.classList.add('cooldown');
                btnSync.disabled = true;
                const min = Math.floor(cooldown / 60000);
                const sec = Math.floor((cooldown % 60000) / 1000).toString().padStart(2, '0');
                syncBtnText.textContent = t('clistSyncBtnCooldown', min, sec);
            } else {
                btnSync.classList.remove('cooldown');
                btnSync.disabled = false;
                syncBtnText.textContent = t().clistSyncBtn;
            }
        };

        btnSync.onclick = () => {
            if (btnSync.disabled || btnSync.classList.contains('cooldown') || getClistCooldownRemaining() > 0) return;
            syncClistRatings(t, () => {
                updateSyncBtnState();
                updateFooterRatingStatus();
            });
        };

        setInterval(updateSyncBtnState, 1000);
        updateSyncBtnState();

        // 2) Master Switch: 色彩展示难度分 (总开关)
        const rowMasterColorRatings = document.createElement('label');
        rowMasterColorRatings.className = 'cf-setting-item';
        rowMasterColorRatings.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelMasterColorRatings = document.createElement('span');
        labelMasterColorRatings.className = 'cf-setting-label';

        const toggleContainerMasterColorRatings = document.createElement('div');
        toggleContainerMasterColorRatings.className = 'cf-toggle-switch';
        const cbColorRatings = document.createElement('input');
        cbColorRatings.type = 'checkbox';
        cbColorRatings.className = 'cf-toggle-color-ratings';
        cbColorRatings.checked = appSettings.colorRatings !== false;
        const sliderMasterColorRatings = document.createElement('span');
        sliderMasterColorRatings.className = 'cf-toggle-slider';
        toggleContainerMasterColorRatings.appendChild(cbColorRatings);
        toggleContainerMasterColorRatings.appendChild(sliderMasterColorRatings);

        rowMasterColorRatings.appendChild(labelMasterColorRatings);
        rowMasterColorRatings.appendChild(toggleContainerMasterColorRatings);
        tabPanels.ratings.appendChild(rowMasterColorRatings);

        // 3) Ratings Display Style (Sub-item)
        const rowStyle = document.createElement('div');
        rowStyle.className = 'cf-setting-item cf-row-display-style';
        rowStyle.style.paddingLeft = '12px';

        const labelStyle = document.createElement('span');
        labelStyle.className = 'cf-setting-sublabel';

        const styleSwitch = document.createElement('div');
        styleSwitch.className = 'cf-segmented-switch';
        styleSwitch.style.width = '120px';

        const slider = document.createElement('div');
        slider.className = 'cf-segmented-slider';

        const styleBlockBtn = document.createElement('div');
        styleBlockBtn.className = 'cf-segmented-btn cf-btn-style-block';
        const styleTagBtn = document.createElement('div');
        styleTagBtn.className = 'cf-segmented-btn cf-btn-style-tag';
        let currentDisplayStyle = appSettings.displayStyle || 'tag';

        const updateStyleUI = () => {
            if (currentDisplayStyle === 'block') {
                slider.style.left = '2px';
                slider.style.background = getRatingBgColor(2400);
                slider.style.border = `1px solid ${getRatingBgColor(2400)}`;
                styleBlockBtn.style.color = 'white';
                styleBlockBtn.style.fontWeight = 'bold';
                styleTagBtn.style.color = '#888';
                styleTagBtn.style.fontWeight = 'normal';
            } else {
                slider.style.left = '50%';
                const ts = getRatingTagStyle(2400);
                slider.style.background = ts.bg;
                slider.style.border = `1px solid ${ts.border}`;
                styleBlockBtn.style.color = '#888';
                styleBlockBtn.style.fontWeight = 'normal';
                styleTagBtn.style.color = ts.text;
                styleTagBtn.style.fontWeight = 'bold';
            }
        };
        updateStyleUI();

        styleBlockBtn.onclick = () => {
            currentDisplayStyle = 'block';
            updateStyleUI();
            updateTagFillCellVisibility();
            checkIfChanged();
        };
        styleTagBtn.onclick = () => {
            currentDisplayStyle = 'tag';
            updateStyleUI();
            updateTagFillCellVisibility();
            checkIfChanged();
        };

        styleSwitch.appendChild(slider);
        styleSwitch.appendChild(styleBlockBtn);
        styleSwitch.appendChild(styleTagBtn);

        rowStyle.appendChild(labelStyle);
        rowStyle.appendChild(styleSwitch);
        tabPanels.ratings.appendChild(rowStyle);

        // 3.1) Fill Table Cells with Tag Colors (Sub-item under Tag style)
        const rowTagFillCell = document.createElement('label');
        rowTagFillCell.className = 'cf-setting-item cf-row-tag-fill-cell';
        rowTagFillCell.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; user-select: none; min-height: 28px; margin: 0; padding-left: 24px;';

        const labelTagFillCell = document.createElement('span');
        labelTagFillCell.className = 'cf-setting-sublabel';

        const toggleContainerTagFillCell = document.createElement('div');
        toggleContainerTagFillCell.className = 'cf-toggle-switch';
        const cbTagFillCell = document.createElement('input');
        cbTagFillCell.type = 'checkbox';
        cbTagFillCell.checked = appSettings.tagFillCell !== false;
        const sliderTagFillCell = document.createElement('span');
        sliderTagFillCell.className = 'cf-toggle-slider';
        toggleContainerTagFillCell.appendChild(cbTagFillCell);
        toggleContainerTagFillCell.appendChild(sliderTagFillCell);

        rowTagFillCell.appendChild(labelTagFillCell);
        rowTagFillCell.appendChild(toggleContainerTagFillCell);
        tabPanels.ratings.appendChild(rowTagFillCell);

        cbTagFillCell.onchange = () => {
            checkIfChanged();
        };

        const updateTagFillCellVisibility = () => {
            rowTagFillCell.style.display = (cbColorRatings.checked && currentDisplayStyle === 'tag') ? 'flex' : 'none';
        };

        // 4) Colorized Rating Display Locations (Sub-item group)
        const showGroup = document.createElement('div');
        showGroup.className = 'cf-show-group';
        showGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding-left: 12px;';
        const showTitle = document.createElement('div');
        showTitle.className = 'cf-setting-sublabel';
        showTitle.style.marginBottom = '2px';
        showGroup.appendChild(showTitle);

        const showSettingsMap = [
            { key: 'submissions', labelKey: 'locSubmissions' },
            { key: 'status', labelKey: 'locStatus' },
            { key: 'hacks', labelKey: 'locHacks' },
            { key: 'problemset', labelKey: 'locProblemset' },
            { key: 'contestProblems', labelKey: 'locContestProblems' },
            { key: 'standings', labelKey: 'locStandings' },
            { key: 'problemTags', labelKey: 'locProblemTags' }
        ];

        const checkBoxes = {};
        showSettingsMap.forEach(item => {
            const label = document.createElement('label');
            label.className = 'cf-setting-item';
            label.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; user-select: none; min-height: 28px; margin: 0; padding-left: 12px;';

            const itemText = document.createElement('span');
            itemText.className = 'cf-setting-sublabel';
            item.textNode = document.createTextNode('');
            itemText.appendChild(item.textNode);

            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'cf-toggle-switch';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = appSettings.show[item.key];
            const sliderEl = document.createElement('span');
            sliderEl.className = 'cf-toggle-slider';
            toggleContainer.appendChild(cb);
            toggleContainer.appendChild(sliderEl);

            cb.onchange = () => {
                checkIfChanged();
            };

            checkBoxes[item.key] = cb;
            label.appendChild(itemText);
            label.appendChild(toggleContainer);
            showGroup.appendChild(label);
        });
        tabPanels.ratings.appendChild(showGroup);

        cbColorRatings.onchange = () => {
            rowStyle.style.display = cbColorRatings.checked ? 'flex' : 'none';
            showGroup.style.display = cbColorRatings.checked ? 'flex' : 'none';
            updateTagFillCellVisibility();
            checkIfChanged();
        };
        rowStyle.style.display = cbColorRatings.checked ? 'flex' : 'none';
        showGroup.style.display = cbColorRatings.checked ? 'flex' : 'none';
        updateTagFillCellVisibility();

        // -------------------------------------------------------------
        // PANEL 4: 用户 (Users)
        // -------------------------------------------------------------
        // 1) Show User Avatar
        const rowAvatar = document.createElement('label');
        rowAvatar.className = 'cf-setting-item';
        rowAvatar.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelAvatar = document.createElement('span');
        labelAvatar.className = 'cf-setting-label';

        const toggleContainerAvatar = document.createElement('div');
        toggleContainerAvatar.className = 'cf-toggle-switch';
        const cbAvatar = document.createElement('input');
        cbAvatar.type = 'checkbox';
        cbAvatar.className = 'cf-toggle-user-avatar';
        cbAvatar.checked = appSettings.show.userAvatar;
        const sliderAvatar = document.createElement('span');
        sliderAvatar.className = 'cf-toggle-slider';
        toggleContainerAvatar.appendChild(cbAvatar);
        toggleContainerAvatar.appendChild(sliderAvatar);

        rowAvatar.appendChild(labelAvatar);
        rowAvatar.appendChild(toggleContainerAvatar);
        tabPanels.user.appendChild(rowAvatar);

        // 2) Avatar Size
        const rowAvatarSize = document.createElement('div');
        rowAvatarSize.className = 'cf-setting-item cf-row-avatar-size';
        rowAvatarSize.style.paddingLeft = '12px';

        const labelAvatarSize = document.createElement('span');
        labelAvatarSize.className = 'cf-setting-sublabel';

        const avatarSizeInput = document.createElement('input');
        avatarSizeInput.type = 'range';
        avatarSizeInput.min = '0.8';
        avatarSizeInput.max = '3.0';
        avatarSizeInput.step = '0.1';
        avatarSizeInput.value = appSettings.avatarSize || 1.6;
        avatarSizeInput.style.cssText = 'width: 100px; cursor: pointer;';

        const avatarSizeVal = document.createElement('span');
        avatarSizeVal.style.cssText = 'font-size: 12px; width: 28px; text-align: right; display: inline-block; color: #64748b; font-weight: 500;';
        avatarSizeVal.textContent = parseFloat(avatarSizeInput.value).toFixed(1) + 'x';

        avatarSizeInput.oninput = () => {
            avatarSizeVal.textContent = parseFloat(avatarSizeInput.value).toFixed(1) + 'x';
            checkIfChanged();
        };

        const sizeWrapper = document.createElement('div');
        sizeWrapper.style.display = 'flex';
        sizeWrapper.style.alignItems = 'center';
        sizeWrapper.style.gap = '5px';
        sizeWrapper.appendChild(avatarSizeInput);
        sizeWrapper.appendChild(avatarSizeVal);

        rowAvatarSize.appendChild(labelAvatarSize);
        rowAvatarSize.appendChild(sizeWrapper);
        tabPanels.user.appendChild(rowAvatarSize);

        // 3) Format Teams Setting
        const rowFormatTeams = document.createElement('label');
        rowFormatTeams.className = 'cf-setting-item cf-row-format-teams';
        rowFormatTeams.style.cssText = 'padding-left: 12px; cursor: pointer; user-select: none; margin: 0;';

        const labelFormatTeams = document.createElement('span');
        labelFormatTeams.className = 'cf-setting-sublabel';

        const toggleContainerFormatTeams = document.createElement('div');
        toggleContainerFormatTeams.className = 'cf-toggle-switch';
        const cbFormatTeams = document.createElement('input');
        cbFormatTeams.type = 'checkbox';
        cbFormatTeams.checked = appSettings.show.formatTeams !== false;
        const sliderFormatTeams = document.createElement('span');
        sliderFormatTeams.className = 'cf-toggle-slider';
        toggleContainerFormatTeams.appendChild(cbFormatTeams);
        toggleContainerFormatTeams.appendChild(sliderFormatTeams);

        rowFormatTeams.appendChild(labelFormatTeams);
        rowFormatTeams.appendChild(toggleContainerFormatTeams);
        tabPanels.user.appendChild(rowFormatTeams);

        cbFormatTeams.onchange = () => {
            checkIfChanged();
        };

        cbAvatar.onchange = () => {
            rowAvatarSize.style.display = cbAvatar.checked ? 'flex' : 'none';
            rowFormatTeams.style.display = cbAvatar.checked ? 'flex' : 'none';
            checkIfChanged();
        };
        rowAvatarSize.style.display = cbAvatar.checked ? 'flex' : 'none';
        rowFormatTeams.style.display = cbAvatar.checked ? 'flex' : 'none';

        // -------------------------------------------------------------
        // PANEL 5: 快捷键 (Shortcuts)
        // -------------------------------------------------------------
        const shortcutsHeader = document.createElement('div');
        shortcutsHeader.className = 'cf-shortcuts-header';

        const shortcutsTitleEl = document.createElement('h3');
        shortcutsTitleEl.className = 'cf-shortcuts-title';
        shortcutsTitleEl.innerHTML = '<span class="cf-section-title-icon">' + TAB_ICONS.shortcuts + '</span><span class="cf-shortcuts-title-text"></span>';

        const shortcutsSubtitleEl = document.createElement('p');
        shortcutsSubtitleEl.className = 'cf-shortcuts-subtitle';

        const shortcutsTipEl = document.createElement('p');
        shortcutsTipEl.className = 'cf-shortcuts-subtitle';

        const shortcutsNoteEl = document.createElement('div');
        shortcutsNoteEl.className = 'cf-shortcuts-note';
        shortcutsNoteEl.innerHTML = '<span class="cf-shortcuts-note-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span><div class="cf-shortcuts-note-body"><strong class="cf-shortcuts-note-label"></strong><span class="cf-shortcuts-note-text"></span></div>';

        shortcutsHeader.appendChild(shortcutsTitleEl);
        shortcutsHeader.appendChild(shortcutsSubtitleEl);
        shortcutsHeader.appendChild(shortcutsTipEl);
        shortcutsHeader.appendChild(shortcutsNoteEl);
        tabPanels.shortcuts.appendChild(shortcutsHeader);

        const shortcutsList = document.createElement('div');
        shortcutsList.className = 'cf-shortcuts-list';

        const shortcutGroups = [
            {
                id: 'general',
                icon: TAB_ICONS.general,
                labelKey: 'tabGeneral',
                items: [
                    { key: 'hideTags', titleKey: 'shortcutHideTagsTitle', descKey: 'shortcutHideTagsDesc' }
                ]
            },
            {
                id: 'appearance',
                icon: TAB_ICONS.appearance,
                labelKey: 'tabAppearance',
                items: [
                    { key: 'langIcon', titleKey: 'shortcutLangIconTitle', descKey: 'shortcutLangIconDesc' },
                    { key: 'shortVerdict', titleKey: 'shortcutShortVerdictTitle', descKey: 'shortcutShortVerdictDesc' },
                    { key: 'timeFormat', titleKey: 'shortcutTimeFormatTitle', descKey: 'shortcutTimeFormatDesc' }
                ]
            },
            {
                id: 'ratings',
                icon: TAB_ICONS.ratings,
                labelKey: 'tabRatings',
                items: [
                    { key: 'clistEnabled', titleKey: 'shortcutClistEnabledTitle', descKey: 'shortcutClistEnabledDesc' },
                    { key: 'colorRatings', titleKey: 'shortcutColorRatingsTitle', descKey: 'shortcutColorRatingsDesc' },
                    { key: 'displayStyle', titleKey: 'shortcutDisplayStyleTitle', descKey: 'shortcutDisplayStyleDesc' }
                ]
            },
            {
                id: 'user',
                icon: TAB_ICONS.user,
                labelKey: 'tabUser',
                items: [
                    { key: 'userAvatar', titleKey: 'shortcutUserAvatarTitle', descKey: 'shortcutUserAvatarDesc' }
                ]
            }
        ];

        const shortcutDefs = shortcutGroups.flatMap(g => g.items);

        const shortcutKeyBtns = {};
        let recordingCleanupFn = null;

        const KEY_LABEL_MAP = {
            'PAGEUP': 'PgUp',
            'PAGEDOWN': 'PgDn',
            'INSERT': 'Ins',
            'DELETE': 'Del',
            'ESCAPE': 'Esc',
            'CONTROL': 'Ctrl',
            'ARROWUP': '↑',
            'ARROWDOWN': '↓',
            'ARROWLEFT': '←',
            'ARROWRIGHT': '→',
            'UP': '↑',
            'DOWN': '↓',
            'LEFT': '←',
            'RIGHT': '→',
            'BACKSPACE': '⌫'
        };

        const renderShortcutKeyBtn = (btn, combo) => {
            btn.innerHTML = '';
            btn.removeAttribute('title');
            btn.setAttribute('data-tooltip', t().shortcutEditTooltip);
            if (!combo || !combo.trim()) {
                const emptySpan = document.createElement('span');
                emptySpan.className = 'cf-shortcut-empty';
                emptySpan.textContent = t().shortcutEmpty;
                btn.appendChild(emptySpan);
                return;
            }
            const parts = combo.split('+');
            parts.forEach((p, idx) => {
                if (idx > 0) {
                    const sep = document.createElement('span');
                    sep.className = 'cf-shortcut-plus';
                    sep.textContent = '+';
                    btn.appendChild(sep);
                }
                const kbd = document.createElement('kbd');
                const pUpper = p.toUpperCase();
                kbd.textContent = KEY_LABEL_MAP[pUpper] || p;
                btn.appendChild(kbd);
            });
        };

        const startShortcutRecording = (keyId, btn) => {
            if (recordingCleanupFn) {
                recordingCleanupFn();
            }
            hideFloatingTooltip();
            btn.removeAttribute('title');
            btn.classList.add('recording');
            btn.textContent = t().shortcutRecording;

            const onKeyDown = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (e.key === 'Escape') {
                    stopRecording();
                    return;
                }
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                    return;
                }

                const parts = [];
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.altKey) parts.push('Alt');
                if (isShiftActive(e)) parts.push('Shift');
                if (e.metaKey) parts.push('Meta');

                let mainKey = '';
                if (CODE_TO_BASE_KEY[e.code]) {
                    mainKey = CODE_TO_BASE_KEY[e.code];
                } else if (e.code && e.code.startsWith('Key')) {
                    mainKey = e.code.slice(3).toUpperCase();
                } else if (e.code && e.code.startsWith('Digit')) {
                    mainKey = e.code.slice(5);
                } else if (e.key === ' ') {
                    mainKey = 'Space';
                } else {
                    mainKey = e.key.toUpperCase();
                }

                parts.push(mainKey);
                const combo = parts.join('+');

                if (!appSettings.shortcuts) appSettings.shortcuts = {};

                // Clear any other shortcut that conflicts with this combo
                shortcutDefs.forEach(def => {
                    if (def.key !== keyId && (appSettings.shortcuts[def.key] || '').toLowerCase() === combo.toLowerCase()) {
                        appSettings.shortcuts[def.key] = '';
                        if (shortcutKeyBtns[def.key]) {
                            renderShortcutKeyBtn(shortcutKeyBtns[def.key], '');
                        }
                    }
                });

                appSettings.shortcuts[keyId] = combo;
                saveSettings(appSettings);
                renderShortcutKeyBtn(btn, combo);
                stopRecording();
            };

            const onClickOutside = (e) => {
                if (!btn.contains(e.target)) {
                    stopRecording();
                }
            };

            const stopRecording = () => {
                window.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('mousedown', onClickOutside, true);
                btn.classList.remove('recording');
                btn.removeAttribute('title');
                hideFloatingTooltip();
                renderShortcutKeyBtn(btn, (appSettings.shortcuts && appSettings.shortcuts[keyId]) || '');
                recordingCleanupFn = null;
            };

            recordingCleanupFn = stopRecording;
            window.addEventListener('keydown', onKeyDown, true);
            document.addEventListener('mousedown', onClickOutside, true);
        };

        shortcutGroups.forEach(group => {
            const groupBlock = document.createElement('div');
            groupBlock.className = 'cf-shortcut-group';

            const groupHeader = document.createElement('div');
            groupHeader.className = 'cf-shortcut-group-header';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'cf-shortcut-group-icon';
            iconSpan.innerHTML = group.icon;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'cf-shortcut-group-title';
            titleSpan.textContent = t()[group.labelKey];
            group.titleSpan = titleSpan;

            groupHeader.appendChild(iconSpan);
            groupHeader.appendChild(titleSpan);
            groupBlock.appendChild(groupHeader);

            const groupBox = document.createElement('div');
            groupBox.className = 'cf-shortcut-group-box';

            group.items.forEach(def => {
                const item = document.createElement('div');
                item.className = 'cf-shortcut-item';

                const title = document.createElement('div');
                title.className = 'cf-shortcut-title';
                title.addEventListener('mouseenter', () => {
                    if (title.scrollWidth > title.clientWidth) {
                        showFloatingTooltip(title, title.textContent);
                    }
                });
                title.addEventListener('mouseleave', hideFloatingTooltip);
                def.titleEl = title;

                const controls = document.createElement('div');
                controls.className = 'cf-shortcut-controls';

                const keyBtn = document.createElement('button');
                keyBtn.type = 'button';
                keyBtn.className = 'cf-shortcut-key-btn';
                const currentCombo = (appSettings.shortcuts && appSettings.shortcuts[def.key]) !== undefined
                    ? appSettings.shortcuts[def.key]
                    : DEFAULT_SETTINGS.shortcuts[def.key];
                renderShortcutKeyBtn(keyBtn, currentCombo);

                keyBtn.addEventListener('mouseenter', () => {
                    if (!keyBtn.classList.contains('recording')) {
                        showFloatingTooltip(keyBtn, keyBtn.getAttribute('data-tooltip') || t().shortcutEditTooltip);
                    }
                });
                keyBtn.addEventListener('mouseleave', hideFloatingTooltip);

                keyBtn.onclick = (e) => {
                    e.stopPropagation();
                    hideFloatingTooltip();
                    if (keyBtn.classList.contains('recording')) {
                        if (recordingCleanupFn) recordingCleanupFn();
                    } else {
                        startShortcutRecording(def.key, keyBtn);
                    }
                };
                shortcutKeyBtns[def.key] = keyBtn;

                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'cf-shortcut-clear-btn';
                clearBtn.setAttribute('data-tooltip', t().shortcutClearBtn);
                clearBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                clearBtn.addEventListener('mouseenter', () => {
                    showFloatingTooltip(clearBtn, clearBtn.getAttribute('data-tooltip') || t().shortcutClearBtn);
                });
                clearBtn.addEventListener('mouseleave', hideFloatingTooltip);
                clearBtn.onclick = (e) => {
                    e.stopPropagation();
                    hideFloatingTooltip();
                    if (recordingCleanupFn) recordingCleanupFn();
                    if (!appSettings.shortcuts) appSettings.shortcuts = {};
                    appSettings.shortcuts[def.key] = '';
                    saveSettings(appSettings);
                    renderShortcutKeyBtn(keyBtn, '');
                };
                def.clearBtn = clearBtn;

                const resetBtn = document.createElement('button');
                resetBtn.type = 'button';
                resetBtn.className = 'cf-shortcut-reset-btn';
                resetBtn.setAttribute('data-tooltip', t().shortcutResetBtn);
                resetBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
                resetBtn.addEventListener('mouseenter', () => {
                    showFloatingTooltip(resetBtn, resetBtn.getAttribute('data-tooltip') || t().shortcutResetBtn);
                });
                resetBtn.addEventListener('mouseleave', hideFloatingTooltip);
                resetBtn.onclick = (e) => {
                    e.stopPropagation();
                    hideFloatingTooltip();
                    if (recordingCleanupFn) recordingCleanupFn();
                    const defaultKey = DEFAULT_SETTINGS.shortcuts[def.key];
                    if (!appSettings.shortcuts) appSettings.shortcuts = {};
                    shortcutDefs.forEach(other => {
                        if (other.key !== def.key && (appSettings.shortcuts[other.key] || '').toLowerCase() === defaultKey.toLowerCase()) {
                            appSettings.shortcuts[other.key] = '';
                            if (shortcutKeyBtns[other.key]) renderShortcutKeyBtn(shortcutKeyBtns[other.key], '');
                        }
                    });
                    appSettings.shortcuts[def.key] = defaultKey;
                    saveSettings(appSettings);
                    renderShortcutKeyBtn(keyBtn, defaultKey);
                };
                def.resetBtn = resetBtn;

                controls.appendChild(keyBtn);
                controls.appendChild(clearBtn);
                controls.appendChild(resetBtn);

                item.appendChild(title);
                item.appendChild(controls);
                groupBox.appendChild(item);
            });

            groupBlock.appendChild(groupBox);
            shortcutsList.appendChild(groupBlock);
        });

        const btnResetAllShortcuts = document.createElement('button');
        btnResetAllShortcuts.type = 'button';
        btnResetAllShortcuts.className = 'cf-shortcut-reset-all-btn';
        btnResetAllShortcuts.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span class="btn-text"></span>';
        btnResetAllShortcuts.onclick = () => {
            if (recordingCleanupFn) recordingCleanupFn();
            if (!appSettings.shortcuts) appSettings.shortcuts = {};
            Object.assign(appSettings.shortcuts, JSON.parse(JSON.stringify(DEFAULT_SETTINGS.shortcuts)));
            saveSettings(appSettings);
            shortcutDefs.forEach(def => {
                if (shortcutKeyBtns[def.key]) {
                    renderShortcutKeyBtn(shortcutKeyBtns[def.key], appSettings.shortcuts[def.key]);
                }
            });
        };

        tabPanels.shortcuts.appendChild(shortcutsList);
        tabPanels.shortcuts.appendChild(btnResetAllShortcuts);

        // -------------------------------------------------------------
        // PANEL 6: 存储 (Storage)
        // -------------------------------------------------------------
        const storageHeader = document.createElement('div');
        storageHeader.className = 'cf-storage-header';

        const storageTitleEl = document.createElement('h3');
        storageTitleEl.className = 'cf-storage-title';
        storageTitleEl.innerHTML = '<span class="cf-section-title-icon">' + TAB_ICONS.storage + '</span><span class="cf-storage-title-text"></span>';

        const storageSubtitleEl = document.createElement('p');
        storageSubtitleEl.className = 'cf-storage-subtitle';

        storageHeader.appendChild(storageTitleEl);
        storageHeader.appendChild(storageSubtitleEl);
        tabPanels.storage.appendChild(storageHeader);

        // Storage Overview Card
        const storageOverview = document.createElement('div');
        storageOverview.className = 'cf-storage-overview';

        const overviewTop = document.createElement('div');
        overviewTop.className = 'cf-storage-overview-top';

        const overviewInfo = document.createElement('div');
        overviewInfo.className = 'cf-storage-overview-info';

        const overviewLabel = document.createElement('span');
        overviewLabel.className = 'cf-storage-overview-label';

        const overviewVal = document.createElement('span');
        overviewVal.className = 'cf-storage-overview-val';

        overviewInfo.appendChild(overviewLabel);
        overviewInfo.appendChild(overviewVal);

        const btnClearAll = document.createElement('button');
        btnClearAll.type = 'button';
        btnClearAll.className = 'cf-storage-clear-all-btn';
        btnClearAll.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span class="btn-text"></span>`;

        overviewTop.appendChild(overviewInfo);
        overviewTop.appendChild(btnClearAll);
        storageOverview.appendChild(overviewTop);

        // Progress bar track
        const barTrack = document.createElement('div');
        barTrack.className = 'cf-storage-bar-track';

        const segClist = document.createElement('div');
        segClist.className = 'cf-storage-bar-seg seg-clist';
        const segCf = document.createElement('div');
        segCf.className = 'cf-storage-bar-seg seg-cf';
        const segAvatar = document.createElement('div');
        segAvatar.className = 'cf-storage-bar-seg seg-avatar';
        const segSolved = document.createElement('div');
        segSolved.className = 'cf-storage-bar-seg seg-solved';
        const segSettings = document.createElement('div');
        segSettings.className = 'cf-storage-bar-seg seg-settings';
        const segLegacy = document.createElement('div');
        segLegacy.className = 'cf-storage-bar-seg seg-legacy';

        barTrack.appendChild(segClist);
        barTrack.appendChild(segCf);
        barTrack.appendChild(segAvatar);
        barTrack.appendChild(segSolved);
        barTrack.appendChild(segSettings);
        barTrack.appendChild(segLegacy);
        storageOverview.appendChild(barTrack);

        [segClist, segCf, segAvatar, segSolved, segSettings, segLegacy].forEach(seg => {
            seg.addEventListener('mouseenter', () => {
                const tipText = seg.getAttribute('data-tooltip');
                if (tipText) showFloatingTooltip(seg, tipText);
            });
            seg.addEventListener('mouseleave', hideFloatingTooltip);
        });

        // Legends
        const legendContainer = document.createElement('div');
        legendContainer.className = 'cf-storage-legend';

        const createLegendItem = (segClass) => {
            const item = document.createElement('span');
            item.className = 'cf-storage-legend-item';
            const dot = document.createElement('span');
            dot.className = `cf-storage-legend-dot ${segClass}`;
            const label = document.createElement('span');
            label.className = 'cf-storage-legend-text';
            item.appendChild(dot);
            item.appendChild(label);
            return { item, label };
        };

        const legendClist = createLegendItem('seg-clist');
        const legendCf = createLegendItem('seg-cf');
        const legendAvatar = createLegendItem('seg-avatar');
        const legendSolved = createLegendItem('seg-solved');
        const legendSettings = createLegendItem('seg-settings');
        const legendLegacy = createLegendItem('seg-legacy');

        legendContainer.appendChild(legendClist.item);
        legendContainer.appendChild(legendCf.item);
        legendContainer.appendChild(legendAvatar.item);
        legendContainer.appendChild(legendSolved.item);
        legendContainer.appendChild(legendSettings.item);
        legendContainer.appendChild(legendLegacy.item);
        storageOverview.appendChild(legendContainer);

        tabPanels.storage.appendChild(storageOverview);

        // Storage Items List
        const storageList = document.createElement('div');
        storageList.className = 'cf-storage-list';

        const STORAGE_ICONS = {
            settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
            cf: CF_ICON_SVG,
            clist: `<img src="${CLIST_ICON_DATA_URI}" width="18" height="18" style="border-radius:2px;" alt="CList" />`,
            avatar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            solved: CF_ICON_SVG,
            legacy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
        };

        const createStorageItem = (iconSvg, iconClass, btnType) => {
            const item = document.createElement('div');
            item.className = 'cf-storage-item';

            const main = document.createElement('div');
            main.className = 'cf-storage-item-main';

            const iconBox = document.createElement('div');
            iconBox.className = `cf-storage-icon-box ${iconClass}`;
            iconBox.innerHTML = iconSvg;

            const body = document.createElement('div');
            body.className = 'cf-storage-item-body';

            const header = document.createElement('div');
            header.className = 'cf-storage-item-header';

            const title = document.createElement('span');
            title.className = 'cf-storage-item-title';

            const btnGroup = document.createElement('div');
            btnGroup.className = 'cf-storage-btn-group';

            const viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'cf-storage-btn btn-view';
            viewBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span class="btn-text"></span>`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `cf-storage-btn ${btnType}`;
            btn.innerHTML = btnType === 'btn-reset'
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span class="btn-text"></span>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span class="btn-text"></span>`;

            btnGroup.appendChild(viewBtn);
            btnGroup.appendChild(btn);

            header.appendChild(title);
            header.appendChild(btnGroup);

            const meta = document.createElement('div');
            meta.className = 'cf-storage-item-meta';

            const sizeVal = document.createElement('span');
            sizeVal.className = 'cf-storage-size-val';

            const dot = document.createElement('span');
            dot.className = 'cf-storage-meta-dot';
            dot.textContent = '·';

            const countTag = document.createElement('span');
            countTag.className = 'cf-storage-count-tag';

            meta.appendChild(sizeVal);
            meta.appendChild(dot);
            meta.appendChild(countTag);

            body.appendChild(header);
            body.appendChild(meta);

            main.appendChild(iconBox);
            main.appendChild(body);

            const desc = document.createElement('p');
            desc.className = 'cf-storage-item-desc';

            item.appendChild(main);
            item.appendChild(desc);

            return {
                item,
                title,
                countTag,
                desc,
                sizeVal,
                btn,
                btnTextSpan: btn.querySelector('.btn-text'),
                viewBtn,
                viewBtnTextSpan: viewBtn.querySelector('.btn-text')
            };
        };

        const itemSettings = createStorageItem(STORAGE_ICONS.settings, 'icon-settings', 'btn-reset');
        const itemCf = createStorageItem(STORAGE_ICONS.cf, 'icon-cf', 'btn-clear');
        const itemClist = createStorageItem(STORAGE_ICONS.clist, 'icon-clist', 'btn-clear');
        const itemAvatar = createStorageItem(STORAGE_ICONS.avatar, 'icon-avatar', 'btn-clear');
        const itemUserSolved = createStorageItem(STORAGE_ICONS.solved, 'icon-solved', 'btn-clear');
        const itemLegacy = createStorageItem(STORAGE_ICONS.legacy, 'icon-legacy', 'btn-clear');

        storageList.appendChild(itemSettings.item);
        storageList.appendChild(itemCf.item);
        storageList.appendChild(itemClist.item);
        storageList.appendChild(itemAvatar.item);
        storageList.appendChild(itemUserSolved.item);
        storageList.appendChild(itemLegacy.item);

        tabPanels.storage.appendChild(storageList);

        const getStorageItemBytes = (key) => {
            try {
                const val = appStorage.getItem(key);
                if (!val) return 0;
                const str = typeof val === 'string' ? val : JSON.stringify(val);
                return (new Blob([str])).size;
            } catch (e) {
                return 0;
            }
        };

        const ACTIVE_STORAGE_KEYS = [
            SETTINGS_KEY,
            CACHE_KEY,
            CACHE_TIME_KEY,
            PARALLEL_CONTESTS_KEY,
            CLIST_STORAGE_KEY,
            CLIST_LAST_SYNC_KEY,
            AVATAR_CACHE_KEY,
            UPDATE_CHECK_KEY
        ];

        const getUserSolvedStorageDetails = () => {
            const solvedKeys = [];
            let totalBytes = 0;
            let totalSolvedCount = 0;
            let currentUserSolvedCount = 0;
            let currentKey = null;
            const dataMap = {};
            try {
                const allKeys = (typeof GM_listValues === 'function') ? GM_listValues() : [];
                const keySet = new Set(allKeys);
                if (typeof localStorage !== 'undefined') {
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && k.startsWith('cf_user_solved_')) keySet.add(k);
                    }
                }
                const currentHandle = getCurrentUserHandle();
                currentKey = currentHandle ? ('cf_user_solved_' + currentHandle.toLowerCase()) : null;
                if (currentKey) {
                    keySet.add(currentKey);
                }

                for (const k of keySet) {
                    if (k && k.startsWith('cf_user_solved_')) {
                        const bytes = getStorageItemBytes(k);
                        if (bytes > 0) {
                            solvedKeys.push(k);
                            totalBytes += bytes;
                            const parsed = appStorage.getJSON(k, null);
                            if (parsed) {
                                if (Array.isArray(parsed.solved)) {
                                    const sorted = sortProblemIds(parsed.solved);
                                    let isDifferent = false;
                                    if (sorted.length !== parsed.solved.length) {
                                        isDifferent = true;
                                    } else {
                                        for (let i = 0; i < sorted.length; i++) {
                                            if (sorted[i] !== parsed.solved[i]) {
                                                isDifferent = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (isDifferent) {
                                        parsed.solved = sorted;
                                        try {
                                            appStorage.setJSON(k, parsed);
                                        } catch (e) { }
                                    } else {
                                        parsed.solved = sorted;
                                    }
                                    totalSolvedCount += parsed.solved.length;
                                }
                                dataMap[k] = parsed;
                            }
                        }
                    }
                }

                if (currentKey && solvedKeys.includes(currentKey)) {
                    solvedKeys.sort((a, b) => {
                        if (a === currentKey) return -1;
                        if (b === currentKey) return 1;
                        return a.localeCompare(b);
                    });
                } else {
                    solvedKeys.sort((a, b) => a.localeCompare(b));
                }

                if (currentKey && dataMap[currentKey] && Array.isArray(dataMap[currentKey].solved)) {
                    currentUserSolvedCount = dataMap[currentKey].solved.length;
                } else if (!currentHandle && solvedKeys.length > 0) {
                    const fallbackKey = solvedKeys[0];
                    if (dataMap[fallbackKey] && Array.isArray(dataMap[fallbackKey].solved)) {
                        currentUserSolvedCount = dataMap[fallbackKey].solved.length;
                    }
                }
            } catch (e) { }
            return {
                keys: solvedKeys,
                bytes: totalBytes,
                count: currentUserSolvedCount,
                totalCount: totalSolvedCount,
                currentUserSolvedCount,
                dataMap,
                currentKey
            };
        };

        const getLegacyStorageDetails = () => {
            const legacyKeys = [];
            let totalBytes = 0;
            const dataMap = {};
            try {
                const keySet = new Set();
                if (typeof GM_listValues === 'function') {
                    try {
                        const gmKeys = GM_listValues() || [];
                        gmKeys.forEach(k => { if (k) keySet.add(k); });
                    } catch (e) { }
                }
                if (typeof localStorage !== 'undefined') {
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k && k.startsWith('cf_')) keySet.add(k);
                        }
                    } catch (e) { }
                }

                for (const k of keySet) {
                    if (k && !ACTIVE_STORAGE_KEYS.includes(k) && !k.startsWith('cf_user_solved_')) {
                        legacyKeys.push(k);
                        totalBytes += getStorageItemBytes(k);
                        const raw = appStorage.getItem(k);
                        try {
                            dataMap[k] = JSON.parse(raw);
                        } catch (e) {
                            dataMap[k] = raw;
                        }
                    }
                }
            } catch (e) { }
            return { keys: legacyKeys, bytes: totalBytes, dataMap };
        };

        const formatStorageBytes = (bytes) => {
            if (!bytes || bytes <= 0) return '0 B';
            if (bytes < 1024) return bytes + ' B';
            const kb = bytes / 1024;
            if (kb < 1024) return kb.toFixed(1) + ' KB';
            const mb = kb / 1024;
            return mb.toFixed(2) + ' MB';
        };

        const formatJsonSyntaxHighlight = (json, forceTruncated = false) => {
            if (!json) return '';
            let displayStr = json;
            let isTruncated = forceTruncated;
            const MAX_CHARS = 25000;
            if (json.length > MAX_CHARS) {
                const cutIdx = json.lastIndexOf('\n', MAX_CHARS);
                displayStr = json.slice(0, cutIdx > 0 ? cutIdx : MAX_CHARS);
                isTruncated = true;
            }

            const escaped = displayStr
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const regex = /(\/\/[^\n]*|"([^"\\]|\\.)*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
            let highlighted = escaped.replace(regex, (m) => {
                if (m.startsWith('//')) {
                    return `<span class="cf-json-comment" style="color: #64748b; font-style: italic;">${m}</span>`;
                }
                if (m.charCodeAt(0) === 34) {
                    if (m.endsWith(':')) {
                        const colonIdx = m.lastIndexOf(':');
                        const keyPart = m.slice(0, colonIdx);
                        const colonPart = m.slice(colonIdx);
                        return `<span class="cf-json-key">${keyPart}</span><span class="cf-json-punct">${colonPart}</span>`;
                    }
                    return `<span class="cf-json-string">${m}</span>`;
                }
                if (m === 'true' || m === 'false') {
                    return `<span class="cf-json-boolean">${m}</span>`;
                }
                if (m === 'null') {
                    return `<span class="cf-json-null">null</span>`;
                }
                return `<span class="cf-json-number">${m}</span>`;
            });

            if (isTruncated && !displayStr.includes('// ... [')) {
                const tipText = t('storageTruncatedTip');
                highlighted += `\n\n<span style="color: #64748b; font-style: italic;">// ... [${tipText}] ...</span>`;
            }

            return highlighted;
        };

        const showStorageJsonModal = (titleText, keys, getContentForKeyFn) => {
            document.querySelectorAll('.cf-storage-json-modal').forEach(m => m.remove());

            const overlay = document.createElement('div');
            overlay.className = 'cf-clist-modal-overlay cf-storage-json-modal';
            preventScrollChaining(overlay);

            const card = document.createElement('div');
            card.className = 'cf-clist-modal-card';
            card.style.width = '640px';
            card.style.maxHeight = '85vh';

            const keyList = Array.isArray(keys) ? keys.filter(Boolean) : (keys ? [keys] : []);
            let activeKey = keyList.length > 0 ? keyList[0] : '';
            let currentRenderKey = activeKey;
            let currentJsonStr = '';
            const keyDataCache = new Map();

            card.innerHTML = `
                <div class="cf-clist-modal-header" style="padding: 12px 18px;">
                    <div class="cf-clist-modal-title" style="font-size: 14.5px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>${titleText}</span>
                        <span class="cf-storage-modal-badge" style="font-size: 11px; font-weight: 500; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0; margin-left: 6px;">${t('storageItemCount', 0)} · 0 B</span>
                    </div>
                    <button type="button" class="cf-modal-close-btn" style="background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1; padding:2px 4px; transition:color 0.15s ease; flex-shrink: 0;">&times;</button>
                </div>
                <div class="cf-clist-modal-body" style="padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; font-size: 11.5px; color: #64748b;">
                        <div style="flex: 1; min-width: 0; line-height: 1.6; word-break: break-all;">
                            <span style="font-weight: 600; margin-right: 6px; color: #334155;">${t('storageKeyPrefix')}:</span>
                            <code class="cf-storage-active-key" style="background: #f1f5f9; padding: 2px 7px; border-radius: 4px; color: #0284c7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; font-weight: 600; border: 1px solid #e2e8f0;">${activeKey || '(none)'}</code>
                        </div>
                        <button type="button" class="cf-storage-copy-json-btn">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            <span class="copy-btn-text">${t('storageCopyBtn')}</span>
                        </button>
                    </div>
                    <div class="cf-storage-key-buttons" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;"></div>
                    <div style="flex: 1; min-height: 0; position: relative;">
                        <pre class="cf-storage-json-pre" style="margin: 0; padding: 12px 14px; background: #0f172a; color: #cbd5e1; border-radius: 8px; font-size: 11.5px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow: auto; overscroll-behavior: contain; max-height: 50vh; border: 1px solid #1e293b; box-sizing: border-box; white-space: pre;"></pre>
                    </div>
                </div>
                <div class="cf-clist-modal-footer" style="padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; color: #94a3b8;">${t('storageViewFooterTip')}</span>
                    <button type="button" class="cf-guide-confirm-btn" style="background: #0284c7; color: #fff; border: 1px solid #0284c7; border-radius: 6px; padding: 5px 16px; font-size: 12px; font-weight: 600; cursor: pointer;">${t('storageCloseBtn')}</button>
                </div>
            `;

            const activeKeyEl = card.querySelector('.cf-storage-active-key');
            const keyButtonsContainer = card.querySelector('.cf-storage-key-buttons');
            const preEl = card.querySelector('.cf-storage-json-pre');
            const badgeEl = card.querySelector('.cf-storage-modal-badge');

            const renderActiveKey = (key, isInitial = false) => {
                if (!isInitial && activeKey === key && preEl.innerHTML) {
                    return;
                }
                activeKey = key;
                currentRenderKey = key;
                if (activeKeyEl) {
                    activeKeyEl.textContent = activeKey || '(none)';
                }

                keyButtonsContainer.querySelectorAll('.cf-storage-key-tab-btn').forEach(btn => {
                    const isCurrent = btn.getAttribute('data-key') === activeKey;
                    btn.style.background = isCurrent ? '#0284c7' : '#f8fafc';
                    btn.style.color = isCurrent ? '#ffffff' : '#334155';
                    btn.style.borderColor = isCurrent ? '#0284c7' : '#cbd5e1';
                    btn.style.fontWeight = isCurrent ? '600' : '500';
                });

                if (!activeKey) {
                    preEl.innerHTML = `<span style="color: #64748b; font-style: italic;">${t('storageEmptyData')}</span>`;
                    if (badgeEl) badgeEl.textContent = `${t('storageItemCount', 0)} · 0 B`;
                    currentJsonStr = '{}';
                    return;
                }

                if (keyDataCache.has(activeKey)) {
                    const cached = keyDataCache.get(activeKey);
                    currentJsonStr = cached.jsonStr;
                    preEl.innerHTML = cached.highlightedHtml;
                    preEl.scrollTop = 0;
                    if (badgeEl) badgeEl.textContent = cached.badgeText;
                    return;
                }

                const targetKey = activeKey;
                const computeAndRender = () => {
                    if (targetKey !== currentRenderKey) return;
                    let content;
                    try {
                        content = typeof getContentForKeyFn === 'function' ? getContentForKeyFn(targetKey) : appStorage.getJSON(targetKey, null);
                    } catch (e) {
                        content = { error: String(e) };
                    }

                    // 1. 获取完整项数与真实存储占用
                    const count = (content && typeof content === 'object') ? Object.keys(content).length : (content !== null && content !== undefined ? 1 : 0);
                    let storageBytes = getStorageItemBytes(targetKey);

                    // 2. 切片构建轻量预览数据，彻底杜绝超大对象全量序列化造成的卡顿
                    const PREVIEW_LIMIT = 60;
                    const TRUNCATE_MARKER = '__CF_PREVIEW_TRUNCATED_MARKER__';
                    let previewContent = content;
                    let isTruncated = false;

                    if (Array.isArray(content)) {
                        if (content.length > PREVIEW_LIMIT) {
                            previewContent = content.slice(0, PREVIEW_LIMIT);
                            previewContent.push(TRUNCATE_MARKER);
                            isTruncated = true;
                        }
                    } else if (content && typeof content === 'object') {
                        const keys = Object.keys(content);
                        if (keys.length > PREVIEW_LIMIT) {
                            previewContent = {};
                            for (let i = 0; i < PREVIEW_LIMIT; i++) {
                                previewContent[keys[i]] = content[keys[i]];
                            }
                            previewContent[TRUNCATE_MARKER] = true;
                            isTruncated = true;
                        } else if (Array.isArray(content.solved) && content.solved.length > PREVIEW_LIMIT) {
                            previewContent = {
                                ...content,
                                solved: [...content.solved.slice(0, PREVIEW_LIMIT), TRUNCATE_MARKER]
                            };
                            isTruncated = true;
                        } else if (content.problems && typeof content.problems === 'object' && Object.keys(content.problems).length > PREVIEW_LIMIT) {
                            const pKeys = Object.keys(content.problems);
                            const slicedProblems = {};
                            for (let i = 0; i < PREVIEW_LIMIT; i++) {
                                slicedProblems[pKeys[i]] = content.problems[pKeys[i]];
                            }
                            slicedProblems[TRUNCATE_MARKER] = true;
                            previewContent = {
                                ...content,
                                problems: slicedProblems
                            };
                            isTruncated = true;
                        }
                    }

                    const displayPreviewObj = {
                        [targetKey]: previewContent !== undefined ? previewContent : null
                    };

                    let previewJsonStr = JSON.stringify(displayPreviewObj, null, 2);
                    if (isTruncated) {
                        const tipText = t('storageTruncatedTip');
                        previewJsonStr = previewJsonStr.replace(
                            /([ \t]*)"__CF_PREVIEW_TRUNCATED_MARKER__"(?:\s*:\s*true)?/g,
                            `$1// ... [${tipText}] ...`
                        );
                    }
                    if (targetKey === PARALLEL_CONTESTS_KEY || targetKey === 'cf_parallel_contests') {
                        previewJsonStr = previewJsonStr.replace(/\[\s*([-\d\s,]+?)\s*\]/g, (match, nums) => {
                            const compact = nums.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean).join(', ');
                            return `[${compact}]`;
                        });
                    }

                    if (!storageBytes || storageBytes <= 0) {
                        storageBytes = (new Blob([previewJsonStr])).size;
                    }

                    const highlightedHtml = formatJsonSyntaxHighlight(previewJsonStr, isTruncated);
                    preEl.innerHTML = highlightedHtml;
                    preEl.scrollTop = 0;

                    const badgeText = `${t('storageItemCount', count)} · ${formatStorageBytes(storageBytes)}`;
                    if (badgeEl) {
                        badgeEl.textContent = badgeText;
                    }

                    keyDataCache.set(targetKey, {
                        content,
                        previewJsonStr,
                        highlightedHtml,
                        badgeText
                    });
                };

                if (isInitial) {
                    computeAndRender();
                } else {
                    requestAnimationFrame(computeAndRender);
                }
            };

            if (keyList.length > 0) {
                keyList.forEach(k => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'cf-storage-key-tab-btn';
                    btn.setAttribute('data-key', k);
                    btn.textContent = k;
                    btn.style.cssText = `
                        padding: 3px 9px;
                        border-radius: 5px;
                        font-size: 11.5px;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                        cursor: pointer;
                        transition: all 0.15s ease;
                        border: 1px solid #cbd5e1;
                        background: #f8fafc;
                        color: #334155;
                        line-height: 1.4;
                    `;
                    btn.onmouseenter = () => {
                        if (btn.getAttribute('data-key') !== activeKey) {
                            btn.style.background = '#f1f5f9';
                            btn.style.borderColor = '#94a3b8';
                        }
                    };
                    btn.onmouseleave = () => {
                        if (btn.getAttribute('data-key') !== activeKey) {
                            btn.style.background = '#f8fafc';
                            btn.style.borderColor = '#cbd5e1';
                        }
                    };
                    btn.onclick = () => renderActiveKey(k);
                    keyButtonsContainer.appendChild(btn);
                });
            } else {
                keyButtonsContainer.style.display = 'none';
            }

            renderActiveKey(activeKey, true);

            const close = () => {
                window.removeEventListener('keydown', handleKeydown);
                overlay.remove();
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') close();
            };
            window.addEventListener('keydown', handleKeydown);

            const copyBtn = card.querySelector('.cf-storage-copy-json-btn');
            const copyBtnText = card.querySelector('.copy-btn-text');
            copyBtn.onclick = () => {
                let fullJsonStr = '';
                try {
                    let contentToExport;
                    if (keyDataCache.has(activeKey) && keyDataCache.get(activeKey).content !== undefined) {
                        contentToExport = keyDataCache.get(activeKey).content;
                    } else if (typeof getContentForKeyFn === 'function') {
                        contentToExport = getContentForKeyFn(activeKey);
                    } else {
                        contentToExport = appStorage.getJSON(activeKey, null);
                    }
                    const exportObj = {
                        [activeKey]: contentToExport !== undefined ? contentToExport : null
                    };
                    fullJsonStr = JSON.stringify(exportObj, null, 2);
                    if (activeKey === PARALLEL_CONTESTS_KEY || activeKey === 'cf_parallel_contests') {
                        fullJsonStr = fullJsonStr.replace(/\[\s*([-\d\s,]+?)\s*\]/g, (match, nums) => {
                            const compact = nums.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean).join(', ');
                            return `[${compact}]`;
                        });
                    }
                } catch (e) {
                    fullJsonStr = '{}';
                }

                navigator.clipboard.writeText(fullJsonStr).then(() => {
                    copyBtnText.textContent = t('storageCopiedBtn');
                    copyBtn.style.background = '#ecfdf5';
                    copyBtn.style.borderColor = '#a7f3d0';
                    copyBtn.style.color = '#059669';
                    setTimeout(() => {
                        copyBtnText.textContent = t('storageCopyBtn');
                        copyBtn.style.background = '#f0f9ff';
                        copyBtn.style.borderColor = '#bae6fd';
                        copyBtn.style.color = '#0284c7';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy JSON', err);
                });
            };

            card.querySelector('.cf-modal-close-btn').onclick = close;
            card.querySelector('.cf-guide-confirm-btn').onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };

            overlay.appendChild(card);
            document.body.appendChild(overlay);
        };

        const showStorageConfirmModal = (options) => showConfirmPop({ lang: currentLang, ...options });

        refreshStorageUI = () => {
            const settingsBytes = getStorageItemBytes(SETTINGS_KEY);
            const cfBytes = getStorageItemBytes(CACHE_KEY) + getStorageItemBytes(CACHE_TIME_KEY) + getStorageItemBytes(PARALLEL_CONTESTS_KEY);
            const clistBytes = getStorageItemBytes(CLIST_STORAGE_KEY) + getStorageItemBytes(CLIST_LAST_SYNC_KEY);
            const avatarBytes = getStorageItemBytes(AVATAR_CACHE_KEY);
            const solvedInfo = getUserSolvedStorageDetails();
            const solvedBytes = solvedInfo.bytes;
            const legacyInfo = getLegacyStorageDetails();
            const legacyBytes = legacyInfo.bytes;

            const totalBytes = settingsBytes + cfBytes + clistBytes + avatarBytes + solvedBytes + legacyBytes;

            overviewVal.textContent = formatStorageBytes(totalBytes);

            if (totalBytes > 0) {
                segClist.style.width = ((clistBytes / totalBytes) * 100).toFixed(1) + '%';
                segCf.style.width = ((cfBytes / totalBytes) * 100).toFixed(1) + '%';
                segAvatar.style.width = ((avatarBytes / totalBytes) * 100).toFixed(1) + '%';
                segSolved.style.width = ((solvedBytes / totalBytes) * 100).toFixed(1) + '%';
                segSettings.style.width = ((settingsBytes / totalBytes) * 100).toFixed(1) + '%';
                segLegacy.style.width = ((legacyBytes / totalBytes) * 100).toFixed(1) + '%';
            } else {
                segClist.style.width = '0%';
                segCf.style.width = '0%';
                segAvatar.style.width = '0%';
                segSolved.style.width = '0%';
                segSettings.style.width = '0%';
                segLegacy.style.width = '0%';
            }

            const setSegInfo = (seg, name, bytes) => {
                const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : '0.0';
                seg.setAttribute('data-tooltip', `${name}: ${formatStorageBytes(bytes)} (${pct}%)`);
            };
            setSegInfo(segClist, t().storageBarClist, clistBytes);
            setSegInfo(segCf, t().storageBarCf, cfBytes);
            setSegInfo(segAvatar, t().storageBarAvatar, avatarBytes);
            setSegInfo(segSolved, t().storageBarSolved, solvedBytes);
            setSegInfo(segSettings, t().storageBarSettings, settingsBytes);
            setSegInfo(segLegacy, t().storageBarLegacy, legacyBytes);

            itemSettings.sizeVal.textContent = formatStorageBytes(settingsBytes);
            const settingsKeysCount = Object.keys(appSettings || {}).length;
            itemSettings.countTag.textContent = typeof t().storageItemCount === 'function' ? t().storageItemCount(settingsKeysCount) : `${settingsKeysCount} items`;

            itemCf.sizeVal.textContent = formatStorageBytes(cfBytes);
            let cfCount = 0;
            if (cfBytes > 0) {
                try {
                    const parsed = appStorage.getJSON(CACHE_KEY);
                    if (parsed) cfCount = Object.keys(parsed).filter(k => !k.startsWith('NAME:')).length;
                } catch (e) { }
            }
            itemCf.countTag.textContent = cfCount > 0 ? (typeof t().storageProblemCount === 'function' ? t().storageProblemCount(cfCount) : `${cfCount} problems`) : t().storageClearedBadge;

            itemClist.sizeVal.textContent = formatStorageBytes(clistBytes);
            let clistCount = 0;
            if (clistBytes > 0) {
                try {
                    const parsed = appStorage.getJSON(CLIST_STORAGE_KEY);
                    if (parsed) {
                        const dict = (parsed && parsed.problems) ? parsed.problems : (Array.isArray(parsed) ? {} : parsed);
                        clistCount = Object.keys(dict).filter(k => !k.startsWith('NAME:')).length;
                    }
                } catch (e) { }
            }
            itemClist.countTag.textContent = clistCount > 0 ? (typeof t().storageProblemCount === 'function' ? t().storageProblemCount(clistCount) : `${clistCount} problems`) : t().storageClearedBadge;

            itemAvatar.sizeVal.textContent = formatStorageBytes(avatarBytes);
            let avatarCount = 0;
            if (avatarBytes > 0) {
                try {
                    const parsed = appStorage.getJSON(AVATAR_CACHE_KEY);
                    if (parsed) avatarCount = Object.keys(parsed).length;
                } catch (e) { }
            }
            itemAvatar.countTag.textContent = avatarCount > 0 ? (typeof t().storageAvatarCount === 'function' ? t().storageAvatarCount(avatarCount) : `${avatarCount} avatars`) : t().storageClearedBadge;

            itemUserSolved.sizeVal.textContent = formatStorageBytes(solvedBytes);
            if (solvedBytes === 0 || solvedInfo.keys.length === 0) {
                itemUserSolved.countTag.textContent = t().storageClearedBadge;
            } else {
                itemUserSolved.countTag.textContent = typeof t().storageSolvedCount === 'function'
                    ? t().storageSolvedCount(solvedInfo.count)
                    : `${solvedInfo.count} solved`;
            }

            itemLegacy.sizeVal.textContent = formatStorageBytes(legacyBytes);
            const legacyKeyCount = legacyInfo.keys.length;
            itemLegacy.countTag.textContent = legacyKeyCount > 0
                ? (typeof t().storageItemCount === 'function' ? t().storageItemCount(legacyKeyCount) : `${legacyKeyCount} items`)
                : t().storageClearedBadge;
        };

        const syncInputsFromAppSettings = () => {
            isSyncingInputs = true;
            try {
                currentLang = appSettings.lang || 'zh';
                updateLangSwitchUI();

                cbHideTags.checked = !!appSettings.hideTags;
                if (typeof cbHideRatingTag !== 'undefined') {
                    cbHideRatingTag.checked = !!appSettings.hideRatingTag;
                }
                if (typeof cbNotHideAcTags !== 'undefined') {
                    cbNotHideAcTags.checked = !!appSettings.notHideAcTags;
                }
                if (typeof cbAutoCheckUpdate !== 'undefined') {
                    cbAutoCheckUpdate.checked = !!appSettings.disableAutoCheckUpdate;
                }
                if (typeof updateHideTagsSubItemsVisibility === 'function') {
                    updateHideTagsSubItemsVisibility();
                }

                selectedColor = appSettings.acBgColor || DEFAULT_SETTINGS.acBgColor;
                if (pickr) {
                    try { pickr.setColor(selectedColor, true); } catch (e) { }
                }

                cbLangIcon.checked = appSettings.show.langIcon !== false;
                langIconSizeInput.value = appSettings.langIconSize !== undefined ? appSettings.langIconSize : DEFAULT_SETTINGS.langIconSize;
                langIconSizeVal.textContent = parseFloat(langIconSizeInput.value).toFixed(1) + 'x';
                rowLangIconSize.style.display = cbLangIcon.checked ? 'flex' : 'none';

                cbShortVerdict.checked = !!(appSettings.show && appSettings.show.shortVerdict);

                timeToggle.checked = !!(appSettings.timeFormat && appSettings.timeFormat.enabled);
                timeInput.value = (appSettings.timeFormat && appSettings.timeFormat.format) || 'YYYY/MM/DD HH:mm';
                if (typeof updatePreview === 'function') updatePreview();

                cbClistEnabled.checked = !!(appSettings.clist && appSettings.clist.enabled);
                clistSubgroup.style.display = cbClistEnabled.checked ? 'flex' : 'none';
                currentAuthMode = (appSettings.clist && appSettings.clist.authMode) || 'cookie';
                if (typeof updateAuthSwitchUI === 'function') updateAuthSwitchUI();
                inputClistApiKey.value = (appSettings.clist && appSettings.clist.apiKey) || '';

                cbColorRatings.checked = appSettings.colorRatings !== false;
                currentDisplayStyle = appSettings.displayStyle || 'tag';
                if (typeof updateStyleUI === 'function') updateStyleUI();
                cbTagFillCell.checked = appSettings.tagFillCell !== false;
                if (typeof updateTagFillCellVisibility === 'function') updateTagFillCellVisibility();
                rowStyle.style.display = cbColorRatings.checked ? 'flex' : 'none';
                showGroup.style.display = cbColorRatings.checked ? 'flex' : 'none';

                showSettingsMap.forEach(item => {
                    if (checkBoxes[item.key]) {
                        checkBoxes[item.key].checked = !!(appSettings.show && appSettings.show[item.key]);
                    }
                });

                cbAvatar.checked = !!(appSettings.show && appSettings.show.userAvatar);
                avatarSizeInput.value = appSettings.avatarSize !== undefined ? appSettings.avatarSize : DEFAULT_SETTINGS.avatarSize;
                avatarSizeVal.textContent = parseFloat(avatarSizeInput.value).toFixed(1) + 'x';
                cbFormatTeams.checked = !(appSettings.show && appSettings.show.formatTeams === false);
                rowAvatarSize.style.display = cbAvatar.checked ? 'flex' : 'none';
                rowFormatTeams.style.display = cbAvatar.checked ? 'flex' : 'none';

                if (typeof shortcutDefs !== 'undefined') {
                    shortcutDefs.forEach(def => {
                        if (shortcutKeyBtns[def.key]) {
                            renderShortcutKeyBtn(shortcutKeyBtns[def.key], (appSettings.shortcuts && appSettings.shortcuts[def.key]) !== undefined ? appSettings.shortcuts[def.key] : DEFAULT_SETTINGS.shortcuts[def.key]);
                        }
                    });
                }

                updateTexts();
                updateDynamicStyle();
            } finally {
                isSyncingInputs = false;
            }
        };

        itemSettings.viewBtn.onclick = () => {
            showStorageJsonModal(
                t().storageSettingsTitle,
                [SETTINGS_KEY],
                (k) => appStorage.getJSON(k, appSettings)
            );
        };

        itemSettings.btn.onclick = () => {
            showStorageConfirmModal({
                title: t().storageSettingsTitle,
                type: 'warning',
                message: t().storageSettingsResetConfirm,
                confirmText: t().storageSettingsResetBtn,
                onConfirm: () => {
                    try {
                        appStorage.removeItem(SETTINGS_KEY);
                        Object.keys(appSettings).forEach(k => delete appSettings[k]);
                        Object.assign(appSettings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
                        saveSettings(appSettings);
                    } catch (e) { }
                    syncInputsFromAppSettings();
                    refreshStorageUI();
                    if (typeof updateFooterRatingStatus === 'function') updateFooterRatingStatus();
                }
            });
        };

        itemCf.viewBtn.onclick = () => {
            let loadedCfData = (latestRatingsMap && Object.keys(latestRatingsMap).length > 0) ? latestRatingsMap : null;
            let loadedParallelData = parallelContestsCache;

            showStorageJsonModal(
                t().storageCfTitle,
                [CACHE_KEY, PARALLEL_CONTESTS_KEY],
                (k) => {
                    if (k === CACHE_KEY) {
                        if (!loadedCfData) {
                            loadedCfData = sortProblemKeys(appStorage.getJSON(CACHE_KEY, {}));
                        }
                        return loadedCfData;
                    }
                    if (k === PARALLEL_CONTESTS_KEY) {
                        if (!loadedParallelData) {
                            loadedParallelData = appStorage.getJSON(PARALLEL_CONTESTS_KEY, null);
                        }
                        return loadedParallelData;
                    }
                    return appStorage.getJSON(k, null);
                }
            );
        };

        itemCf.btn.onclick = () => {
            showStorageConfirmModal({
                title: t().storageCfTitle,
                type: 'danger',
                message: t().storageCfClearConfirm,
                confirmText: t().storageCfClearBtn,
                onConfirm: () => {
                    try {
                        appStorage.removeItem(CACHE_KEY);
                        appStorage.removeItem(CACHE_TIME_KEY);
                        appStorage.removeItem(PARALLEL_CONTESTS_KEY);
                    } catch (e) { }
                    latestRatingsMap = {};
                    parallelContestsCache = null;
                    contestToPeersMap = null;
                    invalidateContestProblemsIndex();
                    refreshStorageUI();
                    if (typeof updateFooterRatingStatus === 'function') updateFooterRatingStatus();
                }
            });
        };

        itemClist.viewBtn.onclick = () => {
            showStorageJsonModal(
                t().storageClistTitle,
                [CLIST_STORAGE_KEY],
                (k) => sortProblemKeys(appStorage.getJSON(k, {}))
            );
        };

        itemClist.btn.onclick = () => {
            showStorageConfirmModal({
                title: t().storageClistTitle,
                type: 'danger',
                message: t().storageClistClearConfirm,
                confirmText: t().storageClistClearBtn,
                onConfirm: () => {
                    try {
                        appStorage.removeItem(CLIST_STORAGE_KEY);
                        appStorage.removeItem(CLIST_LAST_SYNC_KEY);
                    } catch (e) { }
                    clistProblemsCache = null;
                    if (appSettings.clist) {
                        appSettings.clist.lastSyncTime = 0;
                        saveSettings(appSettings);
                    }
                    refreshStorageUI();
                    if (typeof updateFooterRatingStatus === 'function') updateFooterRatingStatus();
                }
            });
        };

        itemAvatar.viewBtn.onclick = () => {
            showStorageJsonModal(
                t().storageAvatarTitle,
                [AVATAR_CACHE_KEY],
                (k) => appStorage.getJSON(k, {})
            );
        };

        itemAvatar.btn.onclick = () => {
            showStorageConfirmModal({
                title: t().storageAvatarTitle,
                type: 'danger',
                message: t().storageAvatarClearConfirm,
                confirmText: t().storageAvatarClearBtn,
                onConfirm: () => {
                    try {
                        appStorage.removeItem(AVATAR_CACHE_KEY);
                    } catch (e) { }
                    refreshStorageUI();
                }
            });
        };

        itemUserSolved.viewBtn.onclick = () => {
            const solvedInfo = getUserSolvedStorageDetails();
            showStorageJsonModal(
                t().storageSolvedTitle,
                solvedInfo.keys,
                (k) => solvedInfo.dataMap[k] || appStorage.getJSON(k, null)
            );
        };

        itemUserSolved.btn.onclick = () => {
            const solvedInfo = getUserSolvedStorageDetails();
            if (solvedInfo.keys.length === 0) {
                showStorageConfirmModal({
                    title: t().storageSolvedTitle,
                    type: 'info',
                    message: t().storageSolvedNoneTip
                });
                return;
            }
            showStorageConfirmModal({
                title: t().storageSolvedTitle,
                type: 'danger',
                message: t().storageSolvedClearConfirm,
                confirmText: t().storageSolvedClearBtn,
                onConfirm: () => {
                    solvedInfo.keys.forEach(k => {
                        try {
                            appStorage.removeItem(k);
                        } catch (e) { }
                    });
                    userSolvedCache = null;
                    refreshStorageUI();
                }
            });
        };

        itemLegacy.viewBtn.onclick = () => {
            const legacy = getLegacyStorageDetails();
            showStorageJsonModal(
                t().storageLegacyTitle,
                legacy.keys,
                (k) => legacy.dataMap[k] || appStorage.getJSON(k, null) || appStorage.getItem(k)
            );
        };

        itemLegacy.btn.onclick = () => {
            const legacy = getLegacyStorageDetails();
            if (legacy.keys.length === 0) {
                showStorageConfirmModal({
                    title: t().storageLegacyTitle,
                    type: 'info',
                    message: t().storageLegacyNoneTip
                });
                return;
            }
            showStorageConfirmModal({
                title: t().storageLegacyTitle,
                type: 'danger',
                message: typeof t().storageLegacyClearConfirm === 'function' ? t().storageLegacyClearConfirm(legacy.keys.length) : `Clear ${legacy.keys.length} legacy items?`,
                confirmText: t().storageLegacyClearBtn,
                onConfirm: () => {
                    legacy.keys.forEach(k => {
                        try {
                            appStorage.removeItem(k);
                        } catch (e) { }
                    });
                    refreshStorageUI();
                }
            });
        };

        btnClearAll.onclick = () => {
            showStorageConfirmModal({
                title: t().storageClearAllBtn,
                type: 'danger',
                message: t().storageClearAllConfirm,
                confirmText: t().storageClearAllBtn,
                onConfirm: () => {
                    try {
                        appStorage.removeItem(CACHE_KEY);
                        appStorage.removeItem(CACHE_TIME_KEY);
                        appStorage.removeItem(PARALLEL_CONTESTS_KEY);
                        appStorage.removeItem(CLIST_STORAGE_KEY);
                        appStorage.removeItem(CLIST_LAST_SYNC_KEY);
                        appStorage.removeItem(AVATAR_CACHE_KEY);
                        const solved = getUserSolvedStorageDetails();
                        solved.keys.forEach(k => {
                            try {
                                appStorage.removeItem(k);
                            } catch (e) { }
                        });
                        userSolvedCache = null;
                        const legacy = getLegacyStorageDetails();
                        legacy.keys.forEach(k => {
                            try {
                                appStorage.removeItem(k);
                            } catch (e) { }
                        });
                        appStorage.removeItem(SETTINGS_KEY);
                    } catch (e) { }
                    latestRatingsMap = {};
                    parallelContestsCache = null;
                    contestToPeersMap = null;
                    invalidateContestProblemsIndex();
                    clistProblemsCache = null;
                    try {
                        Object.keys(appSettings).forEach(k => delete appSettings[k]);
                        Object.assign(appSettings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
                        saveSettings(appSettings);
                    } catch (e) { }
                    syncInputsFromAppSettings();
                    refreshStorageUI();
                    if (typeof updateFooterRatingStatus === 'function') updateFooterRatingStatus();
                }
            });
        };

        // -------------------------------------------------------------
        // PANEL 7: 更新日志 (Changelog)
        // -------------------------------------------------------------
        function formatChangelogText(text) {
            if (!text) return '';
            let escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            escaped = escaped.replace(/`([^`]+)`/g, '<span class="cf-changelog-code">$1</span>');
            escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="cf-changelog-link">$1</a>');
            return escaped;
        }

        const CHANGELOG_DATA = [
            {
                version: 'v 1.5.9',
                date: '2026-09-11 04:41',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '新增了自动更新检测功能。'
                            ],
                            en: [
                                'Added automatic update detection functionality.'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '优化了存储界面的UI和相关逻辑。'
                            ],
                            en: [
                                'Optimized the storage management interface UI and related logic.'
                            ]
                        }
                    },
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '修复了 CF 官方数据中多场并赛（如 Div.1 与 Div.2 并行场次）重合题目在部分场次缺失难度分的问题，通过比赛开始时间关联同组并赛场次并自动承接同名题目的难度评分。',
                                '修复了设置页中 AC 背景色的颜色选择器显示为纯黑的问题。',
                                '修复了博客和主页帖子中发布者头像未正常显示的问题。'
                            ],
                            en: [
                                'Fixed missing difficulty ratings for shared problems across concurrent contests (e.g., Div.1 and Div.2) in official Codeforces data by grouping parallel contests by start time and inheriting ratings from peer contests with matching problem names.',
                                'Fixed an issue where the AC background color picker in settings displayed as pure black.',
                                'Fixed an issue where blog and topic post author avatars were not displayed.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.8',
                date: '2026-09-09 21:15',
                sections: [
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '为“隐藏算法标签”功能增加了“隐藏难度分标签”和“不隐藏已AC题目标签”的子项。',
                                '优化了“标签”样式下 2100~2300 以及 2300~2400 分橙题的颜色显示，提升视觉区分度。',
                                '优化了部分界面的 UI 表现。'
                            ],
                            en: [
                                'Added sub-options to "Hide Algorithm Tags" for hiding difficulty rating tags and retaining tags for AC problems.',
                                'Optimized the color display for 2100~2300 and 2300~2400 rating problems under the "Tag" style to improve visual distinction.',
                                'Optimized UI presentation across various interfaces.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.7',
                date: '2026-09-08 03:45',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '接入第三方 [CList](https://clist.by) 题目数据源，支持展示更加精细的题目难度评分，并提供 Cookie 会话与 API Key 两种认证同步模式。',
                                '“快捷键”设置面板，支持为常用功能自定义全局快捷热键，包含按键录制、冲突检测与一键重置功能。',
                                '“存储”管理面板，可视化展示油猴脚本存储占用分布，支持分项查看缓存数据、一键复制、独立清理或重置出厂配置。',
                                '“更新日志”页面，内置各历史版本的演进记录与折叠卡片交互，直观展示每一次版本更新的具体细节。',
                                '“开发计划”页面，展示插件后续功能的演进路线与开发进展规划，并提供社区功能提议通道，共同见证插件成长。',
                                '“致谢”页面，向 [CF-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj)、[CList](https://clist.by)、[OJ Better](https://github.com/beijixiaohu/OJBetter)、[Carrot-Plus](https://github.com/wuyuqian114514/carrot-plus) 等开源先驱与社区项目致敬。'
                            ],
                            en: [
                                'Integrated the third-party [CList](https://clist.by) problem dataset, supporting fine-grained problem ratings with both Cookie session and API Key authentication modes.',
                                'Added a dedicated "Shortcuts" settings panel, allowing users to customize global hotkeys for frequent actions, with key combination recording, conflict detection, and one-click reset.',
                                'Added a dedicated "Storage" management panel to visualize Tampermonkey script storage usage, inspect and copy cached data JSON, and selectively clear caches or restore factory defaults.',
                                'Added a dedicated "Changelog" page with built-in version history and collapsible cards, providing an intuitive overview of all release details.',
                                'Added a dedicated "Roadmap" page to outline upcoming feature milestones, development progress, and open channels for community feature proposals.',
                                'Added a dedicated "Acknowledgments" page, honoring pioneering open-source projects including [CF-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj), [CList](https://clist.by), [OJ Better](https://github.com/beijixiaohu/OJBetter), and [Carrot-Plus](https://github.com/wuyuqian114514/carrot-plus).'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '优化了菜单的 UI 界面，提供了更为精细的子菜单分组。',
                                '将原有的 LocalStorage 存储方式改为油猴脚本存储方式，避免可能超过 LocalStorage 潜在的 5MB 上限。',
                                '在难度分“标签”展示样式下新增“表格内标签铺满单元格”选项，提供更轻柔色系的难度分单元格展示。',
                                '为时间格式化模板字符串提供了更多格式字符串的支持和详细的内置文档介绍。',
                                '为判题状态缩写提供了详细的内置速查文档。',
                                '将队伍信息的相关展示逻辑，迁移到了 status 和 submissions 等页面。',
                                '优化了更新日志的文档结构。'
                            ],
                            en: [
                                'Polished the settings menu UI with more refined sub-menu groupings.',
                                'Migrated storage from browser LocalStorage to Tampermonkey script storage, avoiding potential LocalStorage 5MB quota limits.',
                                'Added a "Fill Table Cells with Tag Style" option under the Tag display style, offering softer-toned rating cell presentations.',
                                'Expanded format token support for custom time templates and provided detailed built-in documentation.',
                                'Provided detailed built-in reference documentation for verdict status abbreviations.',
                                'Migrated the relevant display logic of team information to status and submission pages.',
                                'Restructured the changelog documentation for clearer categorization and readability.'
                            ]
                        }
                    },
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '修复了 Codeforces 官方近期维护后导致读取的部分用户头像不可用的问题，增加了反代路径自动适配与加载失败自愈降级机制。',
                                '修复了在题单页和比赛题单页第一列使用 Rating 列导致 [Competitive Companion](https://chromewebstore.google.com/detail/Competitive%20Companion/cjnmckjndlpiamhfimnnjmnckgghkjbl) 插件无法一键读取题单题目的问题。'
                            ],
                            en: [
                                'Resolved an issue where some user avatar images failed to load following Codeforces\' recent server maintenance, adding automatic proxy path adaptation and fallback self-healing.',
                                'Fixed an issue where placing the Rating column as the first column on problemset and contest pages prevented the [Competitive Companion](https://chromewebstore.google.com/detail/Competitive%20Companion/cjnmckjndlpiamhfimnnjmnckgghkjbl) extension from parsing all problems with one click.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.6',
                date: '2026-09-01 03:10',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '新增了“隐藏算法标签”功能，支持隐藏题目页右侧具体的算法 Tag，仅保留难度评分。'
                            ],
                            en: [
                                'Added a "Hide Algorithm Tags" option in General settings, allowing users to conceal specific algorithm tags on problem pages while retaining the problem difficulty score.'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '优化了部分 ICPC 区域赛榜单在开启“显示用户头像”和“队伍信息格式化”时，Ghost Participant 队伍名称与成员信息的排版样式。',
                                '升级了插件设置菜单 UI，引入分组导航（通用、界面、难度分、用户），使选项结构更加清晰易用。',
                                '在“难度分”设置中增加了“色彩展示难度分”总开关，支持一键开启或关闭全站难度分着色与展示。'
                            ],
                            en: [
                                'Improved the formatting and layout of Ghost Participant teams in regional ICPC standings when both "User Avatars" and "Format Teams" are enabled.',
                                'Upgraded the settings menu UI with a multi-tab grouped navigation layout (General, Appearance, Ratings, Users) for a cleaner and more intuitive configuration experience.',
                                'Added a master switch for "Colored Ratings" in the Ratings settings tab, allowing users to toggle all rating colorizations and displays across the site with a single click.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.5',
                date: '2026-08-29 07:45',
                sections: [
                    {
                        type: 'announcement',
                        items: {
                            zh: [
                                '本项目从 [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 迁移并更名而来，作为 Colorforces 的初代 v1.5.5 版本。后续的所有功能开发与维护都将在此版本基础上继续进行。'
                            ],
                            en: [
                                'This project is migrated from [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 and has been rebranded as Colorforces. All future feature developments and updates will be built upon this version in this new repository.'
                            ]
                        }
                    },
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '实时界面预览。当在设置菜单改变样式选择时，页面将实时反映展示效果。'
                            ],
                            en: [
                                'Added real-time UI preview for the settings menu. Visual changes are now immediately reflected on the page without needing a refresh.'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '轻微美化了设置菜单的 UI，在底部增设了项目链接和快速反馈通道。',
                                '将虚拟竞赛的开始时间也一并纳入了可选的时间格式化范围。'
                            ],
                            en: [
                                'Slightly beautified the settings menu UI and added project links and a quick feedback channel to the footer.',
                                'Applied optional time formatting to the start time of virtual contests as well.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.4',
                date: '2026-08-28 18:45',
                sections: [
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '解决了 Standings 页面中开启头像显示后长队名展示被截断/遮挡的问题，并在设置中提供了队伍（包括 Ghost Participant 和 CF Team）格式化展示的功能选项。'
                            ],
                            en: [
                                'Resolved the issue on the Standings page where long team names were truncated/obscured when avatars were enabled. Added a new "Format Teams" feature toggle in the settings for both Ghost Participants and standard CF teams.'
                            ]
                        }
                    },
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '修复了 Contest 页面中开启头像显示后编写者头像的展示问题，现已恢复为美观的单行独立展示。'
                            ],
                            en: [
                                'Fixed the display of writers\' avatars on the Contest page when avatars were enabled, restoring a clean, line-by-line layout.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.3',
                date: '2026-08-24 16:15',
                sections: [
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '修复了页面首次加载时，颜色选择器（Pickr）由于外部 CSS 异步加载较慢而导致的未样式化内容闪烁（FOUC）问题。'
                            ],
                            en: [
                                'Fixed a Flash of Unstyled Content (FOUC) issue where the color picker (Pickr) would briefly flash upon page load before its external CSS was fully downloaded.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.2',
                date: '2026-08-24 14:15',
                sections: [
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '完善了 Node.js 以及 Delphi 的语言图标映射。'
                            ],
                            en: [
                                'Mapped Node.js and Delphi to their respective language icons correctly.'
                            ]
                        }
                    },
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '修复了在非数据表格（如 Recent Actions 动态页面）中，由于文本换行或表格布局误判导致头像被挤到上一行的问题。',
                                '移除了个人主页等带有 Codeforces 原生大头像框区域的冗余小头像，保持 UI 简洁。',
                                '修复了提交状态表格中 C 语言（如 "C11" 等版本）和 D 语言缺失专属图标的问题，并补充了自定义的 C（绿色）和 D 语言 SVG 矢量图标。'
                            ],
                            en: [
                                'Fixed an issue where injected avatars in non-data tables (like the Recent Actions page) could be pushed to the line above due to text wrapping or incorrect table layout detection.',
                                'Prevented redundant avatar rendering on Codeforces profile pages and near native large avatar containers to maintain a clean UI.',
                                'Fixed an issue where the C language variants (e.g., "C11") and the D language were missing icons in the submission status table. Added custom SVG icons for C (Green) and D.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.1',
                date: '2026-08-24 01:39',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '支持在设置面板中自由切换难度分呈现样式（经典“色块” / iView 风格“标签”）。',
                                '支持在设置面板中通过开关控制难度分在不同区域（提交、状态、Hack、各大题单、榜单及题目页标签）的显示。',
                                '支持开启并自定义时间格式化字符串，自带实时预览。',
                                '支持在表格中显示用户头像，并在设置中支持自定义大小。',
                                '支持在语言列显示语言专属图标（如 C++、Python、Go 等），并支持自定义图标大小。',
                                '支持将判题状态进行极简缩写（如 `Accepted` -> `AC`, `Time limit exceeded` -> `TLE` 等）。'
                            ],
                            en: [
                                'Support toggling the difficulty rating display style in the settings panel (Classic "Block" / iView-style "Tag").',
                                'Added toggles in the settings panel to control the display of ratings in different areas (Submissions, Status, Hacks, ProblemSet, Contest Problems, Standings, Problem Tags).',
                                'Support enabling and customizing time format strings with real-time preview.',
                                'Added support for displaying user avatars in tables, with customizable size via settings.',
                                'Added support for displaying dedicated language icons (e.g., C++, Python, Go) in the language column, with customizable size.',
                                'Added support for minimalist abbreviations of verdict statuses (e.g., `Accepted` -> `AC`, `Time limit exceeded` -> `TLE`).'
                            ]
                        }
                    },
                    {
                        type: 'fixed',
                        items: {
                            zh: [
                                '彻底删除了在普通页面题目链接旁附加 `[xxxx]` 分数文本显示的冗余逻辑。',
                                '修复了关闭自定义时间格式时，表格时间列排版错乱的问题，完全恢复官方默认样式。',
                                '修复了在使用深色背景插件（如 Dark Reader、CF-Better）时，难度分高亮背景刺眼的问题。'
                            ],
                            en: [
                                'Completely removed the redundant logic of appending `[xxxx]` score text next to problem links on normal pages.',
                                'Resolved layout issues in the time column when custom time formatting is disabled, fully restoring the official default style.',
                                'Resolved an issue where difficulty background highlights were glaring when using dark background plugins (such as Dark Reader, CF-Better).'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.5.0',
                date: '2026-08-23 21:50',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '新增页面右下角悬浮的“插件设置”菜单。',
                                '允许用户在设置中自定义 AC（Accepted）记录的背景色，配置将保存在本地缓存。'
                            ],
                            en: [
                                'Added a floating "Settings" menu at the bottom right corner of the page.',
                                'Added support for customizing the AC (Accepted) background color via the settings menu, with configuration persisted locally.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.4.2',
                date: '2026-08-23 18:25',
                sections: [
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '优化了高分段的视觉可读性。现在，对于分数 `>= 1600`（即蓝色及以上的段位），难度分的字体颜色会自动切换为高对比度的纯白色 (`#FFFFFF`)。'
                            ],
                            en: [
                                'Optimized text readability for higher ratings. For problem ratings `>= 1600` (Blue tier and above), the font color now automatically switches to high-contrast white (`#FFFFFF`).'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.4.1',
                date: '2026-08-23 18:00',
                sections: [
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '更改了时间格式，从 `yyyy-mm-dd hh:mm` 切换为 `yyyy/mm/dd hh:mm`，使其更加直观。'
                            ],
                            en: [
                                'Changed the time formatting from `yyyy-mm-dd hh:mm` to `yyyy/mm/dd hh:mm` for better readability.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.4.0',
                date: '2026-08-23 17:33',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '在 Problem 页面的 Tag 增加了题目 Rating 颜色显示。'
                            ],
                            en: [
                                'Added problem rating color display to problem tags.'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '优化了 Contest 页面的难度分展示与 AC 状态展示。',
                                '优化了 Hacks 页面的难度分展示。',
                                '优化了 Submissions/Status 页面的时间格式化和表格布局。'
                            ],
                            en: [
                                'Optimized difficulty rating and AC status display on contest pages.',
                                'Optimized difficulty rating display on hacks pages.',
                                'Optimized time formatting and table layout on submissions/status pages.'
                            ]
                        }
                    }
                ]
            },
            {
                version: 'v 1.3.5',
                date: '2026-08-22 23:50',
                sections: [
                    {
                        type: 'added',
                        items: {
                            zh: [
                                '在 `submissions` 页面和 `status` 页面直接显示题目的难度分数，并根据难度带有相应的色彩高亮。'
                            ],
                            en: [
                                'Displays problem difficulty ratings directly on `submissions` and `status` pages, complete with corresponding color highlighting.'
                            ]
                        }
                    },
                    {
                        type: 'optimized',
                        items: {
                            zh: [
                                '题目分数数据通过 Codeforces 官方 API 获取，每天仅在本地更新一次缓存，避免发送过多的网络请求。'
                            ],
                            en: [
                                'Fetches problem data via the official Codeforces API and updates locally only once per day, avoiding excessive network requests.'
                            ]
                        }
                    }
                ]
            }
        ];

        const changelogHeader = document.createElement('div');
        changelogHeader.className = 'cf-changelog-header';

        const changelogTitleEl = document.createElement('h3');
        changelogTitleEl.className = 'cf-changelog-title';
        changelogTitleEl.innerHTML = '<span class="cf-section-title-icon">' + TAB_ICONS.changelog + '</span><span class="cf-changelog-title-text"></span>';

        const changelogSubtitleEl = document.createElement('p');
        changelogSubtitleEl.className = 'cf-changelog-subtitle';

        changelogHeader.appendChild(changelogTitleEl);
        changelogHeader.appendChild(changelogSubtitleEl);
        tabPanels.changelog.appendChild(changelogHeader);

        const changelogListContainer = document.createElement('div');
        changelogListContainer.className = 'cf-changelog-list';
        tabPanels.changelog.appendChild(changelogListContainer);

        // 默认只展开最新版本，其他历史版本全部折叠
        const defaultLatestVer = CHANGELOG_DATA[0]?.version || 'v 1.5.9';
        const expandedChangelogVersions = new Set([defaultLatestVer]);

        resetChangelogExpansion = () => {
            expandedChangelogVersions.clear();
            if (CHANGELOG_DATA[0]?.version) {
                expandedChangelogVersions.add(CHANGELOG_DATA[0].version);
            }
            if (typeof renderChangelog === 'function') {
                renderChangelog();
            }
        };

        function renderChangelog() {
            if (!changelogListContainer) return;
            changelogListContainer.innerHTML = '';
            const isZh = (appSettings.lang || 'zh') === 'zh';

            CHANGELOG_DATA.forEach((verItem, index) => {
                const isLatest = index === 0;
                const isExpanded = expandedChangelogVersions.has(verItem.version);

                const card = document.createElement('div');
                card.className = `cf-changelog-card ${isExpanded ? 'expanded' : ''}`;

                const cardHeader = document.createElement('div');
                cardHeader.className = 'cf-changelog-card-header';

                const cardLeft = document.createElement('div');
                cardLeft.className = 'cf-changelog-card-left';

                const verSpan = document.createElement('span');
                verSpan.className = 'cf-changelog-version';
                verSpan.textContent = verItem.version.replace(/^v(?=\d)/i, 'v ');
                cardLeft.appendChild(verSpan);

                if (isLatest) {
                    const latestBadge = document.createElement('span');
                    latestBadge.className = 'cf-changelog-badge-latest';
                    latestBadge.textContent = t().changelogLatestBadge;
                    cardLeft.appendChild(latestBadge);
                }

                const cardRight = document.createElement('div');
                cardRight.className = 'cf-changelog-card-right';

                const dateSpan = document.createElement('span');
                dateSpan.className = 'cf-changelog-date';
                dateSpan.textContent = verItem.date;
                cardRight.appendChild(dateSpan);

                const chevron = document.createElement('span');
                chevron.className = 'cf-changelog-chevron';
                chevron.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                cardRight.appendChild(chevron);

                cardHeader.appendChild(cardLeft);
                cardHeader.appendChild(cardRight);

                const cardBody = document.createElement('div');
                cardBody.className = 'cf-changelog-card-body';

                verItem.sections.forEach(sec => {
                    const secEl = document.createElement('div');
                    secEl.className = 'cf-changelog-section';

                    const badge = document.createElement('span');
                    badge.className = `cf-changelog-section-badge ${sec.type}`;
                    const badgeKeyMap = {
                        added: 'changelogBadgeAdded',
                        optimized: 'changelogBadgeOptimized',
                        fixed: 'changelogBadgeFixed',
                        announcement: 'changelogBadgeAnnouncement'
                    };
                    badge.textContent = (badgeKeyMap[sec.type] ? t(badgeKeyMap[sec.type]) : null) || sec.type;
                    secEl.appendChild(badge);

                    const itemsList = document.createElement('div');
                    itemsList.className = 'cf-changelog-items';

                    const items = (isZh ? sec.items.zh : sec.items.en) || [];
                    items.forEach((text, itemIndex) => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'cf-changelog-item';

                        const indexSpan = document.createElement('span');
                        indexSpan.className = 'cf-changelog-item-index';
                        indexSpan.textContent = `${itemIndex + 1}.`;

                        const contentEl = document.createElement('div');
                        contentEl.className = 'cf-changelog-item-content';
                        contentEl.innerHTML = formatChangelogText(text);

                        itemEl.appendChild(indexSpan);
                        itemEl.appendChild(contentEl);
                        itemsList.appendChild(itemEl);
                    });

                    secEl.appendChild(itemsList);
                    cardBody.appendChild(secEl);
                });

                cardHeader.onclick = () => {
                    if (expandedChangelogVersions.has(verItem.version)) {
                        expandedChangelogVersions.delete(verItem.version);
                        card.classList.remove('expanded');
                    } else {
                        expandedChangelogVersions.add(verItem.version);
                        card.classList.add('expanded');
                    }
                };

                card.appendChild(cardHeader);
                card.appendChild(cardBody);
                changelogListContainer.appendChild(card);
            });
        }

        // -------------------------------------------------------------
        // PANEL 8: 开发计划 (Roadmap)
        // -------------------------------------------------------------
        const ROADMAP_DATA = [
            {
                id: 'rating-prediction',
                completed: false,
                title: {
                    zh: '表现分变化预测',
                    en: 'Performance Rating Predictor'
                },
                desc: {
                    zh: '集成类似 Carrot-Plus 的实时测算逻辑，在榜单中实时计算选手的表现分与预估 Rating 增减（Δ）。',
                    en: 'Integrate Carrot-Plus real-time prediction algorithms to estimate performance ratings and rating deltas (Δ) directly in standings.'
                }
            },
            {
                id: 'ui-themes',
                completed: false,
                title: {
                    zh: '提供多种 UI 样式的主题',
                    en: 'Multiple UI Styles & Color Themes'
                },
                desc: {
                    zh: '提供多套色彩丰富的配色主题方案，进一步美化界面。',
                    en: 'Provide multiple rich color themes to further beautify the interface.'
                }
            },
            {
                id: 'friend-groups',
                completed: false,
                title: {
                    zh: '好友分组标注功能',
                    en: 'Friends Custom Tagging & Grouping'
                },
                desc: {
                    zh: '支持为关注的好友创建自定义分组、添加备注与色彩标签，或者是分组图标、分组图片，甚至是分组头像框。',
                    en: 'Allow custom category tagging, nicknames, color markers, group icons or images, and even custom avatar frames for friends.'
                }
            },
            {
                id: 'cf-official-data',
                completed: true,
                title: {
                    zh: 'CF 官方题目数据集成',
                    en: 'Codeforces Official Problem Data Integration'
                },
                desc: {
                    zh: '接入 Codeforces 官方 API 题目评测与难度数据，每日自动在本地更新缓存，并在提交记录、状态和题单等页面动态渲染彩色难度。',
                    en: 'Fetches official problem ratings and tags via the Codeforces API, updates local cache daily, and highlights ratings dynamically across problem sets and submissions.'
                }
            },
            {
                id: 'clist-data',
                completed: true,
                title: {
                    zh: 'CList 题目数据集成',
                    en: 'CList Problem Data Integration'
                },
                desc: {
                    zh: '接入 CList 第三方题库精细难度分，支持 Cookie 与 API 密钥双认证方式、平稳节拍分批抓取、离线持久化与冷却保护机制。',
                    en: 'Integrates fine-grained problem ratings from CList with dual authentication (Cookie & API Key), paced batch scheduling, offline persistence, and cooldown protection.'
                }
            },
            {
                id: 'enhanced-page-presentation',
                completed: true,
                title: {
                    zh: '更好的页面内容展示',
                    en: 'Enhanced Page Content Presentation'
                },
                desc: {
                    zh: '全方位重塑页面视觉与排版体验：支持异步预热并展示用户头像、团队多成员换行排版、提交列表编程语言图标标注、自定义时间格式化（支持任意语法模板与时区标签显示）以及判题状态缩写。',
                    en: 'Comprehensive UI and visual presentation enhancements: user avatar caching and display, smart team member multiline formatting, programming language icons, customizable datetime formatting (with syntax templates and timezone labels), and compact verdict abbreviations.'
                }
            },
            {
                id: 'shortcuts',
                completed: true,
                title: {
                    zh: '快捷键功能',
                    en: 'Keyboard Shortcuts'
                },
                desc: {
                    zh: '为功能开关提供快捷键，可自定义配置。',
                    en: 'Provide keyboard shortcuts for feature toggles with custom configuration.'
                }
            },
            {
                id: 'storage-management',
                completed: true,
                title: {
                    zh: '本地存储管理功能',
                    en: 'Local Storage Management'
                },
                desc: {
                    zh: '内置本地存储明细面板，可查看各模块存储占用情况，支持数据格式化预览、一键重置与清空。',
                    en: 'Built-in local storage breakdown panel to inspect module usage, with JSON preview, one-click reset, and clear.'
                }
            }
        ];

        const roadmapHeader = document.createElement('div');
        roadmapHeader.className = 'cf-roadmap-header';

        const roadmapTitleEl = document.createElement('h3');
        roadmapTitleEl.className = 'cf-roadmap-title';
        roadmapTitleEl.innerHTML = '<span class="cf-section-title-icon">' + TAB_ICONS.roadmap + '</span><span class="cf-roadmap-title-text">' + t().roadmapTitle + '</span>';

        const roadmapSubtitleEl = document.createElement('p');
        roadmapSubtitleEl.className = 'cf-roadmap-subtitle';
        roadmapSubtitleEl.textContent = t().roadmapSubtitle;

        roadmapHeader.appendChild(roadmapTitleEl);
        roadmapHeader.appendChild(roadmapSubtitleEl);
        tabPanels.roadmap.appendChild(roadmapHeader);

        const roadmapContainer = document.createElement('div');
        roadmapContainer.className = 'cf-roadmap-container';
        tabPanels.roadmap.appendChild(roadmapContainer);

        function renderRoadmap() {
            if (!roadmapContainer) return;
            roadmapContainer.innerHTML = '';
            const currentLang = appSettings.lang || 'zh';
            const isZh = currentLang === 'zh';

            const plannedItems = ROADMAP_DATA.filter(item => !item.completed);
            const completedItems = ROADMAP_DATA.filter(item => item.completed);

            const renderGroup = (groupType, items) => {
                if (!items.length) return;
                const isPlanned = groupType === 'planned';

                const groupEl = document.createElement('div');
                groupEl.className = 'cf-roadmap-group';

                const groupHeader = document.createElement('div');
                groupHeader.className = 'cf-roadmap-group-header';

                const groupTitle = document.createElement('div');
                groupTitle.className = 'cf-roadmap-group-title';
                groupTitle.innerHTML = isPlanned
                    ? '<svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: #0284c7;"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M5 3L2 6"></path><path d="M22 6l-3-3"></path><path d="M6.38 18.7L4 21"></path><path d="M17.64 18.67L20 21"></path></svg><span>' + t().roadmapSectionPlanned + '</span>'
                    : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><polyline points="20 6 9 17 4 12"></polyline></svg><span>' + t().roadmapSectionCompleted + '</span>';

                const groupBadge = document.createElement('span');
                groupBadge.className = `cf-roadmap-group-badge ${isPlanned ? 'planned' : 'completed'}`;
                groupBadge.textContent = t('roadmapItemCount', items.length);

                groupHeader.appendChild(groupTitle);
                groupHeader.appendChild(groupBadge);
                groupEl.appendChild(groupHeader);

                const listEl = document.createElement('div');
                listEl.className = 'cf-roadmap-list';

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = `cf-roadmap-card ${item.completed ? 'completed' : ''}`;

                    const cardHeader = document.createElement('div');
                    cardHeader.className = 'cf-roadmap-card-header';

                    const titleWrap = document.createElement('div');
                    titleWrap.className = 'cf-roadmap-card-title-wrap';

                    const statusIcon = document.createElement('div');
                    statusIcon.className = `cf-roadmap-status-icon ${item.completed ? 'completed' : 'planned'}`;
                    statusIcon.innerHTML = item.completed
                        ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                        : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M5 3L2 6"></path><path d="M22 6l-3-3"></path><path d="M6.38 18.7L4 21"></path><path d="M17.64 18.67L20 21"></path></svg>';

                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'cf-roadmap-item-title-text';
                    titleSpan.textContent = isZh ? item.title.zh : item.title.en;

                    titleWrap.appendChild(statusIcon);
                    titleWrap.appendChild(titleSpan);

                    const tagSpan = document.createElement('span');
                    tagSpan.className = `cf-roadmap-tag ${item.completed ? 'completed' : 'planned'}`;
                    tagSpan.textContent = item.completed ? t().roadmapStatusCompleted : t().roadmapStatusPlanned;

                    cardHeader.appendChild(titleWrap);
                    cardHeader.appendChild(tagSpan);

                    const itemDesc = document.createElement('p');
                    itemDesc.className = 'cf-roadmap-item-desc';
                    itemDesc.textContent = isZh ? item.desc.zh : item.desc.en;

                    card.appendChild(cardHeader);
                    card.appendChild(itemDesc);
                    listEl.appendChild(card);
                });

                groupEl.appendChild(listEl);

                if (isPlanned) {
                    const proposalCard = document.createElement('div');
                    proposalCard.className = 'cf-roadmap-proposal-card';

                    const proposalHeader = document.createElement('div');
                    proposalHeader.className = 'cf-roadmap-proposal-header';

                    const titleWrap = document.createElement('div');
                    titleWrap.className = 'cf-roadmap-proposal-title-wrap';

                    const iconDiv = document.createElement('div');
                    iconDiv.className = 'cf-roadmap-proposal-icon';
                    iconDiv.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>';

                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'cf-roadmap-proposal-title-text';
                    titleSpan.textContent = t().roadmapProposalTitle;

                    titleWrap.appendChild(iconDiv);
                    titleWrap.appendChild(titleSpan);

                    const proposalBtn = document.createElement('a');
                    proposalBtn.className = 'cf-roadmap-proposal-btn';
                    proposalBtn.href = 'https://github.com/GodExious/Colorforces/issues';
                    proposalBtn.target = '_blank';
                    proposalBtn.innerHTML = '<span>' + t().roadmapProposalBtn + '</span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

                    proposalHeader.appendChild(titleWrap);
                    proposalHeader.appendChild(proposalBtn);

                    const proposalDesc = document.createElement('p');
                    proposalDesc.className = 'cf-roadmap-proposal-desc';
                    proposalDesc.textContent = t().roadmapProposalDesc;

                    proposalCard.appendChild(proposalHeader);
                    proposalCard.appendChild(proposalDesc);
                    groupEl.appendChild(proposalCard);
                }

                roadmapContainer.appendChild(groupEl);
            };

            renderGroup('planned', plannedItems);
            renderGroup('completed', completedItems);
        }

        renderRoadmap();

        // -------------------------------------------------------------
        // PANEL 9: 致谢 (Acknowledgments)
        // -------------------------------------------------------------
        const CF_HELPER_ICON_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAMAAAANIilAAAAAA3NCSVQICAjb4U/gAAAAvVBMVEVHcEzleRnhawLibAPdiDLibATicRDibQTohCbicxThdRfhawHjcArjbwjibALjbgXibgfjbQXnfx7hawElJSXibAPhawHkcxEhJSclJSYkJifjbgfhbw3ibgYwKigjJicrKysbJSnjcQ3ibQYzMjjjcAwvLi0qKSkkJSUpKCgrKysuLi8lJSXhagABAQEhISEODg77+/sYGBjf39+7u7t/f38xMTHr6+toaGibm5vU1NSrq6uOjo5YWFhHcEzQ1Ld4AAAAP3RSTlMAFOfJBL05sQomHO5gbN+agKUO++zU9i/J3bV2TImPp0l/RJELUypc9m47Gf///////////////////////wDHlIhfAAADu0lEQVRIicWWeXvaPAzAc993IAES7nK0jVKOrt267vt/rdeWHUiWlAF79rz6AzvGP8uSZVmC8K9kFYaLe9klEAnuYzXKQmzeBbsIw+oueMVg7S5Y8Sgr34O60thQAXTBl5wbUaNPlIZiZFg61a7cBOugOhKAnQB4jgzhTYqhLwjiuO95/SASBA9uUW1Aju1kgo1zJWxY2MgRNsMtNqKKjWV8AYkpXVwME+indB4bHfawUejnwoMkFOn6qdhkfYDEEfIEYtlLzgHJYSpp3JdjSBZCFgP4dXbJYmkJdH9GDd4+VF2T7kyGIMep45qhNo6EGomJSh42o15BpDfanBYQVEh1nCqdPSgmOKKnoPIRZY4kk+2kwmUwVZxq13wn44jrwpJ9r4dFQ4ZPlWucjOmp2WzSfauiBBrqmBUt2eC8HDyRqpasusfEbJmTexCOeptOFunZcKCDbuRjNxKaoo0l8KJ5UQxmvS54OxsVxZxsTlq2bzi5RjpZ8GHaRTIZPQtCpHddcTtOWeexAezKU3fO/k/Ba8Fewg0ZNdjvP0/0gLsn7rfgEFjCeG4oLj9ez6rXOMFtBic7rZjF9IbPfMGft/2vA+sSeUTHgm21YMH0dTo6YWh5oEj5eSzJCiXDp3SWvuxgqSiVybvy55Futzz+KIvy9bUsK6MvZ4UBuun9/VtJt75/e2Ffu7PHLgjR/HL42P+gW2X6X8pv+yNZ5BKs5EFlM53+QbDy/ZP+vrKlihG1Oet6Nw2ZnRWLkXJHjD382qP+z7fyHCUuqG27x/wxXfOTQpUfSO34WbF76UPWgr3YOnuM8+i1kwyZRhPaEWbbfDeTavLh+7HSeTpmIlHcjm1yIanNz/XQPtRZ4m0an47XoTkgT1NI1Y42p9kN9nFKlYckjbQqDStVNAnc6XAmCPOiQ8jD8zQcZCBpitlM+gpZMHZN4E6btFlmsEVKFPf3pO9jSlz44LLvx99ZnggCGF+R9NeDOjrgmZckfY0n/TMcsaSvprV8/DTlebA3nZ0GO5M+G3EzZgz/42E9621na/5a4KDelfQtTPokREF3A/kc+rVXMpczR6cFIX1d7Ka/nYAiK7oIdZrShBV0FoFoRbcaf1UeLVZ4Wj6jeWVg4BNmOldWscCS+JwdkQbXUUxELJ60wPcDuop+UzVEiqdMDFntGYpBx1W4JKRcTkByNS2zSYcbcbWYMsiGo6o5KSTVLzL1JTzCfY+ju6p1VunD/1Dp539V6ffxqt3F0krUlvyvitU/i3FbiX+T/AdhLbZ9Y8xiFgAAAABJRU5ErkJggg==';
        const GITHUB_ACK_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style="display: block;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
        const CARROT_ICON_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABRElEQVR4nOyZTQrCMBCFU/UIgiIi4lE8gSfxCC48gjfwBl5IERHxp/6doJpFNlJlMvNiJrQfdKUl8/JeJmnbMInTMIlTC4hN8gJahsls1SkMiPnklBkm3jciCy/DVwz5z6EL/4QqRO0aoE5Y3YViUx0BklYXElZR/+hI1AmDzipCWLB9gMp62i6W46bxhRtRqIDNu/hvv40WeZA1VN3DXBkx2hRszO2P+DiGAWJUR8gRa5eDjLsjxMcxAMcI4kDMM0bya0A8eXuP+Dj6wBiJIxT7iJq8ANH4B0Z8HD1QjEQOaHjCSV4Au4ajID6OLiBGbAe0PCCzN7IMcJ0BLrIcuAAGRlHNF1sZ8MqFbnpH6KooPhZvAdpez6lYAzeBq14O3JXFx+IlQFt8LGra6IPpLtmBp8L4WMgCNMbHorUuMvU3sti8AAAA///BNLeiAAAABklEQVQDAFjtSRgrNmPKAAAAAElFTkSuQmCC';

        const ackHeader = document.createElement('div');
        ackHeader.className = 'cf-ack-header';

        const ackTitleEl = document.createElement('h3');
        ackTitleEl.className = 'cf-ack-title';
        ackTitleEl.innerHTML = '<span class="cf-section-title-icon">' + TAB_ICONS.acknowledgments + '</span><span class="cf-ack-title-text"></span>';

        const ackSubtitleEl = document.createElement('p');
        ackSubtitleEl.className = 'cf-ack-subtitle';

        ackHeader.appendChild(ackTitleEl);
        ackHeader.appendChild(ackSubtitleEl);
        tabPanels.acknowledgments.appendChild(ackHeader);

        // Card 1: Codeforces-Helper
        const cardHelper = document.createElement('div');
        cardHelper.className = 'cf-ack-card helper-card';

        const helperTop = document.createElement('div');
        helperTop.className = 'cf-ack-card-top';

        const helperInfo = document.createElement('div');
        helperInfo.className = 'cf-ack-project-info';
        const helperIcon = document.createElement('div');
        helperIcon.className = 'cf-ack-icon-box';
        const helperImg = document.createElement('img');
        helperImg.className = 'cf-ack-icon-img';
        helperImg.src = CF_HELPER_ICON_DATA_URI;
        helperImg.alt = 'Codeforces-Helper';
        helperIcon.appendChild(helperImg);
        const helperName = document.createElement('span');
        helperName.className = 'cf-ack-project-name';
        helperName.textContent = 'Codeforces-Helper';
        helperInfo.appendChild(helperIcon);
        helperInfo.appendChild(helperName);

        const helperBadge = document.createElement('span');
        helperBadge.className = 'cf-ack-badge blue';

        helperTop.appendChild(helperInfo);
        helperTop.appendChild(helperBadge);

        const helperDesc = document.createElement('div');
        helperDesc.className = 'cf-ack-desc';

        const helperFooter = document.createElement('div');
        helperFooter.className = 'cf-ack-footer';
        const helperBtn = document.createElement('a');
        helperBtn.className = 'cf-ack-link-btn helper-btn';
        helperBtn.href = 'https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj';
        helperBtn.target = '_blank';
        helperBtn.rel = 'noopener noreferrer';
        const helperBtnText = document.createElement('span');
        helperBtn.appendChild(helperBtnText);
        helperBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>');
        helperFooter.appendChild(helperBtn);

        cardHelper.appendChild(helperTop);
        cardHelper.appendChild(helperDesc);
        cardHelper.appendChild(helperFooter);
        tabPanels.acknowledgments.appendChild(cardHelper);

        // Card 2: CList
        const cardClist = document.createElement('div');
        cardClist.className = 'cf-ack-card clist-card';

        const clistTop = document.createElement('div');
        clistTop.className = 'cf-ack-card-top';

        const clistInfo = document.createElement('div');
        clistInfo.className = 'cf-ack-project-info';
        const clistIcon = document.createElement('div');
        clistIcon.className = 'cf-ack-icon-box';
        const clistImg = document.createElement('img');
        clistImg.className = 'cf-ack-icon-img';
        clistImg.src = CLIST_ICON_DATA_URI;
        clistImg.alt = 'CList';
        clistIcon.appendChild(clistImg);
        const clistName = document.createElement('span');
        clistName.className = 'cf-ack-project-name';
        clistName.textContent = 'CList';
        clistInfo.appendChild(clistIcon);
        clistInfo.appendChild(clistName);

        const clistBadge = document.createElement('span');
        clistBadge.className = 'cf-ack-badge sky';

        clistTop.appendChild(clistInfo);
        clistTop.appendChild(clistBadge);

        const clistDesc = document.createElement('div');
        clistDesc.className = 'cf-ack-desc';

        const clistFooter = document.createElement('div');
        clistFooter.className = 'cf-ack-footer';
        const clistBtn = document.createElement('a');
        clistBtn.className = 'cf-ack-link-btn clist-btn';
        clistBtn.href = 'https://clist.by/';
        clistBtn.target = '_blank';
        clistBtn.rel = 'noopener noreferrer';
        const clistBtnText = document.createElement('span');
        clistBtn.appendChild(clistBtnText);
        clistBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>');
        clistFooter.appendChild(clistBtn);

        cardClist.appendChild(clistTop);
        cardClist.appendChild(clistDesc);
        cardClist.appendChild(clistFooter);
        tabPanels.acknowledgments.appendChild(cardClist);

        // Card 3: OJ Better
        const cardOjBetter = document.createElement('div');
        cardOjBetter.className = 'cf-ack-card ojbetter-card';

        const ojBetterTop = document.createElement('div');
        ojBetterTop.className = 'cf-ack-card-top';

        const ojBetterInfo = document.createElement('div');
        ojBetterInfo.className = 'cf-ack-project-info';
        const ojBetterIcon = document.createElement('div');
        ojBetterIcon.className = 'cf-ack-icon-box';
        ojBetterIcon.innerHTML = GITHUB_ACK_ICON_SVG;
        const ojBetterName = document.createElement('span');
        ojBetterName.className = 'cf-ack-project-name';
        ojBetterName.textContent = 'OJ Better';
        ojBetterInfo.appendChild(ojBetterIcon);
        ojBetterInfo.appendChild(ojBetterName);

        const ojBetterBadge = document.createElement('span');
        ojBetterBadge.className = 'cf-ack-badge purple';

        ojBetterTop.appendChild(ojBetterInfo);
        ojBetterTop.appendChild(ojBetterBadge);

        const ojBetterDesc = document.createElement('div');
        ojBetterDesc.className = 'cf-ack-desc';

        const ojBetterFooter = document.createElement('div');
        ojBetterFooter.className = 'cf-ack-footer';
        const ojBetterBtn = document.createElement('a');
        ojBetterBtn.className = 'cf-ack-link-btn ojbetter-btn';
        ojBetterBtn.href = 'https://github.com/beijixiaohu/OJBetter';
        ojBetterBtn.target = '_blank';
        ojBetterBtn.rel = 'noopener noreferrer';
        const ojBetterBtnText = document.createElement('span');
        ojBetterBtn.appendChild(ojBetterBtnText);
        ojBetterBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>');
        ojBetterFooter.appendChild(ojBetterBtn);

        cardOjBetter.appendChild(ojBetterTop);
        cardOjBetter.appendChild(ojBetterDesc);
        cardOjBetter.appendChild(ojBetterFooter);
        tabPanels.acknowledgments.appendChild(cardOjBetter);

        // Card 4: Carrot-Plus
        const cardCarrot = document.createElement('div');
        cardCarrot.className = 'cf-ack-card carrot-card';

        const carrotTop = document.createElement('div');
        carrotTop.className = 'cf-ack-card-top';

        const carrotInfo = document.createElement('div');
        carrotInfo.className = 'cf-ack-project-info';
        const carrotIcon = document.createElement('div');
        carrotIcon.className = 'cf-ack-icon-box';
        const carrotImg = document.createElement('img');
        carrotImg.className = 'cf-ack-icon-img';
        carrotImg.src = CARROT_ICON_DATA_URI;
        carrotImg.alt = 'Carrot-Plus';
        carrotIcon.appendChild(carrotImg);
        const carrotName = document.createElement('span');
        carrotName.className = 'cf-ack-project-name';
        carrotName.textContent = 'Carrot-Plus';
        carrotInfo.appendChild(carrotIcon);
        carrotInfo.appendChild(carrotName);

        const carrotBadge = document.createElement('span');
        carrotBadge.className = 'cf-ack-badge amber';

        carrotTop.appendChild(carrotInfo);
        carrotTop.appendChild(carrotBadge);

        const carrotDesc = document.createElement('div');
        carrotDesc.className = 'cf-ack-desc';

        const carrotFooter = document.createElement('div');
        carrotFooter.className = 'cf-ack-footer';
        const carrotBtn = document.createElement('a');
        carrotBtn.className = 'cf-ack-link-btn carrot-btn';
        carrotBtn.href = 'https://github.com/wuyuqian114514/carrot-plus';
        carrotBtn.target = '_blank';
        carrotBtn.rel = 'noopener noreferrer';
        const carrotBtnText = document.createElement('span');
        carrotBtn.appendChild(carrotBtnText);
        carrotBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>');
        carrotFooter.appendChild(carrotBtn);

        cardCarrot.appendChild(carrotTop);
        cardCarrot.appendChild(carrotDesc);
        cardCarrot.appendChild(carrotFooter);
        tabPanels.acknowledgments.appendChild(cardCarrot);

        // -------------------------------------------------------------
        // 3. Bottom Footer
        // -------------------------------------------------------------
        const CLIST_ICON_HTML = `<img src="${CLIST_ICON_DATA_URI}" width="14" height="14" style="vertical-align: -2px; flex-shrink: 0; display: inline-block; border-radius: 2px;" alt="CList" />`;
        const GODEXIOUS_AVATAR_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAJ/ElEQVR42p2Xa3MU153Gf+fSPTOakWZAl5FGFxAggY0dKsR2gRHYCQbXkuyLxE5S2Te7+RjrfbHOF0hVPkWSquzaW7W1Sy74fkM4wmCwuBkDEkgajWZGc+npnu5zzr4YAcZUbSU+VV3VXdV1znPO/znP8/zF/3zyqeNbDOccOIeQEucczjm056G1RgpJGIaAQymFtb0lrDUIIR6ZR1trv9XiUkq05xFFEZ7vI6WkXq1Sq25grcXzPS4ufMaLJ48DAmccmb4+rDHwNRD62+xeSkk3DLlbKbNj1y42yhXu3rhJv59ifHwE3/dYr9ZprZe59NHHrCzfY+qJfXzv8PN0o4ivn8HfDcBZSyaXY31thRsL5wlrNbQQHH32IJOTO4BeaXDw7IGDeJ7i9J/+BIVtOB6vtvjvj+b/Zg5Ya0mn05z76GPCMOBHR48xPDSMl/KxztEJQ5SQaK0RQmCdwzlLXzrDH958k6GZPRTyeYwxD0/z79m9EILEWOJOm05lg81mi0wuRxhG4Bz53ACe51GrVSmX17DG4CwY69g3O8PG6ira83oEvl8C59xjzPz/hlKSfCHPPx4/zuTkFPX6Jm+9fYZ8vp90KkNiYgqFAlJKLl2+xJHnj5AYTXFkhM+uX31k9wBaa91jqbVYZx9B901gArDGUNq5i9Nn3mKiOEKz2eLYC3OMj5doNBvg4NatW0xPT1Or1zDGYJKEwe2DDPgZNut1BgYGHgCRteo69eomQRCRWIdQCu15eJ6HUgqBeHDPAeI4ZrBYpH9khHK5zJG5w6ysrKCUYueOnTSbTUZGRvA8j+GhYW7fvk06ncYB2/MFgkYTqdSD+aRutvDDJqJVJSyvsrlyj8rdJSrrZRrNJnFiH9x5pTVKKeIoYnBkmOWlJTrtACEFnU6HJElwzlEul2k0GszNHaG8vsbq6hqep2kHATqdwlmL2LqManBg+PVqpUrYbKJiS1b7pKQkrcCEbaJWg7DdpNVukyQGByilyeUHuLZ4mUI2x4mTJ1hYWEApxZtv/Bf/9ItfsPDX84yPl9g5vYNz5z5lYnyCsxcWmJyZ2RKjLQ4st5rcvLeMDRpIP03Wz5LLZilsz1PI5xkaGiSdSZPO9NF2FZTvcy+M2X3gAMXSOELCtWvXSJKEQqHA2Ogoi4uLeL5GacX27dvZqFQ485cz9A8O4nseURg+4JcWyiGzGYzv8BsBLddgI2ywvHSdgWyOhpFklCaX6yOXzTJQyDO7/0mCoE22P8fs7Cxn5+d5+eRJCoUCL514ieW7yxw6fIhUKkUcx7zy6o/59a9/w5NzR3DfkH7dDhooT+NlMoBEpTR+lBB7CjM9hm6GRO2A1sYqsuoR34yZntmDrxXS85mYmiKVyXD58mUGBgYojZcojZceCNfy8l0unv+MyT27GRwuEsfxI7dLKyPQrZjE1YiVh4s9CLtYHFGtje1EaCFRfj/OJThn6YYhYRSyrVjkz2f+ws9/+jN836der5MkMdu2be8Zkufx4fvvc+XGTQ4ceQFPa5LkGwDIeVg/AZtHdEJodXBSIh2khE/oJ8SNAOkcAjAmoRt3SaIOxfFJLty6xcWLnxPHMYuLi6RSKV555Sd4nsfi4hUmJ6eQfX2k81mUlJgtN70PQrpKg261gQk6OOtwSiKFwNiEyEU9Xe9PI7b3IX0fZx3NZgNcQjeK2H/wWd46e46rX1xh20CBdCpNrVrlk08+4eKFi8wdm2PHWImzb7/DRnUDqTV+Oo0QPX1Ru48887pIp7CbLbAWEAghiZMELTUY8Aey0OliHUTtgMnJCUrTu/D6sjhjGJ2c5Msvv+TmtWtsbKxTWa9QLBb5/g++j9a6x/ooQiYxN65eJ4oi+nI5Uuk02qu3ENKj6+cwcdSz0y3Z9Qp5dCqFCmPaiUFGIb5ztFttkrAL1uFwWGOYfvopVrRkqjjG+NQ4Bw8eJI5jAO4sLbH/6aeYnd3D9as3+O3vfk+zvMbgxARSWgedhzW+D0AKiG1A1wY0ojq2L4VXGED29xGaGGGTrYglkVJy4cMPGdlW4PjJ41z6/BJBEOB5Htev36BSrjA2Oka1Wuf8hc/45S//hX/++c+o37mNTGtFpD1cViBzKbTsya1SGre6iVdv43UlqtYmbAUYpeh2u2iliJOEVCrFvbt3KeYHGB0dxRrLvn1PcG7+HJX1Cu+/+z4nXz6BVAJjDalUinx+AC/lc/i555CrjYCmclQ7HWphwEajTr1Wp75Zp9luQloRqYREge10MZtNOq021lhMHIMQtGtV9uzZQ2Ic1lpmZ2bphB1On/4jJ18+0TOxJMHECd2oi8PRCQNGRovoX732rzTDgKAT0olCWrVNwiCg3Q5oNJt0lCBqtXDdGJNYmo3Nnktah1CSaq3GYC7L1MQka+UyzjmiKOLQc4dIEoPWGmMMQgqMsWQyGbLZHN0owsQWceXadScBrCGby/VitHN4WiOQWGtIkoR333mXvlyW0bExGo0GUinuNNvgoLlyj3wmw8GD32XfE3tJEkOr0cLzNHGSIEQvWwgh+M//eIPBwUGuXr1KoVBAn7+1xOfzZ+kj4dVXf/ogQPz5nffoGxomnU4jHXSl5uKFz7nx299jrGPu+EvsPXCAbH+Ws+UVPv34I4wxrK2torTH1cUrnPrhKQby/ThnibpdbGJ5/shh5ufnqdVqzB07ii6NT3Irf4UTh55l7969JMagleKLG18h8wX8lI8xhnQmQzPs0Oy0KY2NEdmYa5cvEndjtKd58eVTlNI+rWaLf3/9V/zw1Ck++OADsrkspbExSqUS/f39DA4Ocm9lhbXyOkEQoMMowGL539N/5Ktbt7lyZRGtNdlcP+7uMt1ulyjsKaLDMZTJQtCh9PQ0xklM1GVi1xTr98q0ww4/ePEF/u2111hZWeHY0WO0gzZLd5b44vIimUyG7xz4DkliGBoaolqtIn73xpsuDEMuLSywc8cORkfH2NysM1os4qx7rCNSStGNIpbWyxQnJreSb0J1o0p/Ks2PTv0DQkiSJMEkCb6fQns9Nbx95w7Ly8ssnF8glUozMzOD3lkcIUkMB/btxZge4aamJnrxqrfqYyCEEIxPjmO2IpjSmrR19PX1SBx0ApRSaE/jsETdCKEEs3tn2f/Uk6ys3qNYHGVmZhY9uWMH77z9Ls888z2ElI8w9r5jPfaNwOEeGopSVOt1spk+jDFo6SG3/nW21yUhBHE3JkkS4tjQaDR577330KVSid27d7O6skZlo0I2l3ssmt9/lJK9CL8V353rhQ6tFdev3eCFo8ew1mGMwTkBQqCk/Fpb5zBxQiIVaniE21/N9xqTKAwJw4j9+/eT7e/HJMnDFvzr7fiD94eecb9dq1Q2GBzaTjqTxnhJL/UKEFI8ODHnHHHkEE7ieyly+W38H12kO9xOLPl2AAAAAElFTkSuQmCC';
        const ANTIGRAVITY_LOGO_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAdCAYAAADLnm6HAAAHMUlEQVR42q1WbYxcZRV+znnfe+/M7Mx+b3UxRPyA0jY28hFDU8nUxlo1NUHbWYyJHwENahTiDwQRmI5RYTX4Q35of2hINDHZaxoDNZpK7I6UVFQoojVBPgIRbdm2292Znbkz933fc/yxW6B8tFvl/Lq5ed/7POc8zzn3EFYZqiAiKACc+OXFX4lb+IIej9bSvOWolTxDHXvfoefjez7QbHoFiLB89lxBqwUH6vTc7H2xzys/Hw20080RwnEDe8qi2I5Q6Ubot+V3iSY1pA+2Vj5+ThK8GgJpWmOihrygkz+lkeGdzyyV/NFQlgUuo2UGME+JHhNySbG4rZW7FAChVmNdRYLnPDCjNTNFafjVw1s/OVRIftE6GpztmihqM5IWodgilFqCUluQdIK7QGy0uJTdOPzAgXu1VjOUpuH/IUCqwOxz1eT5F4aPkCbvyBegnEUcLTGKbcLAkqLc9igvBZQ7Tob6ATbL501X1g7t33/qXFKcVYL6gaohgv7t2OSurDT2zhc6ZZmTMX5RxvCijuMYjeNFHsdxM475aASL0RCfNCVJikPjeSn+HAGKatWcDcOeNf/ZLQI00XKlG0QruhgsfCiAQgKjEYrE6LCiZx1y24OPMjjX5QS5gvXzWq3+EM1mWKm0nheButa5QQ25/dCX1rVdsqm9WETmBox3JagvwkiMRA06UPTYITc9+KgLH3c4yJK8pVBY9+Sa5KpLgYMztZqZegMvvHEFZsEAZKlf/rgkI2ahb33fVaxzAxBfAvsEsVj0CMjZwdkVAmEJXktSSRy7drILwMGJufV03iZUVSIive63jUPOjF61sFAIeX/Q+LwMyQdAeQzrIxQcUM49Bl0fIy7DaL6EkV5b3ioZx9n8P7e93W+gRsOflwnr9ToTkX72wF0XdfzQZQutMnr5CPfyUfTcKHp+GD0ZRSbD6OgI2jSKRTOGeTuOE9EEThTW8L+jUW2XJi9+4OjQRgDQep1XTWB2y/L7xcXK1txekHSzYd/LRyh3Q3D5ILwfhAsV5FpBD2V0eRBtHsaiHcFCPIb5ZAInk4nQGbqIFpLJbcuKbuFVe2DN8Q0KAN18eDswgl4eIbgygitDQgkaEiBEUDWAEvpQgAMIMUAJlBIIJxRbhQ36IQDTs5iV1XlAlUCkO+6/v9RqydOi45OuWxRxZRY/APUFqEQKsQKwsgJWQTGEEw1UhEdZclSkp8OUU8kvtQcoe/fNjc1zp3111grU0pRTIJyc5yvJjk+6TiLqK6ynwUMcgMhwnBjm5QxIAJ8LSFxgsobYAGpJpR+4MlzpZ6feD2Dv7t2zBoA/K4G5IxMEAHkY2m7tBIJToTDAGgqQEAcbl03o+yD98EdRfYrAQoR3GdJNUSmJ+z0XCGyYLZStJnEJcP4jAPauXgIA793z2KOGJy4LHRNICkZ9HGxSNqEv+0F88+Gv0xOvvHbltK6NgO/EBeykng8FUlOAl3IUcZS3nysXTlx6702X9AEl4GUZ7KvGH4NI1v/osfVBBjdqxkqSGPFRiAplE7KQHr7VXAuQoq5cXemiJiB/uYWeBLBr03T4caFob+hnIYAjoz5IuTB40Xyw7wPwUG0GnE4hvC6BKsBNQNQNXEPFNUay3LNEbKIBEzL/93bRfhoK1FI16RSFJvCSs2szagAgnaIvbvqeri8k5uo8lwCCxpFh8dFOAA/NHTmz6mf0ZnM3AurK8PG16DEgMUET1YAgXq9/+ibq11JwOkWvmevpFAWky8+iuD53yAIzcjB1cqAv9hO1e7TYbJBfluHVBGbUgIB1Q89uNtHwRs28QIzaQmIklz1/vT3+U7Wu9vXAX96cKFTrah+5hZ5yDtOawDhhzXIJWrAXduE/DChV6zCvIVBb2T9IC181VAHEBmMSliwcj8neibryK0v+RtHcjVCrqQl9fL/fwbNqYbxAcgX6nm4ESNf84+VfM68IaNIpyLofHN3AXL5GupmSGjKxZQ34xp9vo5O1DSA0SM695pKiBjzaoC4EXxMD8sSUZSIa85at03p1mlI47RkGgOr6GgGk5PluawcjCpzbQtH6Tvj949+0P6nNLJtutSt8OrUM8MhtdH/exQwXYL2w80RwKtPL82bZjHzFHo2aDfLr7z72qbgwviN0us6YOFYnpzgy1wFK6ZHV7fhnkDgCrdeVCfhy3sO/ECHpZcipxJs23+VvajbIX7FHIwKAtXcfe08SDz5MwRRJCczWSi989PHbo9+cb/ZnjPWamjSlcPm39SqTYJYEMal4Y4Hgeesjt9JB2vjdxUsQ2QeZ47fBg9laaDd85vAd9mfVutrltvnf43QCl39Ld5gi9hIQQRCYsKAB21nZ7DO2dCHDMhPP+b7/2JsFftoP1brax+6kfb6HD4riebUwwhgT4AFmtTGczzTIr33HXf3EbdG+Nwv8pdZskK/W1R6+g/7gFrBZPGZEcUoE//kvQr/HYa9g1+MAAAAASUVORK5CYII=';

        const footerContainer = document.createElement('div');
        footerContainer.className = 'cf-modal-footer';

        // Top Row: Status info + Quick text links
        const footerTopRow = document.createElement('div');
        footerTopRow.className = 'cf-footer-top-row';

        const footerStatus = document.createElement('div');
        footerStatus.className = 'cf-footer-status';
        const statusSiteIcon = document.createElement('span');
        statusSiteIcon.className = 'cf-footer-site-icon';
        statusSiteIcon.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;';
        const statusDot = document.createElement('span');
        statusDot.className = 'cf-status-dot';
        const statusText = document.createElement('span');
        footerStatus.appendChild(statusDot);
        footerStatus.appendChild(statusSiteIcon);
        footerStatus.appendChild(statusText);

        const footerMiniProgress = document.createElement('div');
        footerMiniProgress.className = 'cf-footer-mini-progress';
        footerMiniProgress.style.display = 'none';
        footerMiniProgress.setAttribute('data-tooltip', t().footerMiniProgressTooltip);
        footerMiniProgress.innerHTML = `
            <span class="cf-spin" style="display: inline-flex; align-items: center; color: #3b82f6;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </span>
            <div class="cf-mini-progress-bar">
                <div class="cf-mini-progress-bar-fill" style="width: 0%;"></div>
            </div>
            <span class="cf-mini-progress-text">0%</span>
        `;
        footerMiniProgress.addEventListener('mouseenter', () => {
            const tipText = footerMiniProgress.getAttribute('data-tooltip');
            if (tipText) showFloatingTooltip(footerMiniProgress, tipText);
        });
        footerMiniProgress.addEventListener('mouseleave', hideFloatingTooltip);
        footerMiniProgress.onclick = () => {
            hideFloatingTooltip();
            if (activeSyncModalInstance) activeSyncModalInstance.show();
        };

        const footerLinks = document.createElement('div');
        footerLinks.className = 'cf-footer-links';

        const createFooterLink = (iconSvg, url) => {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.className = 'cf-footer-link';
            const iconSpan = document.createElement('span');
            iconSpan.style.cssText = 'display: flex; align-items: center; justify-content: center;';
            iconSpan.innerHTML = iconSvg;
            const textSpan = document.createElement('span');
            a.appendChild(iconSpan);
            a.appendChild(textSpan);
            return { a, textSpan };
        };

        const githubIcon = '<svg viewBox="0 0 1024 1024" width="13" height="13" fill="currentColor"><path d="M511.6 76.3C264.3 76.2 64 276.4 64 523.5 64 718.9 189.3 885 363.8 946c23.5 5.9 19.9-10.8 19.9-22.2v-77.5c-135.7 15.9-141.2-73.9-150.3-88.9C215 726 171.5 718 184.5 703c30.9-15.9 62.4 4 98.9 57.9 26.4 39.1 77.9 32.5 104 26 5.7-23.5 17.9-44.5 34.7-60.8-140.6-25.2-199.2-111-199.2-213 0-49.5 16.3-95 48.3-131.7-20.4-60.5 1.9-112.3 4.9-120 58.1-5.2 118.5 41.6 123.2 45.3 33-8.9 70.7-13.6 112.9-13.6 42.4 0 80.2 4.9 113.5 13.9 11.3-8.6 67.3-48.8 121.3-43.9 2.9 7.7 24.7 58.3 5.5 118 32.4 36.8 48.9 82.7 48.9 132.3 0 102.2-59 188.1-200 212.9 23.5 23.2 38.1 55.4 38.1 91v112.5c0.8 9 0 27.9 15 27.9 177.1-59.7 304.6-227 304.6-424.1 0-247.2-200.4-447.3-447.5-447.3z"></path></svg>';
        const issueIconSvg = '<svg viewBox="0 0 1024 1024" width="13" height="13" fill="currentColor"><path d="M578.56 752.64c-25.6 5.12-61.44 10.24-61.44-25.6 0-30.72 10.24-66.56 20.48-97.28 5.12-10.24 10.24-25.6 10.24-35.84 15.36-56.32-5.12-107.52-66.56-107.52-25.6 0-81.92 10.24-92.16 40.96 0 5.12 5.12 10.24 10.24 5.12 51.2-15.36 61.44 20.48 51.2 66.56 0 10.24-5.12 20.48-10.24 30.72-15.36 46.08-40.96 112.64 0 148.48 35.84 30.72 92.16 15.36 128 0 10.24-5.12 15.36-10.24 15.36-20.48 5.12-5.12 0-10.24-5.12-5.12z"></path><path d="M588.8 56.32c-46.08-35.84-107.52-35.84-153.6 0C317.44 148.48 102.4 358.4 102.4 614.4c0 225.28 184.32 409.6 409.6 409.6s409.6-184.32 409.6-409.6c0-256-215.04-465.92-332.8-558.08zM512 947.2c-184.32 0-332.8-148.48-332.8-332.8 0-107.52 46.08-209.92 107.52-296.96 61.44-87.04 138.24-158.72 194.56-199.68 20.48-15.36 40.96-15.36 61.44 0 56.32 46.08 133.12 112.64 194.56 199.68 61.44 87.04 107.52 189.44 107.52 296.96 0 184.32-148.48 332.8-332.8 332.8z"></path><path d="M537.6 327.68c-30.72 0-56.32 25.6-56.32 56.32 0 30.72 30.72 56.32 56.32 56.32 30.72 0 56.32-25.6 56.32-56.32 5.12-30.72-25.6-56.32-56.32-56.32z"></path></svg>';

        const githubLink = createFooterLink(githubIcon, 'https://github.com/GodExious/Colorforces');
        const issueLink = createFooterLink(issueIconSvg, 'https://github.com/GodExious/Colorforces/issues');

        const divider = document.createElement('span');
        divider.className = 'cf-footer-divider';
        divider.textContent = '·';

        footerLinks.appendChild(githubLink.a);
        footerLinks.appendChild(divider);
        footerLinks.appendChild(issueLink.a);

        footerTopRow.appendChild(footerStatus);
        footerTopRow.appendChild(footerMiniProgress);
        footerTopRow.appendChild(footerLinks);

        // Bottom Row: Motto + Author Attribution
        const footerBottomRow = document.createElement('div');
        footerBottomRow.className = 'cf-footer-bottom-row';

        const footerMotto = document.createElement('span');
        footerMotto.className = 'cf-footer-motto';

        const author = document.createElement('div');
        author.className = 'cf-footer-author';

        footerBottomRow.appendChild(footerMotto);
        footerBottomRow.appendChild(author);

        footerContainer.appendChild(footerTopRow);
        footerContainer.appendChild(footerBottomRow);
        modal.appendChild(footerContainer);

        // -------------------------------------------------------------
        // Live Settings Application & Event Handlers
        // -------------------------------------------------------------
        applySettingsRealTime = () => {
            appSettings.acBgColor = selectedColor;
            if (!appSettings.show || typeof appSettings.show !== 'object') {
                appSettings.show = { ...DEFAULT_SETTINGS.show };
            }
            appSettings.show.userAvatar = cbAvatar.checked;
            appSettings.show.formatTeams = cbFormatTeams.checked;
            appSettings.show.langIcon = cbLangIcon.checked;
            appSettings.show.shortVerdict = cbShortVerdict.checked;
            appSettings.avatarSize = parseFloat(avatarSizeInput.value);
            appSettings.langIconSize = parseFloat(langIconSizeInput.value);

            showSettingsMap.forEach(item => {
                appSettings.show[item.key] = checkBoxes[item.key].checked;
            });

            if (!appSettings.timeFormat || typeof appSettings.timeFormat !== 'object') {
                appSettings.timeFormat = { ...DEFAULT_SETTINGS.timeFormat };
            }
            appSettings.timeFormat.enabled = timeToggle.checked;
            appSettings.timeFormat.format = timeInput.value || 'YYYY/MM/DD HH:mm';

            appSettings.lang = currentLang;
            appSettings.displayStyle = currentDisplayStyle;
            appSettings.tagFillCell = cbTagFillCell.checked;
            appSettings.hideTags = cbHideTags.checked;
            if (typeof cbHideRatingTag !== 'undefined') {
                appSettings.hideRatingTag = cbHideRatingTag.checked;
            }
            if (typeof cbNotHideAcTags !== 'undefined') {
                appSettings.notHideAcTags = cbNotHideAcTags.checked;
            }
            if (typeof cbAutoCheckUpdate !== 'undefined') {
                appSettings.disableAutoCheckUpdate = cbAutoCheckUpdate.checked;
            }
            appSettings.colorRatings = cbColorRatings.checked;
            if (typeof cbClistEnabled !== 'undefined') {
                if (!appSettings.clist) appSettings.clist = { ...DEFAULT_SETTINGS.clist };
                appSettings.clist.enabled = cbClistEnabled.checked;
                appSettings.clist.authMode = currentAuthMode;
                appSettings.clist.isLoggedIn = (currentAuthMode === 'cookie');
                appSettings.clist.apiKey = inputClistApiKey.value.trim();
            }

            saveSettings(appSettings);
            updateDynamicStyle();
            refreshRatingsOnPage();

            applyProblemTagsVisibility();

            document.querySelectorAll('.cf-verdict-text').forEach(span => {
                span.innerHTML = appSettings.show.shortVerdict ? span.dataset.short : span.dataset.original;
            });

            applyTimeFormatting();

            refreshUserAvatarsAndStandings();
        };

        const updateMiniProgressUI = (progress) => {
            if (isClistSyncing && progress) {
                footerStatus.style.display = 'none';
                footerMiniProgress.style.display = 'inline-flex';
                const fill = footerMiniProgress.querySelector('.cf-mini-progress-bar-fill');
                const text = footerMiniProgress.querySelector('.cf-mini-progress-text');
                const pct = Math.min(100, Math.max(0, progress.percent !== undefined ? progress.percent : 0));
                if (fill) fill.style.width = `${pct}%`;
                if (text) text.textContent = `${pct}%`;
            } else {
                hideFloatingTooltip();
                footerMiniProgress.style.display = 'none';
                footerStatus.style.display = 'flex';
                updateFooterRatingStatus();
            }
        };

        const syncListener = (progress) => {
            updateSyncBtnState();
            updateMiniProgressUI(progress);
        };
        clistSyncListeners.add(syncListener);

        const updateTexts = () => {
            if (typeof pluginSubtitleText !== 'undefined' && pluginSubtitleText) {
                pluginSubtitleText.textContent = t().title;
            } else {
                pluginSubtitle.textContent = t().title;
            }
            tabDefs.forEach(def => {
                if (def.textSpan) def.textSpan.textContent = t()[def.labelKey];
            });
            labelLang.textContent = t().langLabel;
            labelHideTags.textContent = t().locHideTags;
            if (typeof labelHideRatingTag !== 'undefined') {
                labelHideRatingTag.textContent = t().locHideRatingTag;
            }
            if (typeof labelNotHideAcTags !== 'undefined') {
                labelNotHideAcTags.textContent = t().locNotHideAcTags;
            }
            if (typeof labelAutoCheckUpdate !== 'undefined') {
                labelAutoCheckUpdate.textContent = t().locAutoCheckUpdate;
            }
            if (typeof btnCheckUpdateNow !== 'undefined' && !isCheckingUpdateManually) {
                btnCheckUpdateNow.textContent = t().btnCheckUpdateNow;
            }
            labelMasterColorRatings.textContent = t().masterColorRatings;
            langZhBtn.textContent = '简体中文';
            langEnBtn.textContent = 'English';
            labelAcColor.textContent = t().acColor;
            labelAvatar.textContent = t().locUserAvatar;
            labelAvatarSize.textContent = t().locAvatarSize;
            labelFormatTeams.textContent = t().locFormatTeams;
            labelLangIcon.textContent = t().locLangIcon;
            labelLangIconSize.textContent = t().locLangIconSize;
            labelShortVerdict.textContent = t().locShortVerdict;
            if (typeof btnShortVerdictHelp !== 'undefined') {
                btnShortVerdictHelp.setAttribute('data-tooltip', t().verdictHelpTooltip);
                btnShortVerdictHelp.removeAttribute('title');
            }
            showTitle.textContent = t().locationsTitle;
            showSettingsMap.forEach(item => {
                if (item.textNode) item.textNode.textContent = t()[item.labelKey];
            });
            timeTitleTextNode.textContent = t().timeFormatTitle;
            if (typeof btnTimeHelp !== 'undefined') {
                btnTimeHelp.setAttribute('data-tooltip', t().timeFormatHelpTooltip);
                btnTimeHelp.removeAttribute('title');
            }
            if (typeof updatePreview === 'function') updatePreview();
            labelStyle.textContent = t().displayStyleTitle;
            labelTagFillCell.textContent = t().locTagFillCell;
            styleBlockBtn.textContent = t().styleBlock;
            styleTagBtn.textContent = t().styleTag;
            if (typeof clistEnableLabel !== 'undefined') {
                clistEnableLabel.textContent = t().clistEnable;
                labelClistAuthMode.textContent = t().clistAuthMode;
                authLoginBtn.textContent = t().clistAuthLogin;
                authLoginBtn.setAttribute('data-tooltip', t().clistLoginHelpTooltip);
                authLoginBtn.removeAttribute('title');
                authApiBtn.textContent = t().clistAuthApi;
                labelClistApiKey.textContent = t().clistApiKeyLabel;
                inputClistApiKey.placeholder = t().clistApiKeyPlaceholder;
                btnKeyHelp.setAttribute('data-tooltip', t().clistHelpTooltip);
                btnKeyHelp.removeAttribute('title');
                labelClistSync.textContent = t().clistSyncTitle;
                btnSyncWarn.setAttribute('data-tooltip', t().clistSyncTooltip);
                btnSyncWarn.removeAttribute('title');
                updateSyncBtnState();
            }
            if (typeof shortcutsTitleEl !== 'undefined') {
                const sTitleSpan = shortcutsTitleEl.querySelector('.cf-shortcuts-title-text');
                if (sTitleSpan) sTitleSpan.textContent = t().shortcutsSectionTitle;
                shortcutsSubtitleEl.textContent = t().shortcutsSectionSubtitle;
                if (typeof shortcutsTipEl !== 'undefined') {
                    shortcutsTipEl.textContent = t().shortcutsSectionTip;
                }
                if (typeof shortcutsNoteEl !== 'undefined') {
                    const labelEl = shortcutsNoteEl.querySelector('.cf-shortcuts-note-label');
                    if (labelEl) labelEl.textContent = t().shortcutsSectionNoteLabel;
                    const noteTextEl = shortcutsNoteEl.querySelector('.cf-shortcuts-note-text');
                    if (noteTextEl) noteTextEl.textContent = t().shortcutsSectionNote;
                }
                if (typeof shortcutGroups !== 'undefined') {
                    shortcutGroups.forEach(g => {
                        if (g.titleSpan && g.labelKey && t()[g.labelKey]) {
                            g.titleSpan.textContent = t()[g.labelKey];
                        }
                    });
                }
                shortcutDefs.forEach(def => {
                    if (def.titleEl) def.titleEl.textContent = t()[def.titleKey];
                    if (def.clearBtn) {
                        def.clearBtn.setAttribute('data-tooltip', t().shortcutClearBtn);
                        def.clearBtn.removeAttribute('title');
                    }
                    if (def.resetBtn) {
                        def.resetBtn.setAttribute('data-tooltip', t().shortcutResetBtn);
                        def.resetBtn.removeAttribute('title');
                    }
                    if (shortcutKeyBtns[def.key]) {
                        shortcutKeyBtns[def.key].setAttribute('data-tooltip', t().shortcutEditTooltip);
                        shortcutKeyBtns[def.key].removeAttribute('title');
                        renderShortcutKeyBtn(shortcutKeyBtns[def.key], (appSettings.shortcuts && appSettings.shortcuts[def.key]) !== undefined ? appSettings.shortcuts[def.key] : DEFAULT_SETTINGS.shortcuts[def.key]);
                    }
                });
                const resetAllSpan = btnResetAllShortcuts.querySelector('.btn-text');
                if (resetAllSpan) resetAllSpan.textContent = t().shortcutResetAllBtn;
            }
            if (typeof storageTitleEl !== 'undefined') {
                const sTitleSpan = storageTitleEl.querySelector('.cf-storage-title-text');
                if (sTitleSpan) sTitleSpan.textContent = t().storageSectionTitle;
                storageSubtitleEl.textContent = t().storageSectionSubtitle;
                overviewLabel.textContent = t().storageTotalTitle;
                const clearAllSpan = btnClearAll.querySelector('.btn-text');
                if (clearAllSpan) clearAllSpan.textContent = t().storageClearAllBtn;

                legendClist.label.textContent = t().storageBarClist;
                legendCf.label.textContent = t().storageBarCf;
                legendAvatar.label.textContent = t().storageBarAvatar;
                legendSolved.label.textContent = t().storageBarSolved;
                legendSettings.label.textContent = t().storageBarSettings;
                legendLegacy.label.textContent = t().storageBarLegacy;

                itemSettings.title.textContent = t().storageSettingsTitle;
                itemSettings.desc.textContent = t().storageSettingsDesc;
                itemSettings.btnTextSpan.textContent = t().storageSettingsResetBtn;
                itemSettings.viewBtnTextSpan.textContent = t().storageViewBtn;

                itemCf.title.textContent = t().storageCfTitle;
                itemCf.desc.textContent = t().storageCfDesc;
                itemCf.btnTextSpan.textContent = t().storageCfClearBtn;
                itemCf.viewBtnTextSpan.textContent = t().storageViewBtn;

                itemClist.title.textContent = t().storageClistTitle;
                itemClist.desc.textContent = t().storageClistDesc;
                itemClist.btnTextSpan.textContent = t().storageClistClearBtn;
                itemClist.viewBtnTextSpan.textContent = t().storageViewBtn;

                itemAvatar.title.textContent = t().storageAvatarTitle;
                itemAvatar.desc.textContent = t().storageAvatarDesc;
                itemAvatar.btnTextSpan.textContent = t().storageAvatarClearBtn;
                itemAvatar.viewBtnTextSpan.textContent = t().storageViewBtn;

                itemUserSolved.title.textContent = t().storageSolvedTitle;
                itemUserSolved.desc.textContent = t().storageSolvedDesc;
                itemUserSolved.btnTextSpan.textContent = t().storageSolvedClearBtn;
                itemUserSolved.viewBtnTextSpan.textContent = t().storageViewBtn;

                itemLegacy.title.textContent = t().storageLegacyTitle;
                itemLegacy.desc.textContent = t().storageLegacyDesc;
                itemLegacy.btnTextSpan.textContent = t().storageLegacyClearBtn;
                itemLegacy.viewBtnTextSpan.textContent = t().storageViewBtn;

                if (typeof refreshStorageUI === 'function') {
                    refreshStorageUI();
                }
            }
            if (typeof changelogTitleEl !== 'undefined') {
                const cTitleSpan = changelogTitleEl.querySelector('.cf-changelog-title-text');
                if (cTitleSpan) cTitleSpan.textContent = t().changelogTitle;
                changelogSubtitleEl.textContent = t().changelogSubtitle;
                renderChangelog();
            }
            if (typeof roadmapTitleEl !== 'undefined') {
                const rTitleSpan = roadmapTitleEl.querySelector('.cf-roadmap-title-text');
                if (rTitleSpan) rTitleSpan.textContent = t().roadmapTitle;
                roadmapSubtitleEl.textContent = t().roadmapSubtitle;
                if (typeof renderRoadmap === 'function') {
                    renderRoadmap();
                }
            }
            if (typeof ackTitleEl !== 'undefined') {
                const titleSpan = ackTitleEl.querySelector('.cf-ack-title-text');
                if (titleSpan) titleSpan.textContent = t().ackSectionTitle;
                ackSubtitleEl.textContent = t().ackSectionSubtitle;
                helperBadge.textContent = t().ackHelperBadge;
                helperDesc.innerHTML = t().ackHelperDesc;
                helperBtnText.textContent = t().ackHelperLinkText;
                clistBadge.textContent = t().ackClistBadge;
                clistDesc.innerHTML = t().ackClistDesc;
                clistBtnText.textContent = t().ackClistLinkText;
                ojBetterBadge.textContent = t().ackOjBetterBadge;
                ojBetterDesc.innerHTML = t().ackOjBetterDesc;
                ojBetterBtnText.textContent = t().ackOjBetterLinkText;
                carrotBadge.textContent = t().ackCarrotBadge;
                carrotDesc.innerHTML = t().ackCarrotDesc;
                carrotBtnText.textContent = t().ackCarrotLinkText;
            }
            updateFooterRatingStatus = () => {
                const isClist = !!(appSettings.clist && appSettings.clist.enabled);
                let timeStr = '';

                if (isClist) {
                    statusSiteIcon.innerHTML = CLIST_ICON_HTML;
                    statusSiteIcon.title = 'clist.by';
                    const lastSync = parseInt(appStorage.getItem(CLIST_LAST_SYNC_KEY) || (appSettings.clist && appSettings.clist.lastSyncTime) || '0', 10);
                    if (lastSync && lastSync > 0) {
                        const d = new Date(lastSync);
                        const pad = (n) => String(n).padStart(2, '0');
                        timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        statusDot.style.background = '#10b981';
                        statusDot.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.6)';
                    } else {
                        timeStr = t().footerRatingNeverSynced;
                        statusDot.style.background = '#f59e0b';
                        statusDot.style.boxShadow = '0 0 6px rgba(245, 158, 11, 0.6)';
                    }
                } else {
                    statusSiteIcon.innerHTML = CF_ICON_SVG;
                    statusSiteIcon.title = 'Codeforces';
                    const cachedTime = appStorage.getItem(CACHE_TIME_KEY);
                    let d;
                    if (cachedTime) {
                        const parsed = parseInt(cachedTime, 10);
                        if (!isNaN(parsed) && parsed > 0) d = new Date(parsed);
                    }
                    if (d && !isNaN(d.getTime())) {
                        const pad = (n) => String(n).padStart(2, '0');
                        timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        statusDot.style.background = '#10b981';
                        statusDot.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.6)';
                    } else {
                        timeStr = t().footerRatingNeverSynced;
                        statusDot.style.background = '#f59e0b';
                        statusDot.style.boxShadow = '0 0 6px rgba(245, 158, 11, 0.6)';
                    }
                }

                statusText.textContent = t('footerRatingStatus', timeStr);
            };

            updateFooterRatingStatus();
            footerMotto.textContent = t().footerMotto;
            githubLink.textSpan.textContent = t().footerGithub;
            issueLink.textSpan.textContent = t().footerIssue;

            const exiousAvatarHtml = `<img src="${GODEXIOUS_AVATAR_DATA_URI}" class="cf-author-avatar" alt="GodExious" />`;
            const antigravityLogoHtml = `<img src="${ANTIGRAVITY_LOGO_DATA_URI}" class="cf-author-logo" alt="Antigravity" />`;

            const exiousLink = `<a href="https://github.com/GodExious" target="_blank" class="cf-author-link">${exiousAvatarHtml}<span>GodExious</span></a>`;
            const antigravityLink = `<a href="https://antigravity.google/" target="_blank" class="cf-author-link">${antigravityLogoHtml}<span>Antigravity</span></a>`;

            author.innerHTML = t('authorAttribution', exiousLink, antigravityLink);
            footerMiniProgress.setAttribute('data-tooltip', t().footerMiniProgressTooltip);
            footerMiniProgress.removeAttribute('title');

            author.querySelectorAll('a').forEach(a => {
                a.style.setProperty('color', '#64748b', 'important');
                a.style.setProperty('text-decoration', 'none', 'important');
                a.onmouseover = function () { this.style.setProperty('color', '#1890ff', 'important'); };
                a.onmouseout = function () { this.style.setProperty('color', '#64748b', 'important'); };
            });

            updatePreview();

            if (activeSyncModalInstance && typeof activeSyncModalInstance.updateLanguage === 'function') {
                activeSyncModalInstance.updateLanguage(currentLang);
            }
        };
        updateTexts();

        btn.onclick = () => {
            const isVisible = modal.style.display === 'flex';
            modal.style.display = isVisible ? 'none' : 'flex';
            if (isVisible) {
                hideFloatingTooltip();
                if (typeof activeTransitionCleanup === 'function') {
                    activeTransitionCleanup();
                }
            } else {
                updateSyncBtnState();
                updateMiniProgressUI(currentClistSyncProgress);
                if (contentArea) {
                    contentArea.scrollTop = 0;
                }
                if (activeTab === 'appearance' && pickr) {
                    try { pickr.setColor(appSettings.acBgColor, true); } catch (e) { }
                }
                requestAnimationFrame(() => updateNavIndicator(false));
            }
        };

        container.appendChild(modal);
        container.appendChild(btn);
        document.body.appendChild(container);
    }

    // =========================================================================
    // Auto-update Detection & Reminder Engine
    // =========================================================================
    function resetUpdateCooldown() {
        const state = appStorage.getJSON(UPDATE_CHECK_KEY, { lastCheckTime: 0, latestKnownVersion: '' });
        state.lastCheckTime = 0;
        appStorage.setJSON(UPDATE_CHECK_KEY, state);
    }

    function compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const normalize = v => String(v).replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
        const parts1 = normalize(v1);
        const parts2 = normalize(v2);
        const len = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < len; i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    async function fetchRemoteVersion() {
        const url = SCRIPT_UPDATE_URL + '?t=' + Date.now();
        let text = '';

        // 1. Try standard fetch with timeout and Range header (GitHub Raw natively supports CORS)
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
            const res = await fetch(url, {
                headers: { 'Range': 'bytes=0-2048' },
                signal: controller ? controller.signal : undefined
            });
            if (timeoutId) clearTimeout(timeoutId);
            if (res.ok || res.status === 206) {
                text = await res.text();
            }
        } catch (e) {
            // Fetch failed or aborted
        }

        // 2. Fallback to GM_xmlhttpRequest if fetch returned no text
        if (!text && typeof GM_xmlhttpRequest === 'function') {
            try {
                text = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        headers: { 'Range': 'bytes=0-2048' },
                        timeout: 10000,
                        onload: (r) => resolve((r.status === 200 || r.status === 206) ? (r.responseText || '') : ''),
                        onerror: () => resolve(''),
                        ontimeout: () => resolve('')
                    });
                });
            } catch (e) { }
        }

        if (!text) return null;
        const match = text.slice(0, 2048).match(/\/\/\s*@version\s+([0-9\.]+)/i);
        return match ? match[1] : null;
    }

    function showUpdateModal(remoteVersion) {
        if (document.getElementById('cf-update-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'cf-update-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.55); z-index: 99999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;';

        const modal = document.createElement('div');
        const isDark = isDarkTheme();
        modal.style.cssText = `background: ${isDark ? '#1e2022' : '#ffffff'}; color: ${isDark ? '#e0e0e0' : '#222222'}; padding: 26px 28px; border-radius: 14px; width: 420px; max-width: 90vw; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35); border: 1px solid ${isDark ? '#333b42' : '#e2e8f0'};`;

        const lang = (typeof appSettings !== 'undefined' && appSettings && appSettings.lang) || 'zh';
        const tTitle = tGlobal('updateModalTitle', lang);
        const tDesc = tGlobal('updateModalDesc', lang, remoteVersion, CURRENT_VERSION);
        const tSubDesc = tGlobal('updateModalSubDesc', lang);
        const tStop = tGlobal('updateModalStopCheck', lang);
        const tBtnUpdate = tGlobal('updateModalBtnUpdate', lang);
        const tBtnLater = tGlobal('updateModalBtnLater', lang);

        modal.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-size: 19px; font-weight: 800; color: ${isDark ? '#f8fafc' : '#0f172a'}; display: flex; align-items: center; gap: 8px;">
                    ${tTitle}
                </div>
            </div>
            <div style="font-size: 13.5px; line-height: 1.65; color: ${isDark ? '#cbd5e1' : '#475569'}; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;">${tDesc}</div>
                <div style="font-size: 12.5px; color: ${isDark ? '#94a3b8' : '#64748b'};">${tSubDesc}</div>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; user-select: none; color: ${isDark ? '#94a3b8' : '#64748b'};">
                    <input type="checkbox" id="cf-update-stop-cb" style="cursor: pointer; accent-color: #1890ff; width: 15px; height: 15px; margin: 0;">
                    <span>${tStop}</span>
                </label>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cf-update-btn-later" style="background: ${isDark ? '#2d333b' : '#f1f5f9'}; color: ${isDark ? '#cbd5e1' : '#475569'}; border: 1px solid ${isDark ? '#3d444d' : '#e2e8f0'}; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">${tBtnLater}</button>
                <button id="cf-update-btn-update" style="background: #1890ff; color: #ffffff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 6px rgba(24, 144, 255, 0.35);">${tBtnUpdate}</button>
            </div>
        `;

        const cbStop = modal.querySelector('#cf-update-stop-cb');
        const btnLater = modal.querySelector('#cf-update-btn-later');
        const btnUpdate = modal.querySelector('#cf-update-btn-update');

        cbStop.checked = !!appSettings.disableAutoCheckUpdate;
        cbStop.onchange = () => {
            appSettings.disableAutoCheckUpdate = cbStop.checked;
            saveSettings(appSettings);
            if (!cbStop.checked) {
                resetUpdateCooldown();
            }
            const settingToggle = document.querySelector('.cf-toggle-auto-check');
            if (settingToggle) {
                settingToggle.checked = appSettings.disableAutoCheckUpdate;
            }
        };

        btnLater.onclick = () => {
            overlay.remove();
        };

        btnUpdate.onclick = () => {
            window.open(SCRIPT_UPDATE_URL, '_blank');
            overlay.remove();
        };

        btnLater.onmouseover = function () { this.style.background = isDark ? '#3d444d' : '#e2e8f0'; };
        btnLater.onmouseout = function () { this.style.background = isDark ? '#2d333b' : '#f1f5f9'; };
        btnUpdate.onmouseover = function () { this.style.background = '#40a9ff'; };
        btnUpdate.onmouseout = function () { this.style.background = '#1890ff'; };

        overlay.appendChild(modal);

        document.body.appendChild(overlay);
    }

    async function checkScriptUpdate(force = false) {
        if (!force && appSettings.disableAutoCheckUpdate) {
            return { success: true, skipped: true, reason: 'disabled' };
        }

        const state = appStorage.getJSON(UPDATE_CHECK_KEY, { lastCheckTime: 0, latestKnownVersion: '' });
        const now = Date.now();
        if (!force && state.lastCheckTime && (now - state.lastCheckTime < UPDATE_CHECK_COOLDOWN)) {
            return { success: true, skipped: true, reason: 'cooldown' };
        }

        const remoteVersion = await fetchRemoteVersion();
        if (!remoteVersion) {
            return { success: false, reason: 'fetch_failed' };
        }

        state.lastCheckTime = now;
        state.latestKnownVersion = remoteVersion;
        appStorage.setJSON(UPDATE_CHECK_KEY, state);

        const comp = compareVersions(remoteVersion, CURRENT_VERSION);
        const hasUpdate = comp > 0;
        const isPreview = comp < 0;
        if (hasUpdate) {
            showUpdateModal(remoteVersion);
        }

        return { success: true, hasUpdate, isPreview, remoteVersion, currentVersion: CURRENT_VERSION };
    }

    // Run when the page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyProblemTagsVisibility();
            init();
            createSettingsUI();
            setTimeout(() => { checkScriptUpdate(); }, 1500);
        });
    } else {
        applyProblemTagsVisibility();
        init();
        createSettingsUI();
        setTimeout(() => { checkScriptUpdate(); }, 1500);
    }
})();
