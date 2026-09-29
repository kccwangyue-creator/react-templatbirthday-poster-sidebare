import './App.css';
import { bitable } from '@lark-base-open/js-sdk';
import { useRef, useState } from 'react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  const drawPoster = (
    employeeName: string,
    recordId?: string,
    tableId?: string
  ) => {
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

    templateImg.src = new URL(
      './template.jpg',
      import.meta.url
    ).href;

    templateImg.onload = () => {
      canvas.width = templateImg.naturalWidth;
      canvas.height = templateImg.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(templateImg, 0, 0);

      ctx.fillStyle = '#8A0AA5';
      ctx.font =
        'bold 60px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.fillText(employeeName, 352, 1047);

      const url = canvas.toDataURL('image/png');
      setDownloadUrl(url);

      if (recordId && tableId) {
        uploadPosterToBase(
          canvas,
          employeeName,
          recordId,
          tableId
        );
      } else {
        setMessage(`已生成 ${employeeName} 的生日海报`);
      }
    };

    templateImg.onerror = () => {
      setMessage('生日海报模板加载失败');
    };
  };

  const uploadPosterToBase = async (
    canvas: HTMLCanvasElement,
    employeeName: string,
    recordId: string,
    tableId: string
  ) => {
    try {
      setMessage('正在上传海报到多维表...');

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        setMessage('生成图片文件失败');
        return;
      }

      const file = new File(
        [blob],
        `生日海报-${employeeName}.png`,
        { type: 'image/png' }
      );

      // 第一步：先上传到飞书，获取 file token
      const tokens = await bitable.base.batchUploadFile([file]);

      if (!tokens || !tokens[0]) {
        setMessage('文件上传失败，没有获取到 token');
        return;
      }

      const token = tokens[0];

      const table =
        await bitable.base.getTableById(tableId);

      const posterField =
        await table.getFieldByName('海报图');

      // 第二步：把附件信息写回当前记录
      const success = await posterField.setValue(
        recordId,
        [
          {
            name: file.name,
            size: file.size,
            type: file.type,
            token,
            timeStamp: Date.now(),
          },
        ]
      );

      if (success === false) {
        setMessage('附件写入失败');
        return;
      }

      setMessage(
        `✅ ${employeeName} 的海报已生成并写入「海报图」`
      );

    } catch (error) {
      console.error('上传海报失败：', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(
        `海报生成成功，但写入多维表失败：${errorMessage}`
      );
    }
  };

  const readCurrentName = async () => {
    try {
      setMessage('正在读取姓名...');

      const selection =
        await bitable.base.getSelection();

      if (
        !selection.tableId ||
        !selection.recordId
      ) {
        setMessage('请先在多维表里点击某一行');
        return;
      }

      const table =
        await bitable.base.getTableById(
          selection.tableId
        );

      const nameField =
        await table.getFieldByName('姓名');

      const employeeName =
        await table.getCellString(
          nameField.id,
          selection.recordId
        );

      if (!employeeName) {
        setMessage('当前记录的「姓名」为空');
        return;
      }

      setName(employeeName);

      drawPoster(
        employeeName,
        selection.recordId,
        selection.tableId
      );

    } catch (error) {
      console.error('读取姓名失败：', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      setMessage(
        `读取姓名失败：${errorMessage}`
      );
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
          读取当前行并生成海报
        </button>

        <button
          className="button"
          onClick={handleGenerate}
        >
          仅生成预览
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
