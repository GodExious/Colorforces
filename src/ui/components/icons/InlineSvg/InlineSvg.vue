<script>
import { h } from 'vue';
const parsedIcons = new Map();
// 解析项目内受信任的 SVG，保留属性和子节点而不增加外层元素。
function parseIcon(source) {
  if (parsedIcons.has(source)) return parsedIcons.get(source);
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const read = (node) =>
    node.nodeType === 3
      ? node.textContent
      : {
          tag: node.tagName,
          attrs: Object.fromEntries([...node.attributes].map((attr) => [attr.name, attr.value])),
          children: [...node.childNodes]
            .filter((child) => child.nodeType === 1 || child.nodeType === 3)
            .map(read),
        };
  const icon = read(root);
  parsedIcons.set(source, icon);
  return icon;
}
// 为每个使用位置生成独立虚拟节点，避免复用同一个 VNode。
function renderIcon(node, prefix) {
  if (typeof node === 'string') return node;
  const attrs = { ...node.attrs };
  // 同一标志在多个位置使用时隔离定义，避免渐变或路径引用到另一实例。
  if (prefix) {
    if (attrs.id) attrs.id = `${prefix}-${attrs.id}`;
    for (const key of Object.keys(attrs)) {
      if ((key === 'href' || key === 'xlink:href') && attrs[key].startsWith('#'))
        attrs[key] = `#${prefix}-${attrs[key].slice(1)}`;
      else attrs[key] = attrs[key].replace(/url\(#([^)]*)\)/g, `url(#${prefix}-$1)`);
    }
  }
  return h(
    node.tag,
    attrs,
    node.children.map((child) => renderIcon(child, prefix)),
  );
}
export default {
  props: {
    source: { type: String, required: true },
    layer: { type: String, default: '' },
    idPrefix: { type: String, default: '' },
  },
  render() {
    const icon = parseIcon(this.source);
    // 静态 Logo 只取花瓣层，与动态入口共用一份 SVG 定义。
    const children = this.layer
      ? icon.children.filter(
          (child) =>
            typeof child === 'string' ||
            child.tag === 'defs' ||
            child.attrs.class?.split(/\s+/).includes(this.layer),
        )
      : icon.children;
    return renderIcon({ ...icon, children }, this.idPrefix);
  },
};
</script>
