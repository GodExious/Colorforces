export default {
  'v 1.8.0:0': [
    'Added user data analytics on profile pages: a summary, rating heatmap, monthly and hourly activity, multi-user rating and contest rank curve comparison, rating and tag distributions, tag weak spots, recent average rating, attempts, verdicts, contest pace, participation types, languages and unsolved problems.',
    'Added three items to the roadmap: full internationalization (i18n), improved contest analysis & prediction, and built-in translation.',
  ],
  'v 1.8.0:1': [
    'Improved the display of non-square avatars in the rating analysis dialog.',
    'The number of contests cached for rating prediction can now be customized, 10 by default.',
    'To help users try new features, many options are now enabled by default, and some default values were adjusted.',
    'Reorganized the storage structure of the plugin configuration by menu tab; existing settings will be migrated automatically.',
    'Updated the acknowledged projects and redesigned the Acknowledgments page around the petal theme.',
    'Improved the styling of some submenu components (sub-options, sliders and roadmap cards).',
    'Times shown in tooltips of the original page now follow the custom time format.',
    'Added a TypeScript language icon, and languages without a preset icon now show a common unknown-language icon.',
    'Rating prediction now shows staged progress while loading: standings, ratings, submissions and calculation.',
    'Previews of large data in the storage viewer are trimmed further, making it smoother to switch between items.',
    'Added a notice explaining that dark themes from other extensions are no longer adapted for.',
  ],
  'v 1.8.0:2': [
    'Fixed incomplete solved-problem records for accounts with more than 10,000 submissions.',
    'Fixed setting changes being overwritten by other pages when several pages are open at once.',
    'Fixed leftover time text appearing in other tooltips after hovering a time on the page.',
    "Fixed the deprecated cache listing other scripts' data, and data left in the site's local storage by early versions not being clearable.",
  ],
  'v 1.7.0:0': [
    'Added contest rating prediction with rating changes, performance, rank progression and single-user rating analysis, plus a shortcut to toggle it.',
    'Added rated/unrated/virtual participant tags indicating how each participant takes part in the contest.',
  ],
  'v 1.7.0:1': [
    'Improved the storage structure of the storage categories and the labelling of displayed fields.',
    'Replaced the userscript icon with the Colorforces logo.',
    'Improved and expanded contest-page time-format styling compatibility.',
    'With help from Claude, redesigned and refined the UI of the menu and some pages.',
    'Reorganized the code directory structure and added unit tests.',
  ],
  'v 1.7.0:2': [
    'Fixed dialogs closing when a text selection drag ended outside the dialog.',
    'Fixed several cases of interface jitter, misalignment, and text not following language changes.',
  ],
  'v 1.6.0:0': [
    'With help from Codex, decoupled and standardized the project structure and component organization, adding extensive concise Chinese function-level comments to improve readability and maintainability.',
    'Further polished the menu interface.',
    'Added transitions for page feature changes and settings-panel interactions.',
    'Improved compatibility with native Codeforces styles.',
    'Separated plugin runtime data from preferences.',
    'Bundled the menu title font to avoid reliance on remote font loading.',
    'Moved distribution and updates to Releases, automated publishing, and retained the legacy update entry.',
    'Added a separate solved-row highlighting toggle, with shortcuts for highlighting and menu language switching.',
    'Improved real-time verdict abbreviations and extended them to submission history on problem pages.',
    'Moved the algorithm-tag visibility settings to Appearance.',
    'Users can customize the settings panel size and position, with drag-to-adjust support.',
  ],
  'v 1.6.0:1': [
    'Explicitly request the official problemset in English and refresh older-language caches.',
    'Fixed menu selection indicator misalignment when moving between displays with different scaling levels.',
    'Fixed middle-click opening of menu links in new tabs.',
  ],
  'v 1.5.9:0': ['Added automatic update detection functionality.'],
  'v 1.5.9:1': ['Optimized the storage management interface UI and related logic.'],
  'v 1.5.9:2': [
    'Fixed missing difficulty ratings for shared problems across concurrent contests (e.g., Div.1 and Div.2) in official Codeforces data by grouping parallel contests by start time and inheriting ratings from peer contests with matching problem names.',
    'Fixed an issue where the AC background color picker in settings displayed as pure black.',
    'Fixed an issue where blog and topic post author avatars were not displayed.',
  ],
  'v 1.5.8:0': [
    'Added sub-options to "Hide Algorithm Tags" for hiding difficulty rating tags and retaining tags for AC problems.',
    'Optimized the color display for 2100~2300 and 2300~2400 rating problems under the "Tag" style to improve visual distinction.',
    'Optimized UI presentation across various interfaces.',
  ],
  'v 1.5.7:0': [
    'Integrated the third-party [CList](https://clist.by) problem dataset, supporting fine-grained problem ratings with both Cookie session and API Key authentication modes.',
    'Added a dedicated "Shortcuts" settings panel, allowing users to customize global hotkeys for frequent actions, with key combination recording, conflict detection, and one-click reset.',
    'Added a dedicated "Storage" management panel to visualize Tampermonkey script storage usage, inspect and copy cached data JSON, and selectively clear caches or restore factory defaults.',
    'Added a dedicated "Changelog" page with built-in version history and collapsible cards, providing an intuitive overview of all release details.',
    'Added a dedicated "Roadmap" page to outline upcoming feature milestones, development progress, and open channels for community feature proposals.',
    'Added a dedicated "Acknowledgments" page, honoring pioneering open-source projects including [CF-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj), [CList](https://clist.by), [OJ Better](https://github.com/beijixiaohu/OJBetter), and [Carrot-Plus](https://github.com/wuyuqian114514/carrot-plus).',
  ],
  'v 1.5.7:1': [
    'Polished the settings menu UI with more refined sub-menu groupings.',
    'Migrated storage from browser LocalStorage to Tampermonkey script storage, avoiding potential LocalStorage 5MB quota limits.',
    'Added a "Fill Table Cells with Tag Style" option under the Tag display style, offering softer-toned rating cell presentations.',
    'Expanded format token support for custom time templates and provided detailed built-in documentation.',
    'Provided detailed built-in reference documentation for verdict status abbreviations.',
    'Migrated the relevant display logic of team information to status and submission pages.',
    'Restructured the changelog documentation for clearer categorization and readability.',
  ],
  'v 1.5.7:2': [
    "Resolved an issue where some user avatar images failed to load following Codeforces' recent server maintenance, adding automatic proxy path adaptation and fallback self-healing.",
    'Fixed an issue where placing the Rating column as the first column on problemset and contest pages prevented the [Competitive Companion](https://chromewebstore.google.com/detail/Competitive%20Companion/cjnmckjndlpiamhfimnnjmnckgghkjbl) extension from parsing all problems with one click.',
  ],
  'v 1.5.6:0': [
    'Added a "Hide Algorithm Tags" option in General settings, allowing users to conceal specific algorithm tags on problem pages while retaining the problem difficulty score.',
  ],
  'v 1.5.6:1': [
    'Improved the formatting and layout of Ghost Participant teams in regional ICPC standings when both "User Avatars" and "Format Teams" are enabled.',
    'Upgraded the settings menu UI with a multi-tab grouped navigation layout (General, Appearance, Ratings, Users) for a cleaner and more intuitive configuration experience.',
    'Added a master switch for "Colored Ratings" in the Ratings settings tab, allowing users to toggle all rating colorizations and displays across the site with a single click.',
  ],
  'v 1.5.5:0': [
    'This project is migrated from [CF-Submissions-Ratings (CFSR)](https://github.com/GodExious/CF-Submissions-Ratings) v1.5.5 and has been rebranded as Colorforces. All future feature developments and updates will be built upon this version in this new repository.',
  ],
  'v 1.5.5:1': [
    'Added real-time UI preview for the settings menu. Visual changes are now immediately reflected on the page without needing a refresh.',
  ],
  'v 1.5.5:2': [
    'Slightly beautified the settings menu UI and added project links and a quick feedback channel to the footer.',
    'Applied optional time formatting to the start time of virtual contests as well.',
  ],
  'v 1.5.4:0': [
    'Resolved the issue on the Standings page where long team names were truncated/obscured when avatars were enabled. Added a new "Format Teams" feature toggle in the settings for both Ghost Participants and standard CF teams.',
  ],
  'v 1.5.4:1': [
    "Fixed the display of writers' avatars on the Contest page when avatars were enabled, restoring a clean, line-by-line layout.",
  ],
  'v 1.5.3:0': [
    'Fixed a Flash of Unstyled Content (FOUC) issue where the color picker (Pickr) would briefly flash upon page load before its external CSS was fully downloaded.',
  ],
  'v 1.5.2:0': ['Mapped Node.js and Delphi to their respective language icons correctly.'],
  'v 1.5.2:1': [
    'Fixed an issue where injected avatars in non-data tables (like the Recent Actions page) could be pushed to the line above due to text wrapping or incorrect table layout detection.',
    'Prevented redundant avatar rendering on Codeforces profile pages and near native large avatar containers to maintain a clean UI.',
    'Fixed an issue where the C language variants (e.g., "C11") and the D language were missing icons in the submission status table. Added custom SVG icons for C (Green) and D.',
  ],
  'v 1.5.1:0': [
    'Support toggling the difficulty rating display style in the settings panel (Classic "Block" / iView-style "Tag").',
    'Added toggles in the settings panel to control the display of ratings in different areas (Submissions, Status, Hacks, ProblemSet, Contest Problems, Standings, Problem Tags).',
    'Support enabling and customizing time format strings with real-time preview.',
    'Added support for displaying user avatars in tables, with customizable size via settings.',
    'Added support for displaying dedicated language icons (e.g., C++, Python, Go) in the language column, with customizable size.',
    'Added support for minimalist abbreviations of verdict statuses (e.g., `Accepted` -> `AC`, `Time limit exceeded` -> `TLE`).',
  ],
  'v 1.5.1:1': [
    'Completely removed the redundant logic of appending `[xxxx]` score text next to problem links on normal pages.',
    'Resolved layout issues in the time column when custom time formatting is disabled, fully restoring the official default style.',
    'Resolved an issue where difficulty background highlights were glaring when using dark background plugins (such as Dark Reader, CF-Better).',
  ],
  'v 1.5.0:0': [
    'Added a floating "Settings" menu at the bottom right corner of the page.',
    'Added support for customizing the AC (Accepted) background color via the settings menu, with configuration persisted locally.',
  ],
  'v 1.4.2:0': [
    'Optimized text readability for higher ratings. For problem ratings `>= 1600` (Blue tier and above), the font color now automatically switches to high-contrast white (`#FFFFFF`).',
  ],
  'v 1.4.1:0': [
    'Changed the time formatting from `yyyy-mm-dd hh:mm` to `yyyy/mm/dd hh:mm` for better readability.',
  ],
  'v 1.4.0:0': ['Added problem rating color display to problem tags.'],
  'v 1.4.0:1': [
    'Optimized difficulty rating and AC status display on contest pages.',
    'Optimized difficulty rating display on hacks pages.',
    'Optimized time formatting and table layout on submissions/status pages.',
  ],
  'v 1.3.5:0': [
    'Displays problem difficulty ratings directly on `submissions` and `status` pages, complete with corresponding color highlighting.',
  ],
  'v 1.3.5:1': [
    'Fetches problem data via the official Codeforces API and updates locally only once per day, avoiding excessive network requests.',
  ],
};
