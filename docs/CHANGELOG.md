<h1 align="center">Changelog</h1>

<p align="center">
  <strong>English</strong> | <a href="CHANGELOG_zh.md">简体中文</a>
</p>

All notable changes to this project will be documented in this file.

---

### v1.5.9
`2026-09-11 04:41`

**Added**
1. Added automatic update detection functionality.

**Optimized**
1. Optimized the storage management interface UI and related logic.

**Fixed**
1. Fixed missing difficulty ratings for shared problems across concurrent contests (e.g., Div.1 and Div.2) in official Codeforces data by grouping parallel contests by start time and inheriting ratings from peer contests with matching problem names.
2. Fixed an issue where the AC background color picker in settings displayed as pure black.
3. Fixed an issue where blog and topic post author avatars were not displayed.

---

### v1.5.8
`2026-09-09 21:15`

**Optimized**
1. Added sub-options to "Hide Algorithm Tags" for hiding difficulty rating tags and retaining tags for AC problems.
2. Optimized the color display for 2100~2300 and 2300~2400 rating problems under the "Tag" style to improve visual distinction.
3. Optimized UI presentation across various interfaces.

---

### v1.5.7
`2026-09-08 03:45`

**Added**
1. Integrated the third-party [CList](https://clist.by) problem dataset, supporting fine-grained problem ratings with both Cookie session and API Key authentication modes.
2. Added a dedicated "Shortcuts" settings panel, allowing users to customize global hotkeys for frequent actions, with key combination recording, conflict detection, and one-click reset.
3. Added a dedicated "Storage" management panel to visualize Tampermonkey script storage usage, inspect and copy cached data JSON, and selectively clear caches or restore factory defaults.
4. Added a dedicated "Changelog" page with built-in version history and collapsible cards, providing an intuitive overview of all release details.
5. Added a dedicated "Roadmap" page to outline upcoming feature milestones, development progress, and open channels for community feature proposals.
6. Added a dedicated "Acknowledgments" page, honoring pioneering open-source projects including [CF-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj), [CList](https://clist.by), [OJ Better](https://github.com/beijixiaohu/OJBetter), and [Carrot-Plus](https://github.com/wuyuqian114514/carrot-plus).

**Optimized**
1. Polished the settings menu UI with more refined sub-menu groupings.
2. Migrated storage from browser LocalStorage to Tampermonkey script storage, avoiding potential LocalStorage 5MB quota limits.
3. Added a "Fill Table Cells with Tag Style" option under the Tag display style, offering softer-toned rating cell presentations.
4. Expanded format token support for custom time templates and provided detailed built-in documentation.
5. Provided detailed built-in reference documentation for verdict status abbreviations.
6. Migrated the relevant display logic of team information to status and submission pages.
7. Restructured the changelog documentation for clearer categorization and readability.

**Fixed**
1. Resolved an issue where some user avatar images failed to load following Codeforces' recent server maintenance, adding automatic proxy path adaptation and fallback self-healing.
2. Fixed an issue where placing the Rating column as the first column on problemset and contest pages prevented the [Competitive Companion](https://chromewebstore.google.com/detail/Competitive%20Companion/cjnmckjndlpiamhfimnnjmnckgghkjbl) extension from parsing all problems with one click.

---

### v1.5.6
`2026-09-01 03:10`

**Added**
1. Added a "Hide Algorithm Tags" option in General settings, allowing users to conceal specific algorithm tags on problem pages while retaining the problem difficulty score.

**Optimized**
1. Improved the formatting and layout of Ghost Participant teams in regional ICPC standings when both "User Avatars" and "Format Teams" are enabled.
2. Upgraded the settings menu UI with a multi-tab grouped navigation layout (General, Appearance, Ratings, Users) for a cleaner and more intuitive configuration experience.
3. Added a master switch for "Colored Ratings" in the Ratings settings tab, allowing users to toggle all rating colorizations and displays across the site with a single click.

---

### v1.5.5
`2026-08-29 07:45`

**Announcement**
1. This project is migrated from [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 and has been rebranded as Colorforces. All future feature developments and updates will be built upon this version in this new repository.

**Added**
1. Added real-time UI preview for the settings menu. Visual changes are now immediately reflected on the page without needing a refresh.

**Optimized**
1. Slightly beautified the settings menu UI and added project links and a quick feedback channel to the footer.
2. Applied optional time formatting to the start time of virtual contests as well.

---

### v1.5.4
`2026-08-28 18:45`

**Optimized**
1. Resolved the issue on the Standings page where long team names were truncated/obscured when avatars were enabled. Added a new "Format Teams" feature toggle in the settings for both Ghost Participants and standard CF teams.

**Fixed**
1. Fixed the display of writers' avatars on the Contest page when avatars were enabled, restoring a clean, line-by-line layout.

---

### v1.5.3
`2026-08-24 16:15`

**Fixed**
1. Fixed a Flash of Unstyled Content (FOUC) issue where the color picker (Pickr) would briefly flash upon page load before its external CSS was fully downloaded.

---

### v1.5.2
`2026-08-24 14:15`

**Optimized**
1. Mapped Node.js and Delphi to their respective language icons correctly.

**Fixed**
1. Fixed an issue where injected avatars in non-data tables (like the Recent Actions page) could be pushed to the line above due to text wrapping or incorrect table layout detection.
2. Prevented redundant avatar rendering on Codeforces profile pages and near native large avatar containers to maintain a clean UI.
3. Fixed an issue where the C language variants (e.g., "C11") and the D language were missing icons in the submission status table. Added custom SVG icons for C (Green) and D.

---

### v1.5.1
`2026-08-24 01:39`

**Added**
1. Support toggling the difficulty rating display style in the settings panel (Classic "Block" / iView-style "Tag").
2. Added toggles in the settings panel to control the display of ratings in different areas (Submissions, Status, Hacks, ProblemSet, Contest Problems, Standings, Problem Tags).
3. Support enabling and customizing time format strings with real-time preview.
4. Added support for displaying user avatars in tables, with customizable size via settings.
5. Added support for displaying dedicated language icons (e.g., C++, Python, Go) in the language column, with customizable size.
6. Added support for minimalist abbreviations of verdict statuses (e.g., `Accepted` -> `AC`, `Time limit exceeded` -> `TLE`).

**Fixed**
1. Completely removed the redundant logic of appending `[xxxx]` score text next to problem links on normal pages.
2. Resolved layout issues in the time column when custom time formatting is disabled, fully restoring the official default style.
3. Resolved an issue where difficulty background highlights were glaring when using dark background plugins (such as Dark Reader, CF-Better).

---

### v1.5.0
`2026-08-23 21:50`

**Added**
1. Added a floating "Settings" menu at the bottom right corner of the page.
2. Added support for customizing the AC (Accepted) background color via the settings menu, with configuration persisted locally.

---

### v1.4.2
`2026-08-23 18:25`

**Optimized**
1. Optimized text readability for higher ratings. For problem ratings `>= 1600` (Blue tier and above), the font color now automatically switches to high-contrast white (`#FFFFFF`).

---

### v1.4.1
`2026-08-23 18:00`

**Optimized**
1. Changed the time formatting from `yyyy-mm-dd hh:mm` to `yyyy/mm/dd hh:mm` for better readability.

---

### v1.4.0
`2026-08-23 17:33`

**Added**
1. Added problem rating color display to problem tags.

**Optimized**
1. Optimized difficulty rating and AC status display on contest pages.
2. Optimized difficulty rating display on hacks pages.
3. Optimized time formatting and table layout on submissions/status pages.

---

### v1.3.5
`2026-08-22 23:50`

**Added**
1. Displays problem difficulty ratings directly on `submissions` and `status` pages, complete with corresponding color highlighting.

**Optimized**
1. Fetches problem data via the official Codeforces API and updates locally only once per day, avoiding excessive network requests.
