997 拍立得照片墙 Demo 使用说明

1. 解压本压缩包。
2. 打开终端，cd 进入解压后的文件夹（包含 index.html 的目录）。
3. 运行：python3 -m http.server 8000
   （或者：npx serve）
4. 浏览器打开 http://localhost:8000/

注意：必须通过 http 服务访问，不能直接双击 index.html 用 file:// 打开，否则图片和数据无法加载。
