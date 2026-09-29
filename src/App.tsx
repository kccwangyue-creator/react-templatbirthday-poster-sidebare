import './App.css';
import { bitable } from '@lark-base-open/js-sdk';
import { useRef, useState } from 'react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  // 生成海报
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

    templateImg.src = '/template.jpg';

    templateImg.onload = () => {
      // 使用模板原始尺寸
      canvas.width = templateImg.naturalWidth;
      canvas.height = templateImg.naturalHeight;

      // 清空
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 画海报底图
      ctx.drawImage(templateImg, 0, 0);

      // =========================
      // 姓名样式
      // =========================
      ctx.fillStyle = '#8A0AA5';

      ctx.font =
        'bold 60px "PingFang SC", "Microsoft YaHei", sans-serif';

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 图怪兽给出的姓名区域：
      // X = 352
      // Y = 1009
      // 高 = 76
      // 所以 middle Y ≈ 1047
      ctx.fillText(employeeName, 352, 1047);

      // 生成下载图片
      const url = canvas.toDataURL('image/png');

      setDownloadUrl(url);
      setMessage(`已生成 ${employeeName} 的生日海报`);
    };

    templateImg.onerror = () => {
      setMessage(
        'template.jpg 加载失败，请确认图片已经放在 public 文件夹里'
      );
    };
  };

  // 从当前选中的多维表记录读取姓名
  const readCurrentName = async () => {
    try {
      setMessage('正在读取姓名...');

      const selection = await bitable.base.getSelection();

      console.log('当前选中信息：', selection);

      if (!selection.tableId || !selection.recordId) {
        setMessage('请先在多维表里点击某一行');
        return;
      }

      // 获取当前记录所在的数据表
      const table = await bitable.base.getTableById(
        selection.tableId
      );

      // 找到名为「姓名」的字段
      const nameField = await table.getFieldByName('姓名');

      // 获取当前记录的姓名
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

  // 手动生成
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
