// The English prompt. Same input and output as zh.js.
export default ({ idea, motion, code, count, languages }) => [
  'You are an SVG illustrator. Please design an "avatar frame" for the browser extension Colorforces. It goes around a user\'s round avatar on Codeforces pages.',
  '',
  ...(code
    ? [
        '[Current code] Please start from it and change it as I describe:',
        '```svg',
        code,
        '```',
        '',
      ]
    : []),
  code ? '[What to change]' : '[My idea]',
  idea('(no idea written yet)'),
  '',
  ...(count > 1
    ? [
        `[Number of designs] Give ${count} different ${code ? 'revisions' : 'designs'}. Make their composition, colors or motion clearly different, and give each its own name.`,
        '',
      ]
    : []),
  '[Canvas]',
  '- Output one complete SVG. The root element is <svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 160 160">.',
  '- Coordinates: x and y both run from -20 to 140. The top left corner is (-20, -20) and the bottom right corner is (140, 140), not 0 to 160.',
  '- The avatar is the circle in the middle: center (60, 60), radius 40. Its diameter is half the canvas width. The extension places it underneath, so do not draw the avatar.',
  "- Draw nothing within radius 36. That is the avatar's face. You may cover its edge (radius 36 to 40).",
  '- There is little room outside the avatar. Above, below, left and right of it there are only 40 units to the canvas edge, a little more in the corners. Size the decorations for this space.',
  '- Everything must stay inside the canvas, because anything outside is cut off. Count half the stroke width, shadows and glows, and the farthest and largest point of every animation.',
  "- Leave some margin if you can: keep x within -16 to 136 and y within -16 to 126. Anything below 126 is hidden in the try-on view of the extension's frame library.",
  "- In a transform, rotate and scale turn around the point (0, 0), not around the canvas center or the shape's own center. To turn around another point, write rotate(angle x y), or translate to that point first and then scale.",
  '- Keep text short. Estimate its width from the font size (a Latin letter is about 0.6 times the font size, a CJK character about the full size) and leave margin at both ends.',
  '- The frame is shown very small (about 40 pixels wide) and also above 200 pixels. Keep the main shapes clear with bold outlines, and avoid tiny details.',
  '- If I did not name a style, use an outlined cartoon vector style with rich colors.',
  '',
  ...(motion
    ? [
        '[Motion]',
        '- CSS only: write it in a <style> inside the SVG, using @keyframes and animation, looping. Do not use SMIL animation such as <animate>.',
        '- The first frame of every animation must match the still look. When motion is off, the extension stops all animations and shows the still look.',
        '- An animated element must not also carry a transform attribute. To position it, wrap it in <g transform="…"> and animate the inner one. Write transform-origin in canvas coordinates, for example transform-origin: 60px 20px.',
        '- Keep the pace calm, so the picture is not busy all the time.',
      ]
    : ['[Motion] No motion. Do not write any animation.']),
  '',
  '[Not allowed]',
  '- <script>, event attributes such as onclick, links to web addresses, @import, and external fonts. Images may only be embedded with data:.',
  "- Text may use 'Kaushan Script' (a handwriting font built into the extension). Other text uses common system fonts.",
  '- The code must be valid XML: write & as &amp; and < as &lt;, and do not use HTML entities such as &nbsp;. This applies inside <style> too, even in CSS comments (/* */). A single bare & or < there stops the whole image from drawing.',
  '',
  `[Name and intro] The extension supports these interface languages: ${languages.map((lang) => `${lang.code} (${lang.label})`).join(', ')}. Write the name and the intro once for each of them, keyed by the language codes above. Put this block first inside <svg>:`,
  '<metadata><![CDATA[',
  '{ "format": "colorforces-frame", "version": 1,',
  `  "name": { ${languages.map((lang) => `"${lang.code}": "${lang.code === 'en' ? 'English name' : `Name in ${lang.label}`}"`).join(', ')} },`,
  `  "intro": { ${languages.map((lang) => `"${lang.code}": "${lang.code === 'en' ? 'One or two sentences: what it shows and how it moves' : `The same in ${lang.label}`}"`).join(', ')} },`,
  `  "author": "${code ? 'Keep the original author' : 'Your full model name and version'}" }`,
  ']]></metadata>',
  'Keep the name short (one to three words). The intro describes the picture and the motion in a light tone.',
  "format and version mark the extension's frame format. version is the version of this format, not how many times this frame has been revised (the extension keeps track of that). Copy both exactly as they are.",
  ...(code
    ? []
    : [
        'The author is signed by whoever makes the frame. You are an AI, so write your full model name with series, version number and tier (like "XX 2.5 Pro"). A brand alone, such as Gemini, ChatGPT or Claude, is not enough, and do not write the user\'s name. If you are unsure of your exact version, write the most specific name you are sure of and do not make one up.',
      ]),
  '',
  ...(code
    ? [
        '[When editing]',
        '- Keep the author as it is. If there is none, sign with your full model name and version.',
        '- Leave revisions unchanged. The extension adds one when it saves.',
        '- Update the name and intro to match the changed design.',
        '',
      ]
    : []),
  '[Check before output] Go through every shape, without writing the check out. After all the transforms around it, its edges (with the stroke) and the farthest position of any animated move, scale or rotation must stay within the range above. If something goes outside, shrink it or move it inward. Do not rely on clipping. Then check the code once more for any bare & or <, including inside <style> and CSS comments, and change them to &amp; and &lt;.',
  '',
  count > 1
    ? `[Output] Output only ${count} \`\`\`svg code blocks, one per design, each containing the complete SVG. Do not leave anything out.`
    : '[Output] Output only one ```svg code block containing the complete SVG. Do not leave anything out.',
];
