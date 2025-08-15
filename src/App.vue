<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <h1>智能图片拆分工具</h1>
    </el-header>
    <el-container>
      <el-main class="main-content">
        <el-card shadow="never" class="canvas-card">
          <canvas 
            ref="canvasRef" 
            class="editor-canvas checkerboard-bg"
            :style="{ cursor: cursorStyle }"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseLeave"
          ></canvas>
        </el-card>
      </el-main>
      <el-aside width="350px" class="sidebar">
        <el-card shadow="never">
          <div class="control-panel">
            <el-upload
              class="upload-control"
              drag
              action="#"
              :show-file-list="false"
              :auto-upload="false"
              @change="handleFileChange"
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                将图集文件拖到此处，或<em>点击上传</em>
              </div>
            </el-upload>

            <el-divider>预览</el-divider>
            <div class="preview-box checkerboard-bg">
              <canvas ref="previewCanvasRef"></canvas>
            </div>

            <el-divider>操作</el-divider>
            <el-form-item label-width="100px" label="识别内边距">
              <el-input-number v-model="autoDetectPadding" :min="0" :max="50" controls-position="right" size="small" />
            </el-form-item>
            <div class="action-buttons">
              <el-button type="primary" style="width: 100%;" @click="handleAutoDetect">自动识别</el-button>
              <el-button type="danger" style="width: 100%;" @click="handleClearAll">
                <el-icon><Delete /></el-icon>
                清除
              </el-button>
            </div>
            
            <el-divider>导出设置</el-divider>
            <el-row :gutter="10">
              <el-col :span="18">
                <el-input v-model="exportPrefix" placeholder="请输入文件名前缀">
                  <template #prepend>前缀</template>
                </el-input>
              </el-col>
              <el-col :span="6">
                <el-input v-model="exportConnector" placeholder="连接符" />
              </el-col>
            </el-row>
            <el-text type="info" size="small" style="margin-top: 5px; display: block;">
              预览: {{ fileNamePreview }}
            </el-text>
            <el-button type="success" style="width: 100%; margin-top: 10px;" @click="handleExport">
              <el-icon><Download /></el-icon>
              全部导出
            </el-button>
          </div>
        </el-card>
      </el-aside>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { UploadFile } from 'element-plus';
import { ElMessageBox } from 'element-plus';
import { UploadFilled, Download, Delete } from '@element-plus/icons-vue';
import JSZip from 'jszip';

// Data Structures
interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const previewCanvasRef = ref<HTMLCanvasElement | null>(null);
const ctxRef = ref<CanvasRenderingContext2D | null>(null);
const sourceImage = ref<HTMLImageElement | null>(null);

const boxes = ref<Box[]>([]);
const selectedBoxId = ref<number | null>(null);

// Interaction State
const isDrawing = ref(false);
const isMoving = ref(false);
const startX = ref(0);
const startY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);

// --- Lifecycle Hooks ---
onMounted(() => {
  const canvas = canvasRef.value;
  if (canvas) {
    ctxRef.value = canvas.getContext('2d');
  }
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// --- Drawing and Preview ---
const ANCHOR_SIZE = 8;
const ANCHOR_COLOR = '#FFFFFF';
const ANCHOR_STROKE_COLOR = '#007bff';
const CANVAS_PADDING = 20;

const autoDetectPadding = ref(0);
const exportPrefix = ref('sprite');
const exportConnector = ref('_');

const fileNamePreview = computed(() => {
  return `${exportPrefix.value}${exportConnector.value}1.png`;
});

const getAnchors = (box: Box) => {
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
};

const draw = () => {
  const canvas = canvasRef.value;
  const ctx = ctxRef.value;
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (sourceImage.value) {
    ctx.drawImage(sourceImage.value, CANVAS_PADDING, CANVAS_PADDING);
  }

  boxes.value.forEach(box => {
    const isSelected = box.id === selectedBoxId.value;
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelected ? '#007bff' : '#FF0000';
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    if (isSelected) {
      ctx.fillStyle = ANCHOR_COLOR;
      ctx.strokeStyle = ANCHOR_STROKE_COLOR;
      ctx.lineWidth = 1;
      const anchors = getAnchors(box);
      for (const key in anchors) {
        const anchor = anchors[key as keyof typeof anchors];
        ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
        ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
      }
    }
  });
};

const updatePreview = () => {
  const previewCanvas = previewCanvasRef.value;
  if (!previewCanvas || !sourceImage.value) return;

  const container = previewCanvas.parentElement;
  if (!container) return;

  // Match canvas buffer size to container size
  previewCanvas.width = container.clientWidth;
  previewCanvas.height = container.clientHeight;

  const previewCtx = previewCanvas.getContext('2d');
  if (!previewCtx) return;

  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);

  if (selectedBox && selectedBox.w > 0 && selectedBox.h > 0) {
    // Calculate dimensions to draw while maintaining aspect ratio
    const aspectRatio = selectedBox.w / selectedBox.h;
    let drawW = previewCanvas.width;
    let drawH = drawW / aspectRatio;

    if (drawH > previewCanvas.height) {
      drawH = previewCanvas.height;
      drawW = drawH * aspectRatio;
    }

    // Center the image within the canvas
    const drawX = (previewCanvas.width - drawW) / 2;
    const drawY = (previewCanvas.height - drawH) / 2;

    previewCtx.drawImage(
      sourceImage.value,
      selectedBox.x - CANVAS_PADDING, selectedBox.y - CANVAS_PADDING, selectedBox.w, selectedBox.h, // Source rect
      drawX, drawY, drawW, drawH // Destination rect (aspect-ratio corrected)
    );
  }
};

// --- Event Handlers ---
const handleFileChange = (uploadFile: UploadFile) => {
  if (!uploadFile.raw || !uploadFile.raw.type.startsWith('image')) return;

  const img = new Image();
  const objectUrl = URL.createObjectURL(uploadFile.raw);
  img.src = objectUrl;

  img.onload = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    sourceImage.value = img;
    canvas.width = img.width + CANVAS_PADDING * 2;
    canvas.height = img.height + CANVAS_PADDING * 2;
    boxes.value = [];
    selectedBoxId.value = null;
    draw();
    updatePreview();
    URL.revokeObjectURL(objectUrl);
  };
};

const getBoxAt = (x: number, y: number): Box | null => {
  for (let i = boxes.value.length - 1; i >= 0; i--) {
    const box = boxes.value[i];
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
      return box;
    }
  }
  return null;
};

const isResizing = ref(false);
const activeAnchor = ref<string | null>(null);
const cursorStyle = ref('default');

const getAnchorAt = (x: number, y: number, box: Box): string | null => {
  const anchors = getAnchors(box);
  for (const key in anchors) {
    const anchor = anchors[key as keyof typeof anchors];
    if (
      x >= anchor.x - ANCHOR_SIZE / 2 && x <= anchor.x + ANCHOR_SIZE / 2 &&
      y >= anchor.y - ANCHOR_SIZE / 2 && y <= anchor.y + ANCHOR_SIZE / 2
    ) {
      return key;
    }
  }
  return null;
};

const originalAspectRatio = ref(1);

const onMouseDown = (e: MouseEvent) => {
  e.preventDefault(); // Prevent default browser drag behavior
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  startX.value = e.clientX - rect.left;
  startY.value = e.clientY - rect.top;

  const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);
  if (selectedBox) {
    const anchor = getAnchorAt(startX.value, startY.value, selectedBox);
    if (anchor) {
      isResizing.value = true;
      activeAnchor.value = anchor;
      originalAspectRatio.value = selectedBox.w / selectedBox.h;
      return;
    }
  }

  const clickedBox = getBoxAt(startX.value, startY.value);
  if (clickedBox) {
    selectedBoxId.value = clickedBox.id;
    isMoving.value = true;
    offsetX.value = startX.value - clickedBox.x;
    offsetY.value = startY.value - clickedBox.y;
  } else {
    selectedBoxId.value = null;
    isDrawing.value = true;
    const newBox: Box = { id: Date.now(), x: startX.value, y: startY.value, w: 0, h: 0 };
    boxes.value.push(newBox);
  }
  draw();
  updatePreview();
};

const onMouseMove = (e: MouseEvent) => {
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  // Update cursor style
  const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);
  let cursor = 'default';
  if (selectedBox) { // Always check for cursor updates if a box is selected
    const anchor = getAnchorAt(currentX, currentY, selectedBox);
    if (anchor) {
      if (anchor === 'topLeft' || anchor === 'bottomRight') {
        cursor = 'nwse-resize';
      } else if (anchor === 'topRight' || anchor === 'bottomLeft') {
        cursor = 'nesw-resize';
      } else if (anchor === 'middleLeft' || anchor === 'middleRight') {
        cursor = 'ew-resize';
      } else if (anchor === 'topMiddle' || anchor === 'bottomMiddle') {
        cursor = 'ns-resize';
      }
    } else if (getBoxAt(currentX, currentY)) {
      cursor = 'move';
    }
  }
  cursorStyle.value = cursor;

  if (isResizing.value && selectedBox) {
    const originalX = selectedBox.x;
    const originalY = selectedBox.y;
    const originalW = selectedBox.w;
    const originalH = selectedBox.h;

    let newX = selectedBox.x, newY = selectedBox.y, newW = selectedBox.w, newH = selectedBox.h;

    switch (activeAnchor.value) {
      case 'topLeft': {
        newX = currentX;
        newY = currentY;
        newW = originalX + originalW - currentX;
        newH = newW / originalAspectRatio.value;
        newY = originalY + originalH - newH;
        break;
      }
      case 'topRight': {
        newW = currentX - originalX;
        newH = newW / originalAspectRatio.value;
        newY = originalY + originalH - newH;
        break;
      }
      case 'bottomLeft': {
        newX = currentX;
        newW = originalX + originalW - currentX;
        newH = newW / originalAspectRatio.value;
        break;
      }
      case 'bottomRight': {
        newW = currentX - originalX;
        newH = newW / originalAspectRatio.value;
        break;
      }
      case 'topMiddle':
        newY = currentY;
        newH = originalY + originalH - currentY;
        break;
      case 'bottomMiddle':
        newH = currentY - originalY;
        break;
      case 'middleLeft':
        newX = currentX;
        newW = originalX + originalW - currentX;
        break;
      case 'middleRight':
        newW = currentX - originalX;
        break;
    }

    // Clamp resizing to canvas boundaries
    if (newX < 0) { newW += newX; newX = 0; }
    if (newY < 0) { newH += newY; newY = 0; }
    if (newX + newW > canvasRef.value.width) { newW = canvasRef.value.width - newX; }
    if (newY + newH > canvasRef.value.height) { newH = canvasRef.value.height - newY; }

    selectedBox.x = newX;
    selectedBox.y = newY;
    selectedBox.w = newW;
    selectedBox.h = newH;

    updatePreview();
  } else if (isMoving.value) {
    const canvas = canvasRef.value;
    if (selectedBox && canvas) {
      let newX = currentX - offsetX.value;
      let newY = currentY - offsetY.value;

      // Clamp position to be within canvas boundaries
      newX = Math.max(0, Math.min(newX, canvas.width - selectedBox.w));
      newY = Math.max(0, Math.min(newY, canvas.height - selectedBox.h));

      selectedBox.x = newX;
      selectedBox.y = newY;
      updatePreview(); // Update preview in real-time while moving
    }
  } else if (isDrawing.value) {
    const currentBox = boxes.value[boxes.value.length - 1];
    currentBox.w = currentX - startX.value;
    currentBox.h = currentY - startY.value;
  }

  if (isMoving.value || isDrawing.value || isResizing.value) {
    draw();
  }
};

const onMouseUp = () => {
  if (isResizing.value && selectedBoxId.value) {
    const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);
    if (selectedBox) {
      if (selectedBox.w < 0) { selectedBox.x += selectedBox.w; selectedBox.w = -selectedBox.w; }
      if (selectedBox.h < 0) { selectedBox.y += selectedBox.h; selectedBox.h = -selectedBox.h; }
    }
  }
  if (isDrawing.value) {
    const currentBox = boxes.value[boxes.value.length - 1];
    if (currentBox.w < 0) { currentBox.x += currentBox.w; currentBox.w = -currentBox.w; }
    if (currentBox.h < 0) { currentBox.y += currentBox.h; currentBox.h = -currentBox.h; }
    if (currentBox.w < 5 || currentBox.h < 5) { boxes.value.pop(); }
    selectedBoxId.value = currentBox ? currentBox.id : null;
    updatePreview();
  } 

  isDrawing.value = false;
  isMoving.value = false;
  isResizing.value = false;
  activeAnchor.value = null;
  draw();
};

const onMouseLeave = () => {
  if (isDrawing.value || isMoving.value) {
    onMouseUp();
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (selectedBoxId.value === null) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    const index = boxes.value.findIndex(b => b.id === selectedBoxId.value);
    if (index !== -1) {
      boxes.value.splice(index, 1);
      selectedBoxId.value = null;
      draw();
      updatePreview();
    }
  }
};

const handleClearAll = () => {
  if (boxes.value.length === 0) return;

  ElMessageBox.confirm(
    '此操作将清除所有手动和自动生成的选框，是否继续？',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    boxes.value.length = 0;
    selectedBoxId.value = null;
    draw();
    updatePreview();
  }).catch(() => {
    // User cancelled, do nothing.
  });
};

const handleAutoDetect = () => {
  const canvas = canvasRef.value;
  const ctx = ctxRef.value;
  if (!canvas || !ctx || !sourceImage.value) {
    return;
  }

  // Create a temporary canvas to get clean image data without any drawings
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCanvas.width = sourceImage.value.width;
  tempCanvas.height = sourceImage.value.height;
  tempCtx.drawImage(sourceImage.value, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

  const { data, width, height } = imageData;

  const visited = new Uint8Array(width * height);
  const newBoxes: Box[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x);
      const alphaIndex = index * 4 + 3;

      if (visited[index] || data[alphaIndex] === 0) {
        continue;
      }

      const queue: [number, number][] = [[x, y]];
      visited[index] = 1;
      let minX = x, minY = y, maxX = x, maxY = y;

      while (queue.length > 0) {
        const [curX, curY] = queue.shift()!;

        minX = Math.min(minX, curX);
        minY = Math.min(minY, curY);
        maxX = Math.max(maxX, curX);
        maxY = Math.max(maxY, curY);

        const neighbors = [[curX, curY - 1], [curX, curY + 1], [curX - 1, curY], [curX + 1, curY]];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIndex = (ny * width + nx);
            const neighborAlphaIndex = neighborIndex * 4 + 3;
            if (!visited[neighborIndex] && data[neighborAlphaIndex] > 0) {
              visited[neighborIndex] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }

      const padding = autoDetectPadding.value;
      const originalW = maxX - minX + 1;
      const originalH = maxY - minY + 1;

      // Calculate the ideal, centered box with padding, in image coordinates
      const idealX = minX - padding;
      const idealY = minY - padding;
      const idealW = originalW + padding * 2;
      const idealH = originalH + padding * 2;

      // Translate to canvas coordinates by adding the canvas padding. No image-boundary clipping.
      const boxX = idealX + CANVAS_PADDING;
      const boxY = idealY + CANVAS_PADDING;
      const boxW = idealW;
      const boxH = idealH;

      newBoxes.push({ id: Date.now() + newBoxes.length, x: boxX, y: boxY, w: boxW, h: boxH });
    }
  }

  boxes.value.length = 0;
  boxes.value.push(...newBoxes);

  selectedBoxId.value = null;
  draw();
  updatePreview();
};

const handleExport = async () => {
  if (!sourceImage.value || boxes.value.length === 0) {
    ElMessageBox.alert('没有可导出的内容，请先上传图集并创建选框。', '提示', { type: 'warning' });
    return;
  }

  const zip = new JSZip();
  const img = sourceImage.value;

  for (const [index, box] of boxes.value.entries()) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = box.w;
    tempCanvas.height = box.h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) continue;

    // Define the image area on the main canvas
    const imageRect = { x: CANVAS_PADDING, y: CANVAS_PADDING, w: img.width, h: img.height };

    // Find the intersection of the box and the image area
    const intersectX = Math.max(box.x, imageRect.x);
    const intersectY = Math.max(box.y, imageRect.y);
    const intersectMaxX = Math.min(box.x + box.w, imageRect.x + imageRect.w);
    const intersectMaxY = Math.min(box.y + box.h, imageRect.y + imageRect.h);

    const intersectW = intersectMaxX - intersectX;
    const intersectH = intersectMaxY - intersectY;

    // Only draw if there is a valid intersection
    if (intersectW > 0 && intersectH > 0) {
      // Source coordinates are relative to the original image
      const sourceX = intersectX - CANVAS_PADDING;
      const sourceY = intersectY - CANVAS_PADDING;

      // Destination coordinates are relative to the temp canvas
      const destX = intersectX - box.x;
      const destY = intersectY - box.y;

      tempCtx.drawImage(
        img,
        sourceX, sourceY, intersectW, intersectH,         // Source rect (from original image)
        destX, destY, intersectW, intersectH            // Destination rect (on temp canvas)
      );
    }

    const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, 'image/png'));
    if (blob) {
      const filename = `${exportPrefix.value}${exportConnector.value}${index + 1}.png`;
      zip.file(filename, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const a = document.createElement('a');
  const url = URL.createObjectURL(zipBlob);
  a.href = url;
  a.download = `${exportPrefix.value}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

</script>

<style>
html, body, #app, .app-container {
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #f4f4f5;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
}

.main-content {
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.canvas-card {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
}

.editor-canvas {
  border: 1px dashed #dcdfe6;
}

.sidebar {
  padding: 20px 20px 20px 0;
}

.control-panel .el-divider__text {
  font-size: 14px;
  color: #909399;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.preview-box {
  width: 100%;
  height: 200px;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.preview-box canvas {
  max-width: 100%;
  max-height: 100%;
}

.upload-control {
  margin-bottom: 20px;
}

.checkerboard-bg {
  background-color: #ffffff;
  background-image: 
    linear-gradient(45deg, #eee 25%, transparent 25%), 
    linear-gradient(135deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%),
    linear-gradient(135deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  background-position: 0 0, 10px 0, 10px -10px, 0px 10px;
}

</style>