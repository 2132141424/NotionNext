/**
 * 把 vditor 的运行时资源同步到 public/vditor/dist，供 /write 写作页自托管使用，
 * 避免运行时依赖 unpkg 这类公共 CDN。升级 vditor 后重新执行：yarn sync-vditor
 *
 * SKIP 里的都是写作时用不到的重量级渲染库（数学公式、图表、流程图等），
 * 编辑器只有在正文真的用到对应语法时才会去加载它们；如果你要在编辑器里
 * 预览这些内容，把对应项从 SKIP 里删掉再同步即可。
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'node_modules', 'vditor', 'dist')
const DEST = path.join(__dirname, '..', 'public', 'vditor', 'dist')

const SKIP = new Set([
  'js/mathjax',
  'js/mermaid',
  'js/graphviz',
  'js/katex',
  'js/echarts',
  'js/markmap',
  'js/abcjs',
  'js/smiles-drawer',
  'js/flowchart.js',
  'js/wavedrom',
  'js/plantuml',
  'ts',
  'types',
  // 页面只加载 index.min.js，未压缩副本和类型声明不用带走
  'index.js',
  'index.d.ts',
  'method.js'
])

function copyDir(from, to, prefix) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (SKIP.has(rel)) continue
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest, rel)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`找不到 ${SRC}，请先执行 yarn install`)
  process.exit(1)
}

fs.rmSync(DEST, { recursive: true, force: true })
copyDir(SRC, DEST, '')

const size =
  fs
    .readdirSync(DEST, { recursive: true })
    .reduce(
      (sum, file) =>
        sum + (fs.statSync(path.join(DEST, file)).isFile() ? fs.statSync(path.join(DEST, file)).size : 0),
      0
    ) /
  1024 /
  1024

console.log(`vditor 资源已同步到 public/vditor/dist（${size.toFixed(2)} MB）`)
