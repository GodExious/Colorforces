<h1 align="center">Changelog</h1>

<p align="center">
  <strong>English</strong> | <a href="CHANGELOG_zh.md">简体中文</a>
</p>

All notable changes to this project will be documented in this file.

---

### v1.5.5
`2026-08-29 07:45`

- **Announcement**: This project is migrated from [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 and has been rebranded as Colorforces. All future feature developments and updates will be built upon this version in this new repository.
- Feature: Added real-time UI preview for the settings menu. Visual changes are now immediately reflected on the page without needing a refresh.
- Optimization: Slightly beautified the settings menu UI and added project links and a quick feedback channel to the footer.
- Optimization: Applied optional time formatting to the start time of virtual contests as well.

---

### v1.5.4
`2026-08-28 18:45`

- Optimization: Resolved the issue on the Standings page where long team names were truncated/obscured when avatars were enabled. Added a new "Format Teams" feature toggle in the settings for both Ghost Participants and standard CF teams.
- Optimization: Fixed the display of writers' avatars on the Contest page when avatars were enabled, restoring a clean, line-by-line layout.

---

### v1.5.3
`2026-08-24 16:15`

- Fix: Fixed a Flash of Unstyled Content (FOUC) issue where the color picker (Pickr) would briefly flash upon page load before its external CSS was fully downloaded.

---

### v1.5.2
`2026-08-24 14:15`

- Fix: Fixed an issue where injected avatars in non-data tables (like the Recent Actions page) could be pushed to the line above due to text wrapping or incorrect table layout detection.
- Fix: Prevented redundant avatar rendering on Codeforces profile pages and near native large avatar containers to maintain a clean UI.
- Fix: Fixed an issue where the C language variants (e.g., "C11") and the D language were missing icons in the submission status table. Added custom SVG icons for C (Green) and D.
- Improvement: Mapped Node.js and Delphi to their respective language icons correctly.

---

### v1.5.1
`2026-08-24 01:39`

- Fix: Completely removed the redundant logic of appending `[xxxx]` score text next to problem links on normal pages.
- Fix: Resolved layout issues in the time column when custom time formatting is disabled, fully restoring the official default style.
- Feature: Support toggling the difficulty rating display style in the settings panel (Classic "Block" / iView-style "Tag").
- Feature: Added toggles in the settings panel to control the display of ratings in different areas (Submissions, Status, Hacks, ProblemSet, Contest Problems, Standings, Problem Tags).
- Feature: Support enabling and customizing time format strings with real-time preview.
- Feature: Added support for displaying user avatars in tables, with customizable size via settings.
- Feature: Added support for displaying dedicated language icons (e.g., C++, Python, Go) in the language column, with customizable size.
- Feature: Added support for minimalist abbreviations of verdict statuses (e.g., `Accepted` -> `AC`, `Time limit exceeded` -> `TLE`).
- Fix: Resolved an issue where difficulty background highlights were glaring when using dark background plugins (such as Dark Reader, CF-Better).

---

### v1.5.0
`2026-08-23 21:50`

- Added a floating "Settings" menu at the bottom right corner of the page.
- Added support for customizing the AC (Accepted) background color via the settings menu, with configuration persisted locally.

---

### v1.4.2
`2026-08-23 18:25`

- Optimized text readability for higher ratings. For problem ratings `>= 1600` (Blue tier and above), the font color now automatically switches to high-contrast white (`#FFFFFF`).

---

### v1.4.1
`2026-08-23 18:00`

- Changed the time formatting from `yyyy-mm-dd hh:mm` to `yyyy/mm/dd hh:mm` for better readability.

---

### v1.4.0
`2026-08-23 17:33`

- Optimized difficulty rating and AC status display on contest pages.
- Optimized difficulty rating display on hacks pages.
- Optimized time formatting and table layout on submissions/status pages.
- Added problem rating color display to problem tags.

---

### v1.3.5
`2026-08-22 23:50`

- Displays problem difficulty ratings directly on `submissions` and `status` pages, complete with corresponding color highlighting.
- Fetches problem data via the official Codeforces API and updates locally only once per day, avoiding excessive network requests.


