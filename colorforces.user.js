// ==UserScript==
// @name         Colorforces
// @name:zh-CN   幻彩 Codeforces
// @namespace    https://github.com/GodExious/Colorforces
// @version      1.5.6
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
// @grant        none
// ==/UserScript==

/*
 * GitHub Repository: https://github.com/GodExious/Colorforces
 * If you have any suggestions or find any bugs, please feel free to open an issue!
 * 如果你对本插件有改进建议，欢迎通过 GitHub Issue 提出建议或反馈！
 *
 * Inspired by Codeforces-Helper (https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj)
 * 灵感来源于 Codeforces-Helper，由于其不支持 status 页面，故仿写并实现了本项目。
 *
 * Mainly implemented by Antigravity 1.23.2
 * 主要由 Antigravity 1.23.2 完成实现
 */

(function () {
    'use strict';

    const CACHE_KEY = 'cf_problems_ratings';
    const CACHE_TIME_KEY = 'cf_problems_ratings_time';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day in milliseconds

    // Settings Management
    const SETTINGS_KEY = 'cf_submissions_settings';
    const DEFAULT_SETTINGS = {
        acBgColor: '#d4edc9',
        colorRatings: true,
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
        avatarSize: 1.4,
        langIconSize: 1.0,
        timeFormat: {
            enabled: true,
            format: 'YYYY/MM/DD HH:mm'
        },
        displayStyle: 'block',
        hideTags: false,
        lang: 'en'
    };

    function hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return hex || DEFAULT_SETTINGS.acBgColor;
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function getSettings() {
        const saved = localStorage.getItem(SETTINGS_KEY);
        let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // deep clone
        if (saved) {
            try {
                let parsed = JSON.parse(saved);
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
                settings.langIconSize = parsed.langIconSize !== undefined ? parsed.langIconSize : settings.langIconSize;
                if (settings.langIconSize >= 5) {
                    settings.langIconSize = parseFloat((settings.langIconSize / 14).toFixed(1));
                }
                if (parsed.timeFormat) Object.assign(settings.timeFormat, parsed.timeFormat);
                settings.hideTags = parsed.hideTags !== undefined ? !!parsed.hideTags : settings.hideTags;
                settings.colorRatings = parsed.colorRatings !== undefined ? !!parsed.colorRatings : settings.colorRatings;
                settings.lang = parsed.lang || settings.lang;
                settings.displayStyle = parsed.displayStyle || settings.displayStyle;

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
        return null;
    }

    const appSettings = getSettings();

    function customFormatTime(d, formatStr) {
        const yyyy = d.getFullYear().toString();
        const MM = String(d.getMonth() + 1).padStart(2, '0');
        const DD = String(d.getDate()).padStart(2, '0');
        const HH = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');

        return formatStr
            .replace(/YYYY/g, yyyy)
            .replace(/MM/g, MM)
            .replace(/DD/g, DD)
            .replace(/HH/g, HH)
            .replace(/mm/g, mm)
            .replace(/ss/g, ss);
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
                --cf-avatar-size: ${appSettings.avatarSize || 1.4}em;
                --cf-lang-icon-size: ${(appSettings.langIconSize || 1.0) * 14}px;
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
            :root:not(.cf-hide-problemset) .cf-table-problemset tr.accepted-problem td.id,
            :root:not(.cf-hide-problemset) .cf-table-problemset tr.rejected-problem td.id,
            :root:not(.cf-hide-contestProblems) .cf-table-contestProblems tr.accepted-problem td.id,
            :root:not(.cf-hide-contestProblems) .cf-table-contestProblems tr.rejected-problem td.id {
                border-left: 1px solid #e1e1e1 !important;
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
            width: 550px;
            height: 50vh;
            max-height: 50vh;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 12px 35px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.04);
            display: none;
            flex-direction: column;
            color: #1e293b;
            box-sizing: border-box;
            overflow: hidden;
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
            align-items: flex-start;
            padding: 16px 20px 14px 20px;
            border-bottom: 1px solid #edf2f7;
            background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }
        .cf-header-left {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0;
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
            line-height: 1.2;
            user-select: none;
            margin: 0;
            padding: 0 8px 0 0;
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
        .cf-header-subtitle {
            margin-top: 10px;
            font-size: 15px;
            color: #334155;
            font-weight: 600;
            line-height: 1.2;
            user-select: none;
            align-self: flex-start;
        }
        .cf-close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border: none;
            background: transparent;
            color: #94a3b8;
            font-size: 22px;
            cursor: pointer;
            transition: color 0.2s ease, transform 0.2s ease;
            padding: 0;
            line-height: 1;
            box-shadow: none;
        }
        .cf-close-btn:hover {
            background: transparent;
            color: #475569;
            transform: scale(1.15);
        }
        .cf-modal-body {
            display: flex;
            flex: 1;
            min-height: 0;
            overflow: hidden;
            background: #ffffff;
        }
        .cf-sidebar-nav {
            width: 170px;
            min-width: 170px;
            max-width: 170px;
            flex-shrink: 0;
            background: #f8fafc;
            border-right: 1px solid #edf2f7;
            padding: 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-sizing: border-box;
        }
        .cf-nav-tab {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #475569;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
            border: none;
            background: transparent;
            width: 100%;
            text-align: left;
            box-sizing: border-box;
            white-space: nowrap;
            overflow: hidden;
        }
        .cf-nav-tab:hover {
            background: #f1f5f9;
            color: #0f172a;
        }
        .cf-nav-tab.active {
            background: #e6f4ff;
            color: #1677ff;
            font-weight: 600;
        }
        .cf-tab-icon {
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
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
            overflow-y: auto;
            box-sizing: border-box;
        }
        .cf-content-area::-webkit-scrollbar {
            width: 5px;
        }
        .cf-content-area::-webkit-scrollbar-track {
            background: transparent;
        }
        .cf-content-area::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 4px;
        }
        .cf-content-area::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
        }
        .cf-tab-panel {
            display: none;
            flex-direction: column;
            gap: 12px;
        }
        .cf-tab-panel.active {
            display: flex;
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
        .cf-footer-links {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .cf-footer-link {
            color: #64748b;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            transition: color 0.15s ease;
            cursor: pointer;
            user-select: none;
        }
        .cf-footer-link:hover {
            color: #1677ff;
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
        }
        .cf-footer-author a {
            color: #64748b;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.15s ease;
        }
        .cf-footer-author a:hover {
            color: #1677ff;
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
            if (rating < 2300) return '#4D331A'; // Light Orange
            if (rating < 2400) return '#66331A'; // Orange
            if (rating < 2600) return '#4D1A1A'; // Light Red
            if (rating < 3000) return '#661A1A'; // Red
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
        if (rating < 2600) return '#FF0000';
        if (rating < 3000) return '#FF0000';
        return '#AA0000';
    }

    // IViewUI / Ant Design style aesthetic tags
    function getRatingTagStyle(rating) {
        let bg, border, text;
        const isDark = isDarkTheme();
        if (rating < 1200) { bg = isDark ? '#262626' : '#f7f7f7'; border = isDark ? '#434343' : '#e6e6e6'; text = isDark ? '#bfbfbf' : '#808080'; } // Gray
        else if (rating < 1400) { bg = isDark ? '#135200' : '#f6ffed'; border = isDark ? '#237804' : '#b7eb8f'; text = isDark ? '#73d13d' : '#389e0d'; } // Green
        else if (rating < 1600) { bg = isDark ? '#00474f' : '#e6fffb'; border = isDark ? '#006d75' : '#87e8de'; text = isDark ? '#36cfc9' : '#08979c'; } // Cyan
        else if (rating < 1900) { bg = isDark ? '#002c8c' : '#e6f7ff'; border = isDark ? '#003eb3' : '#91d5ff'; text = isDark ? '#40a9ff' : '#096dd9'; } // Blue
        else if (rating < 2100) { bg = isDark ? '#531dab' : '#f9f0ff'; border = isDark ? '#722ed1' : '#d3adf7'; text = isDark ? '#b37feb' : '#531dab'; } // Violet
        else if (rating < 2400) { bg = isDark ? '#873800' : '#fff2e8'; border = isDark ? '#ad4e00' : '#ffd8bf'; text = isDark ? '#ff7a45' : '#d4380d'; } // Orange
        else if (rating < 3000) { bg = isDark ? '#a8071a' : '#fff1f0'; border = isDark ? '#cf1322' : '#ffa39e'; text = isDark ? '#ff4d4f' : '#cf1322'; } // Red
        else { bg = isDark ? '#434343' : '#fff0f6'; border = isDark ? '#8c8c8c' : '#ffadd2'; text = isDark ? '#eb2f96' : '#c41d7f'; } // Dark Red (Legendary)
        return { bg, border, text };
    }

    // Fetch ratings from CF API or LocalStorage cache
    async function getRatings() {
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();

        // Use cache if it's fresh
        if (cached && cachedTime && (now - cachedTime < CACHE_EXPIRY)) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error('Codeforces Rating Helper: Failed to parse cached ratings', e);
            }
        }

        // Fetch new ratings
        try {
            console.log('Codeforces Rating Helper: Fetching problem ratings...');
            const response = await fetch('https://codeforces.com/api/problemset.problems');
            const data = await response.json();

            if (data.status === 'OK') {
                const ratingsMap = {};
                for (const p of data.result.problems) {
                    if (p.rating) {
                        ratingsMap[`${p.contestId}${p.index}`] = p.rating;
                    }
                }

                // Save to localStorage
                localStorage.setItem(CACHE_KEY, JSON.stringify(ratingsMap));
                localStorage.setItem(CACHE_TIME_KEY, now);

                console.log('Codeforces Rating Helper: Ratings fetched and cached successfully.');
                return ratingsMap;
            } else {
                console.error('Codeforces Rating Helper: API returned status', data.status);
            }
        } catch (e) {
            console.error('Codeforces Rating Helper: Failed to fetch ratings API', e);
        }

        // Fallback to cached if fetch failed but we have something
        if (cached) {
            try { return JSON.parse(cached); } catch (e) { }
        }

        return {};
    }

    function formatStandingsCells() {
        if (!appSettings.show.userAvatar) return;
        const formatTeams = appSettings.show.formatTeams !== false;
        const cells = document.querySelectorAll('table.standings .contestant-cell:not(.cf-avatar-processed-cell)');
        cells.forEach(cell => {
            cell.classList.add('cf-avatar-processed-cell');

            if (!cell.hasAttribute('data-original-html')) {
                cell.setAttribute('data-original-html', cell.innerHTML);
            }

            const ghostImg = cell.querySelector('img[src*="ghost.png"]');
            if (ghostImg) {
                if (!formatTeams) {
                    cell.innerHTML = cell.getAttribute('data-original-html');
                    cell.style.setProperty('white-space', 'normal', 'important');
                    cell.style.setProperty('word-break', 'break-word', 'important');
                    return;
                }
                const span = cell.querySelector('span[title="Ghost participant"]');
                if (span) {
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
                    cell.style.setProperty('vertical-align', 'middle', 'important');
                    cell.style.setProperty('padding-top', '8px', 'important');
                    cell.style.setProperty('padding-bottom', '8px', 'important');

                    const size = appSettings.avatarSize || 1.4;
                    ghostImg.style.cssText = `width: ${size}em; height: ${size}em; vertical-align: middle; margin-right: 4px; display: inline-block; object-fit: cover;`;

                    const teamHeader = document.createElement('div');
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
                        membersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';
                        memberNames.forEach(name => {
                            const memberLine = document.createElement('div');
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
                    cell.innerHTML = cell.getAttribute('data-original-html');
                    cell.style.setProperty('white-space', 'normal', 'important');
                    cell.style.setProperty('word-break', 'break-word', 'important');
                    cell.classList.remove('cf-team-formatted');
                    return;
                }
                cell.classList.add('cf-team-formatted');
                cell.style.setProperty('vertical-align', 'middle', 'important');
                cell.style.setProperty('padding-top', '8px', 'important');
                cell.style.setProperty('padding-bottom', '8px', 'important');

                const membersContainer = document.createElement('div');
                membersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-left: 4px;';

                userLinks.forEach(link => {
                    const memberLine = document.createElement('div');
                    memberLine.style.cssText = 'white-space: nowrap; display: flex; align-items: center; font-size: 11px;';
                    memberLine.appendChild(link);
                    membersContainer.appendChild(memberLine);
                });

                const removeCommas = (parentNode) => {
                    Array.from(parentNode.childNodes).forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE) {
                            child.textContent = child.textContent.replace(/^[\s,]+|[\s,]+$/g, '');
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            removeCommas(child);
                        }
                    });
                };
                removeCommas(cell);

                const teamHeader = document.createElement('div');
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

    function applyRatingStyle(cell, rating) {
        cell.dataset.rating = rating;
        cell.style.textAlign = 'center';
        cell.style.verticalAlign = 'middle';

        if (!appSettings.colorRatings) {
            cell.textContent = rating;
            cell.style.setProperty('background-color', 'transparent', 'important');
            cell.style.setProperty('color', isDarkTheme() ? '#EEEEEE' : 'inherit', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
            return;
        }

        if (appSettings.displayStyle === 'tag') {
            cell.textContent = '';
            cell.style.setProperty('background-color', 'transparent', 'important');
            const tagStyle = getRatingTagStyle(rating);
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
        } else {
            cell.textContent = rating;
            cell.style.setProperty('background-color', getRatingBgColor(rating), 'important');
            cell.style.setProperty('color', isDarkTheme() ? '#EEEEEE' : (rating >= 1600 ? 'white' : 'black'), 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        }
    }

    function applyProblemTagStyle(box, tag, rating) {
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
    }

    function applyProblemTagsVisibility() {
        const isHide = !!appSettings.hideTags;

        // 1. Locate the single problem tags container
        let container = null;

        // Strategy A: Find the sidebar box with caption "Problem tags" or "问题标签"
        const tagSidebox = Array.from(document.querySelectorAll('.roundbox.sidebox, #sidebar .roundbox')).find(box => {
            if (box.closest('.cf-settings-modal')) return false;
            const caption = box.querySelector('.caption');
            return caption && /tags|标签/i.test(caption.textContent);
        });

        if (tagSidebox) {
            container = tagSidebox.querySelector('div[style*="padding"]') || tagSidebox.querySelector('.caption')?.nextElementSibling || tagSidebox;
        } else {
            // Strategy B: Fallback - find common ancestor containing all tag-box spans
            const allSpans = Array.from(document.querySelectorAll('span.tag-box')).filter(t => !t.closest('.cf-settings-modal'));
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

        if (!container) return;
        if (isHide) {
            // Find all tag spans in this container (strictly excluding any hidden notice or child of notice)
            const tagSpans = Array.from(container.querySelectorAll('span.tag-box')).filter(t => !t.closest('.cf-tags-hidden-notice'));
            if (tagSpans.length === 0 && !container.querySelector('.cf-tags-hidden-notice')) return;

            let isWrapped = false;
            let sampleFontSize = '1.2rem';

            // Hide all non-score tags using display: none, leave score tags untouched
            tagSpans.forEach(span => {
                const text = span.textContent.trim();
                const title = span.getAttribute('title') || '';
                const isScore = /^\*\s*\d+/.test(text) || span.dataset.rating || /difficulty|难度/i.test(title);

                if (span.style.fontSize) sampleFontSize = span.style.fontSize;

                const item = (span.parentElement && span.parentElement !== container && span.parentElement.classList.contains('roundbox'))
                    ? span.parentElement
                    : span;

                if (item.tagName === 'DIV') isWrapped = true;

                if (!isScore) {
                    item.style.display = 'none';
                    item.setAttribute('data-cf-tag-hidden', 'true');
                }
            });

            // Add ONE hidden tag as the first item if not already present, or ensure it's visible
            const existingNotice = container.querySelector('.cf-tags-hidden-notice');
            if (existingNotice) {
                existingNotice.style.display = '';
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
        } else {
            // 1. Remove the hidden notice
            container.querySelectorAll('.cf-tags-hidden-notice').forEach(n => n.remove());

            // 2. Restore all previously hidden tag items
            container.querySelectorAll('[data-cf-tag-hidden="true"]').forEach(item => {
                item.style.display = '';
                item.removeAttribute('data-cf-tag-hidden');
            });
        }
    }

    // Hotkey: Alt + T to toggle hide problem tags
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT')) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                return;
            }
            e.preventDefault();
            appSettings.hideTags = !appSettings.hideTags;
            saveSettings(appSettings);
            applyProblemTagsVisibility();
            const cb = document.querySelector('.cf-toggle-hide-tags');
            if (cb) {
                cb.checked = !!appSettings.hideTags;
            }
        }
    });

    // Apply ratings to tables and standalone links
    function applyRatings(ratingsMap) {
        if (!ratingsMap || Object.keys(ratingsMap).length === 0) return;

        const regexes = [
            /\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i,
            /\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i,
            /\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i
        ];

        function getProblemRatingFromHref(href) {
            for (const regex of regexes) {
                const match = href.match(regex);
                if (match) {
                    return { contestId: match[1], index: match[2], rating: ratingsMap[`${match[1]}${match[2]}`] };
                }
            }
            return null;
        }
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

            // Find Time/When column index
            let timeColIdx = -1;
            let langColIdx = -1;
            let verdictColIdx = -1;
            let isHacks = window.location.href.includes('/hacks');
            let isStatusOrHacks = false;

            const path = window.location.pathname.toLowerCase();
            const isSubmissionsPage = path.includes('/my') || path.includes('/submissions');

            if (isHacks) table.classList.add('cf-table-hacks');
            else if (isSubmissionsPage) table.classList.add('cf-table-submissions');
            else table.classList.add('cf-table-status');

            Array.from(headerRow.cells).forEach((th, idx) => {
                const text = th.textContent.toLowerCase();
                if (timeColIdx === -1 && (text.includes('when') || text.includes('time') || text.includes('时间') || text.includes('когда') || text.includes('date'))) {
                    timeColIdx = idx;
                }
                if (langColIdx === -1 && (text.includes('lang') || text.includes('语言') || text.includes('язык'))) {
                    langColIdx = idx;
                }
                if (verdictColIdx === -1 && (text.includes('verdict') || text.includes('结果') || text.includes('вердикт'))) {
                    verdictColIdx = idx;
                }
                if (text.includes('hacker') || text.includes('defender')) {
                    isHacks = true;
                    isStatusOrHacks = true;
                }
                if (text.includes('problem') || text.includes('题目') || text.includes('задача')) {
                    isStatusOrHacks = true;
                }
            });

            if (!isStatusOrHacks) return; // Skip if it's not a status or hacks table (e.g., contest list)

            let shouldShowRating = false;
            if (isHacks) {
                shouldShowRating = appSettings.show.hacks;
                timeColIdx = -1; // Skip time formatting for hacks page
            } else if (isSubmissionsPage) {
                shouldShowRating = appSettings.show.submissions;
            } else {
                shouldShowRating = appSettings.show.status;
            }

            if (!shouldShowRating && !appSettings.timeFormat.enabled && langColIdx === -1) return;

            // Process Header (Rating Column and Time)
            if (!headerRow.hasAttribute('data-cf-rating-processed')) {
                headerRow.setAttribute('data-cf-rating-processed', 'true');

                // Append timezone to Time column header
                if (timeColIdx !== -1) {
                    const th = headerRow.cells[timeColIdx];
                    let tzStr = 'UTC+3'; // Codeforces default server time (MSK)

                    const firstDataRow = table.querySelector('tr:not(:first-child)');
                    if (firstDataRow && firstDataRow.cells[timeColIdx]) {
                        const tzMatch = firstDataRow.cells[timeColIdx].textContent.match(/UTC[+-]?\d*(:\d+)?/i);
                        if (tzMatch) {
                            tzStr = tzMatch[0].toUpperCase();
                        }
                    }
                    th.innerHTML = `${th.innerHTML}<br><span class="cf-time-timezone-label" style="font-size: 0.85em; opacity: 0.8;">(${tzStr})</span>`;
                    if (!isSubmissionsPage) {
                        th.style.setProperty('white-space', 'nowrap', 'important');
                    }
                }

                if (langColIdx !== -1 && appSettings.show && appSettings.show.langIcon !== false) {
                    headerRow.cells[langColIdx].style.setProperty('text-align', 'left', 'important');
                    headerRow.cells[langColIdx].style.setProperty('white-space', 'nowrap', 'important');
                }

                if (verdictColIdx !== -1 && appSettings.show && appSettings.show.shortVerdict) {
                    headerRow.cells[verdictColIdx].style.setProperty('white-space', 'nowrap', 'important');
                }

                if (shouldShowRating) {
                    // Remove 'right' class from the previous last header cell
                    const prevTh = headerRow.querySelector('th.right');
                    if (prevTh) prevTh.classList.remove('right');

                    // Create new Rating header
                    const th = document.createElement('th');
                    th.className = 'top right cf-rating-col';
                    th.style.textAlign = 'center';
                    th.style.width = '60px';
                    th.innerHTML = 'Rating';
                    headerRow.appendChild(th);
                }
            }

            // Process data rows
            const dataRows = table.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                // Time Formatting
                if (timeColIdx !== -1) {
                    const timeCell = row.cells[timeColIdx];
                    if (timeCell && !timeCell.hasAttribute('data-cf-time-processed')) {
                        timeCell.setAttribute('data-cf-time-processed', 'true');
                        timeCell.classList.add('cf-table-time-cell');
                        timeCell.setAttribute('data-original-time', timeCell.innerHTML);

                        if (!isSubmissionsPage) {
                            timeCell.style.setProperty('white-space', 'nowrap', 'important');
                        }
                    }
                }

                // Language Icon Formatting
                if (langColIdx !== -1) {
                    const langCell = row.cells[langColIdx];
                    if (langCell && appSettings.show && appSettings.show.langIcon !== false) {
                        langCell.style.setProperty('text-align', 'left', 'important');
                        if (!langCell.hasAttribute('data-cf-lang-icon-processed')) {
                            langCell.setAttribute('data-cf-lang-icon-processed', 'true');
                            const langText = langCell.textContent.trim();
                            const iconName = getLanguageIconName(langText);
                            if (iconName) {
                                const sizePx = 14 * (appSettings.langIconSize || 1.0);
                                const img = document.createElement('img');
                                let svgName = `${iconName}-original.svg`;
                                let customSrc = null;
                                if (iconName === 'go') svgName = 'go-original-wordmark.svg';
                                if (iconName === 'c') {
                                    customSrc = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjMmM5YTQyIiBkPSJNMTE4Ljc2NiA5NS44MmMuODktMS41NDMgMS40NDEtMy4yOCAxLjQ0MS00Ljg0M1YzNi43OGMwLTEuNTU4LS41NS0zLjI5Ny0xLjQ0MS00Ljg0bC01NS4zMiAzMS45NFptMCAwIi8+PHBhdGggZmlsbD0iIzFiNmQyZSIgZD0ibTY4LjM2IDEyNi41ODYgNDYuOTMzLTI3LjA5NGMxLjM1Mi0uNzgxIDIuNTgyLTIuMTI5IDMuNDczLTMuNjcybC01NS4zMi0zMS45NEw4LjEyIDk1LjgyYy44OSAxLjU0MyAyLjEyMSAyLjg5IDMuNDczIDMuNjcybDQ2LjkzMyAyNy4wOTRjMi43MDMgMS41NjIgNy4xMyAxLjU2MiA5LjgzMiAwWm0wIDAiLz48cGF0aCBmaWxsPSIjNWNjYjc0IiBkPSJNMTE4Ljc2NiAzMS45NDFjLS44OTEtMS41NDYtMi4xMjEtMi44OTQtMy40NzMtMy42NzFMNjguMzU5IDEuMTcyYy0yLjcwMy0xLjU2My03LjEyOS0xLjU2My05LjgzMiAwTDExLjU5NCAyOC4yN0M4Ljg5IDI5LjgyOCA2LjY4IDMzLjY2IDYuNjggMzYuNzh2NTQuMTk2YzAgMS41NjIuNTUgMy4zIDEuNDQxIDQuODQzTDYzLjQ0NSA2My44OFptMCAwIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTYzLjQ0NSAyNi4wMzVjLTIwLjg2NyAwLTM3Ljg0MyAxNi45NzctMzcuODQzIDM3Ljg0NHMxNi45NzYgMzcuODQ0IDM3Ljg0MyAzNy44NDRjMTMuNDY1IDAgMjYuMDI0LTcuMjQ3IDMyLjc3LTE4LjkxTDc5Ljg0IDczLjMzNWMtMy4zOCA1Ljg0LTkuNjYgOS40NjUtMTYuMzk1IDkuNDY1LTEwLjQzMyAwLTE4LjkyMi04LjQ4OC0xOC45MjItMTguOTIyIDAtMTAuNDM0IDguNDktMTguOTIyIDE4LjkyMi0xOC45MjIgNi43MyAwIDEzLjAxNyAzLjYyOSAxNi4zOSA5LjQ2NWwxNi4zOC05LjQ3N2MtNi43NS0xMS42NjQtMTkuMzA1LTE4LjkxLTMyLjc3LTE4LjkxeiIvPjwvc3ZnPg==';
                                }
                                if (iconName === 'd') {
                                    customSrc = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSIjYjAxYzJlIiBkPSJNMTE4Ljc2NiA5NS44MmMuODktMS41NDMgMS40NDEtMy4yOCAxLjQ0MS00Ljg0M1YzNi43OGMwLTEuNTU4LS41NS0zLjI5Ny0xLjQ0MS00Ljg0bC01NS4zMiAzMS45NFptMCAwIi8+PHBhdGggZmlsbD0iIzhhMTIyMSIgZD0ibTY4LjM2IDEyNi41ODYgNDYuOTMzLTI3LjA5NGMxLjM1Mi0uNzgxIDIuNTgyLTIuMTI5IDMuNDczLTMuNjcybC01NS4zMi0zMS45NEw4LjEyIDk1LjgyYy44OSAxLjU0MyAyLjEyMSAyLjg5IDMuNDczIDMuNjcybDQ2LjkzMyAyNy4wOTRjMi43MDMgMS41NjIgNy4xMyAxLjU2MiA5LjgzMiAwWm0wIDAiLz48cGF0aCBmaWxsPSIjZDkzODRkIiBkPSJNMTE4Ljc2NiAzMS45NDFjLS44OTEtMS41NDYtMi4xMjEtMi44OTQtMy40NzMtMy42NzFMNjguMzU5IDEuMTcyYy0yLjcwMy0xLjU2My03LjEyOS0xLjU2My05LjgzMiAwTDExLjU5NCAyOC4yN0M4Ljg5IDI5LjgyOCA2LjY4IDMzLjY2IDYuNjggMzYuNzh2NTQuMTk2YzAgMS41NjIuNTUgMy4zIDEuNDQxIDQuODQzTDYzLjQ0NSA2My44OFptMCAwIi8+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMzUgMjYuMyB2NzUuNCBoMjAgYSAzNy43IDM3LjcgMCAwIDAgMCAtNzUuNCB6IE01MCA0MS4zIGg1IGEgMjIuNyAyMi43IDAgMCAxIDAgNDUuNCBoLTUgeiIvPjwvc3ZnPg==';
                                }
                                img.src = customSrc || `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${iconName}/${svgName}`;
                                img.className = 'cf-lang-icon';
                                img.style.cssText = `width: var(--cf-lang-icon-size); height: var(--cf-lang-icon-size); vertical-align: middle; margin-right: 5px;`;

                                const textSpan = document.createElement('span');
                                textSpan.className = 'cf-lang-text';
                                textSpan.textContent = langText;

                                langCell.innerHTML = '';
                                langCell.appendChild(img);
                                langCell.appendChild(textSpan);
                                langCell.title = langText;

                                langCell.style.setProperty('white-space', 'nowrap', 'important');
                                langCell.style.setProperty('max-width', '140px', 'important');
                                langCell.style.setProperty('overflow', 'hidden', 'important');
                                langCell.style.setProperty('text-overflow', 'ellipsis', 'important');
                            }
                        }
                    }
                }

                // Verdict Abbreviation
                if (verdictColIdx !== -1) {
                    const verdictCell = row.cells[verdictColIdx];
                    if (verdictCell && !verdictCell.hasAttribute('data-cf-verdict-processed')) {
                        verdictCell.setAttribute('data-cf-verdict-processed', 'true');
                        walkAndReplaceVerdict(verdictCell);
                        verdictCell.style.setProperty('white-space', 'nowrap', 'important');
                    }
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
                    const info = getProblemRatingFromHref(link.href);
                    if (info && info.rating) {
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

                if (problemRating) {
                    applyRatingStyle(td, problemRating);
                } else {
                    td.textContent = '';
                }
                row.appendChild(td);
            });
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
                    const info = getProblemRatingFromHref(link.href);
                    if (info && info.rating) {
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

        // 1.8 Handle Contest Problems tables specifically (adding a new column to the left of '#')
        const problemsTables = document.querySelectorAll('table.problems:not([data-cf-rating-problems-processed])');
        problemsTables.forEach(table => {
            const isProblemset = window.location.pathname.toLowerCase().includes('/problemset');
            const shouldShowRating = isProblemset ? appSettings.show.problemset : appSettings.show.contestProblems;

            if (isProblemset) table.classList.add('cf-table-problemset');
            else table.classList.add('cf-table-contestProblems');

            table.setAttribute('data-cf-rating-problems-processed', 'true');

            const headerRow = table.querySelector('tr');
            if (headerRow) {
                const th = document.createElement('th');
                th.className = 'top left cf-rating-col';
                th.style.width = '4em';
                th.style.textAlign = 'center';
                th.innerHTML = 'Rating';

                const prevTh = headerRow.firstElementChild;
                if (prevTh && prevTh.classList.contains('left')) {
                    prevTh.classList.remove('left');
                }

                headerRow.insertBefore(th, headerRow.firstElementChild);
            }

            const dataRows = table.querySelectorAll('tr:not(:first-child)');
            dataRows.forEach(row => {
                if (row.cells.length < 2) return;

                const idCell = row.querySelector('td.id');

                const td = document.createElement('td');
                td.className = 'left cf-rating-col';
                td.style.textAlign = 'center';
                td.style.verticalAlign = 'middle';

                const prevTd = row.firstElementChild;
                if (prevTd && prevTd.classList.contains('left')) {
                    prevTd.classList.remove('left');
                }

                const link = idCell ? idCell.querySelector('a') : row.querySelector('a[href*="/problem/"]');

                if (link) {
                    const info = getProblemRatingFromHref(link.href);
                    if (info && info.rating) {
                        applyRatingStyle(td, info.rating);
                    }

                    const rowLinks = row.querySelectorAll('a[href*="/problem/"]');
                    rowLinks.forEach(l => l.setAttribute('data-cf-rating-added', 'true'));
                }

                row.insertBefore(td, row.firstElementChild);

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
        const tagBoxes = document.querySelectorAll('span.tag-box:not([data-cf-rating-added])');
        tagBoxes.forEach(tag => {
            const text = tag.textContent.trim();
            if (text.startsWith('*')) {
                const ratingMatch = text.match(/^\*\s*(\d+)$/);
                if (ratingMatch && ratingMatch[1]) {
                    const rating = parseInt(ratingMatch[1], 10);
                    tag.setAttribute('data-cf-rating-added', 'true');
                    tag.dataset.rating = rating;
                    if (!tag.hasAttribute('data-original-css')) {
                        tag.dataset.originalCss = tag.style.cssText;
                    }
                    const parentBox = (tag.parentElement && tag.parentElement.classList.contains('roundbox') && !tag.parentElement.classList.contains('sidebox')) ? tag.parentElement : null;
                    if (parentBox) {
                        parentBox.setAttribute('data-cf-rating-added', 'true');
                        parentBox.dataset.rating = rating;
                        if (!parentBox.hasAttribute('data-original-css')) {
                            parentBox.dataset.originalCss = parentBox.style.cssText;
                        }
                    }
                    applyProblemTagStyle(parentBox, tag, rating);
                }
            }
        });
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
    function setupObserver(ratingsMap) {
        const observer = new MutationObserver((mutations) => {
            if (isMutationProcessing) return;
            let shouldApply = false;
            for (const mutation of mutations) {
                if (mutation.target && (mutation.target.closest?.('.cf-settings-modal, #cf-ratings-settings-btn, .pcr-app, .roundbox.sidebox, #sidebar') || mutation.target.id?.startsWith('cf-'))) {
                    continue;
                }
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && !node.classList?.contains('cf-tags-hidden-notice') && !node.id?.startsWith('cf-') && !node.classList?.contains('cf-settings-modal') && !node.classList?.contains('pcr-app') && !node.closest?.('.cf-settings-modal, #cf-ratings-settings-btn, .pcr-app, .roundbox.sidebox, #sidebar')) {
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
                        formatStandingsCells();
                        applyRatings(ratingsMap);
                        applyUserAvatars();
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

    const AVATAR_CACHE_KEY = 'cf_user_avatars';

    async function applyUserAvatars() {
        if (!appSettings.show.userAvatar) return;

        const userLinks = document.querySelectorAll('a[href^="/profile/"]:not([data-cf-avatar-processed])');
        const handlesToFetch = new Set();
        const handleToElements = {};

        userLinks.forEach(link => {
            // Skip if it already has an img (like titlePhoto or similar icon)
            if (link.querySelector('img')) return;

            // Skip if it's inside a native CF avatar container or profile main-info
            if (link.closest('.avatar, .main-info')) return;

            // Skip if it's a post author or comment author (they already have native CF avatars)
            // Mentions inside the text body (.ttypography) should still receive avatars.
            if (link.closest('.comment, .topic') && !link.closest('.ttypography')) return;

            const href = link.getAttribute('href');
            const match = href.match(/^\/profile\/([^/]+)$/i);
            if (match && link.textContent.trim().toLowerCase() === match[1].toLowerCase()) {
                link.setAttribute('data-cf-avatar-processed', 'true');
                const handle = match[1];
                handlesToFetch.add(handle);
                if (!handleToElements[handle]) handleToElements[handle] = [];
                handleToElements[handle].push(link);
            }
        });

        if (handlesToFetch.size === 0) return;

        let avatarCache = {};
        try {
            const cached = localStorage.getItem(AVATAR_CACHE_KEY);
            if (cached) avatarCache = JSON.parse(cached);
        } catch (e) { }

        const now = Date.now();
        let missingHandles = [];

        for (const handle of handlesToFetch) {
            const cachedData = avatarCache[handle];
            if (cachedData && (now - cachedData.time < CACHE_EXPIRY)) {
                injectAvatar(handleToElements[handle], cachedData.url);
            } else {
                missingHandles.push(handle);
            }
        }

        if (missingHandles.length > 0) {
            try {
                while (missingHandles.length > 0) {
                    const url = `https://codeforces.com/api/user.info?handles=${missingHandles.join(';')}`;
                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.status === 'OK') {
                        for (const user of data.result) {
                            const handle = user.handle;
                            const avatarUrl = user.avatar;
                            avatarCache[handle] = { url: avatarUrl, time: now };
                            injectAvatar(handleToElements[handle] || [], avatarUrl);
                        }
                        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(avatarCache));
                        break;
                    } else if (data.status === 'FAILED' && data.comment) {
                        const match = data.comment.match(/User with handle (.*?) not found/i);
                        if (match) {
                            const missing = match[1].toLowerCase();
                            missingHandles = missingHandles.filter(h => h.toLowerCase() !== missing);
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

    function injectAvatar(elements, url) {
        if (!url) return;
        if (url.startsWith('//')) url = 'https:' + url;
        else if (url.startsWith('/')) url = 'https://codeforces.com' + url;

        elements.forEach(el => {
            const td = el.closest('td, th');
            const size = appSettings.avatarSize || 1.4;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'cf-user-avatar-container cf-user-avatar';
            img.style.cssText = `width: var(--cf-avatar-size); height: var(--cf-avatar-size); border-radius: 50%; vertical-align: middle; margin-right: 4px; border: 1px solid rgba(0,0,0,0.1); display: inline-block; object-fit: cover;`;

            const isTableLayout = td && el.closest('table.status-frame-datatable, div.datatable table, table.rtable') && !el.closest('.ttypography');

            if (isTableLayout) {
                td.style.setProperty('text-align', 'left', 'important');

                const anchor = document.createElement('a');
                anchor.href = el.href;
                anchor.title = el.textContent.trim();
                anchor.className = 'cf-avatar-container';
                anchor.appendChild(img);

                const wrapper = document.createElement('span');
                wrapper.className = 'cf-avatar-line-wrapper';
                wrapper.style.cssText = 'white-space: nowrap; display: inline-block; vertical-align: middle;';

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

                el.parentNode.insertBefore(wrapper, currentStart);
                wrapper.appendChild(anchor);
                nodesToWrap.forEach(node => wrapper.appendChild(node));
            } else {
                el.style.setProperty('white-space', 'nowrap', 'important');
                el.insertBefore(img, el.firstChild);
            }
        });
    }

    // Initialization
    async function init() {
        const ratingsMap = await getRatings();
        formatStandingsCells();
        applyRatings(ratingsMap);
        applyUserAvatars();
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
            localStorage.setItem('cf_ratings_settings', JSON.stringify(appSettings));
            applyProblemTagsVisibility();
        };
        let checkIfChanged = () => { applySettingsRealTime(); };

        const i18n = {
            zh: {
                title: '插件设置',
                tabGeneral: '通用',
                tabAppearance: '界面',
                tabRatings: '难度分',
                tabUser: '用户',
                langLabel: '菜单语言',
                locHideTags: '隐藏算法标签 (Alt+T)',
                masterColorRatings: '色彩展示难度分',
                displayStyleTitle: '难度分展示形式',
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
                locShortVerdict: '显示状态缩写 (AC/WA等)',
                timeFormatTitle: '自定义时间格式',
                timeFormatPreview: '预览: ',
                timeFormatDisabled: '格式化已关闭',
                saveBtn: '保存并刷新',
                footerRatingStatus: (timeStr) => `上次Ratings更新时间（${timeStr}）`,
                footerMotto: 'Colorforces · 算法竞赛视觉增强',
                footerGithub: 'GitHub',
                footerIssue: '问题反馈'
            },
            en: {
                title: 'Plugin Settings',
                tabGeneral: 'General',
                tabAppearance: 'Appearance',
                tabRatings: 'Ratings',
                tabUser: 'Users',
                langLabel: 'Menu Language',
                locHideTags: 'Hide Algorithm Tags (Alt+T)',
                masterColorRatings: 'Colored Ratings',
                displayStyleTitle: 'Ratings Display Format',
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
                locShortVerdict: 'Short Verdicts (AC/WA)',
                timeFormatTitle: 'Custom Time Format',
                timeFormatPreview: 'Preview: ',
                timeFormatDisabled: 'Disabled',
                saveBtn: 'Save & Reload',
                footerRatingStatus: (timeStr) => `Ratings Last Updated (${timeStr})`,
                footerMotto: 'Colorforces · Reimagining Codeforces',
                footerGithub: 'GitHub',
                footerIssue: 'Feedback'
            }
        };
        let currentLang = appSettings.lang || 'en';
        const t = () => i18n[currentLang];

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

        // 1. Top Header
        const header = document.createElement('div');
        header.className = 'cf-modal-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'cf-header-left';

        const headerTitle = document.createElement('div');
        headerTitle.className = 'cf-header-title';
        headerTitle.innerHTML = `Colorforces <span class="cf-title-version">v1.5.6</span>`;

        const pluginSubtitle = document.createElement('div');
        pluginSubtitle.className = 'cf-header-subtitle';

        headerLeft.appendChild(headerTitle);
        headerLeft.appendChild(pluginSubtitle);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'cf-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Close';
        closeBtn.onclick = () => { modal.style.display = 'none'; };

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
        const tabDefs = [
            { id: 'general', icon: '⚙️', labelKey: 'tabGeneral' },
            { id: 'appearance', icon: '🎨', labelKey: 'tabAppearance' },
            { id: 'ratings', icon: '📊', labelKey: 'tabRatings' },
            { id: 'user', icon: '👤', labelKey: 'tabUser' }
        ];

        const tabButtons = {};
        const tabPanels = {};
        let activeTab = 'general';

        const switchTab = (tabId) => {
            activeTab = tabId;
            tabDefs.forEach(def => {
                const isActive = def.id === tabId;
                if (tabButtons[def.id]) {
                    tabButtons[def.id].classList.toggle('active', isActive);
                }
                if (tabPanels[def.id]) {
                    tabPanels[def.id].classList.toggle('active', isActive);
                }
            });
        };

        tabDefs.forEach(def => {
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.className = `cf-nav-tab ${def.id === activeTab ? 'active' : ''}`;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'cf-tab-icon';
            iconSpan.textContent = def.icon;

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

        // -------------------------------------------------------------
        // PANEL 1: 通用 (General)
        // -------------------------------------------------------------
        const rowLang = document.createElement('div');
        rowLang.className = 'cf-setting-item';

        const labelLang = document.createElement('span');
        labelLang.className = 'cf-setting-label';

        const langSwitch = document.createElement('div');
        langSwitch.style.cssText = `
            display: flex;
            position: relative;
            background: #f0f0f0;
            border-radius: 12px;
            padding: 2px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            user-select: none;
            width: 140px;
        `;

        const langSlider = document.createElement('div');
        langSlider.style.cssText = `
            position: absolute;
            top: 2px;
            bottom: 2px;
            width: calc(50% - 2px);
            border-radius: 10px;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            box-sizing: border-box;
            background: white;
        `;

        const langZhBtn = document.createElement('div');
        const langEnBtn = document.createElement('div');

        const updateLangSwitchUI = () => {
            const btnBase = 'flex: 1; text-align: center; padding: 3px 0; font-size: 12px; z-index: 1; transition: color 0.25s; box-sizing: border-box; margin: 1px;';
            if (currentLang === 'zh') {
                langSlider.style.left = '2px';
                langZhBtn.style.cssText = `${btnBase} color: #1890ff; font-weight: bold;`;
                langEnBtn.style.cssText = `${btnBase} color: #888;`;
            } else {
                langSlider.style.left = '50%';
                langZhBtn.style.cssText = `${btnBase} color: #888;`;
                langEnBtn.style.cssText = `${btnBase} color: #1890ff; font-weight: bold;`;
            }
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

        cbHideTags.onchange = () => {
            checkIfChanged();
        };

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
            const pickr = Pickr.create({
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

            pickr.on('change', (color) => {
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
        rowLangIconSize.className = 'cf-setting-item';
        rowLangIconSize.style.paddingLeft = '12px';

        const labelLangIconSize = document.createElement('span');
        labelLangIconSize.className = 'cf-setting-sublabel';

        const langIconSizeInput = document.createElement('input');
        langIconSizeInput.type = 'range';
        langIconSizeInput.min = '0.5';
        langIconSizeInput.max = '2.0';
        langIconSizeInput.step = '0.1';
        langIconSizeInput.value = appSettings.langIconSize || 1.0;
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

        // 3) Show Short Verdicts (AC/WA)
        const rowShortVerdict = document.createElement('label');
        rowShortVerdict.className = 'cf-setting-item';
        rowShortVerdict.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelShortVerdict = document.createElement('span');
        labelShortVerdict.className = 'cf-setting-label';

        const toggleContainerShortVerdict = document.createElement('div');
        toggleContainerShortVerdict.className = 'cf-toggle-switch';
        const cbShortVerdict = document.createElement('input');
        cbShortVerdict.type = 'checkbox';
        cbShortVerdict.checked = !!appSettings.show.shortVerdict;
        const sliderShortVerdict = document.createElement('span');
        sliderShortVerdict.className = 'cf-toggle-slider';
        toggleContainerShortVerdict.appendChild(cbShortVerdict);
        toggleContainerShortVerdict.appendChild(sliderShortVerdict);

        rowShortVerdict.appendChild(labelShortVerdict);
        rowShortVerdict.appendChild(toggleContainerShortVerdict);
        tabPanels.appearance.appendChild(rowShortVerdict);

        cbShortVerdict.onchange = () => {
            checkIfChanged();
        };

        // 4) Custom Time Format
        const timeGroup = document.createElement('div');
        timeGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const timeTitleRow = document.createElement('div');
        timeTitleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const timeTitle = document.createElement('label');
        timeTitle.className = 'cf-setting-label';
        timeTitle.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; user-select: none; margin: 0;';
        const timeTitleTextNode = document.createTextNode('');

        const timeToggleContainer = document.createElement('div');
        timeToggleContainer.className = 'cf-toggle-switch';
        const timeToggle = document.createElement('input');
        timeToggle.type = 'checkbox';
        timeToggle.checked = appSettings.timeFormat.enabled;
        const timeSlider = document.createElement('span');
        timeSlider.className = 'cf-toggle-slider';
        timeToggleContainer.appendChild(timeToggle);
        timeToggleContainer.appendChild(timeSlider);

        timeTitle.appendChild(timeTitleTextNode);
        timeTitle.appendChild(timeToggleContainer);

        timeTitleRow.appendChild(timeTitle);
        timeGroup.appendChild(timeTitleRow);

        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = appSettings.timeFormat.format;
        timeInput.placeholder = 'YYYY/MM/DD HH:mm';
        timeInput.style.cssText = 'width: 100%; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s;';
        timeInput.onfocus = () => { timeInput.style.borderColor = '#1890ff'; };
        timeInput.onblur = () => { timeInput.style.borderColor = '#e2e8f0'; };

        const timePreview = document.createElement('div');
        timePreview.style.cssText = 'font-size: 12px; color: #64748b; font-family: monospace; text-align: right;';

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
        // 1) Master Switch: 色彩展示难度分 (总开关)
        const rowMasterColorRatings = document.createElement('label');
        rowMasterColorRatings.className = 'cf-setting-item';
        rowMasterColorRatings.style.cssText = 'cursor: pointer; user-select: none; margin: 0;';

        const labelMasterColorRatings = document.createElement('span');
        labelMasterColorRatings.className = 'cf-setting-label';

        const toggleContainerMasterColorRatings = document.createElement('div');
        toggleContainerMasterColorRatings.className = 'cf-toggle-switch';
        const cbColorRatings = document.createElement('input');
        cbColorRatings.type = 'checkbox';
        cbColorRatings.checked = appSettings.colorRatings !== false;
        const sliderMasterColorRatings = document.createElement('span');
        sliderMasterColorRatings.className = 'cf-toggle-slider';
        toggleContainerMasterColorRatings.appendChild(cbColorRatings);
        toggleContainerMasterColorRatings.appendChild(sliderMasterColorRatings);

        rowMasterColorRatings.appendChild(labelMasterColorRatings);
        rowMasterColorRatings.appendChild(toggleContainerMasterColorRatings);
        tabPanels.ratings.appendChild(rowMasterColorRatings);

        // 2) Ratings Display Style (Sub-item)
        const rowStyle = document.createElement('div');
        rowStyle.className = 'cf-setting-item';
        rowStyle.style.paddingLeft = '12px';

        const labelStyle = document.createElement('span');
        labelStyle.className = 'cf-setting-sublabel';

        const styleSwitch = document.createElement('div');
        styleSwitch.style.cssText = `
            display: flex;
            position: relative;
            background: #f0f0f0;
            border-radius: 12px;
            padding: 2px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            user-select: none;
            width: 120px;
        `;

        const slider = document.createElement('div');
        slider.style.cssText = `
            position: absolute;
            top: 2px;
            bottom: 2px;
            width: calc(50% - 2px);
            border-radius: 10px;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            box-sizing: border-box;
        `;

        const styleBlockBtn = document.createElement('div');
        const styleTagBtn = document.createElement('div');
        let currentDisplayStyle = appSettings.displayStyle || 'block';

        const updateStyleUI = () => {
            const btnBase = 'flex: 1; text-align: center; padding: 3px 0; font-size: 12px; z-index: 1; transition: color 0.25s; box-sizing: border-box; margin: 1px;';

            if (currentDisplayStyle === 'block') {
                slider.style.left = '2px';
                slider.style.background = getRatingBgColor(2400);
                slider.style.border = `1px solid ${getRatingBgColor(2400)}`;
                styleBlockBtn.style.cssText = `${btnBase} color: white; font-weight: bold;`;
                styleTagBtn.style.cssText = `${btnBase} color: #888;`;
            } else {
                slider.style.left = '50%';
                const ts = getRatingTagStyle(2400);
                slider.style.background = ts.bg;
                slider.style.border = `1px solid ${ts.border}`;
                styleBlockBtn.style.cssText = `${btnBase} color: #888;`;
                styleTagBtn.style.cssText = `${btnBase} color: ${ts.text}; font-weight: bold;`;
            }
        };
        updateStyleUI();

        styleBlockBtn.onclick = () => { currentDisplayStyle = 'block'; updateStyleUI(); checkIfChanged(); };
        styleTagBtn.onclick = () => { currentDisplayStyle = 'tag'; updateStyleUI(); checkIfChanged(); };

        styleSwitch.appendChild(slider);
        styleSwitch.appendChild(styleBlockBtn);
        styleSwitch.appendChild(styleTagBtn);

        rowStyle.appendChild(labelStyle);
        rowStyle.appendChild(styleSwitch);
        tabPanels.ratings.appendChild(rowStyle);

        // 3) Colorized Rating Display Locations (Sub-item group)
        const showGroup = document.createElement('div');
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
            checkIfChanged();
        };
        rowStyle.style.display = cbColorRatings.checked ? 'flex' : 'none';
        showGroup.style.display = cbColorRatings.checked ? 'flex' : 'none';

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
        rowAvatarSize.className = 'cf-setting-item';
        rowAvatarSize.style.paddingLeft = '12px';

        const labelAvatarSize = document.createElement('span');
        labelAvatarSize.className = 'cf-setting-sublabel';

        const avatarSizeInput = document.createElement('input');
        avatarSizeInput.type = 'range';
        avatarSizeInput.min = '0.8';
        avatarSizeInput.max = '3.0';
        avatarSizeInput.step = '0.1';
        avatarSizeInput.value = appSettings.avatarSize || 1.4;
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
        rowFormatTeams.className = 'cf-setting-item';
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
        // 3. Bottom Footer
        // -------------------------------------------------------------
        const footerContainer = document.createElement('div');
        footerContainer.className = 'cf-modal-footer';

        // Top Row: Status info + Quick text links
        const footerTopRow = document.createElement('div');
        footerTopRow.className = 'cf-footer-top-row';

        const footerStatus = document.createElement('div');
        footerStatus.className = 'cf-footer-status';
        const statusDot = document.createElement('span');
        statusDot.className = 'cf-status-dot';
        const statusText = document.createElement('span');
        footerStatus.appendChild(statusDot);
        footerStatus.appendChild(statusText);

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
            appSettings.hideTags = cbHideTags.checked;
            appSettings.colorRatings = cbColorRatings.checked;

            saveSettings(appSettings);
            updateDynamicStyle();
            document.querySelectorAll('.cf-rating-col, .cf-rating-standings-row th').forEach(cell => {
                const rating = cell.dataset.rating;
                if (rating) {
                    applyRatingStyle(cell, rating);
                }
            });

            document.querySelectorAll('span.tag-box[data-cf-rating-added]').forEach(tag => {
                const rating = parseInt(tag.dataset.rating, 10);
                if (!isNaN(rating)) {
                    const parentBox = (tag.parentElement && tag.parentElement.classList.contains('roundbox') && !tag.parentElement.classList.contains('sidebox')) ? tag.parentElement : null;
                    applyProblemTagStyle(parentBox, tag, rating);
                }
            });

            applyProblemTagsVisibility();

            document.querySelectorAll('.cf-verdict-text').forEach(span => {
                span.innerHTML = appSettings.show.shortVerdict ? span.dataset.short : span.dataset.original;
            });

            applyTimeFormatting();

            const cells = document.querySelectorAll('table.standings .contestant-cell');
            cells.forEach(cell => {
                if (cell.hasAttribute('data-original-html')) {
                    cell.innerHTML = cell.getAttribute('data-original-html');
                    cell.style.removeProperty('white-space');
                    cell.style.removeProperty('word-break');
                    cell.style.removeProperty('vertical-align');
                    cell.style.removeProperty('padding-top');
                    cell.style.removeProperty('padding-bottom');
                    cell.classList.remove('cf-team-formatted');
                }
                cell.classList.remove('cf-avatar-processed-cell');
                cell.querySelectorAll('a[href^="/profile/"]').forEach(a => a.removeAttribute('data-cf-avatar-processed'));
            });
            formatStandingsCells();
            applyUserAvatars();
        };

        const updateTexts = () => {
            pluginSubtitle.textContent = t().title;
            tabDefs.forEach(def => {
                if (def.textSpan) def.textSpan.textContent = t()[def.labelKey];
            });
            labelLang.textContent = t().langLabel;
            labelHideTags.textContent = t().locHideTags;
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
            showTitle.textContent = t().locationsTitle;
            showSettingsMap.forEach(item => {
                if (item.textNode) item.textNode.textContent = t()[item.labelKey];
            });
            timeTitleTextNode.textContent = t().timeFormatTitle;
            labelStyle.textContent = t().displayStyleTitle;
            styleBlockBtn.textContent = t().styleBlock;
            styleTagBtn.textContent = t().styleTag;
            const getRatingsUpdateTimeString = () => {
                const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
                let d;
                if (cachedTime) {
                    const parsed = parseInt(cachedTime, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        d = new Date(parsed);
                    }
                }
                if (!d || isNaN(d.getTime())) {
                    d = new Date();
                }
                const pad = (n) => String(n).padStart(2, '0');
                const YYYY = d.getFullYear();
                const MM = pad(d.getMonth() + 1);
                const DD = pad(d.getDate());
                const HH = pad(d.getHours());
                const mm = pad(d.getMinutes());
                return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
            };

            const updateTimeStr = getRatingsUpdateTimeString();
            statusText.textContent = typeof t().footerRatingStatus === 'function'
                ? t().footerRatingStatus(updateTimeStr)
                : t().footerRatingStatus;
            footerMotto.textContent = t().footerMotto;
            githubLink.textSpan.textContent = t().footerGithub;
            issueLink.textSpan.textContent = t().footerIssue;

            const exiousLink = '<a href="https://github.com/GodExious" target="_blank">GodExious</a>';
            const antigravityLink = '<a href="https://antigravity.google/" target="_blank">Antigravity</a>';

            if (currentLang === 'zh') {
                author.innerHTML = `由 ${exiousLink} & ${antigravityLink} 为❤️发电`;
            } else {
                author.innerHTML = `Crafted with ❤️ by ${exiousLink} & ${antigravityLink}`;
            }

            author.querySelectorAll('a').forEach(a => {
                a.onmouseover = function () { this.style.color = '#1890ff'; };
                a.onmouseout = function () { this.style.color = '#64748b'; };
            });

            updatePreview();
        };
        updateTexts();

        btn.onclick = () => {
            const isVisible = modal.style.display === 'flex';
            modal.style.display = isVisible ? 'none' : 'flex';
        };

        container.appendChild(modal);
        container.appendChild(btn);
        document.body.appendChild(container);
    }
    // Run when the page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { init(); createSettingsUI(); });
    } else {
        init();
        createSettingsUI();
    }
})();
