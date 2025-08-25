import { ref, watchEffect, type Ref } from 'vue';
import type { Box } from '../core/ImageEditor';
import type { CanvasState } from './useCanvasState';

const ANCHOR_SIZE = 8;
const ANCHOR_COLOR = '#ffffff';
const ANCHOR_STROKE_COLOR = '#007bff';

function getAnchors(box: Box) {
  return {
    topLeft: { x: box.x, y: box.y },
    topMiddle: { x: box.x + box.w / 2, y: box.y },
    topRight: { x: box.x + box.w, y: box.y },
    middleLeft: { x: box.x, y: box.y + box.h / 2 },
    middleRight: { x: box.x + box.w, y: box.y + box.h / 2 },
    bottomLeft: { x: box.x, y: box.y + box.h },
    bottomMiddle: { x: box.x + box.w / 2, y: box.y + box.h },
    bottomRight: { x: box.x + box.w, y: box.y + box.h },
  };
}

/**
 * @description Handles all drawing operations on the main and preview canvases.
 */
export function useCanvasDrawing(
  state: CanvasState,
  canvasRef: Ref<HTMLCanvasElement | null>,
  previewCanvasRef: Ref<HTMLCanvasElement | null>
) {
  const { imageEditor, slicingMode, selectedBoxId, canvasPadding } = state;
  const ctxRef = ref<CanvasRenderingContext2D | null>(null);

  const draw = () => {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imageEditor.sourceImage) {
      ctx.drawImage(imageEditor.sourceImage, canvasPadding.value, canvasPadding.value);

      if (slicingMode.value === 'custom') {
        imageEditor.boxes.forEach(box => {
          const isSelected = box.id === selectedBoxId.value;
          ctx.lineWidth = 2;
          ctx.strokeStyle = isSelected ? '#007bff' : '#FF0000';
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          if (isSelected) {
            ctx.fillStyle = ANCHOR_COLOR;
            ctx.strokeStyle = ANCHOR_STROKE_COLOR;
            ctx.lineWidth = 2;
            const anchors = getAnchors(box);
            for (const key in anchors) {
              const anchor = anchors[key as keyof typeof anchors];
              ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
              ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
            }
          }
        });
      } else if (slicingMode.value === 'grid' && imageEditor.gridArea) {
        const box = imageEditor.gridArea;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#007bff';
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const cellWidth = box.w / imageEditor.gridCols;
        for (let i = 1; i < imageEditor.gridCols; i++) {
          ctx.beginPath();
          ctx.moveTo(box.x + i * cellWidth, box.y);
          ctx.lineTo(box.x + i * cellWidth, box.y + box.h);
          ctx.stroke();
        }

        const cellHeight = box.h / imageEditor.gridRows;
        for (let i = 1; i < imageEditor.gridRows; i++) {
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + i * cellHeight);
          ctx.lineTo(box.x + box.w, box.y + i * cellHeight);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.fillStyle = ANCHOR_COLOR;
        ctx.strokeStyle = ANCHOR_STROKE_COLOR;
        ctx.lineWidth = 2;
        const anchors = getAnchors(box);
        for (const key in anchors) {
          const anchor = anchors[key as keyof typeof anchors];
          ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
          ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
        }
      }
    }
  };

  const updatePreview = () => {
    const previewCanvas = previewCanvasRef.value;
    if (!previewCanvas || !imageEditor.sourceImage) return;

    const container = previewCanvas.parentElement;
    if (!container) return;

    previewCanvas.width = container.clientWidth;
    previewCanvas.height = container.clientHeight;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (slicingMode.value === 'grid') return;

    const selectedBox = imageEditor.boxes.find(b => b.id === selectedBoxId.value);

    if (selectedBox && selectedBox.w > 0 && selectedBox.h > 0) {
      const aspectRatio = selectedBox.w / selectedBox.h;
      let drawW = previewCanvas.width;
      let drawH = drawW / aspectRatio;

      if (drawH > previewCanvas.height) {
        drawH = previewCanvas.height;
        drawW = drawH * aspectRatio;
      }

      const drawX = (previewCanvas.width - drawW) / 2;
      const drawY = (previewCanvas.height - drawH) / 2;

      previewCtx.drawImage(
        imageEditor.sourceImage,
        selectedBox.x - canvasPadding.value, selectedBox.y - canvasPadding.value, selectedBox.w, selectedBox.h,
        drawX, drawY, drawW, drawH
      );
    }
  };

  const setupCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    ctxRef.value = canvas.getContext('2d');
    if (!ctxRef.value) return;

    canvas.width = img.width + canvasPadding.value * 2;
    canvas.height = img.height + canvasPadding.value * 2;
    draw();
  };

  // --- Watchers for automatic redraw ---
  watchEffect(() => {
    if (canvasRef.value) {
      draw();
    }
  });

  watchEffect(() => {
    if (previewCanvasRef.value) {
      updatePreview();
    }
  });

  return {
    draw,
    updatePreview,
    setupCanvas,
    getAnchors,
    ctxRef,
  };
}
