# Arcaea B30 Viewer

基于查分机器人导出数据的 B30 可视化工具，支持历史 PTT 折线图与多模式排行查看。

## 功能

- **PTT 折线图**：展示历史潜力值变化，鼠标悬停在任意时间点可查看当时的 B30，移出后保持显示
- **多排行模式**：B30 / P30（Far=0 且 Lost=0）/ LS0·30（LS=0）/ MAX·30（Pure=MaxPure）
- **B30 & TOP10 Avg**：同时显示 Best30 平均值与 Top10 平均值
- **显示设置**：可切换 LS 显示、MaxPure 样式（`+maxPure` 或 `-shiftCount`）
- **存档信息**：手动填写用户名与潜力值，CSV 导入的最高 PTT 另行标注不覆盖

## 目录结构

```
├── index.html
└── src/
    ├── fonts/            # 本地字体文件（可选）
    └── songs/            # 曲目封面图片
        ├── songlist          # 曲目列表（JSON，无扩展名）
        └── {songId}/
            ├── 1080_base_256.jpg
            ├── 1080_3_256.jpg    # BYD 难度封面（可选）
            └── base_256.jpg      # fallback
```

## 数据文件格式

由Yurisaki Bot导出，共两个 CSV 文件。

**Rating History CSV**
```ratings.csv
Timestamp,DateTime,UserRating
1731759995024,2024/11/16 20:26,12.54
```

**Play History CSV**
```all_scores.csv
SongId,Difficulty,Score,Constant,Potential,LS,MaxPure,Pure,Far,Lost,ClearType,Timestamp,DateTime
abstrusedilemma,2,9847862,11.3,12.53931,429.4,1237,1432,25,10,5,1719849794709,"2024-07-02 00:03:14"
```

| 字段 | 说明 |
|---|---|
| Difficulty | 0=PST 1=PRS 2=FTR 3=BYD 4=ETR |
| LS | Loss Score（越低越好，计算#用） |
| ClearType | 0=TL 1=NC 2=FR 3=PM 4=EC 5=HC |

## 导出步骤

1. 发送 `@Yurisaki /a export `
2. 得到回复 `@{username} [Arcaea Data Export] 数据已导出，地址：{address}`
3. 访问 `https://u.yurisaki.top/{address}`，下载`.zip`压缩文件
4. 解压后得到`ratings.csv`和`all_scores.csv`

## 使用

### 网页访问（推荐）
1. 访问 [Arcaea B30 Viewer](https://arctan01.github.io/arcaea-trend-b30/)
2. 上传 Rating CSV 和 Play CSV 

### GitHub Pages

1. Fork 本仓库
2. 将 `src/songlist`、`src/songs/` 放入对应目录
3. 开启 GitHub Pages，访问部署地址
4. 在页面上传 Rating CSV 和 Play CSV 即可

### 本地运行

`git clone https://github.com/Arctan01/arcaea-trend-b30.git` 到本地，直接双击 `index.html` 因浏览器 CORS 限制无法加载 songlist，需用本地 HTTP 服务器：

```bash
# 任选一种
npx serve .
python -m http.server 8080
```

然后访问 `http://localhost:8080`。
