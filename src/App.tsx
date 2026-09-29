import './App.css';
import { bitable } from '@lark-base-open/js-sdk';
import { useRef, useState } from 'react';

const TEMPLATE_URL = new URL('./template.jpg', import.meta.url).href;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // 把各种可能的姓名值统一转成字符串
  const normalizeNameValue = (value: any): string => {
    if (value == null) return '';

    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item?.text) return item.text;
          if (item?.name) return item.name;
          return '';
        })
        .join('')
        .trim();
    }

    if (typeof value === 'object') {
      if (typeof value.text === 'string') return value.text.trim();
      if (typeof value.name === 'string') return value.name.trim();
    }

    return String(value).trim();
  };

  // 判断附件字段是否已有值
  const hasAttachmentValue = (value: any): boolean => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  };

  // 画海报 + 导出 blob/dataUrl
  const renderPoster = async (
    employeeName: string
  ): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        reject(new Error('没有找到 Canvas'));
        return;
      }

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas 初始化失败'));
        return;
      }

      const templateImg = new Image();
      templateImg.src = TEMPLATE_URL;

      templateImg.onload = () => {
        canvas.width = templateImg.naturalWidth;
        canvas.height = templateImg.naturalHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(templateImg, 0, 0);

        // 文字样式
        ctx.fillStyle = '#8A0AA5';
        ctx.font =
          'bold 60px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // 姓名位置
        ctx.fillText(employeeName, 352, 1047);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('海报图片导出失败'));
              return;
            }

            const dataUrl = canvas.toDataURL('image/png');
            resolve({ blob, dataUrl });
          },
          'image/png',
          1
        );
      };

      templateImg.onerror = () => {
        reject(new Error('生日海报模板加载失败'));
      };
    });
  };

  // 把图片文件写回「海报图」
  const writePosterToRecord = async (
    posterField: any,
    recordId: string,
    employeeName: string,
    blob: Blob
  ) => {
    const file = new File(
      [blob],
      `生日海报-${employeeName}.png`,
      {
        type: 'image/png',
      }
    );

    const attachmentCell = await posterField.getCell(recordId);
    await attachmentCell.setValue(file);
  };

  // 单条：生成并写回
  const generateAndWriteOneRecord = async (
    table: any,
    posterField: any,
    recordId: string,
    employeeName: string
  ) => {
    const { blob, dataUrl } = await renderPoster(employeeName);

    setName(employeeName);
    setDownloadUrl(dataUrl);

    await writePosterToRecord(
      posterField,
      recordId,
      employeeName,
      blob
    );
  };

  // 读取当前选中行，生成并写回
  const readCurrentNameAndGenerate = async () => {
    try {
      setMessage('正在读取当前行...');

      const selection = await bitable.base.getSelection();

      if (!selection.tableId || !selection.recordId) {
        setMessage('请先在多维表里点击某一行');
        return;
      }

      const table = await bitable.base.getTableById(selection.tableId);
      const nameField = await table.getFieldByName('姓名');
      const posterField = await table.getFieldByName('海报图');

      const employeeName = await table.getCellString(
        nameField.id,
        selection.recordId
      );

      if (!employeeName || !employeeName.trim()) {
        setMessage('当前记录的「姓名」为空');
        return;
      }

      setMessage(`正在为 ${employeeName} 生成海报...`);

      await generateAndWriteOneRecord(
        table,
        posterField,
        selection.recordId,
        employeeName.trim()
      );

      setMessage(`✅ ${employeeName} 的海报已生成并写入「海报图」`);
    } catch (error) {
      console.error('单条生成失败：', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setMessage(`❌ 单条生成失败：${errorMessage}`);
    }
  };

  // 仅生成预览，不写回
  const handlePreviewOnly = async () => {
    try {
      const employeeName = name.trim();

      if (!employeeName) {
        setMessage('请输入员工姓名');
        return;
      }

      setMessage(`正在生成 ${employeeName} 的预览...`);

      const { dataUrl } = await renderPoster(employeeName);
      setDownloadUrl(dataUrl);

      setMessage(`✅ 已生成 ${employeeName} 的预览海报`);
    } catch (error) {
      console.error('预览生成失败：', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setMessage(`❌ 预览生成失败：${errorMessage}`);
    }
  };

  // 批量生成：只处理 姓名不为空 + 海报图为空 的记录
  const batchGenerateMissingPosters = async () => {
    try {
      setIsBatchRunning(true);
      setMessage('正在扫描需要生成海报的记录...');

      const table = await bitable.base.getActiveTable();
      const nameField = await table.getFieldByName('姓名');
      const posterField = await table.getFieldByName('海报图');

      let pageToken: any = undefined;
      const targets: Array<{ recordId: string; employeeName: string }> = [];

      while (true) {
        const res = await table.getRecordsByPage({
          pageSize: 200,
          pageToken,
        });

        const records = res.records || [];

        for (const record of records) {
          const recordId = record.recordId;
          const nameValue = record.fields?.[nameField.id];
          const posterValue = record.fields?.[posterField.id];

          const employeeName = normalizeNameValue(nameValue);
          const hasPoster = hasAttachmentValue(posterValue);

          if (!employeeName) continue;
          if (hasPoster) continue;

          targets.push({
            recordId,
            employeeName,
          });
        }

        if (!res.hasMore) break;
        pageToken = res.pageToken;
      }

      if (targets.length === 0) {
        setMessage('✅ 没有需要批量生成的记录（可能都已有海报，或姓名为空）');
        setIsBatchRunning(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];

        try {
          setMessage(
            `正在处理 ${i + 1}/${targets.length}：${item.employeeName}`
          );

          await generateAndWriteOneRecord(
            table,
            posterField,
            item.recordId,
            item.employeeName
          );

          successCount += 1;
        } catch (error) {
          console.error(`处理 ${item.employeeName} 失败：`, error);
          failCount += 1;
        }
      }

      setMessage(
        `✅ 批量完成：成功 ${successCount} 条，失败 ${failCount} 条，共 ${targets.length} 条`
      );
    } catch (error) {
      console.error('批量生成失败：', error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setMessage(`❌ 批量生成失败：${errorMessage}`);
    } finally {
      setIsBatchRunning(false);
    }
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
          onClick={readCurrentNameAndGenerate}
          disabled={isBatchRunning}
        >
          读取当前行并生成海报
        </button>

        <button
          className="button"
          onClick={batchGenerateMissingPosters}
          disabled={isBatchRunning}
        >
          {isBatchRunning ? '批量生成中...' : '批量生成缺失海报'}
        </button>

        <button
          className="button"
          onClick={handlePreviewOnly}
          disabled={isBatchRunning}
        >
          仅生成预览
        </button>
      </div>

      {message && <div className="message">{message}</div>}

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
          download={`生日海报-${name || '员工'}.png`}
        >
          下载当前预览海报
        </a>
      )}
    </main>
  );
}
