# 911 Carrera 997.1 线稿拆解 — 生成说明

原创简化隐藏线模型，不是保时捷官方资料，也不是 A 级曲面或可以下料的工程图。

## 画的是哪一辆

- Porsche 911 Carrera Coupé，typ 997.1，约 2005–2008
- 窄体、后轮驱动、3.6 升自然吸气
- 18 英寸五辐轮（前 235/40、后 265/40，半径按规格估算）
- 每侧一条扁圆排气，不是 Carrera S 的双圆口，也不是四出
- 后扰流板画成收起状态，拆开时才升起
- 圆灯在翼子板上，雾灯/行车灯在保险杠里，分开画
- 后视镜是 997.1 的单臂，装在 A 柱三角窗附近
- 不画 Turbo / GT3 / 997.2、宽体、LED 日间行车灯

## 尺寸

高置信度、多处公开资料一致的数字：

| 项目 | 数值 | 说明 |
| --- | --- | --- |
| 轴距 | 2350 mm | 建模基准 |
| 宽（不含后视镜） | 1808 mm | 窄体 Carrera / Carrera S |
| 高 | 1310 mm | 无 PASM 的 Carrera |
| 轮距 | 1486 / 1534 mm | 18 英寸 Carrera |

全长有冲突，模型没有假装它不存在：

- 4427 mm：ADAC（厂方数据）、911andco、Rennwiki 等欧规口径
- 4461 mm：2007 年美国产品册（Internet Archive: `porsche-911-car-brochure-2007`）

侧视轮廓按轴距 2350 mm 对齐后，车头、车尾相对轮心的位置是估算的悬长，不是厂方悬长表。玻璃圆角、板件缝、灯罩和发动机包络都是估算，页面上标了 NTS。

## 怎么重新生成

```bash
node source/render.cjs index.html
```

`source/lib/` 里的 `geometry.js`、`projection.js`、`sheet.js` 来自先前灯具页面使用的 Jakub Krehel 隐藏线工具，只把图纸宽高改成了更适合这辆车的画幅。`model.cjs` 是这辆车的原创模型。

公开页面只包含生成后的线稿。产品册、PET 零件图和蓝图不进入仓库。

## 参考（只作依据，不转载图）

- Porsche Classic，typ 997：https://www.porsche.com/international/accessoriesandservice/classic/models/997/997/
- 2007 Porsche 911 US brochure，Internet Archive：https://archive.org/details/porsche-911-car-brochure-2007
- ADAC 911 Carrera Coupé 07/04–07/08：https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/porsche/911/997/998851/
- 911andco 997.1 Carrera 3.6 技术表：https://911andco.fr/fiche-technique-porsche-911-carrera-325ch-3-6-type-997-mk1-phase-1-2005-2008/
- 侧视比例参考了 GetOutlines 的 2005 Carrera S Coupé 免费轮廓（未放入页面）：https://getoutlines.com/blueprints/1871/2005-porsche-911-(997)-carrera-s-coupe-blueprints
- 造型对照了 Wikimedia 上可自由使用的 997.1 照片（例如 storem 的 2004 Carrera，CC BY-SA 2.0；TTTNIS 的 2007 Carrera S 侧面/车尾，CC0）。照片没有嵌进页面。
