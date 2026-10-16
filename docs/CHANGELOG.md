<h1 align="center">Changelog</h1>

<p align="center">
  <strong>English</strong> | <a href="CHANGELOG_zh.md">简体中文</a>
</p>

All notable changes to this project will be documented in this file.

---

### v1.9.0
`2026-10-17 04:15 UTC+8`

**Added**
1. Added user groups: group any user and add notes, follow or unfollow friends directly, and right-click a user name to see their profile at a glance. Shortcuts are provided.
2. Added avatar frames to decorate user groups or yourself, with deep customization. Shortcuts are provided.
3. Added one roadmap item: achievements & points.

**Optimized**
1. The background of the rating-change column on standings now blends from left to right and no longer looks slanted when rows get taller.
2. Predicted rating changes of first-contest accounts on standings now include the 500-point bonus of the first contest, matching what Codeforces shows.
3. Improved the tooltips of the rated-rank column on standings.
4. Improved the scrollbar style of the extension.
5. The maximum avatar size is raised from 3x to 5x, and the default size for settings never changed goes from 1.6x to 2.4x.
6. Improved the position of the # mark for virtual participation.
7. The roadmap is now a timeline that shows when each item was finished and when planned items are expected.

**Fixed**
1. Fixed the Hide Test Numbers option showing its Chinese name in the English menu.
2. Fixed the time zone picker in the analytics panel not responding to the up and down keys after being clicked.
3. Fixed rating-change predictions for new (unrated) accounts being far off.
4. Fixed submissions that were voided, hacked or failed system tests still counting as accepted for participants outside the official standings after a contest and before ratings came out, which pushed their rated rank down.

---

### v1.8.1
`2026-10-13 01:25 UTC+8`

**Added**
1. Added an option to format Recent Actions in the sidebar.
2. Added one roadmap item: multi-criteria problem filtering.
3. Added three participation tags: untrusted, practice and ghost.
4. Added a plugin font size option that scales the text of the menu, dialogs and the analytics panel, charts included.
5. Added an option to hide test numbers in verdicts (such as on test 3). Off by default, with a shortcut to toggle it.
6. The Shortcuts page can now clear all shortcuts at once.
7. Team-rated contests such as VK Cup now get rating prediction and per-member rating analysis, and team participation types are divided and tagged in more detail.
8. Row highlighting has a new background colour option for attempted but unsolved problems.

**Optimized**
1. The update notice now lists what changed in the new version.
2. Improved the drawing, interaction and some descriptions of several charts in the user analytics panel, and added a shortcut to toggle it.
3. Improved the transition animations of several plugin features.
4. The participation type distribution in the user analytics panel now separates individuals from teams, can be viewed by submissions or by contests, and counts contests whose results were cancelled.
5. Improved controls unexpectedly showing a focus ring in some cases.
6. Improved the UI of the menu and some dialogs.
7. Improved the style of the rating row on standings, restoring the lower height of the previous version.
8. Standings now refresh automatically at intervals that depend on the contest phase, with improved transitions and some tooltip text.
9. During a running contest, predictions for participants on the current page now use the live results shown on the page.
10. The CList API Key guide is now a livelier animated demonstration.
11. Improved some styles and tooltip text of the single-user rating analysis dialog on standings; accounts with fewer than 6 contests are now calculated with the newcomer rules and marked with a tag.
12. Team formatting can now expand the members that the site collapses when a team has more than 3.
13. Improved members of some ghost teams not being listed one per line on standings when team formatting is on.
14. Contests that ended long ago without rating changes are treated as unrated, and their official participants get the unrated tag.
15. Standardised the project style variables (font sizes, corner radii, font weights and transition durations); half-pixel font sizes are no longer used.
16. Improved how time formatting applies to the sent and judged times on the submission page, and made the time zone label in table headers look the same on the contests and status pages.
17. The number of cached contests is now capped at 25, so that the cache does not grow too large.
18. Reduced noticeable stutter while pages such as standings are loading.
19. Reduced the brief stutter when switching to the Storage page in the menu.

**Fixed**
1. Fixed the y-axis labels of the rating curve comparison disappearing after narrowing the time range.
2. Fixed language switching not fully taking effect in some confirmation dialogs.
3. Fixed rating prediction missing untrusted participants during running Div. 2, Div. 3, Div. 4 and Educational rounds, which made predictions inaccurate.
4. Fixed live rating predictions treating some rated participants as first-time accounts and wrongly calculating them at 1400.
5. Fixed the single-user rating analysis not taking tied ranks into account, which made its predictions too low.
6. Fixed teams with an asterisk in their name being tagged as unrated.
7. Fixed avatars displaying incorrectly when toggling team formatting on submission pages.
8. Fixed standings of old unrated contests (such as ICPC mirrors) reporting a failed request.
9. Fixed full-row backgrounds of attempted but unsolved problems staying after row highlighting is turned off.
10. Fixed the colour picker jumping back and forth between colours when several pages are open.
11. Fixed verdict abbreviations not being applied in places such as the title of the source popup.
12. Fixed the time zone still being shown in each time cell of submission tables when time formatting is on, although the header already states it.

---

### v1.8.0
`2026-10-06 00:22 UTC+8`

**Added**
1. Added user data analytics on profile pages: a summary, rating heatmap, monthly and hourly activity, multi-user rating and contest rank curve comparison, rating and tag distributions, tag weak spots, recent average rating, attempts, verdicts, contest pace, participation types, languages and unsolved problems.
2. Added three items to the roadmap: full internationalization (i18n), improved contest analysis & prediction, and built-in translation.

**Optimized**
1. Improved the display of non-square avatars in the rating analysis dialog.
2. The number of contests cached for rating prediction can now be customized, 10 by default.
3. To help users try new features, many options are now enabled by default, and some default values were adjusted.
4. Reorganized the storage structure of the plugin configuration by menu tab; existing settings will be migrated automatically.
5. Updated the acknowledged projects and redesigned the Acknowledgments page around the petal theme.
6. Improved the styling of some submenu components (sub-options, sliders and roadmap cards).
7. Times shown in tooltips of the original page now follow the custom time format.
8. Added a TypeScript language icon, and languages without a preset icon now show a common unknown-language icon.
9. Rating prediction now shows staged progress while loading: standings, ratings, submissions and calculation.
10. Previews of large data in the storage viewer are trimmed further, making it smoother to switch between items.
11. Added a notice explaining that dark themes from other extensions are no longer adapted for.

**Fixed**
1. Fixed incomplete solved-problem records for accounts with more than 10,000 submissions.
2. Fixed setting changes being overwritten by other pages when several pages are open at once.
3. Fixed leftover time text appearing in other tooltips after hovering a time on the page.
4. Fixed the deprecated cache listing other scripts' data, and data left in the site's local storage by early versions not being clearable.

---

### v1.7.0
`2026-10-04 03:59 UTC+8`

**Added**
1. Added contest rating prediction with rating changes, performance, rank progression and single-user rating analysis, plus a shortcut to toggle it.
2. Added rated/unrated/virtual participant tags indicating how each participant takes part in the contest.

**Optimized**
1. Improved the storage structure of the storage categories and the labelling of displayed fields.
2. Replaced the userscript icon with the Colorforces logo.
3. Improved and expanded contest-page time-format styling compatibility.
4. With help from Claude, redesigned and refined the UI of the menu and some pages.
5. Reorganized the code directory structure and added unit tests.

**Fixed**
1. Fixed dialogs closing when a text selection drag ended outside the dialog.
2. Fixed several cases of interface jitter, misalignment, and text not following language changes.

---

### v1.6.0
`2026-09-30 09:07`

**Optimized**
1. With help from Codex, decoupled and standardized the project structure and component organization, adding extensive concise Chinese function-level comments to improve readability and maintainability.
2. Further polished the menu interface.
3. Added transitions for page feature changes and settings-panel interactions.
4. Improved compatibility with native Codeforces styles.
5. Separated plugin runtime data from preferences.
6. Bundled the menu title font to avoid reliance on remote font loading.
7. Moved distribution and updates to Releases, automated publishing, and retained the legacy update entry.
8. Added a separate solved-row highlighting toggle, with shortcuts for highlighting and menu language switching.
9. Improved real-time verdict abbreviations and extended them to submission history on problem pages.
10. Moved the algorithm-tag visibility settings to Appearance.
11. Users can customize the settings panel size and position, with drag-to-adjust support.

**Fixed**
1. Explicitly request the official problemset in English and refresh older-language caches.
2. Fixed menu selection indicator misalignment when moving between displays with different scaling levels.
3. Fixed middle-click opening of menu links in new tabs.

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
