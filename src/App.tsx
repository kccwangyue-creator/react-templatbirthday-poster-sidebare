import './App.css';
import { bitable } from '@lark-base-open/js-sdk';
import { useRef, useState } from 'react';
import templateUrl from './template.jpg';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  const drawPoster = (employeeName: string) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      setMessage('没有找到 Canvas');
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setMessage('Canvas 初始化失败');
      return;
    }

    const templateImg = new Image();

    // 这里直接使用 Vite 打包后的图片地址
    templateImg.src = templateUrl;

    templateImg.onload = () => {
      canvas.width = templateImg.naturalWidth;
      canvas.height = templateImg.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制底图
      ctx.drawImage(templateImg, 0, 0);

      // 姓名样式
      ctx.fillStyle = '#8A0AA5';
      ctx.font =
        'bold 60px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 姓名位置
      ctx.fillText(employeeName, 352, 1047);

      const url = canvas.toDataURL('image/png');

      setDownloadUrl(url);
      setMessage(`已生成 ${employeeName} 的生日海报`);
    };

    templateImg.onerror = () => {
      setMessage('生日海报模板加载失败');
    };
  };

  const readCurrentName = async () => {
    try {
      setMessage('正在读取姓名...');

      const selection = await bitable.base.getSelection();

      if (!selection.tableId || !selection.recordId) {
        setMessage('请先在多维表里点击某一行');
        return;
      }

      const table = await bitable.base.getTableById(
        selection.tableId
      );

      const nameField = await table.getFieldByName('姓名');

      const employeeName = await table.getCellString(
        nameField.id,
        selection.recordId
      );

      if (!employeeName) {
        setMessage('当前记录的「姓名」为空');
        return;
      }

      setName(employeeName);

      // 读取成功后直接生成海报
      drawPoster(employeeName);

    } catch (error) {
      console.error('读取姓名失败：', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(`读取姓名失败：${errorMessage}`);
    }
  };

  const handleGenerate = () => {
    const employeeName = name.trim();

    if (!employeeName) {
      setMessage('请输入员工姓名');
      return;
    }

    drawPoster(employeeName);
  };

  return (
    <main className="main">

      <h2>生日海报生成器 🎂</h2>

      <div className="controls">

        <input
          className="nameInput"
          type="text"
          placeholder="请输入员工姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="button"
          onClick={readCurrentName}
        >
          读取当前行姓名
        </button>

        <button
          className="button"
          onClick={handleGenerate}
        >
          生成海报
        </button>

      </div>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="posterCanvas"
        width={1242}
        height={2208}
      />

      {downloadUrl && (
        <a
          className="downloadLink"
          href={downloadUrl}
          download={`生日海报-${name}.png`}
        >
          下载海报
        </a>
      )}

    </main>
  );
}
