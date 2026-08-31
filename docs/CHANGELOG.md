<h1 align="center">Changelog</h1>

<p align="center">
  <strong>English</strong> | <a href="CHANGELOG_zh.md">简体中文</a>
</p>

All notable changes to this project will be documented in this file.

---

### v1.5.6
`2026-09-01 03:10`

1. Optimization: Improved the formatting and layout of Ghost Participant teams in regional ICPC standings when both "User Avatars" and "Format Teams" are enabled.
2. Optimization: Upgraded the settings menu UI with a multi-tab grouped navigation layout (General, Appearance, Ratings, Users) for a cleaner and more intuitive configuration experience.
3. Optimization: Added a master switch for "Colored Ratings" in the Ratings settings tab, allowing users to toggle all rating colorizations and displays across the site with a single click.
4. Feature: Added a "Hide Algorithm Tags" option in General settings, allowing users to conceal specific algorithm tags on problem pages while retaining the problem difficulty score.

---

### v1.5.5
`2026-08-29 07:45`

1. **Announcement**: This project is migrated from [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 and has been rebranded as Colorforces. All future feature developments and updates will be built upon this version in this new repository.
2. Optimization: Slightly beautified the settings menu UI and added project links and a quick feedback channel to the footer.
3. Optimization: Applied optional time formatting to the start time of virtual contests as well.
4. Feature: Added real-time UI preview for the settings menu. Visual changes are now immediately reflected on the page without needing a refresh.

---

### v1.5.4
`2026-08-28 18:45`

1. Fix: Fixed the display of writers' avatars on the Contest page when avatars were enabled, restoring a clean, line-by-line layout.
2. Optimization: Resolved the issue on the Standings page where long team names were truncated/obscured when avatars were enabled. Added a new "Format Teams" feature toggle in the settings for both Ghost Participants and standard CF teams.

---

### v1.5.3
`2026-08-24 16:15`

1. Fix: Fixed a Flash of Unstyled Content (FOUC) issue where the color picker (Pickr) would briefly flash upon page load before its external CSS was fully downloaded.

---

### v1.5.2
`2026-08-24 14:15`

1. Fix: Fixed an issue where injected avatars in non-data tables (like the Recent Actions page) could be pushed to the line above due to text wrapping or incorrect table layout detection.
2. Fix: Prevented redundant avatar rendering on Codeforces profile pages and near native large avatar containers to maintain a clean UI.
3. Fix: Fixed an issue where the C language variants (e.g., "C11") and the D language were missing icons in the submission status table. Added custom SVG icons for C (Green) and D.
4. Optimization: Mapped Node.js and Delphi to their respective language icons correctly.

---

### v1.5.1
`2026-08-24 01:39`

1. Fix: Completely removed the redundant logic of appending `[xxxx]` score text next to problem links on normal pages.
2. Fix: Resolved layout issues in the time column when custom time formatting is disabled, fully restoring the official default style.
3. Fix: Resolved an issue where difficulty background highlights were glaring when using dark background plugins (such as Dark Reader, CF-Better).
4. Feature: Support toggling the difficulty rating display style in the settings panel (Classic "Block" / iView-style "Tag").
5. Feature: Added toggles in the settings panel to control the display of ratings in different areas (Submissions, Status, Hacks, ProblemSet, Contest Problems, Standings, Problem Tags).
6. Feature: Support enabling and customizing time format strings with real-time preview.
7. Feature: Added support for displaying user avatars in tables, with customizable size via settings.
8. Feature: Added support for displaying dedicated language icons (e.g., C++, Python, Go) in the language column, with customizable size.
9. Feature: Added support for minimalist abbreviations of verdict statuses (e.g., `Accepted` -> `AC`, `Time limit exceeded` -> `TLE`).

---

### v1.5.0
`2026-08-23 21:50`

1. Feature: Added a floating "Settings" menu at the bottom right corner of the page.
2. Feature: Added support for customizing the AC (Accepted) background color via the settings menu, with configuration persisted locally.

---

### v1.4.2
`2026-08-23 18:25`

1. Optimization: Optimized text readability for higher ratings. For problem ratings `>= 1600` (Blue tier and above), the font color now automatically switches to high-contrast white (`#FFFFFF`).

---

### v1.4.1
`2026-08-23 18:00`

1. Optimization: Changed the time formatting from `yyyy-mm-dd hh:mm` to `yyyy/mm/dd hh:mm` for better readability.

---

### v1.4.0
`2026-08-23 17:33`

1. Optimization: Optimized difficulty rating and AC status display on contest pages.
2. Optimization: Optimized difficulty rating display on hacks pages.
3. Optimization: Optimized time formatting and table layout on submissions/status pages.
4. Feature: Added problem rating color display to problem tags.

---

### v1.3.5
`2026-08-22 23:50`

1. Feature: Displays problem difficulty ratings directly on `submissions` and `status` pages, complete with corresponding color highlighting.
2. Optimization: Fetches problem data via the official Codeforces API and updates locally only once per day, avoiding excessive network requests.
